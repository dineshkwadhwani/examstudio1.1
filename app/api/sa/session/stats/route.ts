import { db } from '@/lib/db'
import { ok, forbidden } from '@/lib/api'
import { requireStaff } from '@/lib/session'

export async function GET() {
  try { await requireStaff() } catch { return forbidden() }

  const { data: session } = await db
    .from('ca1_exam_sessions')
    .select('id, status, ends_at, started_at')
    .eq('status', 'running')
    .single()

  const sessionId = session?.id

  const [
    { count: registered },
    { count: mcqComplete },
    { count: papersFetched },
    { count: task1 },
    { count: task2 },
    { count: task3 },
    { count: pending },
    { count: openFlags },
  ] = await Promise.all([
    db.from('ca1_students').select('*', { count: 'exact', head: true }),
    db.from('ca1_mcq_assignments')
      .select('student_id', { count: 'exact', head: true })
      .not('answered_key', 'is', null),
    db.from('ca1_question_papers').select('*', { count: 'exact', head: true }),
    db.from('ca1_submissions').select('*', { count: 'exact', head: true }).eq('task_no', 1),
    db.from('ca1_submissions').select('*', { count: 'exact', head: true }).eq('task_no', 2),
    db.from('ca1_submissions').select('*', { count: 'exact', head: true }).eq('task_no', 3),
    db.from('ca1_submissions')
      .select('*', { count: 'exact', head: true })
      .in('verification_status', ['pending', 'deferred']),
    db.from('ca1_flags')
      .select('*', { count: 'exact', head: true })
      .eq('resolved', false),
  ])

  const secondsRemaining = session?.ends_at
    ? Math.max(0, Math.floor((new Date(session.ends_at).getTime() - Date.now()) / 1000))
    : null

  return ok({
    session_status: session?.status ?? 'none',
    registered,
    mcq_complete: mcqComplete,
    papers_fetched: papersFetched,
    task1_submitted: task1,
    task2_submitted: task2,
    task3_submitted: task3,
    verification_pending: pending,
    flags_open: openFlags,
    seconds_remaining: secondsRemaining,
    ends_at: session?.ends_at,
  })
}
