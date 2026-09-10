import { NextRequest } from 'next/server'
import { db, audit } from '@/lib/db'
import { ok, forbidden, err } from '@/lib/api'
import { getSession } from '@/lib/session'

const VALID_COLOURS = ['Red', 'Blue', 'Green', 'Orange']

// Session-cookie version of POST /api/v1/submit/task1 — for the dashboard colour MCQ.
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || session.type !== 'student') return forbidden()

  const { id: studentId, prn } = session

  // Check exam is running
  const { data: examSession } = await db
    .from('ca1_exam_sessions')
    .select('id, status, ends_at')
    .eq('status', 'running')
    .single()

  if (!examSession) return err('exam_not_started', 'Exam not running.', 403)
  if (examSession.ends_at && new Date() > new Date(examSession.ends_at)) {
    return err('exam_ended', 'The exam has ended.', 403)
  }

  let body: { colour?: string }
  try { body = await req.json() } catch {
    return err('bad_request', 'Invalid JSON.', 400)
  }

  const { colour } = body
  if (!colour || !VALID_COLOURS.includes(colour)) {
    return err('bad_request', `colour must be one of: ${VALID_COLOURS.join(', ')}`, 400)
  }

  const { data: paper } = await db
    .from('ca1_question_papers')
    .select('magic_code')
    .eq('student_id', studentId)
    .eq('session_id', examSession.id)
    .maybeSingle()

  if (!paper) return err('paper_not_fetched', 'Fetch your paper first.', 403)

  const isCorrect = colour === paper.magic_code
  const marks = isCorrect ? 1.0 : 0
  const now = new Date().toISOString()

  const { data: existing } = await db
    .from('ca1_submissions')
    .select('id, attempt_count')
    .eq('student_id', studentId)
    .eq('session_id', examSession.id)
    .eq('task_no', 1)
    .maybeSingle()

  const attemptNo = (existing?.attempt_count ?? 0) + 1

  const submissionData = {
    student_id: studentId,
    session_id: examSession.id,
    task_no: 1,
    payload: { colour },
    submitted_at: now,
    attempt_count: attemptNo,
    verification_status: 'verified',
    marks_awarded: marks,
    grading_detail: {
      magic_code: { submitted: colour, expected: paper.magic_code, correct: isCorrect, marks }
    },
  }

  if (existing) {
    await db.from('ca1_submissions').update(submissionData).eq('id', existing.id)
  } else {
    await db.from('ca1_submissions').insert({ ...submissionData, first_submitted_at: now })
  }

  await audit(`student:${prn}`, 'task1_submitted', `student:${studentId}`, {
    colour, correct: isCorrect, attempt: attemptNo,
  })

  return ok({ recorded: true, attempt: attemptNo })
}
