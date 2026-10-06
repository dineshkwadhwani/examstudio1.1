import { NextRequest } from 'next/server'
import * as XLSX from 'xlsx'
import { db, audit } from '@/lib/db'
import { badRequest, ok, serverError, unauthorized } from '@/lib/api'
import { requireSA } from '@/lib/session'

async function getId(params: Promise<{ id: string }>) {
  const id = Number((await params).id)
  return Number.isInteger(id) && id > 0 ? id : null
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const staff = await requireSA()
    const cohortId = await getId(params)
    if (!cohortId) return badRequest('Invalid cohort ID.')
    const { data: cohort } = await db.from('ca1_assessment_cohorts').select('id').eq('id', cohortId).single()
    if (!cohort) return badRequest('Cohort not found.')
    const file = (await request.formData()).get('file')
    if (!(file instanceof File)) return badRequest('Upload an Excel file.')
    const workbook = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: 'buffer' })
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
    if (!firstSheet) return badRequest('The workbook has no worksheet.')
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: '' })
    if (!rows.length) return badRequest('The worksheet has no student rows.')
    const { data: students, error: studentError } = await db.from('ca1_students').select('id, name, prn, email')
    if (studentError) throw studentError
    const byEmail = new Map((students ?? []).map(student => [student.email.trim().toLowerCase(), student]))
    const byPrn = new Map((students ?? []).map(student => [student.prn.trim().toLowerCase(), student]))
    const matched = new Map<number, { cohort_id: number; student_id: number }>()
    let unmatched = 0
    for (const row of rows) {
      const values = new Map(Object.entries(row).map(([key, value]) => [key.trim().toLowerCase().replace(/\s+/g, '_'), String(value ?? '').trim()]))
      const email = values.get('email') ?? values.get('student_email') ?? ''
      const prn = values.get('prn') ?? values.get('student_prn') ?? values.get('prn_id') ?? ''
      const student = (email && byEmail.get(email.toLowerCase())) || (prn && byPrn.get(prn.toLowerCase()))
      if (!student) { unmatched += 1; continue }
      matched.set(student.id, { cohort_id: cohortId, student_id: student.id })
    }
    const records = [...matched.values()]
    if (records.length) {
      const { error } = await db.from('ca1_assessment_cohort_members').upsert(records, { onConflict: 'cohort_id,student_id', ignoreDuplicates: true })
      if (error) throw error
    }
    await audit(`staff:${staff.email}`, 'assessment_cohort_members_imported', `assessment_cohort:${cohortId}`, { matched: records.length, unmatched })
    return ok({ added: records.length, unmatched })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return unauthorized()
    return serverError('Could not import cohort students.')
  }
}
