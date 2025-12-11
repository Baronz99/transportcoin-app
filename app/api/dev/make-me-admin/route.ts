// app/api/dev/make-me-admin/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromAuthHeader } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const authUser = getUserFromAuthHeader(authHeader);

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const updated = await prisma.user.update({
      where: { id: authUser.userId },
      data: { isAdmin: true },
      select: { id: true, email: true, isAdmin: true },
    });

    return NextResponse.json({
      success: true,
      user: updated,
    });
  } catch (err) {
    console.error("MAKE ME ADMIN ERROR:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
