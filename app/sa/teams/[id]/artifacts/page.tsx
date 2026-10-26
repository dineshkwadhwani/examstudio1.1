import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireSA } from '@/lib/session'
import ProjectEvaluation from '@/components/sa/ProjectEvaluation'

export default async function SATeamArtifactsPage({ params }: { params: Promise<{ id: string }> }) {
  try { await requireSA() } catch { redirect('/sa/login') }
  const { id } = await params
  return <div className="min-h-screen bg-gray-900 text-white"><header className="border-b border-gray-700 bg-gray-800"><div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-3"><h1 className="font-bold">Project Evaluation</h1><nav className="flex flex-wrap gap-2"><Link href={`/sa/teams/${id}`} className="btn-secondary text-xs">← Team review</Link><Link href="/sa/projects" className="btn-secondary text-xs">← CA3 Projects</Link><Link href="/sa/dashboard" className="btn-secondary text-xs">← Dashboard</Link></nav></div></header><main className="mx-auto max-w-4xl px-4 py-6"><ProjectEvaluation teamId={id} /></main></div>
}
