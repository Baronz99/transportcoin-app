import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromAuthHeader } from "@/lib/auth";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const authHeader = req.headers.get("authorization");
    const userData = getUserFromAuthHeader(authHeader);

    if (!userData) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = await prisma.user.findUnique({ where: { id: userData.userId } });
    if (!admin || !admin.isAdmin)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const idNum = Number(params.id);

    const request = await prisma.withdrawalRequest.findUnique({
      where: { id: idNum },
    });

    if (!request)
      return NextResponse.json({ error: "Request not found" }, { status: 404 });

    await prisma.$transaction(async (tx) => {
      // Mark as rejected
      await tx.withdrawalRequest.update({
        where: { id: idNum },
        data: { status: "REJECTED" },
      });

      // Refund wallet
      await tx.wallet.update({
        where: { userId: request.userId },
        data: { balance: { increment: request.amountTcn } },
      });

      // Update transaction record
      await tx.transaction.updateMany({
        where: { userId: request.userId, amount: request.amountTcn },
        data: { status: "FAILED" },
      });
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("REJECT ERROR:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
