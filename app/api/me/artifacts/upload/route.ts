import { NextRequest } from 'next/server'
import { badRequest, conflict, forbidden, ok, serverError, unauthorized } from '@/lib/api'
import { getSession } from '@/lib/session'
import { getApprovedStudentTeam, uploadArtifactPdf } from '@/lib/artifacts'

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session || session.type !== 'student') return unauthorized()
  const team = await getApprovedStudentTeam(session.id)
  if (!team) return forbidden('PDF uploads are available only for approved projects.')
  const form = await request.formData()
  const field = form.get('field')
  const file = form.get('file')
  if (field !== 'synopsis' && field !== 'design_document') return badRequest('Invalid PDF field.')
  if (!(file instanceof File)) return badRequest('A PDF file is required.')
  try {
    const path = await uploadArtifactPdf(team.team.id, field, file)
    return ok({ path })
  } catch (error) {
    if (error instanceof Error && error.message === 'ARTIFACTS_LOCKED') return conflict('artifacts_locked', 'Artifacts cannot be changed after final scoring.')
    if (error instanceof Error && error.message === 'PDF_ONLY') return badRequest('Only PDF documents are accepted.')
    if (error instanceof Error && error.message === 'FILE_TOO_LARGE') return badRequest('PDF files must be 10 MB or smaller.')
    console.error('Artifact PDF upload error:', error)
    return serverError('Could not upload the PDF document.')
  }
}
