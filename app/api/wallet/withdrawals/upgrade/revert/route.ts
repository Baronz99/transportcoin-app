import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromAuthHeader } from "@/lib/auth";
import {
  revertActiveProUpgrade,
  retryQueuedPayoutChecksForUser,
} from "@/lib/withdrawalCollateral";
import {
  PRO_QUEUE_MAX_MINUTES,
  PRO_QUEUE_MIN_MINUTES,
} from "@/lib/withdrawalQueue";

export async function POST(req: Request) {
  try {
    const authUser = getUserFromAuthHeader(req.headers.get("authorization"));
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await revertActiveProUpgrade({
      userId: authUser.userId,
      requireWithinWindow: true,
      reason: "User requested PRO revert during collateral hold window.",
    });
    if (!result.reverted) {
      return NextResponse.json({ error: result.message }, { status: 409 });
    }

    await retryQueuedPayoutChecksForUser({ userId: authUser.userId });

    const user = await prisma.user.findUnique({
      where: { id: authUser.userId },
      select: { tier: true },
    });
    const wallet = await prisma.wallet.findUnique({
      where: { userId: authUser.userId },
      select: { tcGoldBalance: true },
    });
    const latestQueued = await prisma.withdrawalRequest.findFirst({
      where: {
        userId: authUser.userId,
        status: { in: ["WAITING_QUEUE", "ON_HOLD_COLLATERAL", "READY_FOR_PAYOUT"] },
      },
      orderBy: { queuedAt: "desc" },
      select: {
        id: true,
        amountTcn: true,
        asset: true,
        network: true,
        address: true,
        status: true,
        createdAt: true,
        queuedAt: true,
        queueDueAt: true,
        queueLane: true,
        expediteAppliedAt: true,
        holdDeficitTcg: true,
        holdReason: true,
        collateralTierSnapshot: true,
        collateralReserveFloorTcg: true,
        collateralRequiredTcg: true,
        proUpgradeActivatedAt: true,
        proUpgradeRevertDeadlineAt: true,
        lastPayoutRetryAt: true,
      },
    });

    return NextResponse.json({
      ok: true,
      tier: user?.tier ?? "BASIC",
      wallet: { tcGoldBalance: wallet?.tcGoldBalance ?? 0 },
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
      message: "PRO upgrade reverted. 1000 TCG refunded and queue returned to BASIC lane.",
    });
  } catch (err) {
    console.error("WITHDRAWAL-UPGRADE-REVERT ERROR:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
