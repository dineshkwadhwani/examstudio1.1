import { NextRequest } from 'next/server'
import { db, audit } from '@/lib/db'
import { badRequest, notFound, ok, serverError, unauthorized } from '@/lib/api'
import { requireSA } from '@/lib/session'

async function getId(params: Promise<{ id: string }>) {
  const id = Number((await params).id)
  return Number.isInteger(id) && id > 0 ? id : null
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSA()
    const id = await getId(params)
    if (!id) return badRequest('Invalid cohort ID.')
    const { data: cohort } = await db.from('ca1_assessment_cohorts').select('*').eq('id', id).single()
    if (!cohort) return notFound('Cohort not found.')
    const { data: members, error } = await db.from('ca1_assessment_cohort_members')
      .select('student_id, ca1_students(id, name, prn, email)')
      .eq('cohort_id', id)
    if (error) throw error
    return ok({ cohort, members: members ?? [] })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return unauthorized()
    return serverError('Could not load cohort.')
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const staff = await requireSA()
    const id = await getId(params)
    if (!id) return badRequest('Invalid cohort ID.')
    const { data: cohort } = await db.from('ca1_assessment_cohorts').select('id').eq('id', id).single()
    if (!cohort) return notFound('Cohort not found.')
    const body = await request.json()
    const studentIds = Array.isArray(body.student_ids) ? body.student_ids.map(Number).filter(Number.isInteger) : []
    if (!studentIds.length) return badRequest('At least one student is required.')
    const { data: students } = await db.from('ca1_students').select('id').in('id', studentIds)
    const validIds = (students ?? []).map(student => student.id)
    const { error } = await db.from('ca1_assessment_cohort_members').upsert(
      validIds.map(studentId => ({ cohort_id: id, student_id: studentId })),
      { onConflict: 'cohort_id,student_id', ignoreDuplicates: true },
    )
    if (error) throw error
    await audit(`staff:${staff.email}`, 'assessment_cohort_members_added', `assessment_cohort:${id}`, { student_ids: validIds })
    return ok({ added: validIds.length })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return unauthorized()
    return serverError('Could not update cohort members.')
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const staff = await requireSA()
    const id = await getId(params)
    if (!id) return badRequest('Invalid cohort ID.')
    const studentIdParam = new URL(request.url).searchParams.get('student_id')
    if (!studentIdParam) {
      const { error } = await db.from('ca1_assessment_cohorts').delete().eq('id', id)
      if (error) throw error
      await audit(`staff:${staff.email}`, 'assessment_cohort_deleted', `assessment_cohort:${id}`)
      return ok({ ok: true })
    }
    const studentId = Number(studentIdParam)
    if (!Number.isInteger(studentId) || studentId < 1) return badRequest('Invalid student ID.')
    const { error } = await db.from('ca1_assessment_cohort_members').delete().eq('cohort_id', id).eq('student_id', studentId)
    if (error) throw error
    await audit(`staff:${staff.email}`, 'assessment_cohort_member_removed', `assessment_cohort:${id}`, { student_id: studentId })
    return ok({ ok: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return unauthorized()
    return serverError('Could not remove student from cohort.')
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const staff = await requireSA()
    const id = await getId(params)
    if (!id) return badRequest('Invalid cohort ID.')
    const body = await request.json()
    const name = String(body.name ?? '').trim()
    if (!name) return badRequest('Cohort name is required.')
    const { data, error } = await db.from('ca1_assessment_cohorts').update({ name, description: body.description || null }).eq('id', id).select().single()
    if (error) return badRequest(error.code === '23505' ? 'A cohort with this name already exists.' : error.message)
    await audit(`staff:${staff.email}`, 'assessment_cohort_updated', `assessment_cohort:${id}`, { name })
    return ok({ cohort: data })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return unauthorized()
    return serverError('Could not update cohort.')
  }
}
