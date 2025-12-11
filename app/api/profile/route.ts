import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromAuthHeader } from "@/lib/auth";

// GET /api/profile  → return profile + basic user meta
export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const authUser = getUserFromAuthHeader(authHeader);

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: authUser.userId },
      include: {
        profile: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 401 });
    }

    return NextResponse.json({
      profile: user.profile,
      user: {
        email: user.email,
        tier: user.tier,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// POST /api/profile  → create/update profile
export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const authUser = getUserFromAuthHeader(authHeader);

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { fullName, phone, country, city } = body;

    if (!fullName || typeof fullName !== "string") {
      return NextResponse.json(
        { error: "Full name is required" },
        { status: 400 },
      );
    }

    // ensure user exists
    const user = await prisma.user.findUnique({
      where: { id: authUser.userId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 401 });
    }

    const profile = await prisma.userProfile.upsert({
      where: { userId: authUser.userId },
      create: {
        userId: authUser.userId,
        fullName,
        phone: phone || null,
        country: country || null,
        city: city || null,
      },
      update: {
        fullName,
        phone: phone || null,
        country: country || null,
        city: city || null,
      },
    });

    return NextResponse.json({ profile });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
