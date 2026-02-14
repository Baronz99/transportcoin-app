import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromAuthHeader } from "@/lib/auth";
import {
  applyProQueueJump,
  PRO_QUEUE_MAX_MINUTES,
  PRO_QUEUE_MIN_MINUTES,
} from "@/lib/withdrawalQueue";

const PRO_UPGRADE_TCG_COST = 1000;

export async function POST(req: Request) {
  try {
    const authUser = getUserFromAuthHeader(req.headers.get("authorization"));
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: authUser.userId },
      select: { id: true, tier: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    if (user.tier === "PRO") {
      return NextResponse.json(
        { error: "User is already PRO." },
        { status: 409 },
      );
    }

    const wallet = await prisma.wallet.findUnique({
      where: { userId: authUser.userId },
      select: { id: true, tcGoldBalance: true },
    });

    if (!wallet) {
      return NextResponse.json({ error: "Wallet not found." }, { status: 404 });
    }

    if ((wallet.tcGoldBalance ?? 0) < PRO_UPGRADE_TCG_COST) {
      return NextResponse.json(
        {
          error: "Insufficient TCGold for PRO upgrade.",
          requiredTcGold: PRO_UPGRADE_TCG_COST,
          currentTcGold: wallet.tcGoldBalance ?? 0,
        },
        { status: 409 },
      );
    }

    const now = new Date();
    const queued = await prisma.withdrawalRequest.findMany({
      where: { userId: authUser.userId, status: "WAITING_QUEUE" },
      select: { id: true, queueDueAt: true },
    });

    const result = await prisma.$transaction(async (tx) => {
      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          tcGoldBalance: {
            decrement: PRO_UPGRADE_TCG_COST,
          },
        },
      });

      const updatedUser = await tx.user.update({
        where: { id: authUser.userId },
        data: { tier: "PRO" },
        select: { id: true, tier: true },
      });

      await tx.transaction.create({
        data: {
          userId: authUser.userId,
          walletId: wallet.id,
          type: "PRO_UPGRADE",
          amount: PRO_UPGRADE_TCG_COST,
          status: "SUCCESS",
          description: "User upgraded to PRO, 1000 TCGold deducted",
          adminNote: "Queue jump upgrade applied: tier set to PRO via 1000 TCGold deduction.",
        },
      });

      for (const withdrawal of queued) {
        await tx.withdrawalRequest.update({
          where: { id: withdrawal.id },
          data: {
            queueLane: "PRO",
            queueDueAt: applyProQueueJump({
              now,
              currentDueAt: withdrawal.queueDueAt,
              seed: withdrawal.id,
            }),
            expediteAppliedAt: now,
          },
        });
      }

      return { updatedUser, updatedWallet };
    });

    const latestQueued = await prisma.withdrawalRequest.findFirst({
      where: { userId: authUser.userId, status: "WAITING_QUEUE" },
      orderBy: { queuedAt: "desc" },
      select: {
        id: true,
        amountTcn: true,
        asset: true,
        network: true,
        status: true,
        createdAt: true,
        queuedAt: true,
        queueDueAt: true,
        queueLane: true,
        expediteAppliedAt: true,
      },
    });

    return NextResponse.json({
      ok: true,
      tier: result.updatedUser.tier,
      deductedTcGold: PRO_UPGRADE_TCG_COST,
      wallet: {
        tcGoldBalance: result.updatedWallet.tcGoldBalance ?? 0,
      },
      updatedQueueCount: queued.length,
      withdrawal: latestQueued
        ? {
            ...latestQueued,
            estimatedMinMinutes: latestQueued.queueLane === "PRO"
              ? PRO_QUEUE_MIN_MINUTES
              : null,
            estimatedMaxMinutes: latestQueued.queueLane === "PRO"
              ? PRO_QUEUE_MAX_MINUTES
              : null,
            estimatedLabel: latestQueued.queueLane === "PRO"
              ? "5 to 30 minutes"
              : null,
          }
        : null,
      estimatedMinMinutes: PRO_QUEUE_MIN_MINUTES,
      estimatedMaxMinutes: PRO_QUEUE_MAX_MINUTES,
      estimatedLabel: "5 to 30 minutes",
      message: "Upgraded to PRO. Waiting queue has been expedited.",
    });
  } catch (err) {
    console.error("WITHDRAWAL-UPGRADE ERROR:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
