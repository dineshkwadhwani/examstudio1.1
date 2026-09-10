import { db, audit } from './db'
import { verifyRun, getDatasetItems, getActorSource } from './apify'
import { getCurrentTemperature } from './weather'
import type { ExamSession, Task2Payload, Task3Payload } from './types'

// ─── Effective marks ─────────────────────────────────────────
export function effectiveMarks(
  marks_awarded: number | null,
  override_marks: number | null
): number | null {
  if (override_marks !== null) return override_marks
  return marks_awarded
}

// ─── Task 1 ──────────────────────────────────────────────────
// Task 1 (magic code colour) is graded in /api/v1/submit/task1/route.ts
// No auto-award on paper fetch any more.

// ─── Grade Task 2 ────────────────────────────────────────────
export async function gradeTask2(
  submissionId: number,
  payload: Task2Payload,
  session: ExamSession,
  expectedTotal: number,
  expectedScoped: number
) {
  // Verify Apify run
  const verification = await verifyRun({
    runId: payload.run_id,
    expectedActorId: payload.actor_id,
    sessionStartedAt: session.started_at!,
    sessionEndsAt: session.ends_at!,
    relaxVerification: session.relax_apify_verification,
  })

  if (verification.deferred) {
    await db.from('ca1_submissions').update({
      verification_status: 'deferred',
      apify_user_id: verification.userId,
      apify_run_status: 'unknown',
      raw_apify_response: { error: verification.error },
    }).eq('id', submissionId)
    return
  }

  let apifyRunOk = verification.ok
  let datasetItems: Record<string, unknown>[] = []
  let datasetMatchOk = false

  if (apifyRunOk && verification.datasetId) {
    const ds = await getDatasetItems(verification.datasetId)
    datasetItems = ds.items
    // Check dataset contains matching counts
    const hasMatch = datasetItems.some(
      (item) =>
        item.count_total === payload.count_total &&
        item.count_scoped === payload.count_scoped
    )
    datasetMatchOk = hasMatch
    if (!hasMatch && datasetItems.length > 0) {
      apifyRunOk = false
    }
  }

  // Count marks
  const countTotalCorrect = payload.count_total === expectedTotal
  const countScopedCorrect = payload.count_scoped === expectedScoped

  let marks = 0
  const detail: Record<string, unknown> = {}

  if (countTotalCorrect) {
    marks += 1.5
    detail.count_total = { marks: 1.5, submitted: payload.count_total, expected: expectedTotal, correct: true }
  } else {
    detail.count_total = { marks: 0, submitted: payload.count_total, expected: expectedTotal, correct: false }
  }

  if (countScopedCorrect) {
    marks += 1.5
    detail.count_scoped = { marks: 1.5, submitted: payload.count_scoped, expected: expectedScoped, correct: true }
  } else {
    detail.count_scoped = { marks: 0, submitted: payload.count_scoped, expected: expectedScoped, correct: false }
  }

  if (apifyRunOk) {
    marks += 1.0
    detail.apify_run = { marks: 1.0, verified: true }
  } else {
    detail.apify_run = { marks: 0, verified: false, error: verification.error }
  }

  // Fetch source for key-hardcoded check
  const sourceSnapshot = await getActorSource(payload.actor_url)
  const keyPrefix = 'exk_live'
  const keyHardcoded = sourceSnapshot ? sourceSnapshot.includes(keyPrefix) : null

  await db.from('ca1_submissions').update({
    verification_status: 'verified',
    marks_awarded: marks,
    grading_detail: detail,
    apify_user_id: verification.userId,
    apify_run_status: verification.rawRun?.status ?? null,
    apify_finished_at: verification.finishedAt,
    apify_dataset_items: datasetItems,
    raw_apify_response: verification.rawRun,
    source_snapshot: sourceSnapshot,
    source_fetched_at: new Date().toISOString(),
    key_hardcoded: keyHardcoded,
  }).eq('id', submissionId)
}

