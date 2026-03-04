"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import type {
  InterviewConfig,
  InterviewTopic,
  Difficulty,
  ExperienceLevel,
  DurationType,
  InterviewMode,
  WizardStep,
} from "@/types";

const INITIAL_CONFIG: InterviewConfig = {
  topic: null,
  customTopic: "",
  difficulty: null,
  experienceLevel: null,
  durationType: null,
  mode: null,
};

interface OptionCard {
  value: string;
  label: string;
  description?: string;
  icon?: string;
}

const TOPICS: OptionCard[] = [
  { value: "DSA", label: "DSA", description: "Data Structures & Algorithms", icon: "🧩" },
  { value: "SYSTEM_DESIGN", label: "System Design", description: "Architecture & scalability", icon: "🏗️" },
  { value: "BACKEND", label: "Backend / JS", description: "APIs, Node, databases", icon: "⚙️" },
  { value: "BEHAVIORAL", label: "Behavioral", description: "Leadership & STAR method", icon: "🎯" },
  { value: "CUSTOM", label: "Custom Topic", description: "You choose the topic", icon: "✨" },
];

const DIFFICULTIES: OptionCard[] = [
  { value: "EASY", label: "Easy", description: "Warm-up questions", icon: "🟢" },
  { value: "MEDIUM", label: "Medium", description: "Standard interview level", icon: "🟡" },
  { value: "HARD", label: "Hard", description: "Senior engineer level", icon: "🟠" },
  { value: "FAANG", label: "FAANG Level", description: "Top tech company bar", icon: "🔴" },
];

const EXPERIENCES: OptionCard[] = [
  { value: "BEGINNER", label: "Beginner", description: "0–1 years of experience", icon: "🌱" },
  { value: "INTERMEDIATE", label: "Intermediate", description: "2–4 years of experience", icon: "💼" },
  { value: "ADVANCED", label: "Advanced", description: "5+ years of experience", icon: "🚀" },
  { value: "FAANG", label: "Targeting FAANG", description: "Preparing for top tech", icon: "🏆" },
];

const DURATIONS: OptionCard[] = [
  { value: "RAPID", label: "Rapid", description: "~10 minutes • 2 questions", icon: "⚡" },
  { value: "STANDARD", label: "Standard", description: "~30 minutes • 4 questions", icon: "🕐" },
  { value: "FULL", label: "Full Mock", description: "~60 minutes • 6 questions", icon: "🎓" },
];

const MODES: OptionCard[] = [
  { value: "TEXT", label: "Text", description: "Type your answers", icon: "💬" },
  { value: "CODING", label: "Coding", description: "Text + code editor", icon: "💻" },
  { value: "VOICE_TEXT", label: "Voice + Text", description: "Speak or type answers", icon: "🎙️" },
  { value: "VOICE_CODING", label: "Voice + Code", description: "Speak & write code", icon: "🎙️💻" },
];

