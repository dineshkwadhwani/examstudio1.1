'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Alert } from '@/components/ui/Alert'

// ─── Types ────────────────────────────────────────────────────
interface StudentDetail {
  student: {
    id: number; prn: string; name: string; email: string; phone: string
    registered_at: string; last_login_at: string | null; must_change_password: boolean
  }
  api_key: { key_prefix: string; created_at: string; revoked: boolean } | null
  paper: {
    t2_target_word: string; t2_scoped_page: number
    t2_expected_total: number; t2_expected_scoped: number
    t3_city: string; t3_lat: number; t3_lon: number
    rendered_paper: unknown; first_fetched_at: string
    fetch_count: number; seed: string
  } | null
  mcq_assignments: McqAssignment[]
  submissions: Submission[]
  attempts: Attempt[]
  flags: Flag[]
  exceptions: Exception[]
  audit_log: AuditEntry[]
}

interface McqAssignment {
  slot_no: number; concept: string; co_code: string
  bloom_level: number; bloom_label: string
  stem: string; options: { key: string; text: string }[]
  option_order: string[]; answered_key: string | null
  is_correct: boolean | null; change_count: number
  answer_history: { key: string; at: string }[]
  ca1_mcq_questions: {
    stem: string; options: { key: string; text: string }[]
    correct_key: string; rationale: string
    ca1_mcq_slots: { concept: string; co_code: string; bloom_level: number; bloom_label: string }
  }
}

interface Submission {
  id: number; task_no: number; verification_status: string
  marks_awarded: number | null; override_marks: number | null
  override_reason: string | null; override_by: string | null; override_at: string | null
  submitted_at: string; first_submitted_at: string; attempt_count: number
  payload: Record<string, unknown>
  submitted_run_id: string | null; submitted_actor_id: string | null
  submitted_actor_url: string | null; apify_user_id: string | null
  apify_run_status: string | null; apify_finished_at: string | null
  apify_dataset_items: unknown; source_snapshot: string | null
  key_hardcoded: boolean | null; server_reference: unknown
  grading_detail: Record<string, unknown> | null
}

interface Attempt {
  attempt_no: number; task_no: number; payload: unknown
  submitted_run_id: string | null; submitted_at: string; source_ip: string | null
}

interface Flag {
  id: number; reason: string; severity: string; detail: unknown
  resolved: boolean; resolution: string | null; created_at: string
}

interface Exception {
  id: number; kind: string; detail: string; recorded_by: string; recorded_at: string
}

interface AuditEntry {
  id: number; actor: string; action: string; target: string | null
  detail: unknown; at: string
}

// ─── Small helpers ────────────────────────────────────────────
function dt(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}

function SectionHead({ title }: { title: string }) {
  return (
    <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-8 mb-3 border-t border-gray-100 pt-5">
      {title}
    </h2>
  )
}

function Kv({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="text-gray-400 w-36 flex-shrink-0">{label}</span>
      <span className="text-gray-900 font-medium break-all">{value ?? '—'}</span>
    </div>
  )
}

function severityClass(s: string) {
  return s === 'serious' ? 'badge-red' : s === 'review' ? 'badge-yellow' : 'badge-gray'
}

function statusClass(s: string) {
  return s === 'verified' ? 'badge-green' : s === 'failed' ? 'badge-red' : 'badge-yellow'
}

