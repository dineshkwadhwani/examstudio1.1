import { NextRequest } from 'next/server'
import { db, audit } from '@/lib/db'
import { badRequest, conflict, err, forbidden, ok, serverError } from '@/lib/api'
import { requireSA } from '@/lib/session'

function csvCell(value: unknown) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

export async function GET(req: NextRequest) {
  try { await requireSA() } catch { return forbidden('Super Admin access required.') }
  if (new URL(req.url).searchParams.get('format') === 'csv') {
    const { data: teams, error: teamsError } = await db.from('ca1_teams')
      .select('id, name, project_name, project_description, status, rejection_reason, created_at, submitted_at')
      .order('created_at', { ascending: false })
    if (teamsError) return serverError('Could not export teams.')
    const { data: members, error: membersError } = await db.from('ca1_team_members')
      .select('team_id, roster_prn, ca1_roster!inner(name)')
      .is('left_at', null)
      .order('joined_at')
    if (membersError) return serverError('Could not export team members.')
    const membersByTeam = new Map<number, Array<{ roster_prn: string; ca1_roster: { name: string } }>>()
    for (const member of members ?? []) {
      const current = membersByTeam.get(member.team_id) ?? []
      const roster = Array.isArray(member.ca1_roster) ? member.ca1_roster[0] : member.ca1_roster
      current.push({ roster_prn: member.roster_prn, ca1_roster: { name: roster?.name ?? '' } })
      membersByTeam.set(member.team_id, current)
    }
    const header = ['Team ID', 'Team Name', 'Status', 'Project Name', 'Project Description', 'Rejection Reason', 'Member 1 Name', 'Member 1 PRN', 'Member 2 Name', 'Member 2 PRN', 'Member 3 Name', 'Member 3 PRN', 'Member 4 Name', 'Member 4 PRN']
    const rows = (teams ?? []).map(team => {
      const teamMembers = membersByTeam.get(team.id) ?? []
      return [team.id, team.name, team.status, team.project_name, team.project_description, team.rejection_reason, ...Array.from({ length: 4 }, (_, index) => [teamMembers[index]?.ca1_roster.name ?? '', teamMembers[index]?.roster_prn ?? '']).flat()]
    })
    const csv = [header, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n'
    return new Response(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="exam-studio-teams-${new Date().toISOString().slice(0, 10)}.csv"` } })
  }
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
