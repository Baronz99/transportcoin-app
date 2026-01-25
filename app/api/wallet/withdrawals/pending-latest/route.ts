// app/api/wallet/withdrawals/pending-latest/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromAuthHeader } from "@/lib/auth";

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

    const withdrawal = latestPending[0] ?? null;

    if (!withdrawal) {
      return NextResponse.json({ withdrawal: null });
    }

    return NextResponse.json({
      withdrawal: {
        id: withdrawal.id,
        amountTcn: withdrawal.amountTcn,
        asset: withdrawal.asset,
        network: withdrawal.network,
        status: withdrawal.status,
        createdAt: withdrawal.createdAt,
      },
    });
  } catch (err) {
    console.error("WITHDRAWAL-PENDING-LATEST ERROR:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
