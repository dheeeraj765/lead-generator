import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  // Clear session cookie and respond with success
  const response = NextResponse.json({
    success: true,
    message: 'Logged out successfully',
  });
  
  // Clear the session cookie
  response.cookies.set({
    name: 'session',
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
  });
  
  return response;
}
