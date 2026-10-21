'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type PaperQuestion = { id: number; question_order: number; selected_answer: string | null; answer_text: string | null; is_correct: boolean | null; marks_awarded: number | null; evaluation_feedback: string | null; question: { question_text: string; options?: Record<string, string>; correct_answer?: string; explanation?: string; max_marks?: number; co?: string } | null }
type Paper = { id: number; status: string; score: number | null; started_at: string | null; submitted_at: string | null; assessment: { name: string; assessment_type: string; total_marks: number; time_per_question?: number | null; total_time_seconds?: number | null; marks_per_correct: number; is_active: boolean } }

export default function AssessmentPaperPage({ params }: { params: Promise<{ id: string }> }) {
  const [paper, setPaper] = useState<Paper | null>(null)
  const [questions, setQuestions] = useState<PaperQuestion[]>([])
  const [current, setCurrent] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [remaining, setRemaining] = useState<number | null>(null)

  useEffect(() => {
    params.then(({ id }) => fetch(`/api/me/assessments/${id}`).then(async response => {
      const data = await response.json()
      if (!response.ok) { setError(data.message ?? 'Assessment not found.'); setLoading(false); return }
      setPaper(data.paper); setQuestions(data.questions ?? []); setLoading(false)
      if (data.paper.status === 'completed') return
      if (data.paper.status === 'pending') {
        if (!data.paper.assessment?.is_active) {
          setError('This assessment is currently inactive.')
          return
        }
        const startResponse = await fetch(`/api/me/assessments/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'start' }) })
        const startData = await startResponse.json()
        if (startResponse.ok) setPaper(currentPaper => currentPaper ? { ...currentPaper, ...startData.paper, status: 'in_progress' } : currentPaper)
      }
    }).catch(() => { setError('Could not load assessment.'); setLoading(false) }))
  }, [params])

  useEffect(() => {
    if (!paper?.started_at || paper.status === 'completed' || !paper.assessment.total_time_seconds) return
    const tick = () => setRemaining(Math.max(0, paper.assessment.total_time_seconds! - Math.floor((Date.now() - new Date(paper.started_at!).getTime()) / 1000)))
    tick(); const timer = window.setInterval(tick, 1000); return () => window.clearInterval(timer)
  }, [paper])

  const active = questions[current]
  const completed = paper?.status === 'completed'
  const unavailable = paper?.status === 'pending' && paper.assessment?.is_active === false
  const answered = questions.filter(question => question.selected_answer || question.answer_text?.trim()).length
  async function update(action: string, body: Record<string, unknown> = {}) {
    if (!paper) return
    const response = await fetch(`/api/me/assessments/${paper.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...body }) })
    const data = await response.json()
    if (!response.ok) throw new Error(data.message ?? data.error ?? 'Could not save answer.')
    return data
  }

  async function answer(value: string) {
    if (!active || completed) return
    setSaving(true); setError('')
    try { await update('answer', { paper_question_id: active.id, selected_answer: value }); setQuestions(items => items.map(item => item.id === active.id ? { ...item, selected_answer: value } : item)) } catch (e) { setError(e instanceof Error ? e.message : 'Could not save answer.') } finally { setSaving(false) }
  }

  async function submit() {
    if (!paper || completed || !window.confirm('Submit this assessment? You cannot change your answers afterwards.')) return
    setSaving(true); setError('')
    try { const data = await update('submit'); setPaper(currentPaper => currentPaper ? { ...currentPaper, ...data.paper, status: 'completed' } : currentPaper) } catch (e) { setError(e instanceof Error ? e.message : 'Could not submit assessment.') } finally { setSaving(false) }
  }

  if (loading) return <main className="mx-auto max-w-4xl px-4 py-10 text-sm text-gray-500">Loading assessment…</main>
  if (!paper) return <main className="mx-auto max-w-4xl px-4 py-10"><p className="text-red-700">{error || 'Assessment not found.'}</p></main>
  return <main className="mx-auto max-w-4xl space-y-4 px-4 py-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><Link href="/assessments" className="text-sm text-blue-700 hover:underline">← My assessments</Link><h1 className="mt-2 text-2xl font-bold text-gray-900">{paper.assessment.name}</h1><p className="text-sm text-gray-500">{completed ? 'Completed result' : `${answered} of ${questions.length} answered`}</p></div>{!completed && remaining !== null && <div className="rounded-lg bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-900">Time left: {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}</div>}</div>
    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {completed ? <section className="card"><p className="text-sm uppercase tracking-wide text-gray-500">Your score</p><p className="mt-1 text-4xl font-bold text-blue-900">{paper.score ?? 0} <span className="text-lg font-normal text-gray-500">/ {paper.assessment.total_marks}</span></p><div className="mt-6 space-y-4">{questions.map((item, index) => <article key={item.id} className="rounded-xl border border-gray-200 p-4"><p className="font-semibold text-gray-900">Q{index + 1}. {item.question?.question_text ?? 'Question unavailable'}</p><p className="mt-2 text-sm text-gray-600">Your answer: {item.selected_answer ?? item.answer_text ?? 'Not answered'} {item.is_correct === true ? '· Correct' : item.is_correct === false ? '· Incorrect' : ''}</p>{item.question?.explanation && <p className="mt-2 text-sm text-gray-600">{item.question.explanation}</p>}</article>)}</div></section> : unavailable ? <section className="card"><p className="font-semibold text-gray-900">Assessment unavailable</p><p className="mt-1 text-sm text-gray-600">This assessment is currently inactive. Please check back when it is activated.</p></section> : active ? <section className="card"><div className="mb-4 flex items-center justify-between text-sm text-gray-500"><span>Question {current + 1} of {questions.length}</span><span>{active.question?.co ?? ''}</span></div><h2 className="text-lg font-semibold leading-relaxed text-gray-900">{active.question?.question_text ?? 'Question unavailable'}</h2>{paper.assessment.assessment_type === 'mcq' ? <div className="mt-5 space-y-3">{Object.entries(active.question?.options ?? {}).map(([option, label]) => <button key={option} type="button" disabled={saving} onClick={() => void answer(option)} className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left transition ${active.selected_answer === option ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}><span className="font-bold">{option}</span><span>{label}</span></button>)}</div> : <textarea className="input mt-5 min-h-48" value={active.answer_text ?? ''} onChange={e => setQuestions(items => items.map(item => item.id === active.id ? { ...item, answer_text: e.target.value } : item))} onBlur={() => void update('answer', { paper_question_id: active.id, answer_text: active.answer_text ?? '' })} /> }<div className="mt-6 flex flex-wrap justify-between gap-3"><button className="btn-secondary" disabled={current === 0} onClick={() => setCurrent(value => value - 1)}>Previous</button>{current < questions.length - 1 ? <button className="btn-primary" onClick={() => setCurrent(value => value + 1)}>Next</button> : <button className="btn-primary" disabled={saving} onClick={() => void submit()}>{saving ? 'Submitting…' : 'Submit assessment'}</button>}</div></section> : <p className="card">This assessment has no questions yet.</p>}
  </main>
}
