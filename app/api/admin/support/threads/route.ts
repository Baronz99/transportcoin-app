import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromAuthHeader } from "@/lib/auth";

export const dynamic = "force-dynamic";

function isAdmin(auth: any) {
  return auth?.isAdmin === true || auth?.tier === "ADMIN";
}

export async function GET(req: NextRequest) {
  try {
    const auth = getUserFromAuthHeader(req.headers.get("authorization"));
    if (!isAdmin(auth)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const threads = await prisma.supportThread.findMany({
      orderBy: { updatedAt: "desc" },
      take: 100,
      include: {
        user: { select: { id: true, email: true } },
        withdrawalRequest: true,
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });

    return NextResponse.json({ threads });
  } catch (err) {
    console.error("ADMIN SUPPORT THREADS GET ERROR:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
