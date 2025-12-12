// app/api/wallet/withdraw/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromAuthHeader } from "@/lib/auth";

function requiredTcgForWithdrawal(amountTcn: number) {
  return Math.max(1, Math.ceil(amountTcn / 100)); // 1% of TCN amount
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const authUser = getUserFromAuthHeader(authHeader);

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { amount, asset, network, address, description } = body as {
      amount?: number | string;
      asset?: string;
      network?: string;
      address?: string;
      description?: string;
    };

    const value = Number(amount);
    if (!value || value <= 0 || !Number.isInteger(value)) {
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
      return NextResponse.json({ error: "Wallet not found." }, { status: 404 });
    }

    const wallet = user.wallet;

    // HOLD requirement
    const requiredTcg = requiredTcgForWithdrawal(value);
    const currentTcg = wallet.tcGoldBalance ?? 0;

    if (currentTcg < requiredTcg) {
      return NextResponse.json(
        {
          code: "INSUFFICIENT_TCGOLD",
          error: `Insufficient TCGold to withdraw ${value.toLocaleString()} TCN. You must hold at least ${requiredTcg.toLocaleString()} TCGold (1% of withdrawal amount).`,
          requiredTcg,
          currentTcg,
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
      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { decrement: value } },
      });

      const withdrawal = await tx.withdrawalRequest.create({
        data: {
          userId: user.id,
          asset: asset || "TCN_INTERNAL",
          network: network || "INTERNAL",
          address: address || "INTERNAL_LEDGER",
          amountTcn: value,
          status: "PENDING",
        },
      });

      const txRecord = await tx.transaction.create({
        data: {
          userId: user.id,
          walletId: updatedWallet.id,
          amount: value,
          type: "WITHDRAWAL_REQUEST",
          status: "PENDING",
          description:
            description || "Withdrawal request created, pending admin review.",
        },
      });

      return { updatedWallet, withdrawal, txRecord };
    });

    return NextResponse.json({
      wallet: {
        balance: result.updatedWallet.balance,
        tcGoldBalance: result.updatedWallet.tcGoldBalance ?? 0,
        usableUsdCents: result.updatedWallet.usableUsdCents ?? 0,
      },
      withdrawal: result.withdrawal,
      transaction: result.txRecord,
      requiredTcg,
      currentTcg,
    });
  } catch (err) {
    console.error("WITHDRAW ERROR:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
