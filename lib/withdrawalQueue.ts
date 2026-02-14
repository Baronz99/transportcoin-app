const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

export const PRO_QUEUE_MIN_MINUTES = 5;
export const PRO_QUEUE_MAX_MINUTES = 30;

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
  if (params.lane === "PRO") return basicQueueEtaDays(params.seed);
  return basicQueueEtaDays(params.seed);
}

export function computeProQueueMinutes(seed: number) {
  const normalized = Number.isInteger(seed) ? Math.abs(seed) : 0;
  const span = PRO_QUEUE_MAX_MINUTES - PRO_QUEUE_MIN_MINUTES + 1;
  return PRO_QUEUE_MIN_MINUTES + (normalized % span);
}

export function buildProQueueDueAt(params: {
  now?: Date;
  seed: number;
}) {
  const now = params.now ?? new Date();
  const minutes = computeProQueueMinutes(params.seed);
  return new Date(now.getTime() + minutes * MINUTE_MS);
}

export function buildWaitingQueueSchedule(params: {
  tier: string | null | undefined;
  seed: number;
  now?: Date;
}) {
  const now = params.now ?? new Date();
  const lane = queueLaneForTier(params.tier);
  const etaDays = queueEtaDaysForLane({ lane, seed: params.seed });
  const queueDueAt = lane === "PRO"
    ? buildProQueueDueAt({ now, seed: params.seed })
    : new Date(now.getTime() + etaDays * DAY_MS);
  return {
    status: "WAITING_QUEUE" as const,
    queuedAt: now,
    queueDueAt,
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
  seed: number;
}) {
  const now = params.now ?? new Date();
  const proDueAt = buildProQueueDueAt({
    now,
    seed: params.seed,
  });
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
