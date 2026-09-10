import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { db, audit } from '@/lib/db'
import { ok, badRequest, serverError } from '@/lib/api'
import { getSession, createSession, setSessionCookie } from '@/lib/session'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || session.type !== 'student') {
    return badRequest('Not authenticated.')
  }

  let body: { new_password?: string }
  try {
    body = await req.json()
  } catch {
    return badRequest('Invalid JSON.')
  }

  if (!body.new_password || body.new_password.length < 8) {
    return badRequest('New password must be at least 8 characters.')
  }

  const hash = await bcrypt.hash(body.new_password, 12)

  const { error } = await db
    .from('ca1_students')
    .update({ password_hash: hash, must_change_password: false })
    .eq('id', session.id)

  if (error) return serverError()

  // Re-issue session with must_change_password = false
  const token = await createSession({ ...session, must_change_password: false })
  await setSessionCookie(token)

  await audit(`student:${session.prn}`, 'password_changed', `student:${session.id}`)

  return ok({ message: 'Password changed successfully.' })
}
