import { NextRequest } from 'next/server'
import { db, audit } from '@/lib/db'
import { ok, err, badRequest, serverError, forbidden } from '@/lib/api'
import { requireStaff } from '@/lib/session'
import { verifyAfterManualClose } from '@/lib/session-lifecycle'

// GET — list all sessions
export async function GET() {
  try {
    await requireStaff()
    const [{ data: sessions }, { data: submissions }] = await Promise.all([
      db.from('ca1_exam_sessions')
        .select('*, ca1_exam_definitions(code, title, corpus_reference_table)')
        .order('created_at', { ascending: false }),
      db.from('ca1_submissions')
        .select('session_id, verification_status')
        .in('task_no', [2, 3]),
    ])

    const summaries = new Map<number, { total: number; pending: number }>()
    for (const submission of submissions ?? []) {
      if (!submission.session_id) continue
      const summary = summaries.get(submission.session_id) ?? { total: 0, pending: 0 }
      summary.total++
      if (submission.verification_status === 'pending' || submission.verification_status === 'deferred') summary.pending++
      summaries.set(submission.session_id, summary)
    }

    return ok((sessions ?? []).map(session => {
      const verification = summaries.get(session.id) ?? { total: 0, pending: 0 }
      return { ...session, verification: { ...verification, complete: verification.total > 0 && verification.pending === 0 } }
    }))
  } catch {
    return forbidden()
  }
}

