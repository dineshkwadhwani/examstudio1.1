import { NextRequest } from 'next/server'
import { db, audit } from '@/lib/db'
import { badRequest, conflict, forbidden, notFound, ok, serverError } from '@/lib/api'
import { requireSA } from '@/lib/session'
import { CA3_RUBRIC, CA3_INDIVIDUAL_MAX_MARKS, rubricCategory } from '@/lib/ca3-rubric'
import { analyzeGithubTeam } from '@/lib/github-analysis'

function teamIdFrom(value: string) {
  const id = Number(value)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ teamId: string }> }) {
  let staff
  try { staff = await requireSA() } catch { return forbidden('Super Admin access required.') }
  const teamId = teamIdFrom((await params).teamId)
  if (!teamId) return notFound('Project not found.')
  const [{ data: team }, { data: artifacts }, { data: members }, { data: scores }, { data: individual }, { data: githubStats }, { data: config }] = await Promise.all([
    db.from('ca1_teams').select('id, name, project_name, project_description, status').eq('id', teamId).maybeSingle(),
    db.from('ca1_project_artifacts').select('*').eq('team_id', teamId).maybeSingle(),
    db.from('ca1_team_members').select('roster_prn, student_id, github_username, ca1_roster!inner(name)').eq('team_id', teamId).is('left_at', null).order('joined_at'),
    db.from('ca1_project_scores').select('*').eq('team_id', teamId),
    db.from('ca1_project_individual_scores').select('*').eq('team_id', teamId),
    db.from('ca1_github_contribution_stats').select('*').eq('team_id', teamId),
    db.from('ca1_ca3_config').select('results_published').eq('id', true).maybeSingle(),
  ])
  if (!team) return notFound('Project not found.')
  return ok({ team, artifacts, members: members ?? [], scores: scores ?? [], individual: individual ?? [], github_stats: githubStats ?? [], config, rubric: CA3_RUBRIC, individual_max_marks: CA3_INDIVIDUAL_MAX_MARKS, reviewer: staff.id })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ teamId: string }> }) {
  let staff
  try { staff = await requireSA() } catch { return forbidden('Super Admin access required.') }
  const teamId = teamIdFrom((await params).teamId)
  if (!teamId) return notFound('Project not found.')
  let body: { action?: string; scores?: Array<{ category?: string; final_score?: number | null; evaluator_notes?: string; override_reason?: string }>; individual?: Array<{ student_id?: number; final_score?: number | null; evaluator_notes?: string; override_reason?: string }> }
  try { body = await request.json() } catch { return badRequest('Invalid JSON body.') }

  if (body.action === 'analyze_github') {
    const { data: artifact } = await db.from('ca1_project_artifacts').select('status, github_repo_url').eq('team_id', teamId).maybeSingle()
    if (!artifact || artifact.status !== 'submitted') return conflict('not_submitted', 'The team must submit its artifacts before GitHub analysis.')
    if (!artifact.github_repo_url) return badRequest('The team has not provided a GitHub repository URL.')
    const { data: members } = await db.from('ca1_team_members').select('student_id, github_username').eq('team_id', teamId).is('left_at', null)
    const analyzable = (members ?? []).filter(member => member.student_id && member.github_username?.trim()).map(member => ({ student_id: member.student_id as number, github_username: member.github_username as string }))
    if (analyzable.length !== (members ?? []).length) return badRequest('Every registered team member must provide a GitHub username before analysis.')
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

  if (body.action === 'publish' || body.action === 'unpublish') {
    const published = body.action === 'publish'
    const { error } = await db.from('ca1_ca3_config').update({ results_published: published, published_at: published ? new Date().toISOString() : null, published_by: published ? staff.id : null }).eq('id', true)
    if (error) return serverError('Could not update publication status.')
    await audit(`staff:${staff.id}`, published ? 'ca3_results_published' : 'ca3_results_unpublished')
    return ok({ results_published: published })
  }

  if (body.action !== 'save_scores') return badRequest('Unknown evaluation action.')
  const { data: artifact } = await db.from('ca1_project_artifacts').select('status').eq('team_id', teamId).maybeSingle()
  if (!artifact || artifact.status !== 'submitted') return conflict('not_submitted', artifact?.status === 'locked' ? 'Final scores have already been saved for this project.' : 'The team has not submitted its project artifacts.')
  for (const score of body.scores ?? []) {
    const category = rubricCategory(score.category ?? '')
    if (!category) return badRequest('Invalid rubric category.')
    if (score.final_score != null && (!Number.isFinite(score.final_score) || score.final_score < 0 || score.final_score > category.maxMarks)) return badRequest(`Score for ${category.label} must be between 0 and ${category.maxMarks}.`)
    const { error } = await db.from('ca1_project_scores').upsert({ team_id: teamId, category: category.category, max_marks: category.maxMarks, final_score: score.final_score ?? null, evaluator_notes: score.evaluator_notes?.trim() || null, override_reason: score.override_reason?.trim() || null, scored_by: staff.id, scored_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: 'team_id,category' })
    if (error) return serverError('Could not save project scores.')
  }
  for (const score of body.individual ?? []) {
    if (!score.student_id || (score.final_score != null && (!Number.isFinite(score.final_score) || score.final_score < 0 || score.final_score > CA3_INDIVIDUAL_MAX_MARKS))) return badRequest('Invalid individual score.')
    const { error } = await db.from('ca1_project_individual_scores').upsert({ team_id: teamId, student_id: score.student_id, max_marks: CA3_INDIVIDUAL_MAX_MARKS, final_score: score.final_score ?? null, evaluator_notes: score.evaluator_notes?.trim() || null, override_reason: score.override_reason?.trim() || null, scored_by: staff.id, scored_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: 'team_id,student_id' })
    if (error) return serverError('Could not save individual scores.')
  }
  const { error: lockError } = await db.from('ca1_project_artifacts').update({ status: 'locked', updated_at: new Date().toISOString() }).eq('team_id', teamId)
  if (lockError) return serverError('Scores were saved, but artifacts could not be locked.')
  await audit(`staff:${staff.id}`, 'ca3_scores_saved', `team:${teamId}`)
  return ok({ message: 'Scores saved and artifacts locked.' })
}
