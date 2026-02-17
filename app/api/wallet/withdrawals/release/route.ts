// app/api/wallet/withdrawals/release/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromAuthHeader } from "@/lib/auth";
import {
  buildAuditBreakdown,
  evaluateReleaseGate,
  requiredTcgForWithdrawal,
} from "@/lib/withdrawalAudit";
import {
  buildWaitingQueueSchedule,
  canReleaseWithdrawalStatus,
} from "@/lib/withdrawalQueue";
import {
  buildCollateralSnapshot,
  retryQueuedPayoutChecksForUser,
} from "@/lib/withdrawalCollateral";

export async function POST(req: Request) {
  try {
    const authUser = getUserFromAuthHeader(req.headers.get("authorization"));

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const withdrawalId = Number(body?.withdrawalId);

    const [user, wallet] = await Promise.all([
      prisma.user.findUnique({
        where: { id: authUser.userId },
        select: { id: true, tier: true },
      }),
      prisma.wallet.findUnique({
        where: { userId: authUser.userId },
      }),
    ]);

    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    if (!wallet) {
      return NextResponse.json({ error: "Wallet not found." }, { status: 404 });
    }

    const withdrawalRequest = withdrawalId
      ? await prisma.withdrawalRequest.findFirst({
          where: { id: withdrawalId, userId: authUser.userId },
        })
      : await prisma.withdrawalRequest.findFirst({
          where: { userId: authUser.userId, status: "PENDING" },
          orderBy: { createdAt: "desc" },
        });

    if (!withdrawalRequest) {
      return NextResponse.json(
        { error: "No pending withdrawal request found." },
        { status: 404 },
      );
    }

    if (withdrawalRequest.status === "WAITING_QUEUE") {
      return NextResponse.json(
        {
          ok: false,
          withdrawal: withdrawalRequest,
          message: "Withdrawal is already queued.",
        },
        { status: 409 },
      );
    }

    if (!canReleaseWithdrawalStatus(withdrawalRequest.status)) {
      return NextResponse.json(
        {
          ok: false,
          withdrawal: withdrawalRequest,
          message: `Withdrawal is ${withdrawalRequest.status} and cannot be released.`,
        },
        { status: 409 },
      );
    }

    const amountTcn = withdrawalRequest.amountTcn;
    if (!Number.isInteger(amountTcn) || amountTcn <= 0) {
      return NextResponse.json(
        { error: "Withdrawal amount is invalid." },
        { status: 400 },
      );
    }

    const latestAudit = await prisma.withdrawalAuditLog.findFirst({
      where: {
        userId: authUser.userId,
        withdrawalRequestId: withdrawalRequest.id,
      },
      orderBy: { createdAt: "desc" },
    });

    const breakdown = buildAuditBreakdown({
      tierSnapshot: user.tier || "BASIC",
      currentTcg: wallet.tcGoldBalance ?? 0,
      amountTcn,
    });

    const gate = evaluateReleaseGate({
      latestAuditResult: latestAudit?.result,
      deficitTcg: breakdown.deficitTcg,
    });
    if (!gate.allowRelease) {
      return NextResponse.json(
        {
          ok: false,
          withdrawal: withdrawalRequest,
          latestAuditResult: latestAudit?.result ?? null,
          required: breakdown.requiredTcg,
          spendable: breakdown.availableTcg,
          deficit: breakdown.deficitTcg,
          breakdown,
          message: gate.reason === "LATEST_AUDIT_NOT_PASS"
            ? "Withdrawal is blocked. Run Withdrawal Audit and ensure the latest audit result is PASS."
            : "Withdrawal cannot be released until the deficit is cleared.",
        },
        { status: 409 },
      );
    }

    const queueSchedule = buildWaitingQueueSchedule({
      tier: user.tier || "BASIC",
      seed: withdrawalRequest.id,
    });
    const collateralSnapshot = buildCollateralSnapshot({
      tier: withdrawalRequest.collateralTierSnapshot || user.tier || "BASIC",
      amountTcn,
    });

    const transition = await prisma.withdrawalRequest.updateMany({
      where: {
        id: withdrawalRequest.id,
        status: "PENDING",
      },
      data: {
        ...queueSchedule,
        collateralTierSnapshot:
          withdrawalRequest.collateralTierSnapshot ||
          collateralSnapshot.collateralTierSnapshot,
        collateralReserveFloorTcg:
          withdrawalRequest.collateralReserveFloorTcg > 0
            ? withdrawalRequest.collateralReserveFloorTcg
            : collateralSnapshot.collateralReserveFloorTcg,
        collateralRequiredTcg:
          withdrawalRequest.collateralRequiredTcg > 0
            ? withdrawalRequest.collateralRequiredTcg
            : requiredTcgForWithdrawal(amountTcn),
        holdDeficitTcg: null,
        holdReason: null,
        proUpgradeActivatedAt: null,
        proUpgradeRevertDeadlineAt: null,
        lastPayoutRetryAt: null,
      },
    });

    if (transition.count === 0) {
      const current = await prisma.withdrawalRequest.findUnique({
        where: { id: withdrawalRequest.id },
      });
      return NextResponse.json(
        {
          ok: false,
          withdrawal: current,
          message: "Withdrawal was already processed.",
        },
        { status: 409 },
      );
    }

    const updatedWithdrawal = await prisma.withdrawalRequest.findUnique({
      where: { id: withdrawalRequest.id },
    });
    await retryQueuedPayoutChecksForUser({ userId: authUser.userId });

    return NextResponse.json({
      ok: true,
      withdrawal: updatedWithdrawal,
      message: "Withdrawal released and added to waiting queue.",
    });
  } catch (err) {
    console.error("WITHDRAWAL-RELEASE ERROR:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
