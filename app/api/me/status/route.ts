import { db } from '@/lib/db'
import { ok, forbidden } from '@/lib/api'
import { getSession } from '@/lib/session'
import { getRelevantStudentSession } from '@/lib/student-session'
import { closeExpiredSessionsAndVerify } from '@/lib/session-lifecycle'

// Session-cookie version of /api/v1/status — for the student dashboard.
// The exam API key is never available client-side after generation,
// so the dashboard must use this endpoint instead.
export async function GET() {
  const session = await getSession()
  if (!session || session.type !== 'student') return forbidden()

  const studentId = session.id

  await closeExpiredSessionsAndVerify()
  const examSession = await getRelevantStudentSession(studentId)
  // Deadline enforcement is timestamp-based, so students see an ended exam
  // immediately even when no background scheduler has updated the row yet.
  const examExpired = examSession?.status === 'running' && !!examSession.ends_at &&
    new Date(examSession.ends_at) <= new Date()
  const effectiveStatus = examExpired ? 'closed' : examSession?.status

  const showMarks = effectiveStatus === 'closed' || effectiveStatus === 'archived'

  // MCQ status
  const { data: mcqAssignments } = await db
    .from('ca1_mcq_assignments')
    .select('slot_no, answered_key, is_correct')
    .eq('student_id', studentId)
    .eq('session_id', examSession?.id ?? -1)

  const mcqAnswered = (mcqAssignments ?? []).filter(a => a.answered_key !== null).length
  const mcqMarks = showMarks
    ? (mcqAssignments ?? []).filter(a => a.is_correct).length * 0.5
    : null

  // Paper
  const { data: paper } = await db
    .from('ca1_question_papers')
    .select('test_submitted_at, first_fetched_at, fetch_count, rendered_paper')
    .eq('student_id', studentId)
    .eq('session_id', examSession?.id ?? -1)
    .maybeSingle()

  // Submissions
  const { data: submissions } = await db
    .from('ca1_submissions')
    .select('task_no, verification_status, marks_awarded, override_marks, submitted_at, attempt_count, payload')
    .eq('student_id', studentId)
    .eq('session_id', examSession?.id ?? -1)

  // Max marks per task: T1=1, T2=4, T3=5
  const taskMap: Record<number, {
    submitted: boolean
    status: string | null
    marks: number | null
    submitted_at: string | null
    attempts: number
    submitted_colour?: string | null
  }> = {
    1: { submitted: false, status: null, marks: null, submitted_at: null, attempts: 0 },
    2: { submitted: false, status: null, marks: null, submitted_at: null, attempts: 0 },
    3: { submitted: false, status: null, marks: null, submitted_at: null, attempts: 0 },
  }

  for (const sub of submissions ?? []) {
    const effective = sub.override_marks !== null ? sub.override_marks : sub.marks_awarded
    taskMap[sub.task_no] = {
      submitted: true,
      status: 'submitted',
      marks: showMarks ? effective : null,
      submitted_at: sub.submitted_at,
      attempts: sub.attempt_count,
      ...(sub.task_no === 1 ? { submitted_colour: sub.payload?.colour ?? null } : {}),
    }
  }

  const verificationPending = (submissions ?? []).filter(sub =>
    sub.task_no === 2 || sub.task_no === 3
  ).filter(sub => sub.verification_status === 'pending' || sub.verification_status === 'deferred').length
  const finalScoreReady = showMarks && verificationPending === 0

  const totalMarks = finalScoreReady
    ? (mcqMarks ?? 0) +
      (taskMap[1].marks ?? 0) +
      (taskMap[2].marks ?? 0) +
      (taskMap[3].marks ?? 0)
    : null

  return ok({
    session_id: examSession?.id ?? null,
    test_submitted_at: paper?.test_submitted_at ?? null,
    exam_status: effectiveStatus ?? 'not_started',
    mcq: {
      answered: mcqAnswered,
      total: 10,
      complete: mcqAnswered >= 10,
      marks: mcqMarks,
    },
    paper: {
      fetched: !!paper,
      first_fetched_at: paper?.first_fetched_at ?? null,
      fetch_count: paper?.fetch_count ?? 0,
      rendered_paper: paper?.rendered_paper ?? null,
    },
    tasks: taskMap,
    total_marks: totalMarks,
    final_score_ready: finalScoreReady,
    verification_pending: verificationPending,
    exam_ends_at: examSession?.ends_at ?? null,
  })
}
