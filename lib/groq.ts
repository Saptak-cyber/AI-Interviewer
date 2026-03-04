import Groq from "groq-sdk";
import type {
  RedisSessionState,
  EvaluationScores,
  EvaluationResult,
  InterviewTopic,
  Difficulty,
  ExperienceLevel,
  DurationType,
  InterviewMode,
} from "@/types";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const MODEL = "llama-3.3-70b-versatile";

function buildInterviewerSystemPrompt(state: RedisSessionState): string {
  const topicLabel =
    state.topic === "CUSTOM" && state.customTopic
      ? state.customTopic
      : formatLabel(state.topic);

  const durationMap: Record<DurationType, string> = {
    RAPID: "10-minute rapid",
    STANDARD: "30-minute standard",
    FULL: "60-minute full mock",
  };

  const maxQuestionsMap: Record<DurationType, number> = {
    RAPID: 2,
    STANDARD: 4,
    FULL: 6,
  };

  const experienceMap: Record<ExperienceLevel, string> = {
    BEGINNER: "beginner (0–1 years)",
    INTERMEDIATE: "intermediate (2–4 years)",
    ADVANCED: "advanced (5+ years)",
    FAANG: "FAANG-level (targeting top tech companies)",
  };

  const maxQuestions = maxQuestionsMap[state.durationType];

  return `You are an expert technical interviewer at a top FAANG-level technology company. You are conducting a ${durationMap[state.durationType]} interview.

INTERVIEW CONFIGURATION:
- Topic: ${topicLabel}
- Difficulty: ${formatLabel(state.difficulty)}
- Candidate Experience: ${experienceMap[state.experienceLevel]}
- Interview Mode: ${formatLabel(state.mode)}
- Max Questions: ${maxQuestions}

INTERVIEW RULES:
1. Ask exactly ONE question at a time. Wait for the complete answer before responding.
2. After each answer, ask 1–2 targeted follow-up questions probing depth (complexity, edge cases, trade-offs, alternatives).
3. Be realistic and professional. Challenge assumptions. Ask about time/space complexity for coding questions.
4. If the candidate is genuinely stuck after clearly attempting, you may give a small directional hint.
5. Do NOT reveal optimal solutions or answers during the interview.
6. Keep the conversation focused on the interview topic.
7. After covering ${maxQuestions} main questions with adequate follow-ups, conclude with: "That wraps up our interview. I'll now generate your feedback. Thank you for your time!" — exactly this phrase to signal completion.

TONE: Professional but approachable. Like a real Google/Meta/Amazon interviewer.

Begin immediately with your first question. Do not introduce yourself or ask for candidate's name. Go straight to the question.`;
}

function buildEvaluatorSystemPrompt(): string {
  return `You are an expert technical interview evaluator at a FAANG-level company. Your job is to provide honest, constructive, and accurate evaluations of technical interviews.

Analyze the interview conversation provided and return a JSON evaluation. Be honest — do not inflate scores.

Return ONLY a valid JSON object with this exact structure (no markdown, no explanation, just JSON):
{
  "scores": {
    "problemSolving": <integer 0-10>,
    "codeQuality": <integer 0-10>,
    "timeComplexity": <integer 0-10>,
    "communication": <integer 0-10>,
    "edgeCases": <integer 0-10>,
    "overall": <integer 0-10>
  },
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "weaknesses": ["weakness 1", "weakness 2"],
  "summary": "2–3 sentence summary of overall performance and hiring recommendation"
}

Scoring guide:
- 9–10: Exceptional, would be hired immediately
- 7–8: Strong, likely to pass
- 5–6: Average, borderline
- 3–4: Below expectations
- 0–2: Significant gaps

For behavioral interviews, use "communication", "problemSolving" (for STAR format), and "codeQuality" as "structure/clarity". Set "timeComplexity" and "edgeCases" to 0 if not applicable.`;
}

