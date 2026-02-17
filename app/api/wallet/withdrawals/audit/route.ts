// app/api/wallet/withdrawals/audit/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromAuthHeader } from "@/lib/auth";

function requiredTcgForWithdrawal(amountTcn: number) {
  return Math.max(1, Math.ceil(amountTcn / 100));
}

function buildBreakdown(params: {
  tierSnapshot: string;
  currentTcg: number;
  amountTcn: number;
}) {
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

async function handleAudit(req: Request) {
  const authUser = getUserFromAuthHeader(req.headers.get("authorization"));

  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [user, latestPending] = await Promise.all([
    prisma.user.findUnique({
      where: { id: authUser.userId },
      select: { id: true, tier: true },
    }),
    prisma.withdrawalRequest.findMany({
      where: { userId: authUser.userId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      take: 1,
    }),
  ]);

  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const wallet = await prisma.wallet.findUnique({
    where: { userId: authUser.userId },
  });

  if (!wallet) {
    return NextResponse.json({ error: "Wallet not found." }, { status: 404 });
  }

  const withdrawalRequest = latestPending[0] ?? null;

  if (!withdrawalRequest) {
    return NextResponse.json({
      withdrawal: null,
      audit: null,
      breakdown: null,
      message: "No pending withdrawal request found.",
    });
  }

  const amountTcn = withdrawalRequest.amountTcn;
  if (!Number.isInteger(amountTcn) || amountTcn <= 0) {
    return NextResponse.json(
      {
        withdrawal: {
          id: withdrawalRequest.id,
          amountTcn: withdrawalRequest.amountTcn,
          asset: withdrawalRequest.asset,
          network: withdrawalRequest.network,
          address: withdrawalRequest.address,
          status: withdrawalRequest.status,
          createdAt: withdrawalRequest.createdAt,
        },
        audit: null,
        breakdown: null,
        message: "Withdrawal amount is invalid.",
      },
      { status: 400 },
    );
  }

  const breakdown = buildBreakdown({
    tierSnapshot: user.tier || "BASIC",
    currentTcg: wallet.tcGoldBalance ?? 0,
    amountTcn,
  });
  const result = breakdown.deficitTcg === 0 ? "PASS" : "FAIL";

  const audit = await prisma.withdrawalAuditLog.create({
    data: {
      userId: authUser.userId,
      withdrawalRequestId: withdrawalRequest.id,
      amountTcnSnapshot: amountTcn,
      tierSnapshot: breakdown.tierSnapshot,
      reserveFloorTcg: breakdown.reserveFloorTcg,
      currentTcg: breakdown.currentTcg,
      availableTcg: breakdown.availableTcg,
      requiredTcg: breakdown.requiredTcg,
      deficitTcg: breakdown.deficitTcg,
      result,
    },
  });

  return NextResponse.json({
    withdrawal: {
      id: withdrawalRequest.id,
      amountTcn: withdrawalRequest.amountTcn,
      asset: withdrawalRequest.asset,
      network: withdrawalRequest.network,
      address: withdrawalRequest.address,
      status: withdrawalRequest.status,
      createdAt: withdrawalRequest.createdAt,
    },
    audit,
    breakdown,
    message: "Audit completed.",
  });
}

export async function POST(req: Request) {
  try {
    return await handleAudit(req);
  } catch (err) {
    console.error("WITHDRAWAL-AUDIT ERROR:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    return await handleAudit(req);
  } catch (err) {
    console.error("WITHDRAWAL-AUDIT ERROR:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
