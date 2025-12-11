import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 },
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "User already exists" },
        { status: 400 },
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // ✅ Create user with ALL required defaults
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,

        // New schema defaults
        tier: "BASIC",
        isAdmin: false,
        acceptedTermsAt: new Date(),

        // ✅ Auto-create wallet immediately
        wallet: {
          create: {
            balance: 0,
            tcGoldBalance: 0,
          },
        },

        // ✅ Optional: create empty profile shell
        profile: {
          create: {
            fullName: "New User",
          },
        },
      },
      include: {
        wallet: true,
        profile: true,
      },
    });

    return NextResponse.json({
      message: "User created successfully",
      userId: user.id,
    });
  } catch (err) {
    console.error("SIGNUP ERROR:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
