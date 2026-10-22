'use client'

import { useCallback, useEffect, useState } from 'react'

type Rubric = { category: string; label: string; maxMarks: number; mode: string }
type Score = { category: string; final_score: number | null; system_score: number | null; system_feedback: string | null; system_evaluated_at: string | null; system_model: string | null; evaluator_notes: string | null; override_reason: string | null }
type Member = { roster_prn: string; student_id: number | null; github_username: string | null; ca1_roster: Array<{ name: string }> }
type GithubStat = { student_id: number; github_username: string; commit_count: number; additions: number; deletions: number; active_days: number; prs_opened: number; prs_reviewed: number; review_comments: number; files_owned: number; contribution_percentage: number }
type Evaluation = { team: { name: string; project_name: string | null; project_description: string | null; assessment_review_comments: string | null }; artifacts: Record<string, string | null> & { status: string } | null; members: Member[]; scores: Score[]; individual: Array<{ student_id: number; final_score: number | null; system_score?: number | null; evaluator_notes: string | null; override_reason: string | null }>; github_stats: GithubStat[]; config: { results_published: boolean } | null; rubric: Rubric[]; individual_max_marks: number }

function fileName(path: string | null | undefined) {
  return path?.split('/').pop() || 'PDF file'
}

function notesForScore(score: Score) {
  if (score.evaluator_notes?.trim()) return score.evaluator_notes
  if (!score.system_feedback) return ''
  try {
    const ai = JSON.parse(score.system_feedback) as { feedback?: string; evidence?: string[]; missing?: string[]; confidence?: string }
    return [
      ai.feedback ? `AI rationale: ${ai.feedback}` : '',
      ai.evidence?.length ? `Evidence: ${ai.evidence.join(' | ')}` : '',
      ai.missing?.length ? `Missing or unverified: ${ai.missing.join(' | ')}` : '',
      ai.confidence ? `Confidence: ${ai.confidence}.` : '',
    ].filter(Boolean).join('\n')
  } catch {
    return ''
  }
}

