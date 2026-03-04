import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { synthesizeSpeech } from "@/lib/tts";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { text } = (await req.json()) as { text?: string };
    if (!text?.trim()) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }

    const audioBytes = await synthesizeSpeech(text);
    const body = Buffer.from(audioBytes);

    return new NextResponse(body, {
      status: 200,
      headers: {
        // ElevenLabs defaults to MP3; we request audio/mpeg.
        "Content-Type": "audio/mpeg",
        "Content-Length": String(body.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "TTS failed";
    console.error("[/api/voice/speak]", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
