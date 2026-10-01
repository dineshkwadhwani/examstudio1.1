import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { forbidden, notFound, serverError } from '@/lib/api'
import { getSession } from '@/lib/session'

export async function GET(request: NextRequest, { params }: { params: Promise<{ teamId: string }> }) {
  const session = await getSession()
  if (!session) return forbidden('Authentication required.')
  const teamId = Number((await params).teamId)
  const field = new URL(request.url).searchParams.get('field')
  if (!Number.isSafeInteger(teamId) || !['synopsis', 'design_document'].includes(field ?? '')) return notFound('PDF not found.')

  if (session.type === 'student') {
    const { data: membership } = await db.from('ca1_team_members').select('team_id').eq('team_id', teamId).eq('student_id', session.id).is('left_at', null).maybeSingle()
    if (!membership) return forbidden('You do not have access to this project.')
  } else if (session.role !== 'sa') {
    return forbidden('Super Admin access required.')
  }

  const column = field === 'synopsis' ? 'synopsis_pdf_path' : 'design_document_pdf_path'
  const { data: artifact } = await db.from('ca1_project_artifacts').select(column).eq('team_id', teamId).maybeSingle()
  const path = (artifact as Record<string, unknown> | null)?.[column]
  if (!path || typeof path !== 'string') return notFound('PDF not found.')
  const { data, error } = await db.storage.from('ca3-artifacts').createSignedUrl(path, 60 * 60)
  if (error || !data?.signedUrl) return serverError('Could not create a PDF access link.')
  return Response.redirect(data.signedUrl)
}
