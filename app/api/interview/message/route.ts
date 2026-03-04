import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSessionState, setSessionState } from "@/lib/redis";
import { callInterviewerLLM } from "@/lib/groq";
import type { MessageRequest, MessageResponse } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as MessageRequest;
    const { sessionId, message } = body;

    if (!sessionId || !message?.trim()) {
      return NextResponse.json(
        { error: "sessionId and message are required" },
        { status: 400 }
      );
    }

    // Load Redis session state
    const state = await getSessionState(sessionId);
    if (!state) {
      return NextResponse.json(
        { error: "Session not found or expired" },
        { status: 404 }
      );
    }

    // Security: ensure session belongs to authenticated user
    if (state.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (state.isComplete) {
      return NextResponse.json({ error: "Interview is already complete" }, { status: 400 });
    }

    // Persist user turn in DB
    await prisma.interviewTurn.create({
      data: {
        sessionId,
        role: "USER",
        kind: "ANSWER",
        content: message,
      },
    });

    // Append user message to conversation history
    state.conversationHistory.push({ role: "user", content: message });

    // Call LLM
    const { reply, isComplete } = await callInterviewerLLM(state, message);

    // Append AI reply to history
    state.conversationHistory.push({ role: "assistant", content: reply });
    state.isComplete = isComplete;

    // Persist updated state to Redis
    await setSessionState(sessionId, state);

    // Persist AI turn in DB
    await prisma.interviewTurn.create({
      data: {
        sessionId,
        role: "AI",
        kind: isComplete ? "SYSTEM" : "FOLLOWUP",
        content: reply,
      },
    });

    // If complete, mark session as ended in DB
    if (isComplete) {
      await prisma.interviewSession.update({
        where: { id: sessionId },
        data: { endedAt: new Date(), isComplete: true },
      });
    }

    return NextResponse.json({
      reply,
      isComplete,
    } satisfies MessageResponse);
  } catch (error) {
    console.error("[/api/interview/message]", error);
    return NextResponse.json(
      { error: "Failed to process message" },
      { status: 500 }
    );
  }
}
