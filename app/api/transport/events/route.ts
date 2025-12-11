// app/api/transport/events/route.ts

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

    const user = await prisma.user.findUnique({
      where: { id: authUser.userId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 401 });
    }

    const events = await prisma.transportEvent.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json({ events });
  } catch (err) {
    console.error("TRANSPORT EVENTS ERROR:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
