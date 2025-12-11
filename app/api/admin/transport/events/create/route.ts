// app/api/admin/transport/events/create/route.ts

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

    const admin = await prisma.user.findUnique({
      where: { id: authUser.userId },
      select: { id: true, isAdmin: true },
    });

    if (!admin || !admin.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const {
      userEmail,
      type,
      label,
      route,
      vehicleId,
      location,
      amountFuelLitres,
      amountTcn,
      amountTcg,
    } = body;

    if (!userEmail || !type || !label) {
      return NextResponse.json(
        { error: "userEmail, type and label are required." },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: userEmail },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const event = await prisma.transportEvent.create({
      data: {
        userId: user.id,
        type,
        label,
        route: route || null,
        vehicleId: vehicleId || null,
        location: location || null,
        amountFuelLitres: amountFuelLitres ?? null,
        amountTcn: amountTcn ?? null,
        amountTcg: amountTcg ?? null,
      },
    });

    return NextResponse.json({ event });
  } catch (err) {
    console.error("ADMIN CREATE TRANSPORT EVENT ERROR:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
