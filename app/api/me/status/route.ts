import { db } from '@/lib/db'
import { ok, forbidden } from '@/lib/api'
import { getSession } from '@/lib/session'
import { getRelevantStudentSession } from '@/lib/student-session'

// Session-cookie version of /api/v1/status — for the student dashboard.
// The exam API key is never available client-side after generation,
// so the dashboard must use this endpoint instead.
export async function GET() {
  const session = await getSession()
  if (!session || session.type !== 'student') return forbidden()

  const studentId = session.id

  const examSession = await getRelevantStudentSession(studentId)

  const showMarks = examSession?.status === 'closed' || examSession?.status === 'archived'

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
    .select('first_fetched_at, fetch_count, rendered_paper')
    .eq('student_id', studentId)
    .eq('session_id', examSession?.id ?? -1)
    .maybeSingle()

  // Submissions
  const { data: submissions } = await db
    .from('ca1_submissions')
    .select('task_no, verification_status, marks_awarded, override_marks, submitted_at, attempt_count')
    .eq('student_id', studentId)
    .eq('session_id', examSession?.id ?? -1)

  // Max marks per task: T1=1, T2=4, T3=5
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

  for (const sub of submissions ?? []) {
    const effective = sub.override_marks !== null ? sub.override_marks : sub.marks_awarded
    taskMap[sub.task_no] = {
      submitted: true,
      status: sub.verification_status,
      marks: showMarks ? effective : null,
      submitted_at: sub.submitted_at,
      attempts: sub.attempt_count,
    }
  }

  const totalMarks = showMarks
    ? (mcqMarks ?? 0) +
      (taskMap[1].marks ?? 0) +
      (taskMap[2].marks ?? 0) +
      (taskMap[3].marks ?? 0)
    : null

  return ok({
    exam_status: examSession?.status ?? 'not_started',
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
    exam_ends_at: examSession?.ends_at ?? null,
  })
}
