import { forbidden, ok, serverError } from '@/lib/api'
import { getStudentExams } from '@/lib/student-exams'
import { getSession } from '@/lib/session'

export async function GET() {
  const session = await getSession()
  if (!session || session.type !== 'student') return forbidden()

  try {
    const exams = await getStudentExams(session.id)
    return ok({ count: exams.length })
  } catch {
    return serverError('Could not load your exam history.')
  }
}