// ─── Grade Task 3 ────────────────────────────────────────────
export async function gradeTask3(
  submissionId: number,
  payload: Task3Payload,
  session: ExamSession,
  expectedCity: string,
  lat: number,
  lon: number
) {
  // Verify Apify run
  const verification = await verifyRun({
    runId: payload.run_id,
    expectedActorId: payload.actor_id,
    sessionStartedAt: session.started_at!,
    sessionEndsAt: session.ends_at!,
    relaxVerification: session.relax_apify_verification,
  })

  if (verification.deferred) {
    await db.from('ca1_submissions').update({
      verification_status: 'deferred',
      apify_user_id: verification.userId,
      raw_apify_response: { error: verification.error },
    }).eq('id', submissionId)
    return
  }

  // Get server-side temperature
  const weather = await getCurrentTemperature(lat, lon)

  const cityCorrect =
    payload.city.trim().toLowerCase() === expectedCity.trim().toLowerCase()

  let temperatureCorrect = false
  const TOLERANCE = 2.0
  if (weather.temperature_c !== null) {
    temperatureCorrect = Math.abs(payload.temperature_c - weather.temperature_c) <= TOLERANCE
  }

  const apifyRunOk = verification.ok

  let marks = 0
  const detail: Record<string, unknown> = {}

  // Apify run is a gate — if it fails, still grade the content
  if (!apifyRunOk) {
    detail.apify_run = { verified: false, error: verification.error }
  } else {
    detail.apify_run = { verified: true }
  }

  if (cityCorrect) {
    marks += 2.0
    detail.city = { marks: 2.0, submitted: payload.city, expected: expectedCity, correct: true }
  } else {
    detail.city = { marks: 0, submitted: payload.city, expected: expectedCity, correct: false }
  }

  if (temperatureCorrect) {
    marks += 3.0
    detail.temperature = {
      marks: 3.0,
      submitted: payload.temperature_c,
      server_reading: weather.temperature_c,
      tolerance: TOLERANCE,
      correct: true,
    }
  } else {
    detail.temperature = {
      marks: 0,
      submitted: payload.temperature_c,
      server_reading: weather.temperature_c,
      tolerance: TOLERANCE,
      correct: false,
      weather_error: weather.error,
    }
  }

  // If weather API was unreachable, defer temperature grading
  if (weather.temperature_c === null) {
    await db.from('ca1_submissions').update({
      verification_status: 'deferred',
      server_reference: { read_at: weather.read_at, error: weather.error },
      apify_user_id: verification.userId,
      apify_run_status: verification.rawRun?.status ?? null,
      apify_finished_at: verification.finishedAt,
      raw_apify_response: verification.rawRun,
      grading_detail: detail,
    }).eq('id', submissionId)
    return
  }

  const sourceSnapshot = await getActorSource(payload.actor_url)
  const keyHardcoded = sourceSnapshot ? sourceSnapshot.includes('exk_live') : null

  await db.from('ca1_submissions').update({
    verification_status: 'verified',
    marks_awarded: marks,
    grading_detail: detail,
    apify_user_id: verification.userId,
    apify_run_status: verification.rawRun?.status ?? null,
    apify_finished_at: verification.finishedAt,
    raw_apify_response: verification.rawRun,
    source_snapshot: sourceSnapshot,
    source_fetched_at: new Date().toISOString(),
    key_hardcoded: keyHardcoded,
    server_reference: {
      temperature_c: weather.temperature_c,
      read_at: weather.read_at,
      raw: weather.raw,
    },
  }).eq('id', submissionId)
}

// ─── Run pending verifications ────────────────────────────────
export async function runPendingVerifications() {
  const { data: pending } = await db
    .from('ca1_submissions')
    .select(`
      id, student_id, task_no, payload,
      submitted_run_id, submitted_actor_id, submitted_actor_url,
      ca1_question_papers!inner(
        t2_expected_total, t2_expected_scoped,
        t3_city, t3_lat, t3_lon,
        session_id
      )
    `)
    .in('verification_status', ['pending', 'deferred'])
    .in('task_no', [2, 3])
    .limit(20)

  if (!pending?.length) return

  for (const sub of pending) {
    const paper = (sub as Record<string, unknown>).ca1_question_papers as Record<string, unknown>
    const sessionId = paper.session_id as number

    const { data: session } = await db
      .from('ca1_exam_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()

    if (!session) continue

    if (sub.task_no === 2) {
      await gradeTask2(
        sub.id,
        sub.payload as Task2Payload,
        session,
        paper.t2_expected_total as number,
        paper.t2_expected_scoped as number
      )
    } else if (sub.task_no === 3) {
      await gradeTask3(
        sub.id,
        sub.payload as Task3Payload,
        session,
        paper.t3_city as string,
        paper.t3_lat as number,
        paper.t3_lon as number
      )
    }
  }
}
