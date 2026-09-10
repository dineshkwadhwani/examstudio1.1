'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Status {
  exam_status: string
  mcq: { answered: number; total: number; complete: boolean; marks: number | null }
  paper: { fetched: boolean; first_fetched_at: string | null; fetch_count: number }
  tasks: Record<string, {
    submitted: boolean
    status: string | null
    marks: number | null
    submitted_at: string | null
    attempts: number
  }>
  total_marks: number | null
  exam_ends_at: string | null
}

function dt(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}

function MarkBar({ marks, max }: { marks: number | null; max: number }) {
  const pct = marks !== null ? (marks / max) * 100 : 0
  return (
    <div className="w-full bg-gray-100 rounded-full h-2 mt-1">
      <div
        className="bg-blue-500 h-2 rounded-full transition-all duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

function statusLabel(s: string | null) {
  const map: Record<string, { cls: string; label: string }> = {
    pending:  { cls: 'text-yellow-600', label: 'Verification pending…' },
    verified: { cls: 'text-green-700',  label: '✓ Verified' },
    failed:   { cls: 'text-red-600',    label: '✗ Failed — 0 marks' },
    flagged:  { cls: 'text-red-600',    label: '⚠ Flagged for review' },
    deferred: { cls: 'text-yellow-600', label: 'Deferred — completing shortly' },
  }
  if (!s) return { cls: 'text-gray-400', label: 'Not submitted' }
  return map[s] ?? { cls: 'text-gray-600', label: s }
}

export default function ResultsPage() {
  const router = useRouter()
  const [status, setStatus] = useState<Status | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/me/status').then(res => {
      if (res.status === 401 || res.status === 403) { router.push('/login'); return }
      return res.json()
    }).then(d => {
      if (d) setStatus(d)
      setLoading(false)
    })
  }, [router])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-gray-500 text-sm">Loading results…</div>
    </div>
  )

  const examEnded = status?.exam_status === 'closed' || status?.exam_status === 'archived'

  if (!examEnded) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="card max-w-md text-center space-y-4">
          <p className="text-2xl">⏳</p>
          <p className="font-semibold text-gray-800">Results not yet available</p>
          <p className="text-sm text-gray-600">Results are displayed after the exam session closes.</p>
          <Link href="/dashboard" className="btn-secondary">← Back to Dashboard</Link>
        </div>
      </div>
    )
  }

  const mcqMarks = status?.mcq.marks ?? 0
  const t1 = status?.tasks[1]
  const t2 = status?.tasks[2]
  const t3 = status?.tasks[3]
  const total = status?.total_marks

  const pendingVerification =
    [t1, t2, t3].some(t => t?.status === 'pending' || t?.status === 'deferred')

  return (
    <div className="min-h-screen bg-gray-50">

      <header className="bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-bold text-gray-900">F0003 CA1 — Results</h1>
            <p className="text-xs text-gray-500">Autonomous AI Systems and Agent-Based Computing</p>
          </div>
          <Link href="/dashboard" className="btn-secondary text-sm">Dashboard</Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">

        {pendingVerification && (
          <div className="card bg-yellow-50 border-yellow-200">
            <p className="text-yellow-800 text-sm font-medium">
              ⏳ Verification still in progress for one or more tasks.
              Marks will update automatically — refresh this page in a minute.
            </p>
          </div>
        )}

        {/* Total */}
        {total !== null && (
          <div className="card text-center py-8 bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
            <p className="text-sm text-blue-600 font-semibold uppercase tracking-wide">Total Score</p>
            <p className="text-7xl font-bold text-blue-900 mt-3 tabular-nums">{total.toFixed(1)}</p>
            <p className="text-blue-500 mt-1">out of 15 marks</p>
            <MarkBar marks={total} max={15} />
          </div>
        )}

        {/* Section A */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900">Section A — MCQ</h2>
            <span className="text-lg font-bold tabular-nums">{mcqMarks} <span className="text-gray-400 font-normal text-sm">/ 5</span></span>
          </div>
          <MarkBar marks={mcqMarks} max={5} />
          <p className="text-xs text-gray-500 mt-2">
            {status?.mcq.answered ?? 0} of 10 questions answered
          </p>
        </div>

        {/* Tasks */}
        {[
          { no: 1, label: 'Task 1 — Paper Retrieval', max: 2, t: t1 },
          { no: 2, label: 'Task 2 — Corpus Word Count', max: 3, t: t2 },
          { no: 3, label: 'Task 3 — City Temperature', max: 5, t: t3 },
        ].map(({ no, label, max, t }) => {
          const sl = statusLabel(t?.status ?? null)
          return (
            <div key={no} className="card">
              <div className="flex items-center justify-between mb-1">
                <h2 className="font-semibold text-gray-900">{label}</h2>
                <span className="text-lg font-bold tabular-nums">
                  {t?.marks !== null && t?.marks !== undefined
                    ? t.marks
                    : '—'}{' '}
                  <span className="text-gray-400 font-normal text-sm">/ {max}</span>
                </span>
              </div>
              <MarkBar marks={t?.marks ?? null} max={max} />
              <div className="flex items-center justify-between mt-2">
                <span className={`text-xs ${sl.cls}`}>{sl.label}</span>
                {t?.submitted_at && (
                  <span className="text-xs text-gray-400">Submitted {dt(t.submitted_at)}</span>
                )}
              </div>
              {t?.attempts && t.attempts > 1 && (
                <p className="text-xs text-gray-400 mt-0.5">{t.attempts} attempts — latest submission graded</p>
              )}
            </div>
          )
        })}

        <p className="text-xs text-center text-gray-400 pb-4">
          Contact the invigilator if you believe any mark is incorrect.
        </p>

      </main>
    </div>
  )
}
