import { db, audit } from '@/lib/db'
import { runPendingVerifications } from '@/lib/grading'

export const POST_EXAM_VERIFICATION_DELAY_MS = 5 * 60 * 1000

/**
 * Grades submissions only after Apify has had time to settle a just-finished
 * run and write its dataset. Calling this repeatedly is safe: only pending or
 * deferred submissions are processed.
 */
export async function runDueVerifications(): Promise<number[]> {
  const dueBefore = new Date(Date.now() - POST_EXAM_VERIFICATION_DELAY_MS).toISOString()
  const { data: sessions, error } = await db
    .from('ca1_exam_sessions')
    .select('id')
    .in('status', ['closed', 'archived'])
    .not('closed_at', 'is', null)
    .lte('closed_at', dueBefore)

  if (error || !sessions?.length) return []

  for (const session of sessions) {
    await runPendingVerifications(session.id)
  }

  return sessions.map(session => session.id)
}

/**
 * Closes any elapsed running session exactly once. The successful transition
 * schedules the post-exam verification pass. It is safe to call from
 * ordinary polling routes.
 */
export async function closeExpiredSessionsAndVerify(): Promise<number[]> {
  const now = new Date().toISOString()
  const { data: closedSessions, error } = await db
    .from('ca1_exam_sessions')
    .update({ status: 'closed', closed_at: now })
    .eq('status', 'running')
    .lt('ends_at', now)
    .select('id')

  if (error) return []

  for (const session of closedSessions ?? []) {
    await audit('system', 'session_auto_closed', `session:${session.id}`, {
      reason: 'ends_at_passed',
    })
  }

  try {
    await runDueVerifications()
  } catch (error) {
    console.error('Delayed post-exam verification failed:', error)
    await audit('system', 'post_exam_verification_failed', undefined, {
      session_ids: (closedSessions ?? []).map(session => session.id),
    })
  }

  return (closedSessions ?? []).map(session => session.id)
}

export async function verifyAfterManualClose(sessionId: number): Promise<void> {
  const eligibleAt = new Date(Date.now() + POST_EXAM_VERIFICATION_DELAY_MS).toISOString()
  await audit('system', 'post_exam_verification_scheduled', `session:${sessionId}`, {
    eligible_at: eligibleAt,
  })
}
