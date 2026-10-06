import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { serverError, unauthorized } from '@/lib/api'
import { requireSA } from '@/lib/session'

export async function GET() {
  try {
    await requireSA()
    const sheet = XLSX.utils.json_to_sheet([{ name: 'Student name', prn: 'Student PRN', email: 'student@example.edu' }])
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, sheet, 'Students')
    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' })
    return new NextResponse(buffer, { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="ca1-cohort-students-template.xlsx"' } })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return unauthorized()
    return serverError('Could not generate the cohort template.')
  }
}
