import { NextRequest } from 'next/server'
import { db, audit } from '@/lib/db'
import { badRequest, conflict, forbidden, ok, serverError } from '@/lib/api'
import { getSession } from '@/lib/session'

type SessionRow = {
  id: number
  label: string
  status: string
  created_at: string
  ca1_exam_definitions: { code: string; title: string } | { code: string; title: string }[] | null
}

function present(row: SessionRow, registered: boolean) {
  const definition = Array.isArray(row.ca1_exam_definitions)
    ? row.ca1_exam_definitions[0]
    : row.ca1_exam_definitions
  return {
    session_id: row.id,
    label: row.label,
    status: row.status,
    registered,
    code: definition?.code ?? 'Exam',
    title: definition?.title ?? row.label,
  }
}

export async function GET() {
  const student = await getSession()
  if (!student || student.type !== 'student') return forbidden()

  const { data: registrations, error: registrationError } = await db
    .from('ca1_exam_session_registrations')
    .select('session_id')
    .eq('student_id', student.id)
  if (registrationError) return serverError('Could not load your exam registrations.')

  const registeredIds = new Set((registrations ?? []).map(row => row.session_id))
  const { data: sessions, error } = await db
    .from('ca1_exam_sessions')
    .select('id, label, status, created_at, ca1_exam_definitions!inner(code, title)')
    .in('status', ['registration_open', 'running', 'closed', 'archived'])
    .order('created_at', { ascending: false })
  if (error) return serverError('Could not load exam sessions.')

  const rows = (sessions ?? []) as unknown as SessionRow[]
  return ok({
    open_sessions: rows.filter(row => row.status === 'registration_open').map(row => present(row, registeredIds.has(row.id))),
    registered_sessions: rows.filter(row => registeredIds.has(row.id)).map(row => present(row, true)),
  })
}

export async function POST(request: NextRequest) {
  const student = await getSession()
  if (!student || student.type !== 'student') return forbidden()

  let body: { session_id?: number }
  try { body = await request.json() } catch { return badRequest('Invalid JSON.') }
  if (!Number.isInteger(body.session_id) || (body.session_id ?? 0) <= 0) {
    return badRequest('A valid exam session is required.')
  }

  const { data: examSession, error: sessionError } = await db
    .from('ca1_exam_sessions')
    .select('id, label, status')
    .eq('id', body.session_id)
    .maybeSingle()
  if (sessionError) return serverError('Could not load the exam session.')
  if (!examSession) return badRequest('Exam session not found.')
  if (examSession.status !== 'registration_open') {
    return conflict('registration_closed', 'Registration for this exam is no longer open.')
  }

  const { error } = await db.from('ca1_exam_session_registrations').insert({
    session_id: examSession.id,
    student_id: student.id,
  })
  if (error) {
    if (error.code === '23505') return conflict('already_registered', 'You are already registered for this exam.')
    return serverError('Could not register you for this exam.')
  }

  await audit(`student:${student.prn}`, 'exam_session_registered', `session:${examSession.id}`)
  return ok({ registered: true, session_id: examSession.id })
}
