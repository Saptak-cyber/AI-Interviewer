import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { SignInButton } from "@/components/auth/SignInButton";

const FEATURES = [
  { icon: "🧩", title: "DSA & Coding", desc: "Live coding with Monaco editor and AI-powered code analysis" },
  { icon: "🏗️", title: "System Design", desc: "Design scalable architectures with structured AI feedback" },
  { icon: "🎯", title: "Behavioral", desc: "STAR-format evaluation for leadership and culture-fit questions" },
  { icon: "🎙️", title: "Voice Mode", desc: "Speak your answers naturally — Whisper transcribes in real time" },
  { icon: "📊", title: "Detailed Feedback", desc: "Scores across 6 dimensions with strengths and improvement areas" },
  { icon: "🔥", title: "FAANG Level", desc: "Interview difficulty calibrated to top tech company standards" },
];

export default async function LandingPage() {
  const session = await getServerSession(authOptions);

  if (session?.user) {
    redirect("/interview");
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🤖</span>
            <span className="font-bold text-zinc-100">AI Interviewer</span>
          </div>
          <SignInButton />
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-40 pb-24 px-4">
        <div className="max-w-3xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-xs font-medium mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
            Powered by Groq + Whisper AI
          </div>

          <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight leading-[1.1] mb-6">
            Ace your next{" "}
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              tech interview
            </span>
          </h1>

          <p className="text-lg text-zinc-400 max-w-xl mx-auto leading-relaxed mb-10">
            Practice with a realistic AI interviewer. Get FAANG-level questions, real-time
            follow-ups, voice support, and structured feedback — exactly like a real interview.
          </p>

          <SignInButton />

          <p className="mt-4 text-xs text-zinc-600">
            No credit card required. Sign in with your Google account.
          </p>
        </div>
      </section>

      {/* Feature grid */}
      <section className="py-16 px-4 border-t border-zinc-800/50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-center text-sm font-semibold text-zinc-500 uppercase tracking-widest mb-12">
            Everything you need to prepare
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-900/60 transition-all duration-200"
              >
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="font-semibold text-zinc-100 mb-1">{f.title}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4">
        <div className="max-w-xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-zinc-100 mb-4">
            Ready to start practicing?
          </h2>
          <p className="text-zinc-400 mb-8">
            Your first interview is one click away.
          </p>
          <SignInButton />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800 py-8 px-4 text-center text-xs text-zinc-600">
        AI Interviewer — Built with Next.js, Groq, and Neon Postgres
      </footer>
    </div>
  );
}
