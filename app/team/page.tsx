'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/student/PageHeader'

type Member = { id: number; roster_prn: string; ca1_roster: { name: string }; ca1_students?: { email: string } | { email: string }[] | null }
type Team = { id: number; name: string; project_name: string | null; project_description: string | null; status: string; rejection_reason: string | null; members: Member[] }
type SearchStudent = { prn: string; name: string; registered: boolean; reserved: boolean; reserved_by_current_team: boolean }

export default function TeamPage() {
  const router = useRouter()
  const [team, setTeam] = useState<Team | null>(null)
  const [name, setName] = useState('')
  const [projectName, setProjectName] = useState('')
  const [projectDescription, setProjectDescription] = useState('')
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<SearchStudent[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const res = await fetch('/api/me/team')
    if (res.status === 401 || res.status === 403) { router.push('/login'); return }
    if (res.ok) {
      const data = await res.json()
      setTeam(data.team)
      if (data.team) { setName(data.team.name); setProjectName(data.team.project_name ?? ''); setProjectDescription(data.team.project_description ?? '') }
    }
    setLoading(false)
  }, [router])

  useEffect(() => { const timer = setTimeout(load, 0); return () => clearTimeout(timer) }, [load])
  useEffect(() => {
    if (!search.trim()) { const timer = setTimeout(() => setResults([]), 0); return () => clearTimeout(timer) }
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/me/team?search=${encodeURIComponent(search)}`)
      if (res.ok) setResults((await res.json()).students ?? [])
    }, 250)
    return () => clearTimeout(timer)
  }, [search])

  async function act(action: string, extra: Record<string, unknown> = {}) {
    setSaving(true); setError(''); setMessage('')
    const res = await fetch('/api/me/team', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, team_id: team?.id, ...extra }) })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.message ?? 'Could not update the team.'); return false }
    setTeam(data); if (data) setName(data.name)
    setMessage(action === 'submit' ? 'Team submitted for approval.' : 'Team saved.')
    return true
  }

  async function create() {
    if (!name.trim()) { setError('Team name is required.'); return }
    await act('create', { name })
  }

  async function save() { await act('save', { name }) }
  async function submit() { await act('submit', { project_name: projectName, project_description: projectDescription }) }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading…</div>
  const editable = team?.status === 'draft' || team?.status === 'rejected'

  return <><PageHeader title="My Team" /><main className="mx-auto max-w-4xl space-y-5 px-4 py-6">
    {message && <p className="card border-green-200 bg-green-50 text-green-800" role="status">{message}</p>}
    {error && <p className="card border-red-200 bg-red-50 text-red-800" role="alert">{error}</p>}
    {!team ? <section className="card space-y-4"><h2 className="text-lg font-semibold">Create a team</h2><p className="text-sm text-gray-600">You can reserve members while building your team. A team must have 3 or 4 members before approval submission.</p><input className="input" placeholder="Team name" value={name} onChange={e => setName(e.target.value)} /><button className="btn-primary" onClick={create} disabled={saving}>Create team</button></section> : <>
      <section className="card space-y-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm text-gray-500">Team status</p><p className="font-semibold capitalize">{team.status.replace('_', ' ')}</p></div>{editable && <button className="btn-primary" onClick={save} disabled={saving}>Save team</button>}</div>
        <label className="block text-sm font-medium">Team name<input className="input mt-1" value={name} onChange={e => setName(e.target.value)} disabled={!editable} /></label>
        {team.rejection_reason && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800"><strong>Rejection reason:</strong> {team.rejection_reason}</p>}
        <div><h2 className="font-semibold">Members ({team.members.length}/4)</h2><div className="mt-2 divide-y rounded-lg border">{team.members.map(member => <div key={member.roster_prn} className="flex items-center justify-between p-3"><span><strong>{member.ca1_roster.name}</strong><span className="ml-2 text-sm text-gray-500">{member.roster_prn}</span></span>{editable && <button className="text-sm text-red-700" onClick={() => act('remove', { prn: member.roster_prn })}>Remove</button>}</div>)}</div></div>
        {editable && <div><label className="block text-sm font-medium">Search roster by name or PRN<input className="input mt-1" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search students…" /></label>{results.length > 0 && <div className="mt-2 divide-y rounded-lg border">{results.map(result => <div key={result.prn} className="flex items-center justify-between p-3 text-sm"><span><strong>{result.name}</strong><span className="ml-2 text-gray-500">{result.prn}</span>{!result.registered && <span className="ml-2 text-xs text-amber-700">Not registered</span>}</span><button className="btn-secondary text-xs" disabled={result.reserved || team.members.length >= 4 || saving} onClick={() => { act('add', { prn: result.prn }); setSearch(''); setResults([]) }}>{result.reserved ? (result.reserved_by_current_team ? 'Added' : 'Reserved') : 'Add'}</button></div>)}</div>}</div>}
      </section>
      <section className="card space-y-4"><h2 className="font-semibold">Project approval details</h2><p className="text-sm text-gray-600">Project name and description are required to submit this team for approval.</p><label className="block text-sm font-medium">Project name<input className="input mt-1" value={projectName} onChange={e => setProjectName(e.target.value)} disabled={!editable} /></label><label className="block text-sm font-medium">Project description<textarea className="input mt-1 min-h-28" value={projectDescription} onChange={e => setProjectDescription(e.target.value)} disabled={!editable} /></label>{editable && <button className="btn-primary" onClick={submit} disabled={saving || team.members.length < 3}>Submit for approval</button>}</section>
      {(team.status === 'pending_approval' || team.status === 'approved') && <section className="card"><h2 className="font-semibold">Project details</h2><p className="mt-2 text-gray-600">Coming Soon</p></section>}
    </>}
  </main></>
}
