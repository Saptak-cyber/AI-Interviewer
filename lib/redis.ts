import { Redis } from "@upstash/redis";
import type { RedisSessionState } from "@/types";

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const SESSION_KEY_PREFIX = "interview:session:";

const TTL_SECONDS: Record<string, number> = {
  RAPID: 15 * 60,
  STANDARD: 45 * 60,
  FULL: 90 * 60,
};

export async function getSessionState(
  sessionId: string
): Promise<RedisSessionState | null> {
  const key = `${SESSION_KEY_PREFIX}${sessionId}`;
  const data = await redis.get<RedisSessionState>(key);
  return data;
}

export async function setSessionState(
  sessionId: string,
  state: RedisSessionState
): Promise<void> {
  const key = `${SESSION_KEY_PREFIX}${sessionId}`;
  const ttl = TTL_SECONDS[state.durationType] ?? TTL_SECONDS.STANDARD;
  await redis.setex(key, ttl, state);
}

export async function deleteSessionState(sessionId: string): Promise<void> {
  const key = `${SESSION_KEY_PREFIX}${sessionId}`;
  await redis.del(key);
}

export async function appendToConversation(
  sessionId: string,
  role: "user" | "assistant",
  content: string
): Promise<RedisSessionState | null> {
  const state = await getSessionState(sessionId);
  if (!state) return null;

  state.conversationHistory.push({ role, content });
  await setSessionState(sessionId, state);
  return state;
}
