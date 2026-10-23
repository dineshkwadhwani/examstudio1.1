import { db } from '@/lib/db'
import type { ExamSession } from '@/lib/types'

async function getRegisteredSessionIds(studentId: number): Promise<number[]> {
  const { data, error } = await db
    .from('ca1_exam_session_registrations')
    .select('session_id')
    .eq('student_id', studentId)

  if (error) return []
  return (data ?? []).map(row => row.session_id)
}

export async function getRegisteredRunningSession(studentId: number): Promise<ExamSession | null> {
  const ids = await getRegisteredSessionIds(studentId)
  if (ids.length === 0) return null

  const { data } = await db
    .from('ca1_exam_sessions')
    .select('*')
    .in('id', ids)
    .eq('status', 'running')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (data as ExamSession | null)
}

/** Return the student's registered running/open session, never another
 * student's globally active session. */
export async function getRelevantStudentSession(studentId: number): Promise<ExamSession | null> {
  const ids = await getRegisteredSessionIds(studentId)
  if (ids.length === 0) return null

  const { data: runningSession } = await db
    .from('ca1_exam_sessions')
    .select('*')
    .in('id', ids)
    .eq('status', 'running')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (runningSession) return runningSession as ExamSession

  const { data: registrationSession } = await db
    .from('ca1_exam_sessions')
    .select('*')
    .in('id', ids)
    .eq('status', 'registration_open')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (registrationSession) return registrationSession as ExamSession

  const { data: completedSession } = await db
    .from('ca1_exam_sessions')
    .select('*')
    .in('id', ids)
    .in('status', ['closed', 'archived'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (completedSession as ExamSession | null)
}
