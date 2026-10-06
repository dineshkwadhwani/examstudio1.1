import { db } from '@/lib/db'
import { forbidden, ok, serverError } from '@/lib/api'
import { requireSA } from '@/lib/session'

export async function GET() {
  try { await requireSA() } catch { return forbidden('Super Admin access required.') }

  const [{ data: teams, error: teamsError }, { data: artifacts, error: artifactsError }, { data: config, error: configError }] = await Promise.all([
    db.from('ca1_teams').select('status'),
    db.from('ca1_project_artifacts').select('status'),
    db.from('ca1_ca3_config').select('results_published').eq('id', true).maybeSingle(),
  ])

  if (teamsError || artifactsError || configError) return serverError('Could not load CA3 dashboard insights.')

  return ok({
    total_teams: teams?.length ?? 0,
    approved_teams: teams?.filter(team => team.status === 'approved').length ?? 0,
    pending_approval: teams?.filter(team => team.status === 'pending_approval').length ?? 0,
    rejected_teams: teams?.filter(team => team.status === 'rejected').length ?? 0,
    submitted_artifacts: artifacts?.filter(artifact => artifact.status === 'submitted').length ?? 0,
    locked_artifacts: artifacts?.filter(artifact => artifact.status === 'locked').length ?? 0,
    results_published: config?.results_published ?? false,
  })
}
