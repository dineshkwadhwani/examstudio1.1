'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'

const labels: Record<string, string> = { multi_agent_design: 'Multi-Agent Design', design: 'Design', live_demo: 'Live Demo', presentation: 'Presentation', documentation: 'Documentation', code_review: 'Code Review' }
type Result = { student_id: number; student_name: string; prn: string; team_id: number | null; team_name: string | null; project_status: string | null; scores: Record<string, number | null>; contribution: number | null; final_score: number | null }

export default function CA3ResultsFiltered() {
  const router = useRouter()
  const [rows, setRows] = useState<Result[]>([]); const [categories, setCategories] = useState<string[]>([]); const [teamFilter, setTeamFilter] = useState('all'); const [statusFilter, setStatusFilter] = useState('all'); const [loading, setLoading] = useState(true); const [error, setError] = useState('')
  useEffect(() => { fetch('/api/sa/ca3-results', { cache: 'no-store' }).then(async response => { if (response.status === 401 || response.status === 403) { router.push('/sa/login'); return }; const payload = await response.json().catch(() => ({})); if (!response.ok) { setError(payload.message ?? 'Could not load CA3 results.'); return }; setRows(payload.rows ?? []); setCategories(payload.categories ?? []) }).catch(() => setError('Could not load CA3 results.')).finally(() => setLoading(false)) }, [router])
  const teamOptions = [...new Set(rows.map(row => row.team_name).filter((name): name is string => Boolean(name)))].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
  const statusOptions = [...new Set(rows.map(row => row.project_status).filter((status): status is string => Boolean(status)))].sort((a, b) => a.localeCompare(b))
  const filteredRows = rows.filter(row => (teamFilter === 'all' || row.team_name === teamFilter) && (statusFilter === 'all' || row.project_status === statusFilter))

  function exportExcel() {
    const exportRows = filteredRows.map(row => {
      const result: Record<string, string | number> = { 'Student name': row.student_name, PRN: row.prn, 'Team name': row.team_name ?? '', 'Project status': row.project_status?.replaceAll('_', ' ') ?? '' }
      for (const category of categories) result[labels[category] ?? category] = row.scores[category] ?? ''
      result.Contribution = row.contribution ?? ''
      result['Final score /45'] = row.final_score ?? ''
      return result
    })
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(exportRows), 'CA3 Results')
    XLSX.writeFile(workbook, `ca3-results${teamFilter !== 'all' ? `-${teamFilter.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')}` : ''}.xlsx`)
  }

  if (loading) return <div className="rounded-xl border border-gray-700 bg-gray-800 p-6 text-gray-400">Loading results…</div>
  if (error) return <p className="rounded-lg bg-red-900/40 p-3 text-red-300" role="alert">{error}</p>
  return <section className="rounded-xl border border-gray-700 bg-gray-800 p-5">
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">CA3 Results</h2><p className="mt-1 text-sm text-gray-400">Students are listed alphabetically. Click a team name to review its artifacts and evaluation.</p></div><button type="button" onClick={exportExcel} disabled={filteredRows.length === 0} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50">Export Excel</button></div>
    <div className="mb-5 grid gap-3 sm:grid-cols-2"><label className="text-sm text-gray-300">Team name<select value={teamFilter} onChange={event => setTeamFilter(event.target.value)} className="mt-1 w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white"><option value="all">All teams</option>{teamOptions.map(team => <option key={team} value={team}>{team}</option>)}</select></label><label className="text-sm text-gray-300">Project status<select value={statusFilter} onChange={event => setStatusFilter(event.target.value)} className="mt-1 w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-sm capitalize text-white"><option value="all">All statuses</option>{statusOptions.map(status => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}</select></label></div>
    <div className="mb-3 text-sm text-gray-400">Showing {filteredRows.length} of {rows.length} students</div>
    <div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-sm"><thead><tr className="border-b border-gray-700 text-left text-xs uppercase text-gray-400"><th className="px-3 py-3">Student name</th><th className="px-3 py-3">PRN</th><th className="px-3 py-3">Team name</th><th className="px-3 py-3">Project status</th>{categories.map(category => <th key={category} className="px-3 py-3">{labels[category] ?? category}</th>)}<th className="px-3 py-3">Contribution</th><th className="px-3 py-3">Final score /45</th></tr></thead><tbody className="divide-y divide-gray-700">{filteredRows.map(row => <tr key={row.student_id} className="hover:bg-gray-750"><td className="px-3 py-3 font-semibold">{row.student_name}</td><td className="px-3 py-3 text-gray-300">{row.prn}</td><td className="px-3 py-3">{row.team_id ? <Link href={`/sa/teams/${row.team_id}/artifacts`} className="text-blue-300 hover:underline">{row.team_name}</Link> : <span className="text-gray-500">—</span>}</td><td className="px-3 py-3 capitalize text-gray-300">{row.project_status?.replaceAll('_', ' ') ?? '—'}</td>{categories.map(category => <td key={category} className="px-3 py-3 text-gray-300">{row.scores[category] == null ? '—' : row.scores[category].toFixed(2)}</td>)}<td className="px-3 py-3 text-gray-300">{row.contribution == null ? '—' : row.contribution.toFixed(2)}</td><td className="px-3 py-3 font-semibold text-white">{row.final_score == null ? '—' : row.final_score.toFixed(2)}</td></tr>)}</tbody></table></div>{filteredRows.length === 0 && <p className="py-8 text-center text-gray-400">No students match the selected filters.</p>}
  </section>
}
