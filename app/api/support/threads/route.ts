import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromAuthHeader } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const auth = getUserFromAuthHeader(req.headers.get("authorization"));
    if (!auth?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const threads = await prisma.supportThread.findMany({
      where: { userId: auth.userId },
      orderBy: { updatedAt: "desc" },
      take: 50,
      include: {
        withdrawalRequest: true,
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });

    return NextResponse.json({ threads });
  } catch (err) {
    console.error("SUPPORT THREADS GET ERROR:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// Optional: create a thread manually for an existing withdrawalRequestId
export async function POST(req: NextRequest) {
  try {
    const auth = getUserFromAuthHeader(req.headers.get("authorization"));
    if (!auth?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const withdrawalRequestId = Number(body?.withdrawalRequestId);

    if (!withdrawalRequestId || !Number.isInteger(withdrawalRequestId)) {
      return NextResponse.json(
        { error: "withdrawalRequestId is required." },
        { status: 400 },
      );
    }

    // Ensure withdrawal belongs to user
    const wr = await prisma.withdrawalRequest.findFirst({
      where: { id: withdrawalRequestId, userId: auth.userId },
      select: { id: true },
    });

    if (!wr) {
      return NextResponse.json(
        { error: "Withdrawal not found." },
        { status: 404 },
      );
    }

    const thread = await prisma.supportThread.upsert({
      where: { withdrawalRequestId },
      update: { status: "OPEN" },
      create: { userId: auth.userId, withdrawalRequestId, status: "OPEN" },
    });

    return NextResponse.json({ thread });
  } catch (err) {
    console.error("SUPPORT THREADS POST ERROR:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
