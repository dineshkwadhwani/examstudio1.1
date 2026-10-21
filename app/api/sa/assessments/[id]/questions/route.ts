import { NextRequest } from 'next/server'
import { db, audit } from '@/lib/db'
import { badRequest, ok, serverError, unauthorized } from '@/lib/api'
import { requireSA } from '@/lib/session'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const staff = await requireSA()
    const assessmentId = Number((await params).id)
    if (!Number.isInteger(assessmentId) || assessmentId < 1) return badRequest('Invalid assessment ID.')
    const { data: assessment } = await db.from('ca1_assessments').select('id, assessment_type').eq('id', assessmentId).single()
    if (!assessment) return badRequest('Assessment not found.')
    const body = await request.json()
    if (!Array.isArray(body.questions) || body.questions.length === 0) return badRequest('A non-empty questions array is required.')

    const rows = (body.questions as Array<Record<string, unknown>>).map((question, index: number) => {
      const options = question.options ?? {
        A: question.option_a ?? null,
        B: question.option_b ?? null,
        C: question.option_c ?? null,
        D: question.option_d ?? null,
      }
      return {
        assessment_id: assessmentId,
        co: question.co || null,
        topic_number: question.topic_number || null,
        topic_name: question.topic_name || null,
        bloom_level: question.bloom_level ? Number(question.bloom_level) : null,
        bloom_label: question.bloom_label || null,
        question_text: String(question.question_text ?? question.question ?? '').trim(),
        image_url: question.image_url || null,
        model_answer: question.model_answer || null,
        max_marks: question.max_marks == null ? null : Number(question.max_marks),
        options,
        correct_answer: question.correct_answer || null,
        explanation: question.explanation || null,
        question_order: index + 1,
      }
    })
    if (rows.some((row: { question_text: string }) => !row.question_text)) return badRequest('Every question must have question text.')
    if (assessment.assessment_type === 'mcq' && rows.some(row => !['A', 'B', 'C', 'D'].includes(String(row.correct_answer ?? '')))) {
      return badRequest('Every MCQ question must have a correct answer of A, B, C, or D.')
    }
    // Keep any question referenced by a submitted or historical paper. Those
    // rows are part of the student's permanent result record.
    const { data: existingQuestions } = await db.from('ca1_assessment_questions').select('id').eq('assessment_id', assessmentId)
    const existingIds = (existingQuestions ?? []).map(question => question.id)
    if (existingIds.length) {
      const { data: referenced } = await db.from('ca1_assessment_paper_questions').select('question_id').in('question_id', existingIds)
      const referencedIds = new Set((referenced ?? []).map(question => question.question_id))
      const removableIds = existingIds.filter(id => !referencedIds.has(id))
      if (removableIds.length) {
        const { error: deleteError } = await db.from('ca1_assessment_questions').delete().in('id', removableIds)
        if (deleteError) throw deleteError
      }
    }
    const { data, error } = await db.from('ca1_assessment_questions').insert(rows).select('id')
    if (error) throw error
    await audit(`staff:${staff.email}`, 'assessment_questions_replaced', `assessment:${assessmentId}`, { count: data?.length ?? 0 })
    return ok({ inserted: data?.length ?? 0 })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return unauthorized()
    return serverError(error instanceof Error ? error.message : 'Could not save questions.')
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const staff = await requireSA()
    const assessmentId = Number((await params).id)
    if (!Number.isInteger(assessmentId) || assessmentId < 1) return badRequest('Invalid assessment ID.')
    const { data: assessment } = await db.from('ca1_assessments').select('id, assessment_type').eq('id', assessmentId).single()
    if (!assessment) return badRequest('Assessment not found.')

    const body = await request.json() as Record<string, unknown>
    const questionId = Number(body.question_id)
    const questionText = String(body.question_text ?? '').trim()
    const options = body.options
    const correctAnswer = body.correct_answer == null ? null : String(body.correct_answer).trim().toUpperCase()
    if (!Number.isInteger(questionId) || questionId < 1) return badRequest('Invalid question ID.')
    if (!questionText) return badRequest('Question text is required.')
    if (!options || typeof options !== 'object' || Array.isArray(options)) return badRequest('Question options must be an object.')
    if (assessment.assessment_type === 'mcq' && !['A', 'B', 'C', 'D'].includes(correctAnswer ?? '')) return badRequest('MCQ questions require a correct answer of A, B, C, or D.')

    const { data: question } = await db.from('ca1_assessment_questions').select('id').eq('id', questionId).eq('assessment_id', assessmentId).single()
    if (!question) return badRequest('Question does not belong to this assessment.')

    const updates = {
      question_text: questionText,
      options,
      correct_answer: correctAnswer,
      explanation: body.explanation == null ? null : String(body.explanation),
      model_answer: body.model_answer == null ? null : String(body.model_answer),
      co: body.co == null ? null : String(body.co),
    }
    const { data, error } = await db.from('ca1_assessment_questions').update(updates).eq('id', questionId).eq('assessment_id', assessmentId).select().single()
    if (error) throw error
    await audit(`staff:${staff.email}`, 'assessment_question_updated', `assessment:${assessmentId}:question:${questionId}`)
    return ok({ question: data })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return unauthorized()
    return serverError(error instanceof Error ? error.message : 'Could not update question.')
  }
}
