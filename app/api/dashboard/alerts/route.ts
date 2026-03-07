import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromAuthHeader } from "@/lib/auth";

const ACTIVE_STATUSES = ["NEW", "VIEWED", "ACTED"] as const;
const SEVERITY_PRIORITY: Record<string, number> = {
  CRITICAL: 3,
  HIGH: 2,
  INFO: 1,
};

function methodNotAllowed(method: string) {
  return NextResponse.json(
    { error: "Method Not Allowed", method, allowed: ["GET", "PATCH"] },
    { status: 405, headers: { Allow: "GET, PATCH" } },
  );
}

export async function GET(req: NextRequest) {
  try {
    const authUser = getUserFromAuthHeader(req.headers.get("authorization"));
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const user = await prisma.user.findUnique({
      where: { id: authUser.userId },
      select: { tier: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await prisma.dashboardAlert.updateMany({
      where: {
        userId: authUser.userId,
        status: { in: ["NEW", "VIEWED", "ACTED"] },
        expiresAt: { not: null, lte: now },
      },
      data: {
        status: "EXPIRED",
      },
    });

    await prisma.dashboardAlert.updateMany({
      where: {
        userId: authUser.userId,
        status: { in: ["NEW", "VIEWED", "ACTED"] },
        autoResolveTier: user.tier,
      },
      data: {
        status: "RESOLVED",
        resolvedAt: now,
      },
    });

    const alerts = await prisma.dashboardAlert.findMany({
      where: {
        userId: authUser.userId,
        status: { in: [...ACTIVE_STATUSES] },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    const sorted = alerts.sort((a, b) => {
      const sevDelta =
        (SEVERITY_PRIORITY[b.severity] ?? 0) -
        (SEVERITY_PRIORITY[a.severity] ?? 0);
      if (sevDelta !== 0) return sevDelta;
      return +new Date(b.createdAt) - +new Date(a.createdAt);
    });

    return NextResponse.json({
      alert: sorted[0] ?? null,
      alerts: sorted,
    });
  } catch (err) {
    console.error("DASHBOARD ALERTS GET ERROR:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const authUser = getUserFromAuthHeader(req.headers.get("authorization"));
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      alertId?: number;
      action?: "view" | "act" | "resolve";
    };

    const alertId = Number(body.alertId);
    const action = body.action;

    if (!Number.isInteger(alertId) || alertId <= 0) {
      return NextResponse.json({ error: "Valid alertId is required" }, { status: 400 });
    }

    if (!["view", "act", "resolve"].includes(action || "")) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const alert = await prisma.dashboardAlert.findFirst({
      where: {
        id: alertId,
        userId: authUser.userId,
      },
    });

    if (!alert) {
      return NextResponse.json({ error: "Alert not found" }, { status: 404 });
    }

    if (alert.status === "RESOLVED" || alert.status === "EXPIRED") {
      return NextResponse.json(
        { error: `Alert already ${alert.status.toLowerCase()}` },
        { status: 409 },
      );
    }

    const now = new Date();
    const data: {
      status?: string;
      viewedAt?: Date;
      actedAt?: Date;
      resolvedAt?: Date;
    } = {};

    if (action === "view") {
      if (alert.status === "NEW") {
        data.status = "VIEWED";
        data.viewedAt = now;
      }
    }

    if (action === "act") {
      if (alert.status === "NEW") {
        data.viewedAt = now;
      }
      data.status = "ACTED";
      data.actedAt = now;
    }

    if (action === "resolve") {
      data.status = "RESOLVED";
      data.resolvedAt = now;
      if (!alert.viewedAt) {
        data.viewedAt = now;
      }
      if (alert.requiresAction && !alert.actedAt) {
        data.actedAt = now;
      }
    }

    const updated = await prisma.dashboardAlert.update({
      where: { id: alert.id },
      data,
    });

    return NextResponse.json({ alert: updated }, { status: 200 });
  } catch (err) {
    console.error("DASHBOARD ALERTS PATCH ERROR:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST() {
  return methodNotAllowed("POST");
}

export async function PUT() {
  return methodNotAllowed("PUT");
}

export async function DELETE() {
  return methodNotAllowed("DELETE");
}
