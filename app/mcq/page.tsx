'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
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
  saved,
  saveError,
}: {
  q: Question
  onAnswer: (slotNo: number, key: string) => Promise<void>
  saving: boolean
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
          {saving && <span className="text-xs text-gray-500 animate-pulse">Saving…</span>}
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
            disabled={saving}
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
  const router = useRouter()
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [savingSlot, setSavingSlot] = useState<number | null>(null)
  const [savedSlot, setSavedSlot] = useState<number | null>(null)
  const [errorSlot, setErrorSlot] = useState<number | null>(null)

  useEffect(() => {
    fetchQuestions()
  }, [])

  async function fetchQuestions() {
    const res = await fetch('/api/mcq')
    if (res.status === 401 || res.status === 403) {
      const data = await res.json()
      setError(data.message ?? 'Access denied.')
      setLoading(false)
      return
    }
    if (!res.ok) { setError('Failed to load questions.'); setLoading(false); return }
    const data = await res.json()
    setQuestions(data)
    setLoading(false)
  }

  async function handleAnswer(slotNo: number, key: string) {
    setSavingSlot(slotNo)
    setSavedSlot(null)
    setErrorSlot(null)

    const res = await fetch('/api/mcq', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slot_no: slotNo, answer_key: key }),
    })

    setSavingSlot(null)

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
      setErrorSlot(slotNo)
      setTimeout(() => setErrorSlot(null), 2000)
    }
  }

  const answered = questions.filter(q => q.answered_key).length
  const allAnswered = answered === 10

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-gray-500">Loading questions…</div>
    </div>
  )

  if (error) return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="card max-w-md text-center space-y-3">
        <p className="text-red-600">{error}</p>
        <Link href="/dashboard" className="btn-secondary">← Back to Dashboard</Link>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="font-bold text-gray-900">Section A — MCQ</h1>
            <p className="text-xs text-gray-500">Answers save automatically when you click an option</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-center">
              <p className="text-xs text-gray-500">Answered</p>
              <p className={`text-lg font-bold ${allAnswered ? 'text-green-600' : 'text-gray-800'}`}>
                {answered} / 10
              </p>
            </div>
            <Link href="/dashboard" className="btn-secondary text-sm">
              {allAnswered ? '→ Back to Dashboard' : '← Dashboard'}
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {allAnswered && (
          <div className="card bg-green-50 border-green-200 text-center py-4">
            <p className="text-green-800 font-semibold">All 10 questions answered ✓</p>
            <p className="text-green-700 text-sm mt-1">You can change your answers anytime before the exam ends.</p>
            <Link href="/dashboard" className="btn-primary mt-3 inline-flex">
              Continue to Section B →
            </Link>
          </div>
        )}

        {questions.map(q => (
          <QuestionCard
            key={q.slot_no}
            q={q}
            onAnswer={handleAnswer}
            saving={savingSlot === q.slot_no}
            saved={savedSlot === q.slot_no}
            saveError={errorSlot === q.slot_no}
          />
        ))}

        {allAnswered && (
          <div className="text-center pb-8">
            <Link href="/dashboard" className="btn-primary">
              Return to Dashboard →
            </Link>
          </div>
        )}
      </main>
    </div>
  )
}
