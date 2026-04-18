import { NextResponse } from 'next/server';
import { destroySession } from '@/lib/auth';

export async function POST() {
  await destroySession(); // ✅ was manually clearing wrong cookie named 'session' instead of 'session_token'
  return NextResponse.json({
    success: true,
    message: 'Logged out successfully',
  });
}