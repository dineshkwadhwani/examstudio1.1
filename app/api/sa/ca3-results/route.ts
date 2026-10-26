import { db } from '@/lib/db'
import { forbidden, ok, serverError } from '@/lib/api'
import { requireSA } from '@/lib/session'
import { calculateMemberCategoryMarks } from '@/lib/ca3-scoring'

const categories = ['multi_agent_design', 'design', 'live_demo', 'presentation', 'documentation', 'code_review'] as const

export async function GET() {
  try { await requireSA() } catch { return forbidden('Super Admin access required.') }

  const [studentsResult, membersResult, teamsResult, artifactsResult, scoresResult, individualResult] = await Promise.all([
    db.from('ca1_students').select('id, name, prn'),
    db.from('ca1_team_members').select('student_id, team_id, roster_prn').is('left_at', null),
    db.from('ca1_teams').select('id, name, status'),
    db.from('ca1_project_artifacts').select('team_id, status'),
    db.from('ca1_project_scores').select('team_id, category, final_score'),
    db.from('ca1_project_individual_scores').select('team_id, student_id, final_score, student_total_override'),
  ])

  if (studentsResult.error || membersResult.error || teamsResult.error || artifactsResult.error || scoresResult.error || individualResult.error) {
    return serverError('Could not load CA3 results.')
  }

  const teams = new Map((teamsResult.data ?? []).map(team => [team.id, team]))
  const projectStatusByTeam = new Map((artifactsResult.data ?? []).map(artifact => [artifact.team_id, artifact.status]))
  const teamByStudent = new Map<number, number>()
  for (const member of membersResult.data ?? []) {
    if (member.student_id !== null) teamByStudent.set(member.student_id, member.team_id)
  }

  const scoresByTeam = new Map<number, Map<string, number | null>>()
  for (const score of scoresResult.data ?? []) {
    const scores = scoresByTeam.get(score.team_id) ?? new Map<string, number | null>()
    scores.set(score.category, score.final_score === null ? null : Number(score.final_score))
    scoresByTeam.set(score.team_id, scores)
  }

  const individualsByStudent = new Map<number, { team_id: number; contribution: number | null; total_override: number | null }>()
  const highestContributionByTeam = new Map<number, number>()
  for (const score of individualResult.data ?? []) {
    const contribution = score.final_score === null ? null : Number(score.final_score)
    individualsByStudent.set(score.student_id, { team_id: score.team_id, contribution, total_override: score.student_total_override === null ? null : Number(score.student_total_override) })
    highestContributionByTeam.set(score.team_id, Math.max(highestContributionByTeam.get(score.team_id) ?? 0, contribution ?? 0))
  }

  const rows = (studentsResult.data ?? []).map(student => {
    const teamId = teamByStudent.get(student.id)
    const team = teamId === undefined ? null : teams.get(teamId) ?? null
    const teamScores = teamId === undefined ? new Map<string, number | null>() : scoresByTeam.get(teamId) ?? new Map<string, number | null>()
    const individual = individualsByStudent.get(student.id)
    const highestContribution = teamId === undefined ? 0 : highestContributionByTeam.get(teamId) ?? 0
    const contribution = individual?.contribution ?? null
    const areaScores = Object.fromEntries(categories.map(category => [category, teamId === undefined ? null : calculateMemberCategoryMarks(category, teamScores.get(category) ?? 0, contribution, highestContribution)]))
    const projectTotal = Object.values(areaScores).reduce<number>((total, score) => total + (score ?? 0), 0)
    const finalScore = individual?.total_override ?? (teamId === undefined || individual === undefined ? null : projectTotal + (contribution ?? 0))
    return { student_id: student.id, student_name: student.name, prn: student.prn, team_id: teamId ?? null, team_name: team?.name ?? null, project_status: teamId === undefined ? null : projectStatusByTeam.get(teamId) ?? null, scores: areaScores, contribution, final_score: finalScore }
  })

  rows.sort((a, b) => a.student_name.localeCompare(b.student_name, undefined, { sensitivity: 'base' }) || a.prn.localeCompare(b.prn))
  return ok({ categories, rows })
}
