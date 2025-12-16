// app/api/wallet/withdraw-crypto/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromAuthHeader } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Withdrawal rule (HOLD only):
 * - User must HOLD at least 1% of withdrawal amount in TCGold.
 *   100,000 TCN => 1,000 TCG
 * - Minimum 1 TCG for any positive withdrawal.
 * - We DO NOT deduct TCG from balance here.
 */
function requiredTcgForWithdrawal(amountTcn: number) {
  return Math.max(1, Math.ceil(amountTcn / 100)); // 1% of TCN amount
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const authUser = getUserFromAuthHeader(authHeader);

    if (!authUser?.userId) {
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
      // 1) Deduct TCN from wallet
      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { decrement: value } },
      });

      // 2) Create the WithdrawalRequest (admin ops record)
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

      // 3) Create transaction history row (user-visible)
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

      // 4) Ensure a SupportThread exists for this withdrawal
      //    (upsert prevents duplicates if something retries)
      const thread = await tx.supportThread.upsert({
        where: { withdrawalRequestId: withdrawal.id },
        update: { status: "OPEN" },
        create: {
          userId: user.id,
          withdrawalRequestId: withdrawal.id,
          status: "OPEN",
        },
      });

      // 5) Optional: create first message from the user
      const firstBody =
        (description && description.trim()) ||
        `Hi admin, please help with my withdrawal of ${value.toLocaleString()} TCN to ${String(
          address,
        ).trim()} (${asset || "BTC"} / ${network || "BTC"}).`;

      await tx.supportMessage.create({
        data: {
          threadId: thread.id,
          sender: "USER",
          body: firstBody,
        },
      });

      return { updatedWallet, withdrawal, txRecord, thread };
    });

    return NextResponse.json({
      wallet: {
        balance: result.updatedWallet.balance,
        tcGoldBalance: result.updatedWallet.tcGoldBalance ?? 0,
        usableUsdCents: result.updatedWallet.usableUsdCents ?? 0,
      },
      withdrawal: result.withdrawal,
      transaction: result.txRecord,
      supportThreadId: result.thread.id,
      requiredTcg,
      currentTcg,
    });
  } catch (err) {
    console.error("WITHDRAW-CRYPTO ERROR:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
