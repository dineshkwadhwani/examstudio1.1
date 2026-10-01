import { NextRequest } from 'next/server'
import { badRequest, conflict, err, forbidden, ok, serverError } from '@/lib/api'
import { getSession } from '@/lib/session'
import { getApprovedStudentTeam, upsertTeamArtifacts } from '@/lib/artifacts'

async function context() {
  const session = await getSession()
  if (!session || session.type !== 'student') return null
  const team = await getApprovedStudentTeam(session.id)
  return team ? { session, team } : null
}

export async function GET() {
  const ctx = await context()
  if (!ctx) return err('not_found', 'Artifacts are available only for approved projects.', 404)
  return ok({ team: ctx.team.team, artifacts: ctx.team.artifacts, members: ctx.team.members })
}

export async function POST(req: NextRequest) {
  const ctx = await context()
  if (!ctx) return forbidden('Artifacts are available only for approved projects.')
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return badRequest('Invalid JSON body.') }
  try {
    await upsertTeamArtifacts(ctx.team.team.id, {
      synopsis_pdf_path: typeof body.synopsis_pdf_path === 'string' ? body.synopsis_pdf_path : undefined,
      design_document_pdf_path: typeof body.design_document_pdf_path === 'string' ? body.design_document_pdf_path : undefined,
      input_definition: typeof body.input_definition === 'string' ? body.input_definition : undefined,
      output_definition: typeof body.output_definition === 'string' ? body.output_definition : undefined,
      github_repo_url: typeof body.github_repo_url === 'string' ? body.github_repo_url : undefined,
      project_url: typeof body.project_url === 'string' ? body.project_url : undefined,
      execution_trace: typeof body.execution_trace === 'string' ? body.execution_trace : undefined,
      demo_video_url: typeof body.demo_video_url === 'string' ? body.demo_video_url : undefined,
      members: Array.isArray(body.members) ? body.members.filter((member): member is { prn: string; github_username: string } => typeof member === 'object' && member !== null && typeof (member as Record<string, unknown>).prn === 'string' && typeof (member as Record<string, unknown>).github_username === 'string') : undefined,
    }, `student:${ctx.session.id}`)
    return ok({ message: 'Artifacts draft saved.' })
  } catch (error) {
    if (error instanceof Error && error.message === 'ARTIFACTS_LOCKED') return conflict('artifacts_locked', 'Artifacts cannot be changed after submission.')
    if (error instanceof Error && error.message === 'PROJECT_NOT_APPROVED') return forbidden('Artifacts are available only for approved projects.')
    console.error('Save artifacts error:', error)
    return serverError('Could not save the artifacts draft.')
  }
}
