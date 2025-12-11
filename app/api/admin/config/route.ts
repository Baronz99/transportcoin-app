// app/api/admin/config/route.ts

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

    const admin = await prisma.user.findUnique({
      where: { id: authUser.userId },
      select: { id: true, isAdmin: true },
    });

    if (!admin || !admin.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let config = await prisma.platformConfig.findUnique({
      where: { id: 1 },
    });

    if (!config) {
      config = await prisma.platformConfig.create({
        data: {
          id: 1,
          withdrawalDelayDays: 3,
        },
      });
    }

    return NextResponse.json({
      config: {
        id: config.id,
        withdrawalDelayDays: config.withdrawalDelayDays,
        btcDepositAddress: config.btcDepositAddress ?? "",
        createdAt: config.createdAt,
        updatedAt: config.updatedAt,
      },
    });
  } catch (err) {
    console.error("ADMIN CONFIG GET ERROR:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const authUser = getUserFromAuthHeader(authHeader);

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = await prisma.user.findUnique({
      where: { id: authUser.userId },
      select: { id: true, isAdmin: true },
    });

    if (!admin || !admin.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { withdrawalDelayDays, btcDepositAddress } = body as {
      withdrawalDelayDays?: number;
      btcDepositAddress?: string;
    };

    const updateData: any = {};
    if (
      typeof withdrawalDelayDays === "number" &&
      Number.isInteger(withdrawalDelayDays) &&
      withdrawalDelayDays > 0
    ) {
      updateData.withdrawalDelayDays = withdrawalDelayDays;
    }
    if (typeof btcDepositAddress === "string") {
      updateData.btcDepositAddress = btcDepositAddress.trim();
    }

    const config = await prisma.platformConfig.upsert({
      where: { id: 1 },
      update: updateData,
      create: {
        id: 1,
        withdrawalDelayDays: withdrawalDelayDays && withdrawalDelayDays > 0
          ? withdrawalDelayDays
          : 3,
        btcDepositAddress:
          typeof btcDepositAddress === "string"
            ? btcDepositAddress.trim()
            : null,
      },
    });

    return NextResponse.json({
      config: {
        id: config.id,
        withdrawalDelayDays: config.withdrawalDelayDays,
        btcDepositAddress: config.btcDepositAddress ?? "",
        createdAt: config.createdAt,
        updatedAt: config.updatedAt,
      },
    });
  } catch (err) {
    console.error("ADMIN CONFIG POST ERROR:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
