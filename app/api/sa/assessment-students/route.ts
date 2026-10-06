import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, serverError, unauthorized } from '@/lib/api'
import { requireSA } from '@/lib/session'

export async function GET(request: NextRequest) {
  try {
    await requireSA()
    const search = new URL(request.url).searchParams.get('search')?.trim().toLowerCase()
    const { data, error } = await db.from('ca1_students').select('id, name, prn, email, registered_at, ca1_assessment_cohort_members(cohort_id, ca1_assessment_cohorts(id, name)), ca1_assessment_papers(id, assessment_id, status, score, submitted_at)')
      .order('name')
    if (error) throw error
    const students = (data ?? []).filter(student => !search || [student.name, student.prn, student.email].some(value => value.toLowerCase().includes(search))).map(student => {
      const cohorts = (student.ca1_assessment_cohort_members ?? []).flatMap((member: { ca1_assessment_cohorts: { id: number; name: string }[] }) => member.ca1_assessment_cohorts ?? [])
      const papers = student.ca1_assessment_papers ?? []
      const completed = papers.filter(paper => paper.status === 'completed')
      const last = [...papers].sort((a, b) => String(b.submitted_at ?? '').localeCompare(String(a.submitted_at ?? '')))[0]
      return { id: student.id, name: student.name, prn: student.prn, email: student.email, registered_at: student.registered_at, cohorts, assessments_total: papers.length, assessments_completed: completed.length, last_activity: last?.submitted_at ?? null }
    })
    return ok({ students })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return unauthorized()
    return serverError('Could not load CA1 students.')
  }
}
