// app/api/wallet/withdraw-crypto/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromAuthHeader } from "@/lib/auth";

/**
 * Withdrawal rule:
 * - User must HOLD at least 1% of withdrawal amount in TCGold.
 *   100,000 TCN => 1,000 TCG
 *   10,000  TCN => 100  TCG
 *   1,000   TCN => 10   TCG
 * - Minimum 1 TCG for any positive withdrawal.
 * - We DO NOT deduct TCG from balance here (hold-only requirement).
 */
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

    if (!address || !String(address).trim()) {
      return NextResponse.json(
        { error: "Destination address is required." },
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

    // Check TCGold HOLD requirement
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

    // Transaction for consistency
    const result = await prisma.$transaction(async (tx) => {
      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: { decrement: value },
        },
      });

      const withdrawal = await tx.withdrawalRequest.create({
        data: {
          userId: user.id,
          asset: asset || "BTC",
          network: network || "BTC",
          address: String(address).trim(),
          amountTcn: value,
          status: "PENDING",
        },
      });

      const txRecord = await tx.transaction.create({
        data: {
          userId: user.id,
          walletId: updatedWallet.id,
          amount: value,
          type: "WITHDRAW_CRYPTO_REQUEST",
          status: "PENDING",
          description:
            description ||
            `Withdrawal request created (${asset || "BTC"} / ${
              network || "BTC"
            }). Pending admin approval.`,
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
    console.error("WITHDRAW-CRYPTO ERROR:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
