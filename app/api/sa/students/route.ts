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
  const sessionIdParam = url.searchParams.get('session_id')
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

    const { data: papers } = await db
      .from('ca1_question_papers')
      .select('*')
      .eq('student_id', studentId)
      .order('first_fetched_at', { ascending: false })

    const { data: mcqAssignments } = await db
      .from('ca1_mcq_assignments')
      .select(`
        slot_no, session_id, option_order, answered_key, answered_at,
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

    const sessionIds = [...new Set([
      ...(papers ?? []).map(paper => paper.session_id),
      ...(mcqAssignments ?? []).map(assignment => assignment.session_id),
      ...(submissions ?? []).map(submission => submission.session_id),
      ...(attempts ?? []).map(attempt => attempt.session_id),
    ].filter((value): value is number => typeof value === 'number'))]

    const { data: examSessions } = sessionIds.length > 0
      ? await db
        .from('ca1_exam_sessions')
        .select('id, label, status, started_at, ends_at, created_at, results_released_at, ca1_exam_definitions(code, title)')
        .in('id', sessionIds)
        .order('created_at', { ascending: false })
      : { data: [] }

    const sessions = (examSessions ?? []).map(session => {
      const sessionMcqs = (mcqAssignments ?? []).filter(assignment => assignment.session_id === session.id)
      const sessionSubs = (submissions ?? []).filter(submission => submission.session_id === session.id)
      const effectiveMarks = (taskNo: number) => {
        const submission = sessionSubs.find(item => item.task_no === taskNo)
        return submission ? (submission.override_marks ?? submission.marks_awarded) : null
      }
      const mcqAnswered = sessionMcqs.filter(assignment => assignment.answered_key !== null).length
      const mcqMarks = sessionMcqs.filter(assignment => assignment.is_correct).length * 0.5
      const taskMarks = [1, 2, 3].reduce((total, taskNo) => total + (effectiveMarks(taskNo) ?? 0), 0)

      return {
        id: session.id,
        label: session.label,
        status: session.status,
        started_at: session.started_at,
        ends_at: session.ends_at,
        created_at: session.created_at,
        results_released_at: session.results_released_at,
        exam: session.ca1_exam_definitions,
        paper_fetched: (papers ?? []).some(paper => paper.session_id === session.id),
        mcq_answered: mcqAnswered,
        mcq_total: 10,
        mcq_marks: mcqMarks,
        task1_marks: effectiveMarks(1),
        task2_marks: effectiveMarks(2),
        task3_marks: effectiveMarks(3),
        total_marks: mcqMarks + taskMarks,
      }
    })

    const selectedSessionId = sessionIdParam ? Number(sessionIdParam) : null
    if (sessionIdParam && (selectedSessionId === null || !Number.isSafeInteger(selectedSessionId))) {
      return err('not_found', 'Exam session not found for this student.', 404)
    }
    if (selectedSessionId !== null && !sessionIds.includes(selectedSessionId)) {
      return err('not_found', 'Exam session not found for this student.', 404)
    }

    if (selectedSessionId === null) {
      return ok({
        student,
        api_key: apiKey,
        sessions,
        selected_session_id: null,
      })
    }

    const paper = (papers ?? []).find(item => item.session_id === selectedSessionId) ?? null

    return ok({
      student,
      api_key: apiKey,
      paper,
      mcq_assignments: (mcqAssignments ?? []).filter(assignment => assignment.session_id === selectedSessionId),
      submissions: (submissions ?? []).filter(submission => submission.session_id === selectedSessionId),
      attempts: (attempts ?? []).filter(attempt => attempt.session_id === selectedSessionId),
      flags: (flags ?? []).filter(flag => flag.session_id === selectedSessionId),
      exceptions,
      audit_log: auditLog,
      sessions,
      selected_session_id: selectedSessionId,
    })
  }

  // ─── Student list ─────────────────────────────────────────
  let query = db
    .from('ca1_students')
    .select(`
      id, prn, name, email, phone, registered_at,
      ca1_api_keys(key_prefix),
      ca1_question_papers(first_fetched_at, session_id),
      ca1_submissions(task_no, verification_status, marks_awarded, override_marks, session_id),
      ca1_mcq_assignments(answered_key, is_correct, session_id)
    `)

  if (search) {
    query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,prn.ilike.%${search}%`)
  }

  const { data: students } = await query.order('name')

  const studentRows = (students ?? []).map((s: Record<string, unknown>) => {
    const subs = (s.ca1_submissions as Array<Record<string, unknown>>) ?? []
    const mcqs = (s.ca1_mcq_assignments as Array<Record<string, unknown>>) ?? []
    const papers = (s.ca1_question_papers as Array<Record<string, unknown>>) ?? []
    const sessionIds = [...new Set([
      ...subs.map(submission => submission.session_id),
      ...mcqs.map(assignment => assignment.session_id),
      ...papers.map(paper => paper.session_id),
    ].filter((value): value is number => typeof value === 'number'))]

    return { student: s, subs, mcqs, papers, sessionIds }
  })

  const allSessionIds = [...new Set(studentRows.flatMap(row => row.sessionIds))]
  const { data: sessions } = allSessionIds.length > 0
    ? await db
      .from('ca1_exam_sessions')
      .select('id, label, status, started_at, ends_at, created_at')
      .in('id', allSessionIds)
    : { data: [] }
  const sessionMap = new Map((sessions ?? []).map(session => [session.id, session]))

  // Shape into one row per student and exam session.
  const rows = studentRows.flatMap(({ student: s, subs, mcqs, papers, sessionIds }) => {
    const rowsForStudent = sessionIds.length > 0 ? sessionIds : [null]
    return rowsForStudent.map(sessionId => {
      const sessionSubs = subs.filter(submission => submission.session_id === sessionId)
      const sessionMcqs = mcqs.filter(assignment => assignment.session_id === sessionId)
      const taskMarks = (taskNo: number) => {
        const sub = sessionSubs.find(item => item.task_no === taskNo)
        if (!sub) return { status: null, marks: null }
        const rawMarks = sub.override_marks !== null ? sub.override_marks : sub.marks_awarded
        const marks = typeof rawMarks === 'number' ? rawMarks : null
        return { status: sub.verification_status, marks }
      }
      const t1 = taskMarks(1)
      const t2 = taskMarks(2)
      const t3 = taskMarks(3)
      const mcqAnswered = sessionMcqs.filter(assignment => assignment.answered_key !== null).length
      const mcqMarks = sessionMcqs.filter(assignment => assignment.is_correct).length * 0.5
      const totalMarks = mcqMarks + (t1.marks ?? 0) + (t2.marks ?? 0) + (t3.marks ?? 0)

      return {
      id: s.id,
      session_id: sessionId,
      session_label: sessionId === null ? null : sessionMap.get(sessionId)?.label ?? `Session ${sessionId}`,
      session_status: sessionId === null ? null : sessionMap.get(sessionId)?.status ?? null,
      prn: s.prn,
      name: s.name,
      email: s.email,
      phone: s.phone,
      registered_at: s.registered_at,
      has_key: !!(s.ca1_api_keys as Array<unknown>)?.length,
      mcq_answered: mcqAnswered,
      paper_fetched: papers.some(paper => paper.session_id === sessionId),
      task1_status: t1.status,
      task1_marks: t1.marks,
      task2_status: t2.status,
      task2_marks: t2.marks,
      task3_status: t3.status,
      task3_marks: t3.marks,
      total_marks: totalMarks,
      }
    })
  })

  return ok(rows)
}
