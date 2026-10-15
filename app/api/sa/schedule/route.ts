import { db } from '@/lib/db'
import { forbidden, ok, serverError } from '@/lib/api'
import { requireSA } from '@/lib/session'

export async function GET() {
  try { await requireSA() } catch { return forbidden('Super Admin access required.') }

  const { data, error } = await db
    .from('ca1_teams')
    .select('id, name, project_name, status, ca1_project_artifacts(presentation_date)')
    .order('name', { ascending: true })

  if (error) return serverError('Could not load the presentation schedule.')

  return ok((data ?? []).map(team => {
    const artifact = Array.isArray(team.ca1_project_artifacts) ? team.ca1_project_artifacts[0] : team.ca1_project_artifacts
    return { id: team.id, name: team.name, project_name: team.project_name, status: team.status, presentation_date: artifact?.presentation_date ?? null }
  }))
}
