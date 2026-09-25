import { NextRequest } from 'next/server'
import { db, audit } from '@/lib/db'
import { badRequest, conflict, err, forbidden, ok, serverError } from '@/lib/api'
import { requireSA } from '@/lib/session'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { await requireSA() } catch { return forbidden('Super Admin access required.') }
  const { id } = await params
  const { data: team, error } = await db.from('ca1_teams').select('*').eq('id', id).single()
  if (error || !team) return err('not_found', 'Team not found.', 404)
  const { data: members } = await db.from('ca1_team_members').select('id, roster_prn, student_id, joined_at, ca1_roster!inner(prn, name), ca1_students(email)').eq('team_id', id).is('left_at', null).order('joined_at')
  const search = new URL(req.url).searchParams.get('search')?.trim()
  if (!search) return ok({ ...team, members: members ?? [] })
  const { data: roster, error: rosterError } = await db.from('ca1_roster').select('prn, name, ca1_students(id)').or(`prn.ilike.%${search}%,name.ilike.%${search}%`).order('name').limit(20)
  if (rosterError) return serverError('Could not search the student roster.')
  const { data: reserved } = await db.from('ca1_team_members').select('roster_prn, team_id').is('left_at', null).in('roster_prn', (roster ?? []).map(row => row.prn))
  const reservedMap = new Map((reserved ?? []).map(row => [row.roster_prn, row.team_id]))
  return ok({ ...team, members: members ?? [], students: (roster ?? []).map(row => ({
    prn: row.prn,
    name: row.name,
    registered: Array.isArray(row.ca1_students) ? row.ca1_students.length > 0 : !!row.ca1_students,
    reserved: reservedMap.has(row.prn),
    reserved_by_this_team: reservedMap.get(row.prn) === team.id,
  })) })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let staff
  try { staff = await requireSA() } catch { return forbidden('Super Admin access required.') }
  const { id } = await params
  const teamId = Number(id)
  if (!Number.isSafeInteger(teamId)) return badRequest('Invalid team ID.')
  let body: { action?: string; name?: string; project_name?: string; project_description?: string; prn?: string }
  try { body = await req.json() } catch { return badRequest('Invalid JSON body.') }
  const { data: team } = await db.from('ca1_teams').select('id, name').eq('id', teamId).single()
  if (!team) return err('not_found', 'Team not found.', 404)

  if (body.action === 'save') {
    const name = body.name?.trim()
    if (!name) return badRequest('Team name is required.')
    const { error } = await db.from('ca1_teams').update({ name, project_name: body.project_name?.trim() || null, project_description: body.project_description?.trim() || null, updated_at: new Date().toISOString() }).eq('id', teamId)
    if (error?.code === '23505') return conflict('team_name_taken', 'A team with this name already exists.')
    if (error) return serverError('Could not save the team.')
    await audit(`staff:${staff.id}`, 'team_edited', `team:${teamId}`)
    return ok({ message: 'Team details saved.' })
  }

  if (body.action === 'add') {
    const prn = body.prn?.trim()
    if (!prn) return badRequest('Student PRN is required.')
    const { count } = await db.from('ca1_team_members').select('id', { count: 'exact', head: true }).eq('team_id', teamId).is('left_at', null)
    if ((count ?? 0) >= 4) return badRequest('A team cannot have more than 4 members.')
    const { data: roster } = await db.from('ca1_roster').select('prn').eq('prn', prn).single()
    if (!roster) return badRequest('Student was not found in the roster.')
    const { data: activeReservation } = await db.from('ca1_team_members').select('team_id').eq('roster_prn', prn).is('left_at', null).maybeSingle()
    if (activeReservation) return conflict('already_reserved', 'This student is already reserved in another team.')
    const { data: registered } = await db.from('ca1_students').select('id').eq('prn', prn).maybeSingle()
    const { error } = await db.from('ca1_team_members').insert({ team_id: teamId, roster_prn: prn, student_id: registered?.id ?? null })
    if (error?.code === '23505') return conflict('already_reserved', 'This student is already reserved in another team.')
    if (error) return serverError('Could not add this student.')
    await audit(`staff:${staff.id}`, 'team_member_added', `team:${teamId}`, { prn })
    return ok({ message: 'Member added.' })
  }

  if (body.action === 'remove') {
    const prn = body.prn?.trim()
    if (!prn) return badRequest('Student PRN is required.')
    const { error } = await db.from('ca1_team_members').update({ left_at: new Date().toISOString() }).eq('team_id', teamId).eq('roster_prn', prn).is('left_at', null)
    if (error) return serverError('Could not remove this member.')
    await audit(`staff:${staff.id}`, 'team_member_removed', `team:${teamId}`, { prn })
    return ok({ message: 'Member removed.' })
  }
  return badRequest('Unknown team edit action.')
}
