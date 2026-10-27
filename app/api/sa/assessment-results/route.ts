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
    const submittedDate = url.searchParams.get('submitted_date')?.trim() || null
    if (!Number.isInteger(assessmentId) || assessmentId < 1) return badRequest('assessment_id is required.')
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
    const { data: papers, error } = await db.from('ca1_assessment_papers')
      .select('*, ca1_students(id, name, prn, email), ca1_assessments(name, total_marks), ca1_assessment_assignments(cohort_id, ca1_assessment_cohorts(name))')
      .eq('assessment_id', assessmentId)
      .gte('submitted_at', dateStart ?? '0001-01-01T00:00:00.000Z')
      .lt('submitted_at', dateEnd ?? '9999-12-31T23:59:59.999Z')
      .order('submitted_at', { ascending: false })
    if (error) throw error
    const filtered = (papers ?? []).filter((paper: { ca1_assessment_assignments?: { cohort_id?: number | null } | null }) => !cohortId || paper.ca1_assessment_assignments?.cohort_id === cohortId)
    return ok({ results: filtered })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return unauthorized()
    return serverError('Could not load assessment results.')
  }
}
