import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromAuthHeader } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  ctx: { params: { threadId: string } },
) {
  try {
    const auth = getUserFromAuthHeader(req.headers.get("authorization"));
    if (!auth?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const threadId = Number(ctx.params.threadId);
    if (!threadId) {
      return NextResponse.json({ error: "Invalid threadId" }, { status: 400 });
    }

    const thread = await prisma.supportThread.findFirst({
      where: { id: threadId, userId: auth.userId },
      include: {
        withdrawalRequest: true,
        messages: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!thread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    return NextResponse.json({ thread });
  } catch (err) {
    console.error("SUPPORT MESSAGES GET ERROR:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  ctx: { params: { threadId: string } },
) {
  try {
    const auth = getUserFromAuthHeader(req.headers.get("authorization"));
    if (!auth?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const threadId = Number(ctx.params.threadId);
    if (!threadId) {
      return NextResponse.json({ error: "Invalid threadId" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const message = String(body?.message ?? "").trim();

    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    // Ensure this thread belongs to user and is open
    const thread = await prisma.supportThread.findFirst({
      where: { id: threadId, userId: auth.userId },
      select: { id: true, status: true },
    });

    if (!thread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }
    if (thread.status === "CLOSED") {
      return NextResponse.json(
        { error: "Thread is closed" },
        { status: 400 },
      );
    }

    const msg = await prisma.supportMessage.create({
      data: { threadId, sender: "USER", body: message },
    });

    // bump updatedAt
    await prisma.supportThread.update({
      where: { id: threadId },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json({ message: msg });
  } catch (err) {
    console.error("SUPPORT MESSAGES POST ERROR:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
