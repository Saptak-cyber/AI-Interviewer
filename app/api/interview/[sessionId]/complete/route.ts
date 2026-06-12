import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSessionState, setSessionState } from "@/lib/redis";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sessionId } = await params;

    // Load session from database
    const dbSession = await prisma.interviewSession.findUnique({
      where: { id: sessionId },
    });

    if (!dbSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (dbSession.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Mark session as complete in database
    await prisma.interviewSession.update({
      where: { id: sessionId },
      data: {
        isComplete: true,
        endedAt: new Date(),
      },
    });

    // Update Redis state if it exists
    const state = await getSessionState(sessionId);
    if (state) {
      state.isComplete = true;
      await setSessionState(sessionId, state);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[/api/interview/[sessionId]/complete]", error);
    return NextResponse.json(
      { error: "Failed to mark interview as complete" },
      { status: 500 }
    );
  }
}
