import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromAuthHeader } from "@/lib/auth";

export const dynamic = "force-dynamic";

function isAdmin(auth: any) {
  return auth?.isAdmin === true || auth?.tier === "ADMIN";
}

export async function POST(
  req: NextRequest,
  ctx: { params: { threadId: string } },
) {
  try {
    const auth = getUserFromAuthHeader(req.headers.get("authorization"));
    if (!isAdmin(auth)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const threadId = Number(ctx.params.threadId);
    if (!threadId) {
      return NextResponse.json({ error: "Invalid threadId" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const message = String(body?.message ?? "").trim();
    const closeThread = Boolean(body?.closeThread);

    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    const thread = await prisma.supportThread.findUnique({
      where: { id: threadId },
      select: { id: true, status: true },
    });

    if (!thread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    const msg = await prisma.supportMessage.create({
      data: { threadId, sender: "ADMIN", body: message },
    });

    await prisma.supportThread.update({
      where: { id: threadId },
      data: { status: closeThread ? "CLOSED" : thread.status, updatedAt: new Date() },
    });

    return NextResponse.json({ message: msg });
  } catch (err) {
    console.error("ADMIN SUPPORT REPLY ERROR:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
