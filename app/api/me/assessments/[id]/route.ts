import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { badRequest, forbidden, notFound, ok, serverError, unauthorized } from '@/lib/api'
import { evaluateSubjectivePaper, getAssessmentPaper } from '@/lib/assessment'
import { getSession } from '@/lib/session'

type AssessmentQuestionRow = { id: number; question: Record<string, unknown> | null }

async function getId(params: Promise<{ id: string }>) {
  const id = Number((await params).id)
  return Number.isInteger(id) && id > 0 ? id : null
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session || session.type !== 'student') return unauthorized()
  const id = await getId(params)
  if (!id) return badRequest('Invalid assessment paper ID.')
  try {
    const result = await getAssessmentPaper(id, session.id)
    if (!result) return notFound('Assessment paper not found.')
    const completed = result.paper.status === 'completed'
    return ok({
      paper: result.paper,
      questions: result.questions.map((row: AssessmentQuestionRow) => ({
        ...row,
        question: row.question ? {
          ...row.question,
          model_answer: undefined,
          correct_answer: completed ? row.question.correct_answer : undefined,
        } : null,
      })),
    })
  } catch {
    return serverError('Could not load assessment paper.')
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session || session.type !== 'student') return unauthorized()
  const id = await getId(params)
  if (!id) return badRequest('Invalid assessment paper ID.')
  const result = await getAssessmentPaper(id, session.id)
  if (!result) return forbidden()
  if (result.paper.status === 'completed') return badRequest('This assessment has already been submitted.')

  try {
    const body = await request.json()
    if (body.action === 'start') {
      const { data, error } = await db.from('ca1_assessment_papers')
        .update({ status: 'in_progress', started_at: result.paper.started_at ?? new Date().toISOString() })
        .eq('id', id).eq('student_id', session.id).select().single()
      if (error) throw error
      return ok({ paper: data })
    }

    if (body.action === 'answer') {
      const questionId = Number(body.paper_question_id)
      if (!Number.isInteger(questionId)) return badRequest('Invalid paper question ID.')
      const update = result.paper.assessment?.assessment_type !== 'mcq'
        ? { answer_text: String(body.answer_text ?? '') }
        : { selected_answer: body.selected_answer ?? null }
      const { error } = await db.from('ca1_assessment_paper_questions').update(update).eq('id', questionId).eq('paper_id', id)
      if (error) throw error
      return ok({ ok: true })
    }

    if (body.action === 'submit') {
      const assessment = result.paper.assessment
      if (!assessment) return serverError('Assessment configuration is missing.')
      const { data: rows, error } = await db.from('ca1_assessment_paper_questions')
        .select('id, selected_answer, answer_text, ca1_assessment_questions(correct_answer, max_marks)')
        .eq('paper_id', id)
      if (error) throw error
      let score = 0
      if (assessment.assessment_type !== 'mcq') {
        score = await evaluateSubjectivePaper(id)
        const { data: updated, error: updateError } = await db.from('ca1_assessment_papers').update({
          status: 'completed', submitted_at: new Date().toISOString(), score,
        }).eq('id', id).eq('student_id', session.id).select().single()
        if (updateError) throw updateError
        return ok({ paper: updated, score })
      }
      for (const row of rows ?? []) {
        const question = Array.isArray(row.ca1_assessment_questions) ? row.ca1_assessment_questions[0] : row.ca1_assessment_questions
        const correct = assessment.assessment_type === 'mcq' && row.selected_answer === question?.correct_answer
        const marks = correct ? Number(assessment.marks_per_correct ?? 0) : 0
        score += marks
        await db.from('ca1_assessment_paper_questions').update({
          is_correct: correct,
          marks_awarded: marks,
          evaluation_status: assessment.assessment_type === 'mcq' ? 'completed' : 'queued',
        }).eq('id', row.id)
      }
      const { data: updated, error: updateError } = await db.from('ca1_assessment_papers').update({
        status: 'completed', submitted_at: new Date().toISOString(), score,
      }).eq('id', id).eq('student_id', session.id).select().single()
      if (updateError) throw updateError
      return ok({ paper: updated, score })
    }
    return badRequest('Unknown assessment action.')
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Could not update assessment paper.')
  }
}
