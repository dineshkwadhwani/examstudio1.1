'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type Student = { id: number; prn: string; name: string; ca2_marks: number | null; ca3_marks: number | null }

export default function SAStudentOverviewPage() {
  const router = useRouter()
  const [students, setStudents] = useState<Student[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)
  const [resetting, setResetting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/sa/student-overview').then(async response => {
      if (response.status === 401 || response.status === 403) { router.push('/sa/login'); return }
      if (!response.ok) { setError('Could not load students.'); setLoading(false); return }
      setStudents(await response.json())
      setLoading(false)
    }).catch(() => { setError('Could not load students.'); setLoading(false) })
  }, [router])

  function toggleStudent(id: number) {
    setSelectedIds(previous => previous.has(id) ? new Set() : new Set([id]))
  }

  async function resetSelectedPasswords() {
    if (selectedIds.size === 0) return
    setResetting(true)
    setMessage('')
    setError('')
    try {
      const studentId = [...selectedIds][0]
      const response = await fetch('/api/sa/override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset_password', student_id: studentId }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message ?? 'Could not reset the password.')
      setMessage(`${data.message} Temporary password: ${data.temp_password}`)
      setSelectedIds(new Set())
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : 'Could not reset passwords.')
    } finally {
      setResetting(false)
    }
  }

  if (loading) return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-gray-400">Loading…</div>

  return <div className="min-h-screen bg-gray-900 text-white"><header className="sticky top-0 z-10 border-b border-gray-700 bg-gray-800"><div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3"><h1 className="font-bold">Students ({students.length})</h1><div className="flex items-center gap-2">{selectedIds.size === 1 && <button onClick={resetSelectedPasswords} disabled={resetting} className="btn-primary text-xs">{resetting ? 'Resetting…' : 'Reset password'}</button>}<Link href="/sa/dashboard" className="btn-secondary text-xs">← Dashboard</Link></div></div></header><main className="mx-auto max-w-6xl px-4 py-6"><p className="mb-4 text-xs text-gray-400">Select one student to reset their password. The temporary password will be displayed here once.</p>{message && <p className="mb-4 rounded-lg border border-green-800 bg-green-950/40 p-3 text-sm text-green-300" role="status">{message}</p>}{error && <p className="mb-4 rounded-lg border border-red-800 bg-red-950/40 p-3 text-sm text-red-300" role="alert">{error}</p>}<div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-gray-700 text-left text-xs uppercase tracking-wide text-gray-400"><th className="w-10 pb-3" aria-label="Select student"></th><th className="pb-3 pr-4">Name</th><th className="pb-3 text-center">CA1</th><th className="pb-3 text-center">CA2</th><th className="pb-3 text-center">CA3</th></tr></thead><tbody className="divide-y divide-gray-800">{students.map(student => <tr key={student.id} className="hover:bg-gray-800"><td className="py-3"><input type="checkbox" aria-label={`Select ${student.name}`} checked={selectedIds.has(student.id)} onChange={() => toggleStudent(student.id)} className="h-4 w-4 accent-blue-600" /></td><td className="py-3 pr-4"><Link href={`/sa/students/${student.id}`} className="font-medium text-blue-300 hover:underline">{student.name}</Link><span className="ml-2 text-xs text-gray-500">{student.prn}</span></td><td className="py-3 text-center text-gray-500">—</td><td className="py-3 text-center text-gray-200">{student.ca2_marks === null ? '—' : student.ca2_marks.toFixed(1)}</td><td className="py-3 text-center text-gray-200">{student.ca3_marks === null ? '—' : student.ca3_marks.toFixed(1)}</td></tr>)}</tbody></table>{students.length === 0 && <p className="py-10 text-center text-gray-400">No students found.</p>}</div></main></div>
}
