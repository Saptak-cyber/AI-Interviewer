"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, MicOff, Loader2, Square } from "lucide-react";
import Button from "@/components/ui/Button";
import { cn } from "@/lib/utils";

// ─── Props ────────────────────────────────────────────────────────────────────

interface VoiceRecorderProps {
  /** Called when a transcript is ready (HTTP mode only). */
  onTranscript: (text: string) => void;
  /** Called when the user presses the mic button (used by ChatInterface for barge-in). */
  onSpeechStart?: () => void;
  disabled?: boolean;
  /**
   * If provided, the recorder operates in WebSocket push-to-talk mode:
   *  - User clicks the mic button to start recording.
   *  - User clicks again to stop; audio is sent over the WebSocket as base64.
   *  - onTranscript is NOT called in this mode; transcript arrives via WS message.
   */
  ws?: WebSocket | null;
}

// ─── States ───────────────────────────────────────────────────────────────────

type HttpState = "idle" | "recording" | "transcribing" | "error";
type WsState = "initializing" | "ready" | "recording" | "processing" | "error";

// ─── Component ────────────────────────────────────────────────────────────────

export default function VoiceRecorder({
  onTranscript,
  onSpeechStart,
  disabled,
  ws,
}: VoiceRecorderProps) {
  const isWsMode = ws != null;

  // HTTP mode
  const [httpState, setHttpState] = useState<HttpState>("idle");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // WS push-to-talk mode
  const [wsState, setWsState] = useState<WsState>("initializing");
  const wsRecorderRef = useRef<MediaRecorder | null>(null);
  const wsChunksRef = useRef<Blob[]>([]);
  const wsMimeRef = useRef("audio/webm;codecs=opus");
  const wsStreamRef = useRef<MediaStream | null>(null);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ── WS mode: acquire mic on mount ─────────────────────────────────────────
  useEffect(() => {
    if (!isWsMode) return;
    let cancelled = false;

    const init = async () => {
      setErrorMsg(null);
      setWsState("initializing");
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }

        const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/mp4";
        wsMimeRef.current = mimeType;
        wsStreamRef.current = stream;
        if (!cancelled) setWsState("ready");
      } catch (err) {
        if (cancelled) return;
        const msg =
          err instanceof DOMException && err.name === "NotAllowedError"
            ? "Microphone access denied."
            : "Could not access microphone.";
        setErrorMsg(msg);
        setWsState("error");
      }
    };

    void init();
    return () => {
      cancelled = true;
      wsRecorderRef.current?.stop();
      wsRecorderRef.current = null;
      wsStreamRef.current?.getTracks().forEach((t) => t.stop());
      wsStreamRef.current = null;
    };
  }, [isWsMode, ws]);

  // ── WS push-to-talk: start / stop ─────────────────────────────────────────
  const wsPressButton = useCallback(() => {
    if (wsState === "recording") {
      // ── Stop recording ──
      const rec = wsRecorderRef.current;
      if (rec && rec.state !== "inactive") {
        setWsState("processing");
        rec.stop();
      }
      wsRecorderRef.current = null;
      return;
    }

    if (wsState !== "ready") return;

    const stream = wsStreamRef.current;
    const mimeType = wsMimeRef.current;
    if (!stream) return;

    // Notify parent so it can stop AI audio (barge-in)
    onSpeechStart?.();

    setWsState("recording");
    const recorder = new MediaRecorder(stream, { mimeType });
    wsChunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) wsChunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(wsChunksRef.current, { type: mimeType });
      sendBlob(blob, mimeType);
    };
    recorder.start(100);
    wsRecorderRef.current = recorder;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsState, onSpeechStart]);

  function sendBlob(blob: Blob, mimeType: string) {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      setWsState("ready");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(",")[1];
      ws.send(JSON.stringify({ type: "end_of_speech", audio: base64, mimeType }));
      setWsState("ready");
    };
    reader.readAsDataURL(blob);
  }

  // ── HTTP push-to-talk mode ─────────────────────────────────────────────────

  const startRecording = useCallback(async () => {
    setErrorMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";

      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mimeType });
        await transcribeBlob(blob, mimeType);
      };
      recorder.start(250);
      mediaRecorderRef.current = recorder;
      setHttpState("recording");
    } catch (err) {
      setErrorMsg(
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Microphone access denied."
          : "Could not access microphone."
      );
      setHttpState("error");
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      setHttpState("transcribing");
      mediaRecorderRef.current.stop();
    }
  }, []);

  async function transcribeBlob(blob: Blob, mimeType: string) {
    try {
      const formData = new FormData();
      const ext = mimeType.includes("mp4") ? "mp4" : "webm";
      formData.append("audio", new File([blob], `recording.${ext}`, { type: mimeType }));
      const res = await fetch("/api/voice/transcribe", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok || !data.transcript) throw new Error(data.error ?? "Transcription failed");
      onTranscript(data.transcript);
      setHttpState("idle");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Transcription failed");
      setHttpState("error");
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (isWsMode) {
    const isRecording = wsState === "recording";
    const isProcessing = wsState === "processing";
    const isInitializing = wsState === "initializing";
    const isError = wsState === "error";
    const isReady = wsState === "ready";

    return (
      <div className="flex flex-col items-center gap-2">
        <Button
          variant={isRecording ? "danger" : "secondary"}
          size="sm"
          onClick={wsPressButton}
          disabled={disabled || isProcessing || isInitializing || isError}
          className={cn("relative gap-2", isRecording && "ring-2 ring-red-500/60")}
          title={isRecording ? "Stop recording" : "Speak"}
        >
          {isInitializing ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Starting mic…</>
          ) : isProcessing ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</>
          ) : isError ? (
            <><MicOff className="w-4 h-4" /> Mic error</>
          ) : isRecording ? (
            <><Square className="w-3.5 h-3.5 fill-current" /> Stop</>
          ) : (
            <><Mic className="w-4 h-4" /> {isReady ? "Speak" : "…"}</>
          )}
          {isRecording && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-ping" />
          )}
        </Button>
        {isError && errorMsg && (
          <p className="text-xs text-red-400 text-center max-w-[200px]">{errorMsg}</p>
        )}
      </div>
    );
  }

  // HTTP push-to-talk
  const isRecording = httpState === "recording";
  const isTranscribing = httpState === "transcribing";

  return (
    <div className="flex flex-col items-center gap-2">
      <Button
        variant={isRecording ? "danger" : "secondary"}
        size="sm"
        onClick={isRecording ? stopRecording : startRecording}
        disabled={disabled || isTranscribing}
        className={cn("relative gap-2", isRecording && "ring-2 ring-red-500/60")}
        title={isRecording ? "Stop recording" : "Start voice recording"}
      >
        {isTranscribing ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Transcribing…</>
        ) : isRecording ? (
          <><Square className="w-3.5 h-3.5 fill-current" /> Stop</>
        ) : (
          <><Mic className="w-4 h-4" /> Speak</>
        )}
        {isRecording && (
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-ping" />
        )}
      </Button>
      {httpState === "error" && errorMsg && (
        <p className="text-xs text-red-400 text-center max-w-[200px]">{errorMsg}</p>
      )}
    </div>
  );
}
