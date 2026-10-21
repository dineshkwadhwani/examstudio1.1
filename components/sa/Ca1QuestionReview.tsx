'use client'

import { useState } from 'react'

type ReviewQuestion = {
  id: number
  question_text: string
  co: string | null
  options: Record<string, unknown>
  correct_answer: string | null
  explanation: string | null
  model_answer: string | null
}

type Draft = {
  question_text: string
  options: Record<string, string>
  correct_answer: string
  explanation: string
  model_answer: string
  co: string
}

function toDraft(question: ReviewQuestion): Draft {
  return {
    question_text: question.question_text,
    options: { A: String(question.options?.A ?? ''), B: String(question.options?.B ?? ''), C: String(question.options?.C ?? ''), D: String(question.options?.D ?? '') },
    correct_answer: question.correct_answer ?? '',
    explanation: question.explanation ?? '',
    model_answer: question.model_answer ?? '',
    co: question.co ?? '',
  }
}

export default function Ca1QuestionReview({ assessmentId, initialQuestions }: { assessmentId: number; initialQuestions: ReviewQuestion[] }) {
  const [questions, setQuestions] = useState(initialQuestions)
  const [editing, setEditing] = useState<number | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  function startEditing(question: ReviewQuestion) {
    setEditing(question.id)
    setDraft(toDraft(question))
    setMessage('')
    setError('')
  }

  function cancelEditing() {
    setEditing(null)
    setDraft(null)
  }

  async function saveQuestion() {
    if (!draft || editing === null) return
    setSaving(true)
    setMessage('')
    setError('')
    try {
      const response = await fetch(`/api/sa/assessments/${assessmentId}/questions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question_id: editing, ...draft }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message ?? 'Could not save question.')
      setQuestions(items => items.map(item => item.id === editing ? { ...item, ...data.question } : item))
      setMessage('Question saved.')
      cancelEditing()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save question.')
    } finally {
      setSaving(false)
    }
  }

  return <div>
    {(message || error) && <p className={`border-b px-7 py-3 text-sm ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-700'}`} role={error ? 'alert' : 'status'}>{error || message}</p>}
    <div className="divide-y divide-slate-100">
      {questions.map((question, index) => {
        const isEditing = editing === question.id && draft
        return <article key={question.id} className="px-7 py-5">
          {!isEditing ? <div className="flex gap-4">
            <span className="font-bold text-blue-600">Q{index + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3"><p className="font-semibold text-slate-800">{question.question_text}</p><button type="button" onClick={() => startEditing(question)} className="btn-secondary shrink-0 text-xs">Edit</button></div>
              {question.co && <span className="mt-2 inline-flex badge-blue">{question.co}</span>}
              <div className="mt-3 grid gap-2 sm:grid-cols-2">{Object.entries(question.options ?? {}).map(([key, value]) => <div key={key} className={`rounded-lg border px-3 py-2 text-sm ${key === question.correct_answer ? 'border-green-200 bg-green-50 text-green-800' : 'border-slate-200 text-slate-600'}`}><strong>{key}.</strong> {String(value ?? '')}</div>)}</div>
              {question.explanation && <p className="mt-3 text-sm text-slate-500"><strong>Explanation:</strong> {question.explanation}</p>}
            </div>
          </div> : <div className="space-y-4">
            <div className="flex items-center justify-between"><span className="font-bold text-blue-600">Q{index + 1}</span><span className="text-xs text-slate-400">Question ID {question.id}</span></div>
            <label className="label">Question text<textarea className="input mt-1 min-h-24" value={draft.question_text} onChange={event => setDraft({ ...draft, question_text: event.target.value })} /></label>
            <div className="grid gap-3 sm:grid-cols-2">{(['A', 'B', 'C', 'D'] as const).map(key => <label key={key} className="label">Option {key}<input className="input mt-1" value={draft.options[key]} onChange={event => setDraft({ ...draft, options: { ...draft.options, [key]: event.target.value } })} /></label>)}</div>
            <div className="grid gap-3 sm:grid-cols-2"><label className="label">Correct answer<select className="input mt-1" value={draft.correct_answer} onChange={event => setDraft({ ...draft, correct_answer: event.target.value })}><option value="">Select answer</option>{['A', 'B', 'C', 'D'].map(key => <option key={key} value={key}>{key}</option>)}</select></label><label className="label">CO<input className="input mt-1" value={draft.co} onChange={event => setDraft({ ...draft, co: event.target.value })} /></label></div>
            <label className="label">Explanation<textarea className="input mt-1 min-h-20" value={draft.explanation} onChange={event => setDraft({ ...draft, explanation: event.target.value })} /></label>
            <label className="label">Model answer<textarea className="input mt-1 min-h-20" value={draft.model_answer} onChange={event => setDraft({ ...draft, model_answer: event.target.value })} /></label>
            <div className="flex gap-2"><button type="button" onClick={() => void saveQuestion()} disabled={saving} className="btn-primary text-sm">{saving ? 'Saving…' : 'Save question'}</button><button type="button" onClick={cancelEditing} disabled={saving} className="btn-secondary text-sm">Cancel</button></div>
          </div>}
        </article>
      })}
      {!questions.length && <p className="p-10 text-center text-sm text-slate-500">No questions uploaded yet.</p>}
    </div>
  </div>
}
