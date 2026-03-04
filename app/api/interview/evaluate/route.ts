import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSessionState, deleteSessionState } from "@/lib/redis";
import { callEvaluatorLLM } from "@/lib/groq";
import type { EvaluateRequest } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as EvaluateRequest;
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId is required" },
        { status: 400 }
      );
    }

    const state = await getSessionState(sessionId);
    if (!state) {
      // Session may have expired from Redis — try to load from DB
      const dbSession = await prisma.interviewSession.findUnique({
        where: { id: sessionId },
        include: { evaluations: true },
      });

      if (!dbSession) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }

      // Return existing evaluation if already done
      if (dbSession.evaluations.length > 0) {
        const eval_ = dbSession.evaluations[0];
        return NextResponse.json({ evaluation: eval_ });
      }

      return NextResponse.json(
        { error: "Session state expired. Cannot evaluate." },
        { status: 410 }
      );
    }

    if (state.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check if evaluation already exists
    const existing = await prisma.evaluation.findFirst({
      where: { sessionId },
    });
    if (existing) {
      return NextResponse.json({ evaluation: existing });
    }

    // Generate evaluation via LLM
    const result = await callEvaluatorLLM(state);

    // Persist evaluation in DB
    const evaluation = await prisma.evaluation.create({
      data: {
        sessionId,
        scores: result.scores as unknown as Parameters<typeof prisma.evaluation.create>[0]["data"]["scores"],
        strengths: result.strengths.join("\n"),
        weaknesses: result.weaknesses.join("\n"),
        summary: result.summary,
      },
    });

    // Store overall scores on session
    await prisma.interviewSession.update({
      where: { id: sessionId },
      data: {
        overallScores: result.scores as unknown as Parameters<typeof prisma.interviewSession.update>[0]["data"]["overallScores"],
        isComplete: true,
        endedAt: new Date(),
      },
    });

    // Clean up Redis — session is done
    await deleteSessionState(sessionId);

    return NextResponse.json({ evaluation });
  } catch (error) {
    console.error("[/api/interview/evaluate]", error);
    return NextResponse.json(
      { error: "Failed to generate evaluation" },
      { status: 500 }
    );
  }
}
