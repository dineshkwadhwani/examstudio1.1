'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'

type Member = { roster_prn: string; ca1_roster: { name: string } }
type SearchStudent = { prn: string; name: string; registered: boolean; reserved: boolean; reserved_by_this_team: boolean }
type Team = { id: number; name: string; project_name: string | null; project_description: string | null; status: string; rejection_reason: string | null; members: Member[] }

export default function SATeamDetailPage() {
  const { id } = useParams<{ id: string }>(); const router = useRouter()
  const [team, setTeam] = useState<Team | null>(null); const [editing, setEditing] = useState(false)
  const [name, setName] = useState(''); const [projectName, setProjectName] = useState(''); const [projectDescription, setProjectDescription] = useState('')
  const [search, setSearch] = useState(''); const [students, setStudents] = useState<SearchStudent[]>([]); const [reason, setReason] = useState('')
  const [message, setMessage] = useState(''); const [error, setError] = useState(''); const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/sa/teams/${id}`)
    if (res.status === 401 || res.status === 403) { router.push('/sa/login'); return }
    if (res.ok) { const data = await res.json() as Team; setTeam(data); setName(data.name); setProjectName(data.project_name ?? ''); setProjectDescription(data.project_description ?? '') }
    else setError('Team not found.')
  }, [id, router])
  useEffect(() => { const timer = setTimeout(load, 0); return () => clearTimeout(timer) }, [load])
  useEffect(() => {
    if (!editing || !search.trim()) { const timer = setTimeout(() => setStudents([]), 0); return () => clearTimeout(timer) }
    const timer = setTimeout(async () => { const res = await fetch(`/api/sa/teams/${id}?search=${encodeURIComponent(search)}`); if (res.ok) setStudents((await res.json()).students ?? []) }, 250)
    return () => clearTimeout(timer)
  }, [editing, id, search])

  async function editAction(action: string, extra: Record<string, string> = {}) {
    setSaving(true); setError(''); setMessage('')
    const res = await fetch(`/api/sa/teams/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...extra }) })
    const data = await res.json(); setSaving(false)
    if (!res.ok) { setError(data.message ?? 'Could not update team.'); return false }
    setMessage(data.message ?? 'Team updated.'); await load(); return true
  }
  async function saveEdit() { if (await editAction('save', { name, project_name: projectName, project_description: projectDescription })) setEditing(false) }
  async function review(action: 'approve' | 'reject') {
    setMessage(''); setError(''); const res = await fetch('/api/sa/teams', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, team_id: Number(id), reason }) }); const data = await res.json()
    if (!res.ok) { setError(data.message ?? 'Could not review team.'); return }; setMessage(data.message); load()
  }

  if (!team) return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-gray-400">{error || 'Loading…'}</div>
  return <div className="min-h-screen bg-gray-900 text-white"><header className="border-b border-gray-700 bg-gray-800"><div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3"><h1 className="font-bold">{team.name}</h1><Link href="/sa/teams" className="btn-secondary text-xs">← Teams</Link></div></header><main className="mx-auto max-w-4xl space-y-5 px-4 py-6">
    {message && <p className="rounded-lg bg-green-900/40 p-3 text-green-300" role="status">{message}</p>}{error && <p className="rounded-lg bg-red-900/40 p-3 text-red-300" role="alert">{error}</p>}
    <section className="rounded-xl border border-gray-700 bg-gray-800 p-5 space-y-5"><div className="flex items-center justify-between gap-3"><p className="capitalize text-sm text-gray-400">Status: {team.status.replace('_', ' ')}</p>{!editing ? <button className="btn-primary text-sm" onClick={() => setEditing(true)}>Edit team</button> : <div className="flex gap-2"><button className="btn-primary text-sm" onClick={saveEdit} disabled={saving}>Save changes</button><button className="btn-secondary text-sm" onClick={() => setEditing(false)}>Cancel</button></div>}</div>
      {editing ? <><label className="block text-sm font-medium">Team name<input className="input mt-1 bg-gray-700 text-white" value={name} onChange={e => setName(e.target.value)} /></label><label className="block text-sm font-medium">Project name<input className="input mt-1 bg-gray-700 text-white" value={projectName} onChange={e => setProjectName(e.target.value)} /></label><label className="block text-sm font-medium">Project description<textarea className="input mt-1 min-h-28 bg-gray-700 text-white" value={projectDescription} onChange={e => setProjectDescription(e.target.value)} /></label></> : <><h2 className="font-semibold">Project name</h2><p className="text-gray-300">{team.project_name || 'Not provided'}</p><h2 className="font-semibold">Project description</h2><p className="whitespace-pre-wrap text-gray-300">{team.project_description || 'Not provided'}</p></>}
      <div><h2 className="font-semibold">Members ({team.members.length}/4)</h2><div className="mt-2 divide-y divide-gray-700 rounded-lg border border-gray-700">{team.members.map(member => <div key={member.roster_prn} className="flex items-center justify-between p-3"><span>{member.ca1_roster.name} <span className="text-sm text-gray-400">({member.roster_prn})</span></span>{editing && <button className="text-sm text-red-300" onClick={() => editAction('remove', { prn: member.roster_prn })}>Remove</button>}</div>)}</div></div>
      {editing && <div><label className="block text-sm font-medium">Search roster by name or PRN<input className="input mt-1 bg-gray-700 text-white" placeholder="Search students…" value={search} onChange={e => setSearch(e.target.value)} /></label>{students.length > 0 && <div className="mt-2 divide-y divide-gray-700 rounded-lg border border-gray-700">{students.map(student => <div key={student.prn} className="flex items-center justify-between p-3 text-sm"><span>{student.name} <span className="text-gray-400">({student.prn})</span>{!student.registered && <span className="ml-2 text-xs text-amber-300">Not registered</span>}</span><button className="btn-secondary text-xs" disabled={student.reserved || team.members.length >= 4 || saving} onClick={async () => { if (await editAction('add', { prn: student.prn })) { setSearch(''); setStudents([]) } }}>{student.reserved ? (student.reserved_by_this_team ? 'Added' : 'Reserved') : 'Add'}</button></div>)}</div>}</div>}
    </section>
    {team.rejection_reason && <p className="rounded-lg bg-red-900/40 p-3 text-red-300"><strong>Rejection reason:</strong> {team.rejection_reason}</p>}
    {team.status === 'pending_approval' && <section className="rounded-xl border border-gray-700 bg-gray-800 p-5 space-y-3"><h2 className="font-semibold">Review</h2><textarea className="input min-h-24 bg-gray-700 text-white" placeholder="Required when rejecting" value={reason} onChange={e => setReason(e.target.value)} /><div className="flex gap-3"><button className="btn-primary" onClick={() => review('approve')}>Approve team</button><button className="rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-600" onClick={() => review('reject')}>Reject team</button></div></section>}
  </main></div>
}
