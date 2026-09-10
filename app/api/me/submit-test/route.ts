import { NextRequest } from 'next/server'
import { db, audit } from '@/lib/db'
import { getSession } from '@/lib/session'
import { getActiveSession, isWithinWindow, ok, err, forbidden, serverError } from '@/lib/api'

export async function POST(req: NextRequest) {
  const student = await getSession()
  if (!student || student.type !== 'student') return forbidden()
  let body: { session_id?: number }
  try { body = await req.json() } catch { return err('bad_request', 'Invalid JSON.', 400) }
  const session = await getActiveSession()
  if (!session || !isWithinWindow(session)) return err('exam_ended', 'The exam is not running.', 403)
  if (body.session_id !== session.id) return err('session_changed', 'Your exam session has changed. Refresh the page.', 409)

  const { data, error } = await db.from('ca1_question_papers')
    .update({ test_submitted_at: new Date().toISOString() })
    .eq('student_id', student.id).eq('session_id', session.id)
    .is('test_submitted_at', null).select('test_submitted_at').maybeSingle()
  if (error) return serverError('Could not submit your test. Please try again.')
  if (!data) {
    const { data: existing, error: readError } = await db.from('ca1_question_papers')
      .select('test_submitted_at').eq('student_id', student.id)
      .eq('session_id', session.id).maybeSingle()
    if (readError) return serverError('Could not check test status. Please try again.')
    if (existing?.test_submitted_at) return ok({ submitted: true, submitted_at: existing.test_submitted_at })
    return err('paper_not_fetched', 'Fetch your paper before submitting your test.', 403)
  }
  await audit(`student:${student.prn}`, 'test_submitted', `session:${session.id}`)
  return ok({ submitted: true, submitted_at: data.test_submitted_at })
}
