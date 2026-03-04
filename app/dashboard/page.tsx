import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { UserMenu } from "@/components/auth/SignInButton";
import { formatTopic, formatDifficulty, scoreColor, scoreBarColor } from "@/lib/utils";
import { Plus } from "lucide-react";
import type { EvaluationScores } from "@/types";

export const metadata = {
  title: "Dashboard — AI Interviewer",
};

async function getDashboardData(userId: string) {
  const sessions = await prisma.interviewSession.findMany({
    where: { userId, isComplete: true },
    orderBy: { startedAt: "desc" },
    take: 20,
    include: {
      evaluations: {
        take: 1,
      },
    },
  });

  return sessions;
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
      <p className="text-xs text-zinc-500 font-medium uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold text-zinc-100">{value}</p>
      {sub && <p className="text-xs text-zinc-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function ScoreMiniBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${scoreBarColor(score)}`}
          style={{ width: `${(score / 10) * 100}%` }}
        />
      </div>
      <span className={`text-xs font-bold tabular-nums w-6 text-right ${scoreColor(score)}`}>
        {score}
      </span>
    </div>
  );
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/");
  }

  const sessions = await getDashboardData(session.user.id);
  const completedCount = sessions.length;

  // Calculate averages from evaluations that have scores
  const allScores = sessions
    .flatMap((s) => s.evaluations)
    .filter((e) => e?.scores)
    .map((e) => e.scores as unknown as EvaluationScores);

  const avg = (key: keyof EvaluationScores) =>
    allScores.length
      ? Math.round(allScores.reduce((sum, s) => sum + (s[key] ?? 0), 0) / allScores.length)
      : "—";

  const overallAvg = allScores.length
    ? (allScores.reduce((sum, s) => sum + (s.overall ?? 0), 0) / allScores.length).toFixed(1)
    : "—";

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <span className="text-xl">🤖</span>
            <span className="font-bold text-zinc-100">AI Interviewer</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/interview"
              className="flex items-center gap-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              New Interview
            </Link>
            <UserMenu />
          </div>
        </div>
      </nav>

      <main className="pt-24 pb-16 px-4 max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-zinc-100">
            Welcome back, {session.user.name?.split(" ")[0]}
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            Track your interview performance over time.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Interviews"
            value={completedCount}
            sub="completed"
          />
          <StatCard
            label="Overall Avg"
            value={overallAvg}
            sub="out of 10"
          />
          <StatCard
            label="Problem Solving"
            value={avg("problemSolving")}
            sub="average score"
          />
          <StatCard
            label="Communication"
            value={avg("communication")}
            sub="average score"
          />
        </div>

        {/* Score breakdown */}
        {allScores.length > 0 && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 mb-8">
            <h2 className="text-sm font-semibold text-zinc-300 mb-4">Average Scores by Category</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(
                [
                  ["Problem Solving", "problemSolving"],
                  ["Code Quality", "codeQuality"],
                  ["Communication", "communication"],
                  ["Time Complexity", "timeComplexity"],
                  ["Edge Cases", "edgeCases"],
                  ["Overall", "overall"],
                ] as Array<[string, keyof EvaluationScores]>
              ).map(([label, key]) => {
                const score = allScores.reduce((s, e) => s + (e[key] ?? 0), 0) / allScores.length;
                return (
                  <div key={key} className="space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-400">{label}</span>
                      <span className={`font-semibold ${scoreColor(Math.round(score))}`}>
                        {score.toFixed(1)}
                      </span>
                    </div>
                    <ScoreMiniBar score={Math.round(score)} />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Recent interviews */}
        <div>
          <h2 className="text-sm font-semibold text-zinc-300 mb-4">Recent Interviews</h2>

          {sessions.length === 0 ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/20 p-12 text-center">
              <p className="text-zinc-500 text-sm mb-4">No completed interviews yet.</p>
              <Link
                href="/interview"
                className="inline-flex items-center gap-1.5 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Start your first interview
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.map((s) => {
                const eval_ = s.evaluations[0];
                const scores = eval_?.scores as unknown as EvaluationScores | undefined;

                return (
                  <Link
                    key={s.id}
                    href={`/interview/${s.id}`}
                    className="flex items-center justify-between p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-900/60 transition-all duration-200 group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-2xl">
                        {s.topic === "DSA" ? "🧩" :
                          s.topic === "SYSTEM_DESIGN" ? "🏗️" :
                          s.topic === "BACKEND" ? "⚙️" :
                          s.topic === "BEHAVIORAL" ? "🎯" : "✨"}
                      </div>
                      <div>
                        <p className="font-medium text-zinc-200 group-hover:text-white transition-colors">
                          {formatTopic(s.topic, s.customTopic)}
                        </p>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          {formatDifficulty(s.difficulty)} · {new Date(s.startedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {scores && (
                        <div className="text-right">
                          <p className={`text-lg font-bold tabular-nums ${scoreColor(scores.overall)}`}>
                            {scores.overall}/10
                          </p>
                          <p className="text-xs text-zinc-600">overall</p>
                        </div>
                      )}
                      <span className="text-zinc-600 group-hover:text-zinc-400 transition-colors">→</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
