import { NextRequest } from 'next/server'
import { db, audit } from '@/lib/db'
import { badRequest, notFound, ok, serverError, unauthorized } from '@/lib/api'
import { requireSA } from '@/lib/session'

async function idFrom(params: Promise<{ id: string }>) {
  const value = Number((await params).id)
  return Number.isInteger(value) && value > 0 ? value : null
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSA()
    const id = await idFrom(params)
    if (!id) return badRequest('Invalid assessment ID.')
    const { data, error } = await db.from('ca1_assessments').select('*').eq('id', id).single()
    if (error || !data) return notFound('Assessment not found.')
    const { data: questions } = await db.from('ca1_assessment_questions').select('*').eq('assessment_id', id).order('question_order')
    return ok({ assessment: data, questions: questions ?? [] })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return unauthorized()
    return serverError('Could not load assessment.')
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const staff = await requireSA()
    const id = await idFrom(params)
    if (!id) return badRequest('Invalid assessment ID.')
    const body = await request.json()
    const updates: Record<string, unknown> = {}
    for (const field of ['name', 'assessment_type', 'total_questions', 'total_time_seconds', 'time_per_question', 'marks_per_correct', 'total_marks', 'is_active']) {
      if (body[field] !== undefined) updates[field] = body[field]
    }
    if (typeof updates.name === 'string') updates.name = updates.name.trim()
    const { data, error } = await db.from('ca1_assessments').update(updates).eq('id', id).select().single()
    if (error || !data) return notFound('Assessment not found.')
    await audit(`staff:${staff.email}`, 'assessment_updated', `assessment:${id}`, updates)
    return ok({ assessment: data })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return unauthorized()
    return serverError('Could not update assessment.')
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const staff = await requireSA()
    const id = await idFrom(params)
    if (!id) return badRequest('Invalid assessment ID.')
    const { error } = await db.from('ca1_assessments').delete().eq('id', id)
    if (error) throw error
    await audit(`staff:${staff.email}`, 'assessment_deleted', `assessment:${id}`)
    return ok({ ok: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return unauthorized()
    return serverError('Could not delete assessment.')
  }
}
