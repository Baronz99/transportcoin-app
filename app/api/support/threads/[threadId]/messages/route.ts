import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromAuthHeader } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Ctx = {
  params: Promise<{ threadId: string }>;
};

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const authUser = getUserFromAuthHeader(authHeader);

    if (!authUser?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { threadId } = await ctx.params;
    const threadIdNum = Number(threadId);

    if (!threadIdNum || !Number.isInteger(threadIdNum)) {
      return NextResponse.json({ error: "Invalid threadId" }, { status: 400 });
    }

    const thread = await prisma.supportThread.findUnique({
      where: { id: threadIdNum },
      include: {
        withdrawalRequest: true,
        messages: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!thread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    // ✅ Ensure user owns the thread
    if (thread.userId !== authUser.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ thread });
  } catch (err) {
    console.error("SUPPORT THREAD GET ERROR:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const authUser = getUserFromAuthHeader(authHeader);

    if (!authUser?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { threadId } = await ctx.params;
    const threadIdNum = Number(threadId);

    if (!threadIdNum || !Number.isInteger(threadIdNum)) {
      return NextResponse.json({ error: "Invalid threadId" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const messageBody = String(body?.body || "").trim();

    if (!messageBody) {
      return NextResponse.json({ error: "Message body is required." }, { status: 400 });
    }

    const thread = await prisma.supportThread.findUnique({
      where: { id: threadIdNum },
      select: { id: true, userId: true, status: true },
    });

    if (!thread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    // ✅ Ensure user owns the thread
    if (thread.userId !== authUser.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Optional: allow messaging even if CLOSED? (I’ll allow it by reopening)
    await prisma.supportThread.update({
      where: { id: threadIdNum },
      data: { status: "OPEN" },
    });

    const message = await prisma.supportMessage.create({
      data: {
        threadId: threadIdNum,
        sender: "USER",
        body: messageBody,
      },
    });

    return NextResponse.json({ message });
  } catch (err) {
    console.error("SUPPORT THREAD POST ERROR:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
