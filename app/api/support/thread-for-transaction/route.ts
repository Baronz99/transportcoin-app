import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromAuthHeader } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const auth = getUserFromAuthHeader(req.headers.get("authorization"));
    if (!auth?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const transactionId = Number(body?.transactionId);

    if (!transactionId || !Number.isInteger(transactionId)) {
      return NextResponse.json({ error: "transactionId is required." }, { status: 400 });
    }

    const tx = await prisma.transaction.findFirst({
      where: { id: transactionId, userId: auth.userId },
      select: { id: true, type: true, amount: true, status: true, createdAt: true },
    });

    if (!tx) {
      return NextResponse.json({ error: "Transaction not found." }, { status: 404 });
    }

    if (tx.type !== "WITHDRAW_CRYPTO_REQUEST") {
      return NextResponse.json({ error: "This transaction is not a withdrawal request." }, { status: 400 });
    }

    // Find the most likely WithdrawalRequest for this tx:
    // (Same user, same amount, prefer latest PENDING)
    const wr = await prisma.withdrawalRequest.findFirst({
      where: {
        userId: auth.userId,
        amountTcn: tx.amount,
      },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });

    if (!wr) {
      return NextResponse.json(
        { error: "No withdrawal request found for this transaction amount." },
        { status: 404 },
      );
    }

    // Upsert support thread for this withdrawal request
    const thread = await prisma.supportThread.upsert({
      where: { withdrawalRequestId: wr.id },
      update: { status: "OPEN" },
      create: {
        userId: auth.userId,
        withdrawalRequestId: wr.id,
        status: "OPEN",
      },
    });

    return NextResponse.json({ threadId: thread.id, withdrawalRequestId: wr.id });
  } catch (err) {
    console.error("THREAD-FOR-TRANSACTION ERROR:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
