'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type Project = { id: number; name: string; project_name: string | null; status: string; ca1_project_artifacts: { status: string; submitted_at: string | null }[] | null }

export default function SAProjectsPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { fetch('/api/sa/projects').then(async response => { if (response.status === 401 || response.status === 403) { router.push('/sa/login'); return }; if (response.ok) setProjects(await response.json()); setLoading(false) }).catch(() => setLoading(false)) }, [router])
  if (loading) return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-gray-400">Loading…</div>
  return <div className="min-h-screen bg-gray-900 text-white"><header className="sticky top-0 border-b border-gray-700 bg-gray-800"><div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3"><h1 className="font-bold">CA3 Projects</h1><Link href="/sa/dashboard" className="btn-secondary text-xs">← Dashboard</Link></div></header><main className="mx-auto max-w-6xl px-4 py-6"><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-gray-700 text-left text-xs uppercase text-gray-400"><th className="pb-3">Team</th><th className="pb-3">Project</th><th className="pb-3">Artifacts</th><th className="pb-3">Action</th></tr></thead><tbody className="divide-y divide-gray-800">{projects.map(project => { const artifacts = Array.isArray(project.ca1_project_artifacts) ? project.ca1_project_artifacts[0] : project.ca1_project_artifacts; return <tr key={project.id}><td className="py-3 font-semibold">{project.name}</td><td className="py-3 text-gray-300">{project.project_name || '—'}</td><td className="py-3 capitalize text-gray-300">{artifacts?.status ?? 'not started'}</td><td className="py-3"><Link href={`/sa/teams/${project.id}/artifacts`} className="text-blue-300 hover:underline">Review</Link></td></tr> })}</tbody></table>{projects.length === 0 && <p className="py-10 text-center text-gray-400">No projects found.</p>}</div></main></div>
}
