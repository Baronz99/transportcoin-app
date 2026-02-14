import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromAuthHeader } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const authUser = getUserFromAuthHeader(req.headers.get("authorization"));

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const queued = await prisma.withdrawalRequest.findFirst({
      where: { userId: authUser.userId, status: "WAITING_QUEUE" },
      orderBy: { queuedAt: "desc" },
    });

    if (!queued) {
      return NextResponse.json({ withdrawal: null });
    }

    return NextResponse.json({
      withdrawal: {
        id: queued.id,
        amountTcn: queued.amountTcn,
        asset: queued.asset,
        network: queued.network,
        status: queued.status,
        createdAt: queued.createdAt,
        queuedAt: queued.queuedAt,
        queueDueAt: queued.queueDueAt,
        queueLane: queued.queueLane,
        expediteAppliedAt: queued.expediteAppliedAt,
      },
    });
  } catch (err) {
    console.error("WITHDRAWAL-QUEUE-LATEST ERROR:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
