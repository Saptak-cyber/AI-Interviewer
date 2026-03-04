"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Loader2, Volume2, VolumeX } from "lucide-react";
import Button from "@/components/ui/Button";
import VoiceRecorder from "./VoiceRecorder";
import { cn } from "@/lib/utils";
import type { ChatMessage, InterviewMode } from "@/types";

interface ChatInterfaceProps {
  sessionId: string;
  mode: InterviewMode;
  initialMessage: string;
  onComplete: () => void;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex items-end gap-3 justify-start">
      <div className="w-8 h-8 rounded-full bg-indigo-600/30 flex items-center justify-center flex-shrink-0 text-sm">
        AI
      </div>
      <div className="px-4 py-3 rounded-2xl rounded-bl-sm bg-zinc-800 border border-zinc-700 max-w-sm">
        <div className="flex gap-1 items-center h-4">
          <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
          <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
          <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" />
        </div>
      </div>
    </div>
  );
}

function SpeakingIndicator() {
  return (
    <div className="flex items-end gap-3 justify-start">
      <div className="w-8 h-8 rounded-full bg-indigo-600/50 flex items-center justify-center flex-shrink-0 text-sm animate-pulse">
        AI
      </div>
      <div className="flex items-center gap-2 px-4 py-3 rounded-2xl rounded-bl-sm bg-zinc-800 border border-indigo-500/40 text-xs text-indigo-300">
        <Volume2 className="w-3.5 h-3.5 animate-pulse" />
        Speaking…
      </div>
    </div>
  );
}

