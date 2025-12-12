// app/api/trade/buy-tcgold/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromAuthHeader } from "@/lib/auth";

// Internal pricing
const TCG_USD_CENTS = 250; // $2.50

export async function POST(req: Request) {
  try {
    // ✅ auth (getUserFromAuthHeader is sync in your lib/auth.ts)
    const authHeader = req.headers.get("authorization");
    const authUser = getUserFromAuthHeader(authHeader);

    if (!authUser?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ✅ body: accept BOTH { amount } and { amountTcg } for safety
    const body = await req.json().catch(() => ({}));
    const raw = body?.amount ?? body?.amountTcg ?? body?.tcgAmount;
    const amountTcg = Number(raw);

    if (!amountTcg || amountTcg <= 0 || !Number.isFinite(amountTcg)) {
      return NextResponse.json(
        { error: "Amount must be a valid positive number." },
        { status: 400 },
      );
    }

    if (!Number.isInteger(amountTcg)) {
      return NextResponse.json(
        { error: "Amount must be a whole number." },
        { status: 400 },
      );
    }

    // ✅ ensure user exists
    const user = await prisma.user.findUnique({
      where: { id: authUser.userId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // ✅ ensure wallet exists
    const wallet = await prisma.wallet.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id, balance: 0, tcGoldBalance: 0 },
    });

    // ✅ determine BTC deposit address:
    // 1) per-user wallet address
    // 2) platform config address
    // 3) env fallback
    const cfg = await prisma.platformConfig.findUnique({
      where: { id: 1 },
      select: { btcDepositAddress: true },
    });

    const btcAddress =
      wallet.btcDepositAddress ||
      cfg?.btcDepositAddress ||
      process.env.BTC_DEPOSIT_ADDRESS ||
      process.env.PLATFORM_BTC_ADDRESS ||
      null;

    if (!btcAddress) {
      return NextResponse.json(
        {
          error:
            "No BTC deposit address configured. Set PlatformConfig.btcDepositAddress or BTC_DEPOSIT_ADDRESS in .env.",
        },
        { status: 500 },
      );
    }

    const usdValueCents = amountTcg * TCG_USD_CENTS;

    // ✅ Create a purchase request record (NO internal deduction, NO tcGold credit yet)
    const purchase = await prisma.tcGoldPurchase.create({
      data: {
        userId: user.id,
        tcgAmount: amountTcg,
        usdValueCents,
        btcAddress,
        status: "PENDING",
      },
    });

    // ✅ Log a transaction for history (keep amount as TCG amount or TCN? you use Int; keep it TCG amount)
    const txRecord = await prisma.transaction.create({
      data: {
        userId: user.id,
        walletId: wallet.id,
        type: "BUY_TCGOLD",
        amount: amountTcg,
        status: "PENDING",
        description: `TCGold purchase request created. Send BTC to: ${btcAddress}`,
      },
    });

    return NextResponse.json(
      {
        purchase,
        transaction: txRecord,
        deposit: {
          btcAddress,
          usdValueCents,
        },
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("BUY_TCGOLD ERROR:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
