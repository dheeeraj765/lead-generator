import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { prisma } from './db';

const SESSION_COOKIE_NAME = 'session_token';
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: string): Promise<string> {
  const token = Buffer.from(
    `${userId}:${Date.now()}:${Math.random().toString(36)}`
  ).toString('base64');
  
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_DURATION / 1000,
    path: '/',
  });
  
  return token;
}

export async function getSession(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME);
  return token?.value ?? null;
}

export async function getUserFromSession(): Promise<{ id: string; name: string; email: string } | null> {
  const token = await getSession();
  if (!token) return null;

  try {
    const decoded = Buffer.from(token, 'base64').toString();
    const userId = decoded.split(':')[0];
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true },
    });
    
    return user;
  } catch (error) {
    return null;
  }
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function requireAuth() {
  const user = await getUserFromSession();
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user;
}