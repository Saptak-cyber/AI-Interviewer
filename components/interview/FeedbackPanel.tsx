"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import { scoreColor, scoreBarColor } from "@/lib/utils";
import { Loader2, RotateCcw, LayoutDashboard } from "lucide-react";
import type { EvaluationScores } from "@/types";

interface EvaluationData {
  id: string;
  scores: EvaluationScores;
  strengths: string;
  weaknesses: string;
  summary: string;
}

interface FeedbackPanelProps {
  sessionId: string;
}

const SCORE_LABELS: Array<{ key: keyof EvaluationScores; label: string }> = [
  { key: "overall", label: "Overall" },
  { key: "problemSolving", label: "Problem Solving" },
  { key: "communication", label: "Communication" },
  { key: "codeQuality", label: "Code Quality" },
  { key: "timeComplexity", label: "Time Complexity" },
  { key: "edgeCases", label: "Edge Cases" },
];

function ScoreBar({ score, label }: { score: number; label: string }) {
  const pct = (score / 10) * 100;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center text-sm">
        <span className="text-zinc-400">{label}</span>
        <span className={`font-bold tabular-nums ${scoreColor(score)}`}>
          {score}/10
        </span>
      </div>
      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${scoreBarColor(score)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function FeedbackPanel({ sessionId }: FeedbackPanelProps) {
  const router = useRouter();
  const [evaluation, setEvaluation] = useState<EvaluationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchEvaluation() {
      try {
        const res = await fetch("/api/interview/evaluate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Evaluation failed");

        setEvaluation(data.evaluation as EvaluationData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load feedback");
      } finally {
        setIsLoading(false);
      }
    }

    fetchEvaluation();
  }, [sessionId]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-zinc-400">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
        <p className="text-sm">Analyzing your interview performance…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-red-400 text-sm">{error}</p>
        <Button onClick={() => window.location.reload()} variant="outline" size="sm">
          Retry
        </Button>
      </div>
    );
  }

  if (!evaluation) return null;

  const strengths = evaluation.strengths.split("\n").filter(Boolean);
  const weaknesses = evaluation.weaknesses.split("\n").filter(Boolean);

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-xl font-bold text-zinc-100">Interview Feedback</h2>
          <p className="text-sm text-zinc-400 mt-1 leading-relaxed">{evaluation.summary}</p>
        </div>

        {/* Score bars */}
        <div className="space-y-4 p-4 rounded-xl bg-zinc-800/30 border border-zinc-800">
          {SCORE_LABELS.map(({ key, label }) => (
            <ScoreBar key={key} score={(evaluation.scores as EvaluationScores)[key]} label={label} />
          ))}
        </div>

        {/* Strengths */}
        {strengths.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-emerald-400 mb-2 flex items-center gap-1.5">
              <span>✅</span> Strengths
            </h3>
            <ul className="space-y-1.5">
              {strengths.map((s, i) => (
                <li key={i} className="text-sm text-zinc-300 flex items-start gap-2">
                  <span className="text-emerald-500 mt-0.5">•</span> {s}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Weaknesses */}
        {weaknesses.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-red-400 mb-2 flex items-center gap-1.5">
              <span>⚠️</span> Areas to Improve
            </h3>
            <ul className="space-y-1.5">
              {weaknesses.map((w, i) => (
                <li key={i} className="text-sm text-zinc-300 flex items-start gap-2">
                  <span className="text-red-500 mt-0.5">•</span> {w}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-2 pt-2">
          <Button
            className="w-full"
            onClick={() => router.push("/interview")}
          >
            <RotateCcw className="w-4 h-4" />
            Practice Again
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => router.push("/dashboard")}
          >
            <LayoutDashboard className="w-4 h-4" />
            View Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
