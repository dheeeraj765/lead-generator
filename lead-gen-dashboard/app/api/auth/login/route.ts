// app/api/auth/login/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  verifyPassword,
  createSession,
  normalizeEmail,
} from "@/lib/auth";
import { loginSchema } from "@/lib/validators";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input data" },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;

    const normalizedEmail = normalizeEmail(email); // ✅ FIX

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail }, // ✅ FIX
    });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    const isValid = await verifyPassword(password, user.passwordHash);

    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    await createSession(user.id);

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("[LOGIN ERROR]", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}