// app/api/profile/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromAuthHeader } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function methodNotAllowed(method: string) {
  return NextResponse.json(
    { error: "Method Not Allowed", method, allowed: ["GET", "POST"] },
    { status: 405, headers: { Allow: "GET, POST" } },
  );
}

// GET: return current profile + user meta
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const authUser = getUserFromAuthHeader(authHeader);

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [profile, user] = await Promise.all([
      prisma.userProfile.findUnique({
        where: { userId: authUser.userId },
      }),
      prisma.user.findUnique({
        where: { id: authUser.userId },
        select: {
          email: true,
          tier: true,
          createdAt: true,
          lastLoginAt: true,
        },
      }),
    ]);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ profile, user }, { status: 200 });
  } catch (err) {
    console.error("PROFILE GET ERROR:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// POST: create/update profile (NOW includes phone + city)
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const authUser = getUserFromAuthHeader(authHeader);

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      fullName?: string;
      phone?: string | null;
      country?: string | null;
      city?: string | null;
      timezone?: string | null;
    };

    const fullName = (body.fullName ?? "").trim();
    const phone = body.phone ?? null;
    const country = body.country ?? null;
    const city = body.city ?? null;
    const timezone = body.timezone ?? null;

    if (!fullName) {
      return NextResponse.json(
        { error: "Full name is required" },
        { status: 400 },
      );
    }

    const profile = await prisma.userProfile.upsert({
      where: { userId: authUser.userId },
      update: {
        fullName,
        phone,
        country,
        city,
        timezone,
      },
      create: {
        userId: authUser.userId,
        fullName,
        phone,
        country,
        city,
        timezone,
      },
    });

    const user = await prisma.user.findUnique({
      where: { id: authUser.userId },
      select: {
        email: true,
        tier: true,
        createdAt: true,
        lastLoginAt: true,
      },
    });

    return NextResponse.json({ profile, user }, { status: 200 });
  } catch (err) {
    console.error("PROFILE SAVE ERROR:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PUT() {
  return methodNotAllowed("PUT");
}
export async function PATCH() {
  return methodNotAllowed("PATCH");
}
export async function DELETE() {
  return methodNotAllowed("DELETE");
}
