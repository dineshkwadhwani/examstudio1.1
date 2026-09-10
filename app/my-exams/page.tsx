import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { getStudentExams, type StudentExam } from '@/lib/student-exams'
import { PageHeader } from '@/components/student/PageHeader'

type Question = { slot_no: number; answered_key: string | null; is_correct: boolean | null; ca1_mcq_questions: { stem: string; options: { key: string; text: string }[]; correct_key: string; rationale: string } }
type Submission = { task_no: number; payload: Record<string, unknown>; marks_awarded: number | null; override_marks: number | null; grading_detail: Record<string, unknown> | null }
const TASKS = [{ no: 1, title: 'Task 1 — Fetch My Magic Code', max: 1 }, { no: 2, title: 'Task 2 — Corpus Word Count', max: 4 }, { no: 3, title: 'Task 3 — City Temperature', max: 5 }]

function label(key: string) { return key.replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase()) }
function value(item: unknown) { return item === null || item === undefined ? '—' : typeof item === 'object' ? JSON.stringify(item) : String(item) }

function MarkingDetail({ detail }: { detail: Record<string, unknown> | null }) {
  if (!detail) return <p className="mt-3 text-xs text-gray-500">Marking details are being prepared.</p>
  return <div className="mt-3 space-y-2">{Object.entries(detail).map(([key, raw]) => {
    const item = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
    const result = item.correct ?? item.verified
    return <div key={key} className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-700">
      <div className="flex flex-wrap justify-between gap-2"><span className="font-semibold text-gray-900">{label(key)}</span><span className={result === true ? 'font-medium text-green-700' : result === false ? 'font-medium text-red-700' : ''}>{result === true ? 'Correct' : result === false ? 'Not awarded' : 'Recorded'}{typeof item.marks === 'number' ? ` · ${item.marks} mark${item.marks === 1 ? '' : 's'}` : ''}</span></div>
      {(item.submitted !== undefined || item.expected !== undefined || item.server_reading !== undefined) && <p className="mt-1">{item.submitted !== undefined && <>Your answer: <strong>{value(item.submitted)}</strong>. </>}{item.expected !== undefined && <>Expected: <strong>{value(item.expected)}</strong>. </>}{item.server_reading !== undefined && <>Reference reading: <strong>{value(item.server_reading)}</strong>.</>}</p>}
    </div>
  })}</div>
}

