import { db } from '@/lib/db'
import { getSession } from '@/lib/session'
import { forbidden, notFound, ok, unauthorized } from '@/lib/api'

export async function GET() {
  const session = await getSession()
  if (!session || session.type !== 'student') return unauthorized()

  const { data: config } = await db.from('ca1_ca3_config').select('results_published').eq('id', true).maybeSingle()
  if (!config?.results_published) return forbidden('CA3 results have not been published yet.')

  const { data: membership } = await db.from('ca1_team_members').select('team_id').eq('student_id', session.id).is('left_at', null).maybeSingle()
  if (!membership) return notFound('You are not currently assigned to a team.')

  const { data: team } = await db.from('ca1_teams').select('id, name, status').eq('id', membership.team_id).eq('status', 'approved').maybeSingle()
  if (!team) return notFound('Your approved project could not be found.')

  const [{ data: scores }, { data: individual }] = await Promise.all([
    db.from('ca1_project_scores').select('category, max_marks, final_score, evaluator_notes').eq('team_id', team.id).order('category'),
    db.from('ca1_project_individual_scores').select('student_id, max_marks, final_score, evaluator_notes').eq('team_id', team.id).eq('student_id', session.id).maybeSingle(),
  ])

  const sections = (scores ?? []).map(score => ({
    category: score.category,
    max_marks: Number(score.max_marks),
    marks: score.final_score === null ? null : Number(score.final_score),
  }))
  const individualMarks = individual?.final_score === null || individual?.final_score === undefined ? 0 : Number(individual.final_score)
  const total = sections.reduce((sum, score) => sum + (score.marks ?? 0), 0) + individualMarks

  return ok({
    team: { id: team.id, name: team.name },
    sections,
    individual: { max_marks: Number(individual?.max_marks ?? 5), marks: individual?.final_score == null ? null : Number(individual.final_score) },
    total_marks: total,
    total_max_marks: sections.reduce((sum, score) => sum + score.max_marks, 0) + Number(individual?.max_marks ?? 5),
  })
}
