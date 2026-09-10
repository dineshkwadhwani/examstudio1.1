import { db } from '@/lib/db'
import type { ExamSession } from '@/lib/types'

/**
 * The dashboard prioritises a session currently being prepared or run. Once
 * there is no live session, it falls back only to a session where this student
 * fetched a paper. This prevents non-participants seeing another batch's end
 * screen.
 */
export async function getRelevantStudentSession(studentId: number): Promise<ExamSession | null> {
  const { data: liveSession } = await db
    .from('ca1_exam_sessions')
    .select('*')
    .in('status', ['registration_open', 'running'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (liveSession) return liveSession as ExamSession

  const { data: paper } = await db
    .from('ca1_question_papers')
    .select('session_id')
    .eq('student_id', studentId)
    .order('first_fetched_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!paper) return null

  const { data: completedSession } = await db
    .from('ca1_exam_sessions')
    .select('*')
    .eq('id', paper.session_id)
    .maybeSingle()

  return (completedSession as ExamSession | null)
}
