import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import SetupWizard from "@/components/interview/SetupWizard";
import { UserMenu } from "@/components/auth/SignInButton";
import Link from "next/link";

export const metadata = {
  title: "New Interview — AI Interviewer",
};

export default async function InterviewSetupPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/");
  }

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
            <Link href="/dashboard" className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors">
              Dashboard
            </Link>
            <UserMenu />
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="pt-28 pb-16 px-4">
        <div className="max-w-xl mx-auto">
          <div className="text-center mb-10">
            <h1 className="text-3xl font-bold text-zinc-100">
              Configure your interview
            </h1>
            <p className="mt-2 text-zinc-400">
              Hi {session.user.name?.split(" ")[0]}! Let&apos;s set up your practice session.
            </p>
          </div>
          <SetupWizard />
        </div>
      </main>
    </div>
  );
}
