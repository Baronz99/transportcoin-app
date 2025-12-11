import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromAuthHeader } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const userData = getUserFromAuthHeader(authHeader);

    if (!userData) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = await prisma.user.findUnique({ where: { id: userData.userId } });
    if (!admin || !admin.isAdmin)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "PENDING";

    const withdrawals = await prisma.withdrawalRequest.findMany({
      where: { status },
      include: { user: { select: { email: true } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ withdrawals });
  } catch (err) {
    console.error("ADMIN WITHDRAWALS ERROR:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
