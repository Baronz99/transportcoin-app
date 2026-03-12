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

    const admin = await prisma.user.findUnique({
      where: { id: authUser.userId },
      select: { id: true, isAdmin: true },
    });

    if (!admin || !admin.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { userEmail, amount, note } = body as {
      userEmail?: string;
      amount?: number;
      note?: string;
    };

    const normalizedEmail = userEmail?.trim().toLowerCase();
    const normalizedNote = note?.trim() || null;

    if (!normalizedEmail) {
      return NextResponse.json(
        { error: "userEmail is required." },
        { status: 400 },
      );
    }

    if (
      typeof amount !== "number" ||
      !Number.isInteger(amount) ||
      amount <= 0
    ) {
      return NextResponse.json(
        { error: "amount must be a positive integer." },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, email: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.upsert({
        where: { userId: user.id },
        update: {
          tcGoldBalance: {
            increment: amount,
          },
        },
        create: {
          userId: user.id,
          balance: 0,
          tcGoldBalance: amount,
          usableUsdCents: 0,
        },
      });

      const transaction = await tx.transaction.create({
        data: {
          userId: user.id,
          walletId: wallet.id,
          type: "ADMIN_TCG_CREDIT",
          amount,
          status: "SUCCESS",
          description: "Manual TCGold credit applied by admin.",
          adminNote:
            normalizedNote ||
            `Credited ${amount} TCG manually by admin.`,
        },
      });

      return { wallet, transaction };
    });

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
      },
      wallet: {
        id: result.wallet.id,
        tcGoldBalance: result.wallet.tcGoldBalance,
      },
      transaction: {
        id: result.transaction.id,
        type: result.transaction.type,
        amount: result.transaction.amount,
        adminNote: result.transaction.adminNote,
        createdAt: result.transaction.createdAt,
      },
    });
  } catch (err) {
    console.error("ADMIN TCG CREDIT ERROR:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