export async function POST(req: NextRequest) {
  try {
    const staff = await requireStaff()
    if (staff.role !== 'sa') return forbidden('Super Admin access required.')

    let body: Record<string, unknown>
    try { body = await req.json() } catch { return badRequest('Invalid JSON.') }

    const { action, session_id, ...rest } = body

    // ─── Create session ───────────────────────────────────
    if (action === 'create') {
      const { exam_id, label } = rest
      if (!exam_id) return badRequest('exam_id is required.')
      if (!label)   return badRequest('label is required.')

      // Verify exam definition exists and has corpus loaded
      const { data: examDef } = await db
        .from('ca1_exam_definitions')
        .select('id, corpus_reference_table')
        .eq('id', exam_id)
        .single()

      if (!examDef) return badRequest('Exam definition not found.')

      const wordCount = Object.keys(examDef.corpus_reference_table ?? {}).length
      if (wordCount === 0) {
        return serverError(
          'Exam definition has no corpus loaded. ' +
          'Run migration 003_ca1_corpus.sql first.'
        )
      }

      // Sheet URL comes from environment
      const sheetCsvUrl = process.env.TASK3_SHEET_CSV_URL
      if (!sheetCsvUrl) {
        return serverError(
          'TASK3_SHEET_CSV_URL is not set. Add it to your environment variables.'
        )
      }

      // Fetch and freeze sheet snapshot
      let sheetSnapshot: Record<string, unknown> = {}
      let sheetHash = ''
      try {
        const sheetRes = await fetch(sheetCsvUrl, { signal: AbortSignal.timeout(15_000) })
        if (!sheetRes.ok) {
          return serverError(`Could not fetch spreadsheet (HTTP ${sheetRes.status}).`)
        }
        const csv = await sheetRes.text()
        sheetSnapshot = parseCsvToSnapshot(csv)
        sheetHash = await hashString(csv)
      } catch (e) {
        return serverError(`Could not fetch spreadsheet: ${e}`)
      }

      const rowCount = Object.keys(sheetSnapshot).length
      if (rowCount === 0) {
        return serverError('Spreadsheet fetched but no rows parsed. Check column headers: PRN, Name, City, Latitude, Longitude.')
      }

      const { data, error } = await db
        .from('ca1_exam_sessions')
        .insert({
          exam_id,
          label,
          status: 'setup',
          sheet_csv_url: sheetCsvUrl,
          sheet_snapshot: sheetSnapshot,
          sheet_hash: sheetHash,
          relax_apify_verification: false,
        })
        .select()
        .single()

      if (error) return serverError(error.message)

      await audit(`staff:${staff.email}`, 'session_created', `session:${data.id}`, {
        label, sheet_rows: rowCount, corpus_words: wordCount,
      })

      return ok({ ...data, _sheet_rows_loaded: rowCount, _corpus_words: wordCount }, 201)
    }

    // ─── Transition status ────────────────────────────────
    if (action === 'transition') {
      const { new_status, extend_minutes, reason } = rest
      if (!session_id) return badRequest('session_id is required.')

      const { data: session } = await db
        .from('ca1_exam_sessions')
        .select('*, ca1_exam_definitions(corpus_reference_table)')
        .eq('id', session_id)
        .single()

      if (!session) return err('not_found', 'Session not found.', 404)

      const updates: Record<string, unknown> = {}

      if (new_status === 'registration_open') {
        if (session.status !== 'setup') return badRequest('Can only open registration from setup.')
        updates.status = 'registration_open'

      } else if (new_status === 'running') {
        if (session.status !== 'registration_open') {
          return badRequest('Can only start from registration_open.')
        }

        // Check no other session is running
        const { data: running } = await db
          .from('ca1_exam_sessions')
          .select('id')
          .eq('status', 'running')
          .neq('id', session_id)
          .single()
        if (running) return badRequest('Another session is already running. Close it first.')

        // Verify corpus is in exam definition
        const examDef = (session as Record<string, unknown>).ca1_exam_definitions as Record<string, unknown>
        const wordCount = Object.keys(examDef?.corpus_reference_table ?? {}).length
        if (wordCount === 0) {
          return badRequest('Exam definition has no corpus. Run migration 003_ca1_corpus.sql.')
        }

        // Sessions created before the spreadsheet was configured may not have a
        // snapshot. Freeze the current environment CSV immediately before the
        // exam starts so every student receives the same Task 3 reference data.
        const snapshotRows = Object.keys(session.sheet_snapshot ?? {}).length
        if (snapshotRows === 0) {
          const sheetCsvUrl = process.env.TASK3_SHEET_CSV_URL
          if (!sheetCsvUrl) {
            return serverError('TASK3_SHEET_CSV_URL is not set. Add it to your environment variables before starting.')
          }

          try {
            const sheetRes = await fetch(sheetCsvUrl, { signal: AbortSignal.timeout(15_000) })
            if (!sheetRes.ok) {
              return serverError(`Could not fetch spreadsheet (HTTP ${sheetRes.status}).`)
            }

            const csv = await sheetRes.text()
            const sheetSnapshot = parseCsvToSnapshot(csv)
            const rowCount = Object.keys(sheetSnapshot).length
            if (rowCount === 0) {
              return serverError('Spreadsheet fetched but no rows parsed. Check column headers: PRN, Name, City, Latitude, Longitude.')
            }

            updates.sheet_csv_url = sheetCsvUrl
            updates.sheet_snapshot = sheetSnapshot
            updates.sheet_hash = await hashString(csv)
            updates._sheet_rows_loaded = rowCount
          } catch (e) {
            return serverError(`Could not fetch spreadsheet: ${e}`)
          }
        }

        const now = new Date()
        updates.status = 'running'
        updates.started_at = now.toISOString()
        updates.ends_at = new Date(now.getTime() + 50 * 60 * 1000).toISOString()

      } else if (new_status === 'closed') {
        updates.status = 'closed'
        updates.closed_at = new Date().toISOString()

      } else if (new_status === 'archived') {
        if (session.status !== 'closed') return badRequest('Can only archive a closed session.')
        updates.status = 'archived'

      } else if (new_status === 'extend') {
        const mins = Number(extend_minutes ?? 10)
        if (!session.ends_at) return badRequest('Session has no end time to extend.')
        updates.ends_at = new Date(new Date(session.ends_at).getTime() + mins * 60 * 1000).toISOString()

      } else {
        return badRequest(`Unknown status: ${new_status}`)
      }

      const sheetRowsLoaded = updates._sheet_rows_loaded
      delete updates._sheet_rows_loaded

      await db.from('ca1_exam_sessions').update(updates).eq('id', session_id)
      await audit(`staff:${staff.email}`, `session_${new_status ?? 'extended'}`,
        `session:${session_id}`, { reason, extend_minutes, sheet_rows_loaded: sheetRowsLoaded })

      if (new_status === 'closed') {
        await verifyAfterManualClose(Number(session_id))
      }

      return ok({ message: 'Session updated.', updates })
    }

    // ─── Toggle Apify break-glass ─────────────────────────
    if (action === 'toggle_apify_relax') {
      if (!session_id) return badRequest('session_id is required.')
      const { data: session } = await db
        .from('ca1_exam_sessions')
        .select('relax_apify_verification')
        .eq('id', session_id)
        .single()
      if (!session) return err('not_found', 'Session not found.', 404)

      const newValue = !session.relax_apify_verification
      await db.from('ca1_exam_sessions')
        .update({ relax_apify_verification: newValue })
        .eq('id', session_id)

      await audit(`staff:${staff.email}`, 'apify_relax_toggled', `session:${session_id}`, {
        new_value: newValue, reason: rest.reason,
      })
      return ok({ relax_apify_verification: newValue })
    }

    return badRequest(`Unknown action: ${action}`)

  } catch (e) {
    if (String(e).includes('UNAUTHORIZED')) return forbidden()
    throw e
  }
}

// ─── Helpers ─────────────────────────────────────────────────
function parseCsvToSnapshot(csv: string): Record<string, unknown> {
  const lines = csv.trim().split('\n')
  if (lines.length < 2) return {}

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''))
  const prnIdx  = headers.findIndex(h => h === 'prn')
  const nameIdx = headers.findIndex(h => h === 'name')
  const cityIdx = headers.findIndex(h => h === 'city')
  const latIdx  = headers.findIndex(h => h === 'latitude' || h === 'lat')
  const lonIdx  = headers.findIndex(h => h === 'longitude' || h === 'lon' || h === 'long')

  if (prnIdx === -1 || cityIdx === -1 || latIdx === -1 || lonIdx === -1) {
    throw new Error('CSV must have columns: PRN, Name, City, Latitude, Longitude')
  }

  const snapshot: Record<string, unknown> = {}
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim().replace(/"/g, ''))
    const prn = cols[prnIdx]?.trim()
    if (!prn) continue
    snapshot[prn] = {
      prn,
      name: cols[nameIdx] ?? '',
      city: cols[cityIdx] ?? '',
      lat: parseFloat(cols[latIdx] ?? '0'),
      lon: parseFloat(cols[lonIdx] ?? '0'),
    }
  }
  return snapshot
}

async function hashString(s: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(s)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}
