import { db } from './db'

export interface StudentExam {
  id: number
  label: string
  status: string
  started_at: string | null
  ends_at: string | null
  created_at: string
  results_released_at: string | null
  ca1_exam_definitions: { code: string; title: string } | null
  registered_at?: string
}

export async function getStudentExams(studentId: number): Promise<StudentExam[]> {
  const { data: registrations, error: registrationError } = await db
    .from('ca1_exam_session_registrations')
    .select('session_id, registered_at')
    .eq('student_id', studentId)
    .order('registered_at', { ascending: false })
  if (registrationError) throw new Error('Could not load your exam history.')

  const registrationDates = new Map((registrations ?? []).map(row => [row.session_id, row.registered_at]))
  const participation = await Promise.all([
    'ca1_question_papers', 'ca1_mcq_assignments', 'ca1_submissions',
  ].map(async table => {
    const ids = new Set<number>()
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await db.from(table).select('session_id')
        .eq('student_id', studentId).order('id').range(offset, offset + 999)
      if (error) throw new Error('Could not load your exam history.')
      for (const row of data ?? []) if (row.session_id !== null) ids.add(row.session_id)
      if (!data || data.length < 1000) break
    }
    return [...ids]
  }))
  const ids = [...new Set([...(registrations ?? []).map(row => row.session_id), ...participation.flat()])]
  const exams: StudentExam[] = []
  for (let offset = 0; offset < ids.length; offset += 100) {
    const { data, error } = await db.from('ca1_exam_sessions')
      .select('id, label, status, started_at, ends_at, created_at, results_released_at, ca1_exam_definitions(code, title)')
      .in('id', ids.slice(offset, offset + 100))
    if (error) throw new Error('Could not load your exam history.')
    exams.push(...((data ?? []) as unknown as StudentExam[]).map(exam => ({
      ...exam,
      registered_at: registrationDates.get(exam.id),
    })))
  }
  const now = Date.now()
  for (const exam of exams) {
    if (exam.status === 'running' && exam.ends_at && Date.parse(exam.ends_at) <= now) {
      exam.status = 'closed'
    }
  }
  return exams.sort((a, b) => Date.parse(b.started_at ?? b.created_at) - Date.parse(a.started_at ?? a.created_at))
}
