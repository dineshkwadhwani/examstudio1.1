import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import Ca1QuestionReview from '@/components/sa/Ca1QuestionReview'

type ReviewQuestion = {
  id: number
  question_text: string
  co: string | null
  options: Record<string, unknown>
  correct_answer: string | null
  explanation: string | null
  model_answer: string | null
}

export default async function Ca1AssessmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id)
  if (!Number.isInteger(id)) notFound()

  const { data: assessment } = await db.from('ca1_assessments').select('*').eq('id', id).single()
  if (!assessment) notFound()
  const { data: questions } = await db.from('ca1_assessment_questions').select('id, question_text, co, options, correct_answer, explanation, model_answer').eq('assessment_id', id).order('question_order')

  return <div className="space-y-6">
    <Link href="/sa/ca1/assessments" className="text-sm font-semibold text-blue-600 hover:text-blue-800">← Assessments</Link>
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-sm font-semibold text-blue-600">{assessment.assessment_type}</p><h1 className="mt-1 text-4xl font-bold tracking-tight text-slate-900">{assessment.name}</h1><p className="mt-2 text-slate-500">{questions?.length ?? 0} questions in the bank · {assessment.total_marks} total marks</p></div>
      <span className={assessment.is_active ? 'badge-green' : 'badge-gray'}>{assessment.is_active ? 'Active' : 'Inactive'}</span>
    </header>
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-7 py-5"><h2 className="text-xl font-bold text-slate-800">Question review and editing</h2><p className="mt-1 text-sm text-slate-500">Review each question, answer, and explanation before assigning this assessment.</p></div>
      <Ca1QuestionReview assessmentId={id} initialQuestions={(questions ?? []) as ReviewQuestion[]} />
    </section>
  </div>
}
