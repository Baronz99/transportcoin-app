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

    // ✅ THIS IS THE KEY LINE
    const { threadId } = await ctx.params;
    const threadIdNum = Number(threadId);

    if (!threadIdNum) {
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

    return NextResponse.json({ thread });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
