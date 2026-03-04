"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, MicOff, Loader2, Radio } from "lucide-react";
import Button from "@/components/ui/Button";
import { cn } from "@/lib/utils";

// ─── Props ────────────────────────────────────────────────────────────────────

interface VoiceRecorderProps {
  /** Called when a transcript is ready (HTTP mode only). */
  onTranscript: (text: string) => void;
  /** Called when the user starts speaking (used by ChatInterface for barge-in). */
  onSpeechStart?: () => void;
  disabled?: boolean;
  /**
   * If provided, the recorder operates in WebSocket mode:
   *  - Energy VAD auto-detects speech start/end.
   *  - Audio is sent over the WebSocket as base64.
   *  - onTranscript is NOT called in this mode; transcript arrives via WS message.
   */
  ws?: WebSocket | null;
}

// ─── Energy-based VAD ─────────────────────────────────────────────────────────

const ENERGY_THRESHOLD = 25;      // mean RMS (0–255) to classify as speech
const SILENCE_DURATION_MS = 1300; // ms of silence before end-of-speech fires
const VAD_POLL_INTERVAL_MS = 80;

class EnergyVAD {
  private analyser: AnalyserNode;
  private dataArray: Uint8Array<ArrayBuffer>;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isSpeaking = false;
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    stream: MediaStream,
    private ctx: AudioContext,
    private onSpeechStart: () => void,
    private onSpeechEnd: () => void
  ) {
    const source = ctx.createMediaStreamSource(stream);
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>;
    source.connect(this.analyser); // no destination — avoids mic playback
    this.poll();
  }

  private poll() {
    this.intervalId = setInterval(() => {
      this.analyser.getByteFrequencyData(this.dataArray);
      const energy =
        this.dataArray.reduce((a, b) => a + b, 0) / this.dataArray.length;

      if (energy > ENERGY_THRESHOLD) {
        if (this.silenceTimer) {
          clearTimeout(this.silenceTimer);
          this.silenceTimer = null;
        }
        if (!this.isSpeaking) {
          this.isSpeaking = true;
          this.onSpeechStart();
        }
      } else if (this.isSpeaking && !this.silenceTimer) {
        this.silenceTimer = setTimeout(() => {
          this.isSpeaking = false;
          this.silenceTimer = null;
          this.onSpeechEnd();
        }, SILENCE_DURATION_MS);
      }
    }, VAD_POLL_INTERVAL_MS);
  }

  destroy() {
    if (this.intervalId) clearInterval(this.intervalId);
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
  }
}

// ─── States ───────────────────────────────────────────────────────────────────

type HttpState = "idle" | "recording" | "transcribing" | "error";
type WsState =
  | "initializing"
  | "listening"
  | "recording"
  | "processing"
  | "error";

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

  // WS mode
  const [wsState, setWsState] = useState<WsState>("initializing");
  const vadRef = useRef<EnergyVAD | null>(null);
  const wsRecorderRef = useRef<MediaRecorder | null>(null);
  const wsChunksRef = useRef<Blob[]>([]);
  const wsMimeRef = useRef("audio/webm;codecs=opus");
  const wsStreamRef = useRef<MediaStream | null>(null);
  const wsAudioCtxRef = useRef<AudioContext | null>(null);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ── WS mode: initialise mic + VAD ──────────────────────────────────────────
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

        const audioCtx = new AudioContext();
        wsAudioCtxRef.current = audioCtx;

        const vad = new EnergyVAD(
          stream,
          audioCtx,
          () => {
            if (cancelled) return;
            onSpeechStart?.();
            setWsState("recording");
            const recorder = new MediaRecorder(stream, { mimeType });
            wsChunksRef.current = [];
            recorder.ondataavailable = (e) => {
              if (e.data.size > 0) wsChunksRef.current.push(e.data);
            };
            recorder.onstop = () => {
              if (cancelled) return;
              const blob = new Blob(wsChunksRef.current, { type: mimeType });
              sendBlob(blob, mimeType);
            };
            recorder.start(100);
            wsRecorderRef.current = recorder;
          },
          () => {
            if (cancelled) return;
            const rec = wsRecorderRef.current;
            if (rec && rec.state !== "inactive") {
              setWsState("processing");
              rec.stop();
            }
            wsRecorderRef.current = null;
          }
        );
        vadRef.current = vad;
        if (!cancelled) setWsState("listening");
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
      vadRef.current?.destroy();
      vadRef.current = null;
      wsRecorderRef.current?.stop();
      wsRecorderRef.current = null;
      wsStreamRef.current?.getTracks().forEach((t) => t.stop());
      wsStreamRef.current = null;
      wsAudioCtxRef.current?.close();
      wsAudioCtxRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWsMode, ws]);

  function sendBlob(blob: Blob, mimeType: string) {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      setWsState("listening");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(",")[1];
      ws.send(JSON.stringify({ type: "end_of_speech", audio: base64, mimeType }));
      setWsState("listening");
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
    return (
      <div className="flex flex-col items-center gap-2">
        <div
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium select-none transition-all",
            wsState === "recording"
              ? "bg-red-500/20 border-red-500/60 text-red-300"
              : wsState === "processing"
              ? "bg-yellow-500/10 border-yellow-500/40 text-yellow-400"
              : wsState === "initializing"
              ? "bg-zinc-800 border-zinc-700 text-zinc-500"
              : wsState === "error"
              ? "bg-red-900/20 border-red-800 text-red-400"
              : "bg-indigo-500/10 border-indigo-500/30 text-indigo-400"
          )}
        >
          {wsState === "processing" ? (
            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Processing…</>
          ) : wsState === "recording" ? (
            <><span className="w-2 h-2 bg-red-500 rounded-full animate-ping inline-block" /> Speaking…</>
          ) : wsState === "initializing" ? (
            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Starting mic…</>
          ) : wsState === "error" ? (
            <><MicOff className="w-3.5 h-3.5" /> Mic error</>
          ) : (
            <><Radio className="w-3.5 h-3.5 animate-pulse" /> Listening…</>
          )}
        </div>
        {wsState === "error" && errorMsg && (
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
        className={cn("relative", isRecording && "animate-pulse")}
        title={isRecording ? "Stop recording" : "Start voice recording"}
      >
        {isTranscribing ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Transcribing…</>
        ) : isRecording ? (
          <><MicOff className="w-4 h-4" /> Stop</>
        ) : (
          <><Mic className="w-4 h-4" /> Voice</>
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
