// components/WithdrawalPreflightModal.tsx
"use client";

import { withdrawalStatusChipClasses, withdrawalStatusLabel } from "@/lib/withdrawalStatus";

type Withdrawal = {
  id: number;
  amountTcn: number;
  asset: string;
  network: string;
  address?: string | null;
  status: string;
  createdAt: string;
  queuedAt?: string | null;
  queueDueAt?: string | null;
  queueLane?: string | null;
  expediteAppliedAt?: string | null;
  holdDeficitTcg?: number | null;
  holdReason?: string | null;
  collateralTierSnapshot?: string | null;
  collateralReserveFloorTcg?: number | null;
  collateralRequiredTcg?: number | null;
  proUpgradeActivatedAt?: string | null;
  proUpgradeRevertDeadlineAt?: string | null;
  lastPayoutRetryAt?: string | null;
  estimatedMinMinutes?: number | null;
  estimatedMaxMinutes?: number | null;
  estimatedLabel?: string | null;
};

type WithdrawalAuditStatus = "PASS" | "FAIL";

type WithdrawalAudit = {
  id: number;
  withdrawalRequestId: number | null;
  amountTcnSnapshot: number;
  tierSnapshot: string;
  reserveFloorTcg: number;
  requiredTcg: number;
  currentTcg: number;
  availableTcg: number;
  deficitTcg: number;
  result: WithdrawalAuditStatus;
  createdAt: string;
};

type AuditBreakdown = {
  tierSnapshot: string;
  reserveFloorTcg: number;
  currentTcg: number;
  availableTcg: number;
  requiredTcg: number;
  deficitTcg: number;
  rulesText: string;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  withdrawal: Withdrawal | null;
  audit: WithdrawalAudit | null;
  breakdown: AuditBreakdown | null;
  logs: WithdrawalAudit[];
  auditLoading: boolean;
  releaseLoading: boolean;
  gateState: "idle" | "running_audit" | "failed" | "passed";
  allowRelease: boolean;
  onRunAudit: () => void;
  onRelease: () => void;
  onUpgradeToPro?: () => void;
  onRevertToBasic?: () => void;
  upgradeLoading?: boolean;
  upgradeError?: string | null;
  revertLoading?: boolean;
  revertError?: string | null;
  revertMessage?: string | null;
  message: string | null;
  error: string | null;
  releaseMessage: string | null;
  releaseError: string | null;
  displayedQueueDays?: number | null;
};

