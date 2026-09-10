import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { db, audit } from '@/lib/db'
import { ok, err, badRequest, conflict, serverError, getOpenSession } from '@/lib/api'

const EMAIL_RE = /^[A-Za-z0-9._%+-]+@sitpune\.edu\.in$/
const PHONE_RE = /^[6-9]\d{9}$/

export async function POST(req: NextRequest) {
  let body: { name?: string; prn?: string; email?: string; phone?: string; password?: string }
  try {
    body = await req.json()
  } catch {
    return badRequest('Invalid JSON body.')
  }

  const { name, prn, email, phone, password } = body

  // ─── Validate fields ─────────────────────────────────────
  if (!name?.trim())    return badRequest('Name is required.')
  if (!prn?.trim())     return badRequest('PRN is required.')
  if (!email?.trim())   return badRequest('Email is required.')
  if (!phone?.trim())   return badRequest('Phone number is required.')
  if (!password)        return badRequest('Password is required.')

  if (!EMAIL_RE.test(email)) {
    return badRequest('Email must be a valid @sitpune.edu.in address.')
  }

  if (!PHONE_RE.test(phone.trim())) {
    return badRequest('Phone must be a valid 10-digit Indian mobile number.')
  }

  if (password.length < 8) {
    return badRequest('Password must be at least 8 characters.')
  }

  // ─── Check a session is open for registration ─────────────
  const session = await getOpenSession()
  if (!session) {
    return err('registration_closed', 'Registration is not currently open. Please wait for the invigilator.', 403)
  }

  // ─── Validate PRN against roster ─────────────────────────
  const { data: rosterRow } = await db
    .from('ca1_roster')
    .select('prn, name')
    .eq('prn', prn.trim())
    .single()

  if (!rosterRow) {
    return badRequest('PRN not found in the class roster. Please check your PRN and try again.')
  }

  // ─── Check PRN not already registered ────────────────────
  const { data: existingStudent } = await db
    .from('ca1_students')
    .select('id')
    .eq('prn', prn.trim())
    .single()

  if (existingStudent) {
    return conflict('prn_already_registered', 'This PRN is already registered. If you forgot your password, contact the invigilator.')
  }

  // ─── Check email not already registered ──────────────────
  const { data: existingEmail } = await db
    .from('ca1_students')
    .select('id')
    .eq('email', email.toLowerCase().trim())
    .single()

  if (existingEmail) {
    return conflict('email_already_registered', 'This email address is already registered.')
  }

  // ─── Hash password and create student ────────────────────
  const passwordHash = await bcrypt.hash(password, 12)

  const { data: newStudent, error } = await db
    .from('ca1_students')
    .insert({
      prn: prn.trim(),
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone.trim(),
      password_hash: passwordHash,
    })
    .select('id, prn, name, email')
    .single()

  if (error || !newStudent) {
    console.error('Register error:', error)
    return serverError('Could not create account. Please try again.')
  }

  await audit(`student:${prn.trim()}`, 'registered', `student:${newStudent.id}`)

  return ok({ message: 'Registration successful. You can now log in.' }, 201)
}
