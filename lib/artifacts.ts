import { db, audit } from './db'

export const ARTIFACT_FIELDS = [
  'synopsis_pdf_path', 'design_document_pdf_path', 'input_definition', 'output_definition',
  'github_repo_url', 'project_url', 'execution_trace', 'demo_video_url',
] as const

export type ArtifactInput = Partial<Record<typeof ARTIFACT_FIELDS[number], string>> & {
  members?: Array<{ prn: string; github_username: string }>
}

export function artifactValidationErrors(data: ArtifactInput) {
  const required = ['synopsis_pdf_path', 'design_document_pdf_path', 'input_definition', 'output_definition', 'github_repo_url', 'project_url', 'execution_trace', 'demo_video_url'] as const
  return required.filter(field => !data[field]?.trim()).map(field => ({ field, message: `${field.replaceAll('_', ' ')} is required.` }))
}

export async function uploadArtifactPdf(teamId: number, field: 'synopsis' | 'design_document', file: File) {
  await ensureEditable(teamId)
  if (file.type !== 'application/pdf') throw new Error('PDF_ONLY')
  if (file.size > 10 * 1024 * 1024) throw new Error('FILE_TOO_LARGE')
  const path = `${teamId}/${field}-${crypto.randomUUID()}.pdf`
  const { error } = await db.storage.from('ca3-artifacts').upload(path, file, { contentType: 'application/pdf', upsert: false })
  if (error) throw error
  return path
}


export async function getApprovedStudentTeam(studentId: number) {
  const { data: membership } = await db.from('ca1_team_members').select('team_id').eq('student_id', studentId).is('left_at', null).maybeSingle()
  if (!membership) return null
  const { data: team } = await db.from('ca1_teams').select('id, name, status').eq('id', membership.team_id).eq('status', 'approved').maybeSingle()
  if (!team) return null
  const { data: artifacts } = await db.from('ca1_project_artifacts').select('*').eq('team_id', team.id).maybeSingle()
  const { data: members } = await db.from('ca1_team_members').select('roster_prn, student_id, github_username, ca1_roster!inner(name)').eq('team_id', team.id).is('left_at', null).order('joined_at')
  return {
    team,
    artifacts,
    members: (members ?? []).map(member => ({
      roster_prn: member.roster_prn,
      name: member.ca1_roster[0]?.name ?? member.roster_prn,
      github_username: member.github_username,
    })),
  }
}

async function ensureEditable(teamId: number) {
  const { data: team } = await db.from('ca1_teams').select('id, status').eq('id', teamId).single()
  if (!team || team.status !== 'approved') throw new Error('PROJECT_NOT_APPROVED')
  const { data: artifacts } = await db.from('ca1_project_artifacts').select('status').eq('team_id', teamId).maybeSingle()
  if (artifacts?.status === 'locked') throw new Error('ARTIFACTS_LOCKED')
}

export async function upsertTeamArtifacts(teamId: number, data: ArtifactInput, actor: string) {
  await ensureEditable(teamId)
  const artifactData = Object.fromEntries(ARTIFACT_FIELDS.map(field => [field, data[field]?.trim() || null]))
  const { data: existing } = await db.from('ca1_project_artifacts').select('status').eq('team_id', teamId).maybeSingle()
  const { error } = await db.from('ca1_project_artifacts').upsert({ team_id: teamId, ...artifactData, status: existing?.status === 'submitted' ? 'submitted' : 'draft', updated_at: new Date().toISOString() }, { onConflict: 'team_id' })
  if (error) throw error
  for (const member of data.members ?? []) {
    await db.from('ca1_team_members').update({ github_username: member.github_username.trim() || null }).eq('team_id', teamId).eq('roster_prn', member.prn).is('left_at', null)
  }
  await audit(actor, 'ca3_artifacts_saved', `team:${teamId}`)
}

export async function submitTeamArtifacts(teamId: number, data: ArtifactInput, actor: string) {
  const errors = artifactValidationErrors(data)
  if (errors.length > 0) return { errors }
  await ensureEditable(teamId)
  const artifactData = Object.fromEntries(ARTIFACT_FIELDS.map(field => [field, data[field]?.trim() || null]))
  const submittedAt = new Date().toISOString()
  const { error } = await db.from('ca1_project_artifacts').upsert({ team_id: teamId, ...artifactData, status: 'submitted', submitted_at: submittedAt, updated_at: submittedAt }, { onConflict: 'team_id' })
  if (error) throw error
  for (const member of data.members ?? []) {
    await db.from('ca1_team_members').update({ github_username: member.github_username.trim() || null }).eq('team_id', teamId).eq('roster_prn', member.prn).is('left_at', null)
  }
  await audit(actor, 'ca3_artifacts_submitted', `team:${teamId}`)
  return { errors: [] }
}
