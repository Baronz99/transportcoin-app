// app/api/trade/buy-tcgold/route.ts

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
    const { amount } = body;

    const tcgAmount = Number(amount);
    if (!tcgAmount || tcgAmount <= 0 || !Number.isInteger(tcgAmount)) {
      return NextResponse.json(
        { error: "Amount must be a positive integer number of TCGold tokens." },
        { status: 400 },
      );
    }

    // Load user & wallet
    const user = await prisma.user.findUnique({
      where: { id: authUser.userId },
      include: { wallet: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Ensure there is a PlatformConfig row
    let config = await prisma.platformConfig.findUnique({
      where: { id: 1 },
    });

    if (!config) {
      config = await prisma.platformConfig.create({
        data: {
          id: 1,
          withdrawalDelayDays: 3,
        },
      });
    }

    if (!config.btcDepositAddress) {
      return NextResponse.json(
        {
          error:
            "BTC deposit address is not configured. Please contact support/admin.",
        },
        { status: 400 },
      );
    }

    const btcAddress = config.btcDepositAddress;
    const usdValueCents = Math.round(tcgAmount * TCG_USD * 100);

    // Ensure wallet exists and sync its BTC deposit address
    let wallet = user.wallet;
    if (!wallet) {
      wallet = await prisma.wallet.create({
        data: {
          userId: user.id,
          balance: 0,
          tcGoldBalance: 0,
          usableUsdCents: 0,
          btcDepositAddress: btcAddress,
        },
      });
    } else if (!wallet.btcDepositAddress || wallet.btcDepositAddress !== btcAddress) {
      wallet = await prisma.wallet.update({
        where: { id: wallet.id },
        data: { btcDepositAddress: btcAddress },
      });
    }

    // Create purchase ledger entry
    const purchase = await prisma.tcGoldPurchase.create({
      data: {
        userId: user.id,
        tcgAmount,
        usdValueCents,
        btcAddress,
        status: "PENDING",
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
      tcgUsdPrice: TCG_USD,
    });
  } catch (err) {
    console.error("BUY TCGOLD ERROR:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
