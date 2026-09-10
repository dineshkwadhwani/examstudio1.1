import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { db, audit } from '@/lib/db'
import { ok, badRequest, err, serverError } from '@/lib/api'
import { createSession, setSessionCookie } from '@/lib/session'

export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string; role?: 'student' | 'staff' }
  try {
    body = await req.json()
  } catch {
    return badRequest('Invalid JSON body.')
  }

  const { email, password, role = 'student' } = body

  if (!email?.trim()) return badRequest('Email is required.')
  if (!password)      return badRequest('Password is required.')

  const normalEmail = email.toLowerCase().trim()

  if (role === 'staff') {
    // ─── Staff login ──────────────────────────────────────
    const { data: staff } = await db
      .from('ca1_staff')
      .select('id, email, name, role, password_hash, active')
      .eq('email', normalEmail)
      .single()

    if (!staff || !staff.active) {
      return err('invalid_credentials', 'Invalid email or password.', 401)
    }

    const valid = await bcrypt.compare(password, staff.password_hash)
    if (!valid) {
      return err('invalid_credentials', 'Invalid email or password.', 401)
    }

    const token = await createSession({
      type: 'staff',
      id: staff.id,
      email: staff.email,
      name: staff.name,
      role: staff.role as 'sa' | 'invigilator',
    })

    await setSessionCookie(token)
    await db.from('ca1_audit_log').insert({
      actor: `staff:${staff.email}`,
      action: 'login',
      target: `staff:${staff.id}`,
    })

    return ok({ role: staff.role, name: staff.name })
  }

  // ─── Student login ────────────────────────────────────────
  const { data: student } = await db
    .from('ca1_students')
    .select('id, prn, name, email, password_hash, must_change_password')
    .eq('email', normalEmail)
    .single()

  if (!student) {
    return err('invalid_credentials', 'Invalid email or password.', 401)
  }

  const valid = await bcrypt.compare(password, student.password_hash)
  if (!valid) {
    return err('invalid_credentials', 'Invalid email or password.', 401)
  }

  // Update last login
  await db
    .from('ca1_students')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', student.id)

  const token = await createSession({
    type: 'student',
    id: student.id,
    prn: student.prn,
    name: student.name,
    email: student.email,
    must_change_password: student.must_change_password,
  })

  await setSessionCookie(token)
  await audit(`student:${student.prn}`, 'login', `student:${student.id}`)

  return ok({
    prn: student.prn,
    name: student.name,
    must_change_password: student.must_change_password,
  })
}
