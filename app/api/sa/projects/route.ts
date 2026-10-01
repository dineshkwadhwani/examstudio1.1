import { db } from '@/lib/db'
import { forbidden, ok, serverError } from '@/lib/api'
import { requireSA } from '@/lib/session'

export async function GET() {
  try { await requireSA() } catch { return forbidden('Super Admin access required.') }
  const { data, error } = await db.from('ca1_teams')
    .select('id, name, project_name, status, ca1_project_artifacts(status, submitted_at)')
    .order('created_at', { ascending: false })
  if (error) return serverError('Could not load projects.')
  return ok(data ?? [])
}
