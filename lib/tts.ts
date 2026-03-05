/**
 * lib/tts.ts
 *
 * Text-to-speech using the Kokoro-82M model hosted at
 * https://huggingface.co/spaces/Saptak225/speech5_tts-app (Gradio API).
 *
 * Available voices:
 *   "Female - Heart" | "Female - Bella" | "Female - Sarah" | "Female - Nicole"
 *   "Male - Sky"     | "Male - Adam"    | "Male - Michael"
 *   "British Female - Emma" | "British Male - George"
 */

const MAX_CHARS = 500; // Kokoro TTS seems to have a ~500 char practical limit

const KOKORO_BASE_URL = "https://saptak225-speech5-tts-app.hf.space";
const KOKORO_PREDICT_URL = `${KOKORO_BASE_URL}/gradio_api/call/generate_speech`;

export const DEFAULT_VOICE = "Male - Michael";

interface GradioFileData {
  path: string;
  url?: string | null;
  orig_name?: string | null;
  mime_type?: string | null;
}

/**
 * Split text into sentences, respecting the MAX_CHARS limit per sentence.
 * This ensures long paragraphs are broken into multiple TTS calls.
 */
function splitIntoSentences(text: string): string[] {
  // Split on sentence boundaries
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const result: string[] = [];
  
  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;
    
    // If sentence is within limit, add it
    if (trimmed.length <= MAX_CHARS) {
      result.push(trimmed);
    } else {
      // If sentence is too long, split at commas or spaces
      const chunks = trimmed.match(new RegExp(`.{1,${MAX_CHARS}}(?:,|\\s|$)`, 'g')) || [trimmed];
      result.push(...chunks.map(c => c.trim()).filter(c => c));
    }
  }
  
  return result;
}

function truncateToSentence(text: string): string {
  if (text.length <= MAX_CHARS) return text;
  const cutoff = text.lastIndexOf(". ", MAX_CHARS);
  return cutoff > 0 ? text.slice(0, cutoff + 1) : text.slice(0, MAX_CHARS);
}

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const hfToken = process.env.HUGGINGFACE_API_KEY;
  if (hfToken) headers["Authorization"] = `Bearer ${hfToken}`;
  return headers;
}

/**
 * Calls the Kokoro Gradio API and returns the raw audio bytes + MIME type.
 * The API is a two-step process:
 *   1. POST to submit the job  → get event_id
 *   2. GET  the SSE result URL → parse "complete" event → download audio file
 */
async function callKokoroAPI(
  text: string,
  voice: string = DEFAULT_VOICE,
  signal?: AbortSignal
): Promise<{ bytes: Uint8Array; mimeType: string }> {
  const startTime = Date.now();
  console.log('[TTS] Starting Kokoro API call for text length:', text.length);
  
  // Step 1: Submit job
  const submitRes = await fetch(KOKORO_PREDICT_URL, {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify({ data: [text, voice] }),
    signal,
  });

  if (!submitRes.ok) {
    const err = await submitRes.text();
    throw new Error(`Kokoro TTS submit error ${submitRes.status}: ${err.slice(0, 200)}`);
  }

  const { event_id } = (await submitRes.json()) as { event_id: string };
  if (!event_id) throw new Error("No event_id returned from Kokoro TTS");
  
  console.log('[TTS] Job submitted, event_id:', event_id, 'Time:', Date.now() - startTime, 'ms');

  // Step 2: Poll result via SSE
  const authHeaders: Record<string, string> = {};
  if (process.env.HUGGINGFACE_API_KEY) {
    authHeaders["Authorization"] = `Bearer ${process.env.HUGGINGFACE_API_KEY}`;
  }

  const resultRes = await fetch(`${KOKORO_PREDICT_URL}/${event_id}`, {
    headers: authHeaders,
    signal,
  });

  if (!resultRes.ok) {
    throw new Error(`Kokoro TTS result error ${resultRes.status}`);
  }

  console.log('[TTS] Result received. Time:', Date.now() - startTime, 'ms');

  // Parse SSE text: find the data line that follows "event: complete"
  const sseText = await resultRes.text();
  let fileData: GradioFileData | null = null;
  const lines = sseText.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === "event: complete" && i + 1 < lines.length) {
      const dataLine = lines[i + 1].trim();
      if (dataLine.startsWith("data:")) {
        try {
          const parsed = JSON.parse(dataLine.slice(5).trim()) as GradioFileData[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            fileData = parsed[0];
          }
        } catch {
          // ignore parse errors
        }
      }
    }
  }

  if (!fileData) {
    throw new Error("No audio file data in Kokoro TTS response");
  }

  // Step 3: Download the audio file
  const audioUrl =
    fileData.url ?? `${KOKORO_BASE_URL}/gradio_api/file=${fileData.path}`;

  const audioRes = await fetch(audioUrl, { signal });
  if (!audioRes.ok) {
    throw new Error(`Failed to download Kokoro audio: ${audioRes.status}`);
  }

  const buf = await audioRes.arrayBuffer();
  const mimeType = fileData.mime_type ?? "audio/wav";
  
  console.log('[TTS] Audio downloaded, size:', buf.byteLength, 'bytes. Total time:', Date.now() - startTime, 'ms');
  
  return { bytes: new Uint8Array(buf), mimeType };
}

export async function synthesizeSpeech(text: string): Promise<Uint8Array> {
  const input = text.trim();
  console.log('[TTS synthesizeSpeech] Input text length:', input.length);
  console.log('[TTS synthesizeSpeech] Input text:', input);
  
  if (!input) throw new Error("Empty text for TTS");

  // If text is within limit, synthesize directly
  if (input.length <= MAX_CHARS) {
    console.log('[TTS synthesizeSpeech] Text within limit, synthesizing directly');
    const { bytes } = await callKokoroAPI(input);
    return bytes;
  }

  // For longer text, we need to split and merge properly
  // For now, just use the first MAX_CHARS to avoid WAV concatenation issues
  console.warn('[TTS synthesizeSpeech] Text exceeds MAX_CHARS, truncating to', MAX_CHARS, 'characters');
  const truncated = truncateToSentence(input);
  console.log('[TTS synthesizeSpeech] Truncated text length:', truncated.length);
  const { bytes } = await callKokoroAPI(truncated);
  return bytes;
}

/**
 * "Streaming" variant that splits long text into sentences and yields
 * audio for each sentence separately. This allows handling text longer
 * than MAX_CHARS and provides better streaming behavior.
 */
export async function* synthesizeSpeechStream(
  text: string,
  signal?: AbortSignal
): AsyncGenerator<Uint8Array> {
  const input = text.trim();
  if (!input) return;

  // Split into sentences to handle long text
  const sentences = splitIntoSentences(input);
  
  for (const sentence of sentences) {
    if (signal?.aborted) break;
    
    const { bytes } = await callKokoroAPI(sentence, DEFAULT_VOICE, signal);
    if (!signal?.aborted) {
      yield bytes;
    }
  }
}
