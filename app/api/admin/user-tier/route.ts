import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromAuthHeader } from "@/lib/auth";

const ALLOWED_TIERS = ["BASIC", "PRO"] as const;

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
    const { userEmail, tier, note } = body as {
      userEmail?: string;
      tier?: string;
      note?: string;
    };

    const normalizedEmail = userEmail?.trim().toLowerCase();
    const normalizedTier = tier?.trim().toUpperCase();
    const normalizedNote = note?.trim() || null;

    if (!normalizedEmail) {
      return NextResponse.json(
        { error: "userEmail is required." },
        { status: 400 },
      );
    }

    if (
      !normalizedTier ||
      !ALLOWED_TIERS.includes(normalizedTier as (typeof ALLOWED_TIERS)[number])
    ) {
      return NextResponse.json(
        { error: "tier must be BASIC or PRO." },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, email: true, tier: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    if (user.tier === normalizedTier) {
      return NextResponse.json(
        { error: `User is already ${normalizedTier}.` },
        { status: 409 },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: user.id },
        data: { tier: normalizedTier },
        select: { id: true, email: true, tier: true },
      });

      const wallet = await tx.wallet.findUnique({
        where: { userId: user.id },
        select: { id: true },
      });

      const transaction = wallet
        ? await tx.transaction.create({
            data: {
              userId: user.id,
              walletId: wallet.id,
              type: "ADMIN_TIER_CHANGE",
              amount: 0,
              status: "SUCCESS",
              description: `Admin changed account tier from ${user.tier} to ${normalizedTier}.`,
              adminNote:
                normalizedNote ||
                `Tier changed by admin from ${user.tier} to ${normalizedTier}.`,
            },
          })
        : null;

      return { updatedUser, transaction };
    });

    return NextResponse.json({
      user: result.updatedUser,
      previousTier: user.tier,
      transaction: result.transaction
        ? {
            id: result.transaction.id,
            type: result.transaction.type,
            amount: result.transaction.amount,
            adminNote: result.transaction.adminNote,
            createdAt: result.transaction.createdAt,
          }
        : null,
      message: `Updated ${result.updatedUser.email} to ${result.updatedUser.tier}.`,
    });
  } catch (err) {
    console.error("ADMIN USER TIER ERROR:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
