// app/api/trading/tcgold/purchase/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromAuthHeader } from "@/lib/auth";

// Internal fixed price for now
const TCG_USD = 2.5;

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const authUser = getUserFromAuthHeader(authHeader);

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { tcgAmount } = body;

    const amountInt = Number(tcgAmount);
    if (!amountInt || amountInt <= 0 || !Number.isInteger(amountInt)) {
      return NextResponse.json(
        { error: "tcgAmount must be a positive integer." },
        { status: 400 },
      );
    }

    // Fetch or create wallet
    const user = await prisma.user.findUnique({
      where: { id: authUser.userId },
      include: { wallet: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // For now, use a static or env BTC address.
    const defaultBtcAddress =
      process.env.BTC_DEPOSIT_ADDRESS || "btc-test-transportcoin-address";

    let wallet = user.wallet;
    if (!wallet) {
      wallet = await prisma.wallet.create({
        data: {
          userId: user.id,
          balance: 0,
          tcGoldBalance: 0,
          usableUsdCents: 0,
          btcDepositAddress: defaultBtcAddress,
        },
      });
    } else if (!wallet.btcDepositAddress) {
      wallet = await prisma.wallet.update({
        where: { id: wallet.id },
        data: { btcDepositAddress: defaultBtcAddress },
      });
    }

    const usdValueCents = Math.round(amountInt * TCG_USD * 100);

    const purchase = await prisma.tcGoldPurchase.create({
      data: {
        userId: user.id,
        tcgAmount: amountInt,
        usdValueCents,
        btcAddress: wallet.btcDepositAddress ?? defaultBtcAddress,
      },
    });

    return NextResponse.json({
      purchase: {
        id: purchase.id,
        tcgAmount: purchase.tcgAmount,
        usdValueCents: purchase.usdValueCents,
        btcAddress: purchase.btcAddress,
        status: purchase.status,
        createdAt: purchase.createdAt,
      },
    });
  } catch (err) {
    console.error("TCGOLD PURCHASE ERROR:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
