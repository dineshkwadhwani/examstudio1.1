'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Countdown } from '@/components/ui/Countdown'
import { Alert } from '@/components/ui/Alert'

interface TaskStatus {
  submitted: boolean
  status: string | null
  marks: number | null
  submitted_at: string | null
  attempts: number
}

interface Status {
  exam_status: string
  mcq: { answered: number; total: number; complete: boolean; marks: number | null }
  paper: { fetched: boolean; first_fetched_at: string | null; fetch_count: number; rendered_paper: Paper | null }
  tasks: Record<string, TaskStatus>
  total_marks: number | null
  final_score_ready: boolean
  verification_pending: number
  exam_ends_at: string | null
}

interface Paper {
  prn: string
  name: string
  magic_code: string
  task2: {
    corpus_index_url: string
    target_word: string
    scoped_page: number
    submit_endpoint: string
  }
  task3: {
    sheet_csv_url: string
    submit_endpoint: string
  }
}

const COLOURS = ['Red', 'Blue', 'Green', 'Orange']
const COLOUR_STYLES: Record<string, string> = {
  Red:    'bg-red-100 border-red-400 text-red-800 hover:bg-red-200',
  Blue:   'bg-blue-100 border-blue-400 text-blue-800 hover:bg-blue-200',
  Green:  'bg-green-100 border-green-400 text-green-800 hover:bg-green-200',
  Orange: 'bg-orange-100 border-orange-400 text-orange-800 hover:bg-orange-200',
}
const COLOUR_SELECTED: Record<string, string> = {
  Red:    'bg-red-500 border-red-600 text-white',
  Blue:   'bg-blue-500 border-blue-600 text-white',
  Green:  'bg-green-500 border-green-600 text-white',
  Orange: 'bg-orange-500 border-orange-600 text-white',
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="badge-gray">Not submitted</span>
  const map: Record<string, { cls: string; label: string }> = {
    pending:  { cls: 'badge-yellow', label: 'Pending…' },
    verified: { cls: 'badge-green',  label: '✓ Verified' },
    failed:   { cls: 'badge-red',    label: '✗ Failed' },
    flagged:  { cls: 'badge-red',    label: '⚠ Flagged' },
    deferred: { cls: 'badge-yellow', label: 'Deferred' },
  }
  const m = map[status]
  return <span className={m?.cls ?? 'badge-gray'}>{m?.label ?? status}</span>
}

