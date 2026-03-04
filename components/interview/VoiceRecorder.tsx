"use client";

import { useState, useRef, useCallback } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";
import Button from "@/components/ui/Button";
import { cn } from "@/lib/utils";

interface VoiceRecorderProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

type RecordingState = "idle" | "recording" | "transcribing" | "error";

export default function VoiceRecorder({ onTranscript, disabled }: VoiceRecorderProps) {
  const [state, setState] = useState<RecordingState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(async () => {
    setErrorMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Pick the best supported MIME type
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";

      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        // Stop all tracks to release mic
        stream.getTracks().forEach((t) => t.stop());

        const blob = new Blob(chunksRef.current, { type: mimeType });
        await transcribeBlob(blob, mimeType);
      };

      recorder.start(250);
      mediaRecorderRef.current = recorder;
      setState("recording");
    } catch (err) {
      const msg =
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Microphone access denied. Please allow microphone access and try again."
          : "Could not access microphone.";
      setErrorMsg(msg);
      setState("error");
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      setState("transcribing");
      mediaRecorderRef.current.stop();
    }
  }, []);

  async function transcribeBlob(blob: Blob, mimeType: string) {
    try {
      const formData = new FormData();
      // Use a file extension matching the MIME type
      const ext = mimeType.includes("mp4") ? "mp4" : "webm";
      formData.append("audio", new File([blob], `recording.${ext}`, { type: mimeType }));

      const res = await fetch("/api/voice/transcribe", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || !data.transcript) {
        throw new Error(data.error ?? "Transcription failed");
      }

      onTranscript(data.transcript);
      setState("idle");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Transcription failed");
      setState("error");
    }
  }

  const isRecording = state === "recording";
  const isTranscribing = state === "transcribing";

  return (
    <div className="flex flex-col items-center gap-2">
      <Button
        variant={isRecording ? "danger" : "secondary"}
        size="sm"
        onClick={isRecording ? stopRecording : startRecording}
        disabled={disabled || isTranscribing}
        className={cn(
          "relative",
          isRecording && "animate-pulse"
        )}
        title={isRecording ? "Stop recording" : "Start voice recording"}
      >
        {isTranscribing ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Transcribing…
          </>
        ) : isRecording ? (
          <>
            <MicOff className="w-4 h-4" />
            Stop
          </>
        ) : (
          <>
            <Mic className="w-4 h-4" />
            Voice
          </>
        )}
        {isRecording && (
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-ping" />
        )}
      </Button>

      {state === "error" && errorMsg && (
        <p className="text-xs text-red-400 text-center max-w-[200px]">{errorMsg}</p>
      )}
    </div>
  );
}
