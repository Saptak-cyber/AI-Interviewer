import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDuration(durationType: string): string {
  const map: Record<string, string> = {
    RAPID: "10 min",
    STANDARD: "30 min",
    FULL: "60 min",
  };
  return map[durationType] ?? durationType;
}

export function formatTopic(topic: string, customTopic?: string | null): string {
  if (topic === "CUSTOM" && customTopic) return customTopic;
  const map: Record<string, string> = {
    DSA: "Data Structures & Algorithms",
    SYSTEM_DESIGN: "System Design",
    BACKEND: "Backend / JavaScript",
    BEHAVIORAL: "Behavioral",
    CUSTOM: "Custom Topic",
  };
  return map[topic] ?? topic;
}

export function formatDifficulty(difficulty: string): string {
  const map: Record<string, string> = {
    EASY: "Easy",
    MEDIUM: "Medium",
    HARD: "Hard",
    FAANG: "FAANG Level",
  };
  return map[difficulty] ?? difficulty;
}

export function formatExperience(level: string): string {
  const map: Record<string, string> = {
    BEGINNER: "Beginner",
    INTERMEDIATE: "Intermediate",
    ADVANCED: "Advanced",
    FAANG: "Preparing for FAANG",
  };
  return map[level] ?? level;
}

export function scoreColor(score: number): string {
  if (score >= 8) return "text-emerald-400";
  if (score >= 6) return "text-yellow-400";
  if (score >= 4) return "text-orange-400";
  return "text-red-400";
}

export function scoreBarColor(score: number): string {
  if (score >= 8) return "bg-emerald-500";
  if (score >= 6) return "bg-yellow-500";
  if (score >= 4) return "bg-orange-500";
  return "bg-red-500";
}
