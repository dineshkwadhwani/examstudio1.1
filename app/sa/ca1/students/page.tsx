'use client'

import { useEffect, useState } from 'react'

type Student = { id: number; name: string; prn: string; email: string; cohorts: Array<{ name: string }>; assessments_total: number; assessments_completed: number; last_activity: string | null }

export default function Ca1StudentsPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  async function load(value = '') { const response = await fetch(`/api/sa/assessment-students${value ? `?search=${encodeURIComponent(value)}` : ''}`); const data = await response.json(); setStudents(data.students ?? []); setLoading(false) }
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer) }, [])
  return <div className="space-y-8"><header><p className="text-sm font-semibold text-blue-600">CA1</p><h1 className="mt-1 text-4xl font-bold tracking-tight">Students</h1><p className="mt-2 text-lg text-slate-500">All students connected to CA1 cohorts and assessments.</p></header><div className="flex flex-wrap gap-3"><input className="input max-w-md" placeholder="Search by name, email, or PRN…" value={search} onChange={event => { setSearch(event.target.value); void load(event.target.value) }} /></div><section className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm"><table className="w-full min-w-[950px] text-left"><thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500"><tr><th className="px-6 py-4">Name</th><th className="px-6 py-4">PRN ID</th><th className="px-6 py-4">Email</th><th className="px-6 py-4">Cohorts</th><th className="px-6 py-4">Assessments</th><th className="px-6 py-4">Last activity</th></tr></thead><tbody className="divide-y divide-slate-100">{students.map(student => <tr key={student.id} className="hover:bg-slate-50"><td className="px-6 py-4 font-semibold text-blue-700">{student.name}</td><td className="px-6 py-4 text-slate-600">{student.prn}</td><td className="px-6 py-4 text-slate-600">{student.email}</td><td className="px-6 py-4 text-slate-600">{student.cohorts.map(cohort => cohort.name).join(', ') || '—'}</td><td className="px-6 py-4 text-slate-600">{student.assessments_completed} / {student.assessments_total}</td><td className="px-6 py-4 text-sm text-slate-400">{student.last_activity ? new Date(student.last_activity).toLocaleString('en-IN') : '—'}</td></tr>)}</tbody></table>{!loading && !students.length && <p className="p-12 text-center text-sm text-slate-500">No students found.</p>}{loading && <p className="p-12 text-center text-sm text-slate-500">Loading students…</p>}</section></div>
}
