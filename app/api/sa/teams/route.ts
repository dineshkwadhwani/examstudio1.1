import { NextRequest } from 'next/server'
import { db, audit } from '@/lib/db'
import { badRequest, conflict, err, forbidden, ok, serverError } from '@/lib/api'
import { requireSA } from '@/lib/session'

export async function GET() {
  try { await requireSA() } catch { return forbidden('Super Admin access required.') }
  const { data: teams, error } = await db.from('ca1_teams').select('id, name, project_name, status, rejection_reason, submitted_at, created_at, ca1_team_members!inner(roster_prn, ca1_roster!inner(name))').is('ca1_team_members.left_at', null).order('created_at', { ascending: false })
  if (error) return serverError('Could not load teams.')
  return ok(teams ?? [])
}

export async function POST(req: NextRequest) {
  let staff
  try { staff = await requireSA() } catch { return forbidden('Super Admin access required.') }
  let body: { action?: string; team_id?: number; reason?: string }
  try { body = await req.json() } catch { return badRequest('Invalid JSON body.') }
  if (!body.team_id || !Number.isSafeInteger(body.team_id)) return badRequest('Team ID is required.')
  const { data: team } = await db.from('ca1_teams').select('id, status').eq('id', body.team_id).single()
  if (!team) return err('not_found', 'Team not found.', 404)

  if (body.action === 'approve') {
    if (team.status !== 'pending_approval') return conflict('not_pending', 'Only submitted teams can be approved.')
    const { error } = await db.from('ca1_teams').update({ status: 'approved', reviewed_at: new Date().toISOString(), reviewed_by: staff.id, updated_at: new Date().toISOString() }).eq('id', team.id)
    if (error) return serverError('Could not approve the team.')
    await audit(`staff:${staff.id}`, 'team_approved', `team:${team.id}`)
    return ok({ message: 'Team approved.' })
  }

  if (body.action === 'reject') {
    const reason = body.reason?.trim()
    if (!reason) return badRequest('A rejection reason is required.')
    if (team.status !== 'pending_approval') return conflict('not_pending', 'Only submitted teams can be rejected.')
    const { error } = await db.from('ca1_teams').update({ status: 'rejected', rejection_reason: reason, reviewed_at: new Date().toISOString(), reviewed_by: staff.id, updated_at: new Date().toISOString() }).eq('id', team.id)
    if (error) return serverError('Could not reject the team.')
    await audit(`staff:${staff.id}`, 'team_rejected', `team:${team.id}`, { reason })
    return ok({ message: 'Team sent back to the students.' })
  }
  return badRequest('Unknown team action.')
}
