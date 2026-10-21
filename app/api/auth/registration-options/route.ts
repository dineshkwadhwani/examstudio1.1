import { db } from '@/lib/db'
import { ok, serverError } from '@/lib/api'

// This endpoint is intentionally public so unauthenticated students can see
// which exams are accepting new registrations before they create an account.
export async function GET() {
  const { data, error } = await db
    .from('ca1_exam_sessions')
    .select('id, label, created_at, ca1_exam_definitions!inner(id, code, title, course_code, total_marks, duration_minutes)')
    .eq('status', 'registration_open')
    .order('created_at', { ascending: false })

  if (error) return serverError('Could not load open exam registrations.')

  return ok({
    exams: (data ?? []).map(session => {
      const definition = Array.isArray(session.ca1_exam_definitions)
        ? session.ca1_exam_definitions[0]
        : session.ca1_exam_definitions

      return {
        session_id: session.id,
        label: session.label,
        code: definition?.code ?? 'Exam',
        title: definition?.title ?? session.label,
        course_code: definition?.course_code ?? null,
        total_marks: definition?.total_marks ?? null,
        duration_minutes: definition?.duration_minutes ?? null,
      }
    }),
  })
}
