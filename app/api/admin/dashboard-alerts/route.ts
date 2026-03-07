import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromAuthHeader } from "@/lib/auth";

const ALLOWED_SEVERITIES = ["INFO", "HIGH", "CRITICAL"] as const;

async function requireAdmin(req: NextRequest) {
  const authUser = getUserFromAuthHeader(req.headers.get("authorization"));
  if (!authUser) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const admin = await prisma.user.findUnique({
    where: { id: authUser.userId },
    select: { id: true, isAdmin: true },
  });

  if (!admin || !admin.isAdmin) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { adminId: admin.id };
}

export async function GET(req: NextRequest) {
  try {
    const guard = await requireAdmin(req);
    if ("error" in guard) return guard.error;

    const { searchParams } = new URL(req.url);
    const userIdRaw = searchParams.get("userId");
    const userId = userIdRaw ? Number(userIdRaw) : null;

    if (userIdRaw && (!Number.isInteger(userId) || (userId ?? 0) <= 0)) {
      return NextResponse.json({ error: "Invalid userId" }, { status: 400 });
    }

    const alerts = await prisma.dashboardAlert.findMany({
      where: userId ? { userId } : undefined,
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({ alerts }, { status: 200 });
  } catch (err) {
    console.error("ADMIN DASHBOARD ALERTS GET ERROR:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const guard = await requireAdmin(req);
    if ("error" in guard) return guard.error;

    const body = (await req.json().catch(() => ({}))) as {
      userId?: number;
      title?: string;
      message?: string;
      severity?: string;
      requiresAction?: boolean;
      ctaLabel?: string | null;
      ctaHref?: string | null;
      expiresAt?: string | null;
    };

    const userId = Number(body.userId);
    const title = (body.title || "").trim();
    const message = (body.message || "").trim();
    const severity = (body.severity || "HIGH").toUpperCase();
    const requiresAction =
      typeof body.requiresAction === "boolean" ? body.requiresAction : true;
    const ctaLabel = body.ctaLabel?.trim() || null;
    const ctaHref = body.ctaHref?.trim() || null;

    if (!Number.isInteger(userId) || userId <= 0) {
      return NextResponse.json({ error: "Valid userId is required" }, { status: 400 });
    }
    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }
    if (!ALLOWED_SEVERITIES.includes(severity as (typeof ALLOWED_SEVERITIES)[number])) {
      return NextResponse.json({ error: "Severity must be INFO, HIGH, or CRITICAL" }, { status: 400 });
    }
    if (ctaHref && !ctaHref.startsWith("/")) {
      return NextResponse.json({ error: "ctaHref must be an internal path starting with '/'" }, { status: 400 });
    }
    if ((ctaLabel && !ctaHref) || (!ctaLabel && ctaHref)) {
      return NextResponse.json(
        { error: "ctaLabel and ctaHref must be provided together" },
        { status: 400 },
      );
    }

    let expiresAt: Date | null = null;
    if (body.expiresAt) {
      expiresAt = new Date(body.expiresAt);
      if (Number.isNaN(expiresAt.getTime())) {
        return NextResponse.json({ error: "Invalid expiresAt date" }, { status: 400 });
      }
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "Target user not found" }, { status: 404 });
    }

    const alert = await prisma.dashboardAlert.create({
      data: {
        userId,
        title,
        message,
        severity,
        requiresAction,
        ctaLabel,
        ctaHref,
        expiresAt,
        createdByAdminId: guard.adminId,
        status: "NEW",
      },
    });

    return NextResponse.json({ alert }, { status: 201 });
  } catch (err) {
    console.error("ADMIN DASHBOARD ALERTS POST ERROR:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
