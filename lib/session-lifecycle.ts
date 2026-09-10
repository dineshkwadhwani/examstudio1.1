import { db, audit } from '@/lib/db'
import { runPendingVerifications } from '@/lib/grading'

/**
 * Closes any elapsed running session exactly once. The successful transition
 * also starts the post-exam verification pass, replacing the old per-minute
 * scheduler. It is safe to call from ordinary polling routes.
 */
export async function closeExpiredSessionsAndVerify(): Promise<number[]> {
  const now = new Date().toISOString()
  const { data: closedSessions, error } = await db
    .from('ca1_exam_sessions')
    .update({ status: 'closed', closed_at: now })
    .eq('status', 'running')
    .lt('ends_at', now)
    .select('id')

  if (error || !closedSessions?.length) return []

  for (const session of closedSessions) {
    await audit('system', 'session_auto_closed', `session:${session.id}`, {
      reason: 'ends_at_passed',
    })
  }

  try {
    await runPendingVerifications()
  } catch (error) {
    console.error('Post-exam verification failed:', error)
    await audit('system', 'post_exam_verification_failed', undefined, {
      session_ids: closedSessions.map(session => session.id),
    })
  }

  return closedSessions.map(session => session.id)
}

export async function verifyAfterManualClose(sessionId: number): Promise<void> {
  try {
    await runPendingVerifications()
    await audit('system', 'post_exam_verification_started', `session:${sessionId}`)
  } catch (error) {
    console.error('Post-exam verification failed:', error)
    await audit('system', 'post_exam_verification_failed', `session:${sessionId}`)
  }
}
