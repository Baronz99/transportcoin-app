// app/api/wallet/withdrawals/audit/logs/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromAuthHeader } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const authUser = getUserFromAuthHeader(req.headers.get("authorization"));

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const logs = await prisma.withdrawalAuditLog.findMany({
      where: { userId: authUser.userId },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    return NextResponse.json({ logs });
  } catch (err) {
    console.error("WITHDRAWAL-AUDIT-LOGS ERROR:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
