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
    const [statusRes, keyRes] = await Promise.all([
      fetch('/api/me/status'),
      fetch('/api/keys'),
    ])
    if (statusRes.status === 401 || statusRes.status === 403) {
      router.push('/login')
      return
    }
    if (statusRes.ok) {
      const nextStatus = await statusRes.json() as Status
      setStatus(nextStatus)
      setPaper(nextStatus.paper.rendered_paper)
    }
    if (keyRes.ok) setKeyInfo(await keyRes.json())
    setLoading(false)
  }, [router])

  useEffect(() => {
    fetchStatus()
    const id = setInterval(fetchStatus, 8_000)
    return () => clearInterval(id)
  }, [fetchStatus])

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

              {/* Task 1 — Magic Code */}
              <div className="border border-gray-200 rounded-xl p-4 mb-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-800 text-sm">Task 1 — Fetch My Magic Code <span className="text-gray-400 font-normal">(1 mark)</span></h3>
                    <p className="text-xs text-gray-500 mt-1">
                      Call <code className="bg-gray-100 px-1 rounded font-mono">GET {appUrl}/api/v1/paper</code> with your API key.
                      Your response contains a <code className="bg-gray-100 px-1 rounded font-mono">magic_code</code> field.
                      Select the colour you received below.
                    </p>
                  </div>
                  <StatusBadge status={task1?.status ?? null} />
                </div>

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
                  <p className="text-xs text-green-700 font-medium mt-2">✓ Answer recorded.</p>
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
                    <p className="text-xs text-gray-500 mt-1">Build and deploy an Apify actor that crawls the corpus and counts your target word.</p>
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

                <div className="mt-3 bg-gray-50 rounded-lg p-3 text-xs text-gray-600">
                  <p className="font-medium mb-1">POST payload:</p>
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
                    <p className="text-xs text-gray-500 mt-1">Fetch the spreadsheet, find your PRN row, read lat/lon, call Open-Meteo for temperature.</p>
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

                <div className="mt-3 bg-gray-50 rounded-lg p-3 text-xs text-gray-600">
                  <p className="font-medium mb-1">POST payload:</p>
                  <code className="block whitespace-pre">{`{
  "city": "<city name from spreadsheet>",
  "temperature_c": <number from Open-Meteo>,
  "actor_id": "<APIFY_ACTOR_ID env var>",
  "run_id": "<APIFY_ACTOR_RUN_ID env var>",
  "actor_url": "https://apify.com/username/actor"
}`}</code>
                </div>
              </div>
            </div>

            {/* Total marks */}
            {status?.total_marks !== null && examClosed && (
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