// ─── Override form ────────────────────────────────────────────
function OverrideForm({
  submissionId, currentMarks, maxMarks, taskNo,
  onSaved,
}: {
  submissionId: number; currentMarks: number | null; maxMarks: number; taskNo: number
  onSaved: () => void
}) {
  const [open, setOpen] = useState(false)
  const [marks, setMarks] = useState(String(currentMarks ?? ''))
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  async function save() {
    if (!reason.trim()) { setMsg('Reason is required.'); return }
    setSaving(true)
    const res = await fetch('/api/sa/override', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'override_marks', submission_id: submissionId, override_marks: parseFloat(marks), reason }),
    })
    setSaving(false)
    if (res.ok) { setOpen(false); onSaved() }
    else { const d = await res.json(); setMsg(d.message ?? 'Failed.') }
  }

  if (!open) return (
    <button onClick={() => setOpen(true)} className="btn-secondary text-xs py-1 px-2">
      Override marks
    </button>
  )

  return (
    <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg space-y-2">
      <p className="text-xs font-semibold text-yellow-800">Override Task {taskNo} marks</p>
      <div className="flex gap-2 items-center">
        <input
          type="number" min={0} max={maxMarks} step={0.5}
          value={marks} onChange={e => setMarks(e.target.value)}
          className="input w-20 text-sm"
        />
        <span className="text-xs text-gray-500">/ {maxMarks}</span>
      </div>
      <input
        className="input text-sm" placeholder="Reason (required)"
        value={reason} onChange={e => setReason(e.target.value)}
      />
      {msg && <p className="text-xs text-red-600">{msg}</p>}
      <div className="flex gap-2">
        <button onClick={save} disabled={saving} className="btn-primary text-xs py-1 px-3">
          {saving ? 'Saving…' : 'Save override'}
        </button>
        <button onClick={() => setOpen(false)} className="btn-secondary text-xs py-1 px-3">Cancel</button>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────
export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [data, setData] = useState<StudentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [resetMsg, setResetMsg] = useState('')
  const [resetting, setResetting] = useState(false)

  async function load() {
    const res = await fetch(`/api/sa/students?id=${id}`)
    if (res.status === 401 || res.status === 403) { router.push('/sa/login'); return }
    if (!res.ok) { setError('Student not found.'); setLoading(false); return }
    setData(await res.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  async function resetPassword() {
    setResetting(true)
    setResetMsg('')
    const res = await fetch('/api/sa/override', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reset_password', student_id: parseInt(id) }),
    })
    const d = await res.json()
    setResetting(false)
    if (res.ok) {
      setResetMsg(`Temp password: ${d.temp_password} — relay in person. Student must change on next login.`)
    } else {
      setResetMsg(d.message ?? 'Reset failed.')
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-gray-400">Loading…</div>
    </div>
  )

  if (!data) return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="card text-center space-y-3">
        <p className="text-red-600">{error || 'Student not found.'}</p>
        <Link href="/sa/students" className="btn-secondary">← Back</Link>
      </div>
    </div>
  )

  const { student, api_key, paper, mcq_assignments, submissions, attempts, flags, exceptions, audit_log } = data

  const taskMarks = (taskNo: number) => {
    const maxMap: Record<number, number> = { 1: 2, 2: 3, 3: 5 }
    const sub = submissions.find(s => s.task_no === taskNo)
    if (!sub) return { sub: null, effective: null, max: maxMap[taskNo] }
    const effective = sub.override_marks !== null ? sub.override_marks : sub.marks_awarded
    return { sub, effective, max: maxMap[taskNo] }
  }

  const mcqScore = mcq_assignments.filter(a => a.ca1_mcq_questions?.correct_key && a.answered_key === a.ca1_mcq_questions?.correct_key).length * 0.5

  const totalMarks =
    mcqScore +
    (taskMarks(1).effective ?? 0) +
    (taskMarks(2).effective ?? 0) +
    (taskMarks(3).effective ?? 0)

  return (
    <div className="min-h-screen bg-gray-900 text-white">

      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/sa/students" className="text-gray-400 hover:text-white text-sm">← Students</Link>
            <span className="text-gray-600">|</span>
            <div>
              <h1 className="font-bold text-white">{student.name}</h1>
              <p className="text-xs text-gray-400">{student.prn} · {student.email}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-white">{totalMarks.toFixed(1)} <span className="text-gray-400 text-base font-normal">/ 15</span></p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 bg-white min-h-screen text-gray-900 rounded-t-2xl mt-4">

        {/* Identity */}
        <SectionHead title="Identity" />
        <div className="grid grid-cols-2 gap-2">
          <Kv label="PRN" value={student.prn} />
          <Kv label="Name" value={student.name} />
          <Kv label="Email" value={student.email} />
          <Kv label="Phone" value={student.phone} />
          <Kv label="Registered" value={dt(student.registered_at)} />
          <Kv label="Last login" value={dt(student.last_login_at)} />
          <Kv label="API key prefix" value={api_key?.key_prefix ? `${api_key.key_prefix}…` : 'Not generated'} />
          <Kv label="Key generated" value={dt(api_key?.created_at ?? null)} />
        </div>

        {/* Password reset */}
        <div className="mt-4 flex items-center gap-3 flex-wrap">
          <button onClick={resetPassword} disabled={resetting} className="btn-secondary text-sm">
            {resetting ? 'Resetting…' : 'Reset password'}
          </button>
          {resetMsg && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 text-xs text-yellow-900 font-mono max-w-lg break-all">
              {resetMsg}
            </div>
          )}
        </div>

        {/* Section A — MCQ */}
        <SectionHead title="Section A — MCQ" />
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-gray-600">
            {mcq_assignments.filter(a => a.answered_key !== null).length} / 10 answered
          </span>
          <span className="text-sm font-bold">{mcqScore} / 5 marks</span>
        </div>

        <div className="space-y-3">
          {mcq_assignments.map(a => {
            const q = a.ca1_mcq_questions
            const slot = q?.ca1_mcq_slots
            const correct = q?.correct_key
            const studentAns = a.answered_key
            const isCorrect = studentAns === correct

            return (
              <div key={a.slot_no} className={`border rounded-lg p-4 ${isCorrect ? 'border-green-200 bg-green-50' : studentAns ? 'border-red-200 bg-red-50' : 'border-gray-200'}`}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-gray-500">Q{a.slot_no}</span>
                    <span className="badge-blue text-xs">{slot?.co_code}</span>
                    <span className="badge-gray text-xs">L{slot?.bloom_level} {slot?.bloom_label}</span>
                    <span className="text-xs text-gray-500">{slot?.concept?.replace(/_/g, ' ')}</span>
                  </div>
                  <span className={`text-sm font-bold ${isCorrect ? 'text-green-700' : studentAns ? 'text-red-700' : 'text-gray-400'}`}>
                    {isCorrect ? '✓ +0.5' : studentAns ? '✗ 0' : '—'}
                  </span>
                </div>
                <p className="text-sm text-gray-800 mb-3">{q?.stem}</p>
                <div className="space-y-1">
                  {(a.option_order ?? q?.options?.map(o => o.key) ?? []).map(key => {
                    const opt = q?.options?.find(o => o.key === key)
                    if (!opt) return null
                    const isStudentAns = key === studentAns
                    const isCorrectOpt = key === correct
                    return (
                      <div key={key} className={`text-xs px-3 py-2 rounded flex items-start gap-2 ${
                        isCorrectOpt ? 'bg-green-100 text-green-800' :
                        isStudentAns && !isCorrectOpt ? 'bg-red-100 text-red-800' :
                        'text-gray-600'
                      }`}>
                        <span className="font-mono font-bold w-4 flex-shrink-0">{key}.</span>
                        <span>{opt.text}</span>
                        {isStudentAns && <span className="ml-auto flex-shrink-0 font-bold">{isCorrectOpt ? '✓ student' : '✗ student'}</span>}
                        {isCorrectOpt && !isStudentAns && <span className="ml-auto flex-shrink-0 text-green-700 font-bold">correct</span>}
                      </div>
                    )
                  })}
                </div>
                {a.change_count > 0 && (
                  <p className="text-xs text-gray-400 mt-2">Changed {a.change_count} time(s)</p>
                )}
              </div>
            )
          })}
        </div>

        {/* Section B — Tasks */}
        {[1, 2, 3].map(taskNo => {
          const { sub, effective, max } = taskMarks(taskNo)
          const taskAttempts = attempts.filter(a => a.task_no === taskNo)
          const taskTitles: Record<number, string> = {
            1: 'API Key + Paper Retrieval',
            2: 'Corpus Word Count (Apify)',
            3: 'City Temperature (Apify)',
          }

          return (
            <div key={taskNo}>
              <SectionHead title={`Task ${taskNo} — ${taskTitles[taskNo]}`} />

              {!sub ? (
                <p className="text-sm text-gray-500 italic">Not submitted.</p>
              ) : (
                <div className="space-y-4">
                  {/* Status and marks */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className={statusClass(sub.verification_status)}>
                      {sub.verification_status}
                    </span>
                    <span className="text-sm font-bold">
                      {effective !== null ? `${effective} / ${max}` : 'Not graded'}
                      {sub.override_marks !== null && (
                        <span className="ml-2 text-xs text-orange-600 font-normal">
                          (overridden — was {sub.marks_awarded})
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-gray-400">{sub.attempt_count} attempt(s)</span>
                    <span className="text-xs text-gray-400">First: {dt(sub.first_submitted_at)}</span>
                  </div>

                  {/* Override */}
                  {sub.override_marks !== null && (
                    <div className="text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
                      Overridden to {sub.override_marks} by {sub.override_by} at {dt(sub.override_at)}: {sub.override_reason}
                    </div>
                  )}
                  <OverrideForm
                    submissionId={sub.id}
                    currentMarks={effective}
                    maxMarks={max}
                    taskNo={taskNo}
                    onSaved={load}
                  />

                  {/* Task 2: expected vs submitted */}
                  {taskNo === 2 && paper && (
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500 mb-1">Expected total count</p>
                        <p className="font-mono font-bold text-lg">{paper.t2_expected_total}</p>
                      </div>
                      <div className={`rounded-lg p-3 ${(sub.payload as Record<string, unknown>)?.count_total === paper.t2_expected_total ? 'bg-green-50' : 'bg-red-50'}`}>
                        <p className="text-xs text-gray-500 mb-1">Submitted total count</p>
                        <p className="font-mono font-bold text-lg">{String((sub.payload as Record<string, unknown>)?.count_total ?? '—')}</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500 mb-1">Expected page {paper.t2_scoped_page} count</p>
                        <p className="font-mono font-bold text-lg">{paper.t2_expected_scoped}</p>
                      </div>
                      <div className={`rounded-lg p-3 ${(sub.payload as Record<string, unknown>)?.count_scoped === paper.t2_expected_scoped ? 'bg-green-50' : 'bg-red-50'}`}>
                        <p className="text-xs text-gray-500 mb-1">Submitted page count</p>
                        <p className="font-mono font-bold text-lg">{String((sub.payload as Record<string, unknown>)?.count_scoped ?? '—')}</p>
                      </div>
                    </div>
                  )}

                  {/* Task 3: expected vs submitted */}
                  {taskNo === 3 && paper && (
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500 mb-1">Expected city</p>
                        <p className="font-bold">{paper.t3_city}</p>
                      </div>
                      <div className={`rounded-lg p-3 ${(sub.payload as Record<string, unknown>)?.city?.toString().toLowerCase().trim() === paper.t3_city.toLowerCase().trim() ? 'bg-green-50' : 'bg-red-50'}`}>
                        <p className="text-xs text-gray-500 mb-1">Submitted city</p>
                        <p className="font-bold">{String((sub.payload as Record<string, unknown>)?.city ?? '—')}</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500 mb-1">Server temperature</p>
                        <p className="font-mono font-bold">
                          {(sub.server_reference as Record<string, unknown>)?.temperature_c !== undefined
                            ? `${(sub.server_reference as Record<string, unknown>).temperature_c} °C`
                            : '—'}
                        </p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500 mb-1">Submitted temperature</p>
                        <p className="font-mono font-bold">{String((sub.payload as Record<string, unknown>)?.temperature_c ?? '—')} °C</p>
                      </div>
                    </div>
                  )}

                  {/* Apify detail */}
                  {(taskNo === 2 || taskNo === 3) && (
                    <div className="space-y-1">
                      <Kv label="Run ID" value={sub.submitted_run_id} />
                      <Kv label="Actor ID" value={sub.submitted_actor_id} />
                      <Kv label="Actor URL" value={
                        sub.submitted_actor_url
                          ? <a href={sub.submitted_actor_url} target="_blank" rel="noreferrer" className="text-blue-600 underline">{sub.submitted_actor_url}</a>
                          : null
                      } />
                      <Kv label="Apify user ID" value={sub.apify_user_id} />
                      <Kv label="Run status" value={sub.apify_run_status} />
                      <Kv label="Finished at" value={dt(sub.apify_finished_at)} />
                      <Kv label="Key hardcoded" value={
                        sub.key_hardcoded === true ? <span className="text-orange-600 font-semibold">YES — feedback only, not graded</span>
                        : sub.key_hardcoded === false ? 'No'
                        : 'Not checked'
                      } />
                    </div>
                  )}

                  {/* Grading detail */}
                  {sub.grading_detail && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-gray-500 hover:text-gray-700">Grading detail (JSON)</summary>
                      <pre className="mt-2 bg-gray-50 p-3 rounded-lg overflow-x-auto text-gray-700">
                        {JSON.stringify(sub.grading_detail, null, 2)}
                      </pre>
                    </details>
                  )}

                  {/* Attempt history */}
                  {taskAttempts.length > 1 && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
                        Attempt history ({taskAttempts.length} attempts)
                      </summary>
                      <div className="mt-2 space-y-2">
                        {taskAttempts.map(att => (
                          <div key={att.attempt_no} className="bg-gray-50 rounded p-2">
                            <span className="font-bold">Attempt {att.attempt_no}</span>
                            <span className="ml-2 text-gray-400">{dt(att.submitted_at)}</span>
                            {att.submitted_run_id && (
                              <span className="ml-2 font-mono">{att.submitted_run_id}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {/* Paper as issued */}
        {paper && (
          <>
            <SectionHead title="Paper as Issued" />
            <div className="space-y-2 mb-3">
              <Kv label="Seed" value={<code className="text-xs font-mono">{paper.seed}</code>} />
              <Kv label="Target word" value={<strong>{paper.t2_target_word}</strong>} />
              <Kv label="Scoped page" value={paper.t2_scoped_page} />
              <Kv label="T3 city / lat / lon" value={`${paper.t3_city} / ${paper.t3_lat} / ${paper.t3_lon}`} />
              <Kv label="First fetched" value={dt(paper.first_fetched_at)} />
              <Kv label="Fetch count" value={paper.fetch_count} />
            </div>
            <details className="text-xs">
              <summary className="cursor-pointer text-gray-500 hover:text-gray-700">Rendered paper (JSON — verbatim as served)</summary>
              <pre className="mt-2 bg-gray-50 p-3 rounded-lg overflow-x-auto text-gray-700 text-xs">
                {JSON.stringify(paper.rendered_paper, null, 2)}
              </pre>
            </details>
          </>
        )}

        {/* Flags */}
        {flags.length > 0 && (
          <>
            <SectionHead title="Flags" />
            <div className="space-y-2">
              {flags.map(f => (
                <div key={f.id} className="border rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={severityClass(f.severity)}>{f.severity}</span>
                    <span className="text-sm font-medium">{f.reason}</span>
                    <span className="text-xs text-gray-400 ml-auto">{dt(f.created_at)}</span>
                  </div>
                  {f.resolved && <p className="text-xs text-green-700">Resolved: {f.resolution}</p>}
                </div>
              ))}
            </div>
          </>
        )}

        {/* Exceptions */}
        {exceptions.length > 0 && (
          <>
            <SectionHead title="Invigilator Exceptions" />
            <div className="space-y-2">
              {exceptions.map(e => (
                <div key={e.id} className="border border-blue-200 bg-blue-50 rounded-lg p-3 text-sm">
                  <span className="font-semibold">{e.kind}</span>
                  <span className="ml-2 text-gray-600">{e.detail}</span>
                  <span className="text-xs text-gray-400 ml-2">— {e.recorded_by}, {dt(e.recorded_at)}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Audit timeline */}
        <SectionHead title="Audit Timeline" />
        <div className="space-y-1">
          {audit_log.map(entry => (
            <div key={entry.id} className="flex items-start gap-3 text-xs py-1.5 border-b border-gray-50">
              <span className="text-gray-400 flex-shrink-0 w-36">{dt(entry.at)}</span>
              <span className="text-gray-500 flex-shrink-0 w-24 truncate">{entry.actor}</span>
              <span className="font-medium text-gray-800">{entry.action}</span>
              {entry.target && <span className="text-gray-400">{entry.target}</span>}
            </div>
          ))}
        </div>

      </main>
    </div>
  )
}
