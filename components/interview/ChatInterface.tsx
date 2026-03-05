"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Loader2, Volume2, VolumeX } from "lucide-react";
import Button from "@/components/ui/Button";
import VoiceRecorder from "./VoiceRecorder";
import { cn } from "@/lib/utils";
import type { ChatMessage, InterviewMode } from "@/types";
import { AudioStreamPlayer } from "@/lib/audio-player";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";

interface ChatInterfaceProps {
  sessionId: string;
  mode: InterviewMode;
  initialMessage: string;
  onComplete: () => void;
  /** Full prior history — used to restore chat after a page refresh. */
  initialHistory?: ChatMessage[];
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
            "px-4 py-3 rounded-2xl text-sm leading-relaxed",
            isAI
              ? "bg-zinc-800 border border-zinc-700 rounded-bl-sm text-zinc-100 prose prose-invert prose-sm max-w-none"
              : "bg-indigo-600 rounded-br-sm text-white whitespace-pre-wrap"
          )}
        >
          {isAI ? (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={{
                // Customize markdown elements styling
                p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                code: ({ inline, className, children, ...props }: any) => {
                  return inline ? (
                    <code className="bg-zinc-700 px-1.5 py-0.5 rounded text-xs text-indigo-300" {...props}>
                      {children}
                    </code>
                  ) : (
                    <code className={cn("block bg-zinc-900 p-3 rounded-lg overflow-x-auto text-xs", className)} {...props}>
                      {children}
                    </code>
                  );
                },
                pre: ({ children }) => <pre className="bg-zinc-900 rounded-lg overflow-hidden my-2">{children}</pre>,
                ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                li: ({ children }) => <li className="ml-2">{children}</li>,
                strong: ({ children }) => <strong className="font-semibold text-indigo-200">{children}</strong>,
                em: ({ children }) => <em className="italic text-zinc-300">{children}</em>,
                a: ({ href, children }) => (
                  <a href={href} className="text-indigo-400 hover:text-indigo-300 underline" target="_blank" rel="noopener noreferrer">
                    {children}
                  </a>
                ),
                blockquote: ({ children }) => (
                  <blockquote className="border-l-4 border-indigo-500 pl-4 italic text-zinc-400 my-2">
                    {children}
                  </blockquote>
                ),
              }}
            >
              {msg.content}
            </ReactMarkdown>
          ) : (
            msg.content
          )}
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
  initialHistory,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(
    initialHistory && initialHistory.length > 0
      ? initialHistory
      : [
          {
            id: "initial",
            role: "ai",
            content: initialMessage,
            kind: "QUESTION",
            createdAt: new Date(),
          },
        ]
  );
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);

  // Streaming AI bubble: accumulates tokens before the turn is complete
  const [streamingContent, setStreamingContent] = useState<string | null>(null);
  // Ref mirrors state so response_complete can read it in a plain call
  // (avoids calling setMessages inside a setState updater, which React
  // Strict Mode double-invokes producing duplicate message bubbles).
  const streamingContentRef = useRef<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // HTTP mode TTS audio ref (legacy, non-WS voice modes)
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  // Persist "initial message spoken" across page refreshes for this session
  // so a tsx-watch restart doesn't re-fire the TTS every time.
  const initialSpokenRef = useRef(
    typeof sessionStorage !== "undefined"
      ? sessionStorage.getItem(`tts-spoken-${sessionId}`) === "1"
      : false
  );

  // WS + AudioStreamPlayer refs
  const wsRef = useRef<WebSocket | null>(null);
  // wsInstance is the same socket exposed as React state so child components
  // (VoiceRecorder) re-render reactively when the connection is ready/gone.
  const [wsInstance, setWsInstance] = useState<WebSocket | null>(null);
  const audioPlayerRef = useRef<AudioStreamPlayer | null>(null);

  // Ref-based in-flight guard: always current regardless of closure staleness
  const isSendingRef = useRef(false);

  // Stable refs so the WS effect doesn't depend on mutable values
  const mutedRef = useRef(muted);
  useEffect(() => { mutedRef.current = muted; }, [muted]);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  const hasVoice = mode === "VOICE_TEXT" || mode === "VOICE_CODING";

  // ── AudioStreamPlayer lifecycle ─────────────────────────────────────────────
  useEffect(() => {
    audioPlayerRef.current = new AudioStreamPlayer();
    audioPlayerRef.current.onPlaybackEnd = () => {
      setIsSpeaking(false);
      setSpeakingMsgId(null);
    };
    return () => {
      audioPlayerRef.current?.destroy();
      audioPlayerRef.current = null;
    };
  }, []);

  // ── WebSocket lifecycle (voice modes only) ──────────────────────────────────
  const [wsReconnectCount, setWsReconnectCount] = useState(0);
  const wsReconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wsReconnectAttemptsRef = useRef(0); // ref so onclose side-effect runs once
  const MAX_RECONNECT_ATTEMPTS = 5;

  useEffect(() => {
    if (!hasVoice) return;

    let intentionalClose = false;
    let wasEverOpen = false;

    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${proto}//${window.location.host}/api/voice/ws?sessionId=${sessionId}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      wasEverOpen = true;
      wsReconnectAttemptsRef.current = 0; // reset on successful connect
      setWsInstance(ws);
    };

    // Keepalive: ping every 100 s so proxies don't drop the idle connection
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "ping" }));
      }
    }, 100_000);

    ws.onclose = () => {
      if (intentionalClose) return;
      setWsInstance(null);
      wsRef.current = null;
      // Use a ref for the attempt count so this side-effect runs once even when
      // React StrictMode double-invokes state updater functions.
      if (wsReconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
        const attempt = wsReconnectAttemptsRef.current;
        wsReconnectAttemptsRef.current += 1;
        wsReconnectTimerRef.current = setTimeout(() => {
          setWsReconnectCount((n) => n + 1);
        }, Math.min(1000 * 2 ** attempt, 15_000));
      }
    };

    ws.onmessage = (event: MessageEvent<string>) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(event.data) as Record<string, unknown>;
      } catch {
        return;
      }

      switch (msg.type) {
        case "transcript": {
          // User's speech has been transcribed — show it as a user bubble
          const text = msg.text as string;
          if (!text?.trim()) break;
          setMessages((prev) => [
            ...prev,
            {
              id: `user-ws-${Date.now()}`,
              role: "user",
              content: text,
              kind: "ANSWER",
              createdAt: new Date(),
            },
          ]);
          // Start the streaming AI placeholder
          streamingContentRef.current = "";
          setStreamingContent("");
          setIsLoading(true);
          break;
        }

        case "ai_text_chunk": {
          // Accumulate LLM tokens into the partial bubble
          const token = msg.text as string;
          streamingContentRef.current = (streamingContentRef.current ?? "") + token;
          setStreamingContent(streamingContentRef.current);
          break;
        }

        case "audio_chunk": {
          if (mutedRef.current) break;
          const base64 = msg.data as string;
          const msgId = `ai-ws-speaking`;
          setSpeakingMsgId(msgId);
          setIsSpeaking(true);
          // Decode base64 → ArrayBuffer → enqueue in AudioStreamPlayer
          try {
            const binary = atob(base64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
              bytes[i] = binary.charCodeAt(i);
            }
            audioPlayerRef.current?.enqueue(bytes.buffer);
          } catch (err) {
            console.warn("[ChatInterface] Failed to decode audio chunk:", err);
          }
          break;
        }

        case "response_complete": {
          const isNowComplete = msg.isComplete as boolean;
          // Read from ref (not updater) so this side-effect runs exactly once.
          // Using setStreamingContent(updaterFn) + setMessages inside it caused
          // React Strict Mode to double-invoke the updater → duplicate bubbles.
          const finalContent = streamingContentRef.current;
          streamingContentRef.current = null;
          setStreamingContent(null);
          if (finalContent !== null) {
            const msgId = `ai-ws-${Date.now()}`;
            setMessages((prev) => [
              ...prev,
              {
                id: msgId,
                role: "ai",
                content: finalContent,
                kind: isNowComplete ? "SYSTEM" : "FOLLOWUP",
                createdAt: new Date(),
              },
            ]);
          }
          setIsLoading(false);
          // Safety net: if audio player never fires onPlaybackEnd (e.g. suspended
          // AudioContext), reset the speaking indicator here.
          if (!audioPlayerRef.current?.isPlaying) {
            setIsSpeaking(false);
            setSpeakingMsgId(null);
          }
          if (isNowComplete) {
            setIsComplete(true);
            onCompleteRef.current();
          }
          break;
        }

        case "error": {
          const message = msg.message as string;
          streamingContentRef.current = null;
          setStreamingContent(null);
          setIsLoading(false);
          setMessages((prev) => [
            ...prev,
            {
              id: `err-ws-${Date.now()}`,
              role: "ai",
              content: `Error: ${message}`,
              kind: "SYSTEM",
              createdAt: new Date(),
            },
          ]);
          break;
        }
      }
    };

    ws.onerror = () => {
      // Ignore errors on sockets that were never opened (e.g. React effect
      // cleanup during hot-reload) or that we intentionally closed.
      if (intentionalClose || !wasEverOpen) return;
      console.warn("[ChatInterface] WebSocket error after connection was open");
    };

    return () => {
      intentionalClose = true;
      clearInterval(pingInterval);
      if (wsReconnectTimerRef.current) {
        clearTimeout(wsReconnectTimerRef.current);
        wsReconnectTimerRef.current = null;
      }
      ws.close();
      wsRef.current = null;
      setWsInstance(null);
    };
  // wsReconnectCount is the reconnect trigger — intentionally included
  }, [sessionId, hasVoice, wsReconnectCount]);

  // ── Scroll to bottom ────────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, isSpeaking, streamingContent]);

  // ── Textarea auto-resize ────────────────────────────────────────────────────
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }, [input]);

  // ── Legacy HTTP TTS (non-WS voice fallback) ─────────────────────────────────
  const playTts = useCallback(
    async (text: string, msgId: string) => {
      console.log('[ChatInterface playTts] Called with text length:', text.length);
      if (muted) return;
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
      
      // Split into smaller chunks for faster response
      const chunks: string[] = [];
      
      if (text.length <= 250) {
        chunks.push(text);
      } else {
        const sentences = text.match(/[^.!?]+[.!?]+(\s|$)/g) || [text];
        let currentChunk = '';
        
        for (const sentence of sentences) {
          const trimmedSentence = sentence.trim();
          if (!trimmedSentence) continue;
          
          if ((currentChunk + ' ' + trimmedSentence).length > 250 && currentChunk) {
            chunks.push(currentChunk.trim());
            currentChunk = trimmedSentence;
          } else {
            currentChunk = currentChunk ? currentChunk + ' ' + trimmedSentence : trimmedSentence;
          }
        }
        
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
        }
      }
      
      console.log('[ChatInterface playTts] Split into', chunks.length, 'chunk(s)');
      
      setIsSpeaking(true);
      setSpeakingMsgId(msgId);
      
      try {
        // Pipeline: fetch chunk N, start playing it, immediately start fetching chunk N+1
        const audioQueue: (ArrayBuffer | null)[] = [];
        let playbackIndex = 0;
        let fetchIndex = 0;
        let allFetched = false;
        
        // Function to fetch the next chunk
        const fetchNextChunk = async () => {
          if (fetchIndex >= chunks.length) {
            allFetched = true;
            return;
          }
          
          const index = fetchIndex;
          fetchIndex++;
          const chunk = chunks[index];
          
          console.log('[ChatInterface playTts] Fetching chunk', index + 1, 'of', chunks.length, 'length:', chunk.length);
          const chunkStart = Date.now();
          
          try {
            const res = await fetch("/api/voice/speak", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text: chunk }),
            });
            
            if (!res.ok) {
              console.warn("TTS failed for chunk", index + 1, ":", res.status);
              audioQueue[index] = null; // Mark as failed
              return;
            }
            
            const arrayBuffer = await res.arrayBuffer();
            console.log('[ChatInterface playTts] Chunk', index + 1, 'received in', Date.now() - chunkStart, 'ms, size:', arrayBuffer.byteLength);
            audioQueue[index] = arrayBuffer;
          } catch (err) {
            console.error('[ChatInterface playTts] Error fetching chunk', index + 1, ':', err);
            audioQueue[index] = null; // Mark as failed
          }
        };
        
        // Fetch first chunk
        await fetchNextChunk();
        
        // Play chunks as they become available
        while (playbackIndex < chunks.length) {
          // Wait for this chunk to be fetched
          while (audioQueue[playbackIndex] === undefined) {
            await new Promise(resolve => setTimeout(resolve, 50));
          }
          
          const buffer = audioQueue[playbackIndex];
          
          // Skip failed chunks
          if (buffer === null) {
            console.warn('[ChatInterface playTts] Skipping failed chunk', playbackIndex + 1);
            playbackIndex++;
            continue;
          }
          
          // Play this chunk
          console.log('[ChatInterface playTts] Playing chunk', playbackIndex + 1, 'of', chunks.length);
          
          const blob = new Blob([buffer], { type: "audio/wav" });
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          currentAudioRef.current = audio;
          
          // Start playing this chunk
          const playPromise = new Promise<void>((resolve, reject) => {
            audio.onended = () => {
              URL.revokeObjectURL(url);
              resolve();
            };
            audio.onerror = () => {
              URL.revokeObjectURL(url);
              reject(new Error('Audio playback failed'));
            };
            audio.play().catch(reject);
          });
          
          // Immediately start fetching the next chunk (don't wait for playback to finish)
          if (!allFetched) {
            fetchNextChunk(); // Fire and forget - runs in parallel with playback
          }
          
          // Wait for this chunk to finish playing before moving to next
          await playPromise;
          console.log('[ChatInterface playTts] Chunk', playbackIndex + 1, 'finished playing');
          playbackIndex++;
        }
        
        setIsSpeaking(false);
        setSpeakingMsgId(null);
        currentAudioRef.current = null;
      } catch (err) {
        console.error('[ChatInterface playTts] Error:', err);
        setIsSpeaking(false);
        setSpeakingMsgId(null);
        currentAudioRef.current = null;
      }
    },
    [muted]
  );

  // Speak initialMessage once in legacy voice modes (no WS)
  useEffect(() => {
    if (initialSpokenRef.current) return;
    // For WS voice modes the server speaks the first message after the session
    // starts — we only use the legacy HTTP TTS for non-WS contexts.
    if (hasVoice && !muted && initialMessage && !wsInstance) {
      console.log('[ChatInterface] Speaking initial message, length:', initialMessage.length);
      console.log('[ChatInterface] Initial message:', initialMessage);
      initialSpokenRef.current = true;
      sessionStorage.setItem(`tts-spoken-${sessionId}`, "1");
      void playTts(initialMessage, "initial");
    }
  }, [hasVoice, muted, initialMessage, playTts, wsInstance, sessionId]);

  function handleMuteToggle() {
    if (!muted) {
      // Stop any in-progress audio
      currentAudioRef.current?.pause();
      currentAudioRef.current = null;
      audioPlayerRef.current?.stop();
      setIsSpeaking(false);
      setSpeakingMsgId(null);
    }
    setMuted((m) => !m);
  }

  // ── Barge-in: user starts speaking while AI is playing ──────────────────────
  function handleUserSpeechStart() {
    if (isSpeaking) {
      // Stop audio playback immediately
      audioPlayerRef.current?.stop();
      currentAudioRef.current?.pause();
      currentAudioRef.current = null;
      setIsSpeaking(false);
      setSpeakingMsgId(null);
      // Tell server to cancel the active LLM / TTS stream
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "interrupt" }));
      }
    }
  }

  // ── HTTP send message (TEXT / CODING modes) ─────────────────────────────────
  const sendMessage = useCallback(
    async (text: string) => {
      // Use a ref-based guard so concurrent/stale-closure double-calls are blocked
      // regardless of whether `isLoading` state has flushed yet.
      if (!text.trim() || isSendingRef.current || isComplete) return;
      isSendingRef.current = true;

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
        if (!res.ok) throw new Error(data.error ?? "Something went wrong");

        const msgId = `ai-${Date.now()}`;
        const aiMsg: ChatMessage = {
          id: msgId,
          role: "ai",
          content: data.reply,
          kind: data.isComplete ? "SYSTEM" : "FOLLOWUP",
          createdAt: new Date(),
        };
        setMessages((prev) => [...prev, aiMsg]);

        if (hasVoice) void playTts(data.reply, msgId);
        if (data.isComplete) { setIsComplete(true); onCompleteRef.current(); }
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: "ai",
            content: err instanceof Error ? `Error: ${err.message}` : "Something went wrong.",
            kind: "SYSTEM",
            createdAt: new Date(),
          },
        ]);
      } finally {
        setIsLoading(false);
        isSendingRef.current = false;
      }
    },
    // onComplete is accessed via onCompleteRef — no longer a dep.
    // isLoading removed: the ref guard replaces it.
    [sessionId, isComplete, hasVoice, playTts]
  );

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  }

  function handleVoiceTranscript(text: string) {
    if (mode === "VOICE_CODING") {
      setInput((prev) => (prev ? `${prev} ${text}` : text));
      textareaRef.current?.focus();
    } else {
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
              hasVoice && msg.role === "ai" && !wsInstance
                ? () => void playTts(msg.content, msg.id)
                : undefined
            }
          />
        ))}

        {/* Streaming AI bubble (WS mode) */}
        {streamingContent !== null && (
          <div className="flex items-end gap-3 justify-start">
            <div className="w-8 h-8 rounded-full bg-indigo-600/50 flex items-center justify-center flex-shrink-0 text-xs font-bold text-indigo-300 animate-pulse">
              AI
            </div>
            <div className="px-4 py-3 rounded-2xl rounded-bl-sm bg-zinc-800 border border-indigo-500/30 text-sm text-zinc-100 leading-relaxed max-w-[75%] prose prose-invert prose-sm">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
                components={{
                  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                  code: ({ inline, className, children, ...props }: any) => {
                    return inline ? (
                      <code className="bg-zinc-700 px-1.5 py-0.5 rounded text-xs text-indigo-300" {...props}>
                        {children}
                      </code>
                    ) : (
                      <code className={cn("block bg-zinc-900 p-3 rounded-lg overflow-x-auto text-xs", className)} {...props}>
                        {children}
                      </code>
                    );
                  },
                  pre: ({ children }) => <pre className="bg-zinc-900 rounded-lg overflow-hidden my-2">{children}</pre>,
                  ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                  li: ({ children }) => <li className="ml-2">{children}</li>,
                  strong: ({ children }) => <strong className="font-semibold text-indigo-200">{children}</strong>,
                  em: ({ children }) => <em className="italic text-zinc-300">{children}</em>,
                  a: ({ href, children }) => (
                    <a href={href} className="text-indigo-400 hover:text-indigo-300 underline" target="_blank" rel="noopener noreferrer">
                      {children}
                    </a>
                  ),
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-4 border-indigo-500 pl-4 italic text-zinc-400 my-2">
                      {children}
                    </blockquote>
                  ),
                }}
              >
                {streamingContent}
              </ReactMarkdown>
              <span className="inline-block w-1.5 h-3.5 ml-0.5 bg-indigo-400 animate-pulse rounded-sm align-text-bottom" />
            </div>
          </div>
        )}

        {isLoading && streamingContent === null && <TypingIndicator />}
        {isSpeaking && !isLoading && streamingContent === null && <SpeakingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      {!isComplete && (
        <div className="border-t border-zinc-800 px-4 py-3 bg-zinc-950/80 backdrop-blur-sm">
          <div className="flex items-end gap-2">
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

            {hasVoice && (
              <VoiceRecorder
                onTranscript={handleVoiceTranscript}
                onSpeechStart={handleUserSpeechStart}
                disabled={false}
                ws={wsInstance}
              />
            )}

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
              {isLoading && streamingContent === null ? (
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
