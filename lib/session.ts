import { cookies } from 'next/headers'
import { SignJWT, jwtVerify } from 'jose'
import type { AppSession } from './types'

const SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET || 'fallback-secret-change-in-production-32ch'
)
const COOKIE_NAME = 'ca1_session'
const MAX_AGE = 60 * 60 * 24 // 24 hours

export async function createSession(payload: AppSession): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(SECRET)
}

export async function getSession(): Promise<AppSession | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    if (!token) return null
    const { payload } = await jwtVerify(token, SECRET)
    return payload as unknown as AppSession
  } catch {
    return null
  }
}

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: MAX_AGE,
    path: '/',
  })
}

export async function clearSessionCookie() {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}

export async function requireStudent() {
  const session = await getSession()
  if (!session || session.type !== 'student') {
    throw new Error('UNAUTHORIZED')
  }
  return session
}

export async function requireStaff() {
  const session = await getSession()
  if (!session || session.type !== 'staff') {
    throw new Error('UNAUTHORIZED')
  }
  return session
}

export async function requireSA() {
  const session = await getSession()
  if (!session || session.type !== 'staff' || session.role !== 'sa') {
    throw new Error('UNAUTHORIZED')
  }
  return session
}
