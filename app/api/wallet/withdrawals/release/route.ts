// app/api/wallet/withdrawals/release/route.ts
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
          where: { id: withdrawalId, userId: authUser.userId, status: "PENDING" },
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

    const amountTcn = withdrawalRequest.amountTcn;
    if (!Number.isInteger(amountTcn) || amountTcn <= 0) {
      return NextResponse.json(
        { error: "Withdrawal amount is invalid." },
        { status: 400 },
      );
    }

    const breakdown = buildBreakdown({
      tierSnapshot: user.tier || "BASIC",
      currentTcg: wallet.tcGoldBalance ?? 0,
      amountTcn,
    });

    if (breakdown.deficitTcg > 0) {
      return NextResponse.json(
        {
          ok: false,
          withdrawal: withdrawalRequest,
          breakdown,
          message: "Withdrawal cannot be released until the deficit is cleared.",
        },
        { status: 409 },
      );
    }

    const updatedWithdrawal = await prisma.withdrawalRequest.update({
      where: { id: withdrawalRequest.id },
      data: { status: "READY_FOR_PAYOUT" },
    });

    return NextResponse.json({
      ok: true,
      withdrawal: updatedWithdrawal,
      message: "Withdrawal released for payout.",
    });
  } catch (err) {
    console.error("WITHDRAWAL-RELEASE ERROR:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
