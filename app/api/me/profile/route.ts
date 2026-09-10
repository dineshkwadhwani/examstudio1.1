import { getSession } from '@/lib/session'
import { ok, forbidden, serverError } from '@/lib/api'
import { db } from '@/lib/db'

export async function GET() {
  const session = await getSession()
  if (!session || session.type !== 'student') return forbidden()

  const { data, error } = await db.from('ca1_students')
    .select('name, prn, email, phone, registered_at')
    .eq('id', session.id).single()
  if (error || !data) return serverError('Could not load your profile.')
  return ok(data)
}
