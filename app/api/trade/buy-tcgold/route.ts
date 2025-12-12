// app/api/trade/buy-tcgold/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromAuthHeader } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    // ✅ auth
    const authHeader = req.headers.get("authorization") || "";
    const authUser = await getUserFromAuthHeader(authHeader);

    if (!authUser?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ✅ body
    const body = await req.json();
    const amountTcg = Number(body?.amountTcg);

    if (!amountTcg || amountTcg <= 0 || !Number.isFinite(amountTcg)) {
      return NextResponse.json(
        { error: "Amount must be a valid positive number." },
        { status: 400 },
      );
    }

    // ✅ load user + wallet
    const user = await prisma.user.findUnique({
      where: { id: authUser.userId },
      include: { wallet: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // ✅ ensure wallet exists
    const wallet =
      user.wallet ||
      (await prisma.wallet.create({
        data: { userId: user.id },
      }));

    // ✅ pricing (same as your UI constants)
    const TCN_PRICE_USD = 0.01;
    const TCGOLD_PRICE_USD = 2.5;

    const tcnPerTcg = TCGOLD_PRICE_USD / TCN_PRICE_USD; // 250
    const costTcn = Math.round(amountTcg * tcnPerTcg);

    if (wallet.balance < costTcn) {
      return NextResponse.json(
        { error: "Insufficient TCN balance" },
        { status: 400 },
      );
    }

    // ✅ perform trade atomically
    const result = await prisma.$transaction(async (tx) => {
      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: { decrement: costTcn },
          tcGoldBalance: { increment: amountTcg },
        },
      });

      const transaction = await tx.transaction.create({
        data: {
          userId: user.id,
          walletId: wallet.id,
          type: "BUY_TCGOLD",
          amount: amountTcg,
          status: "SUCCESS",
          description: `Bought ${amountTcg} TCG for ${costTcn} TCN`,
        },
      });

      return { updatedWallet, transaction };
    });

    return NextResponse.json({
      wallet: result.updatedWallet,
      transaction: result.transaction,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
