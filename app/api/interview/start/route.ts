import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { setSessionState } from "@/lib/redis";
import { callInterviewerLLM } from "@/lib/groq";
import type {
  StartInterviewRequest,
  StartInterviewResponse,
  RedisSessionState,
} from "@/types";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as StartInterviewRequest;
    const {
      topic,
      customTopic,
      difficulty,
      experienceLevel,
      mode,
      durationType,
    } = body;

    if (!topic || !difficulty || !experienceLevel || !mode || !durationType) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Create interview session in DB
    const interviewSession = await prisma.interviewSession.create({
      data: {
        userId: session.user.id,
        topic,
        customTopic: customTopic || null,
        difficulty,
        experienceLevel,
        mode,
        durationType,
      },
    });

    // Seed Redis session state
    const redisState: RedisSessionState = {
      sessionId: interviewSession.id,
      userId: session.user.id,
      topic,
      customTopic,
      difficulty,
      experienceLevel,
      mode,
      durationType,
      conversationHistory: [],
      questionIndex: 0,
      followupCount: 0,
      isComplete: false,
      startedAt: new Date().toISOString(),
    };

    await setSessionState(interviewSession.id, redisState);

    // Get first AI message
    const { reply: firstMessage } = await callInterviewerLLM(
      redisState,
      "Begin the interview."
    );

    // Update Redis with first AI message in history
    redisState.conversationHistory.push({
      role: "assistant",
      content: firstMessage,
    });
    await setSessionState(interviewSession.id, redisState);

    // Store first AI turn in DB
    await prisma.interviewTurn.create({
      data: {
        sessionId: interviewSession.id,
        role: "AI",
        kind: "QUESTION",
        content: firstMessage,
      },
    });

    return NextResponse.json({
      sessionId: interviewSession.id,
      firstMessage,
    } satisfies StartInterviewResponse);
  } catch (error) {
    console.error("[/api/interview/start]", error);
    return NextResponse.json(
      { error: "Failed to start interview" },
      { status: 500 }
    );
  }
}
