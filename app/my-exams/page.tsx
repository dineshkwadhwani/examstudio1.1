import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { getStudentExams, type StudentExam } from '@/lib/student-exams'
import { PageHeader } from '@/components/student/PageHeader'

export default async function MyExamsPage() {
  const session = await getSession()
  if (!session || session.type !== 'student') redirect('/login')
  let exams: StudentExam[] = []
  let failed = false
  try { exams = await getStudentExams(session.id) } catch { failed = true }

  return <>
    <PageHeader title="My Exams" />
    <main className="mx-auto max-w-4xl space-y-4 px-4 py-6">
      <p className="text-sm text-gray-600">All exams you have started, including completed and archived sessions.</p>
      {failed ? <p role="alert" className="card text-red-700">Could not load your exam history. Refresh to try again.</p> : exams.length === 0 ?
        <div className="card space-y-3"><h2 className="font-semibold text-gray-900">No exams yet</h2><p className="text-sm text-gray-600">Your exams will appear here once you start an MCQ section, fetch a paper, or submit a task.</p><Link href="/dashboard" className="btn-primary">Go to dashboard</Link></div> :
        <ul className="space-y-4">{exams.map(exam => {
          const ended = exam.status === 'closed' || exam.status === 'archived'
          const status = exam.status === 'archived' ? 'Archived' : ended ? 'Ended' : exam.status === 'running' ? 'In progress' : exam.status.replaceAll('_', ' ')
          return <li key={exam.id} className="card">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><p className="text-xs font-medium text-blue-700">{exam.ca1_exam_definitions?.code ?? 'Exam'}</p><h2 className="mt-1 font-semibold text-gray-900">{exam.ca1_exam_definitions?.title ?? exam.label}</h2><p className="mt-1 text-sm text-gray-600">{exam.label} · Session {exam.id}</p></div>
              <span className={ended ? 'badge-gray' : 'badge-blue'}>{status}</span>
            </div>
            <p className="mt-3 text-sm text-gray-500">{exam.started_at ? `Started ${new Date(exam.started_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' })} IST` : 'Start time unavailable'}</p>
            {!ended && exam.status === 'running' && <Link href="/dashboard" className="btn-secondary mt-3 text-sm">Continue exam</Link>}
          </li>
        })}</ul>}
    </main>
  </>
}
