import type { NextRequest } from 'next/server'
import { answerWriteError, checkTestOpen } from '@/lib/test-submission'
import { db, audit } from '@/lib/db'
import { ok, forbidden, err, serverError, getActiveSession } from '@/lib/api'
import { getSession } from '@/lib/session'
import { makeSeed, shuffleOptions, pickQuestion } from '@/lib/paper'

// GET /api/mcq — returns this student's assigned questions
export async function GET() {
  const session = await getSession()
  if (!session || session.type !== 'student') {
    return forbidden('Must be logged in as a student.')
  }

  const examSession = await getActiveSession()
  if (!examSession) {
    return err('exam_not_started', 'The exam has not started yet.', 403)
  }

  const testError = await checkTestOpen(session.id, examSession.id)
  if (testError) return testError

  // Get existing assignments
  const { data: assignments } = await db
    .from('ca1_mcq_assignments')
    .select(`
      slot_no, question_id, option_order,
      answered_key, answered_at, change_count, answer_history, is_correct,
      ca1_mcq_questions!inner(
        id, stem, options, correct_key,
        ca1_mcq_slots!inner(slot_no, concept, co_code, bloom_level, bloom_label)
      )
    `)
    .eq('student_id', session.id)
    .eq('session_id', examSession.id)
    .order('slot_no')

  if (assignments && assignments.length === 10) {
    return ok(formatAssignments(assignments, false))
  }

  // First visit — assign questions
  const { data: slots } = await db
    .from('ca1_mcq_slots')
    .select(`
      id, slot_no, concept, co_code, bloom_level, bloom_label,
      ca1_mcq_questions(id)
    `)
    .eq('exam_id', examSession.exam_id)
    .eq('ca1_mcq_questions.active', true)
    .order('slot_no')

  if (!slots || slots.length === 0) {
    return serverError('MCQ questions not configured.')
  }

  const seed = makeSeed(session.prn, examSession.id)
  const newAssignments = []

  for (const slot of slots) {
    const questionIds = (slot.ca1_mcq_questions as { id: number }[]).map(q => q.id)
    if (!questionIds.length) continue

    const questionId = pickQuestion(seed, slot.slot_no, questionIds)

    // Get the question options
    const { data: question } = await db
      .from('ca1_mcq_questions')
      .select('options')
      .eq('id', questionId)
      .single()

    if (!question) continue

    const options = question.options as { key: string; text: string }[]
    const optionOrder = shuffleOptions(options, seed, slot.slot_no)

    newAssignments.push({
      student_id: session.id,
      session_id: examSession.id,
      slot_no: slot.slot_no,
      question_id: questionId,
      option_order: optionOrder,
    })
  }

  if (newAssignments.length > 0) {
    await db.from('ca1_mcq_assignments').upsert(newAssignments, {
      onConflict: 'student_id,session_id,slot_no',
    })

    // Increment times_served
    const questionIds = newAssignments.map(a => a.question_id)
    for (const qid of questionIds) {
      db.rpc('increment_times_served', { qid }).then(() => null, () => null)
    }
  }

  // Re-fetch with full data
  const { data: freshAssignments } = await db
    .from('ca1_mcq_assignments')
    .select(`
      slot_no, question_id, option_order,
      answered_key, answered_at, change_count, answer_history, is_correct,
      ca1_mcq_questions!inner(
        id, stem, options,
        ca1_mcq_slots!inner(slot_no, concept, co_code, bloom_level, bloom_label)
      )
    `)
    .eq('student_id', session.id)
    .eq('session_id', examSession.id)
    .order('slot_no')

  return ok(formatAssignments(freshAssignments ?? [], false))
}

// POST /api/mcq — submit or change an answer
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || session.type !== 'student') {
    return forbidden('Must be logged in as a student.')
  }

  const examSession = await getActiveSession()
  if (!examSession) {
    return err('exam_not_started', 'The exam has not started or has ended.', 403)
  }

  const testError = await checkTestOpen(session.id, examSession.id)
  if (testError) return testError

  // Check time
  if (examSession.ends_at && new Date() > new Date(examSession.ends_at)) {
    return err('exam_ended', 'The exam has ended. No further answers accepted.', 403)
  }

  let body: { slot_no?: number; answer_key?: string }
  try {
    body = await req.json()
  } catch {
    return err('bad_request', 'Invalid JSON.', 400)
  }

  const { slot_no, answer_key } = body
  if (!slot_no || !answer_key) {
    return err('bad_request', 'slot_no and answer_key are required.', 400)
  }

  // Get assignment
  const { data: assignment } = await db
    .from('ca1_mcq_assignments')
    .select('id, question_id, option_order, answered_key, change_count, answer_history')
    .eq('student_id', session.id)
    .eq('session_id', examSession.id)
    .eq('slot_no', slot_no)
    .single()

  if (!assignment) {
    return err('not_found', 'MCQ assignment not found. Load your questions first.', 404)
  }

  // Validate answer_key is one of the displayed options
  if (!assignment.option_order.includes(answer_key)) {
    return err('bad_request', 'Invalid answer key.', 400)
  }

  // Get correct key
  const { data: question } = await db
    .from('ca1_mcq_questions')
    .select('correct_key')
    .eq('id', assignment.question_id)
    .single()

  if (!question) return serverError()

  const isCorrect = answer_key === question.correct_key
  const now = new Date().toISOString()

  const history = Array.isArray(assignment.answer_history)
    ? [...assignment.answer_history, { key: answer_key, at: now }]
    : [{ key: answer_key, at: now }]

  const { error: saveError } = await db.from('ca1_mcq_assignments').update({
    answered_key: answer_key,
    answered_at: now,
    first_answered_at: assignment.answered_key === null ? now : undefined,
    change_count: (assignment.change_count ?? 0) + (assignment.answered_key !== null ? 1 : 0),
    answer_history: history,
    is_correct: isCorrect,
  }).eq('id', assignment.id)
  if (saveError) return answerWriteError(saveError)

  // Update times_correct if this is a new correct answer
  if (isCorrect && assignment.answered_key !== question.correct_key) {
    db.rpc('increment_times_correct', { qid: assignment.question_id }).then(() => null, () => null)
  }

  await audit(
    `student:${session.prn}`,
    'mcq_answered',
    `slot:${slot_no}`,
    { answer_key, is_correct: isCorrect, changed: assignment.answered_key !== null }
  )

  return ok({
    slot_no,
    recorded: true,
    is_correct: null, // never reveal correct answer during exam
    answered_at: now,
  })
}

function formatAssignments(assignments: unknown[], showCorrect: boolean) {
  return (assignments as Record<string, unknown>[]).map(a => {
    const question = a.ca1_mcq_questions as Record<string, unknown>
    const slot = question?.ca1_mcq_slots as Record<string, unknown>
    const options = question?.options as { key: string; text: string }[]
    const optionOrder = a.option_order as string[]

    // Reorder options according to the shuffled order
    const displayOptions = optionOrder.map(key => options.find(o => o.key === key)!).filter(Boolean)

    return {
      slot_no: a.slot_no,
      concept: slot?.concept,
      co_code: slot?.co_code,
      bloom_level: slot?.bloom_level,
      bloom_label: slot?.bloom_label,
      stem: question?.stem,
      options: displayOptions.map(o => ({ key: o.key, text: o.text })),
      answered_key: a.answered_key,
      answered_at: a.answered_at,
      change_count: a.change_count,
      is_correct: showCorrect ? a.is_correct : null,
    }
  })
}