function MessageBubble({
  msg,
  onReplay,
  isSpeaking,
  muted,
}: {
  msg: ChatMessage;
  onReplay?: () => void;
  isSpeaking?: boolean;
  muted?: boolean;
}) {
  const isAI = msg.role === "ai";

  return (
    <div className={cn("flex items-end gap-3", isAI ? "justify-start" : "justify-end")}>
      {isAI && (
        <div
          className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-indigo-300 transition-all",
            isSpeaking
              ? "bg-indigo-500/50 ring-2 ring-indigo-400/60 animate-pulse"
              : "bg-indigo-600/30"
          )}
        >
          AI
        </div>
      )}

      <div className="flex flex-col gap-1 max-w-[75%]">
        <div
          className={cn(
            "px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap",
            isAI
              ? "bg-zinc-800 border border-zinc-700 rounded-bl-sm text-zinc-100"
              : "bg-indigo-600 rounded-br-sm text-white"
          )}
        >
          {msg.content}
        </div>

        {/* Replay button for AI messages in voice mode */}
        {isAI && onReplay && !muted && (
          <button
            onClick={onReplay}
            className="self-start flex items-center gap-1 text-xs text-zinc-600 hover:text-indigo-400 transition-colors px-1"
            title="Replay audio"
          >
            <Volume2 className="w-3 h-3" />
            Replay
          </button>
        )}
      </div>

      {!isAI && (
        <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center flex-shrink-0 text-xs font-bold text-zinc-300">
          You
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ChatInterface({
  sessionId,
  mode,
  initialMessage,
  onComplete,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "initial",
      role: "ai",
      content: initialMessage,
      kind: "QUESTION",
      createdAt: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const initialSpokenRef = useRef(false);

  const hasVoice = mode === "VOICE_TEXT" || mode === "VOICE_CODING";

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, isSpeaking]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }, [input]);

  // ── TTS helper ──────────────────────────────────────────────────────────────

  const playTts = useCallback(
    async (text: string, msgId: string) => {
      if (muted) return;

      // Stop any currently playing audio
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }

      setIsSpeaking(true);
      setSpeakingMsgId(msgId);

      try {
        const res = await fetch("/api/voice/speak", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });

        if (!res.ok) {
          // Fail silently — the text is already shown in the chat
          console.warn("TTS failed:", res.status);
          return;
        }

        const arrayBuffer = await res.arrayBuffer();
        // ElevenLabs returns MP3 when Accept: audio/mpeg
        const blob = new Blob([arrayBuffer], { type: "audio/mpeg" });
        const url = URL.createObjectURL(blob);

        const audio = new Audio(url);
        currentAudioRef.current = audio;

        audio.onended = () => {
          URL.revokeObjectURL(url);
          setIsSpeaking(false);
          setSpeakingMsgId(null);
          currentAudioRef.current = null;
        };

        audio.onerror = () => {
          URL.revokeObjectURL(url);
          setIsSpeaking(false);
          setSpeakingMsgId(null);
          currentAudioRef.current = null;
        };

        await audio.play();
      } catch {
        setIsSpeaking(false);
        setSpeakingMsgId(null);
      }
    },
    [muted]
  );

  // Speak the initial AI message once in voice mode
  useEffect(() => {
    if (initialSpokenRef.current) return;
    if (hasVoice && !muted && initialMessage) {
      initialSpokenRef.current = true;
      void playTts(initialMessage, "initial");
    }
  }, [hasVoice, muted, initialMessage, playTts]);

  function handleMuteToggle() {
    if (!muted && currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
      setIsSpeaking(false);
      setSpeakingMsgId(null);
    }
    setMuted((m) => !m);
  }

  // ── Send message ────────────────────────────────────────────────────────────

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading || isComplete) return;

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: text.trim(),
        kind: "ANSWER",
        createdAt: new Date(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setIsLoading(true);

      try {
        const res = await fetch("/api/interview/message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, message: text.trim() }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error ?? "Something went wrong");
        }

        const msgId = `ai-${Date.now()}`;
        const aiMsg: ChatMessage = {
          id: msgId,
          role: "ai",
          content: data.reply,
          kind: data.isComplete ? "SYSTEM" : "FOLLOWUP",
          createdAt: new Date(),
        };

        setMessages((prev) => [...prev, aiMsg]);

        // Speak the interviewer's reply in voice modes
        if (hasVoice) {
          void playTts(data.reply, msgId);
        }

        if (data.isComplete) {
          setIsComplete(true);
          onComplete();
        }
      } catch (err) {
        const errMsg: ChatMessage = {
          id: `err-${Date.now()}`,
          role: "ai",
          content:
            err instanceof Error
              ? `Error: ${err.message}`
              : "Something went wrong. Please try again.",
          kind: "SYSTEM",
          createdAt: new Date(),
        };
        setMessages((prev) => [...prev, errMsg]);
      } finally {
        setIsLoading(false);
      }
    },
    [sessionId, isLoading, isComplete, onComplete, hasVoice, playTts]
  );

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  function handleVoiceTranscript(text: string) {
    // In pure voice mode: auto-send. In VOICE_TEXT: append to textarea.
    if (mode === "VOICE_CODING") {
      // For coding mode, append to textarea so user can review before sending
      setInput((prev) => (prev ? `${prev} ${text}` : text));
      textareaRef.current?.focus();
    } else {
      // VOICE_TEXT: auto-send the transcript immediately
      void sendMessage(text);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4 min-h-0">
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            isSpeaking={speakingMsgId === msg.id}
            muted={muted}
            onReplay={
              hasVoice && msg.role === "ai"
                ? () => void playTts(msg.content, msg.id)
                : undefined
            }
          />
        ))}
        {isLoading && <TypingIndicator />}
        {isSpeaking && !isLoading && <SpeakingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      {!isComplete && (
        <div className="border-t border-zinc-800 px-4 py-3 bg-zinc-950/80 backdrop-blur-sm">
          <div className="flex items-end gap-2">
            {/* Mute toggle (voice modes only) */}
            {hasVoice && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMuteToggle}
                title={muted ? "Unmute interviewer" : "Mute interviewer"}
                className="flex-shrink-0 h-10 w-10 p-0"
              >
                {muted ? (
                  <VolumeX className="w-4 h-4 text-zinc-500" />
                ) : (
                  <Volume2 className="w-4 h-4 text-indigo-400" />
                )}
              </Button>
            )}

            {/* Voice recorder */}
            {hasVoice && (
              <VoiceRecorder
                onTranscript={handleVoiceTranscript}
                disabled={isLoading || isSpeaking}
              />
            )}

            {/* Text input */}
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  hasVoice
                    ? "Or type your answer… (Enter to send)"
                    : "Type your answer… (Enter to send, Shift+Enter for new line)"
                }
                disabled={isLoading}
                rows={1}
                className="w-full resize-none bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 transition-all"
                style={{ minHeight: "48px" }}
              />
            </div>

            <Button
              size="sm"
              onClick={() => sendMessage(input)}
              disabled={isLoading || !input.trim()}
              className="h-12 w-12 p-0 flex-shrink-0"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>

          <div className="flex items-center justify-between mt-1.5">
            {hasVoice && isSpeaking && (
              <p className="text-xs text-indigo-400 flex items-center gap-1">
                <Volume2 className="w-3 h-3" />
                Interviewer is speaking…
              </p>
            )}
            <p className="text-xs text-zinc-600 ml-auto">
              {hasVoice ? "Speak or type your answer" : "Shift+Enter for new line"}
            </p>
          </div>
        </div>
      )}

      {isComplete && (
        <div className="border-t border-zinc-800 px-4 py-4 bg-zinc-950/80 text-center">
          <p className="text-sm text-zinc-400">
            Interview complete. Generating your feedback…
          </p>
        </div>
      )}
    </div>
  );
}
