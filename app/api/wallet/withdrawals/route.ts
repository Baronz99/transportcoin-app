// app/api/wallet/withdrawals/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromAuthHeader } from "@/lib/auth";

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

    return NextResponse.json({ withdrawals });
  } catch (err) {
    console.error("WITHDRAWALS-LIST ERROR:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
