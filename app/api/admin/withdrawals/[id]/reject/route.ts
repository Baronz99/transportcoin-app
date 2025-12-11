import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromAuthHeader } from "@/lib/auth";

// Reject a withdrawal request
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // ✅ Auth
    const authHeader = request.headers.get("authorization") || "";
    const authUser = await getUserFromAuthHeader(authHeader);

    // Adjust this check to match your auth payload shape.
    if (!authUser || !(authUser as any).isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ✅ Next.js 16 typed routes: params is a Promise
    const { id } = await params;
    const withdrawalId = Number(id);
    if (!withdrawalId || Number.isNaN(withdrawalId)) {
      return NextResponse.json({ error: "Invalid withdrawal id" }, { status: 400 });
    }

    // ✅ Find withdrawal
    const wr = await prisma.withdrawalRequest.findUnique({
      where: { id: withdrawalId },
    });

    if (!wr) {
      return NextResponse.json({ error: "Withdrawal not found" }, { status: 404 });
    }

    if (wr.status !== "PENDING") {
      return NextResponse.json(
        { error: `Withdrawal is already ${wr.status}` },
        { status: 400 },
      );
    }

    // ✅ Reject
    await prisma.withdrawalRequest.update({
      where: { id: withdrawalId },
      data: { status: "REJECTED" },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("reject withdrawal error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
