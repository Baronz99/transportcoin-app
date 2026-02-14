import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromAuthHeader } from "@/lib/auth";
import { applyProQueueJump } from "@/lib/withdrawalQueue";

export async function POST(req: Request) {
  try {
    const authUser = getUserFromAuthHeader(req.headers.get("authorization"));
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: authUser.userId },
      select: { id: true, tier: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const now = new Date();
    const queued = await prisma.withdrawalRequest.findMany({
      where: { userId: authUser.userId, status: "WAITING_QUEUE" },
      select: { id: true, queueDueAt: true },
    });

    const result = await prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: authUser.userId },
        data: { tier: "PRO" },
        select: { id: true, tier: true },
      });

      for (const withdrawal of queued) {
        await tx.withdrawalRequest.update({
          where: { id: withdrawal.id },
          data: {
            queueLane: "PRO",
            queueDueAt: applyProQueueJump({
              now,
              currentDueAt: withdrawal.queueDueAt,
            }),
            expediteAppliedAt: now,
          },
        });
      }

      return updatedUser;
    });

    const latestQueued = await prisma.withdrawalRequest.findFirst({
      where: { userId: authUser.userId, status: "WAITING_QUEUE" },
      orderBy: { queuedAt: "desc" },
      select: {
        id: true,
        amountTcn: true,
        asset: true,
        network: true,
        status: true,
        createdAt: true,
        queuedAt: true,
        queueDueAt: true,
        queueLane: true,
        expediteAppliedAt: true,
      },
    });

    return NextResponse.json({
      ok: true,
      tier: result.tier,
      updatedQueueCount: queued.length,
      withdrawal: latestQueued,
      message:
        user.tier === "PRO"
          ? "PRO lane already active. Waiting queue refreshed."
          : "Upgraded to PRO. Waiting queue has been expedited.",
    });
  } catch (err) {
    console.error("WITHDRAWAL-UPGRADE ERROR:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
