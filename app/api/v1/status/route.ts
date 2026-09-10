import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { resolveApiKey, ok } from '@/lib/api'
import { getRelevantStudentSession } from '@/lib/student-session'
import { closeExpiredSessionsAndVerify } from '@/lib/session-lifecycle'

export async function GET(req: NextRequest) {
  const resolved = await resolveApiKey(req)
  if (resolved instanceof Response) return resolved

  const { studentId } = resolved
  await closeExpiredSessionsAndVerify()
  const session = await getRelevantStudentSession(studentId)
  const examExpired = session?.status === 'running' && !!session.ends_at &&
    new Date(session.ends_at) <= new Date()
  const effectiveStatus = examExpired ? 'closed' : session?.status

  // MCQ status
  const { data: mcqAssignments } = await db
    .from('ca1_mcq_assignments')
    .select('slot_no, answered_key, is_correct')
    .eq('student_id', studentId)
    .eq('session_id', session?.id ?? -1)

  const mcqAnswered = (mcqAssignments ?? []).filter(a => a.answered_key !== null).length
  const mcqTotal = 10

  // MCQ marks (only after session closed)
  let mcqMarks: number | null = null
  if (effectiveStatus === 'closed' || effectiveStatus === 'archived') {
    mcqMarks = (mcqAssignments ?? []).filter(a => a.is_correct).length * 0.5
  }

  // Paper status
  const { data: paper } = await db
    .from('ca1_question_papers')
    .select('first_fetched_at, fetch_count')
    .eq('student_id', studentId)
    .eq('session_id', session?.id ?? -1)
    .maybeSingle()

  // Task submissions
  const { data: submissions } = await db
    .from('ca1_submissions')
    .select('task_no, verification_status, marks_awarded, override_marks, submitted_at, attempt_count')
    .eq('student_id', studentId)
    .eq('session_id', session?.id ?? -1)

  const taskMap: Record<number, {
    submitted: boolean
    status: string | null
    marks: number | null
    submitted_at: string | null
    attempts: number
  }> = {
    1: { submitted: false, status: null, marks: null, submitted_at: null, attempts: 0 },
    2: { submitted: false, status: null, marks: null, submitted_at: null, attempts: 0 },
    3: { submitted: false, status: null, marks: null, submitted_at: null, attempts: 0 },
  }

  for (const sub of (submissions ?? [])) {
    const effectiveMarks = sub.override_marks !== null ? sub.override_marks : sub.marks_awarded
    const showMarks = sub.verification_status === 'verified' &&
      (effectiveStatus === 'closed' || effectiveStatus === 'archived')

    taskMap[sub.task_no] = {
      submitted: true,
      status: 'submitted',
      marks: showMarks ? effectiveMarks : null,
      submitted_at: sub.submitted_at,
      attempts: sub.attempt_count,
    }
  }

  const verificationPending = (submissions ?? []).filter(sub =>
    sub.task_no === 2 || sub.task_no === 3
  ).filter(sub => sub.verification_status === 'pending' || sub.verification_status === 'deferred').length
  const finalScoreReady = (effectiveStatus === 'closed' || effectiveStatus === 'archived') && verificationPending === 0

  const totalMarks = finalScoreReady
    ? (mcqMarks ?? 0) +
      (taskMap[1].marks ?? 0) +
      (taskMap[2].marks ?? 0) +
      (taskMap[3].marks ?? 0)
    : null

  return ok({
    mcq: {
      answered: mcqAnswered,
      total: mcqTotal,
      complete: mcqAnswered >= mcqTotal,
      marks: mcqMarks,
    },
    paper: {
      fetched: !!paper,
      first_fetched_at: paper?.first_fetched_at ?? null,
      fetch_count: paper?.fetch_count ?? 0,
    },
    tasks: taskMap,
    total_marks: totalMarks,
    final_score_ready: finalScoreReady,
    verification_pending: verificationPending,
    exam_ends_at: session?.ends_at ?? null,
  })
}
