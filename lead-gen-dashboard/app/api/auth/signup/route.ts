// app/api/auth/signup/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  hashPassword,
  createSession,
  normalizeEmail,
} from "@/lib/auth";
import { signupSchema } from "@/lib/validators";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const parsed = signupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input data" },
        { status: 400 }
      );
    }

    const { name, email, password } = parsed.data;

    const normalizedEmail = normalizeEmail(email); // ✅ FIX

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail, // ✅ FIX
        passwordHash,
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    await createSession(user.id);

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    console.error("[SIGNUP ERROR]", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}