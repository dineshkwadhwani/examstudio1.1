import { ok, serverError, unauthorized } from '@/lib/api'
import { getSession } from '@/lib/session'
import { getStudentAssessmentPapers } from '@/lib/assessment'

export async function GET() {
  const session = await getSession()
  if (!session || session.type !== 'student') return unauthorized()
  try {
    return ok({ papers: await getStudentAssessmentPapers(session.id) })
  } catch {
    return serverError('Could not load assessments.')
  }
}
