// app/api/wallet/withdraw-crypto/route.ts

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
    const { amount, asset, network, address } = body;

    const amountInt = Number(amount);
    if (!amountInt || amountInt <= 0 || !Number.isInteger(amountInt)) {
      return NextResponse.json(
        { error: "Amount must be a positive integer TCN value." },
        { status: 400 }
      );
    }

    // Load user and wallet
    const user = await prisma.user.findUnique({
      where: { id: authUser.userId },
      include: { wallet: true },
    });

    if (!user || !user.wallet) {
      return NextResponse.json(
        { error: "Wallet not found for this user." },
        { status: 404 }
      );
    }

    const wallet = user.wallet;

    if (wallet.balance < amountInt) {
      return NextResponse.json(
        { error: "Insufficient TCN balance." },
        { status: 400 }
      );
    }

    // Database transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Update wallet balance
      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: { decrement: amountInt },
        },
      });

      // 2. Create withdrawal request
      const withdrawal = await tx.withdrawalRequest.create({
        data: {
          userId: user.id,
          asset,
          network,
          address,
          amountTcn: amountInt,
          status: "PENDING",
        },
      });

      // 3. Create transaction with REQUIRED walletId
      const txRecord = await tx.transaction.create({
        data: {
          userId: user.id,
          walletId: wallet.id,              // <-- REQUIRED FIX
          amount: amountInt,
          type: "WITHDRAW_CRYPTO_REQUEST",
          status: "PENDING",
          description: `Withdraw ${amountInt} TCN as ${asset} on ${network}`,
        },
      });

      return { updatedWallet, withdrawal, txRecord };
    });

    return NextResponse.json({
      wallet: {
        balance: result.updatedWallet.balance,
        tcGoldBalance: result.updatedWallet.tcGoldBalance,
        usableUsdCents: result.updatedWallet.usableUsdCents,
      },
      withdrawal: result.withdrawal,
      transaction: result.txRecord,
    });
  } catch (err) {
    console.error("WITHDRAW-CRYPTO ERROR:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
