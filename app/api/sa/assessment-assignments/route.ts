import { NextRequest } from 'next/server'
import { db, audit } from '@/lib/db'
import { badRequest, ok, serverError, unauthorized } from '@/lib/api'
import { requireSA } from '@/lib/session'
import { createPaperForStudent } from '@/lib/assessment'

export async function GET() {
  try {
    await requireSA()
    const { data, error } = await db.from('ca1_assessment_assignments').select('*, ca1_assessments(name), ca1_assessment_cohorts(name)').order('assigned_at', { ascending: false })
    if (error) throw error
    return ok({ assignments: data ?? [] })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return unauthorized()
    return serverError('Could not load assessment assignments.')
  }
}

export async function POST(request: NextRequest) {
  try {
    const staff = await requireSA()
    const body = await request.json()
    const assessmentId = Number(body.assessment_id)
    const cohortId = body.cohort_id ? Number(body.cohort_id) : null
    const studentId = body.student_id ? Number(body.student_id) : null
    if (!Number.isInteger(assessmentId) || (!cohortId && !studentId)) return badRequest('Assessment and cohort or student are required.')

    const { data: assessment } = await db.from('ca1_assessments').select('id').eq('id', assessmentId).single()
    if (!assessment) return badRequest('Assessment not found.')
    if (cohortId) {
      const { data: cohort } = await db.from('ca1_assessment_cohorts').select('id').eq('id', cohortId).single()
      if (!cohort) return badRequest('Cohort not found.')
    }
    if (studentId) {
      const { data: student } = await db.from('ca1_students').select('id').eq('id', studentId).single()
      if (!student) return badRequest('Student not found.')
    }

    const { data: assignment, error } = await db.from('ca1_assessment_assignments').insert({
      assessment_id: assessmentId,
      cohort_id: cohortId,
      student_id: studentId,
      assigned_by_email: staff.email,
    }).select().single()
    if (error || !assignment) return badRequest(error?.message ?? 'Could not create assignment.')

    let studentIds: number[] = studentId ? [studentId] : []
    if (cohortId) {
      const { data: members } = await db.from('ca1_assessment_cohort_members').select('student_id').eq('cohort_id', cohortId)
      studentIds = (members ?? []).map(member => member.student_id)
    }
    for (const targetStudentId of studentIds) await createPaperForStudent(assessmentId, assignment.id, targetStudentId)
    await audit(`staff:${staff.email}`, 'assessment_assigned', `assessment:${assessmentId}`, { cohortId, studentId, students_assigned: studentIds.length })
    return ok({ assignment, students_assigned: studentIds.length }, 201)
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return unauthorized()
    return serverError(error instanceof Error ? error.message : 'Could not assign assessment.')
  }
}
