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

    const body = await request.json().catch(() => ({}));
    const note = String(body?.note || "").trim();
    if (!note) {
      return NextResponse.json({ error: "Admin note is required." }, { status: 400 });
    }

    const wr = await prisma.withdrawalRequest.findUnique({
      where: { id: withdrawalId },
    });

    if (!wr) {
      return NextResponse.json({ error: "Withdrawal not found" }, { status: 404 });
    }

    if (wr.status === "REJECTED" || wr.status === "COMPLETED") {
      return NextResponse.json({ success: true, withdrawal: wr });
    }

    if (
      wr.status !== "PENDING" &&
      wr.status !== "ON_HOLD_COLLATERAL" &&
      wr.status !== "READY_FOR_PAYOUT" &&
      wr.status !== "WAITING_QUEUE"
    ) {
      return NextResponse.json(
        { error: `Withdrawal is ${wr.status} and cannot be rejected.` },
        { status: 409 },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.withdrawalRequest.update({
        where: { id: withdrawalId },
        data: { status: "REJECTED" },
      });

      await tx.withdrawalStatusLog.create({
        data: {
          withdrawalRequestId: withdrawalId,
          previousStatus: wr.status,
          newStatus: "REJECTED",
          adminUserId: authUser.userId,
          note,
        },
      });

      return updated;
    });

    return NextResponse.json({ success: true, withdrawal: result });
  } catch (err) {
    console.error("reject withdrawal error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
