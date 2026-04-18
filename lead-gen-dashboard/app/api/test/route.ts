import { NextResponse } from "next/server";

export async function GET() {
  const results: Record<string, string> = {};

  // Check env vars
  results.DATABASE_URL = process.env.DATABASE_URL ? "✅ SET" : "❌ MISSING";
  results.DIRECT_URL = process.env.DIRECT_URL ? "✅ SET" : "❌ MISSING";
  results.SESSION_SECRET = process.env.SESSION_SECRET ? "✅ SET" : "❌ MISSING";

  // Test Prisma
  try {
    const { prisma } = await import("@/lib/db");
    await prisma.$queryRaw`SELECT 1`;
    results.prisma = "✅ DB connection OK";
  } catch (e) {
    results.prisma = "❌ " + (e instanceof Error ? e.message : String(e));
  }

  // Test bcryptjs
  try {
    const bcrypt = await import("bcryptjs");
    await bcrypt.hash("test", 10);
    results.bcrypt = "✅ OK";
  } catch (e) {
    results.bcrypt = "❌ " + (e instanceof Error ? e.message : String(e));
  }

  // Test cookies import
  try {
    await import("next/headers");
    results.nextHeaders = "✅ OK";
  } catch (e) {
    results.nextHeaders = "❌ " + (e instanceof Error ? e.message : String(e));
  }

  return NextResponse.json(results);
}
