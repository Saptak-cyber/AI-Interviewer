import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { callCodeAnalysisLLM } from "@/lib/groq";
import type { RunCodeRequest } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as RunCodeRequest;
    const { code, question } = body;

    if (!code?.trim() || !question?.trim()) {
      return NextResponse.json(
        { error: "code and question are required" },
        { status: 400 }
      );
    }

    if (code.length > 10000) {
      return NextResponse.json(
        { error: "Code exceeds maximum length of 10,000 characters" },
        { status: 400 }
      );
    }

    const analysis = await callCodeAnalysisLLM(code, question);

    return NextResponse.json({ analysis });
  } catch (error) {
    console.error("[/api/interview/run-code]", error);
    return NextResponse.json(
      { error: "Failed to analyze code" },
      { status: 500 }
    );
  }
}
