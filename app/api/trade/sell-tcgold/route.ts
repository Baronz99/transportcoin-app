import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromAuthHeader } from "@/lib/auth";

const TCN_PER_TCGOLD = 250; // 1 TCGold = 250 TCN

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const authUser = getUserFromAuthHeader(authHeader);

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { amountTcg } = await req.json();
    const amtTcg = Number(amountTcg);

    if (!amtTcg || amtTcg <= 0) {
      return NextResponse.json({ error: "Invalid TCGold amount" }, { status: 400 });
    }

    const wallet = await prisma.wallet.findUnique({
      where: { userId: authUser.userId },
    });

    if (!wallet || wallet.tcGoldBalance < amtTcg) {
      return NextResponse.json(
        { error: "Insufficient TCGold to sell" },
        { status: 400 }
      );
    }

    const proceedsTcn = amtTcg * TCN_PER_TCGOLD;

    const updatedWallet = await prisma.wallet.update({
      where: { userId: authUser.userId },
      data: {
        tcGoldBalance: { decrement: amtTcg }, // lose TCGold
        balance: { increment: proceedsTcn },  // gain TCN
      },
    });

    const tx = await prisma.transaction.create({
      data: {
        userId: authUser.userId,
        type: "SELL_TCGOLD",
        amount: amtTcg,
        status: "SUCCESS",
        description: `Sold ${amtTcg} TCGold for ${proceedsTcn} TCN`,
      },
    });

    return NextResponse.json({
      message: "TCGold sale successful",
      wallet: updatedWallet,
      transaction: tx,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
