'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Countdown } from '@/components/ui/Countdown'
import { Alert } from '@/components/ui/Alert'

interface Stats {
  session_status: string
  registered: number
  mcq_complete: number
  papers_fetched: number
  task1_submitted: number
  task2_submitted: number
  task3_submitted: number
  verification_pending: number
  flags_open: number
  seconds_remaining: number | null
  ends_at: string | null
}

interface Session {
  id: number
  label: string
  status: string
  started_at: string | null
  ends_at: string | null
  closed_at: string | null
  relax_apify_verification: boolean
  sheet_csv_url: string
  verification: { total: number; pending: number; complete: boolean }
}

export default function SADashboard() {
  const router = useRouter()
  const [stats, setStats] = useState<Stats | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const [transitioning, setTransitioning] = useState(false)
  const [newSessionForm, setNewSessionForm] = useState({ label: '', exam_id: '1', show: false })
  const [verifying, setVerifying] = useState(false)
  const [verifyResult, setVerifyResult] = useState<{ pending_before: number; pending_after: number; processed: number } | null>(null)

  const fetchAll = useCallback(async () => {
    const [statsRes, sessionsRes] = await Promise.all([
      fetch('/api/sa/session/stats'),
      fetch('/api/sa/session'),
    ])
    if (statsRes.status === 401 || statsRes.status === 403) {
      router.push('/sa/login')
      return
    }
    if (!statsRes.ok || !sessionsRes.ok) {
      setError('Could not refresh session verification status. Please try again.')
      setLoading(false)
      return
    }
    setStats(await statsRes.json())
    setSessions(await sessionsRes.json())
    setLoading(false)
  }, [router])

  useEffect(() => {
    const initialFetch = setTimeout(fetchAll, 0)
    const id = setInterval(fetchAll, 5_000)
    return () => {
      clearTimeout(initialFetch)
      clearInterval(id)
    }
  }, [fetchAll])

  async function transition(sessionId: number, newStatus: string) {
    setTransitioning(true)
    setMsg('')
    setError('')
    const res = await fetch('/api/sa/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'transition', session_id: sessionId, new_status: newStatus }),
    })
    const data = await res.json()
    setTransitioning(false)
    if (!res.ok) { setError(data.message ?? 'Failed.'); return }
    setMsg(`Session ${newStatus}.`)
    fetchAll()
  }

  async function toggleApify(sessionId: number) {
    const res = await fetch('/api/sa/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle_apify_relax', session_id: sessionId, reason: 'Manual toggle from dashboard' }),
    })
    if (res.ok) fetchAll()
  }

  async function runVerifications() {
    setVerifying(true)
    setVerifyResult(null)
    setMsg('')
    setError('')
    const res = await fetch('/api/sa/override', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'run_verifications' }),
    })
    const data = await res.json()
    setVerifying(false)
    if (res.ok) { setVerifyResult(data); fetchAll() }
    else { setError(data.message ?? 'Failed.') }
  }

  async function runSessionVerifications(sessionId: number) {
    setVerifying(true)
    setMsg('')
    setError('')
    try {
      const res = await fetch('/api/sa/override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'run_verifications', session_id: sessionId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.message ?? 'Verification failed.')
        return
      }
      setMsg(data.pending_after > 0
        ? `Verification batch finished: ${data.processed} completed, ${data.pending_after} still pending. Run verification again to continue.`
        : 'All Apify verifications for this session are complete.')
      await fetchAll()
    } catch {
      setError('Could not run verification. Please try again.')
    } finally {
      setVerifying(false)
    }
  }

  async function requeueDeferred() {
    setVerifying(true)
    setMsg('')
    setError('')
    const res = await fetch('/api/sa/override', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'requeue_deferred' }),
    })
    const data = await res.json()
    setVerifying(false)
    if (res.ok) { setMsg(data.message); fetchAll() }
    else { setError(data.message ?? 'Failed.') }
  }

  async function createSession() {
    setMsg('')
    setError('')
    const { exam_id } = newSessionForm
    const label = newSessionForm.label.trim()
    if (!label) { setError('Enter a session name, for example “Batch 1 — Div A”.'); return }
    setTransitioning(true)
    const res = await fetch('/api/sa/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', label, exam_id: parseInt(exam_id) }),
    })
    const data = await res.json()
    setTransitioning(false)
    if (!res.ok) { setError(data.message ?? 'Failed.'); return }
    setMsg('Session created.')
    setNewSessionForm(f => ({ ...f, show: false }))
    fetchAll()
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/sa/login')
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="text-gray-400">Loading…</div>
    </div>
  )

  const activeSession = sessions.find(s => s.status === 'running')

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="font-bold text-white">SA Dashboard — F0003 CA1</h1>
            <p className="text-xs text-gray-400">Exam Studio</p>
          </div>
          <div className="flex items-center gap-4">
            {activeSession?.ends_at && (
              <div className="text-center">
                <p className="text-xs text-gray-400">Time remaining</p>
                <Countdown endsAt={activeSession.ends_at} />
              </div>
            )}
            <nav className="flex gap-2">
              <Link href="/sa/students" className="btn-secondary text-xs">Students</Link>
              <Link href="/sa/flags" className="btn-secondary text-xs">
                Flags {stats?.flags_open ? `(${stats.flags_open})` : ''}
              </Link>
            </nav>
            <button onClick={logout} className="text-gray-400 hover:text-white text-xs">Logout</button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {msg && <Alert type="success" message={msg} />}
        {error && <Alert type="error" message={error} />}

        {/* Live stats */}
        <section>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Live Board</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-blue-400">{stats?.registered ?? 0}</p>
              <p className="text-sm text-gray-300 mt-1">Registered</p>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-green-400">{stats?.mcq_complete ?? 0}</p>
              <p className="text-sm text-gray-300 mt-1">MCQ complete</p>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-purple-400">{stats?.papers_fetched ?? 0}</p>
              <p className="text-sm text-gray-300 mt-1">Papers fetched</p>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-yellow-400">{stats?.verification_pending ?? 0}</p>
              <p className="text-sm text-gray-300 mt-1">Pending verification</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-3">
            {[
              { label: 'Task 1', value: stats?.task1_submitted ?? 0 },
              { label: 'Task 2', value: stats?.task2_submitted ?? 0 },
              { label: 'Task 3', value: stats?.task3_submitted ?? 0 },
            ].map(t => (
              <div key={t.label} className="bg-gray-800 border border-gray-700 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-gray-100">{t.value}</p>
                <p className="text-sm text-gray-400 mt-1">{t.label} submitted</p>
              </div>
            ))}
          </div>

          {/* Manual verification controls */}
          {(stats?.verification_pending ?? 0) > 0 && (
            <div className="mt-4 bg-yellow-900 border border-yellow-700 rounded-xl p-4">
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                  <p className="font-semibold text-yellow-200 text-sm">
                    {stats?.verification_pending} submission(s) pending verification
                  </p>
                  <p className="text-yellow-400 text-xs mt-1">
                    Run verification after submissions arrive or when the exam ends.
                    Re-queue deferred checks after an Apify outage.
                  </p>
                  {verifyResult && (
                    <p className="text-green-400 text-xs mt-2 font-medium">
                      ✓ Last run: {verifyResult.processed} processed,
                      {' '}{verifyResult.pending_after} still pending
                    </p>
                  )}
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={runVerifications}
                    disabled={verifying}
                    className="btn-primary text-xs bg-yellow-600 hover:bg-yellow-700"
                  >
                    {verifying ? 'Running…' : '▶ Run verifications now'}
                  </button>
                  <button
                    onClick={requeueDeferred}
                    disabled={verifying}
                    className="btn-secondary text-xs"
                    title="Move all deferred submissions back to pending so they are retried"
                  >
                    ↺ Re-queue deferred
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Session management */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Sessions</h2>
            <button
              onClick={() => {
                setMsg('')
                setError('')
                setNewSessionForm(f => ({ ...f, show: !f.show }))
              }}
              className="btn-primary text-xs"
            >
              + New Session
            </button>
          </div>

          {newSessionForm.show && (
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 mb-4 space-y-3">
              <h3 className="font-medium text-gray-200 text-sm">Create New Session</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="session-name" className="label text-gray-400 text-xs">Session name (required)</label>
                  <input id="session-name" className="input bg-gray-700 border-gray-600 text-white text-sm"
                    value={newSessionForm.label}
                    onChange={e => setNewSessionForm(f => ({ ...f, label: e.target.value }))}
                    placeholder="Batch 1 — Div A" />
                </div>
              </div>
              <div className="bg-gray-700 rounded-lg px-3 py-2 text-xs text-gray-300">
                📋 The spreadsheet is loaded automatically from <code className="text-green-400">TASK3_SHEET_CSV_URL</code> in your environment variables.
                Make sure it is set in Vercel before creating a session.
              </div>
              <div className="flex gap-2">
                <button onClick={createSession} disabled={transitioning} className="btn-primary text-sm">
                  {transitioning ? 'Creating…' : 'Create Session'}
                </button>
                <button onClick={() => setNewSessionForm(f => ({ ...f, show: false }))} className="btn-secondary text-sm">
                  Cancel
                </button>
              </div>
              <p className="text-xs text-gray-500">
                ⚠ After creating, upload the reference table from the corpus generator before starting.
              </p>
            </div>
          )}

          <div className="space-y-3">
            {sessions.map(s => (
              <div key={s.id} className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-gray-100">{s.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">ID: {s.id}</p>
                    {s.ends_at && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        Ends: {new Date(s.ends_at).toLocaleTimeString()}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <span className={`badge text-xs ${
                      s.status === 'running' ? 'bg-green-900 text-green-300' :
                      s.status === 'registration_open' ? 'bg-blue-900 text-blue-300' :
                      s.status === 'closed' ? 'bg-gray-700 text-gray-400' :
                      'bg-gray-800 text-gray-500'
                    }`}>
                      {s.status}
                    </span>
                  </div>
                </div>

                <p className={`rounded-lg border border-current/30 bg-gray-900/50 p-3 mb-3 text-sm font-medium ${
                  s.verification.total === 0 ? 'text-gray-300' :
                  s.verification.complete ? 'text-green-400' : 'text-yellow-400'
                }`}>
                  {s.verification.total === 0
                    ? 'Apify verification: no Task 2 or Task 3 submissions'
                    : s.verification.complete
                      ? `Apify verification complete for all ${s.verification.total} submission(s) ✓`
                      : `Apify verification pending for ${s.verification.pending} of ${s.verification.total} submission(s)`}
                </p>

                <div className="flex flex-wrap gap-2">
                  {s.status === 'setup' && (
                    <button onClick={() => transition(s.id, 'registration_open')} disabled={transitioning}
                      className="btn-primary text-xs">
                      Open Registration
                    </button>
                  )}
                  {s.status === 'registration_open' && (
                    <button onClick={() => transition(s.id, 'running')} disabled={transitioning}
                      className="btn-primary text-xs bg-green-600 hover:bg-green-700">
                      🚀 Start Exam
                    </button>
                  )}
                  {s.status === 'running' && (
                    <>
                      <button onClick={() => transition(s.id, 'closed')} disabled={transitioning}
                        className="btn-danger text-xs">
                        Close Exam
                      </button>
                      <button onClick={() => transition(s.id, 'extend')} disabled={transitioning}
                        className="btn-secondary text-xs">
                        +10 min
                      </button>
                    </>
                  )}
                  {s.status === 'closed' && (
                    <button onClick={() => transition(s.id, 'archived')} disabled={transitioning}
                      className="btn-secondary text-xs">
                      Archive
                    </button>
                  )}

                  {/* Apify relax toggle */}
                  {(s.status === 'running' || s.status === 'closed') && (
                    <button
                      onClick={() => toggleApify(s.id)}
                      className={`btn-secondary text-xs ${s.relax_apify_verification ? 'ring-2 ring-yellow-400' : ''}`}
                    >
                      Apify checks: {s.relax_apify_verification ? '⚠ RELAXED' : 'ON'}
                    </button>
                  )}

                  {s.verification.pending > 0 && (
                    <button
                      onClick={() => runSessionVerifications(s.id)}
                      disabled={verifying}
                      className="btn-primary text-xs bg-yellow-600 hover:bg-yellow-700"
                    >
                      {verifying ? 'Verifying…' : `Run Apify verification (${s.verification.pending})`}
                    </button>
                  )}

                  {/* Corpus is in exam definition — always set after migration 003 */}
                  <span className="text-xs px-2 py-1 rounded-md font-medium bg-green-900 text-green-300">
                    Corpus ✓
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
