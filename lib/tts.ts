const MAX_CHARS = 500;

// Default English voice from ElevenLabs; you can change this later.
const ELEVEN_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb"; // Rachel (example from docs)
const ELEVEN_TTS_URL = `https://api.elevenlabs.io/v1/text-to-speech/${ELEVEN_VOICE_ID}`;
const ELEVEN_TTS_STREAM_URL = `https://api.elevenlabs.io/v1/text-to-speech/${ELEVEN_VOICE_ID}/stream`;

function truncateToSentence(text: string): string {
  if (text.length <= MAX_CHARS) return text;
  const cutoff = text.lastIndexOf(". ", MAX_CHARS);
  return cutoff > 0 ? text.slice(0, cutoff + 1) : text.slice(0, MAX_CHARS);
}

export async function synthesizeSpeech(text: string): Promise<Uint8Array> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY is not set");
  }

  const input = truncateToSentence(text.trim());
  if (!input) {
    throw new Error("Empty text for TTS");
  }

  const res = await fetch(ELEVEN_TTS_URL, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg", // mp3
    },
    body: JSON.stringify({
      text: input,
      model_id: "eleven_multilingual_v2",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("ElevenLabs TTS error", res.status, err.slice(0, 200));
    throw new Error(`ElevenLabs TTS error ${res.status}`);
  }

  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}

/**
 * Streaming variant: yields raw MP3 byte chunks as they arrive from ElevenLabs.
 * Uses the /stream endpoint so the first bytes arrive before the full audio is
 * synthesized — enables sentence-level streaming playback on the client.
 * Pass an AbortSignal to cancel mid-stream (e.g. on user barge-in).
 */
export async function* synthesizeSpeechStream(
  text: string,
  signal?: AbortSignal
): AsyncGenerator<Uint8Array> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY is not set");

  const input = text.trim();
  if (!input) return;

  const res = await fetch(ELEVEN_TTS_STREAM_URL, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text: input,
      model_id: "eleven_multilingual_v2",
      // Optimise latency: reduce buffer ahead of time
      optimize_streaming_latency: 3,
    }),
    signal,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`ElevenLabs TTS stream error ${res.status}: ${err.slice(0, 200)}`);
  }

  if (!res.body) throw new Error("No response body from ElevenLabs stream");

  const reader = res.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done || signal?.aborted) break;
      if (value) yield value;
    }
  } finally {
    reader.releaseLock();
  }
}
