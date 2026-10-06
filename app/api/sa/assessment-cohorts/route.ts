import { NextRequest } from 'next/server'
import { db, audit } from '@/lib/db'
import { badRequest, ok, serverError, unauthorized } from '@/lib/api'
import { requireSA } from '@/lib/session'

export async function GET() {
  try {
    await requireSA()
    const { data, error } = await db.from('ca1_assessment_cohorts').select('*').order('created_at', { ascending: false })
    if (error) throw error
    const ids = (data ?? []).map(cohort => cohort.id)
    const { data: members } = ids.length ? await db.from('ca1_assessment_cohort_members').select('cohort_id').in('cohort_id', ids) : { data: [] as { cohort_id: number }[] }
    const counts = new Map<number, number>()
    for (const member of members ?? []) counts.set(member.cohort_id, (counts.get(member.cohort_id) ?? 0) + 1)
    return ok({ cohorts: (data ?? []).map(cohort => ({ ...cohort, student_count: counts.get(cohort.id) ?? 0 })) })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return unauthorized()
    return serverError('Could not load assessment cohorts.')
  }
}

export async function POST(request: NextRequest) {
  try {
    const staff = await requireSA()
    const body = await request.json()
    const name = String(body.name ?? '').trim()
    if (!name) return badRequest('Cohort name is required.')
    const { data, error } = await db.from('ca1_assessment_cohorts').insert({ name, description: body.description || null, created_by_email: staff.email }).select().single()
    if (error) return badRequest(error.code === '23505' ? 'A cohort with this name already exists.' : error.message)
    await audit(`staff:${staff.email}`, 'assessment_cohort_created', `assessment_cohort:${data.id}`, { name })
    return ok({ cohort: data }, 201)
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return unauthorized()
    return serverError('Could not create assessment cohort.')
  }
}
