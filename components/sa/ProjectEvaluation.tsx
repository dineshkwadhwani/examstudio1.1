'use client'

import { useCallback, useEffect, useState } from 'react'
import { calculateMemberCategoryMarks, calculateMemberTotal } from '@/lib/ca3-scoring'

type Rubric = { category: string; label: string; maxMarks: number; mode: string }
type Score = { category: string; final_score: number | null; system_score: number | null; system_feedback: string | null; system_evaluated_at: string | null; system_model: string | null; evaluator_notes: string | null; override_reason: string | null }
type Member = { roster_prn: string; student_id: number | null; github_username: string | null; ca1_roster: Array<{ name: string }> | { name: string } | null }
type GithubStat = { student_id: number; github_username: string; commit_count: number; additions: number; deletions: number; active_days: number; prs_opened: number; prs_reviewed: number; review_comments: number; files_owned: number; contribution_percentage: number }
type Evaluation = { team: { name: string; project_name: string | null; project_description: string | null; assessment_review_comments: string | null }; artifacts: Record<string, string | null> & { status: 'draft' | 'submitted' | 'presented' | 'evaluation_complete' | 'locked'; evaluation_status?: 'pending' | 'evaluated'; evaluated_at?: string | null }; members: Member[]; scores: Score[]; individual: Array<{ student_id: number; final_score: number | null; system_score?: number | null; student_total_override?: number | null; evaluator_notes: string | null; override_reason: string | null }>; github_stats: GithubStat[]; config: { results_published: boolean } | null; rubric: Rubric[]; individual_max_marks: number }

function fileName(path: string | null | undefined) {
  return path?.split('/').pop() || 'PDF file'
}