export default async function MyExamsPage({ searchParams }: { searchParams: Promise<{ exam?: string }> }) {
  const student = await getSession()
  if (!student || student.type !== 'student') redirect('/login')
  let exams: StudentExam[] = []
  let failed = false
  try { exams = await getStudentExams(student.id) } catch { failed = true }
  const params = await searchParams
  const selected = exams.find(exam => String(exam.id) === params.exam)
  const completed = selected?.status === 'closed' || selected?.status === 'archived'

  let questions: Question[] = []
  let submissions: Submission[] = []
  if (selected && completed) {
    const [questionResult, submissionResult] = await Promise.all([
      db.from('ca1_mcq_assignments').select('slot_no, answered_key, is_correct, ca1_mcq_questions!inner(stem, options, correct_key, rationale)').eq('student_id', student.id).eq('session_id', selected.id).order('slot_no'),
      db.from('ca1_submissions').select('task_no, payload, marks_awarded, override_marks, grading_detail').eq('student_id', student.id).eq('session_id', selected.id).order('task_no'),
    ])
    questions = (questionResult.data ?? []) as unknown as Question[]
    submissions = (submissionResult.data ?? []) as unknown as Submission[]
  }
  const mcqMarks = questions.filter(question => question.is_correct).length * 0.5
  const taskMarks = TASKS.reduce((total, task) => { const submission = submissions.find(item => item.task_no === task.no); return total + (submission?.override_marks ?? submission?.marks_awarded ?? 0) }, 0)

  return <><PageHeader title="My Exams" /><main className="mx-auto max-w-4xl space-y-4 px-4 py-6">
    {failed ? <p role="alert" className="card text-red-700">Could not load your exam history. Refresh to try again.</p> : exams.length === 0 ? <div className="card space-y-3"><h2 className="font-semibold text-gray-900">No exams yet</h2><p className="text-sm text-gray-600">Completed exams and answer sheets will appear here.</p><Link href="/dashboard" className="btn-primary">Go to dashboard</Link></div> : <>
      {!selected && <><p className="text-sm text-gray-600">Select an exam to view its answer sheet and marks.</p><ul className="space-y-4">{exams.map(exam => { const ended = exam.status === 'closed' || exam.status === 'archived'; return <li key={exam.id} className="card"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-medium text-blue-700">{exam.ca1_exam_definitions?.code ?? 'Exam'}</p><h2 className="mt-1 font-semibold text-gray-900">{exam.ca1_exam_definitions?.title ?? exam.label}</h2><p className="mt-1 text-sm text-gray-600">{exam.label}</p></div><span className={ended ? 'badge-gray' : 'badge-blue'}>{ended ? 'Completed' : 'In progress'}</span></div>{ended ? <Link href={`/my-exams?exam=${exam.id}`} className="btn-secondary mt-3 inline-flex text-sm">View answer sheet</Link> : <Link href="/dashboard" className="btn-secondary mt-3 inline-flex text-sm">Continue exam</Link>}</li> })}</ul></>}
      {selected && !completed && <div className="card space-y-3"><h2 className="font-semibold text-gray-900">This exam is still in progress</h2><p className="text-sm text-gray-600">The answer sheet becomes available after the exam closes.</p><Link href="/dashboard" className="btn-primary">Continue exam</Link><Link href="/my-exams" className="btn-secondary">Back to My Exams</Link></div>}
      {selected && completed && <><Link href="/my-exams" className="text-sm text-blue-700 hover:underline">← All exams</Link><section className="card border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50"><p className="text-sm font-semibold text-blue-700">{selected.ca1_exam_definitions?.code ?? 'Exam'}</p><h2 className="mt-1 text-xl font-bold text-blue-950">{selected.ca1_exam_definitions?.title ?? selected.label}</h2><p className="mt-1 text-sm text-blue-800">{selected.label}</p><p className="mt-4 text-3xl font-bold text-blue-950">{(mcqMarks + taskMarks).toFixed(1)} <span className="text-base font-normal text-blue-700">/ 15 marks</span></p></section>
        <section className="card"><h2 className="font-semibold text-gray-900">Section A — MCQ</h2><p className="mt-1 text-sm text-gray-600">{mcqMarks.toFixed(1)} / 5 marks</p><div className="mt-4 space-y-4">{questions.map(question => { const examQuestion = question.ca1_mcq_questions; return <article key={question.slot_no} className="rounded-xl border border-gray-200 p-4"><p className="font-semibold text-gray-900">Q{question.slot_no}. {examQuestion.stem}</p><div className="mt-3 space-y-2">{examQuestion.options.map(option => { const selectedAnswer = option.key === question.answered_key; const correctAnswer = option.key === examQuestion.correct_key; return <div key={option.key} className={`rounded-lg border px-3 py-2 text-sm ${correctAnswer ? 'border-green-300 bg-green-50 text-green-950' : selectedAnswer ? 'border-red-300 bg-red-50 text-red-950' : 'border-gray-200 text-gray-700'}`}><strong>{option.key}.</strong> {option.text} {correctAnswer && '· Correct answer'} {selectedAnswer && !correctAnswer && '· Your answer'}</div> })}</div><p className="mt-3 text-sm font-medium text-gray-900">{question.answered_key ? (question.is_correct ? 'Correct · 0.5 / 0.5 marks' : 'Incorrect · 0 / 0.5 marks') : 'Not answered · 0 / 0.5 marks'}</p><p className="mt-1 text-sm text-gray-600"><strong>Why:</strong> {examQuestion.rationale}</p></article> })}</div></section>
        <section className="card"><h2 className="font-semibold text-gray-900">Section B — Practical Tasks</h2><div className="mt-4 space-y-4">{TASKS.map(task => { const submission = submissions.find(item => item.task_no === task.no); const marks = submission?.override_marks ?? submission?.marks_awarded; return <article key={task.no} className="rounded-xl border border-gray-200 p-4"><div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold text-gray-900">{task.title}</h3><span className="font-semibold">{marks ?? '—'} / {task.max} marks</span></div>{!submission ? <p className="mt-2 text-sm text-gray-600">No submission was received.</p> : <><p className="mt-2 text-sm text-gray-600">Your submitted answer</p><dl className="mt-1 grid gap-1 text-sm">{Object.entries(submission.payload).filter(([key]) => !['actor_id', 'run_id', 'actor_url'].includes(key)).map(([key, submitted]) => <div key={key} className="flex gap-2"><dt className="font-medium text-gray-700">{label(key)}:</dt><dd className="break-all text-gray-900">{value(submitted)}</dd></div>)}</dl><MarkingDetail detail={submission.grading_detail} /></>}</article> })}</div></section>
      </>}
    </>}</main></>
}
