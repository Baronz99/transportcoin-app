const DAY_MS = 24 * 60 * 60 * 1000;

export type QueueLane = "BASIC" | "PRO";

export function queueLaneForTier(tier: string | null | undefined): QueueLane {
  return String(tier || "BASIC").toUpperCase() === "PRO" ? "PRO" : "BASIC";
}

export function basicQueueEtaDays(seed: number) {
  const normalized = Number.isInteger(seed) ? Math.abs(seed) : 0;
  return 14 + (normalized % 5); // 14..18 inclusive
}

export function queueEtaDaysForLane(params: {
  lane: QueueLane;
  seed: number;
}) {
  if (params.lane === "PRO") return 1;
  return basicQueueEtaDays(params.seed);
}

export function buildWaitingQueueSchedule(params: {
  tier: string | null | undefined;
  seed: number;
  now?: Date;
}) {
  const now = params.now ?? new Date();
  const lane = queueLaneForTier(params.tier);
  const etaDays = queueEtaDaysForLane({ lane, seed: params.seed });
  return {
    status: "WAITING_QUEUE" as const,
    queuedAt: now,
    queueDueAt: new Date(now.getTime() + etaDays * DAY_MS),
    queueLane: lane,
    expediteAppliedAt: null as Date | null,
  };
}

export function canReleaseWithdrawalStatus(status: string) {
  return status === "PENDING";
}

export function applyProQueueJump(params: {
  now?: Date;
  currentDueAt: Date | null | undefined;
}) {
  const now = params.now ?? new Date();
  const proDueAt = new Date(now.getTime() + DAY_MS);
  if (!params.currentDueAt) return proDueAt;
  return params.currentDueAt.getTime() < proDueAt.getTime()
    ? params.currentDueAt
    : proDueAt;
}

export function computeDisplayedQueueDays(params: {
  queueDueAt: string | Date;
  now?: Date;
  jumpApplied: boolean;
}) {
  const now = params.now ?? new Date();
  const dueAt = new Date(params.queueDueAt);
  const rawDays = Math.max(
    0,
    Math.ceil((dueAt.getTime() - now.getTime()) / DAY_MS),
  );
  if (!params.jumpApplied && rawDays === 14) {
    return 16;
  }
  if (params.jumpApplied && rawDays > 2) {
    return rawDays + 2;
  }
  return rawDays;
}
