import { NextRequest } from 'next/server'
import { audit, db } from '@/lib/db'
import { badRequest, conflict, forbidden, ok, serverError } from '@/lib/api'
import { requireStaff } from '@/lib/session'

export async function POST(req: NextRequest) {
  let staff
  try { staff = await requireStaff() } catch { return forbidden() }
  if (staff.role !== 'sa') return forbidden('Super Admin access required.')

  let body: { prn?: string; name?: string }
  try { body = await req.json() } catch { return badRequest('Invalid JSON.') }

  const prn = body.prn?.trim()
  const name = body.name?.trim()
  if (!prn) return badRequest('PRN is required.')
  if (!name) return badRequest('Student name is required.')

  const { data: existing } = await db
    .from('ca1_roster')
    .select('prn')
    .eq('prn', prn)
    .maybeSingle()
  if (existing) return conflict('prn_already_exists', 'This PRN is already in the roster.')

  const { error } = await db.from('ca1_roster').insert({ prn, name })
  if (error) return serverError('Could not add the student to the roster.')

  await audit(`staff:${staff.email}`, 'roster_student_added', `roster:${prn}`, { name })
  return ok({ message: `${name} was added. They can now register with this PRN.`, prn, name }, 201)
}
