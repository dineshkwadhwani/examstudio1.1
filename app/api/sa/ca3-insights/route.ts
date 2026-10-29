import { db } from '@/lib/db'
import { forbidden, ok, serverError } from '@/lib/api'
import { requireSA } from '@/lib/session'

const projectCategories = ['multi_agent_design', 'design', 'live_demo', 'presentation', 'documentation', 'code_review'] as const

function displayName(member: { ca1_roster?: { name?: string } | Array<{ name?: string }> | null; roster_prn?: string }) {
  return Array.isArray(member.ca1_roster) ? member.ca1_roster[0]?.name ?? member.roster_prn ?? 'Unknown student' : member.ca1_roster?.name ?? member.roster_prn ?? 'Unknown student'
}

export async function GET() {
  try { await requireSA() } catch { return forbidden('Super Admin access required.') }

  const [teamsResult, artifactsResult, membersResult, scoresResult, individualResult, githubResult] = await Promise.all([
    db.from('ca1_teams').select('id, name, project_name').order('name'),
    db.from('ca1_project_artifacts').select('team_id, status'),
    db.from('ca1_team_members').select('team_id, student_id, roster_prn, github_username, ca1_roster(name)').is('left_at', null),
    db.from('ca1_project_scores').select('team_id, category, final_score, system_score, system_evaluated_at'),
    db.from('ca1_project_individual_scores').select('team_id, student_id, final_score, system_score'),
    db.from('ca1_github_contribution_stats').select('team_id, student_id'),
  ])

  if (teamsResult.error || artifactsResult.error || membersResult.error || scoresResult.error || individualResult.error || githubResult.error) {
    console.error('Load CA3 insights error:', { teams: teamsResult.error, artifacts: artifactsResult.error, members: membersResult.error, scores: scoresResult.error, individual: individualResult.error, github: githubResult.error })
    return serverError('Could not load CA3 insights.')
  }

  const artifacts = new Map((artifactsResult.data ?? []).map(row => [row.team_id, row]))
  const membersByTeam = new Map<number, NonNullable<typeof membersResult.data>>()
  for (const member of membersResult.data ?? []) membersByTeam.set(member.team_id, [...(membersByTeam.get(member.team_id) ?? []), member])

  const scoresByTeam = new Map<number, Map<string, { evaluated: boolean; score: number | null }>>()
  for (const score of scoresResult.data ?? []) {
    const teamScores = scoresByTeam.get(score.team_id) ?? new Map<string, { evaluated: boolean; score: number | null }>()
    teamScores.set(score.category, { evaluated: score.final_score !== null || score.system_score !== null || score.system_evaluated_at !== null, score: score.final_score !== null ? Number(score.final_score) : score.system_score === null ? null : Number(score.system_score) })
    scoresByTeam.set(score.team_id, teamScores)
  }

  const individualByStudent = new Map<string, number | null>()
  for (const score of individualResult.data ?? []) individualByStudent.set(`${score.team_id}:${score.student_id}`, score.final_score !== null ? Number(score.final_score) : score.system_score === null ? null : Number(score.system_score))
  const analyzedGithub = new Set((githubResult.data ?? []).map(row => `${row.team_id}:${row.student_id}`))

  const projects = (teamsResult.data ?? []).map(team => {
    const artifact = artifacts.get(team.id)
    const teamScores = scoresByTeam.get(team.id) ?? new Map<string, { evaluated: boolean; score: number | null }>()
    const missingCategories = projectCategories.filter(category => !teamScores.get(category)?.evaluated)
    const evaluatedZeroCategories = projectCategories.filter(category => teamScores.get(category)?.evaluated === true && teamScores.get(category)?.score === 0)
    const projectNotEvaluated = missingCategories.length === projectCategories.length
    const studentIssues = (membersByTeam.get(team.id) ?? []).filter(member => member.student_id !== null).map(member => {
      const githubUsername = member.github_username?.trim() ?? ''
      const key = `${team.id}:${member.student_id}`
      const githubScore = individualByStudent.get(key)
      return { student_id: member.student_id as number, name: displayName(member), prn: member.roster_prn, github_username: githubUsername || null, github_score: githubScore ?? null, missing_github_username: githubUsername.length === 0, github_score_zero: githubUsername.length > 0 && analyzedGithub.has(key) && githubScore === 0 }
    }).filter(member => member.missing_github_username || member.github_score_zero)

    return { id: team.id, name: team.name, project_name: team.project_name, artifact_status: artifact?.status ?? 'not started', project_not_evaluated: projectNotEvaluated, partial_evaluation: !projectNotEvaluated && missingCategories.length > 0, missing_categories: missingCategories, evaluated_zero_categories: evaluatedZeroCategories, student_issues: studentIssues }
  }).filter(project => project.project_not_evaluated || project.partial_evaluation || project.evaluated_zero_categories.length > 0 || project.student_issues.length > 0)

  return ok({ projects, total_projects: teamsResult.data?.length ?? 0 })
}
