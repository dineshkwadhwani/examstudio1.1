import { NextRequest } from 'next/server'
import { runPendingVerifications } from '@/lib/grading'
import { db } from '@/lib/db'

// This endpoint is called by Vercel Cron (configured in vercel.json)
// Also auto-closes expired sessions
export async function GET(req: NextRequest) {
  // Basic security — Vercel adds this header for cron calls
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  // Auto-close expired sessions
  const now = new Date().toISOString()
  const { data: expired } = await db
    .from('ca1_exam_sessions')
    .select('id')
    .eq('status', 'running')
    .lt('ends_at', now)

  for (const s of (expired ?? [])) {
    await db.from('ca1_exam_sessions').update({
      status: 'closed',
      closed_at: now,
    }).eq('id', s.id)

    await db.from('ca1_audit_log').insert({
      actor: 'system',
      action: 'session_auto_closed',
      target: `session:${s.id}`,
      detail: { reason: 'ends_at_passed' },
    })
  }

  // Run pending verifications
  await runPendingVerifications()

  return new Response(JSON.stringify({ ok: true, ran_at: now }), {
    headers: { 'Content-Type': 'application/json' },
  })
}
