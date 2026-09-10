import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { db, audit } from '@/lib/db'
import { ok, badRequest, forbidden, err, serverError } from '@/lib/api'
import { requireStaff } from '@/lib/session'
import { runPendingVerifications } from '@/lib/grading'

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

    // Count pending before
    const { count: before } = await db
      .from('ca1_submissions')
      .select('*', { count: 'exact', head: true })
      .in('verification_status', ['pending', 'deferred'])

    await runPendingVerifications()

    // Count pending after
    const { count: after } = await db
      .from('ca1_submissions')
      .select('*', { count: 'exact', head: true })
      .in('verification_status', ['pending', 'deferred'])

    await audit(`staff:${staff.email}`, 'manual_verification_run', undefined, {
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
