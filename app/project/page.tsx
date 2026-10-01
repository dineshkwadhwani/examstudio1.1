'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/student/PageHeader'

type Member = { roster_prn: string; ca1_roster: { name: string } }
type Project = { name: string; project_name: string | null; project_description: string | null; review_comments: string | null; status: string; members: Member[] }

export default function ProjectPage() {
  const router = useRouter()
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const timer = setTimeout(async () => {
      const res = await fetch('/api/me/team')
      if (res.status === 401 || res.status === 403) { router.push('/login'); return }
      if (!res.ok) { setError('Could not load your project.'); setLoading(false); return }
      const data = await res.json()
      if (!data.team || data.team.status !== 'approved') { setError('Your project is not approved yet.'); setLoading(false); return }
      setProject(data.team); setLoading(false)
    }, 0)
    return () => clearTimeout(timer)
  }, [router])

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading…</div>
  if (!project) return <><PageHeader title="Project" /><main className="mx-auto max-w-4xl px-4 py-6"><div className="card text-red-700">{error}<Link href="/dashboard" className="btn-secondary mt-4 inline-flex">Back to dashboard</Link></div></main></>

  return <><PageHeader title="Approved Project" /><main className="mx-auto max-w-4xl space-y-5 px-4 py-6">
    <section className="card space-y-5"><div><p className="text-sm text-gray-500">Team name</p><h2 className="text-xl font-bold text-gray-900">{project.name}</h2></div><div><h2 className="font-semibold text-gray-900">Members</h2><ul className="mt-2 divide-y rounded-lg border">{project.members.map(member => <li key={member.roster_prn} className="p-3"><strong>{member.ca1_roster.name}</strong><span className="ml-2 text-sm text-gray-500">{member.roster_prn}</span></li>)}</ul></div><div><h2 className="font-semibold text-gray-900">Project name</h2><p className="mt-1 text-gray-700">{project.project_name || 'Not provided'}</p></div><div><h2 className="font-semibold text-gray-900">Project description</h2><p className="mt-1 whitespace-pre-wrap text-gray-700">{project.project_description || 'Not provided'}</p></div><div><h2 className="font-semibold text-gray-900">Review comments</h2><p className="mt-1 whitespace-pre-wrap text-gray-700">{project.review_comments || 'No review comments'}</p></div></section>
    <section className="card"><h2 className="font-semibold text-gray-900">Next steps</h2><div className="mt-4 flex flex-wrap gap-3"><Link href="/project/guidelines" className="btn-primary">View Guidelines</Link><Link href="/project/artifacts" className="btn-secondary">Submit Artifacts</Link></div></section>
  </main></>
}
