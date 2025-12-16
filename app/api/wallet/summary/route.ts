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

    // Make sure the user exists
    const user = await prisma.user.findUnique({
      where: { id: authUser.userId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 401 });
    }

    // Ensure a wallet exists for this user
    const wallet = await prisma.wallet.upsert({
      where: { userId: authUser.userId },
      update: {},
      create: {
        userId: authUser.userId,
        balance: 0,
        tcGoldBalance: 0,
      },
    });

    // Get latest transactions for this user (include adminNote)
    const transactions = await prisma.transaction.findMany({
      where: { userId: authUser.userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        amount: true,
        type: true,
        status: true,
        description: true,
        adminNote: true, // ✅ IMPORTANT
        createdAt: true,
      },
    });

    return NextResponse.json({
      wallet,
      transactions,
    });
  } catch (err) {
    console.error("WALLET SUMMARY ERROR:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
