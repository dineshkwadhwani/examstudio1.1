import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireSA } from '@/lib/session'
import CA3Results from '@/components/sa/CA3ResultsFiltered'

export default async function CA3ResultsPage() {
  try { await requireSA() } catch { redirect('/sa/login') }
  return <div className="min-h-screen bg-gray-900 text-white"><header className="sticky top-0 border-b border-gray-700 bg-gray-800"><div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3"><h1 className="font-bold">CA3</h1><Link href="/sa/dashboard" className="btn-secondary text-xs">← Dashboard</Link></div><nav className="mx-auto flex max-w-7xl flex-wrap gap-1 px-4"><Link href="/sa/teams" className="border-b-2 border-transparent px-4 py-2 text-sm text-gray-400 hover:border-gray-500 hover:text-white">Teams</Link><Link href="/sa/projects" className="border-b-2 border-transparent px-4 py-2 text-sm text-gray-400 hover:border-gray-500 hover:text-white">CA3 Projects</Link><Link href="/sa/projects?tab=evaluate" className="border-b-2 border-transparent px-4 py-2 text-sm text-gray-400 hover:border-gray-500 hover:text-white">Evaluate</Link><Link href="/sa/projects?tab=insights" className="border-b-2 border-transparent px-4 py-2 text-sm text-gray-400 hover:border-gray-500 hover:text-white">Insights</Link><Link href="/sa/schedule" className="border-b-2 border-transparent px-4 py-2 text-sm text-gray-400 hover:border-gray-500 hover:text-white">Schedule</Link><Link href="/sa/ca3-results" className="border-b-2 border-blue-400 px-4 py-2 text-sm font-semibold text-white">Results</Link></nav></header><main className="mx-auto max-w-7xl px-4 py-6"><CA3Results /></main></div>
}
