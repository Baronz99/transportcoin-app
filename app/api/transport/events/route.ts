import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromAuthHeader } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const authUser = getUserFromAuthHeader(authHeader);

    if (!authUser?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 🔑 IMPORTANT:
    // - Return enough history for aggregates
    // - Do NOT filter out reward events
    const events = await prisma.transportEvent.findMany({
      where: { userId: authUser.userId },
      orderBy: { createdAt: "desc" },
      take: 500, // ← increase window (safe for SQLite)
    });

    return NextResponse.json({ events });
  } catch (err) {
    console.error("TRANSPORT EVENTS ERROR:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
