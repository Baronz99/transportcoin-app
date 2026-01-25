// app/api/wallet/withdrawals/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromAuthHeader } from "@/lib/auth";
import { withdrawalStatusRank } from "@/lib/withdrawalStatus";

export async function GET(req: Request) {
  try {
    const authUser = getUserFromAuthHeader(req.headers.get("authorization"));

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const withdrawals = await prisma.withdrawalRequest.findMany({
      where: { userId: authUser.userId },
      orderBy: { createdAt: "desc" },
      take: 30,
    });

    const sorted = [...withdrawals].sort((a, b) => {
      const rankDiff =
        withdrawalStatusRank(a.status) - withdrawalStatusRank(b.status);
      if (rankDiff !== 0) return rankDiff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return NextResponse.json({ withdrawals: sorted });
  } catch (err) {
    console.error("WITHDRAWALS-LIST ERROR:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
