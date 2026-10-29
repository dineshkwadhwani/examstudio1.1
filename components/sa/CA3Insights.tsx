'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type StudentIssue = { student_id: number; name: string; prn: string; github_username: string | null; github_score: number | null; missing_github_username: boolean; github_score_zero: boolean }
type ProjectInsight = { id: number; name: string; project_name: string | null; artifact_status: string; project_not_evaluated: boolean; partial_evaluation: boolean; missing_categories: string[]; evaluated_zero_categories: string[]; student_issues: StudentIssue[] }
const categoryLabels: Record<string, string> = { multi_agent_design: 'Multi-Agent Design', design: 'Design', live_demo: 'Live Demo', presentation: 'Presentation', documentation: 'Documentation', code_review: 'Code Review' }

export default function CA3Insights() {
  const router = useRouter()
  const [projects, setProjects] = useState<ProjectInsight[]>([])
  const [totalProjects, setTotalProjects] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/sa/ca3-insights', { cache: 'no-store' }).then(async response => {
      if (response.status === 401 || response.status === 403) { router.push('/sa/login'); return }
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) { setError(payload.message ?? 'Could not load CA3 insights.'); return }
      setProjects(payload.projects ?? [])
      setTotalProjects(payload.total_projects ?? 0)
    }).catch(() => setError('Could not load CA3 insights.')).finally(() => setLoading(false))
  }, [router])

  if (loading) return <div className="rounded-xl border border-gray-700 bg-gray-800 p-6 text-gray-400">Loading insights…</div>
  if (error) return <p className="rounded-lg bg-red-900/40 p-3 text-red-300" role="alert">{error}</p>
  return <section className="rounded-xl border border-gray-700 bg-gray-800 p-5">
    <div className="mb-5"><h2 className="text-lg font-semibold">CA3 Insights</h2><p className="mt-1 text-sm text-gray-400">Showing {projects.length} project{projects.length === 1 ? '' : 's'} needing attention out of {totalProjects}.</p></div>
    {projects.length === 0 ? <p className="rounded-lg border border-emerald-800 bg-emerald-950/30 p-4 text-emerald-300">No evaluation or GitHub contribution issues were found.</p> : <div className="grid gap-4 lg:grid-cols-2">{projects.map(project => <Link key={project.id} href={`/sa/teams/${project.id}/artifacts`} className="rounded-xl border border-gray-700 bg-gray-900/50 p-5 transition hover:border-blue-500 hover:bg-gray-900">
      <div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold text-blue-300">{project.name}</h3><p className="mt-1 text-sm text-gray-300">{project.project_name ?? 'Project name not provided'}</p></div><span className="rounded-full bg-gray-700 px-2 py-1 text-xs capitalize text-gray-300">{project.artifact_status.replaceAll('_', ' ')}</span></div>
      <div className="mt-4 space-y-2 text-sm">{project.project_not_evaluated && <p className="rounded bg-red-950/50 px-3 py-2 text-red-300">Project has not been evaluated.</p>}{project.partial_evaluation && <p className="rounded bg-amber-950/50 px-3 py-2 text-amber-300">Not evaluated: {project.missing_categories.map(category => categoryLabels[category] ?? category).join(', ')}.</p>}{project.evaluated_zero_categories.length > 0 && <p className="rounded bg-orange-950/50 px-3 py-2 text-orange-300">Evaluated with zero score: {project.evaluated_zero_categories.map(category => categoryLabels[category] ?? category).join(', ')}.</p>}{project.student_issues.length > 0 && <div className="rounded bg-purple-950/40 px-3 py-2 text-purple-200"><p className="font-semibold">GitHub member issues</p><ul className="mt-1 space-y-1">{project.student_issues.map(student => <li key={student.student_id}>{student.name} ({student.prn}) — {student.missing_github_username ? 'GitHub ID missing' : `GitHub score is ${student.github_score ?? 0}`}</li>)}</ul></div>}</div>
      <p className="mt-4 text-xs text-blue-400">Open evaluation →</p>
    </Link>)}</div>}
  </section>
}
