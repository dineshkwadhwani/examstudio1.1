import { NextRequest } from 'next/server'
import { db, audit } from '@/lib/db'
import { resolveApiKey, getActiveSession, isWithinWindow, err, ok } from '@/lib/api'

const VALID_COLOURS = ['Red', 'Blue', 'Green', 'Orange']

export async function POST(req: NextRequest) {
  const resolved = await resolveApiKey(req)
  if (!resolved) return err('unauthorized', 'Valid X-API-Key header required.', 401)

  const { studentId, prn } = resolved

  const session = await getActiveSession()
  if (!session) return err('exam_not_started', 'The exam is not currently running.', 403)
  if (!isWithinWindow(session)) return err('exam_ended', 'The exam has ended.', 403)

  let body: { colour?: string }
  try { body = await req.json() } catch {
    return err('bad_request', 'Invalid JSON.', 400)
  }

  const { colour } = body
  if (!colour || !VALID_COLOURS.includes(colour)) {
    return err('bad_request', `colour must be one of: ${VALID_COLOURS.join(', ')}`, 400)
  }

  // Get student's paper to check magic code
  const { data: paper } = await db
    .from('ca1_question_papers')
    .select('magic_code')
    .eq('student_id', studentId)
    .eq('session_id', session.id)
    .maybeSingle()

  if (!paper) {
    return err('paper_not_fetched',
      'Fetch your paper first via GET /api/v1/paper with your API key.', 403)
  }

  const isCorrect = colour === paper.magic_code
  const marks = isCorrect ? 1.0 : 0

  // Upsert submission
  const { data: existing } = await db
    .from('ca1_submissions')
    .select('id, attempt_count, first_submitted_at')
    .eq('student_id', studentId)
    .eq('session_id', session.id)
    .eq('task_no', 1)
    .maybeSingle()

  const now = new Date().toISOString()
  const attemptNo = (existing?.attempt_count ?? 0) + 1

  const submissionData = {
    student_id: studentId,
    session_id: session.id,
    task_no: 1,
    payload: { colour },
    submitted_at: now,
    attempt_count: attemptNo,
    verification_status: 'verified',
    marks_awarded: marks,
    grading_detail: {
      magic_code: {
        submitted: colour,
        expected: paper.magic_code,
        correct: isCorrect,
        marks,
      }
    },
  }

  if (existing) {
    await db.from('ca1_submissions').update(submissionData).eq('id', existing.id)
  } else {
    await db.from('ca1_submissions').insert({
      ...submissionData,
      first_submitted_at: now,
    })
  }

  await audit(`student:${prn}`, 'task1_submitted', `student:${studentId}`, {
    colour, correct: isCorrect, attempt: attemptNo,
  })

  // Return 202 — consistent with other tasks, marks hidden until close
  return ok({
    status: 'received',
    task: 1,
    attempt: attemptNo,
    submitted_at: now,
    note: 'Your answer has been recorded.',
  }, 202)
}
