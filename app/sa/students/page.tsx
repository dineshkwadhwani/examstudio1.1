'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Student {
  id: number
  prn: string
  name: string
  email: string
  has_key: boolean
  mcq_answered: number
  paper_fetched: boolean
  task1_status: string | null
  task2_status: string | null
  task3_status: string | null
  task1_marks: number | null
  task2_marks: number | null
  task3_marks: number | null
  total_marks: number
  flag_count: number
}

function StatusDot({ status }: { status: string | null }) {
  if (!status) return <span className="inline-block w-2 h-2 rounded-full bg-gray-300" title="Not submitted" />
  const colors: Record<string, string> = {
    pending: 'bg-yellow-400',
    verified: 'bg-green-500',
    failed: 'bg-red-500',
    flagged: 'bg-red-600',
    deferred: 'bg-orange-400',
  }
  return <span className={`inline-block w-2 h-2 rounded-full ${colors[status] ?? 'bg-gray-400'}`} title={status} />
}

export default function SAStudentsPage() {
  const router = useRouter()
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showAddStudent, setShowAddStudent] = useState(false)
  const [newStudent, setNewStudent] = useState({ prn: '', name: '' })
  const [addingStudent, setAddingStudent] = useState(false)
  const [addMessage, setAddMessage] = useState('')
  const [addError, setAddError] = useState('')

  useEffect(() => {
    fetchStudents()
  }, [])

  async function fetchStudents(q = '') {
    const res = await fetch(`/api/sa/students${q ? `?search=${encodeURIComponent(q)}` : ''}`)
    if (res.status === 401 || res.status === 403) { router.push('/sa/login'); return }
    setStudents(await res.json())
    setLoading(false)
  }

  function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
    setSearch(e.target.value)
    fetchStudents(e.target.value)
  }

  async function addRosterStudent() {
    setAddingStudent(true)
    setAddMessage('')
    setAddError('')
    const res = await fetch('/api/sa/roster', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newStudent),
    })
    const data = await res.json()
    setAddingStudent(false)
    if (!res.ok) { setAddError(data.message ?? 'Could not add student.'); return }
    setAddMessage(data.message)
    setNewStudent({ prn: '', name: '' })
    fetchStudents(search)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="text-gray-400">Loading…</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="font-bold">Students ({students.length})</h1>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowAddStudent(value => !value)} className="btn-primary text-xs">
              + Add student
            </button>
            <input
              className="input bg-gray-700 border-gray-600 text-white text-sm w-64"
              placeholder="Search name, email, PRN…"
              value={search}
              onChange={handleSearch}
            />
            <Link href="/sa/dashboard" className="btn-secondary text-xs">← Dashboard</Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {showAddStudent && (
          <section className="bg-gray-800 border border-gray-700 rounded-xl p-4 mb-5 max-w-xl">
            <h2 className="font-semibold text-sm">Add eligible student</h2>
            <p className="text-xs text-gray-400 mt-1">Use this when a student is missing from the roster. They can immediately complete the normal registration form using this PRN.</p>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <input className="input bg-gray-700 border-gray-600 text-white text-sm" placeholder="PRN"
                value={newStudent.prn} onChange={e => setNewStudent(value => ({ ...value, prn: e.target.value }))} />
              <input className="input bg-gray-700 border-gray-600 text-white text-sm" placeholder="Student name"
                value={newStudent.name} onChange={e => setNewStudent(value => ({ ...value, name: e.target.value }))} />
            </div>
            <div className="flex items-center gap-3 mt-3">
              <button onClick={addRosterStudent} disabled={addingStudent} className="btn-primary text-sm">
                {addingStudent ? 'Adding…' : 'Add to roster'}
              </button>
              {addMessage && <p className="text-xs text-green-400">{addMessage}</p>}
              {addError && <p className="text-xs text-red-400">{addError}</p>}
            </div>
          </section>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 text-xs uppercase tracking-wide border-b border-gray-700">
                <th className="pb-3 pr-4">PRN</th>
                <th className="pb-3 pr-4">Name</th>
                <th className="pb-3 pr-4 text-center">Key</th>
                <th className="pb-3 pr-4 text-center">MCQ</th>
                <th className="pb-3 pr-4 text-center">Paper</th>
                <th className="pb-3 pr-4 text-center">T1</th>
                <th className="pb-3 pr-4 text-center">T2</th>
                <th className="pb-3 pr-4 text-center">T3</th>
                <th className="pb-3 pr-4 text-right">Total</th>
                <th className="pb-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {students.map(s => (
                <tr key={s.id} className="hover:bg-gray-800 transition-colors">
                  <td className="py-2.5 pr-4 text-gray-400 font-mono text-xs">{s.prn}</td>
                  <td className="py-2.5 pr-4 text-gray-100 font-medium">{s.name}</td>
                  <td className="py-2.5 pr-4 text-center">
                    {s.has_key ? <span className="text-green-400 text-xs">✓</span> : <span className="text-gray-600">—</span>}
                  </td>
                  <td className="py-2.5 pr-4 text-center">
                    <span className={`text-xs font-medium ${s.mcq_answered >= 10 ? 'text-green-400' : 'text-gray-400'}`}>
                      {s.mcq_answered}/10
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 text-center">
                    {s.paper_fetched ? <span className="text-green-400 text-xs">✓</span> : <span className="text-gray-600">—</span>}
                  </td>
                  <td className="py-2.5 pr-4 text-center"><StatusDot status={s.task1_status} /></td>
                  <td className="py-2.5 pr-4 text-center"><StatusDot status={s.task2_status} /></td>
                  <td className="py-2.5 pr-4 text-center"><StatusDot status={s.task3_status} /></td>
                  <td className="py-2.5 pr-4 text-right">
                    <span className="font-bold text-gray-100">{s.total_marks.toFixed(1)}</span>
                    <span className="text-gray-500 text-xs">/15</span>
                  </td>
                  <td className="py-2.5">
                    <Link href={`/sa/students/${s.id}`} className="text-blue-400 hover:text-blue-300 text-xs">
                      Detail →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}
