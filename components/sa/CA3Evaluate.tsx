'use client'

import { useEffect, useState } from 'react'

type Project = {
  id: number
  name: string
  project_name: string | null
  ca1_project_artifacts: { status: string }[] | { status: string } | null
  ca1_project_scores?: Array<{ category: string; system_score: number | null; system_evaluated_at: string | null }>
  ca1_project_individual_scores?: Array<{ student_id: number; system_score: number | null }>
  ca1_team_members?: Array<{ student_id: number | null; left_at: string | null }>
  ca1_github_contribution_stats?: Array<{ student_id: number; computed_at: string | null }>
}

type BatchKind = 'github' | 'multi_agent_design' | 'design' | 'documentation'
type StatusFilter = 'both' | 'submitted' | 'presented'

const GROQ_DELAY_MS = 90_000

const jobs: Array<{ kind: BatchKind; label: string; description: string }> = [
  { kind: 'github', label: 'Complete GitHub analysis', description: 'Analyze every submitted or presented team and populate individual contribution scores.' },
  { kind: 'multi_agent_design', label: 'Complete Multi-Agent Architecture & Agentic Design', description: 'Run the Groq evaluation for every submitted or presented team.' },
  { kind: 'design', label: 'Complete Design evaluations', description: 'Run the Groq evaluation for every submitted or presented team.' },
  { kind: 'documentation', label: 'Complete Documentation evaluations', description: 'Run the Groq evaluation for every submitted or presented team.' },
]

function sleep(milliseconds: number) {
  return new Promise(resolve => window.setTimeout(resolve, milliseconds))
}

function statusFor(project: Project) {
  const artifact = Array.isArray(project.ca1_project_artifacts) ? project.ca1_project_artifacts[0] : project.ca1_project_artifacts
  return artifact?.status ?? 'not started'
}

function isRateLimit(payload: Record<string, unknown>, response: Response) {
  const message = typeof payload.message === 'string' ? payload.message.toLowerCase() : ''
  return response.status === 429 || message.includes('429') || message.includes('rate limit') || payload.code === 'github_rate_limit'
}

function hasBeenEvaluated(project: Project, kind: BatchKind) {
  if (kind === 'github') {
    const memberIds = (project.ca1_team_members ?? []).filter(member => member.left_at === null && member.student_id !== null).map(member => member.student_id as number)
    const analyzedIds = new Set((project.ca1_github_contribution_stats ?? []).map(stat => stat.student_id))
    return memberIds.length > 0 && memberIds.every(studentId => analyzedIds.has(studentId))
  }
  return (project.ca1_project_scores ?? []).some(score => score.category === kind && (score.system_evaluated_at !== null || score.system_score !== null))
}

