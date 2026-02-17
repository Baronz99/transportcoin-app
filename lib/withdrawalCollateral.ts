import { prisma } from "@/lib/prisma";
import {
  applyProQueueJump,
  buildWaitingQueueSchedule,
} from "@/lib/withdrawalQueue";
import { requiredTcgForWithdrawal } from "@/lib/withdrawalAudit";

const RETRY_INTERVAL_MS = 10 * 60 * 1000;
const REVERT_WINDOW_HOURS = 48;
const PRO_UPGRADE_TCG_COST = 1000;

export function reserveFloorForTier(tier: string | null | undefined) {
  return String(tier || "BASIC").toUpperCase() === "BASIC" ? 800 : 0;
}

export function buildCollateralSnapshot(params: {
  tier: string | null | undefined;
  amountTcn: number;
}) {
  const tierSnapshot = String(params.tier || "BASIC").toUpperCase();
  return {
    collateralTierSnapshot: tierSnapshot,
    collateralReserveFloorTcg: reserveFloorForTier(tierSnapshot),
    collateralRequiredTcg: requiredTcgForWithdrawal(params.amountTcn),
  };
}

export function computeCollateralDeficit(params: {
  totalTcg: number;
  reserveFloorTcg: number;
  requiredTcg: number;
}) {
  return Math.max(
    0,
    params.reserveFloorTcg + params.requiredTcg - Math.max(0, params.totalTcg),
  );
}

function canRetryNow(lastRetryAt: Date | null | undefined, now: Date) {
  if (!lastRetryAt) return true;
  return now.getTime() - lastRetryAt.getTime() >= RETRY_INTERVAL_MS;
}

export async function revertActiveProUpgrade(params: {
  userId: number;
  now?: Date;
  requireWithinWindow?: boolean;
  reason: string;
}) {
  const now = params.now ?? new Date();
  const queuedPro = await prisma.withdrawalRequest.findMany({
    where: {
      userId: params.userId,
      queueLane: "PRO",
      proUpgradeActivatedAt: { not: null },
      status: { in: ["WAITING_QUEUE", "ON_HOLD_COLLATERAL"] },
    },
    orderBy: { queuedAt: "desc" },
    select: {
      id: true,
      status: true,
      proUpgradeRevertDeadlineAt: true,
    },
  });

  if (queuedPro.length === 0) {
    return { reverted: false as const, message: "No active PRO upgrade found." };
  }

  if (params.requireWithinWindow) {
    const stillWithinWindow = queuedPro.some((w) => {
      if (!w.proUpgradeRevertDeadlineAt) return false;
      return w.proUpgradeRevertDeadlineAt.getTime() > now.getTime();
    });
    if (!stillWithinWindow) {
      return {
        reverted: false as const,
        message: "Revert window has expired for this upgrade.",
      };
    }
  }

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: params.userId },
      select: { id: true, tier: true },
    });
    const wallet = await tx.wallet.findUnique({
      where: { userId: params.userId },
      select: { id: true },
    });

    if (!user || !wallet) {
      throw new Error("User or wallet not found for PRO revert.");
    }

    if (user.tier === "PRO") {
      await tx.user.update({
        where: { id: params.userId },
        data: { tier: "BASIC" },
      });
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { tcGoldBalance: { increment: PRO_UPGRADE_TCG_COST } },
      });
      await tx.transaction.create({
        data: {
          userId: params.userId,
          walletId: wallet.id,
          type: "PRO_DOWNGRADE_REFUND",
          amount: PRO_UPGRADE_TCG_COST,
          status: "SUCCESS",
          description: "PRO upgrade reverted; 1000 TCGold refunded.",
          adminNote: params.reason,
        },
      });
    }

    for (const withdrawal of queuedPro) {
      const schedule = buildWaitingQueueSchedule({
        tier: "BASIC",
        seed: withdrawal.id,
        now,
      });
      await tx.withdrawalRequest.update({
        where: { id: withdrawal.id },
        data: {
          status: schedule.status,
          queueLane: schedule.queueLane,
          queueDueAt: schedule.queueDueAt,
          queuedAt: schedule.queuedAt,
          expediteAppliedAt: null,
          holdDeficitTcg: null,
          holdReason: null,
          proUpgradeActivatedAt: null,
          proUpgradeRevertDeadlineAt: null,
          lastPayoutRetryAt: now,
        },
      });
    }
  });

  return { reverted: true as const, message: "Upgrade reverted to BASIC lane." };
}