function memberName(member: Member) {
  return Array.isArray(member.ca1_roster) ? member.ca1_roster[0]?.name ?? member.roster_prn : member.ca1_roster?.name ?? member.roster_prn
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
  const [memberTotals, setMemberTotals] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [overallComments, setOverallComments] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [presenting, setPresenting] = useState(false)
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
    const contributionByStudent = Object.fromEntries(evaluation.individual.map(score => [String(score.student_id), score.final_score ?? score.system_score ?? null]))
    const highestContribution = Math.max(0, ...Object.values(contributionByStudent).map(value => value ?? 0))
    const teamScores = evaluation.scores.map(score => ({ category: score.category, marks: score.final_score ?? score.system_score ?? 0 }))
    setMemberTotals(Object.fromEntries(evaluation.members.filter(member => member.student_id).map(member => {
      const savedTotal = evaluation.individual.find(score => score.student_id === member.student_id)?.student_total_override
      const contribution = contributionByStudent[String(member.student_id)] ?? 0
      const calculated = calculateMemberTotal(teamScores, contribution, highestContribution) + contribution
      return [String(member.student_id), savedTotal == null ? String(calculated) : String(savedTotal)]
    })))
    setNotes(Object.fromEntries(evaluation.scores.map(score => [`${score.category}:notes`, notesForScore(score)])))
    setOverallComments(evaluation.team.assessment_review_comments ?? '')
  }, [teamId])

  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  async function analyzeGithub() {
    setAnalyzing(true); setMessage('GitHub analysis started. This may take a few minutes while commits, pull requests, reviews, and owned files are checked.'); setError('')
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 180000)
    try {
      const response = await fetch(`/api/sa/projects/${teamId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'analyze_github' }), signal: controller.signal })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) { setError(payload.message ?? `GitHub analysis failed (HTTP ${response.status}).`); return }
      setMessage(`GitHub analysis completed for ${payload.repository}. Suggested individual scores are ready for review.`)
      await load()
    } catch (caught) {
      setError(caught instanceof DOMException && caught.name === 'AbortError' ? 'GitHub analysis timed out after three minutes. The repository may have too many commits, pull requests, or reviews to scan in one request.' : caught instanceof Error ? `GitHub analysis failed: ${caught.message}` : 'GitHub analysis failed. Please try again.')
    } finally {
      window.clearTimeout(timeout)
      setAnalyzing(false)
    }
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

  async function saveScores(completeEvaluation = false) {
    if (!data) return
    setBusy(true); setMessage(''); setError('')
    const response = await fetch(`/api/sa/projects/${teamId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'save_scores', complete_evaluation: completeEvaluation, overall_comments: overallComments, scores: data.rubric.map(rubric => ({ category: rubric.category, final_score: scores[rubric.category] === '' ? null : Number(scores[rubric.category]), evaluator_notes: notes[`${rubric.category}:notes`] ?? '' })), individual: data.members.filter(member => member.student_id).map(member => ({ student_id: member.student_id, final_score: individual[String(member.student_id)] === '' ? null : Number(individual[String(member.student_id)]), student_total_override: memberTotals[String(member.student_id)] === '' ? null : Number(memberTotals[String(member.student_id)]) })) }) })
    const payload = await response.json().catch(() => ({})); setBusy(false)
    if (!response.ok) { setError(payload.message ?? 'Could not save scores.'); return }
    setMessage(payload.message ?? (completeEvaluation ? 'Scores saved and evaluation marked Evaluated.' : 'Scores saved successfully.')); await load()
  }

  async function togglePresented() {
    setPresenting(true); setMessage(''); setError('')
    const response = await fetch(`/api/sa/projects/${teamId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'toggle_presented' }) })
    const payload = await response.json().catch(() => ({}))
    setPresenting(false)
    if (!response.ok) { setError(payload.message ?? 'Could not update the presentation status.'); return }
    setMessage(payload.message ?? 'Presentation status updated.'); await load()
  }

  async function publish(published: boolean) {
    const response = await fetch(`/api/sa/projects/${teamId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: published ? 'publish' : 'unpublish' }) })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) setError(payload.message ?? 'Could not update publication status.')
    else { setMessage(published ? 'CA3 results published.' : 'CA3 results unpublished.'); await load() }
  }

  if (!data) return <div className="rounded-xl border border-gray-700 bg-gray-800 p-5 text-gray-400">{error || 'Loading evaluation…'}</div>
  const submitted = data.artifacts?.status === 'submitted' || data.artifacts?.status === 'presented' || data.artifacts?.status === 'evaluation_complete' || data.artifacts?.status === 'locked'
  const canCompleteEvaluation = data.artifacts?.status === 'presented'
  const evaluationComplete = data.artifacts?.status === 'evaluation_complete'
  const canTogglePresented = data.artifacts?.status === 'submitted' || data.artifacts?.status === 'presented'
  const projectMax = data.rubric.reduce((total, rubric) => total + rubric.maxMarks, 0)
  const memberMax = projectMax + data.individual_max_marks
  const projectTotal = data.rubric.reduce((total, rubric) => total + (Number.isFinite(Number(scores[rubric.category])) ? Number(scores[rubric.category]) : 0), 0)
  const highestContribution = Math.max(0, ...data.members.map(member => member.student_id ? Number(individual[String(member.student_id)] || 0) : 0))
  const scoreForCategory = (category: string) => Number.isFinite(Number(scores[category])) ? Number(scores[category]) : 0
  const memberCategoryMarks = (member: Member, category: string) => calculateMemberCategoryMarks(category, scoreForCategory(category), member.student_id ? Number(individual[String(member.student_id)] || 0) : null, highestContribution)
  const calculatedMemberTotal = (studentId: number) => {
    const contribution = Number(individual[String(studentId)] || 0)
    const teamScores = data!.rubric.map(rubric => ({ category: rubric.category, marks: scoreForCategory(rubric.category) }))
    return calculateMemberTotal(teamScores, contribution, highestContribution) + contribution
  }
  const resetCalculatedTotals = () => {
    setMemberTotals(Object.fromEntries(data!.members.filter(member => member.student_id).map(member => [String(member.student_id), String(calculatedMemberTotal(member.student_id as number))])))
  }
  const resetContributions = () => {
    const nextIndividual = Object.fromEntries(data!.individual.map(score => [String(score.student_id), score.system_score == null ? '' : String(score.system_score)]))
    setIndividual(nextIndividual)
    const nextHighest = Math.max(0, ...data!.members.map(member => member.student_id ? Number(nextIndividual[String(member.student_id)] || 0) : 0))
    const teamScores = data!.rubric.map(rubric => ({ category: rubric.category, marks: scoreForCategory(rubric.category) }))
    setMemberTotals(Object.fromEntries(data!.members.filter(member => member.student_id).map(member => {
      const contribution = Number(nextIndividual[String(member.student_id)] || 0)
      return [String(member.student_id), String(calculateMemberTotal(teamScores, contribution, nextHighest) + contribution)]
    })))
  }
  function updateContribution(studentId: number, value: string) {
    const nextIndividual = { ...individual, [String(studentId)]: value }
    setIndividual(nextIndividual)
    const nextHighest = Math.max(0, ...data!.members.map(member => member.student_id ? Number(nextIndividual[String(member.student_id)] || 0) : 0))
    const teamScores = data!.rubric.map(rubric => ({ category: rubric.category, marks: scoreForCategory(rubric.category) }))
    setMemberTotals(Object.fromEntries(data!.members.filter(member => member.student_id).map(member => {
      const contribution = Number(nextIndividual[String(member.student_id)] || 0)
      return [String(member.student_id), String(calculateMemberTotal(teamScores, contribution, nextHighest) + contribution)]
    })))
  }
  function updateProjectScore(category: string, value: string) {
    const nextScores = { ...scores, [category]: value }
    setScores(nextScores)
    const nextHighest = Math.max(0, ...data!.members.map(member => member.student_id ? Number(individual[String(member.student_id)] || 0) : 0))
    const teamScores = data!.rubric.map(rubric => ({
      category: rubric.category,
      marks: Number.isFinite(Number(nextScores[rubric.category])) ? Number(nextScores[rubric.category]) : 0,
    }))
    setMemberTotals(Object.fromEntries(data!.members.filter(member => member.student_id).map(member => {
      const contribution = Number(individual[String(member.student_id)] || 0)
      return [String(member.student_id), String(calculateMemberTotal(teamScores, contribution, nextHighest) + contribution)]
    })))
  }

  return <div className="space-y-5">
    {message && <p className="rounded-lg bg-emerald-900/40 px-4 py-3 text-sm text-emerald-300">{message}</p>}
    {error && <p className="rounded-lg bg-red-900/40 px-4 py-3 text-sm text-red-300">{error}</p>}
    <section className="rounded-xl border border-gray-700 bg-gray-800 p-5"><h2 className="text-lg font-semibold">{data.team.name}</h2><p className="mt-1 text-gray-300">{data.team.project_name || 'No project name'}</p><p className="mt-4 whitespace-pre-wrap text-sm text-gray-400">{data.team.project_description || 'No project description'}</p><div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-400"><p>Artifact status: <span className="font-semibold text-gray-200">{evaluationComplete ? 'Evaluation Complete' : data.artifacts?.status ?? 'not submitted'}</span></p><p>Evaluation status: <span className={`font-semibold capitalize ${data.artifacts?.evaluation_status === 'evaluated' ? 'text-emerald-400' : 'text-amber-300'}`}>{data.artifacts?.evaluation_status ?? 'pending'}</span></p></div></section>
    <section className="rounded-xl border border-gray-700 bg-gray-800 p-5"><h2 className="text-lg font-semibold">Submitted artifacts</h2>{!data.artifacts ? <p className="mt-3 text-gray-400">No artifacts submitted.</p> : <div className="mt-4 space-y-3 text-sm"><div className="grid gap-3 border-b border-gray-700 pb-3 sm:grid-cols-2"><div><p className="text-gray-400">Project synopsis</p>{data.artifacts.synopsis_pdf_path ? <a href={`/api/ca3/artifacts/${teamId}/file?field=synopsis`} target="_blank" rel="noreferrer" className="mt-1 inline-block text-blue-300 hover:underline">View synopsis PDF</a> : <p className="mt-1 text-gray-500">Not provided</p>}</div><div><p className="text-gray-400">Design document</p>{data.artifacts.design_document_pdf_path ? <a href={`/api/ca3/artifacts/${teamId}/file?field=design_document`} target="_blank" rel="noreferrer" className="mt-1 inline-block text-blue-300 hover:underline">View design document PDF</a> : <p className="mt-1 text-gray-500">Not provided</p>}</div></div>{Object.entries(data.artifacts).filter(([key]) => !['id', 'team_id', 'status', 'evaluation_status', 'evaluated_at', 'evaluated_by', 'submitted_at', 'created_at', 'updated_at', 'synopsis', 'design_document_url', 'synopsis_pdf_path', 'design_document_pdf_path'].includes(key)).map(([key, value]) => <div key={key}><p className="capitalize text-gray-400">{key.replaceAll('_', ' ')}</p><p className="whitespace-pre-wrap break-words text-gray-200">{value || '—'}</p></div>)}</div>}</section>
    <section className="rounded-xl border border-gray-700 bg-gray-800 p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">Evaluation</h2><p className="mt-1 text-sm text-gray-400">Super Admin scores only. Saving scores does not change the artifact status.</p></div>{canTogglePresented && <button type="button" onClick={togglePresented} disabled={presenting || busy} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50">{presenting ? 'Updating…' : data.artifacts?.status === 'presented' ? 'Un Present' : 'Presented'}</button>}</div>{data.artifacts?.status === 'presented' && <p className="mt-4 rounded-lg bg-amber-900/40 px-3 py-2 text-sm text-amber-300">Presented: student artifact editing is locked. Use “Un Present” to return the project to Submitted.</p>}{!submitted && <p className="mt-4 text-amber-300">Scores can be entered after the team submits its artifacts.</p>}
      <div className="mt-5 rounded-lg border border-gray-700 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">GitHub contribution analysis</h3><p className="mt-1 text-xs text-gray-400">Commits 25% · active days 10% · changes 10% · PRs 10% · reviews/comments 10% · files owned 25% · authoring 10%</p></div><button type="button" onClick={analyzeGithub} disabled={!submitted || analyzing || busy} className="rounded-lg bg-indigo-700 px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50">{analyzing ? 'Analyzing GitHub…' : 'Analyze GitHub'}</button></div>{data.github_stats.length > 0 && <div className="mt-4 overflow-x-auto"><table className="w-full text-xs"><thead className="text-left text-gray-400"><tr><th className="pb-2">Member</th><th className="pb-2">Commits</th><th className="pb-2">Active days</th><th className="pb-2">Added lines</th><th className="pb-2">PRs</th><th className="pb-2">Reviews</th><th className="pb-2">Owned files</th><th className="pb-2">Suggested /5</th></tr></thead><tbody className="divide-y divide-gray-700">{data.github_stats.map(stat => { const member = data.members.find(item => item.student_id === stat.student_id); return <tr key={stat.student_id}><td className="py-2"><div>{member ? memberName(member) : 'Unknown member'}</div><div className="mt-0.5 text-gray-400">@{stat.github_username}</div></td><td className="py-2">{stat.commit_count}</td><td className="py-2">{stat.active_days}</td><td className="py-2">{stat.additions}</td><td className="py-2">{stat.prs_opened}</td><td className="py-2">{stat.prs_reviewed + stat.review_comments}</td><td className="py-2">{stat.files_owned}</td><td className="py-2 font-semibold">{data.individual.find(score => score.student_id === stat.student_id)?.system_score ?? '—'}</td></tr> })}</tbody></table></div>}</div>
    <div className="mt-5 space-y-5">{data.rubric.map(rubric => { const score = data.scores.find(item => item.category === rubric.category); const automated = rubric.mode === 'system-assisted'; return <div key={rubric.category} className="border-b border-gray-700 pb-5"><div className="mb-2 text-sm text-gray-200">{rubric.label}<span className="ml-2 text-xs text-gray-500">/{rubric.maxMarks} · {rubric.mode}</span></div><div className="grid items-start gap-3 md:grid-cols-[minmax(0,1fr)_8rem]"><textarea aria-label={`${rubric.label} evaluator notes`} value={notes[`${rubric.category}:notes`] ?? ''} onChange={event => setNotes(current => ({ ...current, [`${rubric.category}:notes`]: event.target.value }))} disabled={!submitted || busy} rows={2} placeholder="Evaluator notes" className="mt-0 min-h-20 w-full rounded border border-gray-600 bg-gray-900 px-2 py-1 text-sm" /><input aria-label={`${rubric.label} final score`} type="number" min="0" max={rubric.maxMarks} step="0.5" value={scores[rubric.category] ?? ''} onChange={event => updateProjectScore(rubric.category, event.target.value)} disabled={!submitted || busy} placeholder={`/${rubric.maxMarks}`} className="mt-0 h-10 w-full rounded border border-gray-600 bg-gray-900 px-2 py-1 text-sm" /></div>{automated && <div className="mt-3 rounded-lg border border-indigo-900 bg-indigo-950/30 p-3"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-indigo-300">AI suggested score</p><p className="mt-1 text-sm text-gray-300">{score?.system_score == null ? 'Not evaluated yet.' : `${score.system_score}/${rubric.maxMarks} · ${score.system_model ?? 'Groq'}`}</p></div><button type="button" onClick={() => evaluateCategory(rubric.category)} disabled={!submitted || busy || evaluatingCategory !== null} className="shrink-0 rounded-lg bg-indigo-700 px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50">{evaluatingCategory === rubric.category ? 'Evaluating…' : 'Evaluate with Groq'}</button></div><div className="mt-3 border-t border-indigo-900 pt-3"><p className="text-xs font-semibold uppercase tracking-wide text-indigo-300">Evaluation files</p><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">{data.artifacts?.synopsis_pdf_path ? <a href={`/api/ca3/artifacts/${teamId}/file?field=synopsis`} target="_blank" rel="noreferrer" className="text-blue-300 hover:underline">{fileName(data.artifacts.synopsis_pdf_path)}</a> : <span className="text-gray-500">Synopsis PDF unavailable</span>}{data.artifacts?.design_document_pdf_path ? <a href={`/api/ca3/artifacts/${teamId}/file?field=design_document`} target="_blank" rel="noreferrer" className="text-blue-300 hover:underline">{fileName(data.artifacts.design_document_pdf_path)}</a> : <span className="text-gray-500">Design document unavailable</span>}</div></div>{categoryErrors[rubric.category] && <p role="alert" className="mt-3 rounded border border-red-800 bg-red-950/40 px-3 py-2 text-sm text-red-300">{categoryErrors[rubric.category]}</p>}{score?.system_feedback && <details className="mt-3 text-xs text-gray-300"><summary className="cursor-pointer text-indigo-300">View AI evidence and feedback</summary><pre className="mt-2 whitespace-pre-wrap break-words rounded bg-gray-900 p-3">{(() => { try { const parsed = JSON.parse(score.system_feedback); return JSON.stringify(parsed, null, 2) } catch { return score.system_feedback } })()}</pre></details>}</div>}</div> })}</div>
      <div className="mt-6 flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">Individual contribution /{data.individual_max_marks}</h3><p className="mt-1 text-xs text-gray-400">The contribution score is used to allocate the awarded 21 marks from Multi-Agent Design, Design, and Documentation. The highest contribution in the team receives the full awarded amount; the remaining categories stay shared.</p></div><button type="button" onClick={resetContributions} disabled={!submitted || busy} className="rounded border border-gray-600 px-3 py-2 text-xs text-gray-300 hover:border-gray-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-50">Reset contributions</button></div>
      <div className="mt-3 space-y-2">{data.members.map(member => <label key={member.roster_prn} className="flex items-center justify-between gap-3 text-sm text-gray-300"><span>{memberName(member)}</span><input type="number" min="0" max={data.individual_max_marks} step="0.5" value={member.student_id ? individual[String(member.student_id)] ?? '' : ''} onChange={event => member.student_id && updateContribution(member.student_id, event.target.value)} disabled={!submitted || !member.student_id || busy} className="w-24 rounded border border-gray-600 bg-gray-900 px-2 py-1" /></label>)}</div>
      <div className="mt-8 rounded-lg border border-indigo-800 bg-indigo-950/20 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h3 className="font-semibold">Per-member score summary</h3><p className="mt-1 text-xs text-gray-400">Calculated marks are based on the category scores above. Total is editable for the Super Admin and is saved with the final results.</p></div>
          <button type="button" onClick={resetCalculatedTotals} disabled={!submitted || busy} className="rounded border border-gray-600 px-3 py-2 text-xs text-gray-300 hover:border-gray-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-50">Reset calculated totals</button>
          <p className="text-xs text-gray-400">Project maximum: {projectMax} · Member maximum: {memberMax} marks</p>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-[900px] w-full text-left text-xs">
            <thead className="border-b border-indigo-900 text-gray-400"><tr><th className="px-2 py-2">Member</th>{data.rubric.map(rubric => <th key={rubric.category} className="px-2 py-2">{rubric.label}<span className="block text-gray-500">/{rubric.maxMarks}</span></th>)}<th className="px-2 py-2">Contribution<span className="block text-gray-500">/{data.individual_max_marks}</span></th><th className="px-2 py-2">Total<span className="block text-gray-500">/{memberMax}</span></th></tr></thead>
            <tbody className="divide-y divide-indigo-900/70">{data.members.map(member => { const contribution = member.student_id ? Number(individual[String(member.student_id)] || 0) : 0; return <tr key={member.roster_prn}><td className="px-2 py-3 font-medium text-gray-200">{memberName(member)}</td>{data.rubric.map(rubric => <td key={rubric.category} className="px-2 py-3 text-gray-300">{member.student_id ? memberCategoryMarks(member, rubric.category).toFixed(2) : '—'}</td>)}<td className="px-2 py-3 text-gray-300">{member.student_id ? contribution : '—'}</td><td className="px-2 py-3"><div className="flex items-center gap-2"><input aria-label={`${memberName(member)} total score`} type="number" min="0" max={memberMax} step="0.5" value={member.student_id ? memberTotals[String(member.student_id)] ?? '' : ''} onChange={event => member.student_id && setMemberTotals(current => ({ ...current, [String(member.student_id)]: event.target.value }))} disabled={!submitted || !member.student_id || busy} className="w-24 rounded border border-gray-600 bg-gray-900 px-2 py-1 text-sm text-white" />{member.student_id && <button type="button" onClick={() => setMemberTotals(current => ({ ...current, [String(member.student_id)]: String(calculatedMemberTotal(member.student_id as number)) }))} disabled={!submitted || busy} className="rounded border border-gray-600 px-2 py-1 text-xs text-gray-300 hover:border-gray-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-50">Reset</button>}</div></td></tr> })}</tbody>
          </table>
        </div>
      </div>
      <div className="mt-6 rounded-lg border border-gray-700 bg-gray-900/40 p-4"><p className="text-xs uppercase tracking-wide text-gray-400">Team project total</p><p className="mt-1 text-2xl font-semibold text-white">{projectTotal}/{projectMax}</p></div>
      <label className="mt-5 block text-sm text-gray-200">Overall comments<textarea value={overallComments} onChange={event => setOverallComments(event.target.value)} disabled={!submitted || busy || data.artifacts?.status === 'evaluation_complete'} rows={4} placeholder="Add overall assessment comments…" className="mt-2 min-h-24 w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-sm" /></label><div className="mt-6 flex flex-wrap gap-3"><button type="button" onClick={() => void saveScores(false)} disabled={!submitted || busy || data.artifacts?.status === 'evaluation_complete'} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50">{busy ? 'Saving…' : 'Save Scores'}</button><button type="button" onClick={() => void saveScores(true)} disabled={!canCompleteEvaluation || busy} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50">{busy ? 'Saving…' : 'Evaluation Complete'}</button></div>
    </section>
    <section className="rounded-xl border border-gray-700 bg-gray-800 p-5"><h2 className="font-semibold">Results publication</h2><p className="mt-1 text-sm text-gray-400">Current status: {data.config?.results_published ? 'Published' : 'Not published'}</p><div className="mt-4 flex gap-3"><button type="button" onClick={() => publish(true)} className="btn-primary text-sm">Publish Results</button>{data.config?.results_published && <button type="button" onClick={() => publish(false)} className="btn-secondary text-sm">Unpublish</button>}</div></section>
  </div>
}
