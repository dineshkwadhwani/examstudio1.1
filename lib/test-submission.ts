import { db } from '@/lib/db'
import { err, serverError } from '@/lib/api'

export async function checkTestOpen(studentId: number, sessionId: number) {
  const { data, error } = await db.from('ca1_question_papers')
    .select('test_submitted_at')
    .eq('student_id', studentId).eq('session_id', sessionId).maybeSingle()
  if (error) return serverError('Could not check test status. Please try again.')
  if (data?.test_submitted_at) {
    return err('test_submitted', 'You have submitted your test. No further answers are accepted.', 403)
  }
  return null
}

export function answerWriteError(error: { message: string }) {
  if (error.message.includes('Test already submitted')) {
    return err('test_submitted', 'You have submitted your test. No further answers are accepted.', 403)
  }
  return serverError('Could not save your answer. Please try again.')
}
