import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { resolveApiKey, err, ok } from '@/lib/api'
import { getRelevantStudentSession } from '@/lib/student-session'

export async function GET(req: NextRequest) {
  const resolved = await resolveApiKey(req)
  if (!resolved) return err('unauthorized', 'Valid X-API-Key header required.', 401)

  const { studentId } = resolved
  const session = await getRelevantStudentSession(studentId)

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
  if (session?.status === 'closed' || session?.status === 'archived') {
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
      (session?.status === 'closed' || session?.status === 'archived')

    taskMap[sub.task_no] = {
      submitted: true,
      status: sub.verification_status,
      marks: showMarks ? effectiveMarks : null,
      submitted_at: sub.submitted_at,
      attempts: sub.attempt_count,
    }
  }

  const totalMarks = session?.status === 'closed' || session?.status === 'archived'
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
    exam_ends_at: session?.ends_at ?? null,
  })
}
