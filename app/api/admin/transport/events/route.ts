// app/api/admin/transport/events/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromAuthHeader } from "@/lib/auth";

export async function GET(req: Request) {
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

    const { searchParams } = new URL(req.url);
    const userEmail = searchParams.get("userEmail");

    let whereClause: any = {};
    if (userEmail) {
      const user = await prisma.user.findUnique({
        where: { email: userEmail },
        select: { id: true },
      });
      if (user) {
        whereClause.userId = user.id;
      } else {
        // no events if user doesn't exist
        whereClause.userId = -1;
      }
    }

    const events = await prisma.transportEvent.findMany({
      where: whereClause,
      include: {
        user: { select: { email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json({ events });
  } catch (err) {
    console.error("ADMIN LIST TRANSPORT EVENTS ERROR:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
