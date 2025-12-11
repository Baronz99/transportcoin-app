// app/api/admin/tcg-purchases/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromAuthHeader } from "@/lib/auth";

const TCG_USD = 2.5;

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const authUser = getUserFromAuthHeader(authHeader);

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = await prisma.user.findUnique({
      where: { id: authUser.userId },
      select: { id: true, isAdmin: true },
    });

    if (!admin || !admin.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get("status") || "PENDING";

    const purchases = await prisma.tcGoldPurchase.findMany({
      where: { status: statusParam },
      include: {
        user: { select: { email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return NextResponse.json({
      purchases: purchases.map((p) => ({
        id: p.id,
        userEmail: p.user.email,
        tcgAmount: p.tcgAmount,
        usdValueCents: p.usdValueCents,
        btcAddress: p.btcAddress,
        btcTxId: p.btcTxId,
        status: p.status,
        createdAt: p.createdAt,
      })),
      tcgUsdPrice: TCG_USD,
    });
  } catch (err) {
    console.error("ADMIN LIST TCG PURCHASES ERROR:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const authUser = getUserFromAuthHeader(authHeader);

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = await prisma.user.findUnique({
      where: { id: authUser.userId },
      select: { id: true, isAdmin: true },
    });

    if (!admin || !admin.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { purchaseId, action, btcTxId } = body as {
      purchaseId?: number;
      action?: "APPROVE" | "REJECT";
      btcTxId?: string;
    };

    if (!purchaseId || !action) {
      return NextResponse.json(
        { error: "purchaseId and action are required." },
        { status: 400 },
      );
    }

    const purchase = await prisma.tcGoldPurchase.findUnique({
      where: { id: purchaseId },
    });

    if (!purchase) {
      return NextResponse.json(
        { error: "Purchase not found." },
        { status: 404 },
      );
    }

    if (purchase.status !== "PENDING") {
      return NextResponse.json(
        { error: "Only PENDING purchases can be updated." },
        { status: 400 },
      );
    }

    if (action === "REJECT") {
      const updated = await prisma.tcGoldPurchase.update({
        where: { id: purchaseId },
        data: {
          status: "REJECTED",
          btcTxId: btcTxId || null,
        },
      });

      return NextResponse.json({ purchase: updated });
    }

    // APPROVE: credit wallet with TCGold inside a transaction
    const result = await prisma.$transaction(async (tx) => {
      const updatedPurchase = await tx.tcGoldPurchase.update({
        where: { id: purchaseId },
        data: {
          status: "CONFIRMED",
          btcTxId: btcTxId || null,
        },
      });

      let wallet = await tx.wallet.findUnique({
        where: { userId: updatedPurchase.userId },
      });

      if (!wallet) {
        wallet = await tx.wallet.create({
          data: {
            userId: updatedPurchase.userId,
            balance: 0,
            tcGoldBalance: updatedPurchase.tcgAmount,
            usableUsdCents: 0,
          },
        });
      } else {
        wallet = await tx.wallet.update({
          where: { id: wallet.id },
          data: {
            tcGoldBalance: {
              increment: updatedPurchase.tcgAmount,
            },
          },
        });
      }

      await tx.transaction.create({
        data: {
          userId: updatedPurchase.userId,
          walletId: wallet.id,
          type: "TCG_PURCHASE",
          amount: updatedPurchase.tcgAmount,
          description: "TCGold purchase confirmed via BTC",
        },
      });

      return { updatedPurchase, wallet };
    });

    return NextResponse.json({
      purchase: result.updatedPurchase,
      wallet: {
        id: result.wallet.id,
        tcGoldBalance: result.wallet.tcGoldBalance,
      },
    });
  } catch (err) {
    console.error("ADMIN UPDATE TCG PURCHASE ERROR:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
