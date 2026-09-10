import { NextRequest } from 'next/server'
import { db, audit } from '@/lib/db'
import { ok, forbidden, badRequest } from '@/lib/api'
import { requireStaff } from '@/lib/session'

export async function GET() {
  try { await requireStaff() } catch { return forbidden() }

  const { data } = await db
    .from('ca1_flags')
    .select('*')
    .order('created_at', { ascending: false })

  return ok(data)
}

export async function POST(req: NextRequest) {
  let staff
  try { staff = await requireStaff() } catch { return forbidden() }

  let body: { flag_id?: number; resolution?: string }
  try { body = await req.json() } catch { return badRequest('Invalid JSON.') }

  const { flag_id, resolution } = body
  if (!flag_id) return badRequest('flag_id is required.')
  if (!resolution?.trim()) return badRequest('resolution is required.')

  await db.from('ca1_flags').update({
    resolved: true,
    resolution: resolution.trim(),
    resolved_by: staff.email,
    resolved_at: new Date().toISOString(),
  }).eq('id', flag_id)

  await audit(`staff:${staff.email}`, 'flag_resolved', `flag:${flag_id}`, { resolution })

  return ok({ message: 'Flag resolved.' })
}
