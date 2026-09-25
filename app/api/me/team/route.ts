import { NextRequest } from 'next/server'
import { db, audit } from '@/lib/db'
import { badRequest, conflict, err, forbidden, ok, serverError } from '@/lib/api'
import { getSession } from '@/lib/session'

type TeamStatus = 'draft' | 'pending_approval' | 'rejected' | 'approved'

async function studentContext() {
  const session = await getSession()
  if (!session || session.type !== 'student') return null
  const { data: student } = await db.from('ca1_students').select('id, prn, name').eq('id', session.id).single()
  return student
}

async function getTeam(studentId: number) {
  const { data: membership } = await db.from('ca1_team_members')
    .select('team_id').eq('student_id', studentId).is('left_at', null).maybeSingle()
  if (!membership) return null
  const { data: team, error } = await db.from('ca1_teams').select('*').eq('id', membership.team_id).single()
  if (error || !team) return null
  const { data: members } = await db.from('ca1_team_members')
    .select('id, roster_prn, student_id, joined_at, ca1_roster!inner(prn, name), ca1_students(email)')
    .eq('team_id', team.id).is('left_at', null).order('joined_at')
  return { ...team, members: members ?? [] }
}

function editable(status: TeamStatus) {
  return status === 'draft' || status === 'rejected'
}

export async function GET(req: NextRequest) {
  const student = await studentContext()
  if (!student) return forbidden()
  const url = new URL(req.url)
  const search = url.searchParams.get('search')?.trim()
  const team = await getTeam(student.id)

  if (!search) return ok({ team })
  const { data: roster, error } = await db.from('ca1_roster')
    .select('prn, name, ca1_students(id)')
    .or(`prn.ilike.%${search}%,name.ilike.%${search}%`)
    .order('name').limit(20)
  if (error) return serverError('Could not search the student roster.')

  const { data: reserved } = await db.from('ca1_team_members')
    .select('roster_prn, team_id').is('left_at', null).in('roster_prn', (roster ?? []).map(row => row.prn))
  const reservedMap = new Map((reserved ?? []).map(row => [row.roster_prn, row.team_id]))
  return ok({ team, students: (roster ?? []).map(row => ({
    prn: row.prn,
    name: row.name,
    registered: Array.isArray(row.ca1_students) ? row.ca1_students.length > 0 : !!row.ca1_students,
    reserved: reservedMap.has(row.prn),
    reserved_by_current_team: reservedMap.get(row.prn) === team?.id,
  })) })
}

export async function POST(req: NextRequest) {
  const student = await studentContext()
  if (!student) return forbidden()
  let body: { action?: string; team_id?: number; name?: string; project_name?: string; project_description?: string; prn?: string }
  try { body = await req.json() } catch { return badRequest('Invalid JSON body.') }
  const action = body.action

  if (action === 'create') {
    const name = body.name?.trim()
    if (!name) return badRequest('Team name is required.')
    if (await getTeam(student.id)) return conflict('already_in_team', 'You are already reserved in a team.')
    const { data: team, error } = await db.from('ca1_teams').insert({ name, created_by: student.id }).select().single()
    if (error || !team) {
      if (error?.code === '23505') return conflict('team_name_taken', 'A team with this name already exists.')
      return serverError('Could not create the team.')
    }
    const { error: memberError } = await db.from('ca1_team_members').insert({ team_id: team.id, roster_prn: student.prn, student_id: student.id })
    if (memberError) {
      await db.from('ca1_teams').delete().eq('id', team.id)
      if (memberError.code === '23505') return conflict('already_reserved', 'You are already reserved in another team.')
      return serverError('Could not reserve you in the team.')
    }
    await audit(`student:${student.prn}`, 'team_created', `team:${team.id}`)
    return ok(await getTeam(student.id), 201)
  }

  const team = await getTeam(student.id)
  if (!team) return err('no_team', 'You are not currently part of a team.', 404)
  if (body.team_id && Number(body.team_id) !== team.id) return forbidden('You cannot modify this team.')

  if (action === 'save') {
    if (!editable(team.status)) return conflict('team_locked', 'This team cannot be changed in its current status.')
    const name = body.name?.trim()
    if (!name) return badRequest('Team name is required.')
    const { error } = await db.from('ca1_teams').update({ name, updated_at: new Date().toISOString() }).eq('id', team.id)
    if (error?.code === '23505') return conflict('team_name_taken', 'A team with this name already exists.')
    if (error) return serverError('Could not save the team.')
    return ok(await getTeam(student.id))
  }

  if (action === 'add') {
    if (!editable(team.status)) return conflict('team_locked', 'Members cannot be changed after submission.')
    if (team.members.length >= 4) return badRequest('A team cannot have more than 4 members.')
    const prn = body.prn?.trim()
    if (!prn) return badRequest('Student PRN is required.')
    const { data: roster } = await db.from('ca1_roster').select('prn').eq('prn', prn).single()
    if (!roster) return badRequest('Student was not found in the roster.')
    const { data: activeReservation } = await db.from('ca1_team_members').select('team_id').eq('roster_prn', prn).is('left_at', null).maybeSingle()
    if (activeReservation) return conflict('already_reserved', 'This student is already reserved in another team.')
    const { data: registered } = await db.from('ca1_students').select('id').eq('prn', prn).maybeSingle()
    const { error } = await db.from('ca1_team_members').insert({ team_id: team.id, roster_prn: prn, student_id: registered?.id ?? null })
    if (error?.code === '23505') return conflict('already_reserved', 'This student is already reserved in another team.')
    if (error) return serverError('Could not add this student.')
    await db.from('ca1_teams').update({ updated_at: new Date().toISOString() }).eq('id', team.id)
    return ok(await getTeam(student.id))
  }

  if (action === 'remove' || action === 'leave') {
    if (!editable(team.status)) return conflict('team_locked', 'Members cannot leave after submission.')
    const prn = action === 'leave' ? student.prn : body.prn?.trim()
    if (!prn) return badRequest('Student PRN is required.')
    const { error } = await db.from('ca1_team_members').update({ left_at: new Date().toISOString() }).eq('team_id', team.id).eq('roster_prn', prn).is('left_at', null)
    if (error) return serverError('Could not release this team reservation.')
    const { count } = await db.from('ca1_team_members').select('id', { count: 'exact', head: true }).eq('team_id', team.id).is('left_at', null)
    if (!count) await db.from('ca1_teams').delete().eq('id', team.id)
    return ok(await getTeam(student.id))
  }

  if (action === 'submit') {
    if (!editable(team.status)) return conflict('team_locked', 'This team has already been submitted.')
    if (team.members.length < 3 || team.members.length > 4) return badRequest('A team must have 3 or 4 members before submission.')
    const projectName = body.project_name?.trim()
    const projectDescription = body.project_description?.trim()
    if (!projectName || !projectDescription) return badRequest('Project name and description are required for approval.')
    const { error } = await db.from('ca1_teams').update({ project_name: projectName, project_description: projectDescription, status: 'pending_approval', rejection_reason: null, submitted_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', team.id)
    if (error) return serverError('Could not submit the team for approval.')
    await audit(`student:${student.prn}`, 'team_submitted', `team:${team.id}`)
    return ok(await getTeam(student.id))
  }

  return badRequest('Unknown team action.')
}
