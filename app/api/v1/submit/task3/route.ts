import { NextRequest } from 'next/server'
import { db, audit } from '@/lib/db'
import {
  resolveApiKey, getActiveSession, isWithinWindow,
  err, ok, serverError, getSourceIp
} from '@/lib/api'
import { getRun } from '@/lib/apify'
import { gradeTask3 } from '@/lib/grading'
import type { Task3Payload } from '@/lib/types'

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

  // ─── Parse body ──────────────────────────────────────────
  let body: Partial<Task3Payload>
  try {
    body = await req.json()
  } catch {
    return err('bad_request', 'Invalid JSON body.', 400)
  }

  const { city, temperature_c, actor_id, run_id, actor_url } = body

  if (!city?.trim())             return err('bad_request', 'city is required.', 400)
  if (temperature_c === undefined || temperature_c === null)
                                 return err('bad_request', 'temperature_c is required.', 400)
  if (!actor_id?.trim())         return err('bad_request', 'actor_id is required.', 400)
  if (!run_id?.trim())           return err('bad_request', 'run_id is required.', 400)
  if (!actor_url?.trim())        return err('bad_request', 'actor_url is required.', 400)

  if (typeof temperature_c !== 'number' || !isFinite(temperature_c)) {
    return err('bad_request', 'temperature_c must be a finite number.', 400)
  }

  // ─── Rate limit attempts ─────────────────────────────────
  const { data: existing } = await db
    .from('ca1_submissions')
    .select('id, attempt_count, first_submitted_at')
    .eq('student_id', studentId)
    .eq('session_id', session.id)
    .eq('task_no', 3)
    .maybeSingle()

  if (existing && existing.attempt_count >= MAX_ATTEMPTS) {
    return err('max_attempts_reached', `Maximum of ${MAX_ATTEMPTS} submissions allowed for Task 3.`, 429)
  }

  // ─── Check run not submitted by another student ──────────
  const { data: runConflict } = await db
    .from('ca1_submissions')
    .select('student_id')
    .eq('submitted_run_id', run_id.trim())
    .eq('task_no', 3)
    .neq('student_id', studentId)
    .single()

  if (runConflict) {
    return err('run_already_submitted', 'This run ID has already been submitted by another student.', 409)
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

      if (apifyUserId) {
        const { data: accountConflict } = await db
          .from('ca1_submissions')
          .select('student_id')
          .eq('apify_user_id', apifyUserId)
          .eq('task_no', 3)
          .neq('student_id', studentId)
          .not('verification_status', 'eq', 'failed')
          .single()

        if (accountConflict) {
          await db.from('ca1_flags').insert({
            session_id: session.id,
            reason: 'apify_account_shared',
            severity: 'review',
            student_ids: [studentId, accountConflict.student_id],
            detail: { apify_user_id: apifyUserId, task_no: 3, second_student_prn: prn },
          })
          return err(
            'apify_account_already_used',
            'This Apify account has already been used to submit Task 3 by another student.',
            409
          )
        }
      }
    } else {
      verificationStatus = 'deferred'
      console.warn(`Task 3: Apify unreachable for run ${run_id}: ${error}`)
    }
  }

  const attemptNo = (existing?.attempt_count ?? 0) + 1
  const now = new Date().toISOString()

  // ─── Record attempt ──────────────────────────────────────
  await db.from('ca1_submission_attempts').insert({
    student_id: studentId,
    session_id: session.id,
    task_no: 3,
    attempt_no: attemptNo,
    payload: body,
    submitted_run_id: run_id.trim(),
    apify_user_id: apifyUserId,
    submitted_at: now,
    source_ip: getSourceIp(req),
  })

  // ─── Upsert submission ───────────────────────────────────
  const upsertData = {
    student_id: studentId,
    session_id: session.id,
    task_no: 3,
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
    await db.from('ca1_submissions').update(upsertData).eq('id', existing.id)
  } else {
    await db.from('ca1_submissions').insert({ ...upsertData, first_submitted_at: now })
  }

  const { data: submission } = await db
    .from('ca1_submissions')
    .select('id')
    .eq('student_id', studentId)
    .eq('session_id', session.id)
    .eq('task_no', 3)
    .maybeSingle()

  if (submission && verificationStatus === 'pending') {
    const { data: paper } = await db
      .from('ca1_question_papers')
      .select('t3_city, t3_lat, t3_lon')
      .eq('student_id', studentId)
      .eq('session_id', session.id)
      .maybeSingle()

    if (paper) {
      gradeTask3(
        submission.id,
        body as Task3Payload,
        session,
        paper.t3_city,
        paper.t3_lat,
        paper.t3_lon
      ).catch(e => console.error('gradeTask3 error:', e))
    }
  }

  await audit(`student:${prn}`, 'task3_submitted', `student:${studentId}`, {
    attempt: attemptNo,
    run_id: run_id.trim(),
    city: city.trim(),
  })

  return ok({
    status: 'received',
    task: 3,
    attempt: attemptNo,
    submitted_at: now,
    note: 'Verification pending. Your latest submission is the one graded.',
  }, 202)
}
