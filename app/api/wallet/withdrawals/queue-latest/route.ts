import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromAuthHeader } from "@/lib/auth";
import {
  PRO_QUEUE_MAX_MINUTES,
  PRO_QUEUE_MIN_MINUTES,
} from "@/lib/withdrawalQueue";
import { retryQueuedPayoutChecksForUser } from "@/lib/withdrawalCollateral";

export async function GET(req: Request) {
  try {
    const authUser = getUserFromAuthHeader(req.headers.get("authorization"));

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await retryQueuedPayoutChecksForUser({ userId: authUser.userId });

    const queued = await prisma.withdrawalRequest.findFirst({
      where: {
        userId: authUser.userId,
        status: { in: ["WAITING_QUEUE", "ON_HOLD_COLLATERAL", "READY_FOR_PAYOUT"] },
      },
      orderBy: { queuedAt: "desc" },
    });

    if (!queued) {
      return NextResponse.json({ withdrawal: null });
    }

    return NextResponse.json({
      withdrawal: {
        id: queued.id,
        amountTcn: queued.amountTcn,
        asset: queued.asset,
        network: queued.network,
        address: queued.address,
        status: queued.status,
        createdAt: queued.createdAt,
        queuedAt: queued.queuedAt,
        queueDueAt: queued.queueDueAt,
        queueLane: queued.queueLane,
        expediteAppliedAt: queued.expediteAppliedAt,
        holdDeficitTcg: queued.holdDeficitTcg,
        holdReason: queued.holdReason,
        collateralTierSnapshot: queued.collateralTierSnapshot,
        collateralReserveFloorTcg: queued.collateralReserveFloorTcg,
        collateralRequiredTcg: queued.collateralRequiredTcg,
        proUpgradeActivatedAt: queued.proUpgradeActivatedAt,
        proUpgradeRevertDeadlineAt: queued.proUpgradeRevertDeadlineAt,
        lastPayoutRetryAt: queued.lastPayoutRetryAt,
        estimatedMinMinutes: queued.queueLane === "PRO"
          ? PRO_QUEUE_MIN_MINUTES
          : null,
        estimatedMaxMinutes: queued.queueLane === "PRO"
          ? PRO_QUEUE_MAX_MINUTES
          : null,
        estimatedLabel: queued.queueLane === "PRO" ? "5 to 30 minutes" : null,
      },
    });
  } catch (err) {
    console.error("WITHDRAWAL-QUEUE-LATEST ERROR:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
