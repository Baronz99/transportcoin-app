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

    await prisma.$transaction(async (tx) => {
      await tx.withdrawalRequest.update({
        where: { id: idNum },
        data: { status: "COMPLETED" },
      });

      await tx.transaction.updateMany({
        where: { type: "WITHDRAW_CRYPTO_REQUEST", amount: { gte: 0 } },
        data: { status: "SUCCESS" },
      });
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("APPROVE ERROR:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
