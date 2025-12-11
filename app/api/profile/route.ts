// app/api/profile/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromAuthHeader } from "@/lib/auth";

// Prevent any caching of API responses (helps with weird edge/proxy behavior)
export const dynamic = "force-dynamic";

function methodNotAllowed(method: string) {
  return NextResponse.json(
    { error: "Method Not Allowed", method, allowed: ["GET", "POST"] },
    { status: 405, headers: { Allow: "GET, POST" } }
  );
}

// GET: return current profile
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization") ?? "";
    const authUser = await getUserFromAuthHeader(authHeader);

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await prisma.userProfile.findUnique({
      where: { userId: authUser.userId },
    });

    return NextResponse.json({ profile }, { status: 200 });
  } catch (err) {
    console.error("PROFILE GET ERROR:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// POST: create/update profile
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization") ?? "";
    const authUser = await getUserFromAuthHeader(authHeader);

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));

    const { fullName, country, timezone } = body as {
      fullName?: string;
      country?: string | null;
      timezone?: string | null;
    };

    const profile = await prisma.userProfile.upsert({
      where: { userId: authUser.userId },
      update: {
        fullName: fullName ?? "",
        country: country ?? null,
        timezone: timezone ?? null,
      },
      create: {
        userId: authUser.userId,
        fullName: fullName ?? "",
        country: country ?? null,
        timezone: timezone ?? null,
      },
    });

    return NextResponse.json({ profile }, { status: 200 });
  } catch (err) {
    console.error("PROFILE SAVE ERROR:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// If something is routing here with another method, make it explicit
export async function PUT() {
  return methodNotAllowed("PUT");
}
export async function PATCH() {
  return methodNotAllowed("PATCH");
}
export async function DELETE() {
  return methodNotAllowed("DELETE");
}
