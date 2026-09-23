import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { err, forbidden, ok } from '@/lib/api'
import { requireSA } from '@/lib/session'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { await requireSA() } catch { return forbidden('Super Admin access required.') }
  const { id } = await params
  const { data: team, error } = await db.from('ca1_teams').select('*').eq('id', id).single()
  if (error || !team) return err('not_found', 'Team not found.', 404)
  const { data: members } = await db.from('ca1_team_members').select('id, roster_prn, student_id, joined_at, ca1_roster!inner(prn, name), ca1_students(email)').eq('team_id', id).is('left_at', null).order('joined_at')
  return ok({ ...team, members: members ?? [] })
}
