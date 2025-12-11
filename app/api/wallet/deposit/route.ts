// app/api/wallet/deposit/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromAuthHeader } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const authUser = getUserFromAuthHeader(authHeader);

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { amount, description } = body;

    const value = Number(amount);
    if (!value || value <= 0 || !Number.isInteger(value)) {
      return NextResponse.json(
        { error: "Amount must be a positive integer TCN value." },
        { status: 400 },
      );
    }

    // Load user + wallet
    const user = await prisma.user.findUnique({
      where: { id: authUser.userId },
      include: { wallet: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    let wallet = user.wallet;
    if (!wallet) {
      wallet = await prisma.wallet.create({
        data: {
          userId: user.id,
          balance: 0,
          tcGoldBalance: 0,
          usableUsdCents: 0,
        },
      });
    }

    // Do everything in a transaction for safety
    const result = await prisma.$transaction(async (tx) => {
      // 1) Update wallet balance
      const updatedWallet = await tx.wallet.update({
        where: { id: wallet!.id },
        data: {
          balance: {
            increment: value,
          },
        },
      });

      // 2) Create linked transaction (NOTE: walletId included)
      const txRecord = await tx.transaction.create({
        data: {
          userId: user.id,
          walletId: updatedWallet.id,
          amount: value,
          type: "DEPOSIT",
          status: "SUCCESS",
          description:
            description ||
            "Manual Transportcoin deposit into TCN balance (internal).",
        },
      });

      return { updatedWallet, txRecord };
    });

    return NextResponse.json({
      wallet: {
        balance: result.updatedWallet.balance,
        tcGoldBalance: result.updatedWallet.tcGoldBalance,
        usableUsdCents: result.updatedWallet.usableUsdCents,
      },
      transaction: result.txRecord,
    });
  } catch (err) {
    console.error("DEPOSIT ERROR:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
