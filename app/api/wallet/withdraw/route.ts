// app/api/wallet/withdraw/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromAuthHeader } from "@/lib/auth";

// Minimum TCGold required to perform a withdrawal
const MIN_TCG_FOR_WITHDRAW = 1;

export async function POST(req: Request) {
  try {
    const authUser = getUserFromAuthHeader(req.headers.get("authorization"));

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: unknown = await req.json();

    // Safe parse
    const {
      amount,
      asset,
      network,
      address,
      description,
    } = (body ?? {}) as {
      amount?: number | string;
      asset?: string;
      network?: string;
      address?: string;
      description?: string;
    };

    const value = Number(amount);

    if (!Number.isInteger(value) || value <= 0) {
      return NextResponse.json(
        { error: "Amount must be a positive integer TCN value." },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: authUser.userId },
      include: { wallet: true },
    });

    if (!user || !user.wallet) {
      return NextResponse.json(
        { error: "Wallet not found for this user." },
        { status: 404 },
      );
    }

    const wallet = user.wallet;

    // Enforce TCGold requirement for withdrawals
    if (wallet.tcGoldBalance < MIN_TCG_FOR_WITHDRAW) {
      return NextResponse.json(
        {
          error:
            "Insufficient TCGold. You need at least 1 TCGold token to request a withdrawal.",
        },
        { status: 400 },
      );
    }

    if (wallet.balance < value) {
      return NextResponse.json(
        { error: "Insufficient TCN balance." },
        { status: 400 },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1) Decrement wallet balance
      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: { decrement: value },
        },
      });

      // 2) Create withdrawal request
      const withdrawal = await tx.withdrawalRequest.create({
        data: {
          userId: user.id,
          asset: asset ?? "TCN_INTERNAL",
          network: network ?? "INTERNAL",
          address: address ?? "INTERNAL_LEDGER",
          amountTcn: value,
          status: "PENDING",
        },
      });

      // 3) Log transaction
      const txRecord = await tx.transaction.create({
        data: {
          userId: user.id,
          walletId: updatedWallet.id,
          amount: value,
          type: "WITHDRAWAL_REQUEST",
          status: "PENDING",
          description:
            description ??
            "Withdrawal request created, pending manual Transportcoin review.",
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
    console.error("WITHDRAW ERROR:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
