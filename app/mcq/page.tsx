'use client'
import { PageHeader } from '@/components/student/PageHeader'
import { AccountMenu } from '@/components/student/AccountMenu'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { SaveTick } from '@/components/ui/SaveTick'

interface Option { key: string; text: string }
interface Question {
  slot_no: number
  concept: string
  co_code: string
  bloom_level: number
  bloom_label: string
  stem: string
  options: Option[]
  answered_key: string | null
  answered_at: string | null
  change_count: number
}

function QuestionCard({
  q,
  onAnswer,
  saving,
  isSaving,
  saved,
  saveError,
}: {
  q: Question
  onAnswer: (slotNo: number, key: string) => Promise<void>
  saving: boolean
  isSaving: boolean
  saved: boolean
  saveError: boolean
}) {
  return (
    <div className={`card border-2 ${q.answered_key ? 'border-green-200 bg-green-50' : 'border-gray-200'}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Q{q.slot_no}</span>
          <span className="badge-blue text-xs">{q.co_code}</span>
          <span className="badge-gray text-xs">L{q.bloom_level} {q.bloom_label}</span>
        </div>
        <div className="flex items-center gap-2">
          {saving && <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-800 animate-pulse">⌛ Saving answer…</span>}
          <SaveTick show={saved} />
          <SaveTick show={saveError} error />
          {q.answered_key && !saving && !saved && !saveError && (
            <span className="text-green-600 text-xs font-medium">✓ Answered</span>
          )}
        </div>
      </div>

      <p className="text-gray-900 font-medium mb-4 leading-relaxed text-sm">{q.stem}</p>

      <div className="space-y-2">
        {q.options.map(opt => (
          <button
            key={opt.key}
            onClick={() => onAnswer(q.slot_no, opt.key)}
            disabled={isSaving}
            className={`w-full text-left px-4 py-3 rounded-lg border-2 text-sm transition-colors ${
              q.answered_key === opt.key
                ? 'border-blue-500 bg-blue-50 text-blue-900 font-medium'
                : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 text-gray-700'
            }`}
          >
            <span className="font-mono text-xs font-bold mr-2 text-gray-400">{opt.key}.</span>
            {opt.text}
          </button>
        ))}
      </div>

      {q.change_count > 0 && (
        <p className="text-xs text-gray-400 mt-2">Changed {q.change_count} time{q.change_count !== 1 ? 's' : ''}</p>
      )}
    </div>
  )
}

export default function McqPage() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [savingSlot, setSavingSlot] = useState<number | null>(null)
  const [savedSlot, setSavedSlot] = useState<number | null>(null)
  const [errorSlot, setErrorSlot] = useState<number | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    let active = true
    async function fetchQuestions() {
      try {
        const res = await fetch('/api/mcq')
        if (!res.ok) {
          const data = await res.json()
          if (active) setError(data.message ?? 'Failed to load questions.')
          return
        }
        const nextQuestions = await res.json()
        if (active) setQuestions(nextQuestions)
      } catch {
        if (active) setError('Failed to load questions. Please refresh to try again.')
      } finally {
        if (active) setLoading(false)
      }
    }
    fetchQuestions()
    return () => { active = false }
  }, [])

  async function handleAnswer(slotNo: number, key: string) {
    setSavingSlot(slotNo)
    setSavedSlot(null)
    setErrorSlot(null)

    try {
      const res = await fetch('/api/mcq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot_no: slotNo, answer_key: key }),
      })

      if (res.ok) {
        setSavedSlot(slotNo)
        setQuestions(prev =>
          prev.map(q =>
            q.slot_no === slotNo
              ? { ...q, answered_key: key, change_count: q.answered_key ? q.change_count + 1 : q.change_count }
              : q
          )
        )
        setTimeout(() => setSavedSlot(null), 2000)
      } else {
        const data = await res.json()
        if (data.error === 'test_submitted') setError(data.message)
        setErrorSlot(slotNo)
        setTimeout(() => setErrorSlot(null), 2000)
      }
    } catch {
      setErrorSlot(slotNo)
      setTimeout(() => setErrorSlot(null), 2000)
    } finally {
      setSavingSlot(null)
    }
  }

  const answered = questions.filter(q => q.answered_key).length
  const allAnswered = questions.length > 0 && answered === questions.length
  const currentQuestion = questions[currentIndex]

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-gray-500">Loading questions…</div>
    </div>
  )

  if (error) return (
    <>
    <PageHeader title="Section A — MCQ" />
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="card max-w-md text-center space-y-3">
        <p className="text-red-600">{error}</p>
        <Link href="/dashboard" className="btn-secondary">← Back to Dashboard</Link>
      </div>
    </div>
    </>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex flex-wrap gap-3 items-center justify-between">
          <div>
            <h1 className="font-bold text-gray-900">Section A — MCQ</h1>
            <p className="text-xs text-gray-500">Answers save automatically when you click an option</p>
          </div>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
            <div className="text-center">
              <p className="text-xs text-gray-500">Answered</p>
              <p className={`text-lg font-bold ${allAnswered ? 'text-green-600' : 'text-gray-800'}`}>
                {answered} / {questions.length}
              </p>
            </div>
            <Link href="/dashboard" className="btn-secondary text-sm">
              {allAnswered ? '→ Back to Dashboard' : '← Dashboard'}
            </Link>
            <AccountMenu />
          </div>
        </div>
      </header>

      {savingSlot !== null && (
        <div className="fixed inset-x-0 top-0 z-30 flex justify-center px-4 pt-4" role="status" aria-live="polite">
          <div className="rounded-xl border border-blue-300 bg-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-xl">
            <span className="mr-2 text-lg" aria-hidden="true">⌛</span>
            Saving your answer for Question {savingSlot}… Please wait.
          </div>
        </div>
      )}

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center justify-between text-sm">
          <p className="font-semibold text-gray-700">
            Question {currentIndex + 1} of {questions.length}
          </p>
          <p className="text-gray-500">{answered} of {questions.length} answered</p>
        </div>

        {currentQuestion && (
          <QuestionCard
            key={currentQuestion.slot_no}
            q={currentQuestion}
            onAnswer={handleAnswer}
            saving={savingSlot === currentQuestion.slot_no}
            isSaving={savingSlot !== null}
            saved={savedSlot === currentQuestion.slot_no}
            saveError={errorSlot === currentQuestion.slot_no}
          />
        )}

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setCurrentIndex(index => Math.max(0, index - 1))}
            disabled={currentIndex === 0 || savingSlot !== null}
          >
            ← Previous
          </button>

          {currentIndex < questions.length - 1 ? (
            <button
              type="button"
              className="btn-primary"
              onClick={() => setCurrentIndex(index => Math.min(questions.length - 1, index + 1))}
              disabled={savingSlot !== null}
            >
              Next →
            </button>
          ) : (
            <Link href="/dashboard" className={`btn-primary ${!allAnswered ? 'opacity-60' : ''}`}>
              {allAnswered ? 'Continue to Section B →' : 'Finish later →'}
            </Link>
          )}
        </div>

        {allAnswered && (
          <div className="card bg-green-50 border-green-200 text-center py-4">
            <p className="text-green-800 font-semibold">All {questions.length} questions answered ✓</p>
            <p className="text-green-700 text-sm mt-1">You can change your answers anytime before the exam ends.</p>
          </div>
        )}

      </main>
    </div>
  )
}
