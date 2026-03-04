// const HF_WHISPER_MODEL = "openai/whisper-large-v3";
const HF_WHISPER_MODEL = "openai/whisper-large-v3-turbo";
// const HF_API_URL = `https://api-inference.huggingface.co/models/${HF_WHISPER_MODEL}`;
const HF_API_URL = `https://router.huggingface.co/hf-inference/models/${HF_WHISPER_MODEL}`;

export async function transcribeAudio(
  audioBuffer: Buffer,
  mimeType: string
): Promise<string> {
  const apiKey = process.env.HUGGINGFACE_API_KEY;
  if (!apiKey) throw new Error("HUGGINGFACE_API_KEY is not set");

  // Convert Node.js Buffer to Uint8Array for fetch compatibility
  const body = new Uint8Array(audioBuffer);

  const response = await fetch(HF_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": mimeType,
    },
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    // Model may be loading — return a helpful message instead of throwing
    if (response.status === 503) {
      throw new Error(
        "Whisper model is loading. Please wait a moment and try again."
      );
    }
    throw new Error(`Hugging Face API error ${response.status}: ${errorText}`);
  }

  const result = (await response.json()) as { text?: string; error?: string };

  if (result.error) {
    throw new Error(`Whisper transcription error: ${result.error}`);
  }

  return result.text?.trim() ?? "";
}
