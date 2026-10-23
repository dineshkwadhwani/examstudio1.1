import { db } from '@/lib/db'
import { getSession } from '@/lib/session'
import { forbidden, notFound, ok, unauthorized } from '@/lib/api'
import { calculateMemberTotal } from '@/lib/ca3-scoring'

export async function GET() {
  const session = await getSession()
  if (!session || session.type !== 'student') return unauthorized()

  const { data: config } = await db.from('ca1_ca3_config').select('results_published').eq('id', true).maybeSingle()
  if (!config?.results_published) return forbidden('CA3 results have not been published yet.')

  const { data: membership } = await db.from('ca1_team_members').select('team_id').eq('student_id', session.id).is('left_at', null).maybeSingle()
  if (!membership) return notFound('You are not currently assigned to a team.')

  const { data: team } = await db.from('ca1_teams').select('id, name, status').eq('id', membership.team_id).eq('status', 'approved').maybeSingle()
  if (!team) return notFound('Your approved project could not be found.')

  const [{ data: scores }, { data: individual }, { data: teamMembers }] = await Promise.all([
    db.from('ca1_project_scores').select('category, max_marks, final_score, evaluator_notes').eq('team_id', team.id).order('category'),
    db.from('ca1_project_individual_scores').select('student_id, max_marks, final_score, student_total_override, evaluator_notes').eq('team_id', team.id).eq('student_id', session.id).maybeSingle(),
    db.from('ca1_project_individual_scores').select('student_id, final_score').eq('team_id', team.id),
  ])

  const rawSections = (scores ?? []).map(score => ({
    category: score.category,
    max_marks: Number(score.max_marks),
    marks: score.final_score === null ? null : Number(score.final_score),
  }))
  const contributionMarks = individual?.final_score == null ? null : Number(individual.final_score)
  const highestContribution = Math.max(0, ...(teamMembers ?? []).map(member => member.final_score == null ? 0 : Number(member.final_score)))
  const sections = rawSections.map(section => ({
    ...section,
    marks: section.marks === null ? null : calculateMemberTotal([section], contributionMarks, highestContribution),
  }))
  const calculatedTotal = calculateMemberTotal(sections, contributionMarks, highestContribution)
  const calculatedFinalTotal = calculatedTotal + (contributionMarks ?? 0)
  const total = individual?.student_total_override == null ? calculatedFinalTotal : Number(individual.student_total_override)

  return ok({
    team: { id: team.id, name: team.name },
    sections,
    individual: { max_marks: Number(individual?.max_marks ?? 5), marks: contributionMarks },
    total_marks: total,
    total_max_marks: sections.reduce((sum, score) => sum + score.max_marks, 0) + Number(individual?.max_marks ?? 5),
  })
}
