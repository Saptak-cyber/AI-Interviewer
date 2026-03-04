/**
 * lib/voice-pipeline.ts
 *
 * Server-side WebSocket voice pipeline.
 * Handles one WebSocket connection per interview session, orchestrating:
 *   Browser audio (via MediaRecorder / energy VAD)
 *     → Whisper STT (HuggingFace)
 *     → Groq LLM (streaming, sentence-by-sentence)
 *     → ElevenLabs TTS (streaming per sentence)
 *     → MP3 audio chunks back to the browser
 *
 * Message protocol (all JSON, newline-delimited):
 *
 * Client → Server:
 *   { type: "end_of_speech", audio: "<base64>", mimeType: string }
 *   { type: "interrupt" }
 *   { type: "ping" }
 *
 * Server → Client:
 *   { type: "transcript",       text: string }
 *   { type: "ai_text_chunk",    text: string }
 *   { type: "audio_chunk",      data: "<base64 MP3>", sentenceText: string }
 *   { type: "response_complete", isComplete: boolean }
 *   { type: "error",            message: string }
 *   { type: "pong" }
 */

import type { WebSocket } from "ws";
import { transcribeAudio } from "./whisper";
import { callInterviewerLLMStream } from "./groq";
import { synthesizeSpeechStream } from "./tts";
import { getSessionState, setSessionState } from "./redis";
import { prisma } from "./prisma";

// ─── Message types ─────────────────────────────────────────────────────────────

type ClientMessage =
  | { type: "end_of_speech"; audio: string; mimeType: string }
  | { type: "interrupt" }
  | { type: "ping" };

type ServerMessage =
  | { type: "transcript"; text: string }
  | { type: "ai_text_chunk"; text: string }
  | { type: "audio_chunk"; data: string; sentenceText: string }
  | { type: "response_complete"; isComplete: boolean }
  | { type: "error"; message: string }
  | { type: "pong" };

// ─── Helpers ───────────────────────────────────────────────────────────────────

function send(ws: WebSocket, msg: ServerMessage) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

/**
 * Synthesize TTS for a sentence and send the complete MP3 as a single
 * audio_chunk message. Collects all streamed bytes before sending so
 * the client gets a complete, decodable MP3 segment.
 */
async function synthesizeAndSend(
  ws: WebSocket,
  sentence: string,
  signal: AbortSignal
): Promise<void> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of synthesizeSpeechStream(sentence, signal)) {
    if (signal.aborted) return;
    chunks.push(chunk);
  }
  if (signal.aborted || chunks.length === 0) return;

  const combined = Buffer.concat(chunks.map((c) => Buffer.from(c)));
  send(ws, {
    type: "audio_chunk",
    data: combined.toString("base64"),
    sentenceText: sentence,
  });
}

// ─── Main connection handler ───────────────────────────────────────────────────

