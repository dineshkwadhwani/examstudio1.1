import Link from 'next/link'
import { db } from '@/lib/db'

type RecentRow = { id: number; score: number | null; submitted_at: string | null; ca1_students?: { name: string; email: string }[]; ca1_assessments?: { name: string; total_marks: number }[] }

export default async function Ca1DashboardPage() {
  const [cohorts, students, assessments, completed, recent] = await Promise.all([
    db.from('ca1_assessment_cohorts').select('id', { count: 'exact', head: true }),
    db.from('ca1_assessment_cohort_members').select('student_id'),
    db.from('ca1_assessments').select('id', { count: 'exact', head: true }),
    db.from('ca1_assessment_papers').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
    db.from('ca1_assessment_papers').select('id, score, submitted_at, ca1_students(name, email), ca1_assessments(name, total_marks)').eq('status', 'completed').order('submitted_at', { ascending: false }).limit(8),
  ])
  const studentCount = new Set((students.data ?? []).map(row => row.student_id)).size
  return <div className="space-y-8">
    <header><p className="text-sm font-semibold text-blue-600">CA1 administration</p><h1 className="mt-1 text-4xl font-bold tracking-tight text-slate-900">Good day, Dinesh 👋</h1><p className="mt-2 text-lg text-slate-500">Here’s an overview of your assessments and students.</p></header>
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
      {[['♙', studentCount, 'Students', 'bg-blue-50 text-blue-600'], ['♧', cohorts.count ?? 0, 'Cohorts', 'bg-indigo-50 text-indigo-600'], ['▣', assessments.count ?? 0, 'Assessments', 'bg-emerald-50 text-emerald-600'], ['✓', completed.count ?? 0, 'Completed attempts', 'bg-amber-50 text-amber-600']].map(([icon, value, label, color]) => <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm"><div className={`flex h-12 w-12 items-center justify-center rounded-xl text-2xl ${color}`}>{icon}</div><p className="mt-6 text-4xl font-bold text-slate-900">{value}</p><p className="mt-1 text-base font-medium text-slate-500">{label}</p></div>)}
    </div>
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-7 py-5"><div><h2 className="text-2xl font-bold text-slate-800">Recent submissions</h2><p className="mt-1 text-sm text-slate-500">Latest completed CA1 assessment attempts.</p></div><Link href="/sa/ca1/results" className="text-sm font-semibold text-blue-600 hover:text-blue-800">View all results →</Link></div><div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left"><thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500"><tr><th className="px-7 py-4">Student</th><th className="px-7 py-4">Assessment</th><th className="px-7 py-4">Score</th><th className="px-7 py-4">Submitted</th></tr></thead><tbody className="divide-y divide-slate-100">{(recent.data as RecentRow[] ?? []).map(row => { const student = row.ca1_students?.[0]; const assessment = row.ca1_assessments?.[0]; return <tr key={row.id} className="hover:bg-slate-50"><td className="px-7 py-4"><p className="font-semibold text-slate-800">{student?.name}</p><p className="text-sm text-slate-400">{student?.email}</p></td><td className="px-7 py-4 text-slate-600">{assessment?.name}</td><td className="px-7 py-4 font-bold text-blue-600">{row.score ?? '—'} <span className="font-normal text-slate-400">/ {assessment?.total_marks}</span></td><td className="px-7 py-4 text-sm text-slate-400">{row.submitted_at ? new Date(row.submitted_at).toLocaleString('en-IN') : '—'}</td></tr> })}</tbody></table>{!(recent.data ?? []).length && <p className="px-7 py-12 text-center text-sm text-slate-500">No completed submissions yet.</p>}</div></section>
  </div>
}
