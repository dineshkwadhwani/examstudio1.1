'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type ScheduleTeam = { id: number; name: string; project_name: string | null; status: string; presentation_date: string | null }
const dateGroups = [
  { date: '2026-10-22', label: '22 October 2026' },
  { date: '2026-10-23', label: '23 October 2026' },
  { date: null, label: 'No presentation date selected' },
] as const

export default function SASchedulePage() {
  const router = useRouter()
  const [teams, setTeams] = useState<ScheduleTeam[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/sa/schedule').then(async response => {
      if (response.status === 401 || response.status === 403) { router.push('/sa/login'); return }
      if (!response.ok) { setError('Could not load the presentation schedule.'); return }
      setTeams(await response.json())
    }).catch(() => setError('Could not load the presentation schedule.')).finally(() => setLoading(false))
  }, [router])

  const groupedTeams = useMemo(() => dateGroups.map(group => ({ ...group, teams: teams.filter(team => team.presentation_date === group.date).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })) })), [teams])

  if (loading) return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-gray-400">Loading…</div>
  return <div className="min-h-screen bg-gray-900 text-white"><header className="sticky top-0 border-b border-gray-700 bg-gray-800"><div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3"><h1 className="font-bold">CA3</h1><Link href="/sa/dashboard" className="btn-secondary text-xs">← Dashboard</Link></div><nav className="mx-auto flex max-w-6xl gap-1 px-4"><Link href="/sa/teams" className="border-b-2 border-transparent px-4 py-2 text-sm text-gray-400 hover:border-gray-500 hover:text-white">Teams</Link><Link href="/sa/projects" className="border-b-2 border-transparent px-4 py-2 text-sm text-gray-400 hover:border-gray-500 hover:text-white">CA3 Projects</Link><Link href="/sa/schedule" className="border-b-2 border-blue-400 px-4 py-2 text-sm font-semibold text-white">Schedule</Link></nav></header><main className="mx-auto max-w-6xl px-4 py-6">{error && <p className="mb-5 rounded-lg bg-red-900/40 p-3 text-red-300" role="alert">{error}</p>}<div className="space-y-6">{groupedTeams.map(group => <section key={group.label} className="overflow-hidden rounded-xl border border-gray-700 bg-gray-800"><div className="border-b border-gray-700 px-5 py-4"><h2 className="font-semibold">{group.label}</h2><p className="mt-1 text-xs text-gray-400">{group.teams.length} team{group.teams.length === 1 ? '' : 's'}</p></div>{group.teams.length === 0 ? <p className="px-5 py-6 text-sm text-gray-500">No teams in this group.</p> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-gray-700 text-left text-xs uppercase text-gray-400"><th className="px-5 py-3">Team</th><th className="px-5 py-3">Project</th><th className="px-5 py-3">Status</th></tr></thead><tbody className="divide-y divide-gray-700">{group.teams.map(team => <tr key={team.id} className="hover:bg-gray-750"><td className="px-5 py-3 font-semibold">{team.name}</td><td className="px-5 py-3"><Link href={`/sa/teams/${team.id}/artifacts`} className="text-blue-300 hover:underline">{team.project_name || 'Project name not provided'}</Link></td><td className="px-5 py-3 capitalize text-gray-300">{team.status.replace('_', ' ')}</td></tr>)}</tbody></table></div>}</section>)}</div></main></div>
}
