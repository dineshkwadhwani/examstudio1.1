import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { badRequest, ok, serverError, unauthorized } from '@/lib/api'
import { requireSA } from '@/lib/session'

export async function GET(request: NextRequest) {
  try {
    await requireSA()
    const url = new URL(request.url)
    const assessmentParam = url.searchParams.get('assessment_id')?.trim() || null
    const cohortParam = url.searchParams.get('cohort_id')?.trim() || null
    const assessmentId = assessmentParam ? Number(assessmentParam) : null
    const cohortId = cohortParam ? Number(cohortParam) : null
    const submittedDate = url.searchParams.get('submitted_date')?.trim() || null
    if (assessmentId !== null && (!Number.isInteger(assessmentId) || assessmentId < 1)) return badRequest('assessment_id is invalid.')
    if (cohortId !== null && (!Number.isInteger(cohortId) || cohortId < 1)) return badRequest('cohort_id is invalid.')
    let dateStart: string | null = null
    let dateEnd: string | null = null
    if (submittedDate) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(submittedDate)) return badRequest('submitted_date must use YYYY-MM-DD format.')
      // The results UI uses India time. Convert the selected local calendar
      // date to UTC before filtering the timestamptz column.
      const start = new Date(`${submittedDate}T00:00:00+05:30`)
      const end = new Date(`${submittedDate}T00:00:00+05:30`)
      end.setUTCDate(end.getUTCDate() + 1)
      if (Number.isNaN(start.getTime())) return badRequest('submitted_date is invalid.')
      dateStart = start.toISOString()
      dateEnd = end.toISOString()
    }
    let papersQuery = db.from('ca1_assessment_papers')
      .select('*, ca1_students(id, name, prn, email), ca1_assessments(name, total_marks), ca1_assessment_assignments(cohort_id, ca1_assessment_cohorts(name))')
      .order('submitted_at', { ascending: false })
    if (assessmentId !== null) papersQuery = papersQuery.eq('assessment_id', assessmentId)
    if (dateStart) papersQuery = papersQuery.gte('submitted_at', dateStart)
    if (dateEnd) papersQuery = papersQuery.lt('submitted_at', dateEnd)
    const { data: papers, error } = await papersQuery
    if (error) throw error
    const filtered = (papers ?? []).filter((paper: { ca1_assessment_assignments?: { cohort_id?: number | null } | null }) => !cohortId || paper.ca1_assessment_assignments?.cohort_id === cohortId)
    return ok({ results: filtered })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return unauthorized()
    return serverError('Could not load assessment results.')
  }
}