export default function ProjectEvaluation({ teamId }: { teamId: string }) {
  const [data, setData] = useState<Evaluation | null>(null)
  const [scores, setScores] = useState<Record<string, string>>({})
  const [individual, setIndividual] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [overallComments, setOverallComments] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [evaluatingCategory, setEvaluatingCategory] = useState<string | null>(null)
  const [categoryErrors, setCategoryErrors] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    const response = await fetch(`/api/sa/projects/${teamId}`)
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) { setError(payload.message ?? `Could not load project evaluation (HTTP ${response.status}).`); return }
    const evaluation = payload as Evaluation
    setData(evaluation)
    setScores(Object.fromEntries(evaluation.scores.map(score => [score.category, score.final_score == null ? (score.system_score == null ? '' : String(score.system_score)) : String(score.final_score)])))
    setIndividual(Object.fromEntries(evaluation.individual.map(score => [String(score.student_id), score.final_score == null ? (score.system_score == null ? '' : String(score.system_score)) : String(score.final_score)])))
    setNotes(Object.fromEntries(evaluation.scores.map(score => [`${score.category}:notes`, notesForScore(score)])))
    setOverallComments(evaluation.team.assessment_review_comments ?? '')
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

  async function evaluateCategory(category: string) {
    setEvaluatingCategory(category); setMessage(''); setError(''); setCategoryErrors(current => ({ ...current, [category]: '' }))
    try {
      const response = await fetch(`/api/sa/projects/${teamId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'analyze_category', category }) })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) { setCategoryErrors(current => ({ ...current, [category]: payload.message ?? `Automated evaluation failed (HTTP ${response.status}).` })); return }
      setMessage(`${payload.category} evaluated. Suggested score: ${payload.score}/${payload.max_marks}. Evaluator notes were populated with the rationale; review and edit them before saving final scores.`)
      await load()
    } catch {
      setCategoryErrors(current => ({ ...current, [category]: 'Could not reach the automated evaluation service. Please try again.' }))
    } finally {
      setEvaluatingCategory(null)
    }
  }

  async function saveScores() {
    if (!data) return
    setBusy(true); setMessage(''); setError('')
    const response = await fetch(`/api/sa/projects/${teamId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'save_scores', overall_comments: overallComments, scores: data.rubric.map(rubric => ({ category: rubric.category, final_score: scores[rubric.category] === '' ? null : Number(scores[rubric.category]), evaluator_notes: notes[`${rubric.category}:notes`] ?? '' })), individual: data.members.filter(member => member.student_id).map(member => ({ student_id: member.student_id, final_score: individual[String(member.student_id)] === '' ? null : Number(individual[String(member.student_id)]) })) }) })
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
  const projectMax = data.rubric.reduce((total, rubric) => total + rubric.maxMarks, 0)
  const projectTotal = data.rubric.reduce((total, rubric) => total + (Number.isFinite(Number(scores[rubric.category])) ? Number(scores[rubric.category]) : 0), 0)
  const individualTotal = data.members.reduce((total, member) => total + (member.student_id && Number.isFinite(Number(individual[String(member.student_id)])) ? Number(individual[String(member.student_id)]) : 0), 0)

  return <div className="space-y-5">
    {message && <p className="rounded-lg bg-emerald-900/40 px-4 py-3 text-sm text-emerald-300">{message}</p>}
    {error && <p className="rounded-lg bg-red-900/40 px-4 py-3 text-sm text-red-300">{error}</p>}
    <section className="rounded-xl border border-gray-700 bg-gray-800 p-5"><h2 className="text-lg font-semibold">{data.team.name}</h2><p className="mt-1 text-gray-300">{data.team.project_name || 'No project name'}</p><p className="mt-4 whitespace-pre-wrap text-sm text-gray-400">{data.team.project_description || 'No project description'}</p><p className="mt-4 text-sm text-gray-400">Artifact status: <span className="capitalize text-gray-200">{data.artifacts?.status ?? 'not submitted'}</span></p></section>
    <section className="rounded-xl border border-gray-700 bg-gray-800 p-5"><h2 className="text-lg font-semibold">Submitted artifacts</h2>{!data.artifacts ? <p className="mt-3 text-gray-400">No artifacts submitted.</p> : <div className="mt-4 space-y-3 text-sm"><div className="grid gap-3 border-b border-gray-700 pb-3 sm:grid-cols-2"><div><p className="text-gray-400">Project synopsis</p>{data.artifacts.synopsis_pdf_path ? <a href={`/api/ca3/artifacts/${teamId}/file?field=synopsis`} target="_blank" rel="noreferrer" className="mt-1 inline-block text-blue-300 hover:underline">View synopsis PDF</a> : <p className="mt-1 text-gray-500">Not provided</p>}</div><div><p className="text-gray-400">Design document</p>{data.artifacts.design_document_pdf_path ? <a href={`/api/ca3/artifacts/${teamId}/file?field=design_document`} target="_blank" rel="noreferrer" className="mt-1 inline-block text-blue-300 hover:underline">View design document PDF</a> : <p className="mt-1 text-gray-500">Not provided</p>}</div></div>{Object.entries(data.artifacts).filter(([key]) => !['id', 'team_id', 'status', 'submitted_at', 'created_at', 'updated_at', 'synopsis', 'design_document_url', 'synopsis_pdf_path', 'design_document_pdf_path'].includes(key)).map(([key, value]) => <div key={key}><p className="capitalize text-gray-400">{key.replaceAll('_', ' ')}</p><p className="whitespace-pre-wrap break-words text-gray-200">{value || '—'}</p></div>)}</div>}</section>
    <section className="rounded-xl border border-gray-700 bg-gray-800 p-5"><h2 className="text-lg font-semibold">Evaluation</h2><p className="mt-1 text-sm text-gray-400">Super Admin scores only. Saving final scores permanently locks the student artifact form.</p>{!submitted && <p className="mt-4 text-amber-300">Scores can be entered after the team submits its artifacts.</p>}
      <div className="mt-5 rounded-lg border border-gray-700 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">GitHub contribution analysis</h3><p className="mt-1 text-xs text-gray-400">Commits 25% · active days 25% · changes 10% · PRs 15% · reviews/comments 15% · files owned 10%</p></div><button type="button" onClick={analyzeGithub} disabled={!submitted || analyzing || busy} className="rounded-lg bg-indigo-700 px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50">{analyzing ? 'Analyzing GitHub…' : 'Analyze GitHub'}</button></div>{data.github_stats.length > 0 && <div className="mt-4 overflow-x-auto"><table className="w-full text-xs"><thead className="text-left text-gray-400"><tr><th className="pb-2">Member</th><th className="pb-2">Commits</th><th className="pb-2">Active days</th><th className="pb-2">PRs</th><th className="pb-2">Reviews</th><th className="pb-2">Owned files</th><th className="pb-2">Suggested /5</th></tr></thead><tbody className="divide-y divide-gray-700">{data.github_stats.map(stat => <tr key={stat.student_id}><td className="py-2">{data.members.find(member => member.student_id === stat.student_id)?.ca1_roster[0]?.name ?? stat.github_username}</td><td className="py-2">{stat.commit_count}</td><td className="py-2">{stat.active_days}</td><td className="py-2">{stat.prs_opened}</td><td className="py-2">{stat.prs_reviewed + stat.review_comments}</td><td className="py-2">{stat.files_owned}</td><td className="py-2 font-semibold">{data.individual.find(score => score.student_id === stat.student_id)?.system_score ?? '—'}</td></tr>)}</tbody></table></div>}</div>
      <div className="mt-5 space-y-5">{data.rubric.map(rubric => { const score = data.scores.find(item => item.category === rubric.category); const automated = rubric.mode === 'system-assisted'; return <div key={rubric.category} className="border-b border-gray-700 pb-5"><div className="mb-2 text-sm text-gray-200">{rubric.label}<span className="ml-2 text-xs text-gray-500">/{rubric.maxMarks} · {rubric.mode}</span></div><div className="grid items-start gap-3 md:grid-cols-[minmax(0,1fr)_8rem]"><textarea aria-label={`${rubric.label} evaluator notes`} value={notes[`${rubric.category}:notes`] ?? ''} onChange={event => setNotes(current => ({ ...current, [`${rubric.category}:notes`]: event.target.value }))} disabled={!submitted || busy} rows={2} placeholder="Evaluator notes" className="mt-0 min-h-20 w-full rounded border border-gray-600 bg-gray-900 px-2 py-1 text-sm" /><input aria-label={`${rubric.label} final score`} type="number" min="0" max={rubric.maxMarks} step="0.5" value={scores[rubric.category] ?? ''} onChange={event => setScores(current => ({ ...current, [rubric.category]: event.target.value }))} disabled={!submitted || busy} placeholder={`/${rubric.maxMarks}`} className="mt-0 h-10 w-full rounded border border-gray-600 bg-gray-900 px-2 py-1 text-sm" /></div>{automated && <div className="mt-3 rounded-lg border border-indigo-900 bg-indigo-950/30 p-3"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-indigo-300">AI suggested score</p><p className="mt-1 text-sm text-gray-300">{score?.system_score == null ? 'Not evaluated yet.' : `${score.system_score}/${rubric.maxMarks} · ${score.system_model ?? 'Groq'}`}</p></div><button type="button" onClick={() => evaluateCategory(rubric.category)} disabled={!submitted || busy || evaluatingCategory !== null} className="shrink-0 rounded-lg bg-indigo-700 px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50">{evaluatingCategory === rubric.category ? 'Evaluating…' : 'Evaluate with Groq'}</button></div><div className="mt-3 border-t border-indigo-900 pt-3"><p className="text-xs font-semibold uppercase tracking-wide text-indigo-300">Evaluation files</p><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">{data.artifacts?.synopsis_pdf_path ? <a href={`/api/ca3/artifacts/${teamId}/file?field=synopsis`} target="_blank" rel="noreferrer" className="text-blue-300 hover:underline">{fileName(data.artifacts.synopsis_pdf_path)}</a> : <span className="text-gray-500">Synopsis PDF unavailable</span>}{data.artifacts?.design_document_pdf_path ? <a href={`/api/ca3/artifacts/${teamId}/file?field=design_document`} target="_blank" rel="noreferrer" className="text-blue-300 hover:underline">{fileName(data.artifacts.design_document_pdf_path)}</a> : <span className="text-gray-500">Design document unavailable</span>}</div></div>{categoryErrors[rubric.category] && <p role="alert" className="mt-3 rounded border border-red-800 bg-red-950/40 px-3 py-2 text-sm text-red-300">{categoryErrors[rubric.category]}</p>}{score?.system_feedback && <details className="mt-3 text-xs text-gray-300"><summary className="cursor-pointer text-indigo-300">View AI evidence and feedback</summary><pre className="mt-2 whitespace-pre-wrap break-words rounded bg-gray-900 p-3">{(() => { try { const parsed = JSON.parse(score.system_feedback); return JSON.stringify(parsed, null, 2) } catch { return score.system_feedback } })()}</pre></details>}</div>}</div> })}</div>
      <h3 className="mt-6 font-semibold">Individual contribution /{data.individual_max_marks}</h3><p className="mt-1 text-xs text-gray-400">The calculated GitHub score is a suggestion. Review the evidence and adjust the final score when necessary.</p><div className="mt-3 space-y-2">{data.members.map(member => <label key={member.roster_prn} className="flex items-center justify-between gap-3 text-sm text-gray-300"><span>{member.ca1_roster[0]?.name ?? member.roster_prn}</span><input type="number" min="0" max={data.individual_max_marks} step="0.5" value={member.student_id ? individual[String(member.student_id)] ?? '' : ''} onChange={event => member.student_id && setIndividual(current => ({ ...current, [String(member.student_id)]: event.target.value }))} disabled={!submitted || !member.student_id || busy} className="w-24 rounded border border-gray-600 bg-gray-900 px-2 py-1" /></label>)}</div><div className="mt-6 grid gap-4 rounded-lg border border-gray-700 bg-gray-900/40 p-4 sm:grid-cols-3"><div><p className="text-xs uppercase tracking-wide text-gray-400">Project total</p><p className="mt-1 text-2xl font-semibold text-white">{projectTotal}/{projectMax}</p></div><div><p className="text-xs uppercase tracking-wide text-gray-400">Individual contribution</p><p className="mt-1 text-2xl font-semibold text-white">{individualTotal}/{data.individual_max_marks}</p></div><div><p className="text-xs uppercase tracking-wide text-gray-400">Overall total</p><p className="mt-1 text-2xl font-semibold text-indigo-300">{projectTotal + individualTotal}/{projectMax + data.individual_max_marks}</p></div></div><label className="mt-5 block text-sm text-gray-200">Overall comments<textarea value={overallComments} onChange={event => setOverallComments(event.target.value)} disabled={!submitted || busy} rows={4} placeholder="Add overall assessment comments…" className="mt-2 min-h-24 w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-sm" /></label><button type="button" onClick={saveScores} disabled={!submitted || busy} className="mt-6 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50">{busy ? 'Saving…' : 'Save Final Scores and Lock Artifacts'}</button>
    </section>
    <section className="rounded-xl border border-gray-700 bg-gray-800 p-5"><h2 className="font-semibold">Results publication</h2><p className="mt-1 text-sm text-gray-400">Current status: {data.config?.results_published ? 'Published' : 'Not published'}</p><div className="mt-4 flex gap-3"><button type="button" onClick={() => publish(true)} className="btn-primary text-sm">Publish Results</button>{data.config?.results_published && <button type="button" onClick={() => publish(false)} className="btn-secondary text-sm">Unpublish</button>}</div></section>
  </div>
}
