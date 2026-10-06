'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

type Cohort = { id: number; name: string; description: string | null }
type Student = { id: number; name: string; prn: string; email: string }
type Member = { student_id: number; ca1_students: Student | Student[] | null }

export default function Ca1CohortDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const [cohort, setCohort] = useState<Cohort | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [showAddStudent, setShowAddStudent] = useState(false)
  const [studentSearch, setStudentSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const [cohortResponse, studentResponse] = await Promise.all([fetch(`/api/sa/assessment-cohorts/${id}`), fetch('/api/sa/students')])
    const cohortData = await cohortResponse.json()
    const studentData = await studentResponse.json()
    setCohort(cohortData.cohort ?? null)
    setMembers(cohortData.members ?? [])
    const unique = new Map<number, Student>()
    for (const row of studentData as Student[]) if (!unique.has(row.id)) unique.set(row.id, row)
    setStudents([...unique.values()])
    setLoading(false)
  }, [id])

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer) }, [load])

  function notify(nextMessage = '', nextError = '') { setMessage(nextMessage); setError(nextError) }

  async function addStudents(event: React.FormEvent) {
    event.preventDefault()
    if (!selected.length) return
    setBusy(true); notify()
    const response = await fetch(`/api/sa/assessment-cohorts/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ student_ids: selected.map(Number) }) })
    const data = await response.json(); setBusy(false)
    if (!response.ok) { notify('', data.message ?? 'Could not add students.'); return }
    setSelected([]); setStudentSearch(''); setShowAddStudent(false); notify(`${data.added} student${data.added === 1 ? '' : 's'} added.`); await load()
  }

  async function removeStudent(studentId: number) {
    if (!window.confirm('Remove this student from the cohort?')) return
    setBusy(true); notify()
    const response = await fetch(`/api/sa/assessment-cohorts/${id}?student_id=${studentId}`, { method: 'DELETE' })
    const data = await response.json(); setBusy(false)
    if (!response.ok) { notify('', data.message ?? 'Could not remove student.'); return }
    notify('Student removed.'); await load()
  }

  async function downloadTemplate() {
    const response = await fetch(`/api/sa/assessment-cohorts/${id}/template`)
    if (!response.ok) { notify('', 'Could not download template.'); return }
    const url = URL.createObjectURL(await response.blob()); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'ca1-cohort-students-template.xlsx'; anchor.click(); URL.revokeObjectURL(url)
  }

  async function uploadFile(nextFile: File) {
    setBusy(true); notify(); const formData = new FormData(); formData.set('file', nextFile)
    const response = await fetch(`/api/sa/assessment-cohorts/${id}/import`, { method: 'POST', body: formData }); const data = await response.json(); setBusy(false)
    if (!response.ok) { notify('', data.message ?? 'Could not import students.'); return }
    notify(`${data.added} student${data.added === 1 ? '' : 's'} imported${data.unmatched ? `; ${data.unmatched} row${data.unmatched === 1 ? '' : 's'} did not match a root student` : ''}.`); await load()
  }

  if (loading) return <p className="text-sm text-gray-400">Loading cohort…</p>
  if (!cohort) return <div className="space-y-4"><Link href="/sa/ca1/cohorts" className="text-sm text-blue-400">← Cohorts</Link><p className="text-gray-300">Cohort not found.</p></div>
  const enrolledIds = new Set(members.map(member => member.student_id))
  const availableStudents = students.filter(student => !enrolledIds.has(student.id) && [student.name, student.prn, student.email].some(value => value.toLowerCase().includes(studentSearch.toLowerCase())))
  return <div className="space-y-6"><Link href="/sa/ca1/cohorts" className="text-sm font-semibold text-blue-400 hover:text-blue-300">← Cohorts</Link><header className="flex flex-wrap items-end justify-between gap-4 border-b border-gray-700 pb-6"><div><p className="text-sm font-semibold text-blue-400">CA1 cohort</p><h1 className="mt-1 text-4xl font-bold tracking-tight text-white">{cohort.name}</h1><p className="mt-2 text-gray-400">{members.length} students enrolled{cohort.description ? ` · ${cohort.description}` : ''}</p></div><div className="flex flex-wrap gap-2"><button onClick={() => void downloadTemplate()} className="btn-secondary">⇩ Download template</button><label className="btn-secondary cursor-pointer">⇧ Upload Excel<input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={event => { const nextFile = event.target.files?.[0]; if (nextFile) void uploadFile(nextFile) }} /></label><button onClick={() => setShowAddStudent(true)} className="btn-primary">＋ Add student</button></div></header>{(message || error) && <p className={`rounded-lg border p-3 text-sm ${error ? 'border-red-800 bg-red-950/50 text-red-300' : 'border-green-800 bg-green-950/50 text-green-300'}`}>{error || message}</p>}<section className="rounded-xl border border-gray-700 bg-gray-800 shadow-sm"><div className="flex items-center justify-between gap-4 border-b border-gray-700 p-5"><div><h2 className="text-xl font-bold text-white">Students</h2><p className="mt-1 text-sm text-gray-400">Students enrolled in this cohort.</p></div><span className="text-sm text-gray-400">{members.length} total</span></div><div className="overflow-x-auto"><table className="w-full min-w-[800px] text-left"><thead className="bg-gray-900 text-xs font-bold uppercase tracking-wider text-gray-400"><tr><th className="px-5 py-4">Name</th><th className="px-5 py-4">PRN ID</th><th className="px-5 py-4">Email</th><th className="px-5 py-4 text-right">Actions</th></tr></thead><tbody className="divide-y divide-gray-700">{members.map(member => { const student = Array.isArray(member.ca1_students) ? member.ca1_students[0] : member.ca1_students; return <tr key={member.student_id} className="hover:bg-gray-700/40"><td className="px-5 py-4 font-semibold text-gray-100">{student?.name ?? 'Unknown student'}</td><td className="px-5 py-4 text-gray-300">{student?.prn ?? '—'}</td><td className="px-5 py-4 text-gray-300">{student?.email ?? '—'}</td><td className="px-5 py-4 text-right"><button disabled={busy} onClick={() => void removeStudent(member.student_id)} className="rounded-lg border border-red-800 bg-red-950/40 px-3 py-2 text-sm font-semibold text-red-300 hover:bg-red-900/60">Remove</button></td></tr> })}</tbody></table>{!members.length && <p className="p-12 text-center text-sm text-gray-400">No students enrolled yet.</p>}</div></section>{showAddStudent && <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4"><form onSubmit={addStudents} className="w-full max-w-2xl overflow-hidden rounded-2xl border border-gray-700 bg-gray-800 shadow-2xl"><div className="flex items-center justify-between border-b border-gray-700 px-6 py-5"><div><h2 className="text-xl font-bold text-white">Add students</h2><p className="mt-1 text-sm text-gray-400">Search by name, PRN, or email and select students to add.</p></div><button type="button" onClick={() => { setShowAddStudent(false); setSelected([]); setStudentSearch('') }} className="text-2xl text-gray-400 hover:text-white">×</button></div><div className="space-y-4 p-6"><input autoFocus className="input" placeholder="Search students by name, PRN, or email…" value={studentSearch} onChange={event => setStudentSearch(event.target.value)} /><div className="max-h-96 overflow-y-auto rounded-lg border border-gray-600 bg-gray-900">{availableStudents.map(student => <label key={student.id} className="flex cursor-pointer items-center gap-3 border-b border-gray-800 px-4 py-3 last:border-0 hover:bg-gray-800"><input type="checkbox" checked={selected.includes(String(student.id))} onChange={event => setSelected(current => event.target.checked ? [...current, String(student.id)] : current.filter(idValue => idValue !== String(student.id)))} /><span className="min-w-0"><span className="block font-semibold text-gray-100">{student.name}</span><span className="block truncate text-sm text-gray-400">{student.prn} · {student.email}</span></span></label>)}{!availableStudents.length && <p className="p-8 text-center text-sm text-gray-400">No matching available students.</p>}</div><p className="text-sm text-gray-400">{selected.length} student{selected.length === 1 ? '' : 's'} selected</p></div><div className="flex justify-end gap-2 border-t border-gray-700 px-6 py-4"><button type="button" onClick={() => { setShowAddStudent(false); setSelected([]); setStudentSearch('') }} className="btn-secondary">Cancel</button><button disabled={!selected.length || busy} className="btn-primary">Add selected</button></div></form></div>}</div>
}
