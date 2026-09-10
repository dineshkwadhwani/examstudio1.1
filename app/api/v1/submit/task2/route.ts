import { answerWriteError, checkTestOpen } from '@/lib/test-submission'
import { NextRequest } from 'next/server'
import { db, audit } from '@/lib/db'
import {
  resolveApiKey, getActiveSession, isWithinWindow,
  err, ok, getSourceIp
} from '@/lib/api'
import { getRun } from '@/lib/apify'
import { gradeTask2 } from '@/lib/grading'
import type { Task2Payload } from '@/lib/types'

const MAX_ATTEMPTS = 10

export async function POST(req: NextRequest) {
  // ─── Auth ────────────────────────────────────────────────
  const resolved = await resolveApiKey(req)
  if (resolved instanceof Response) return resolved

  const { studentId, prn } = resolved

  // ─── Exam window ─────────────────────────────────────────
  const session = await getActiveSession()
  if (!session) return err('exam_not_started', 'The exam is not currently running.', 403)
  if (!isWithinWindow(session)) return err('exam_ended', 'The exam has ended.', 403)

  const testError = await checkTestOpen(studentId, session.id)
  if (testError) return testError


  // ─── Parse body ──────────────────────────────────────────
  let body: Partial<Task2Payload>
  try {
    body = await req.json()
  } catch {
    return err('bad_request', 'Invalid JSON body.', 400)
  }

  const { count_total, count_scoped, actor_id, run_id, actor_url } = body

  if (count_total === undefined || count_total === null)
    return err('bad_request', 'count_total is required.', 400)
  if (count_scoped === undefined || count_scoped === null)
    return err('bad_request', 'count_scoped is required.', 400)
  if (!actor_id?.trim()) return err('bad_request', 'actor_id is required (from APIFY_ACTOR_ID).', 400)
  if (!run_id?.trim())   return err('bad_request', 'run_id is required (from APIFY_ACTOR_RUN_ID).', 400)
  if (!actor_url?.trim()) return err('bad_request', 'actor_url is required.', 400)

  if (!Number.isInteger(count_total) || count_total < 0)
    return err('bad_request', 'count_total must be a non-negative integer.', 400)
  if (!Number.isInteger(count_scoped) || count_scoped < 0)
    return err('bad_request', 'count_scoped must be a non-negative integer.', 400)

  // ─── Rate limit attempts ─────────────────────────────────
  const { data: existing } = await db
    .from('ca1_submissions')
    .select('id, attempt_count, first_submitted_at')
    .eq('student_id', studentId)
    .eq('session_id', session.id)
    .eq('task_no', 2)
    .maybeSingle()

  if (existing && existing.attempt_count >= MAX_ATTEMPTS) {
    return err(
      'max_attempts_reached',
      `Maximum of ${MAX_ATTEMPTS} submissions allowed for Task 2.`,
      429
    )
  }

  // ─── Verify same run not submitted by another student ────
  const { data: runConflict } = await db
    .from('ca1_submissions')
    .select('student_id')
    .eq('submitted_run_id', run_id.trim())
    .eq('task_no', 2)
    .neq('student_id', studentId)
    .single()

  if (runConflict) {
    return err(
      'run_already_submitted',
      'This Apify run ID has already been submitted by another student for this task.',
      409
    )
  }

  // ─── Synchronously get Apify user ID ─────────────────────
  let apifyUserId: string | null = null
  let apifyRunStatus: string | null = null
  let rawApifyResponse: unknown = null
  let verificationStatus: 'pending' | 'deferred' = 'pending'

  if (!session.relax_apify_verification) {
    const { run, error } = await getRun(run_id.trim())
    if (run) {
      apifyUserId = run.userId
      apifyRunStatus = run.status
      rawApifyResponse = run

      // Check Apify account not claimed by another student
      if (apifyUserId) {
        const { data: accountConflict } = await db
          .from('ca1_submissions')
          .select('student_id')
          .eq('apify_user_id', apifyUserId)
          .eq('task_no', 2)
          .neq('student_id', studentId)
          .not('verification_status', 'eq', 'failed')
          .single()

        if (accountConflict) {
          // Flag both and reject second
          await db.from('ca1_flags').insert({
            session_id: session.id,
            reason: 'apify_account_shared',
            severity: 'review',
            student_ids: [studentId, accountConflict.student_id],
            detail: {
              apify_user_id: apifyUserId,
              task_no: 2,
              second_student_prn: prn,
            },
          })
          return err(
            'apify_account_already_used',
            'This Apify account has already been used to submit Task 2 by another student. Apify accounts must not be shared. The first submission is credited. All parties will be reviewed.',
            409
          )
        }
      }
    } else {
      // Apify unreachable — defer
      verificationStatus = 'deferred'
      console.warn(`Task 2: Apify unreachable for run ${run_id}: ${error}`)
    }
  }

  const attemptNo = (existing?.attempt_count ?? 0) + 1
  const now = new Date().toISOString()

  // ─── Record attempt ──────────────────────────────────────
  const { error: attemptError } = await db.from('ca1_submission_attempts').insert({
    student_id: studentId,
    session_id: session.id,
    task_no: 2,
    attempt_no: attemptNo,
    payload: body,
    submitted_run_id: run_id.trim(),
    apify_user_id: apifyUserId,
    submitted_at: now,
    source_ip: getSourceIp(req),
  })
  if (attemptError) return answerWriteError(attemptError)


  // ─── Upsert submission ───────────────────────────────────
  const upsertData = {
    student_id: studentId,
    session_id: session.id,
    task_no: 2,
    payload: body,
    submitted_at: now,
    attempt_count: attemptNo,
    source_ip: getSourceIp(req),
    user_agent: req.headers.get('user-agent'),
    submitted_run_id: run_id.trim(),
    submitted_actor_id: actor_id.trim(),
    submitted_actor_url: actor_url.trim(),
    apify_user_id: apifyUserId,
    apify_run_status: apifyRunStatus,
    raw_apify_response: rawApifyResponse,
    verification_status: verificationStatus,
    marks_awarded: null as number | null,
    grading_detail: null,
  }

  if (existing) {
    const { error } = await db.from('ca1_submissions').update(upsertData).eq('id', existing.id)
    if (error) return answerWriteError(error)
  } else {
    const { error } = await db.from('ca1_submissions').insert({
      ...upsertData,
      first_submitted_at: now,
    })
    if (error) return answerWriteError(error)
  }

  // ─── Get submission ID for grading ──────────────────────
  const { data: submission } = await db
    .from('ca1_submissions')
    .select('id')
    .eq('student_id', studentId)
    .eq('session_id', session.id)
    .eq('task_no', 2)
    .maybeSingle()

  if (submission && verificationStatus === 'pending') {
    // Get paper for reference values
    const { data: paper } = await db
      .from('ca1_question_papers')
      .select('t2_expected_total, t2_expected_scoped')
      .eq('student_id', studentId)
      .eq('session_id', session.id)
      .maybeSingle()

    if (paper) {
      // Grade asynchronously — don't block the response
      gradeTask2(
        submission.id,
        body as Task2Payload,
        session,
        paper.t2_expected_total,
        paper.t2_expected_scoped
      ).catch(e => console.error('gradeTask2 error:', e))
    }
  }

  await audit(`student:${prn}`, 'task2_submitted', `student:${studentId}`, {
    attempt: attemptNo,
    run_id: run_id.trim(),
  })

  return ok({
    status: 'received',
    task: 2,
    attempt: attemptNo,
    submitted_at: now,
    note: 'Verification pending. Your latest submission is the one graded.',
  }, 202)
}
