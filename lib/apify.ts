const APIFY_BASE = 'https://api.apify.com/v2'
const TOKEN = process.env.APIFY_API_TOKEN

function headers() {
  if (!TOKEN) return {}
  return { Authorization: `Bearer ${TOKEN}` }
}

export interface ApifyRun {
  id: string
  actId: string
  userId: string
  status: string
  startedAt: string
  finishedAt: string | null
  defaultDatasetId: string
  defaultKeyValueStoreId: string
}

export interface ApifyRunResult {
  run: ApifyRun | null
  error: string | null
}

export async function getRun(runId: string): Promise<ApifyRunResult> {
  try {
    const controller = new AbortController()
    setTimeout(() => controller.abort(), 10_000)
    const res = await fetch(`${APIFY_BASE}/actor-runs/${runId}`, {
      headers: headers() as Record<string, string>,
      signal: controller.signal,
    })
    if (!res.ok) {
      return { run: null, error: `Apify returned ${res.status}` }
    }
    const json = await res.json()
    return { run: json.data as ApifyRun, error: null }
  } catch (e) {
    return { run: null, error: String(e) }
  }
}

export interface DatasetItems {
  items: Record<string, unknown>[]
  error: string | null
}

export async function getDatasetItems(datasetId: string): Promise<DatasetItems> {
  try {
    const ctrl2 = new AbortController()
    setTimeout(() => ctrl2.abort(), 10_000)
    const res = await fetch(
      `${APIFY_BASE}/datasets/${datasetId}/items?format=json`,
      {
        headers: headers() as Record<string, string>,
        signal: ctrl2.signal,
      }
    )
    if (!res.ok) return { items: [], error: `Apify returned ${res.status}` }
    const items = await res.json()
    return { items: Array.isArray(items) ? items : [], error: null }
  } catch (e) {
    return { items: [], error: String(e) }
  }
}

export async function getActorSource(actorUrl: string): Promise<string | null> {
  // actorUrl is like https://apify.com/username/actor-name
  // We fetch the actor's default build source via the API
  try {
    const parts = actorUrl.replace('https://apify.com/', '').split('/')
    if (parts.length < 2) return null
    const [username, actorName] = parts
    const ctrl3 = new AbortController()
    setTimeout(() => ctrl3.abort(), 10_000)
    const res = await fetch(
      `${APIFY_BASE}/acts/${username}~${actorName}`,
      {
        headers: headers() as Record<string, string>,
        signal: ctrl3.signal,
      }
    )
    if (!res.ok) return null
    const json = await res.json()
    // Return a summary string — we don't get raw source without extra calls
    return JSON.stringify(json.data?.versions?.[0] ?? {})
  } catch {
    return null
  }
}

// ─── Verify a run belongs to the exam window ─────────────────
export interface VerifyRunParams {
  runId: string
  expectedActorId: string
  sessionStartedAt: string
  sessionEndsAt: string
  relaxVerification: boolean
}

export interface VerifyRunResult {
  ok: boolean
  userId: string | null
  finishedAt: string | null
  datasetId: string | null
  rawRun: ApifyRun | null
  error: string | null
  deferred: boolean
}

export async function verifyRun(params: VerifyRunParams): Promise<VerifyRunResult> {
  if (params.relaxVerification) {
    return { ok: true, userId: null, finishedAt: null, datasetId: null, rawRun: null, error: null, deferred: false }
  }

  const { run, error } = await getRun(params.runId)

  if (!run) {
    // If Apify is unreachable, defer rather than fail
    const isNetworkError = error?.includes('fetch') || error?.includes('timeout')
    return { ok: false, userId: null, finishedAt: null, datasetId: null, rawRun: null, error, deferred: isNetworkError ?? false }
  }

  if (run.actId !== params.expectedActorId) {
    return { ok: false, userId: run.userId, finishedAt: run.finishedAt, datasetId: run.defaultDatasetId, rawRun: run, error: 'actor_id_mismatch', deferred: false }
  }

  if (run.status !== 'SUCCEEDED') {
    // A student can submit just before Apify updates the run to its terminal
    // state. Keep polling states pending instead of permanently taking the
    // run-evidence mark away.
    const stillProcessing = ['READY', 'RUNNING', 'ABORTING', 'TIMING-OUT'].includes(run.status)
    return {
      ok: false,
      userId: run.userId,
      finishedAt: run.finishedAt,
      datasetId: run.defaultDatasetId,
      rawRun: run,
      error: `run_status_${run.status}`,
      deferred: stillProcessing,
    }
  }

  if (!run.finishedAt) {
    return { ok: false, userId: run.userId, finishedAt: null, datasetId: run.defaultDatasetId, rawRun: run, error: 'run_not_finished', deferred: false }
  }

  const finished = new Date(run.finishedAt)
  const windowStart = new Date(params.sessionStartedAt)
  const windowEnd = new Date(params.sessionEndsAt)

  if (finished < windowStart || finished > windowEnd) {
    return { ok: false, userId: run.userId, finishedAt: run.finishedAt, datasetId: run.defaultDatasetId, rawRun: run, error: 'run_outside_exam_window', deferred: false }
  }

  return { ok: true, userId: run.userId, finishedAt: run.finishedAt, datasetId: run.defaultDatasetId, rawRun: run, error: null, deferred: false }
}
