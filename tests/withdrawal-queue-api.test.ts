import test from "node:test";
import assert from "node:assert/strict";
import {
  applyProQueueJump,
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
  const proDueAt = applyProQueueJump({ now, currentDueAt });
  assert.equal(proDueAt.toISOString(), "2026-02-15T00:00:00.000Z");
});