function buildCodeAnalysisPrompt(code: string, question: string): string {
  return `You are a senior software engineer evaluating code written during a technical interview.

QUESTION:
${question}

SUBMITTED CODE:
\`\`\`
${code}
\`\`\`

Analyze this code and return ONLY a valid JSON object (no markdown):
{
  "isCorrect": <boolean>,
  "timeComplexity": "<Big O notation, e.g. O(n log n)>",
  "spaceComplexity": "<Big O notation>",
  "bugs": ["bug description 1", "bug description 2"],
  "suggestions": ["improvement 1", "improvement 2"],
  "testResults": [
    {"name": "Basic case", "passed": <boolean>, "note": "explanation"},
    {"name": "Edge case: empty input", "passed": <boolean>, "note": "explanation"},
    {"name": "Edge case: large input", "passed": <boolean>, "note": "explanation"}
  ],
  "overallFeedback": "2–3 sentences of overall code quality feedback"
}`;
}

export async function callInterviewerLLM(
  state: RedisSessionState,
  userMessage: string
): Promise<{ reply: string; isComplete: boolean }> {
  const systemPrompt = buildInterviewerSystemPrompt(state);

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemPrompt },
    ...state.conversationHistory,
    { role: "user", content: userMessage },
  ];

  const completion = await groq.chat.completions.create({
    model: MODEL,
    messages,
    temperature: 0.7,
    max_tokens: 1024,
  });

  const reply = completion.choices[0].message.content ?? "";
  const isComplete = reply.toLowerCase().includes("that wraps up our interview");

  return { reply, isComplete };
}

/**
 * Streaming variant of callInterviewerLLM.
 * Yields individual text tokens as they arrive from Groq.
 * Pass an AbortSignal to cancel mid-stream (e.g. on user barge-in).
 */
export async function* callInterviewerLLMStream(
  state: RedisSessionState,
  userMessage: string,
  signal?: AbortSignal
): AsyncGenerator<string> {
  const systemPrompt = buildInterviewerSystemPrompt(state);

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemPrompt },
    ...state.conversationHistory,
    { role: "user", content: userMessage },
  ];

  const stream = await groq.chat.completions.create({
    model: MODEL,
    messages,
    temperature: 0.7,
    max_tokens: 1024,
    stream: true,
  });

  for await (const chunk of stream) {
    if (signal?.aborted) break;
    const token = chunk.choices[0]?.delta?.content ?? "";
    if (token) yield token;
  }
}

export async function callEvaluatorLLM(
  state: RedisSessionState
): Promise<EvaluationResult> {
  const systemPrompt = buildEvaluatorSystemPrompt();

  const conversationText = state.conversationHistory
    .map((m) => `${m.role === "assistant" ? "INTERVIEWER" : "CANDIDATE"}: ${m.content}`)
    .join("\n\n");

  const userPrompt = `INTERVIEW DETAILS:
- Topic: ${formatLabel(state.topic)}${state.customTopic ? ` (${state.customTopic})` : ""}
- Difficulty: ${formatLabel(state.difficulty)}
- Experience Level: ${formatLabel(state.experienceLevel)}
- Mode: ${formatLabel(state.mode)}

FULL INTERVIEW TRANSCRIPT:
${conversationText}

Provide the evaluation JSON now.`;

  const completion = await groq.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.3,
    max_tokens: 1024,
  });

  const raw = completion.choices[0].message.content ?? "{}";

  try {
    const parsed = JSON.parse(raw) as EvaluationResult;
    return parsed;
  } catch {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as EvaluationResult;
    }
    return {
      scores: {
        problemSolving: 5,
        codeQuality: 5,
        timeComplexity: 5,
        communication: 5,
        edgeCases: 5,
        overall: 5,
      },
      strengths: ["Participated in the interview"],
      weaknesses: ["Evaluation could not be parsed"],
      summary: "An evaluation was attempted but could not be fully parsed.",
    };
  }
}

export async function callCodeAnalysisLLM(
  code: string,
  question: string
): Promise<object> {
  const prompt = buildCodeAnalysisPrompt(code, question);

  const completion = await groq.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
    max_tokens: 1024,
  });

  const raw = completion.choices[0].message.content ?? "{}";

  try {
    return JSON.parse(raw);
  } catch {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    return { error: "Could not parse code analysis" };
  }
}

function formatLabel(value: string): string {
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
