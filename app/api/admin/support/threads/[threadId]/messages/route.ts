import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromAuthHeader } from "@/lib/auth";

export const dynamic = "force-dynamic";

// ✅ Next.js 16 expects params as a Promise
type Ctx = { params: Promise<{ threadId: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    // ✅ auth
    const authHeader = req.headers.get("authorization") || "";
    const authUser = getUserFromAuthHeader(authHeader);

    if (!authUser?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ✅ must be admin
    const me = await prisma.user.findUnique({
      where: { id: authUser.userId },
      select: { isAdmin: true },
    });

    if (!me?.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // ✅ Next.js 16: await params
    const { threadId } = await ctx.params;
    const threadIdNum = Number(threadId);

    if (!threadIdNum || !Number.isFinite(threadIdNum)) {
      return NextResponse.json({ error: "Invalid threadId" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const messageBody = String(body?.body || "").trim();

    if (!messageBody) {
      return NextResponse.json({ error: "Message body is required." }, { status: 400 });
    }

    // ✅ ensure thread exists
    const thread = await prisma.supportThread.findUnique({
      where: { id: threadIdNum },
      select: { id: true },
    });

    if (!thread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    const message = await prisma.supportMessage.create({
      data: {
        threadId: threadIdNum,
        sender: "ADMIN",
        body: messageBody,
      },
      select: {
        id: true,
        threadId: true,
        sender: true,
        body: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ message }, { status: 200 });
  } catch (err) {
    console.error("ADMIN SUPPORT MESSAGE POST ERROR:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
