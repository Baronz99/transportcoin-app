export type WithdrawalAuditResult = "PASS" | "FAIL";

export type AuditBreakdown = {
  tierSnapshot: string;
  reserveFloorTcg: number;
  currentTcg: number;
  availableTcg: number;
  requiredTcg: number;
  deficitTcg: number;
  rulesText: string;
};

export function requiredTcgForWithdrawal(amountTcn: number) {
  return Math.max(1, Math.ceil(amountTcn / 100));
}

export function buildAuditBreakdown(params: {
  tierSnapshot: string;
  currentTcg: number;
  amountTcn: number;
}): AuditBreakdown {
  const tierSnapshot = params.tierSnapshot || "BASIC";
  const reserveFloorTcg = tierSnapshot === "BASIC" ? 800 : 0;
  const currentTcg = params.currentTcg;
  const availableTcg = Math.max(0, currentTcg - reserveFloorTcg);
  const requiredTcg = requiredTcgForWithdrawal(params.amountTcn);
  const deficitTcg = Math.max(0, requiredTcg - availableTcg);
  const rulesText =
    reserveFloorTcg > 0
      ? "BASIC accounts keep an 800 TCG reserve; 1% hold uses available TCG only."
      : "1% hold uses available TCG only.";

  return {
    tierSnapshot,
    reserveFloorTcg,
    currentTcg,
    availableTcg,
    requiredTcg,
    deficitTcg,
    rulesText,
  };
}

export function canReleaseFromLatestAudit(
  latestAuditResult: WithdrawalAuditResult | null | undefined,
) {
  return latestAuditResult === "PASS";
}

export function evaluateReleaseGate(params: {
  latestAuditResult: WithdrawalAuditResult | null | undefined;
  deficitTcg: number;
}) {
  if (!canReleaseFromLatestAudit(params.latestAuditResult)) {
    return { allowRelease: false, reason: "LATEST_AUDIT_NOT_PASS" as const };
  }
  if (params.deficitTcg > 0) {
    return { allowRelease: false, reason: "DEFICIT" as const };
  }
  return { allowRelease: true, reason: null };
}
