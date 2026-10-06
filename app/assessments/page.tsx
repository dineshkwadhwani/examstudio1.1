import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { getStudentAssessmentPapers } from '@/lib/assessment'
import { PageHeader } from '@/components/student/PageHeader'

export default async function AssessmentsPage() {
  const session = await getSession()
  if (!session || session.type !== 'student') redirect('/login')
  const papers = await getStudentAssessmentPapers(session.id)
  return <>
    <PageHeader title="CA1 Assessments" />
    <main className="mx-auto max-w-4xl space-y-4 px-4 py-6">
      <p className="text-sm text-gray-600">Assigned, in-progress, and completed CA1 assessments appear here.</p>
      {papers.length === 0 ? <section className="card"><h2 className="font-semibold text-gray-900">No assessments assigned</h2><p className="mt-1 text-sm text-gray-600">Your assigned CA1 assessments will appear here.</p></section> : <div className="grid gap-4 md:grid-cols-2">
        {papers.map(paper => {
          const assessment = paper.assessment
          const completed = paper.status === 'completed'
          return <section key={paper.id} className="card space-y-3">
            <div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold text-gray-900">{assessment?.name}</h2><p className="mt-1 text-xs text-gray-500">{assessment?.assessment_type} · {assessment?.total_questions} questions · {assessment?.total_marks} marks</p></div><span className={completed ? 'badge-green' : paper.status === 'in_progress' ? 'badge-blue' : 'badge-gray'}>{completed ? 'Completed' : paper.status.replace('_', ' ')}</span></div>
            {completed && <p className="text-sm text-gray-700">Score: <strong>{paper.score ?? 0} / {assessment?.total_marks}</strong></p>}
            <Link href={`/assessments/${paper.id}`} className="btn-primary inline-flex text-sm">{completed ? 'View result' : paper.status === 'in_progress' ? 'Continue' : 'Start assessment'}</Link>
          </section>
        })}
      </div>}
    </main>
  </>
}
