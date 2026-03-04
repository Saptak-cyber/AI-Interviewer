"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Loader2 } from "lucide-react";
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

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isAI = msg.role === "ai";

  return (
    <div
      className={cn(
        "flex items-end gap-3",
        isAI ? "justify-start" : "justify-end"
      )}
    >
      {isAI && (
        <div className="w-8 h-8 rounded-full bg-indigo-600/30 flex items-center justify-center flex-shrink-0 text-xs font-bold text-indigo-300">
          AI
        </div>
      )}

      <div
        className={cn(
          "px-4 py-3 rounded-2xl max-w-[75%] text-sm leading-relaxed whitespace-pre-wrap",
          isAI
            ? "bg-zinc-800 border border-zinc-700 rounded-bl-sm text-zinc-100"
            : "bg-indigo-600 rounded-br-sm text-white"
        )}
      >
        {msg.content}
      </div>

      {!isAI && (
        <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center flex-shrink-0 text-xs font-bold text-zinc-300">
          You
        </div>
      )}
    </div>
  );
}

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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const hasVoice = mode === "VOICE_TEXT" || mode === "VOICE_CODING";

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }, [input]);

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

        const aiMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          role: "ai",
          content: data.reply,
          kind: data.isComplete ? "SYSTEM" : "FOLLOWUP",
          createdAt: new Date(),
        };

        setMessages((prev) => [...prev, aiMsg]);

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
    [sessionId, isLoading, isComplete, onComplete]
  );

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  function handleVoiceTranscript(text: string) {
    setInput((prev) => (prev ? `${prev} ${text}` : text));
    textareaRef.current?.focus();
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4 min-h-0">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}
        {isLoading && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      {!isComplete && (
        <div className="border-t border-zinc-800 px-4 py-3 bg-zinc-950/80 backdrop-blur-sm">
          <div className="flex items-end gap-2">
            {hasVoice && (
              <VoiceRecorder
                onTranscript={handleVoiceTranscript}
                disabled={isLoading}
              />
            )}
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your answer… (Enter to send, Shift+Enter for new line)"
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
          <p className="text-xs text-zinc-600 mt-1.5 text-right">
            Shift+Enter for new line
          </p>
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
