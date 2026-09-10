import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, forbidden, err } from '@/lib/api'
import { requireStaff } from '@/lib/session'

export async function GET(req: NextRequest) {
  try {
    await requireStaff()
  } catch {
    return forbidden()
  }

  const url = new URL(req.url)
  const studentId = url.searchParams.get('id')
  const search = url.searchParams.get('search')

  // ─── Single student detail ───────────────────────────────
  if (studentId) {
    const { data: student } = await db
      .from('ca1_students')
      .select('id, prn, name, email, phone, registered_at, last_login_at, must_change_password')
      .eq('id', studentId)
      .single()

    if (!student) return err('not_found', 'Student not found.', 404)

    const { data: apiKey } = await db
      .from('ca1_api_keys')
      .select('key_prefix, created_at, revoked')
      .eq('student_id', studentId)
      .single()

    const { data: paper } = await db
      .from('ca1_question_papers')
      .select('*')
      .eq('student_id', studentId)
      .single()

    const { data: mcqAssignments } = await db
      .from('ca1_mcq_assignments')
      .select(`
        slot_no, option_order, answered_key, answered_at,
        change_count, answer_history, is_correct,
        ca1_mcq_questions!inner(id, stem, options, correct_key, rationale,
          ca1_mcq_slots!inner(slot_no, concept, co_code, bloom_level, bloom_label))
      `)
      .eq('student_id', studentId)
      .order('slot_no')

    const { data: submissions } = await db
      .from('ca1_submissions')
      .select('*')
      .eq('student_id', studentId)
      .order('task_no')

    const { data: attempts } = await db
      .from('ca1_submission_attempts')
      .select('*')
      .eq('student_id', studentId)
      .order('submitted_at')

    const { data: flags } = await db
      .from('ca1_flags')
      .select('*')
      .contains('student_ids', [parseInt(studentId)])
      .order('created_at', { ascending: false })

    const { data: exceptions } = await db
      .from('ca1_exceptions')
      .select('*')
      .eq('student_id', studentId)
      .order('recorded_at', { ascending: false })

    const { data: auditLog } = await db
      .from('ca1_audit_log')
      .select('*')
      .or(`actor.eq.student:${student.prn},target.eq.student:${studentId}`)
      .order('at', { ascending: false })
      .limit(100)

    return ok({
      student,
      api_key: apiKey,
      paper,
      mcq_assignments: mcqAssignments,
      submissions,
      attempts,
      flags,
      exceptions,
      audit_log: auditLog,
    })
  }

  // ─── Student list ─────────────────────────────────────────
  let query = db
    .from('ca1_students')
    .select(`
      id, prn, name, email, phone, registered_at,
      ca1_api_keys(key_prefix),
      ca1_question_papers(first_fetched_at),
      ca1_submissions(task_no, verification_status, marks_awarded, override_marks),
      ca1_mcq_assignments(answered_key)
    `)

  if (search) {
    query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,prn.ilike.%${search}%`)
  }

  const { data: students } = await query.order('name')

  // Shape into list rows
  const rows = (students ?? []).map((s: Record<string, unknown>) => {
    const subs = (s.ca1_submissions as Array<Record<string, unknown>>) ?? []
    const taskMarks = (taskNo: number) => {
      const sub = subs.find(s => s.task_no === taskNo)
      if (!sub) return { status: null, marks: null }
      const marks = sub.override_marks !== null ? sub.override_marks : sub.marks_awarded
      return { status: sub.verification_status, marks }
    }
    const mcqAnswered = ((s.ca1_mcq_assignments as Array<Record<string, unknown>>) ?? [])
      .filter(a => a.answered_key !== null).length

    const t1 = taskMarks(1)
    const t2 = taskMarks(2)
    const t3 = taskMarks(3)
    const mcqMarks = (s.ca1_mcq_assignments as Array<Record<string, unknown>> ?? [])
      .filter(a => (a as Record<string, unknown>).is_correct).length * 0.5

    const totalMarks =
      mcqMarks +
      (typeof t1.marks === 'number' ? t1.marks : 0) +
      (typeof t2.marks === 'number' ? t2.marks : 0) +
      (typeof t3.marks === 'number' ? t3.marks : 0)

    return {
      id: s.id,
      prn: s.prn,
      name: s.name,
      email: s.email,
      phone: s.phone,
      registered_at: s.registered_at,
      has_key: !!(s.ca1_api_keys as Array<unknown>)?.length,
      mcq_answered: mcqAnswered,
      paper_fetched: !!(s.ca1_question_papers as Array<unknown>)?.length,
      task1_status: t1.status,
      task1_marks: t1.marks,
      task2_status: t2.status,
      task2_marks: t2.marks,
      task3_status: t3.status,
      task3_marks: t3.marks,
      total_marks: totalMarks,
    }
  })

  return ok(rows)
}
