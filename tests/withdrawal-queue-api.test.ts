import test from "node:test";
import assert from "node:assert/strict";
import {
  applyProQueueJump,
  buildProQueueDueAt,
  computeProQueueMinutes,
  buildWaitingQueueSchedule,
  canReleaseWithdrawalStatus,
} from "../lib/withdrawalQueue.ts";

test("release transitions to WAITING_QUEUE with deterministic queue fields", () => {
  const now = new Date("2026-02-14T00:00:00.000Z");
  const update = buildWaitingQueueSchedule({
    tier: "BASIC",
    seed: 7,
    now,
  });

  assert.equal(update.status, "WAITING_QUEUE");
  assert.equal(update.queueLane, "BASIC");
  assert.equal(update.queuedAt.toISOString(), now.toISOString());
  const etaDays = Math.ceil(
    (update.queueDueAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
  );
  assert.equal(etaDays, 16);
});

test("cannot release again if already queued", () => {
  assert.equal(canReleaseWithdrawalStatus("WAITING_QUEUE"), false);
  assert.equal(canReleaseWithdrawalStatus("PENDING"), true);
});

test("upgrade to PRO lane reduces remaining due date", () => {
  const now = new Date("2026-02-14T00:00:00.000Z");
  const currentDueAt = new Date("2026-02-28T00:00:00.000Z");
  const proDueAt = applyProQueueJump({ now, currentDueAt, seed: 0 });
  assert.equal(proDueAt.toISOString(), "2026-02-14T00:05:00.000Z");
});

test("computeProQueueMinutes returns 5..30 inclusive from seed", () => {
  assert.equal(computeProQueueMinutes(0), 5);
  assert.equal(computeProQueueMinutes(25), 30);
  assert.equal(computeProQueueMinutes(26), 5);
});

test("PRO queue due date is between 5 and 30 minutes", () => {
  const now = new Date("2026-02-14T00:00:00.000Z");
  const minDueAt = buildProQueueDueAt({ now, seed: 0 });
  const maxDueAt = buildProQueueDueAt({ now, seed: 25 });

  assert.equal(minDueAt.toISOString(), "2026-02-14T00:05:00.000Z");
  assert.equal(maxDueAt.toISOString(), "2026-02-14T00:30:00.000Z");
});

test("release schedule for PRO uses minute-based lane", () => {
  const now = new Date("2026-02-14T00:00:00.000Z");
  const update = buildWaitingQueueSchedule({
    tier: "PRO",
    seed: 12,
    now,
  });

  assert.equal(update.queueLane, "PRO");
  assert.equal(update.queueDueAt.toISOString(), "2026-02-14T00:17:00.000Z");
});
