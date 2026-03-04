// ─── Enum mirrors (keep in sync with Prisma schema) ──────────────────────────

export type ExperienceLevel = "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "FAANG";
export type InterviewTopic = "DSA" | "SYSTEM_DESIGN" | "BACKEND" | "BEHAVIORAL" | "CUSTOM";
export type Difficulty = "EASY" | "MEDIUM" | "HARD" | "FAANG";
export type InterviewMode = "TEXT" | "CODING" | "VOICE_TEXT" | "VOICE_CODING";
export type DurationType = "RAPID" | "STANDARD" | "FULL";
export type TurnRole = "AI" | "USER";
export type TurnKind = "QUESTION" | "ANSWER" | "FOLLOWUP" | "SYSTEM";

// ─── Redis session state ──────────────────────────────────────────────────────

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

export interface RedisSessionState {
  sessionId: string;
  userId: string;
  topic: InterviewTopic;
  customTopic?: string;
  difficulty: Difficulty;
  experienceLevel: ExperienceLevel;
  mode: InterviewMode;
  durationType: DurationType;
  conversationHistory: ConversationMessage[];
  questionIndex: number;
  currentQuestionId?: string;
  followupCount: number;
  isComplete: boolean;
  startedAt: string;
}

// ─── Evaluation ───────────────────────────────────────────────────────────────

export interface EvaluationScores {
  problemSolving: number;
  codeQuality: number;
  timeComplexity: number;
  communication: number;
  edgeCases: number;
  overall: number;
}

export interface EvaluationResult {
  scores: EvaluationScores;
  strengths: string[];
  weaknesses: string[];
  summary: string;
}

// ─── Interview setup wizard ───────────────────────────────────────────────────

export interface InterviewConfig {
  topic: InterviewTopic | null;
  customTopic: string;
  difficulty: Difficulty | null;
  experienceLevel: ExperienceLevel | null;
  durationType: DurationType | null;
  mode: InterviewMode | null;
}

export type WizardStep =
  | "topic"
  | "customTopic"
  | "difficulty"
  | "experience"
  | "duration"
  | "mode"
  | "confirm";

// ─── Chat message (UI) ────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: "ai" | "user";
  content: string;
  kind: TurnKind;
  createdAt: Date;
}

// ─── Code analysis ────────────────────────────────────────────────────────────

export interface TestResult {
  name: string;
  passed: boolean;
  note: string;
}

export interface CodeAnalysis {
  isCorrect: boolean;
  timeComplexity: string;
  spaceComplexity: string;
  bugs: string[];
  suggestions: string[];
  testResults: TestResult[];
  overallFeedback: string;
}

// ─── API request/response types ───────────────────────────────────────────────

export interface StartInterviewRequest {
  topic: InterviewTopic;
  customTopic?: string;
  difficulty: Difficulty;
  experienceLevel: ExperienceLevel;
  mode: InterviewMode;
  durationType: DurationType;
}

export interface StartInterviewResponse {
  sessionId: string;
  firstMessage: string;
}

export interface MessageRequest {
  sessionId: string;
  message: string;
}

export interface MessageResponse {
  reply: string;
  isComplete: boolean;
}

export interface EvaluateRequest {
  sessionId: string;
}

export interface RunCodeRequest {
  sessionId: string;
  code: string;
  question: string;
}