export default function CA3Evaluate() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState<BatchKind | null>(null)
  const [progress, setProgress] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [logs, setLogs] = useState<string[]>([])
  const [filters, setFilters] = useState<Record<BatchKind, { status: StatusFilter; reevaluate: boolean }>>({
    github: { status: 'both', reevaluate: false },
    multi_agent_design: { status: 'both', reevaluate: false },
    design: { status: 'both', reevaluate: false },
    documentation: { status: 'both', reevaluate: false },
  })

  function appendLog(entry: string) {
    setLogs(current => [...current, `[${new Date().toLocaleTimeString()}] ${entry}`])
  }

  async function loadProjects() {
    setLoading(true)
    try {
      const response = await fetch('/api/sa/projects', { cache: 'no-store' })
      const payload = await response.json().catch(() => [])
      if (!response.ok) throw new Error(payload?.message ?? 'Could not load CA3 projects.')
      setProjects(payload as Project[])
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load CA3 projects.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadProjects() }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  async function runOne(teamId: number, kind: BatchKind) {
    const action = kind === 'github' ? 'analyze_github' : 'analyze_category'
    const body = kind === 'github' ? { action } : { action, category: kind }
    const response = await fetch(`/api/sa/projects/${teamId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const payload = await response.json().catch(() => ({})) as Record<string, unknown>
    return { response, payload }
  }

  async function runBatch(kind: BatchKind) {
    if (running) return
    const filter = filters[kind]
    setRunning(kind)
    setMessage('')
    setError('')
    setLogs([])
    appendLog(`${jobs.find(job => job.kind === kind)?.label} started.`)
    const eligible = projects.filter(project => {
      const status = statusFor(project)
      const statusMatches = filter.status === 'both' ? ['submitted', 'presented'].includes(status) : status === filter.status
      return statusMatches && (filter.reevaluate || !hasBeenEvaluated(project, kind))
    })
    const statusEligible = projects.filter(project => {
      const status = statusFor(project)
      return filter.status === 'both' ? ['submitted', 'presented'].includes(status) : status === filter.status
    })
    if (eligible.length === 0) {
      const message = statusEligible.length === 0
        ? 'No teams match the selected artifact status.'
        : 'All teams matching the selected artifact status have already been evaluated. Enable Re Evaluate to run them again.'
      setMessage(message)
      appendLog(message)
      setRunning(null)
      return
    }
    appendLog(`${eligible.length} team(s) queued; ${statusEligible.length - eligible.length} already evaluated and skipped.`)

    let completed = 0
    let failed = 0
    let consecutiveFailures = 0
    let stoppedEarly = false
    const failures: string[] = []

    for (let index = 0; index < eligible.length; index += 1) {
      const project = eligible[index]
      let success = false
      let lastMessage = 'Unknown evaluation error.'
      let attempts = 0
      appendLog(`Analyzing ${project.name} (${index + 1}/${eligible.length})…`)

      while (!success && attempts < 3) {
        if (attempts > 0 || (kind !== 'github' && index > 0)) {
          const waitSeconds = Math.ceil(GROQ_DELAY_MS / 1000)
          appendLog(`Waiting ${waitSeconds} seconds before the next request for ${project.name}.`)
          setProgress(`${jobs.find(job => job.kind === kind)?.label}: waiting ${waitSeconds}s before the next request… (${index + 1}/${eligible.length})`)
          await sleep(GROQ_DELAY_MS)
        }
        attempts += 1
        setProgress(`${jobs.find(job => job.kind === kind)?.label}: ${project.name} (${index + 1}/${eligible.length}), attempt ${attempts}/3…`)
        try {
          const { response, payload } = await runOne(project.id, kind)
          if (response.ok) {
            success = true
            completed += 1
            consecutiveFailures = 0
            appendLog(`Completed ${project.name}.`)
          } else {
            lastMessage = typeof payload.message === 'string' ? payload.message : `HTTP ${response.status}`
            if (!isRateLimit(payload, response)) {
              appendLog(`Failed ${project.name}: ${lastMessage}`)
              break
            }
            appendLog(`Rate limit for ${project.name}. Retry ${attempts}/3 will wait 90 seconds.`)
          }
        } catch (caught) {
          lastMessage = caught instanceof Error ? caught.message : 'Could not reach the evaluation service.'
          appendLog(`Failed ${project.name}: ${lastMessage}`)
          break
        }
      }

      if (!success) {
        failed += 1
        consecutiveFailures += 1
        failures.push(`${project.name}: ${lastMessage}`)
        if (attempts >= 3 || consecutiveFailures >= 3) {
          stoppedEarly = true
          appendLog(`Stopped after three consecutive failures. Last failure: ${project.name}.`)
          setProgress('Stopped after three consecutive failures.')
          break
        }
      }
    }

    const stopped = stoppedEarly || consecutiveFailures >= 3
    const skipped = statusEligible.length - eligible.length
    setMessage(`${jobs.find(job => job.kind === kind)?.label} finished: ${completed} completed, ${failed} failed, ${skipped} skipped${stopped ? '; stopped after three consecutive failures' : ''}.`)
    appendLog(`Complete: ${completed} completed, ${failed} failed, ${skipped} skipped${stopped ? '; stopped after three consecutive failures' : ''}.`)
    if (failures.length > 0) setError(failures.slice(0, 3).join(' | '))
    setProgress('')
    setRunning(null)
    await loadProjects()
  }

  return <section className="rounded-xl border border-gray-700 bg-gray-800 p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold">Evaluate</h2>
        <p className="mt-1 text-sm text-gray-400">Batch evaluation runs only for teams whose artifacts are Submitted or Presented. Groq requests are separated by 90 seconds; a rate-limit failure is retried up to three times.</p>
      </div>
      <button type="button" onClick={() => void loadProjects()} disabled={loading || running !== null} className="btn-secondary text-sm disabled:opacity-50">Refresh teams</button>
    </div>
    <div className="mt-5 grid gap-3 md:grid-cols-2">
      {jobs.map(job => <div key={job.kind} className="rounded-lg border border-gray-700 bg-gray-900/40 p-4">
        <h3 className="font-semibold">{job.label}</h3>
        <p className="mt-1 min-h-10 text-sm text-gray-400">{job.description}</p>
        <fieldset className="mt-4">
          <legend className="text-xs font-semibold uppercase tracking-wide text-gray-400">Evaluate artifact status</legend>
          <div className="mt-2 flex flex-wrap gap-3 text-sm text-gray-300">
            {(['both', 'submitted', 'presented'] as const).map(status => <label key={status} className="flex items-center gap-1.5">
              <input type="radio" name={`${job.kind}-status`} checked={filters[job.kind].status === status} onChange={() => setFilters(current => ({ ...current, [job.kind]: { ...current[job.kind], status } }))} disabled={loading || running !== null} />
              {status === 'both' ? 'Both' : status.charAt(0).toUpperCase() + status.slice(1)}
            </label>)}
          </div>
        </fieldset>
        <label className="mt-3 flex items-center gap-2 text-sm text-gray-300">
          <input type="checkbox" checked={filters[job.kind].reevaluate} onChange={event => setFilters(current => ({ ...current, [job.kind]: { ...current[job.kind], reevaluate: event.target.checked } }))} disabled={loading || running !== null} />
          Re Evaluate
        </label>
        <button type="button" onClick={() => void runBatch(job.kind)} disabled={loading || running !== null} className="mt-4 rounded-lg bg-indigo-700 px-3 py-2 text-sm font-medium hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-50">
          {running === job.kind ? 'Running…' : 'Run for all teams'}
        </button>
      </div>)}
    </div>
    <p className="mt-4 text-sm text-gray-400">{loading ? 'Loading teams…' : `${projects.filter(project => ['submitted', 'presented'].includes(statusFor(project))).length} submitted/presented team(s) available.`}</p>
    {progress && <p role="status" className="mt-4 rounded-lg bg-indigo-950/40 px-4 py-3 text-sm text-indigo-200">{progress}</p>}
    {message && <p role="status" className="mt-4 rounded-lg bg-emerald-900/40 px-4 py-3 text-sm text-emerald-300">{message}</p>}
    {error && <p role="alert" className="mt-4 rounded-lg bg-red-900/40 px-4 py-3 text-sm text-red-300">{error}</p>}
    <section className="mt-5 rounded-lg border border-gray-700 bg-gray-950/50 p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold">Evaluation log</h3>
        {logs.length > 0 && <button type="button" onClick={() => setLogs([])} disabled={running !== null} className="text-xs text-gray-400 hover:text-white disabled:opacity-50">Clear log</button>}
      </div>
      <div aria-live="polite" className="mt-3 max-h-72 min-h-20 overflow-y-auto rounded border border-gray-800 bg-black/30 p-3 font-mono text-xs text-gray-300">
        {logs.length === 0 ? <p className="text-gray-500">Batch activity will appear here.</p> : logs.map((log, index) => <p key={`${index}-${log}`} className="py-0.5">{log}</p>)}
      </div>
    </section>
  </section>
}
