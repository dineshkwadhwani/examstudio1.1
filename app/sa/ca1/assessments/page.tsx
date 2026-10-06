'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'

type Assessment = { id: number; name: string; assessment_type: string; total_questions: number; total_marks: number; marks_per_correct: number; total_time_seconds: number | null; time_per_question: number | null; is_active: boolean; question_count?: number }
type Cohort = { id: number; name: string; student_count?: number }
type Student = { id: number; name: string; email: string; prn: string }
type Modal = 'create' | 'questions' | 'assign' | 'edit' | null

export default function Ca1AssessmentsPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [cohorts, setCohorts] = useState<Cohort[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [modal, setModal] = useState<Modal>(null)
  const [selected, setSelected] = useState<Assessment | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [form, setForm] = useState({ name: '', assessment_type: 'mcq', total_questions: '20', total_marks: '20', total_time_seconds: '', time_per_question: '', marks_per_correct: '1', is_active: false })
  const [questionJson, setQuestionJson] = useState('')
  const [assignment, setAssignment] = useState({ cohort_id: '', student_id: '' })
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const [assessmentResponse, cohortResponse, studentResponse] = await Promise.all([fetch('/api/sa/assessments'), fetch('/api/sa/assessment-cohorts'), fetch('/api/sa/students')])
    const assessmentData = await assessmentResponse.json(); const cohortData = await cohortResponse.json(); const studentData = await studentResponse.json()
    setAssessments(assessmentData.assessments ?? []); setCohorts(cohortData.cohorts ?? [])
    const unique = new Map<number, Student>()
    for (const row of studentData as Array<Student>) if (!unique.has(row.id)) unique.set(row.id, row)
    setStudents([...unique.values()]); setLoading(false)
  }, [])
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer) }, [load])

  function open(type: Modal, item?: Assessment) {
    setSelected(item ?? null); setModal(type); setError(''); setMessage('')
    if (item) setForm({ name: item.name, assessment_type: item.assessment_type, total_questions: String(item.total_questions), total_marks: String(item.total_marks), total_time_seconds: item.total_time_seconds ? String(item.total_time_seconds) : '', time_per_question: item.time_per_question ? String(item.time_per_question) : '', marks_per_correct: String(item.marks_per_correct), is_active: item.is_active })
  }

  async function saveAssessment(event: React.FormEvent) {
    event.preventDefault(); const path = selected ? `/api/sa/assessments/${selected.id}` : '/api/sa/assessments'
    const response = await fetch(path, { method: selected ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, total_questions: Number(form.total_questions), total_marks: Number(form.total_marks), marks_per_correct: Number(form.marks_per_correct), total_time_seconds: form.total_time_seconds ? Number(form.total_time_seconds) : null, time_per_question: form.time_per_question ? Number(form.time_per_question) : null }) })
    const data = await response.json(); if (!response.ok) { setError(data.message ?? data.error ?? 'Could not save assessment.'); return }
    setMessage(selected ? 'Assessment updated.' : 'Assessment created.'); setModal(null); setSelected(null); await load()
  }

  async function toggle(item: Assessment) {
    const response = await fetch(`/api/sa/assessments/${item.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: !item.is_active }) })
    if (!response.ok) { const data = await response.json(); setError(data.message ?? 'Could not update assessment.'); return }
    await load()
  }

  async function remove(item: Assessment) {
    if (!window.confirm(`Delete “${item.name}”? This removes assignments and papers for this assessment.`)) return
    const response = await fetch(`/api/sa/assessments/${item.id}`, { method: 'DELETE' }); if (!response.ok) { setError('Could not delete assessment.'); return }; setMessage('Assessment deleted.'); await load()
  }

  async function uploadQuestions(event: React.FormEvent) {
    event.preventDefault(); if (!selected) return
    try {
      const parsed = JSON.parse(questionJson); const questions = Array.isArray(parsed) ? parsed : parsed.questions
      if (!Array.isArray(questions)) throw new Error('JSON must be an array or contain a questions array.')
      const response = await fetch(`/api/sa/assessments/${selected.id}/questions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ questions }) })
      const data = await response.json(); if (!response.ok) throw new Error(data.message ?? data.error ?? 'Could not upload questions.')
      setMessage(`${data.inserted} questions saved.`); setModal(null); setQuestionJson(''); await load()
    } catch (uploadError) { setError(uploadError instanceof Error ? uploadError.message : 'Invalid question JSON.') }
  }

  async function assign(event: React.FormEvent) {
    event.preventDefault(); if (!selected) return
    const response = await fetch('/api/sa/assessment-assignments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assessment_id: selected.id, cohort_id: assignment.cohort_id ? Number(assignment.cohort_id) : undefined, student_id: assignment.student_id ? Number(assignment.student_id) : undefined }) })
    const data = await response.json(); if (!response.ok) { setError(data.message ?? data.error ?? 'Could not assign assessment.'); return }
    setMessage(`Assessment assigned to ${data.students_assigned} student${data.students_assigned === 1 ? '' : 's'}.`); setModal(null); setAssignment({ cohort_id: '', student_id: '' })
  }

  if (loading) return <div className="text-sm text-slate-500">Loading assessments…</div>
  return <div className="space-y-8"><header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-semibold text-blue-600">CA1</p><h1 className="mt-1 text-4xl font-bold tracking-tight">Assessments</h1><p className="mt-2 text-lg text-slate-500">Create, configure, assign, and review your assessments.</p></div><button onClick={() => open('create')} className="btn-primary px-5 py-3">＋ New assessment</button></header>{(message || error) && <p className={`rounded-xl p-3 text-sm ${error ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>{error || message}</p>}
    <div className="grid gap-5 xl:grid-cols-3">{assessments.map(item => <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm"><div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-bold text-slate-800">{item.name}</h2><div className="mt-3 flex flex-wrap gap-2"><span className="badge-blue">{item.assessment_type === 'mcq' ? 'MCQ' : 'Subjective'}</span><span className={item.is_active ? 'badge-green' : 'badge-gray'}>{item.is_active ? '● Active' : '○ Inactive'}</span></div></div><button onClick={() => open('edit', item)} className="text-slate-400 hover:text-blue-600" title="Edit">✎</button></div><div className="mt-6 grid grid-cols-2 gap-3 text-sm text-slate-500"><span>⌁ {item.total_questions} questions</span><span>▤ {item.question_count ?? 0} in bank</span><span>◷ {item.total_time_seconds ? `${Math.round(item.total_time_seconds / 60)} min` : 'No timer'}</span><span>☆ {item.total_marks} total marks</span></div><div className="mt-6 flex flex-wrap gap-2"><button onClick={() => open('questions', item)} className="btn-secondary text-xs">⇧ Questions</button><button onClick={() => void toggle(item)} className="btn-secondary text-xs">{item.is_active ? 'Deactivate' : 'Activate'}</button><button onClick={() => open('assign', item)} className="btn-primary text-xs">Assign</button></div><div className="mt-5 flex flex-wrap gap-5 text-sm font-semibold"><Link href={`/sa/ca1/assessments/${item.id}`} className="text-blue-600 hover:text-blue-800">Review</Link><Link href={`/sa/ca1/assessments/${item.id}?try=1`} className="text-blue-600 hover:text-blue-800">Try now</Link><button onClick={() => open('edit', item)} className="text-slate-600 hover:text-slate-900">Edit</button><button onClick={() => void remove(item)} className="text-red-600 hover:text-red-800">Delete</button></div></article>)}</div>{!assessments.length && <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-14 text-center text-slate-500">No assessments yet. Create your first assessment above.</div>}
    {modal && <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4"><div className="w-full max-w-xl rounded-2xl bg-white p-7 shadow-2xl"><div className="flex items-start justify-between"><h2 className="text-xl font-bold text-slate-800">{modal === 'create' ? 'New assessment' : modal === 'edit' ? 'Edit assessment' : modal === 'questions' ? 'Question bank' : 'Assign assessment'}</h2><button onClick={() => setModal(null)} className="text-2xl text-slate-400">×</button></div>{(modal === 'create' || modal === 'edit') && <form onSubmit={saveAssessment} className="mt-5 space-y-4"><input className="input" placeholder="Assessment name" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} required /><select className="input" value={form.assessment_type} onChange={event => setForm({ ...form, assessment_type: event.target.value })}><option value="mcq">MCQ</option><option value="subjective">Subjective</option><option value="subjective_online">Subjective online</option></select><div className="grid grid-cols-2 gap-3"><label className="label">Questions<input className="input mt-1" type="number" min="1" value={form.total_questions} onChange={event => setForm({ ...form, total_questions: event.target.value })} /></label><label className="label">Total marks<input className="input mt-1" type="number" min="0" step="0.01" value={form.total_marks} onChange={event => setForm({ ...form, total_marks: event.target.value })} /></label></div><div className="grid grid-cols-2 gap-3"><label className="label">Total time (seconds)<input className="input mt-1" type="number" min="0" value={form.total_time_seconds} onChange={event => setForm({ ...form, total_time_seconds: event.target.value })} /></label><label className="label">Time per question<input className="input mt-1" type="number" min="0" value={form.time_per_question} onChange={event => setForm({ ...form, time_per_question: event.target.value })} /></label></div><label className="flex gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={event => setForm({ ...form, is_active: event.target.checked })} /> Active assessment</label><button className="btn-primary w-full">Save assessment</button></form>}{modal === 'questions' && <form onSubmit={uploadQuestions} className="mt-5 space-y-4"><p className="text-sm text-slate-500">Upload an array of questions or an object containing <code>questions</code>. Historical paper questions are retained.</p><textarea className="input min-h-64 font-mono text-xs" value={questionJson} onChange={event => setQuestionJson(event.target.value)} placeholder='[{"question":"What is RAG?","options":{"A":"…","B":"…","C":"…","D":"…"},"correct_answer":"A"}]' required /><button className="btn-primary w-full">Save question bank</button></form>}{modal === 'assign' && <form onSubmit={assign} className="mt-5 space-y-4"><p className="text-sm text-slate-500">Assign <strong>{selected?.name}</strong> to a cohort or one student. A paper is generated for each recipient.</p><select className="input" value={assignment.cohort_id} onChange={event => setAssignment({ cohort_id: event.target.value, student_id: '' })}><option value="">Choose cohort</option>{cohorts.map(item => <option key={item.id} value={item.id}>{item.name} · {item.student_count ?? 0} students</option>)}</select><select className="input" value={assignment.student_id} onChange={event => setAssignment({ cohort_id: '', student_id: event.target.value })}><option value="">Or choose individual student</option>{students.map(item => <option key={item.id} value={item.id}>{item.name} · {item.prn}</option>)}</select><button className="btn-primary w-full">Assign assessment</button></form>}</div></div>}
  </div>
}
