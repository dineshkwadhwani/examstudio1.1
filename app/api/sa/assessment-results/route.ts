import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { badRequest, ok, serverError, unauthorized } from '@/lib/api'
import { requireSA } from '@/lib/session'

export async function GET(request: NextRequest) {
  try {
    await requireSA()
    const url = new URL(request.url)
    const assessmentId = Number(url.searchParams.get('assessment_id'))
    const cohortId = url.searchParams.get('cohort_id') ? Number(url.searchParams.get('cohort_id')) : null
    if (!Number.isInteger(assessmentId) || assessmentId < 1) return badRequest('assessment_id is required.')
    const { data: papers, error } = await db.from('ca1_assessment_papers')
      .select('*, ca1_students(id, name, prn, email), ca1_assessments(name, total_marks), ca1_assessment_assignments(cohort_id, ca1_assessment_cohorts(name))')
      .eq('assessment_id', assessmentId)
      .order('submitted_at', { ascending: false })
    if (error) throw error
    const filtered = (papers ?? []).filter((paper: { ca1_assessment_assignments?: { cohort_id?: number | null } | null }) => !cohortId || paper.ca1_assessment_assignments?.cohort_id === cohortId)
    return ok({ results: filtered })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return unauthorized()
    return serverError('Could not load assessment results.')
  }
}
