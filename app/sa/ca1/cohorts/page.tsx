'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'

type Cohort = { id: number; name: string; description: string | null; student_count?: number; created_at: string }
type Student = { id: number; name: string; email: string; prn: string }

export default function Ca1CohortsPage() {
  const [cohorts, setCohorts] = useState<Cohort[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [members, setMembers] = useState<number[]>([])
  const [form, setForm] = useState({ name: '', description: '' })
  const [editing, setEditing] = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const [cohortResponse, studentResponse] = await Promise.all([fetch('/api/sa/assessment-cohorts'), fetch('/api/sa/students')])
    const cohortData = await cohortResponse.json(); const studentData = await studentResponse.json()
    setCohorts(cohortData.cohorts ?? [])
    const unique = new Map<number, Student>()
    for (const row of studentData as Array<Student & { id: number }>) if (!unique.has(row.id)) unique.set(row.id, { id: row.id, name: row.name, email: row.email, prn: row.prn })
    setStudents([...unique.values()])
  }, [])

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer) }, [load])

  async function save(event: React.FormEvent) {
    event.preventDefault(); setMessage(''); setError('')
    const path = editing ? `/api/sa/assessment-cohorts/${editing}` : '/api/sa/assessment-cohorts'
    const response = await fetch(path, { method: editing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    const data = await response.json()
    if (!response.ok) { setError(data.message ?? data.error ?? 'Could not save cohort.'); return }
    setMessage(editing ? 'Cohort updated.' : 'Cohort created.'); setForm({ name: '', description: '' }); setEditing(null); setShowForm(false); await load()
  }

  async function remove(id: number) {
    if (!window.confirm('Delete this cohort? Its assignments and generated papers will also be removed.')) return
    const response = await fetch(`/api/sa/assessment-cohorts/${id}`, { method: 'DELETE' })
    if (!response.ok) { const data = await response.json(); setError(data.message ?? 'Could not delete cohort.'); return }
    setMessage('Cohort deleted.'); await load()
  }

  async function addMembers(event: React.FormEvent) {
    event.preventDefault(); if (!selected || !members.length) return
    const response = await fetch(`/api/sa/assessment-cohorts/${selected}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ student_ids: members }) })
    const data = await response.json(); if (!response.ok) { setError(data.message ?? 'Could not add students.'); return }
    setMessage(`${data.added} student${data.added === 1 ? '' : 's'} added.`); setMembers([]); await load()
  }

  return <div className="space-y-8"><header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-semibold text-blue-600">CA1</p><h1 className="mt-1 text-4xl font-bold tracking-tight">Cohorts</h1><p className="mt-2 text-lg text-slate-500">Manage your student groups.</p></div><button onClick={() => { setEditing(null); setForm({ name: '', description: '' }); setShowForm(true) }} className="btn-primary px-5 py-3">＋ New cohort</button></header>{(message || error) && <p className={`rounded-xl p-3 text-sm ${error ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>{error || message}</p>}
    <div className="grid gap-5 xl:grid-cols-3">{cohorts.map(cohort => <article key={cohort.id} className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm"><div className="flex items-start justify-between gap-3"><div><Link href={`/sa/ca1/cohorts/${cohort.id}`} className="text-xl font-bold text-slate-800 hover:text-blue-600">{cohort.name}</Link><p className="mt-2 text-sm text-slate-500">{cohort.description || 'No description'}</p></div><div className="flex gap-2"><button onClick={() => { setEditing(cohort.id); setForm({ name: cohort.name, description: cohort.description ?? '' }) }} className="text-slate-400 hover:text-blue-600" title="Edit">✎</button><button onClick={() => void remove(cohort.id)} className="text-slate-400 hover:text-red-600" title="Delete">♜</button></div></div><div className="mt-8 flex items-end justify-between"><div><p className="text-4xl font-bold text-blue-600">{cohort.student_count ?? 0}</p><p className="text-sm text-slate-500">Students</p></div><Link href={`/sa/ca1/cohorts/${cohort.id}`} className="btn-secondary text-sm">Manage members</Link></div><p className="mt-6 text-xs text-slate-400">Created {new Date(cohort.created_at).toLocaleDateString('en-IN')}</p></article>)}</div>{!cohorts.length && <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-14 text-center text-slate-500">No cohorts yet. Create your first cohort above.</div>}
    {(showForm || editing !== null) && <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4"><form onSubmit={save} className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-7 shadow-2xl"><h2 className="text-xl font-bold text-slate-800">{editing ? 'Edit cohort' : 'New cohort'}</h2><label className="label">Cohort name<input className="input mt-1" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} required /></label><label className="label">Description<textarea className="input mt-1 min-h-24" value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} /></label><div className="flex justify-end gap-2"><button type="button" onClick={() => { setEditing(null); setShowForm(false); setForm({ name: '', description: '' }) }} className="btn-secondary">Cancel</button><button className="btn-primary">Save cohort</button></div></form></div>}
    {selected !== null && <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4"><form onSubmit={addMembers} className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-7 shadow-2xl"><div className="flex items-start justify-between"><h2 className="text-xl font-bold text-slate-800">Add students</h2><button type="button" onClick={() => setSelected(null)} className="text-slate-400">×</button></div><p className="text-sm text-slate-500">Select one or more canonical root students to add to this cohort.</p><select multiple className="input min-h-64" value={members.map(String)} onChange={event => setMembers([...event.target.selectedOptions].map(option => Number(option.value)))}>{students.map(student => <option key={student.id} value={student.id}>{student.name} · {student.prn} · {student.email}</option>)}</select><div className="flex justify-end gap-2"><button type="button" onClick={() => setSelected(null)} className="btn-secondary">Cancel</button><button className="btn-primary">Add selected</button></div></form></div>}
  </div>
}
