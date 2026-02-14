import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromAuthHeader } from "@/lib/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authHeader = request.headers.get("authorization") || "";
    const authUser = getUserFromAuthHeader(authHeader);

    if (!authUser || !(authUser as any).isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    if (wr.status === "COMPLETED" || wr.status === "REJECTED") {
      return NextResponse.json({ success: true, withdrawal: wr });
    }

    if (wr.status !== "READY_FOR_PAYOUT" && wr.status !== "WAITING_QUEUE") {
      return NextResponse.json(
        { error: `Withdrawal is ${wr.status} and cannot be marked paid.` },
        { status: 409 },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.withdrawalRequest.update({
        where: { id: withdrawalId },
        data: { status: "COMPLETED" },
      });

      await tx.withdrawalStatusLog.create({
        data: {
          withdrawalRequestId: withdrawalId,
          previousStatus: wr.status,
          newStatus: "COMPLETED",
          adminUserId: authUser.userId,
          note,
        },
      });

      return updated;
    });

    return NextResponse.json({ success: true, withdrawal: result });
  } catch (err) {
    console.error("MARK PAID ERROR:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
