import { NextRequest } from 'next/server'
import { badRequest, conflict, err, forbidden, ok, serverError } from '@/lib/api'
import { getSession } from '@/lib/session'
import { getApprovedStudentTeam, isPresentationDate, savePresentationDate } from '@/lib/artifacts'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || session.type !== 'student') return err('unauthorized', 'Authentication required.', 401)
  const team = await getApprovedStudentTeam(session.id)
  if (!team) return forbidden('Presentation dates are available only for approved projects.')

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return badRequest('Invalid JSON body.') }
  if (!isPresentationDate(body.presentation_date)) {
    return badRequest('Select one of the available presentation dates.')
  }

  try {
    await savePresentationDate(team.team.id, body.presentation_date, `student:${session.id}`)
    return ok({ message: 'Presentation date saved.', presentation_date: body.presentation_date })
  } catch (error) {
    if (error instanceof Error && error.message.includes('PRESENTATION_DATE_FULL')) {
      return conflict('presentation_date_full', 'No slots are available on that date. Please select another date.')
    }
    if (error instanceof Error && error.message === 'PROJECT_NOT_APPROVED') {
      return forbidden('Presentation dates are available only for approved projects.')
    }
    console.error('Save presentation date error:', error)
    return serverError('Could not save the presentation date.')
  }
}