export function handleVoiceConnection(ws: WebSocket, sessionId: string) {
  let abortController: AbortController | null = null;

  ws.on("message", (rawData: Buffer | string) => {
    void (async () => {
      let msg: ClientMessage;
      try {
        msg = JSON.parse(rawData.toString()) as ClientMessage;
      } catch {
        send(ws, { type: "error", message: "Invalid JSON message" });
        return;
      }

      // ── ping ────────────────────────────────────────────────────────────────
      if (msg.type === "ping") {
        send(ws, { type: "pong" });
        return;
      }

      // ── interrupt ───────────────────────────────────────────────────────────
      if (msg.type === "interrupt") {
        abortController?.abort();
        abortController = null;
        return;
      }

      // ── end_of_speech ────────────────────────────────────────────────────────
      if (msg.type === "end_of_speech") {
        // Abort any in-flight pipeline for the previous turn
        abortController?.abort();
        const ac = new AbortController();
        abortController = ac;
        const signal = ac.signal;

        try {
          // 1. Decode audio from base64
          const audioBuffer = Buffer.from(msg.audio, "base64");

          // 2. Transcribe via Whisper
          let transcript: string;
          try {
            transcript = await transcribeAudio(audioBuffer, msg.mimeType);
          } catch (sttErr) {
            if (signal.aborted) return;
            send(ws, {
              type: "error",
              message:
                sttErr instanceof Error
                  ? sttErr.message
                  : "Transcription failed",
            });
            return;
          }

          if (signal.aborted) return;
          if (!transcript.trim()) {
            // Empty transcript (silence/noise) — silently ignore
            return;
          }

          // 3. Send transcript to the client so user bubble can appear
          send(ws, { type: "transcript", text: transcript });

          // 4. Load session state from Redis
          const state = await getSessionState(sessionId);
          if (!state) {
            send(ws, { type: "error", message: "Session not found or expired" });
            return;
          }
          if (signal.aborted) return;

          if (state.isComplete) {
            send(ws, { type: "error", message: "Interview is already complete" });
            return;
          }

          // 5. Persist user turn to DB
          await prisma.interviewTurn.create({
            data: { sessionId, role: "USER", kind: "ANSWER", content: transcript },
          });
          state.conversationHistory.push({ role: "user", content: transcript });

          if (signal.aborted) return;

          // 6. Stream LLM response token by token
          let fullReply = "";
          let sentenceBuffer = "";

          // Keep TTS jobs sequential via a chain of promises
          let ttsChain: Promise<void> = Promise.resolve();

          for await (const token of callInterviewerLLMStream(
            state,
            transcript,
            signal
          )) {
            if (signal.aborted) break;

            fullReply += token;
            sentenceBuffer += token;

            // Stream each token to the client for live text display
            send(ws, { type: "ai_text_chunk", text: token });

            // Check for sentence boundary (flush to TTS when we have a full sentence)
            if (
              /[.!?]\s*$/.test(sentenceBuffer.trimEnd()) &&
              sentenceBuffer.trim().length > 10
            ) {
              const sentence = sentenceBuffer.trim();
              sentenceBuffer = "";

              // Queue TTS synthesis for this sentence (non-blocking, in order)
              const capturedSentence = sentence;
              ttsChain = ttsChain.then(() => {
                if (signal.aborted) return Promise.resolve();
                return synthesizeAndSend(ws, capturedSentence, signal).catch(
                  (err: unknown) => {
                    if (!signal.aborted)
                      console.error("[voice-pipeline] TTS error:", err);
                  }
                );
              });
            }
          }

          // Flush any remaining partial sentence (e.g. ends without punctuation)
          if (!signal.aborted && sentenceBuffer.trim()) {
            const lastSentence = sentenceBuffer.trim();
            ttsChain = ttsChain.then(() => {
              if (signal.aborted) return Promise.resolve();
              return synthesizeAndSend(ws, lastSentence, signal).catch(
                (err: unknown) => {
                  if (!signal.aborted)
                    console.error("[voice-pipeline] TTS error (last):", err);
                }
              );
            });
          }

          // Wait for all TTS jobs to finish before sending response_complete
          await ttsChain;

          if (signal.aborted) return;

          // 7. Detect completion sentinel
          const isComplete = fullReply
            .toLowerCase()
            .includes("that wraps up our interview");

          // 8. Persist AI reply and update state
          state.conversationHistory.push({ role: "assistant", content: fullReply });
          state.isComplete = isComplete;
          await setSessionState(sessionId, state);

          await prisma.interviewTurn.create({
            data: {
              sessionId,
              role: "AI",
              kind: isComplete ? "SYSTEM" : "FOLLOWUP",
              content: fullReply,
            },
          });

          if (isComplete) {
            await prisma.interviewSession.update({
              where: { id: sessionId },
              data: { endedAt: new Date(), isComplete: true },
            });
          }

          // 9. Notify client the turn is complete
          send(ws, { type: "response_complete", isComplete });
        } catch (err) {
          if (!signal.aborted) {
            console.error("[voice-pipeline] Unhandled error:", err);
            send(ws, {
              type: "error",
              message:
                err instanceof Error ? err.message : "Internal server error",
            });
          }
        }
      }
    })();
  });

  ws.on("close", () => {
    // Cancel any in-flight LLM / TTS streams when client disconnects
    abortController?.abort();
    abortController = null;
  });

  ws.on("error", (err) => {
    console.error(`[voice-pipeline] WebSocket error (session=${sessionId})`, err);
    abortController?.abort();
    abortController = null;
  });
}