function Flow({ steps }: { steps: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs text-indigo-800">
      {steps.map((step, index) => (
        <span key={step} className="contents">
          <span className="bg-indigo-50 border border-indigo-100 rounded px-2 py-1 font-medium">{step}</span>
          {index < steps.length - 1 && <span className="text-indigo-400">→</span>}
        </span>
      ))}
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const [status, setStatus] = useState<Status | null>(null)
  const [paper, setPaper] = useState<Paper | null>(null)
  const [keyInfo, setKeyInfo] = useState<{ has_key: boolean; key_prefix?: string } | null>(null)
  const [newKey, setNewKey] = useState<string | null>(null)
  const [generatingKey, setGeneratingKey] = useState(false)
  const [keyError, setKeyError] = useState('')
  const [viewingKey, setViewingKey] = useState(false)
  const [replacementRequired, setReplacementRequired] = useState(false)
  const [copied, setCopied] = useState(false)
  const [fetchingPaper, setFetchingPaper] = useState(false)
  const [paperError, setPaperError] = useState('')
  const [selectedColour, setSelectedColour] = useState<string | null>(null)
  const [submittingColour, setSubmittingColour] = useState(false)
  const [colourSubmitted, setColourSubmitted] = useState(false)
  const [loading, setLoading] = useState(true)

  const fetchStatus = useCallback(async () => {
    const statusRes = await fetch('/api/me/status')
    if (statusRes.status === 401 || statusRes.status === 403) {
      router.push('/login')
      return
    }
    if (statusRes.ok) {
      const nextStatus = await statusRes.json() as Status
      setStatus(nextStatus)
      setPaper(nextStatus.paper.rendered_paper)
    }
    setLoading(false)
  }, [router])

  const fetchKeyInfo = useCallback(async () => {
    const keyRes = await fetch('/api/keys')
    if (keyRes.ok) setKeyInfo(await keyRes.json())
  }, [])

  useEffect(() => {
    fetchStatus()
    fetchKeyInfo()
    const id = setInterval(fetchStatus, 8_000)
    return () => clearInterval(id)
  }, [fetchStatus, fetchKeyInfo])

  async function generateKey(replace = false) {
    setGeneratingKey(true)
    setKeyError('')
    const res = await fetch('/api/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: replace ? JSON.stringify({ replace: true }) : undefined,
    })
    const data = await res.json()
    setGeneratingKey(false)
    if (!res.ok) { setKeyError(data.message ?? 'Could not generate key.'); return }
    setNewKey(data.api_key)
    setKeyInfo({ has_key: true, key_prefix: data.prefix })
    setReplacementRequired(false)
  }

  async function viewKey() {
    setViewingKey(true)
    setKeyError('')
    const res = await fetch('/api/keys?reveal=1')
    const data = await res.json()
    setViewingKey(false)
    if (!res.ok) {
      setKeyError(data.message ?? 'Could not reveal API key.')
      setReplacementRequired(data.error === 'key_not_recoverable')
      return
    }
    setNewKey(data.api_key)
  }

  async function fetchPaper() {
    setFetchingPaper(true)
    setPaperError('')
    const res = await fetch('/api/me/paper')
    const data = await res.json()
    setFetchingPaper(false)
    if (!res.ok) { setPaperError(data.message ?? 'Could not fetch paper.'); return }
    setPaper(data)
    fetchStatus()
  }

  async function submitColour(colour: string) {
    setSelectedColour(colour)
    setSubmittingColour(true)
    // Submit via API key — use the me endpoint which uses session cookie
    const res = await fetch('/api/me/task1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ colour }),
    })
    setSubmittingColour(false)
    if (res.ok) {
      setColourSubmitted(true)
      fetchStatus()
    }
  }

  async function copyKey() {
    if (!newKey) return
    await navigator.clipboard.writeText(newKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  const examRunning = status?.exam_status === 'running'
  const examClosed = status?.exam_status === 'closed' || status?.exam_status === 'archived'
  const hasKey = !!(keyInfo?.has_key)
  const paperFetched = status?.paper.fetched || !!paper
  const task1 = status?.tasks[1]
  const task2 = status?.tasks[2]
  const task3 = status?.tasks[3]
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-gray-500 text-sm">Loading…</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="font-bold text-gray-900 text-base">F0003 CA1 — Practical Exam</h1>
            <p className="text-xs text-gray-500">Autonomous AI Systems · 15 marks · 50 minutes</p>
          </div>
          <div className="flex items-center gap-4">
            {status?.exam_ends_at && examRunning && (
              <div className="text-center">
                <p className="text-xs text-gray-500 mb-0.5">Time remaining</p>
                <Countdown endsAt={status.exam_ends_at} onExpired={fetchStatus} />
              </div>
            )}
            <button onClick={logout} className="btn-secondary text-xs py-1.5 px-3">Log out</button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-5 space-y-4">

        {examClosed && (
          <div className="card bg-blue-50 border-blue-200 text-center py-4">
            <p className="font-semibold text-blue-900">Exam has ended</p>
            <Link href="/results" className="btn-primary mt-3 inline-flex text-sm">View Results →</Link>
          </div>
        )}

        {/* API Key */}
        <div className="card">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h2 className="font-semibold text-gray-900 text-sm">Your Exam API Key</h2>
              <p className="text-xs text-gray-500 mt-0.5">Required for all API calls</p>
            </div>
            {hasKey && !newKey && <span className="badge-green text-xs">Active ✓</span>}
          </div>

          {!hasKey ? (
            <div className="space-y-2">
              <button onClick={() => generateKey()} disabled={generatingKey} className="btn-primary text-sm">
                {generatingKey ? 'Generating…' : 'Generate API Key'}
              </button>
              {keyError && <p className="text-xs text-red-600">{keyError}</p>}
            </div>
          ) : newKey ? (
            <div className="space-y-3">
              <div className="bg-gray-900 rounded-lg p-3 font-mono text-green-400 text-sm break-all">{newKey}</div>
              <div className="flex items-center gap-3">
                <button onClick={copyKey} className="btn-secondary text-sm">
                  {copied ? '✓ Copied!' : 'Copy key'}
                </button>
                <p className="text-xs text-red-600 font-semibold">⚠ Copy now — shown once only</p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                Store as environment variable: <code className="font-mono bg-amber-100 px-1 rounded">EXAM_API_KEY=&lt;key&gt;</code>
              </div>
            </div>
          ) : (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <code className="bg-gray-100 px-3 py-1.5 rounded font-mono text-sm">{keyInfo?.key_prefix}…</code>
                <button onClick={viewKey} disabled={viewingKey} className="btn-secondary text-xs py-1.5 px-3">
                  {viewingKey ? 'Loading…' : 'View key'}
                </button>
              </div>
            )}
          {keyError && hasKey && <p className="text-xs text-red-600 mt-2">{keyError}</p>}
          {replacementRequired && (
            <button onClick={() => generateKey(true)} disabled={generatingKey} className="btn-primary text-xs mt-2">
              {generatingKey ? 'Replacing…' : 'Generate replacement key'}
            </button>
          )}
        </div>

        {/* Fetch Paper button — disabled until running */}
        {!paperFetched && (
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-900 text-sm">Fetch Your Question Paper</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {!examRunning
                    ? 'Waiting for the invigilator to start the exam…'
                    : 'Click to load your personalised exam paper'}
                </p>
              </div>
              <button
                onClick={fetchPaper}
                disabled={!examRunning || fetchingPaper || !hasKey}
                className="btn-primary"
              >
                {fetchingPaper ? 'Fetching…' : '📄 Fetch Paper'}
              </button>
            </div>
            {paperError && <p className="text-xs text-red-600 mt-2">{paperError}</p>}
            {!hasKey && examRunning && (
              <p className="text-xs text-orange-600 mt-2">Generate your API key first.</p>
            )}
          </div>
        )}

        {/* Paper loaded — show all sections */}
        {paperFetched && (
          <>
            {/* Section A */}
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="font-semibold text-gray-900">Section A — MCQ <span className="text-gray-400 font-normal text-sm">(5 marks)</span></h2>
                  <p className="text-xs text-gray-500 mt-0.5">10 questions × 0.5 marks · answers save on click</p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-bold ${status?.mcq.complete ? 'text-green-700' : 'text-gray-700'}`}>
                    {status?.mcq.answered ?? 0} / 10
                  </p>
                  {status?.mcq.marks !== null && status?.mcq.marks !== undefined && (
                    <p className="text-xs text-green-700 font-bold">{status.mcq.marks} / 5</p>
                  )}
                </div>
              </div>
              {status?.mcq.complete ? (
                <div className="flex items-center gap-3">
                  <span className="badge-green">All answered ✓</span>
                  <Link href="/mcq" className="btn-secondary text-xs">Review answers</Link>
                </div>
              ) : (
                <Link href="/mcq" className="btn-primary text-sm inline-flex">
                  {(status?.mcq.answered ?? 0) > 0 ? 'Continue MCQ →' : 'Start MCQ →'}
                </Link>
              )}
            </div>

            {/* Section B */}
            <div className="card">
              <h2 className="font-semibold text-gray-900 mb-4">Section B — Practical Tasks <span className="text-gray-400 font-normal text-sm">(10 marks)</span></h2>

              <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 mb-4">
                <h3 className="font-semibold text-indigo-950 text-sm">How to complete a practical task</h3>
                <ol className="mt-2 grid gap-1 text-xs text-indigo-900 sm:grid-cols-2">
                  <li>1. Read the task requirements and inputs.</li>
                  <li>2. Build and run your solution using those resources.</li>
                  <li>3. Check that it produces the required result.</li>
                  <li>4. Send the shown payload to the submission endpoint.</li>
                  <li className="sm:col-span-2">5. A task is submitted when the endpoint accepts the payload. Tasks 2 and 3 may then show pending verification.</li>
                </ol>
              </div>

              {/* Task 1 — Magic Code */}
              <div className="border border-gray-200 rounded-xl p-4 mb-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-800 text-sm">Task 1 — Fetch My Magic Code <span className="text-gray-400 font-normal">(1 mark)</span></h3>
                    <p className="text-xs text-gray-500 mt-1">Use the Exam API to obtain your <code className="bg-gray-100 px-1 rounded font-mono">magic_code</code>, then select that colour below.</p>
                  </div>
                  <StatusBadge status={task1?.status ?? null} />
                </div>

                <div className="grid gap-3 rounded-lg bg-gray-50 p-3 text-xs text-gray-700 mb-3">
                  <div><p className="font-semibold text-gray-900">Objective</p><p className="mt-0.5">Call the paper API and select the colour named in the <code className="font-mono">magic_code</code> returned by the API.</p></div>
                  <div><p className="font-semibold text-gray-900">Input / resource</p><p className="mt-0.5">Your Exam API Key, sent with <code className="font-mono">GET {appUrl}/api/v1/paper</code>.</p></div>
                  <div><p className="font-semibold text-gray-900 mb-1">Workflow</p><Flow steps={['Exam API Key', 'GET /api/v1/paper', 'magic_code', 'Select colour']} /></div>
                </div>

                <p className="text-xs font-semibold text-gray-800 mb-2">What you submit: Select the colour named in the <code className="font-mono">magic_code</code> returned by the API.</p>

                <div className="grid grid-cols-4 gap-2">
                  {COLOURS.map(colour => {
                    const isSelected = selectedColour === colour
                    const alreadySubmitted = task1?.submitted && task1.status === 'verified'
                    return (
                      <button
                        key={colour}
                        onClick={() => !alreadySubmitted && submitColour(colour)}
                        disabled={submittingColour || !!alreadySubmitted || !examRunning}
                        className={`px-3 py-3 rounded-xl border-2 font-semibold text-sm transition-all ${
                          isSelected
                            ? COLOUR_SELECTED[colour]
                            : COLOUR_STYLES[colour]
                        } disabled:opacity-50`}
                      >
                        {colour}
                      </button>
                    )
                  })}
                </div>

                {colourSubmitted && (
                  <p className="text-xs text-green-700 font-medium mt-2">✓ Submission accepted and recorded.</p>
                )}
                {task1?.marks !== null && task1?.marks !== undefined && examClosed && (
                  <p className="text-xs font-bold mt-2">
                    {task1.marks === 1 ? '✓ 1 / 1 mark' : '✗ 0 / 1 mark'}
                  </p>
                )}
              </div>

              {/* Task 2 */}
              <div className="border border-gray-200 rounded-xl p-4 mb-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-800 text-sm">Task 2 — Corpus Word Count <span className="text-gray-400 font-normal">(4 marks)</span></h3>
                    <p className="text-xs text-gray-500 mt-1">Build and deploy an Apify Actor that crawls the corpus and calculates the required word counts.</p>
                  </div>
                  <div className="text-right">
                    <StatusBadge status={task2?.status ?? null} />
                    {task2?.marks !== null && task2?.marks !== undefined && examClosed && (
                      <p className="text-xs font-bold mt-1">{task2.marks} / 4</p>
                    )}
                  </div>
                </div>

                {paper && (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-blue-50 rounded-lg p-3">
                      <p className="text-blue-500 font-medium mb-1">Target word</p>
                      <p className="font-mono font-bold text-blue-900 text-lg">{paper.task2.target_word}</p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-3">
                      <p className="text-blue-500 font-medium mb-1">Scoped page</p>
                      <p className="font-mono font-bold text-blue-900 text-lg">Page {paper.task2.scoped_page}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 col-span-2">
                      <p className="text-gray-500 font-medium mb-1">Corpus index URL</p>
                      <a href={paper.task2.corpus_index_url} target="_blank" rel="noreferrer"
                        className="font-mono text-blue-600 underline break-all">{paper.task2.corpus_index_url}</a>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 col-span-2">
                      <p className="text-gray-500 font-medium mb-1">Submit endpoint</p>
                      <code className="font-mono break-all">{paper.task2.submit_endpoint}</code>
                    </div>
                  </div>
                )}

                <div className="rounded-lg bg-gray-50 p-3 text-xs text-gray-700 mt-3">
                  <p className="font-semibold text-gray-900">Required workflow</p>
                  <ol className="mt-1 grid gap-1 sm:grid-cols-2">
                    <li>1. Build the Actor.</li><li>2. Deploy the Actor.</li>
                    <li>3. Run it successfully.</li><li>4. Obtain the required counts.</li>
                    <li className="sm:col-span-2">5. Send the payload to the provided submission endpoint.</li>
                  </ol>
                  <p className="font-semibold text-gray-900 mt-3">Required outcome</p>
                  <ul className="mt-1 space-y-0.5">
                    <li><code className="font-mono">count_total</code> — total occurrences across the corpus</li>
                    <li><code className="font-mono">count_scoped</code> — occurrences on your scoped page</li>
                    <li><code className="font-mono">actor_id</code>, <code className="font-mono">run_id</code>, and <code className="font-mono">actor_url</code> — your deployed Actor and successful run</li>
                  </ul>
                </div>

                <div className="mt-3 bg-gray-50 rounded-lg p-3 text-xs text-gray-600">
                  <p className="font-medium mb-1">Submission payload (submission is accepted when this endpoint accepts it):</p>
                  <code className="block whitespace-pre">{`{
  "count_total": <whole corpus count>,
  "count_scoped": <page ${paper?.task2.scoped_page ?? '?'} count>,
  "actor_id": "<APIFY_ACTOR_ID env var>",
  "run_id": "<APIFY_ACTOR_RUN_ID env var>",
  "actor_url": "https://apify.com/username/actor"
}`}</code>
                </div>
              </div>

              {/* Task 3 */}
              <div className="border border-gray-200 rounded-xl p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-800 text-sm">Task 3 — City Temperature <span className="text-gray-400 font-normal">(5 marks)</span></h3>
                    <p className="text-xs text-gray-500 mt-1">Inside your actor, fetch this CSV, find the row matching your PRN, then use that row’s latitude and longitude to call Open-Meteo. <strong>Do not hardcode a location.</strong></p>
                  </div>
                  <div className="text-right">
                    <StatusBadge status={task3?.status ?? null} />
                    {task3?.marks !== null && task3?.marks !== undefined && examClosed && (
                      <p className="text-xs font-bold mt-1">{task3.marks} / 5</p>
                    )}
                  </div>
                </div>

                {paper && (
                  <div className="grid grid-cols-1 gap-2 text-xs">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-gray-500 font-medium mb-1">Spreadsheet CSV URL</p>
                      <a href={paper.task3.sheet_csv_url} target="_blank" rel="noreferrer"
                        className="font-mono text-blue-600 underline break-all">{paper.task3.sheet_csv_url}</a>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-gray-500 font-medium mb-1">Submit endpoint</p>
                      <code className="font-mono break-all">{paper.task3.submit_endpoint}</code>
                    </div>
                  </div>
                )}

                <div className="rounded-lg bg-gray-50 p-3 text-xs text-gray-700 mt-3">
                  <p className="font-semibold text-gray-900">Inputs / resources</p>
                  <p className="mt-1">Your PRN, the Spreadsheet CSV URL above, Open-Meteo, and the submission endpoint.</p>
                  <p className="font-semibold text-gray-900 mt-3 mb-1">Workflow</p>
                  <Flow steps={['Your PRN', 'Find spreadsheet row', 'Latitude + longitude', 'Open-Meteo', 'Temperature', 'Submit result']} />
                  <p className="font-semibold text-gray-900 mt-3">Required outcome</p>
                  <ul className="mt-1 space-y-0.5">
                    <li><code className="font-mono">city</code> — city from the spreadsheet row matching your PRN</li>
                    <li><code className="font-mono">temperature_c</code> — temperature obtained from Open-Meteo</li>
                    <li><code className="font-mono">actor_id</code>, <code className="font-mono">run_id</code>, and <code className="font-mono">actor_url</code> — your deployed Actor and successful run</li>
                  </ul>
                </div>

                <div className="mt-3 bg-gray-50 rounded-lg p-3 text-xs text-gray-600">
                  <p className="font-medium mb-1">Submission payload (verification may remain pending after acceptance):</p>
                  <code className="block whitespace-pre">{`{
  "city": "<city name from spreadsheet>",
  "temperature_c": <number from Open-Meteo>,
  "actor_id": "<APIFY_ACTOR_ID env var>",
  "run_id": "<APIFY_ACTOR_RUN_ID env var>",
  "actor_url": "https://apify.com/username/actor"
}`}</code>
                </div>
              </div>

              <div className="rounded-xl border border-green-200 bg-green-50 p-4 mt-4 text-xs text-green-950">
                <h3 className="font-semibold text-sm">Practical Task Submission Checklist</h3>
                <div className="grid gap-3 mt-2 sm:grid-cols-3">
                  <div><p className="font-semibold">Task 1</p><p>✓ API call completed</p><p>✓ magic_code obtained</p><p>✓ Correct colour selected</p></div>
                  <div><p className="font-semibold">Task 2</p><p>✓ Actor built, deployed, and run</p><p>✓ Required counts obtained</p><p>✓ Submission payload accepted</p></div>
                  <div><p className="font-semibold">Task 3</p><p>✓ PRN matched to spreadsheet row</p><p>✓ Coordinates and temperature obtained</p><p>✓ Submission payload accepted</p></div>
                </div>
                <p className="mt-2 text-green-800">For Tasks 2 and 3, “accepted” means your payload was recorded. The verification status may remain pending while the system checks it.</p>
              </div>
            </div>

            {/* Total marks */}
            {examClosed && !status?.final_score_ready && (
              <div className="card text-center py-5 bg-yellow-50 border-yellow-200">
                <p className="font-semibold text-yellow-900">Final score is being prepared</p>
                <p className="text-xs text-yellow-800 mt-1">
                  {status?.verification_pending ?? 0} submission(s) still need verification. Your final score will appear after all checks complete.
                </p>
              </div>
            )}
            {status?.total_marks !== null && status?.final_score_ready && examClosed && (
              <div className="card text-center py-6 bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
                <p className="text-sm text-blue-600 font-semibold uppercase tracking-wide">Final Score</p>
                <p className="text-6xl font-bold text-blue-900 mt-2 tabular-nums">{status?.total_marks?.toFixed(1)}</p>
                <p className="text-blue-500 mt-1">out of 15</p>
              </div>
            )}
          </>
        )}

      </main>
    </div>
  )
}
