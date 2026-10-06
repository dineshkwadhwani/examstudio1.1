import { NextRequest } from 'next/server'
import { db, audit } from '@/lib/db'
import { badRequest, ok, serverError, unauthorized } from '@/lib/api'
import { requireSA } from '@/lib/session'
import { assessmentType } from '@/lib/assessment'

export async function GET() {
  try {
    const staff = await requireSA()
    const { data, error } = await db.from('ca1_assessments').select('*').order('created_at', { ascending: false })
    if (error) throw error
    const ids = (data ?? []).map(row => row.id)
    const { data: questions } = ids.length
      ? await db.from('ca1_assessment_questions').select('assessment_id').in('assessment_id', ids)
      : { data: [] as { assessment_id: number }[] }
    const counts = new Map<number, number>()
    for (const question of questions ?? []) counts.set(question.assessment_id, (counts.get(question.assessment_id) ?? 0) + 1)
    return ok({ assessments: (data ?? []).map(row => ({ ...row, question_count: counts.get(row.id) ?? 0 })), staff_id: staff.id })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return unauthorized()
    return serverError('Could not load assessments.')
  }
}

export async function POST(request: NextRequest) {
  try {
    const staff = await requireSA()
    const body = await request.json()
    const name = String(body.name ?? '').trim()
    const totalQuestions = Number(body.total_questions)
    const totalMarks = Number(body.total_marks)
    if (!name || !Number.isInteger(totalQuestions) || totalQuestions < 1 || !Number.isFinite(totalMarks)) {
      return badRequest('Name, total questions, and total marks are required.')
    }
    const { data, error } = await db.from('ca1_assessments').insert({
      name,
      assessment_type: assessmentType(body.assessment_type),
      total_questions: totalQuestions,
      total_time_seconds: body.total_time_seconds ? Number(body.total_time_seconds) : null,
      time_per_question: body.time_per_question ? Number(body.time_per_question) : null,
      marks_per_correct: Number(body.marks_per_correct ?? 1),
      total_marks: totalMarks,
      is_active: body.is_active === true,
      created_by_email: staff.email,
    }).select().single()
    if (error) throw error
    await audit(`staff:${staff.email}`, 'assessment_created', `assessment:${data.id}`, { name })
    return ok({ assessment: data }, 201)
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return unauthorized()
    return serverError('Could not create assessment.')
  }
}
