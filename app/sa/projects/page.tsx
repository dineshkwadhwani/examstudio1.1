'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import CA3Evaluate from '@/components/sa/CA3Evaluate'
import CA3Insights from '@/components/sa/CA3Insights'

type Project = { id: number; name: string; project_name: string | null; status: string; ca1_project_artifacts: { status: string; evaluation_status: string | null; evaluated_at: string | null; submitted_at: string | null }[] | null }
type Tab = 'projects' | 'evaluate' | 'insights'

function Navigation({ tab, setTab }: { tab: Tab; setTab: (tab: Tab) => void }) {
  return <nav className="mx-auto flex max-w-6xl flex-wrap gap-1 px-4">
    <Link href="/sa/teams" className="border-b-2 border-transparent px-4 py-2 text-sm text-gray-400 hover:border-gray-500 hover:text-white">Teams</Link>
    <button type="button" onClick={() => setTab('projects')} className={`border-b-2 px-4 py-2 text-sm ${tab === 'projects' ? 'border-blue-400 font-semibold text-white' : 'border-transparent text-gray-400 hover:border-gray-500 hover:text-white'}`}>CA3 Projects</button>
    <button type="button" onClick={() => setTab('evaluate')} className={`border-b-2 px-4 py-2 text-sm ${tab === 'evaluate' ? 'border-blue-400 font-semibold text-white' : 'border-transparent text-gray-400 hover:border-gray-500 hover:text-white'}`}>Evaluate</button>
    <button type="button" onClick={() => setTab('insights')} className={`border-b-2 px-4 py-2 text-sm ${tab === 'insights' ? 'border-blue-400 font-semibold text-white' : 'border-transparent text-gray-400 hover:border-gray-500 hover:text-white'}`}>Insights</button>
    <Link href="/sa/schedule" className="border-b-2 border-transparent px-4 py-2 text-sm text-gray-400 hover:border-gray-500 hover:text-white">Schedule</Link>
    <Link href="/sa/ca3-results" className="border-b-2 border-transparent px-4 py-2 text-sm text-gray-400 hover:border-gray-500 hover:text-white">Results</Link>
  </nav>
}

export default function SAProjectsPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('projects')

  useEffect(() => {
    fetch('/api/sa/projects').then(async response => {
      if (response.status === 401 || response.status === 403) { router.push('/sa/login'); return }
      if (response.ok) setProjects(await response.json())
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [router])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const requestedTab = new URLSearchParams(window.location.search).get('tab')
      if (requestedTab === 'evaluate' || requestedTab === 'insights') setTab(requestedTab)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-gray-900 text-gray-400">Loading…</div>
  return <div className="min-h-screen bg-gray-900 text-white">
    <header className="sticky top-0 border-b border-gray-700 bg-gray-800">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3"><h1 className="font-bold">CA3</h1><Link href="/sa/dashboard" className="btn-secondary text-xs">← Dashboard</Link></div>
      <Navigation tab={tab} setTab={setTab} />
    </header>
    <main className="mx-auto max-w-6xl px-4 py-6">
      {tab === 'evaluate' ? <CA3Evaluate /> : tab === 'insights' ? <CA3Insights /> : <div className="overflow-x-auto">
        <table className="w-full text-sm"><thead><tr className="border-b border-gray-700 text-left text-xs uppercase text-gray-400"><th className="pb-3">Team</th><th className="pb-3">Project</th><th className="pb-3">Artifacts</th><th className="pb-3">Action</th></tr></thead><tbody className="divide-y divide-gray-800">
          {projects.map(project => { const artifacts = Array.isArray(project.ca1_project_artifacts) ? project.ca1_project_artifacts[0] : project.ca1_project_artifacts; const artifactStatus = artifacts?.status ?? 'not started'; const evaluationStatus = artifacts?.evaluation_status === 'evaluated' || artifactStatus === 'evaluation_complete' ? 'Evaluation Complete' : null; const statusClass = artifactStatus === 'submitted' ? 'font-semibold text-green-400' : artifactStatus === 'locked' ? 'font-semibold text-blue-300' : artifactStatus === 'evaluation_complete' ? 'font-bold text-blue-800' : artifactStatus === 'presented' ? 'font-bold text-green-700' : artifactStatus === 'not started' ? 'font-semibold text-red-400' : 'text-gray-300'; return <tr key={project.id}><td className="py-3 font-semibold">{project.name}</td><td className="py-3 text-gray-300">{project.project_name || '—'}</td><td className={`py-3 ${statusClass}`}>{evaluationStatus ?? artifactStatus}</td><td className="py-3"><Link href={`/sa/teams/${project.id}/artifacts`} className="text-blue-300 hover:underline">Review</Link></td></tr> })}
        </tbody></table>{projects.length === 0 && <p className="py-10 text-center text-gray-400">No projects found.</p>}
      </div>}
    </main>
  </div>
}