export default function WithdrawalPreflightModal({
  isOpen,
  onClose,
  withdrawal,
  audit,
  breakdown,
  logs,
  auditLoading,
  releaseLoading,
  gateState,
  allowRelease,
  onRunAudit,
  onRelease,
  onUpgradeToPro,
  onRevertToBasic,
  upgradeLoading,
  upgradeError,
  revertLoading,
  revertError,
  revertMessage,
  message,
  error,
  releaseMessage,
  releaseError,
  displayedQueueDays,
}: Props) {
  if (!isOpen) return null;

  const computeSpendable = (log: WithdrawalAudit) => {
    if (Number.isFinite(log.availableTcg)) return log.availableTcg;
    if (Number.isFinite(log.reserveFloorTcg)) {
      return Math.max(0, log.currentTcg - log.reserveFloorTcg);
    }
    return log.currentTcg;
  };

  const spendable = breakdown
    ? Math.max(0, breakdown.availableTcg)
    : audit
      ? computeSpendable(audit)
      : null;

  const isQueued = withdrawal?.status === "WAITING_QUEUE";
  const isHold = withdrawal?.status === "ON_HOLD_COLLATERAL";
  const isReadyForPayout = withdrawal?.status === "READY_FOR_PAYOUT";
  const showUpgradeCta = isQueued && withdrawal?.queueLane !== "PRO";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8">
      <div className="w-full max-w-3xl rounded-3xl border border-slate-800 bg-slate-950 text-slate-100 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
              Withdrawal Pre-Flight Check
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Review your latest pending withdrawal before release.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full border border-slate-700 px-3 py-1 text-[11px] text-slate-300 hover:bg-slate-800"
          >
            Close
          </button>
        </div>

        <div className="space-y-4 px-6 py-5 text-xs">
          {withdrawal ? (
            <div className="rounded-2xl border border-slate-800 bg-black/50 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[11px] text-slate-400">
                    Your Withdrawal Goal
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-100">
                    {withdrawal.amountTcn.toLocaleString()} TCN - {" "}
                    {withdrawal.asset}/{withdrawal.network}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] ${withdrawalStatusChipClasses(
                    withdrawal.status,
                  )}`}
                >
                  {withdrawalStatusLabel(withdrawal.status)}
                </span>
              </div>
              <p className="mt-2 text-[11px] text-slate-500">
                Requested at {new Date(withdrawal.createdAt).toLocaleString()}
              </p>
              {withdrawal.address && (
                <p className="mt-1 text-[11px] text-slate-500">
                  Destination: {withdrawal.address}
                </p>
              )}
              <p className="mt-1 text-[11px] text-slate-400">
                Goal: Maintain {breakdown?.reserveFloorTcg ?? 800} TCG reserve +
                hold 1% of the withdrawal in spendable TCG.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-800 bg-black/40 px-4 py-3 text-[11px] text-slate-400">
              No pending withdrawal detected.
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={onRunAudit}
              disabled={!withdrawal || isQueued || isHold || isReadyForPayout || auditLoading}
              className="rounded-full border border-gold px-4 py-2 text-[11px] font-semibold text-gold hover:bg-gold/10 disabled:opacity-60"
            >
              {auditLoading ? "Running..." : "Run Withdrawal Audit"}
            </button>
            <button
              onClick={onRelease}
              disabled={
                !withdrawal ||
                isQueued ||
                isHold ||
                isReadyForPayout ||
                releaseLoading ||
                !allowRelease
              }
              className="rounded-full bg-gold px-4 py-2 text-[11px] font-semibold text-black hover:bg-gold/90 disabled:opacity-50"
            >
              {releaseLoading ? "Releasing..." : "Release Withdrawal"}
            </button>
            <p className="text-[11px] text-slate-500">
              Release sends successful requests into waiting queue.
            </p>
          </div>

          {(isQueued || isHold || isReadyForPayout) && (
            <div className="rounded-2xl border border-emerald-800 bg-emerald-950/30 px-4 py-3 text-[11px] text-emerald-200">
              <p className="text-xs font-semibold text-emerald-100">
                {isHold
                  ? "Payout paused: collateral checkpoint failed"
                  : isReadyForPayout
                    ? "Ready for payout dispatch"
                    : "Success: queued for payout lane"}
              </p>
              <p className="mt-1">
                Lane: {withdrawal?.queueLane || "BASIC"} · ETA{" "}
                {withdrawal.queueLane === "PRO"
                  ? withdrawal.estimatedLabel || "5 to 30 minutes"
                  : `${displayedQueueDays ?? "—"} day${displayedQueueDays === 1 ? "" : "s"}`}
              </p>
              <p className="mt-1 text-emerald-300/90">
                Queued at{" "}
                {withdrawal.queuedAt
                  ? new Date(withdrawal.queuedAt).toLocaleString()
                  : "—"}
              </p>
              {isHold && (
                <div className="mt-2 rounded-xl border border-amber-700/60 bg-black/30 px-3 py-2 text-[11px] text-amber-100">
                  <p className="font-semibold">
                    Deficit: {(withdrawal.holdDeficitTcg ?? 0).toLocaleString()} TCG
                  </p>
                  <p className="mt-1 text-[10px] text-amber-200/90">
                    {withdrawal.holdReason ||
                      "Retry checks run every 10 minutes and release automatically once deficit is cleared."}
                  </p>
                  {withdrawal.proUpgradeRevertDeadlineAt && (
                    <p className="mt-1 text-[10px] text-amber-200/90">
                      Revert window ends:{" "}
                      {new Date(withdrawal.proUpgradeRevertDeadlineAt).toLocaleString()}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button
                      onClick={onRevertToBasic}
                      disabled={!onRevertToBasic || revertLoading}
                      className="rounded-full border border-amber-300 px-3 py-1.5 text-[10px] font-semibold text-amber-100 hover:bg-amber-300/10 disabled:opacity-60"
                    >
                      {revertLoading ? "Reverting..." : "Revert to BASIC + Refund 1000 TCG"}
                    </button>
                    <span className="text-[10px] text-slate-300">
                      Keep PRO by topping up deficit.
                    </span>
                  </div>
                  {revertError && (
                    <p className="mt-2 text-rose-300">{revertError}</p>
                  )}
                  {revertMessage && !revertError && (
                    <p className="mt-2 text-emerald-300">{revertMessage}</p>
                  )}
                </div>
              )}
              {(isHold || isReadyForPayout) && (
                <div className="mt-3 rounded-xl border border-slate-700 bg-black/40 px-3 py-2 text-[10px] text-slate-200">
                  <p className="font-semibold text-slate-100">Ops Timeline</p>
                  <p className="mt-1">
                    1) Queue slot assigned for{" "}
                    {withdrawal.amountTcn.toLocaleString()} TCN to{" "}
                    {withdrawal.address || "destination wallet"}.
                  </p>
                  <p>2) PRO lane acceleration engaged.</p>
                  <p>
                    3) Collateral checkpoint{" "}
                    {isHold ? "paused payout" : "passed; payout unlocked"}.
                  </p>
                  <p>4) System retries payout checks every 10 minutes.</p>
                </div>
              )}
              {showUpgradeCta && (
                <div className="mt-2 rounded-xl border border-gold/40 bg-black/30 px-3 py-2 text-[11px] text-gold">
                  <p className="font-semibold">Jump Queue · Upgrade to PRO</p>
                  <p className="mt-1 text-[10px] text-slate-300">
                    Cost: 1000 TCGold · Estimated completion: 5 to 30 minutes.
                  </p>
                  <button
                    onClick={onUpgradeToPro}
                    disabled={!onUpgradeToPro || upgradeLoading}
                    className="mt-2 rounded-full border border-gold px-3 py-1.5 text-[10px] font-semibold text-gold hover:bg-gold/10 disabled:opacity-60"
                  >
                    {upgradeLoading ? "Upgrading..." : "Upgrade to PRO"}
                  </button>
                  {upgradeError && (
                    <p className="mt-2 text-rose-300">{upgradeError}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {!audit && withdrawal && !isQueued && (
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-[11px] text-slate-300">
              Run audit to check requirements and unlock Release.
            </div>
          )}

          <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-[11px] text-slate-300">
            Gate status:{" "}
            <span className="font-semibold">
              {(isQueued || isReadyForPayout) && "Queued (release completed)"}
              {isHold && "On hold (collateral deficit)"}
              {!isQueued && !isHold && !isReadyForPayout && gateState === "idle" && "Idle (run audit)"}
              {!isQueued && !isHold && !isReadyForPayout && gateState === "running_audit" && "Running audit..."}
              {!isQueued && !isHold && !isReadyForPayout && gateState === "failed" && "Failed (latest audit is not PASS)"}
              {!isQueued && !isHold && !isReadyForPayout && gateState === "passed" && "Passed (release unlocked)"}
            </span>
          </div>

          {error && (
            <div className="rounded-xl border border-rose-800 bg-rose-950/50 px-3 py-2 text-[11px] text-rose-200">
              {error}
            </div>
          )}

          {message && !error && (
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-[11px] text-slate-300">
              {message}
            </div>
          )}

          {releaseError && (
            <div className="rounded-xl border border-rose-800 bg-rose-950/50 px-3 py-2 text-[11px] text-rose-200">
              {releaseError}
            </div>
          )}

          {releaseMessage && !releaseError && (
            <div className="rounded-xl border border-emerald-800 bg-emerald-950/40 px-3 py-2 text-[11px] text-emerald-200">
              {releaseMessage}
            </div>
          )}

          {audit && breakdown && !isQueued && (
            <>
              <div className="rounded-2xl border border-slate-800 bg-black/50 px-4 py-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-slate-400">
                    Your TCG Balances
                  </p>
                  <span className="text-[10px] text-slate-500">
                    {breakdown.tierSnapshot}
                  </span>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
                      Locked (Reserve)
                    </p>
                    <p className="mt-1 text-sm text-slate-200">
                      {breakdown.reserveFloorTcg.toLocaleString()} TCG
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
                      Spendable
                    </p>
                    <p className="mt-1 text-sm text-gold">
                      {spendable?.toLocaleString()} TCG
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
                      Total
                    </p>
                    <p className="mt-1 text-sm text-slate-200">
                      {breakdown.currentTcg.toLocaleString()} TCG
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-black/50 px-4 py-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-slate-400">
                    Withdrawal Hold Requirement
                  </p>
                  <span
                    className={
                      audit.result === "PASS"
                        ? "rounded-full bg-emerald-900/50 px-2 py-0.5 text-[10px] text-emerald-200"
                        : "rounded-full bg-rose-900/50 px-2 py-0.5 text-[10px] text-rose-200"
                    }
                  >
                    {audit.result}
                  </span>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
                      Required TCG (1%)
                    </p>
                    <p className="mt-1 text-sm text-gold">
                      {breakdown.requiredTcg.toLocaleString()} TCG
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
                      Deficit
                    </p>
                    <p className="mt-1 text-sm text-amber-200">
                      {breakdown.deficitTcg.toLocaleString()} TCG
                    </p>
                  </div>
                </div>
                {audit.result === "FAIL" ? (
                  <p className="mt-2 text-[11px] text-amber-200">
                    Top up {breakdown.deficitTcg.toLocaleString()} TCG to
                    release immediately.
                  </p>
                ) : (
                  <p className="mt-2 text-[11px] text-emerald-200">
                    You meet requirements. You can release payout now.
                  </p>
                )}
                <p className="mt-2 text-[10px] text-slate-500">
                  {new Date(audit.createdAt).toLocaleString()}
                </p>
              </div>
            </>
          )}

          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
              Last 5 Audit Logs
            </p>
            {logs.length === 0 ? (
              <p className="mt-2 text-[11px] text-slate-500">
                No audit logs yet. Run an audit to generate logs.
              </p>
            ) : (
              <div className="mt-3 max-h-[220px] overflow-auto rounded-2xl border border-slate-900">
                <table className="min-w-full text-left text-[11px]">
                  <thead className="bg-slate-900/90 text-[10px] uppercase tracking-[0.14em] text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Result</th>
                      <th className="px-3 py-2">Spendable</th>
                      <th className="px-3 py-2">Required</th>
                      <th className="px-3 py-2">Deficit</th>
                      <th className="px-3 py-2">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr
                        key={log.id}
                        className="border-t border-slate-900 hover:bg-slate-900/60"
                      >
                        <td className="px-3 py-2">
                          <span
                            className={
                              log.result === "PASS"
                                ? "rounded-full bg-emerald-900/50 px-2 py-0.5 text-emerald-200"
                                : "rounded-full bg-rose-900/50 px-2 py-0.5 text-rose-200"
                            }
                          >
                            {log.result}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          {computeSpendable(log).toLocaleString()} TCG
                        </td>
                        <td className="px-3 py-2">
                          {log.requiredTcg.toLocaleString()} TCG
                        </td>
                        <td className="px-3 py-2">
                          {log.deficitTcg.toLocaleString()} TCG
                        </td>
                        <td className="px-3 py-2 text-[10px] text-slate-500">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

