/**
 * lib/tts.ts
 *
 * Text-to-speech using the Kokoro-82M model hosted on HuggingFace Spaces
 * with FastAPI for better performance and streaming support.
 *
 * Available voices:
 *   "Female - Heart" | "Female - Bella" | "Female - Sarah" | "Female - Nicole"
 *   "Male - Sky"     | "Male - Adam"    | "Male - Michael"
 *   "British Female - Emma" | "British Male - George"
 */

const MAX_CHARS = 5000; // Kokoro TTS supports up to 5000 characters

const KOKORO_BASE_URL = "https://saptak225-speech5-tts-app.hf.space";
const DEFAULT_VOICE = "Male - Michael";

export async function synthesizeSpeech(text: string): Promise<Uint8Array> {
  const input = text.trim();
  console.log('[TTS synthesizeSpeech] Input text length:', input.length);
  
  if (!input) throw new Error("Empty text for TTS");

  if (input.length > MAX_CHARS) {
    console.warn('[TTS synthesizeSpeech] Text exceeds MAX_CHARS, truncating');
    const truncated = input.substring(0, MAX_CHARS);
    const lastPeriod = truncated.lastIndexOf('.');
    const finalText = lastPeriod > 0 ? truncated.substring(0, lastPeriod + 1) : truncated;
    return synthesizeSpeech(finalText);
  }

  const startTime = Date.now();
  
  // Use the FastAPI complete endpoint
  const response = await fetch(`${KOKORO_BASE_URL}/tts/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: input, voice: DEFAULT_VOICE }),
  });

  console.log('[TTS synthesizeSpeech] Response status:', response.status, 'Time:', Date.now() - startTime, 'ms');

  if (!response.ok) {
    const error = await response.text();
    console.error('[TTS synthesizeSpeech] Error:', error);
    throw new Error(`TTS error ${response.status}: ${error}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  console.log('[TTS synthesizeSpeech] Received audio, size:', arrayBuffer.byteLength, 'bytes. Total time:', Date.now() - startTime, 'ms');
  
  return new Uint8Array(arrayBuffer);
}

/**
 * Streaming variant - for future use with WebSocket or streaming responses
 */
export async function* synthesizeSpeechStream(
  text: string,
  signal?: AbortSignal
): AsyncGenerator<Uint8Array> {
  const input = text.trim();
  if (!input) return;

  // For now, just yield the complete audio
  // In the future, this could use the /tts/stream endpoint
  const bytes = await synthesizeSpeech(input);
  if (!signal?.aborted) {
    yield bytes;
  }
}
