import { NextResponse } from 'next/server'
import { db } from './db'
import type { ApiError, ExamSession } from './types'

export function ok(data: unknown, status = 200) {
  return NextResponse.json(data, { status })
}

export function err(error: string, message: string, status: number) {
  return NextResponse.json({ error, message } satisfies ApiError, { status })
}

export function unauthorized() {
  return err('unauthorized', 'Authentication required.', 401)
}

export function forbidden(message = 'Access denied.') {
  return err('forbidden', message, 403)
}

export function notFound(message = 'Not found.') {
  return err('not_found', message, 404)
}

export function conflict(error: string, message: string) {
  return err(error, message, 409)
}

export function badRequest(message: string) {
  return err('bad_request', message, 400)
}

export function serverError(message = 'Internal server error.') {
  return err('server_error', message, 500)
}

// ─── Resolve API key to student ──────────────────────────────
export async function resolveApiKey(request: Request): Promise<{
  studentId: number
  prn: string
  name: string
} | NextResponse> {
  const key = request.headers.get('x-api-key')?.trim()
  if (!key) return err('missing_api_key', 'X-API-Key header is missing or empty. Send your exam API key in the X-API-Key header.', 401)

  const keyHash = await sha256(key)

  const { data, error } = await db
    .from('ca1_api_keys')
    .select('student_id, revoked, ca1_students!inner(prn, name)')
    .eq('key_hash', keyHash)
    .maybeSingle()

  if (error) return serverError('Could not validate the API key. Please try again later.')
  if (!data) return err('invalid_api_key', 'The API key in the X-API-Key header is incorrect. Copy your current exam API key from the student dashboard.', 401)
  if (data.revoked) return err('revoked_api_key', 'This API key has been revoked. Generate a replacement key from the student dashboard.', 401)

  const student = (data as Record<string, unknown>).ca1_students as { prn: string; name: string }
  return { studentId: data.student_id, prn: student.prn, name: student.name }
}

// ─── Get active session ───────────────────────────────────────
export async function getActiveSession(): Promise<ExamSession | null> {
  const { data } = await db
    .from('ca1_exam_sessions')
    .select('*')
    .eq('status', 'running')
    .single()
  return (data as ExamSession | null)
}

export async function getOpenSession(): Promise<ExamSession | null> {
  const { data } = await db
    .from('ca1_exam_sessions')
    .select('*')
    .in('status', ['registration_open', 'running'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
  return (data as ExamSession | null)
}

// ─── Check exam window ────────────────────────────────────────
export function isWithinWindow(session: ExamSession): boolean {
  if (!session.ends_at) return false
  return new Date() <= new Date(session.ends_at)
}

// ─── SHA-256 ─────────────────────────────────────────────────
export async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

// ─── Generate exam API key ────────────────────────────────────
export function generateApiKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  const raw = Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
  return `exk_live_${raw}`
}

// ─── Source IP ────────────────────────────────────────────────
export function getSourceIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'
  )
}