export async function retryQueuedPayoutChecksForUser(params: {
  userId: number;
  now?: Date;
}) {
  const now = params.now ?? new Date();
  const [wallet, queued] = await Promise.all([
    prisma.wallet.findUnique({
      where: { userId: params.userId },
      select: { tcGoldBalance: true },
    }),
    prisma.withdrawalRequest.findMany({
      where: {
        userId: params.userId,
        status: { in: ["WAITING_QUEUE", "ON_HOLD_COLLATERAL"] },
      },
      orderBy: { queuedAt: "asc" },
    }),
  ]);

  if (!wallet || queued.length === 0) return;

  for (const withdrawal of queued) {
    if (!canRetryNow(withdrawal.lastPayoutRetryAt, now)) continue;

    const reserveFloorTcg = Math.max(
      0,
      withdrawal.collateralReserveFloorTcg ?? 0,
    );
    const requiredTcg = Math.max(
      1,
      withdrawal.collateralRequiredTcg || requiredTcgForWithdrawal(withdrawal.amountTcn),
    );
    const deficit = computeCollateralDeficit({
      totalTcg: wallet.tcGoldBalance ?? 0,
      reserveFloorTcg,
      requiredTcg,
    });

    if (
      withdrawal.status === "ON_HOLD_COLLATERAL" &&
      withdrawal.proUpgradeRevertDeadlineAt &&
      withdrawal.proUpgradeRevertDeadlineAt.getTime() <= now.getTime() &&
      deficit > 0
    ) {
      await revertActiveProUpgrade({
        userId: params.userId,
        now,
        requireWithinWindow: false,
        reason: "Auto-revert after 48h hold window expired.",
      });
      continue;
    }

    if (deficit > 0) {
      await prisma.withdrawalRequest.update({
        where: { id: withdrawal.id },
        data: {
          status: "ON_HOLD_COLLATERAL",
          holdDeficitTcg: deficit,
          holdReason:
            "PRO lane collateral shortfall detected. Top up deficit or revert to BASIC within 48 hours.",
          proUpgradeRevertDeadlineAt:
            withdrawal.proUpgradeRevertDeadlineAt ??
            (withdrawal.proUpgradeActivatedAt
              ? new Date(
                  withdrawal.proUpgradeActivatedAt.getTime() +
                    REVERT_WINDOW_HOURS * 60 * 60 * 1000,
                )
              : null),
          lastPayoutRetryAt: now,
        },
      });
      continue;
    }

    const dueAtMs = withdrawal.queueDueAt
      ? new Date(withdrawal.queueDueAt).getTime()
      : null;
    const readyForPayout = dueAtMs !== null && dueAtMs <= now.getTime();

    await prisma.withdrawalRequest.update({
      where: { id: withdrawal.id },
      data: {
        status: readyForPayout ? "READY_FOR_PAYOUT" : "WAITING_QUEUE",
        holdDeficitTcg: null,
        holdReason: null,
        lastPayoutRetryAt: now,
      },
    });
  }
}

export function buildProUpgradeDeadline(now: Date) {
  return new Date(now.getTime() + REVERT_WINDOW_HOURS * 60 * 60 * 1000);
}

export function buildProDueAtFromCurrent(params: {
  now: Date;
  currentDueAt: Date | null | undefined;
  seed: number;
}) {
  return applyProQueueJump({
    now: params.now,
    currentDueAt: params.currentDueAt,
    seed: params.seed,
  });
}
