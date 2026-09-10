import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { db, audit } from '@/lib/db'
import { ok, badRequest, forbidden, err, serverError } from '@/lib/api'
import { requireStaff } from '@/lib/session'
import { runPendingVerifications } from '@/lib/grading'
import { POST_EXAM_VERIFICATION_DELAY_MS, runDueVerifications } from '@/lib/session-lifecycle'

export async function POST(req: NextRequest) {
  let staff
  try { staff = await requireStaff() } catch { return forbidden() }

  let body: {
    action?: string
    submission_id?: number
    override_marks?: number
    reason?: string
    student_id?: number
    session_id?: number
  }
  try { body = await req.json() } catch { return badRequest('Invalid JSON.') }

  const { action } = body

  // ─── Override marks ───────────────────────────────────────
  if (action === 'override_marks') {
    const { submission_id, override_marks, reason } = body
    if (submission_id === undefined) return badRequest('submission_id is required.')
    if (override_marks === undefined) return badRequest('override_marks is required.')
    if (!reason?.trim()) return badRequest('reason is required for an override.')

    const { data: submission } = await db
      .from('ca1_submissions')
      .select('task_no')
      .eq('id', submission_id)
      .maybeSingle()

    if (!submission) return err('not_found', 'Submission not found.', 404)

    const maxMarks: Record<number, number> = { 1: 1, 2: 4, 3: 5 }
    const maximum = maxMarks[submission.task_no]
    if (!Number.isFinite(override_marks) || maximum === undefined || override_marks < 0 || override_marks > maximum) {
      return badRequest(`Override marks for Task ${submission.task_no} must be between 0 and ${maximum}.`)
    }

    const { error } = await db.from('ca1_submissions').update({
      override_marks,
      override_reason: reason.trim(),
      override_by: staff.email,
      override_at: new Date().toISOString(),
    }).eq('id', submission_id)

    if (error) return serverError()

    await audit(`staff:${staff.email}`, 'marks_overridden', `submission:${submission_id}`, {
      override_marks,
      reason,
    })

    return ok({ message: `Marks overridden to ${override_marks}.` })
  }

  // ─── Reset password ───────────────────────────────────────
  if (action === 'reset_password') {
    const { student_id } = body
    if (!student_id) return badRequest('student_id is required.')

    const { data: student } = await db
      .from('ca1_students')
      .select('id, prn, name')
      .eq('id', student_id)
      .single()

    if (!student) return err('not_found', 'Student not found.', 404)

    const tempPassword = 'Tmp@' + Math.random().toString(36).slice(2, 10).toUpperCase()
    const hash = await bcrypt.hash(tempPassword, 12)

    await db.from('ca1_students').update({
      password_hash: hash,
      must_change_password: true,
    }).eq('id', student_id)

    await audit(`staff:${staff.email}`, 'password_reset', `student:${student_id}`, {
      student_prn: student.prn,
    })

    return ok({
      message: `Password reset for ${student.name} (${student.prn}).`,
      temp_password: tempPassword,
      warning: 'Shown once only. Relay to the student in person. They must change it on next login.',
    })
  }

  // ─── Run pending verifications manually ──────────────────
  // SA-triggered: processes all pending/deferred submissions right now,
  // not waiting for the next cron tick. SA-only action.
  if (action === 'run_verifications') {
    if (staff.role !== 'sa') return forbidden('Super Admin access required.')

    const { session_id } = body

    if (!session_id) {
      const sessionIds = await runDueVerifications()
      return ok({
        message: `Verification ran for ${sessionIds.length} session(s) that completed their five-minute settlement period.`,
        session_ids: sessionIds,
      })
    }

    const { data: examSession } = await db
      .from('ca1_exam_sessions')
      .select('status, closed_at')
      .eq('id', session_id)
      .maybeSingle()

    if (!examSession) return err('not_found', 'Exam session not found.', 404)
    if (!['closed', 'archived'].includes(examSession.status) || !examSession.closed_at) {
      return badRequest('Verification starts after the exam session is closed.')
    }

    const eligibleAt = new Date(new Date(examSession.closed_at).getTime() + POST_EXAM_VERIFICATION_DELAY_MS)
    if (new Date() < eligibleAt) {
      return err('verification_waiting', `Verification will start at ${eligibleAt.toISOString()}.`, 409)
    }

    // Count pending before
    let beforeQuery = db
      .from('ca1_submissions')
      .select('*', { count: 'exact', head: true })
      .in('verification_status', ['pending', 'deferred'])
    beforeQuery = beforeQuery.eq('session_id', session_id)
    const { count: before } = await beforeQuery

    await runPendingVerifications(session_id)

    // Count pending after
    let afterQuery = db
      .from('ca1_submissions')
      .select('*', { count: 'exact', head: true })
      .in('verification_status', ['pending', 'deferred'])
    afterQuery = afterQuery.eq('session_id', session_id)
    const { count: after } = await afterQuery

    await audit(`staff:${staff.email}`, 'manual_verification_run', session_id ? `session:${session_id}` : undefined, {
      session_id,
      pending_before: before,
      pending_after: after,
    })

    return ok({
      message: `Verification run complete.`,
      pending_before: before ?? 0,
      pending_after: after ?? 0,
      processed: (before ?? 0) - (after ?? 0),
    })
  }

  // ─── Reset all pending to pending (re-queue deferred) ────
  // Use when Apify/weather was down and deferred rows need re-trying.
  if (action === 'requeue_deferred') {
    if (staff.role !== 'sa') return forbidden('Super Admin access required.')

    const { count } = await db
      .from('ca1_submissions')
      .select('*', { count: 'exact', head: true })
      .eq('verification_status', 'deferred')

    await db.from('ca1_submissions')
      .update({ verification_status: 'pending' })
      .eq('verification_status', 'deferred')

    await audit(`staff:${staff.email}`, 'deferred_requeued', undefined, {
      count,
    })

    return ok({
      message: `${count ?? 0} deferred submission(s) re-queued as pending. Run verifications to process them.`,
      requeued: count ?? 0,
    })
  }

  return badRequest(`Unknown action: ${action}`)
}
