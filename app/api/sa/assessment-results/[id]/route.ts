import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { badRequest, notFound, ok, serverError, unauthorized } from '@/lib/api'
import { requireSA } from '@/lib/session'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSA()
    const paperId = Number((await params).id)
    if (!Number.isInteger(paperId) || paperId < 1) return badRequest('Invalid paper ID.')
    const { data: paper, error: paperError } = await db.from('ca1_assessment_papers')
      .select('id, assessment_id, student_id, status, score, started_at, submitted_at, created_at, ca1_students(id, name, prn, email), ca1_assessments(id, name, total_marks, assessment_type)')
      .eq('id', paperId)
      .single()
    if (paperError || !paper) return notFound('Assessment paper not found.')
    const { data: questions, error: questionError } = await db.from('ca1_assessment_paper_questions')
      .select('id, question_order, selected_answer, answer_text, is_correct, marks_awarded, evaluation_feedback, ca1_assessment_questions(question_text, options, correct_answer, explanation, co, topic_number, topic_name, bloom_label)')
      .eq('paper_id', paperId)
      .order('question_order')
    if (questionError) throw questionError
    return ok({ paper, questions: questions ?? [] })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return unauthorized()
    return serverError('Could not load assessment result.')
  }
}
