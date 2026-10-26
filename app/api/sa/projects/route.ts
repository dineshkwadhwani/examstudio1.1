import { db } from '@/lib/db'
import { forbidden, ok, serverError } from '@/lib/api'
import { requireSA } from '@/lib/session'

export async function GET() {
  try { await requireSA() } catch { return forbidden('Super Admin access required.') }
  const { data, error } = await db.from('ca1_teams')
    .select('id, name, project_name, status, ca1_project_artifacts(status, evaluation_status, evaluated_at, submitted_at), ca1_project_scores(category, system_score, system_evaluated_at), ca1_project_individual_scores(student_id, system_score), ca1_team_members(student_id, left_at), ca1_github_contribution_stats(student_id, computed_at)')
    .order('created_at', { ascending: false })
  if (error) return serverError('Could not load projects.')
  return ok(data ?? [])
}
