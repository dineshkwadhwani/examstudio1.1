'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type Team = { id: number; name: string; project_name: string | null; status: string; submitted_at: string | null; ca1_team_members: Array<{ roster_prn: string; ca1_roster: { name: string } }> }

export default function SATeamsPage() {
  const router = useRouter()
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  useEffect(() => { fetch('/api/sa/teams').then(async res => { if (res.status === 401 || res.status === 403) { router.push('/sa/login'); return }; if (res.ok) setTeams(await res.json()); setLoading(false) }) }, [router])
  async function exportTeams() {
    setExporting(true)
    try {
      const res = await fetch('/api/sa/teams?format=csv')
      if (res.status === 401 || res.status === 403) { router.push('/sa/login'); return }
      if (!res.ok) return
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'exam-studio-teams.csv'
      link.click()
      URL.revokeObjectURL(url)
    } finally { setExporting(false) }
  }
  if (loading) return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-gray-400">Loading…</div>
  return <div className="min-h-screen bg-gray-900 text-white"><header className="sticky top-0 border-b border-gray-700 bg-gray-800"><div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3"><h1 className="font-bold">Teams ({teams.length})</h1><div className="flex items-center gap-2"><button className="btn-primary text-xs" onClick={exportTeams} disabled={exporting}>{exporting ? 'Exporting…' : 'Export CSV'}</button><Link href="/sa/dashboard" className="btn-secondary text-xs">← Dashboard</Link></div></div></header><main className="mx-auto max-w-7xl px-4 py-6"><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-gray-700 text-left text-xs uppercase text-gray-400"><th className="pb-3">Team</th><th className="pb-3">Members</th><th className="pb-3">Project</th><th className="pb-3">Status</th></tr></thead><tbody className="divide-y divide-gray-800">{teams.map(team => <tr key={team.id} className="hover:bg-gray-800"><td className="py-3"><Link href={`/sa/teams/${team.id}`} className="font-semibold text-blue-300 hover:underline">{team.name}</Link></td><td className="py-3 text-gray-300">{team.ca1_team_members.map(member => member.ca1_roster.name).join(', ')}</td><td className="py-3 text-gray-300">{team.project_name || '—'}</td><td className="py-3 capitalize text-gray-300">{team.status.replace('_', ' ')}</td></tr>)}</tbody></table>{teams.length === 0 && <p className="py-10 text-center text-gray-400">No teams have been created.</p>}</div></main></div>
}
