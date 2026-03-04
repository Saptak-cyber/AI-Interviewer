"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import ChatInterface from "@/components/interview/ChatInterface";
import CodeEditor from "@/components/interview/CodeEditor";
import FeedbackPanel from "@/components/interview/FeedbackPanel";
import { formatTopic, formatDifficulty, formatDuration } from "@/lib/utils";
import { Clock, MessageSquare, Code2, BarChart3 } from "lucide-react";
import Link from "next/link";

interface SessionData {
  id: string;
  topic: string;
  customTopic?: string | null;
  difficulty: string;
  experienceLevel: string;
  mode: string;
  durationType: string;
  isComplete: boolean;
  turns: Array<{
    id: string;
    role: string;
    kind: string;
    content: string;
    createdAt: string;
  }>;
  evaluations: Array<{
    id: string;
    scores: object;
    strengths: string;
    weaknesses: string;
    summary: string;
  }>;
}

function Timer({ startedAt }: { startedAt: Date }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <span className="font-mono text-sm text-zinc-400">
      {mm}:{ss}
    </span>
  );
}

export default function InterviewPage() {
  const router = useRouter();
  const { sessionId } = useParams<{ sessionId: string }>();

  const [session, setSession] = useState<SessionData | null>(null);
  const [firstMessage, setFirstMessage] = useState<string>("");
  const [history, setHistory] = useState<import("@/types").ChatMessage[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [startedAt] = useState(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const hasCode = session?.mode === "CODING" || session?.mode === "VOICE_CODING";

  useEffect(() => {
    console.log('[InterviewPage] useEffect triggered, sessionId:', sessionId);
    async function loadSession() {
      try {
        console.log('[InterviewPage] Fetching session data...');
        const res = await fetch(`/api/interview/${sessionId}`, {
          cache: 'no-store',
          next: { revalidate: 0 }
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data.error ?? "Session not found");

        const sess = data.session as SessionData;
        setSession(sess);

        // The first AI turn is the opening question
        const firstAiTurn = sess.turns.find((t) => t.role === "AI");
        if (firstAiTurn) {
          setFirstMessage(firstAiTurn.content);
        }

        // Build the full history so ChatInterface can restore on refresh
        const history = sess.turns.map((t) => ({
          id: t.id,
          role: t.role === "AI" ? ("ai" as const) : ("user" as const),
          content: t.content,
          kind: t.kind as import("@/types").TurnKind,
          createdAt: new Date(t.createdAt),
        }));
        setHistory(history);

        if (sess.isComplete) {
          setIsComplete(true);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load session");
      } finally {
        setIsLoading(false);
      }
    }

    loadSession();
  }, [sessionId]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-zinc-400">
          <div className="w-8 h-8 border-2 border-zinc-700 border-t-indigo-500 rounded-full animate-spin" />
          <p className="text-sm">Loading interview…</p>
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-red-400">{error ?? "Session not found"}</p>
          <Link href="/interview" className="text-sm text-indigo-400 hover:text-indigo-300 underline">
            Start a new interview
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-zinc-950 flex flex-col overflow-hidden">
      {/* Top bar */}
      <header className="flex-shrink-0 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/interview" className="text-zinc-500 hover:text-zinc-300 transition-colors text-sm">
            ← New Interview
          </Link>
          <span className="text-zinc-700">|</span>
          <span className="text-sm font-medium text-zinc-300">
            {formatTopic(session.topic, session.customTopic)}
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700">
            {formatDifficulty(session.difficulty)}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-zinc-500">
            <Clock className="w-3.5 h-3.5" />
            <Timer startedAt={startedAt} />
          </div>
          <span className="text-xs text-zinc-600">
            {formatDuration(session.durationType)}
          </span>
          {isComplete && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              Complete
            </span>
          )}
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 min-h-0 flex">
        {/* Chat pane */}
        <div className={`flex flex-col ${hasCode && !isComplete ? "w-1/2 border-r border-zinc-800" : "flex-1"}`}>
          {/* Pane label */}
          <div className="flex-shrink-0 px-4 py-2 border-b border-zinc-800 bg-zinc-900/40 flex items-center gap-2">
            <MessageSquare className="w-3.5 h-3.5 text-zinc-500" />
            <span className="text-xs text-zinc-500 font-medium">Interview Chat</span>
          </div>

          <div className="flex-1 min-h-0">
            {firstMessage ? (
              <ChatInterface
                sessionId={sessionId}
                mode={session.mode as "TEXT" | "CODING" | "VOICE_TEXT" | "VOICE_CODING"}
                initialMessage={firstMessage}
                initialHistory={history}
                onComplete={() => setIsComplete(true)}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
                No messages yet.
              </div>
            )}
          </div>
        </div>

        {/* Right pane: Code editor or Feedback */}
        {isComplete ? (
          <div className="flex-1 flex flex-col border-l border-zinc-800">
            <div className="flex-shrink-0 px-4 py-2 border-b border-zinc-800 bg-zinc-900/40 flex items-center gap-2">
              <BarChart3 className="w-3.5 h-3.5 text-zinc-500" />
              <span className="text-xs text-zinc-500 font-medium">Feedback</span>
            </div>
            <div className="flex-1 min-h-0">
              <FeedbackPanel sessionId={sessionId} />
            </div>
          </div>
        ) : hasCode ? (
          <div className="w-1/2 flex flex-col">
            <div className="flex-shrink-0 px-4 py-2 border-b border-zinc-800 bg-zinc-900/40 flex items-center gap-2">
              <Code2 className="w-3.5 h-3.5 text-zinc-500" />
              <span className="text-xs text-zinc-500 font-medium">Code Editor</span>
            </div>
            <div className="flex-1 min-h-0">
              <CodeEditor
                sessionId={sessionId}
                question={firstMessage}
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
