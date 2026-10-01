'use client'

import { useCallback, useEffect, useState } from 'react'

type Rubric = { category: string; label: string; maxMarks: number; mode: string }
type Score = { category: string; final_score: number | null; evaluator_notes: string | null; override_reason: string | null }
type Member = { roster_prn: string; student_id: number | null; github_username: string | null; ca1_roster: Array<{ name: string }> }
type GithubStat = { student_id: number; github_username: string; commit_count: number; additions: number; deletions: number; active_days: number; prs_opened: number; prs_reviewed: number; review_comments: number; files_owned: number; contribution_percentage: number }
type Evaluation = { team: { name: string; project_name: string | null; project_description: string | null }; artifacts: Record<string, string | null> & { status: string } | null; members: Member[]; scores: Score[]; individual: Array<{ student_id: number; final_score: number | null; system_score?: number | null; evaluator_notes: string | null; override_reason: string | null }>; github_stats: GithubStat[]; config: { results_published: boolean } | null; rubric: Rubric[]; individual_max_marks: number }

export default function ProjectEvaluation({ teamId }: { teamId: string }) {
  const [data, setData] = useState<Evaluation | null>(null)
  const [scores, setScores] = useState<Record<string, string>>({})
  const [individual, setIndividual] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)

  const load = useCallback(async () => {
    const response = await fetch(`/api/sa/projects/${teamId}`)
    if (!response.ok) { setError('Could not load project evaluation.'); return }
    const payload = await response.json() as Evaluation
    setData(payload)
    setScores(Object.fromEntries(payload.scores.map(score => [score.category, score.final_score == null ? '' : String(score.final_score)])))
    setIndividual(Object.fromEntries(payload.individual.map(score => [String(score.student_id), score.final_score == null ? (score.system_score == null ? '' : String(score.system_score)) : String(score.final_score)])))
    setNotes(Object.fromEntries(payload.scores.map(score => [`${score.category}:notes`, score.evaluator_notes ?? ''])))
  }, [teamId])

  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  async function analyzeGithub() {
    setAnalyzing(true); setMessage(''); setError('')
    const response = await fetch(`/api/sa/projects/${teamId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'analyze_github' }) })
    const payload = await response.json().catch(() => ({}))
    setAnalyzing(false)
    if (!response.ok) { setError(payload.message ?? 'GitHub analysis failed.'); return }
    setMessage(`GitHub analysis completed for ${payload.repository}. Suggested individual scores are ready for review.`)
    await load()
  }

  async function saveScores() {
    if (!data) return
    setBusy(true); setMessage(''); setError('')
    const response = await fetch(`/api/sa/projects/${teamId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'save_scores', scores: data.rubric.map(rubric => ({ category: rubric.category, final_score: scores[rubric.category] === '' ? null : Number(scores[rubric.category]), evaluator_notes: notes[`${rubric.category}:notes`] ?? '' })), individual: data.members.filter(member => member.student_id).map(member => ({ student_id: member.student_id, final_score: individual[String(member.student_id)] === '' ? null : Number(individual[String(member.student_id)]) })) }) })
    const payload = await response.json().catch(() => ({})); setBusy(false)
    if (!response.ok) { setError(payload.message ?? 'Could not save scores.'); return }
    setMessage(payload.message ?? 'Scores saved. Artifacts are now locked.'); await load()
  }

  async function publish(published: boolean) {
    const response = await fetch(`/api/sa/projects/${teamId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: published ? 'publish' : 'unpublish' }) })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) setError(payload.message ?? 'Could not update publication status.')
    else { setMessage(published ? 'CA3 results published.' : 'CA3 results unpublished.'); await load() }
  }

  if (!data) return <div className="rounded-xl border border-gray-700 bg-gray-800 p-5 text-gray-400">{error || 'Loading evaluation…'}</div>
  const submitted = data.artifacts?.status === 'submitted' || data.artifacts?.status === 'locked'

  return <div className="space-y-5">
    {message && <p className="rounded-lg bg-emerald-900/40 px-4 py-3 text-sm text-emerald-300">{message}</p>}
    {error && <p className="rounded-lg bg-red-900/40 px-4 py-3 text-sm text-red-300">{error}</p>}
    <section className="rounded-xl border border-gray-700 bg-gray-800 p-5"><h2 className="text-lg font-semibold">{data.team.name}</h2><p className="mt-1 text-gray-300">{data.team.project_name || 'No project name'}</p><p className="mt-4 whitespace-pre-wrap text-sm text-gray-400">{data.team.project_description || 'No project description'}</p><p className="mt-4 text-sm text-gray-400">Artifact status: <span className="capitalize text-gray-200">{data.artifacts?.status ?? 'not submitted'}</span></p></section>
    <section className="rounded-xl border border-gray-700 bg-gray-800 p-5"><h2 className="text-lg font-semibold">Submitted artifacts</h2>{!data.artifacts ? <p className="mt-3 text-gray-400">No artifacts submitted.</p> : <div className="mt-4 space-y-3 text-sm">{Object.entries(data.artifacts).filter(([key]) => !['id', 'team_id', 'status', 'submitted_at', 'created_at', 'updated_at', 'synopsis_pdf_path', 'design_document_pdf_path'].includes(key)).map(([key, value]) => <div key={key}><p className="capitalize text-gray-400">{key.replaceAll('_', ' ')}</p><p className="whitespace-pre-wrap break-words text-gray-200">{value || '—'}</p></div>)}<div className="flex flex-wrap gap-4 border-t border-gray-700 pt-3"><a href={`/api/ca3/artifacts/${teamId}/file?field=synopsis`} target="_blank" rel="noreferrer" className="text-blue-300 hover:underline">View synopsis PDF</a><a href={`/api/ca3/artifacts/${teamId}/file?field=design_document`} target="_blank" rel="noreferrer" className="text-blue-300 hover:underline">View design document PDF</a></div></div>}</section>
    <section className="rounded-xl border border-gray-700 bg-gray-800 p-5"><h2 className="text-lg font-semibold">Evaluation</h2><p className="mt-1 text-sm text-gray-400">Super Admin scores only. Saving final scores permanently locks the student artifact form.</p>{!submitted && <p className="mt-4 text-amber-300">Scores can be entered after the team submits its artifacts.</p>}
      <div className="mt-5 rounded-lg border border-gray-700 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">GitHub contribution analysis</h3><p className="mt-1 text-xs text-gray-400">Commits 25% · active days 25% · changes 10% · PRs 15% · reviews/comments 15% · files owned 10%</p></div><button type="button" onClick={analyzeGithub} disabled={!submitted || analyzing || busy} className="rounded-lg bg-indigo-700 px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50">{analyzing ? 'Analyzing GitHub…' : 'Analyze GitHub'}</button></div>{data.github_stats.length > 0 && <div className="mt-4 overflow-x-auto"><table className="w-full text-xs"><thead className="text-left text-gray-400"><tr><th className="pb-2">Member</th><th className="pb-2">Commits</th><th className="pb-2">Active days</th><th className="pb-2">PRs</th><th className="pb-2">Reviews</th><th className="pb-2">Owned files</th><th className="pb-2">Suggested /5</th></tr></thead><tbody className="divide-y divide-gray-700">{data.github_stats.map(stat => <tr key={stat.student_id}><td className="py-2">{data.members.find(member => member.student_id === stat.student_id)?.ca1_roster[0]?.name ?? stat.github_username}</td><td className="py-2">{stat.commit_count}</td><td className="py-2">{stat.active_days}</td><td className="py-2">{stat.prs_opened}</td><td className="py-2">{stat.prs_reviewed + stat.review_comments}</td><td className="py-2">{stat.files_owned}</td><td className="py-2 font-semibold">{data.individual.find(score => score.student_id === stat.student_id)?.system_score ?? '—'}</td></tr>)}</tbody></table></div>}</div>
      <div className="mt-5 space-y-5">{data.rubric.map(rubric => <div key={rubric.category} className="grid gap-3 border-b border-gray-700 pb-5 md:grid-cols-[1fr_120px]"><label className="text-sm text-gray-200">{rubric.label}<span className="ml-2 text-xs text-gray-500">/{rubric.maxMarks} · {rubric.mode}</span><textarea value={notes[`${rubric.category}:notes`] ?? ''} onChange={event => setNotes(current => ({ ...current, [`${rubric.category}:notes`]: event.target.value }))} disabled={!submitted || busy} rows={2} placeholder="Evaluator notes" className="mt-2 w-full rounded border border-gray-600 bg-gray-900 px-2 py-1 text-sm" /></label><input type="number" min="0" max={rubric.maxMarks} step="0.5" value={scores[rubric.category] ?? ''} onChange={event => setScores(current => ({ ...current, [rubric.category]: event.target.value }))} disabled={!submitted || busy} placeholder={`/${rubric.maxMarks}`} className="h-10 rounded border border-gray-600 bg-gray-900 px-2 py-1 text-sm" /></div>)}</div>
      <h3 className="mt-6 font-semibold">Individual contribution /{data.individual_max_marks}</h3><p className="mt-1 text-xs text-gray-400">The calculated GitHub score is a suggestion. Review the evidence and adjust the final score when necessary.</p><div className="mt-3 space-y-2">{data.members.map(member => <label key={member.roster_prn} className="flex items-center justify-between gap-3 text-sm text-gray-300"><span>{member.ca1_roster[0]?.name ?? member.roster_prn}</span><input type="number" min="0" max={data.individual_max_marks} step="0.5" value={member.student_id ? individual[String(member.student_id)] ?? '' : ''} onChange={event => member.student_id && setIndividual(current => ({ ...current, [String(member.student_id)]: event.target.value }))} disabled={!submitted || !member.student_id || busy} className="w-24 rounded border border-gray-600 bg-gray-900 px-2 py-1" /></label>)}</div><button type="button" onClick={saveScores} disabled={!submitted || busy} className="mt-6 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50">{busy ? 'Saving…' : 'Save Final Scores and Lock Artifacts'}</button>
    </section>
    <section className="rounded-xl border border-gray-700 bg-gray-800 p-5"><h2 className="font-semibold">Results publication</h2><p className="mt-1 text-sm text-gray-400">Current status: {data.config?.results_published ? 'Published' : 'Not published'}</p><div className="mt-4 flex gap-3"><button type="button" onClick={() => publish(true)} className="btn-primary text-sm">Publish Results</button>{data.config?.results_published && <button type="button" onClick={() => publish(false)} className="btn-secondary text-sm">Unpublish</button>}</div></section>
  </div>
}