function ChoiceGrid({
  options,
  selected,
  onSelect,
}: {
  options: OptionCard[];
  selected: string | null;
  onSelect: (value: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onSelect(opt.value)}
          className={cn(
            "flex items-start gap-4 p-4 rounded-xl border text-left transition-all duration-200 hover:border-indigo-500/60 hover:bg-indigo-500/5 active:scale-[0.98]",
            selected === opt.value
              ? "border-indigo-500 bg-indigo-500/10 ring-1 ring-indigo-500/50"
              : "border-zinc-700 bg-zinc-800/40"
          )}
        >
          <span className="text-2xl mt-0.5">{opt.icon}</span>
          <div>
            <div className="font-semibold text-zinc-100">{opt.label}</div>
            {opt.description && (
              <div className="text-sm text-zinc-400 mt-0.5">{opt.description}</div>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}

export default function SetupWizard() {
  const router = useRouter();
  const [step, setStep] = useState<WizardStep>("topic");
  const [config, setConfig] = useState<InterviewConfig>(INITIAL_CONFIG);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStart() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/interview/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: config.topic,
          customTopic: config.customTopic || undefined,
          difficulty: config.difficulty,
          experienceLevel: config.experienceLevel,
          mode: config.mode,
          durationType: config.durationType,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to start interview");
      }

      const data = await res.json();
      router.push(`/interview/${data.sessionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setIsLoading(false);
    }
  }

  const steps: WizardStep[] = [
    "topic",
    ...(config.topic === "CUSTOM" ? ["customTopic" as WizardStep] : []),
    "difficulty",
    "experience",
    "duration",
    "mode",
    "confirm",
  ];

  const currentStepIndex = steps.indexOf(step);
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  function next() {
    const nextStep = steps[currentStepIndex + 1];
    if (nextStep) setStep(nextStep);
  }

  function back() {
    const prevStep = steps[currentStepIndex - 1];
    if (prevStep) setStep(prevStep);
  }

  return (
    <div className="w-full max-w-xl mx-auto">
      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex justify-between text-xs text-zinc-500 mb-2">
          <span>Setup</span>
          <span>{currentStepIndex + 1} / {steps.length}</span>
        </div>
        <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Step content */}
      <div className="space-y-6">
        {step === "topic" && (
          <>
            <div>
              <h2 className="text-xl font-bold text-zinc-100">What would you like to practice?</h2>
              <p className="text-sm text-zinc-400 mt-1">Choose the topic for your interview.</p>
            </div>
            <ChoiceGrid
              options={TOPICS}
              selected={config.topic}
              onSelect={(v) => {
                setConfig((c) => ({ ...c, topic: v as InterviewTopic }));
              }}
            />
            <Button
              className="w-full"
              disabled={!config.topic}
              onClick={next}
            >
              Continue
            </Button>
          </>
        )}

        {step === "customTopic" && (
          <>
            <div>
              <h2 className="text-xl font-bold text-zinc-100">What topic should we cover?</h2>
              <p className="text-sm text-zinc-400 mt-1">Describe the custom topic for your interview.</p>
            </div>
            <input
              type="text"
              placeholder="e.g. Graph Algorithms, Kubernetes, React Hooks…"
              value={config.customTopic}
              onChange={(e) => setConfig((c) => ({ ...c, customTopic: e.target.value }))}
              className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              autoFocus
            />
            <div className="flex gap-3">
              <Button variant="outline" onClick={back} className="flex-1">Back</Button>
              <Button
                className="flex-1"
                disabled={!config.customTopic.trim()}
                onClick={next}
              >
                Continue
              </Button>
            </div>
          </>
        )}

        {step === "difficulty" && (
          <>
            <div>
              <h2 className="text-xl font-bold text-zinc-100">Choose difficulty level</h2>
              <p className="text-sm text-zinc-400 mt-1">How challenging should the questions be?</p>
            </div>
            <ChoiceGrid
              options={DIFFICULTIES}
              selected={config.difficulty}
              onSelect={(v) => setConfig((c) => ({ ...c, difficulty: v as Difficulty }))}
            />
            <div className="flex gap-3">
              <Button variant="outline" onClick={back} className="flex-1">Back</Button>
              <Button className="flex-1" disabled={!config.difficulty} onClick={next}>
                Continue
              </Button>
            </div>
          </>
        )}

        {step === "experience" && (
          <>
            <div>
              <h2 className="text-xl font-bold text-zinc-100">Your experience level</h2>
              <p className="text-sm text-zinc-400 mt-1">This helps calibrate question complexity.</p>
            </div>
            <ChoiceGrid
              options={EXPERIENCES}
              selected={config.experienceLevel}
              onSelect={(v) => setConfig((c) => ({ ...c, experienceLevel: v as ExperienceLevel }))}
            />
            <div className="flex gap-3">
              <Button variant="outline" onClick={back} className="flex-1">Back</Button>
              <Button className="flex-1" disabled={!config.experienceLevel} onClick={next}>
                Continue
              </Button>
            </div>
          </>
        )}

        {step === "duration" && (
          <>
            <div>
              <h2 className="text-xl font-bold text-zinc-100">Interview duration</h2>
              <p className="text-sm text-zinc-400 mt-1">How long do you want to practice?</p>
            </div>
            <ChoiceGrid
              options={DURATIONS}
              selected={config.durationType}
              onSelect={(v) => setConfig((c) => ({ ...c, durationType: v as DurationType }))}
            />
            <div className="flex gap-3">
              <Button variant="outline" onClick={back} className="flex-1">Back</Button>
              <Button className="flex-1" disabled={!config.durationType} onClick={next}>
                Continue
              </Button>
            </div>
          </>
        )}

        {step === "mode" && (
          <>
            <div>
              <h2 className="text-xl font-bold text-zinc-100">How would you like to answer?</h2>
              <p className="text-sm text-zinc-400 mt-1">Choose your interaction mode.</p>
            </div>
            <ChoiceGrid
              options={MODES}
              selected={config.mode}
              onSelect={(v) => setConfig((c) => ({ ...c, mode: v as InterviewMode }))}
            />
            <div className="flex gap-3">
              <Button variant="outline" onClick={back} className="flex-1">Back</Button>
              <Button className="flex-1" disabled={!config.mode} onClick={next}>
                Continue
              </Button>
            </div>
          </>
        )}

        {step === "confirm" && (
          <>
            <div>
              <h2 className="text-xl font-bold text-zinc-100">Ready to start?</h2>
              <p className="text-sm text-zinc-400 mt-1">Review your interview configuration.</p>
            </div>
            <div className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-800/30 p-4">
              {[
                { label: "Topic", value: config.topic === "CUSTOM" ? config.customTopic || "Custom" : config.topic },
                { label: "Difficulty", value: config.difficulty },
                { label: "Experience", value: config.experienceLevel },
                { label: "Duration", value: config.durationType },
                { label: "Mode", value: config.mode },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-zinc-500">{label}</span>
                  <span className="text-zinc-200 font-medium">{value?.replace(/_/g, " ")}</span>
                </div>
              ))}
            </div>
            {error && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
                {error}
              </p>
            )}
            <div className="flex gap-3">
              <Button variant="outline" onClick={back} className="flex-1" disabled={isLoading}>
                Back
              </Button>
              <Button className="flex-1" onClick={handleStart} disabled={isLoading}>
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Starting…
                  </span>
                ) : (
                  "Start Interview →"
                )}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
