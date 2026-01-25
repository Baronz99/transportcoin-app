// app/api/wallet/withdrawals/audit/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromAuthHeader } from "@/lib/auth";

function requiredTcgForWithdrawal(amountTcn: number) {
  return Math.max(1, Math.ceil(amountTcn / 100));
}

export async function GET(req: Request) {
  try {
    const authUser = getUserFromAuthHeader(req.headers.get("authorization"));

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const latestPending = await prisma.withdrawalRequest.findMany({
      where: { userId: authUser.userId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      take: 1,
    });

    const withdrawalRequest = latestPending[0] ?? null;

    const wallet = await prisma.wallet.findUnique({
      where: { userId: authUser.userId },
    });

    if (!wallet) {
      return NextResponse.json({ error: "Wallet not found." }, { status: 404 });
    }

    if (!withdrawalRequest) {
      return NextResponse.json({
        withdrawal: null,
        audit: null,
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
            status: withdrawalRequest.status,
            createdAt: withdrawalRequest.createdAt,
          },
          audit: null,
          message: "Withdrawal amount is invalid.",
        },
        { status: 400 },
      );
    }
    const requiredTcg = requiredTcgForWithdrawal(amountTcn);
    const currentTcg = wallet.tcGoldBalance ?? 0;
    const deficitTcg = Math.max(0, requiredTcg - currentTcg);
    const result = deficitTcg === 0 ? "PASS" : "FAIL";

    const audit = await prisma.withdrawalAuditLog.create({
      data: {
        userId: authUser.userId,
        withdrawalRequestId: withdrawalRequest.id,
        amountTcnSnapshot: amountTcn,
        requiredTcg,
        currentTcg,
        deficitTcg,
        result,
      },
    });

    return NextResponse.json({
      withdrawal: {
        id: withdrawalRequest.id,
        amountTcn: withdrawalRequest.amountTcn,
        asset: withdrawalRequest.asset,
        network: withdrawalRequest.network,
        status: withdrawalRequest.status,
        createdAt: withdrawalRequest.createdAt,
      },
      audit,
      message: "Audit completed.",
    });
  } catch (err) {
    console.error("WITHDRAWAL-AUDIT ERROR:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
