import { NextRequest } from 'next/server'
import { audit, db } from '@/lib/db'
import { badRequest, forbidden, ok, serverError } from '@/lib/api'
import { requireStaff } from '@/lib/session'

export async function DELETE(req: NextRequest) {
  let staff
  try { staff = await requireStaff() } catch { return forbidden() }
  if (staff.role !== 'sa') return forbidden('Super Admin access required.')

  let body: { student_ids?: unknown }
  try { body = await req.json() } catch { return badRequest('Invalid JSON.') }

  if (!Array.isArray(body.student_ids) || body.student_ids.length === 0) {
    return badRequest('Select at least one student.')
  }

  const studentIds = [...new Set(body.student_ids)]
  if (!studentIds.every(id => Number.isSafeInteger(id) && id > 0)) {
    return badRequest('student_ids must contain positive integer IDs.')
  }

  const { data, error } = await db
    .rpc('ca1_delete_students', { p_student_ids: studentIds })
    .single()

  if (error) return serverError('Could not delete the selected student data.')

  const deleted = (data as { deleted_count: number } | null)?.deleted_count ?? 0
  await audit(`staff:${staff.email}`, 'students_deleted', 'students', { count: deleted })

  return ok({ deleted, message: `${deleted} student account${deleted === 1 ? '' : 's'} deleted. Roster entries were kept.` })
}
