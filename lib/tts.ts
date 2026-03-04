const MAX_CHARS = 500;

// Default English voice from ElevenLabs; you can change this later.
const ELEVEN_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb"; // Rachel (example from docs)
const ELEVEN_TTS_URL = `https://api.elevenlabs.io/v1/text-to-speech/${ELEVEN_VOICE_ID}`;

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
