import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'

type ReviewQuestion = { id: number; question_text: string; co: string | null; options: Record<string, unknown>; correct_answer: string | null }

export default async function Ca1AssessmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id)
  if (!Number.isInteger(id)) notFound()
  const { data: assessment } = await db.from('ca1_assessments').select('*').eq('id', id).single()
  if (!assessment) notFound()
  const { data: questions } = await db.from('ca1_assessment_questions').select('*').eq('assessment_id', id).order('question_order')
  return <div className="space-y-6"><Link href="/sa/ca1/assessments" className="text-sm font-semibold text-blue-600 hover:text-blue-800">← Assessments</Link><header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-semibold text-blue-600">{assessment.assessment_type}</p><h1 className="mt-1 text-4xl font-bold tracking-tight text-slate-900">{assessment.name}</h1><p className="mt-2 text-slate-500">{questions?.length ?? 0} questions in the bank · {assessment.total_marks} total marks</p></div><span className={assessment.is_active ? 'badge-green' : 'badge-gray'}>{assessment.is_active ? 'Active' : 'Inactive'}</span></header><section className="rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 px-7 py-5"><h2 className="text-xl font-bold text-slate-800">Question review</h2><p className="mt-1 text-sm text-slate-500">Review the current question bank before assigning the assessment.</p></div><div className="divide-y divide-slate-100">{(questions as ReviewQuestion[] ?? []).map((question, index) => <article key={question.id} className="px-7 py-5"><div className="flex gap-4"><span className="font-bold text-blue-600">Q{index + 1}</span><div className="min-w-0 flex-1"><p className="font-semibold text-slate-800">{question.question_text}</p>{question.co && <span className="mt-2 inline-flex badge-blue">{question.co}</span>}<div className="mt-3 grid gap-2 sm:grid-cols-2">{Object.entries(question.options ?? {}).map(([key, value]) => <div key={key} className={`rounded-lg border px-3 py-2 text-sm ${key === question.correct_answer ? 'border-green-200 bg-green-50 text-green-800' : 'border-slate-200 text-slate-600'}`}><strong>{key}.</strong> {String(value ?? '')}</div>)}</div></div></div></article>)}</div>{!(questions ?? []).length && <p className="p-10 text-center text-sm text-slate-500">No questions uploaded yet.</p>}</section></div>
}
