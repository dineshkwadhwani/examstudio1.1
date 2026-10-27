import { NextRequest } from 'next/server'
import { db, audit } from '@/lib/db'
import { badRequest, conflict, forbidden, notFound, ok, serverError } from '@/lib/api'
import { requireSA } from '@/lib/session'
import { CA3_RUBRIC, CA3_INDIVIDUAL_MAX_MARKS, rubricCategory } from '@/lib/ca3-rubric'

export const runtime = 'nodejs'

function teamIdFrom(value: string) {
  const id = Number(value)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

function databaseErrorCode(error: unknown) {
  if (!error || typeof error !== 'object') return ''
  const code = (error as { code?: unknown }).code
  return typeof code === 'string' && code ? ` (database error ${code})` : ''
}

function safeEvaluationDiagnostic(error: unknown) {
  const raw = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
  return raw
    .replace(/gsk_[A-Za-z0-9_-]+/g, '[redacted-key]')
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 240)
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ teamId: string }> }) {
  let staff
  try { staff = await requireSA() } catch { return forbidden('Super Admin access required.') }
  const teamId = teamIdFrom((await params).teamId)
  if (!teamId) return notFound('Project not found.')
  let teamResult
  let artifactsResult
  try {
    [teamResult, artifactsResult] = await Promise.all([
      db.from('ca1_teams').select('id, name, project_name, project_description, assessment_review_comments, status').eq('id', teamId).maybeSingle(),
      db.from('ca1_project_artifacts').select('*').eq('team_id', teamId).maybeSingle(),
    ])
  } catch (error) {
    console.error('Load SA project details error:', error)
    return serverError('Could not load project details.')
  }

  if (teamResult.error) {
    console.error('Load SA project team error:', teamResult.error)
    return serverError(`Could not load project details${databaseErrorCode(teamResult.error)}.`)
  }
  if (artifactsResult.error) {
    console.error('Load SA project artifacts error:', artifactsResult.error)
    return serverError(`Could not load project artifacts${databaseErrorCode(artifactsResult.error)}.`)
  }
  if (!teamResult.data) return notFound('Project not found.')

  let membersResult
  let scoresResult
  let individualResult
  let githubStatsResult
  let configResult
  try {
    [membersResult, scoresResult, individualResult, githubStatsResult, configResult] = await Promise.all([
      db.from('ca1_team_members').select('roster_prn, student_id, github_username, ca1_roster!inner(name)').eq('team_id', teamId).is('left_at', null).order('joined_at'),
      db.from('ca1_project_scores').select('*').eq('team_id', teamId),
      db.from('ca1_project_individual_scores').select('*').eq('team_id', teamId),
      db.from('ca1_github_contribution_stats').select('*').eq('team_id', teamId),
      db.from('ca1_ca3_config').select('results_published').eq('id', true).maybeSingle(),
    ])
  } catch (error) {
    console.error('Load optional SA project data error:', error)
    return ok({ team: teamResult.data, artifacts: artifactsResult.data, members: [], scores: [], individual: [], github_stats: [], config: null, rubric: CA3_RUBRIC, individual_max_marks: CA3_INDIVIDUAL_MAX_MARKS, reviewer: staff.id })
  }

  // Optional scoring/analytics tables should not prevent the Super Admin from
  // viewing the team and its saved artifact fields.
  if (membersResult.error) console.error('Load SA project members error:', membersResult.error)
  if (scoresResult.error) console.error('Load SA project scores error:', scoresResult.error)
  if (individualResult.error) console.error('Load SA project individual scores error:', individualResult.error)
  if (githubStatsResult.error) console.error('Load SA project GitHub stats error:', githubStatsResult.error)
  if (configResult.error) console.error('Load SA CA3 config error:', configResult.error)

  return ok({
    team: teamResult.data,
    artifacts: artifactsResult.data,
    members: membersResult.data ?? [],
    scores: scoresResult.data ?? [],
    individual: individualResult.data ?? [],
    github_stats: githubStatsResult.data ?? [],
    config: configResult.data,
    rubric: CA3_RUBRIC,
    individual_max_marks: CA3_INDIVIDUAL_MAX_MARKS,
    reviewer: staff.id,
  })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ teamId: string }> }) {
  let staff
  try { staff = await requireSA() } catch { return forbidden('Super Admin access required.') }
  const teamId = teamIdFrom((await params).teamId)
  if (!teamId) return notFound('Project not found.')
  let body: { action?: string; category?: string; overall_comments?: string; complete_evaluation?: boolean; scores?: Array<{ category?: string; final_score?: number | null; evaluator_notes?: string; override_reason?: string }>; individual?: Array<{ student_id?: number; final_score?: number | null; student_total_override?: number | null; evaluator_notes?: string; override_reason?: string }> }
  try { body = await request.json() } catch { return badRequest('Invalid JSON body.') }

  if (body.action === 'analyze_category') {
    const category = body.category
    if (category !== 'multi_agent_design' && category !== 'design' && category !== 'documentation' && category !== 'code_review') {
      return badRequest('Invalid automated evaluation category.')
    }
    try {
      const { evaluateCa3Category } = await import('@/lib/ca3-ai-evaluation')
      const result = await evaluateCa3Category(teamId, category)
      await audit(`staff:${staff.id}`, 'ca3_ai_category_evaluated', `team:${teamId}`, { category, score: result.score, model: result.model })
      return ok(result)
    } catch (error) {
      const debugId = crypto.randomUUID()
      if (error instanceof Error) {
        console.error('CA3 automated evaluation failed:', { debugId, teamId, category, name: error.name, message: error.message, stage: error.name === 'Ca3EvaluationError' ? (error as Error & { stage?: string }).stage : 'unknown', cause: error.cause })
      } else {
        console.error('CA3 automated evaluation failed:', { debugId, teamId, category, error })
      }
      if (error instanceof Error && error.message === 'NOT_SUBMITTED') return conflict('not_submitted', 'The team must submit its artifacts before automated evaluation.')
      if (error instanceof Error && error.message === 'GITHUB_URL_INVALID') return badRequest('The GitHub repository URL is invalid.')
      if (error instanceof Error && error.message === 'GITHUB_REPOSITORY_NOT_FOUND') return badRequest('The GitHub repository could not be found or is not accessible.')
      if (error instanceof Error && error.message === 'GROQ_API_KEY is not configured.') return serverError('Groq evaluation is not configured on the server.')
      if (error instanceof Error && /^GROQ_API_ERROR_\d+/.test(error.message)) {
        const [status, ...details] = error.message.replace('GROQ_API_ERROR_', '').split(': ')
        return serverError(`Groq evaluation failed (HTTP ${status})${details.length ? `: ${details.join(': ')}` : '.'}`)
      }
      if (error instanceof Error && ['GROQ_INVALID_JSON', 'GROQ_INVALID_SCORE'].includes(error.message)) return serverError(`Groq returned an invalid evaluation response (${error.message.replace('GROQ_', '').toLowerCase().replace('_', ' ')}). Please try again.`)
      if (error instanceof Error && error.message.startsWith('AI_SCORE_SAVE_FAILED_')) return serverError(`Groq returned a response, but the suggested score could not be saved (database error ${error.message.replace('AI_SCORE_SAVE_FAILED_', '')}). Apply migration 027_ca3_ai_evaluation_feedback.sql, then try again. Debug ID: ${debugId}`)
      if (error instanceof Error && error.message.includes('submitted PDF')) return serverError(error.message)
      if (error instanceof Error && error.name === 'Ca3EvaluationError') return serverError(`Automated evaluation failed during ${((error as Error & { stage?: string }).stage ?? 'unknown').replaceAll('_', ' ')}. Debug ID: ${debugId}`)
      return serverError(`Automated evaluation failed (${safeEvaluationDiagnostic(error)}). Debug ID: ${debugId}`)
    }
  }

  if (body.action === 'analyze_github') {
    let analyzeGithubTeam: typeof import('@/lib/github-analysis').analyzeGithubTeam
    try {
      ({ analyzeGithubTeam } = await import('@/lib/github-analysis'))
    } catch (error) {
      console.error('Load GitHub analysis module error:', error)
      return serverError('GitHub analysis is unavailable on the server.')
    }
    const { data: artifact, error: artifactError } = await db.from('ca1_project_artifacts').select('status, github_repo_url').eq('team_id', teamId).maybeSingle()
    if (artifactError) return serverError('Could not load the submitted project for GitHub analysis.')
    if (!artifact || !['submitted', 'presented'].includes(artifact.status)) return conflict('not_submitted', 'The team must submit its artifacts before GitHub analysis.')
    if (!artifact.github_repo_url) return badRequest('The team has not provided a GitHub repository URL.')
    const { data: members, error: membersError } = await db.from('ca1_team_members').select('student_id, github_username, ca1_roster(name)').eq('team_id', teamId).is('left_at', null)
    if (membersError) return serverError('Could not load the team members for GitHub analysis.')
    const memberName = (member: { ca1_roster?: { name?: string } | Array<{ name?: string }> | null; roster_prn?: string }) => Array.isArray(member.ca1_roster) ? member.ca1_roster[0]?.name ?? member.roster_prn ?? 'Unknown member' : member.ca1_roster?.name ?? member.roster_prn ?? 'Unknown member'
    const unregistered = (members ?? []).filter(member => !member.student_id)
    if (unregistered.length > 0) return badRequest(`The following active team members must register their student accounts before GitHub analysis: ${unregistered.map(memberName).join(', ')}.`)
    const missingGithub = (members ?? []).filter(member => !member.github_username?.trim())
    if (missingGithub.length > 0) return badRequest(`The following team members must provide a GitHub username before analysis: ${missingGithub.map(memberName).join(', ')}.`)
    const analyzable = (members ?? []).map(member => ({ student_id: member.student_id as number, github_username: member.github_username as string }))
    try {
      const result = await analyzeGithubTeam(teamId, artifact.github_repo_url, analyzable)
      await audit(`staff:${staff.id}`, 'ca3_github_analysis_completed', `team:${teamId}`, { repository: result.repository })
      return ok(result)
    } catch (error) {
      if (error instanceof Error && error.message === 'GITHUB_URL_INVALID') return badRequest('The GitHub repository URL is invalid.')
      if (error instanceof Error && error.message === 'GITHUB_REPOSITORY_NOT_FOUND') return badRequest('The GitHub repository could not be found or is not accessible with the configured token.')
      if (error instanceof Error && error.message === 'GITHUB_RATE_LIMIT') return conflict('github_rate_limit', 'GitHub API rate limit reached. Try again later.')
      console.error('GitHub analysis error:', error)
      return serverError('GitHub analysis failed.')
    }
  }

  if (body.action === 'toggle_presented') {
    const { data: artifact, error: artifactError } = await db.from('ca1_project_artifacts').select('status, submitted_at').eq('team_id', teamId).maybeSingle()
    if (artifactError) return serverError('Could not load the project artifact status.')
    const artifactStatus = artifact?.status ?? null
    if (artifactStatus === 'presented') {
      const { error } = await db.from('ca1_project_artifacts').update({ status: 'submitted', updated_at: new Date().toISOString() }).eq('team_id', teamId)
      if (error) return serverError('Could not return the project to Submitted.')
      await audit(`staff:${staff.id}`, 'ca3_project_unpresented', `team:${teamId}`)
      return ok({ status: 'submitted', message: 'Project returned to Submitted. Student artifacts can be updated again.' })
    }
    if (artifactStatus === 'evaluation_complete' || artifactStatus === 'locked') return conflict('invalid_artifact_status', 'This project is already finalised and cannot be returned to Presented.')

    // Make the submission state explicit before applying Presented. If the
    // second update fails, the project safely remains Submitted rather than
    // appearing Presented without a recorded submission timestamp.
    const submittedAt = artifact?.submitted_at ?? new Date().toISOString()
    const submitError = artifactStatus === null
      ? (await db.from('ca1_project_artifacts').insert({ team_id: teamId, status: 'submitted', submitted_at: submittedAt, updated_at: new Date().toISOString() })).error
      : (await db.from('ca1_project_artifacts').update({ status: 'submitted', submitted_at: submittedAt, updated_at: new Date().toISOString() }).eq('team_id', teamId)).error
    if (submitError) return serverError('Could not confirm the artifact submission.')
    const { error: presentError } = await db.from('ca1_project_artifacts').update({ status: 'presented', submitted_at: submittedAt, updated_at: new Date().toISOString() }).eq('team_id', teamId)
    if (presentError) return serverError('Artifacts were submitted, but could not be marked Presented.')
    await audit(`staff:${staff.id}`, 'ca3_project_presented', `team:${teamId}`, { submission_confirmed: true })
    return ok({ status: 'presented', message: 'Artifacts submitted and project marked Presented. Student artifact updates are locked.' })
  }

  if (body.action === 'publish' || body.action === 'unpublish') {
    const published = body.action === 'publish'
    const { error } = await db.from('ca1_ca3_config').update({ results_published: published, published_at: published ? new Date().toISOString() : null, published_by: published ? staff.id : null }).eq('id', true)
    if (error) return serverError('Could not update publication status.')
    await audit(`staff:${staff.id}`, published ? 'ca3_results_published' : 'ca3_results_unpublished')
    return ok({ results_published: published })
  }

  if (body.action !== 'save_scores') return badRequest('Unknown evaluation action.')
  const { data: artifact } = await db.from('ca1_project_artifacts').select('status').eq('team_id', teamId).maybeSingle()
  if (!artifact || !['submitted', 'presented', 'evaluation_complete', 'locked'].includes(artifact.status)) return conflict('not_submitted', 'The team has not submitted its project artifacts.')
  if (body.complete_evaluation && !['presented', 'evaluation_complete'].includes(artifact.status)) return conflict('invalid_evaluation_transition', 'Evaluation Complete is available only after the project is marked Presented.')
  for (const score of body.scores ?? []) {
    const category = rubricCategory(score.category ?? '')
    if (!category) return badRequest('Invalid rubric category.')
    if (score.final_score != null && (!Number.isFinite(score.final_score) || score.final_score < 0 || score.final_score > category.maxMarks)) return badRequest(`Score for ${category.label} must be between 0 and ${category.maxMarks}.`)
    const { error } = await db.from('ca1_project_scores').upsert({ team_id: teamId, category: category.category, max_marks: category.maxMarks, final_score: score.final_score ?? null, evaluator_notes: score.evaluator_notes?.trim() || null, override_reason: score.override_reason?.trim() || null, scored_by: staff.id, scored_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: 'team_id,category' })
    if (error) return serverError('Could not save project scores.')
  }
  for (const score of body.individual ?? []) {
    if (!score.student_id || (score.final_score != null && (!Number.isFinite(score.final_score) || score.final_score < 0 || score.final_score > CA3_INDIVIDUAL_MAX_MARKS)) || (score.student_total_override != null && (!Number.isFinite(score.student_total_override) || score.student_total_override < 0 || score.student_total_override > 45))) return badRequest('Invalid individual score or student total.')
    const { error } = await db.from('ca1_project_individual_scores').upsert({ team_id: teamId, student_id: score.student_id, max_marks: CA3_INDIVIDUAL_MAX_MARKS, final_score: score.final_score ?? null, student_total_override: score.student_total_override ?? null, evaluator_notes: score.evaluator_notes?.trim() || null, override_reason: score.override_reason?.trim() || null, scored_by: staff.id, scored_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: 'team_id,student_id' })
    if (error) {
      const debugId = crypto.randomUUID()
      console.error('Save CA3 individual score error:', { debugId, teamId, studentId: score.student_id, code: error.code, message: error.message, details: error.details, hint: error.hint })
      return serverError(`Could not save individual scores. Database error ${error.code ?? 'unknown'}: ${error.message}. Debug ID: ${debugId}`)
    }
  }
  if (body.overall_comments !== undefined) {
    const { error: reviewError } = await db.from('ca1_teams').update({ assessment_review_comments: body.overall_comments.trim() || null, updated_at: new Date().toISOString() }).eq('id', teamId)
    if (reviewError) return serverError('Scores were saved, but overall comments could not be saved.')
  }
  if (body.complete_evaluation) {
    const evaluatedAt = new Date().toISOString()
    const { data: completedArtifact, error: evaluationError } = await db.from('ca1_project_artifacts').update({ status: 'evaluation_complete', evaluation_status: 'evaluated', evaluated_at: evaluatedAt, evaluated_by: staff.id, updated_at: evaluatedAt }).eq('team_id', teamId).in('status', ['presented', 'evaluation_complete']).select('id, status').maybeSingle()
    if (evaluationError) {
      const debugId = crypto.randomUUID()
      console.error('Complete CA3 evaluation error:', { debugId, teamId, code: evaluationError.code, message: evaluationError.message, details: evaluationError.details, hint: evaluationError.hint })
      return serverError(`Scores were saved, but the evaluation could not be marked complete${databaseErrorCode(evaluationError)}. Debug ID: ${debugId}`)
    }
    if (!completedArtifact) return conflict('invalid_evaluation_transition', 'Evaluation Complete could not be applied because the project is no longer Presented.')
    await audit(`staff:${staff.id}`, 'ca3_evaluation_completed', `team:${teamId}`, { evaluated_at: evaluatedAt })
    return ok({ message: 'Scores saved and evaluation marked Evaluated.' })
  }
  await audit(`staff:${staff.id}`, 'ca3_scores_saved', `team:${teamId}`)
  return ok({ message: 'Scores saved successfully. Evaluation remains pending.' })
}
