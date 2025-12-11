// app/api/wallet/withdrawals/meta/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromAuthHeader } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const authUser = getUserFromAuthHeader(authHeader);

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ✅ Ensure a PlatformConfig row exists
    let config = await prisma.platformConfig.findUnique({
      where: { id: 1 },
    });

    if (!config) {
      config = await prisma.platformConfig.create({
        data: {
          id: 1,
          withdrawalDelayDays: 3, // default SLA
        },
      });
    }

    // Count this user's pending withdrawals (or all, if you prefer)
    const pendingCount = await prisma.withdrawalRequest.count({
      where: {
        userId: authUser.userId,
        status: "PENDING",
      },
    });

    return NextResponse.json({
      // 👇 use the correct field name from the schema
      slaDays: config.withdrawalDelayDays,
      pendingCount,
    });
  } catch (err) {
    console.error("WITHDRAWALS META ERROR:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
