import { NextRequest } from 'next/server'
import { badRequest, conflict, err, forbidden, ok, serverError } from '@/lib/api'
import { getSession } from '@/lib/session'
import { getApprovedStudentTeam, submitTeamArtifacts } from '@/lib/artifacts'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || session.type !== 'student') return forbidden()
  const team = await getApprovedStudentTeam(session.id)
  if (!team) return err('not_found', 'Artifacts are available only for approved projects.', 404)
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return badRequest('Invalid JSON body.') }
  const data = {
    synopsis_pdf_path: typeof body.synopsis_pdf_path === 'string' ? body.synopsis_pdf_path : undefined,
    design_document_pdf_path: typeof body.design_document_pdf_path === 'string' ? body.design_document_pdf_path : undefined,
    input_definition: typeof body.input_definition === 'string' ? body.input_definition : undefined,
    output_definition: typeof body.output_definition === 'string' ? body.output_definition : undefined,
    github_repo_url: typeof body.github_repo_url === 'string' ? body.github_repo_url : undefined,
    project_url: typeof body.project_url === 'string' ? body.project_url : undefined,
    execution_trace: typeof body.execution_trace === 'string' ? body.execution_trace : undefined,
    demo_video_url: typeof body.demo_video_url === 'string' ? body.demo_video_url : undefined,
    members: Array.isArray(body.members) ? body.members.filter((member): member is { prn: string; github_username: string } => typeof member === 'object' && member !== null && typeof (member as Record<string, unknown>).prn === 'string' && typeof (member as Record<string, unknown>).github_username === 'string') : undefined,
  }
  try {
    const result = await submitTeamArtifacts(team.team.id, data, `student:${session.id}`)
    if (result.errors.length > 0) return badRequest(result.errors.map(error => error.message).join(' '))
    return ok({ message: 'Artifacts submitted. Further edits are disabled.' })
  } catch (error) {
    if (error instanceof Error && error.message === 'ARTIFACTS_LOCKED') return conflict('artifacts_locked', 'Artifacts have already been submitted.')
    if (error instanceof Error && error.message === 'PROJECT_NOT_APPROVED') return forbidden('Artifacts are available only for approved projects.')
    console.error('Submit artifacts error:', error)
    return serverError('Could not submit the artifacts.')
  }
}
