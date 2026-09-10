import { checkTestOpen } from '@/lib/test-submission'
import { db } from '@/lib/db'
import { ok, forbidden, err, serverError } from '@/lib/api'
import { getSession } from '@/lib/session'
import { makeSeed, pickWord, pickPage, buildRenderedPaper, pickMagicCode } from '@/lib/paper'
import type { SheetRow, ReferenceTable } from '@/lib/types'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? ''

// Session-cookie version of GET /api/v1/paper — for the dashboard Fetch Paper button.
// Identical logic but authenticated via cookie instead of API key.
export async function GET() {
  const session = await getSession()
  if (!session || session.type !== 'student') return forbidden()

  const { id: studentId, prn, name } = session

  // Get active exam session
  const { data: examSession } = await db
    .from('ca1_exam_sessions')
    .select('*')
    .eq('status', 'running')
    .single()

  if (!examSession) return err('exam_not_started', 'The exam is not currently running.', 403)

  if (examSession.ends_at && new Date() > new Date(examSession.ends_at)) {
    return err('exam_ended', 'The exam has ended.', 403)
  }

  const testError = await checkTestOpen(studentId, examSession.id)
  if (testError) return testError

  // Return existing paper if already issued
  const { data: existingPaper } = await db
    .from('ca1_question_papers')
    .select('rendered_paper, fetch_count')
    .eq('student_id', studentId)
    .eq('session_id', examSession.id)
    .maybeSingle()

  if (existingPaper) {
    await db.from('ca1_question_papers').update({
      fetch_count: existingPaper.fetch_count + 1,
      last_fetched_at: new Date().toISOString(),
    }).eq('student_id', studentId).eq('session_id', examSession.id)
    return ok(existingPaper.rendered_paper)
  }

  // Issue new paper
  const { data: examDef } = await db
    .from('ca1_exam_definitions')
    .select('corpus_reference_table, corpus_path')
    .eq('id', examSession.exam_id)
    .single()

  if (!examDef) return serverError('Exam definition not found.')

  const referenceTable = examDef.corpus_reference_table as ReferenceTable
  const wordPool = Object.keys(referenceTable)
  if (!wordPool.length) return serverError('Corpus not loaded.')

  const seed = makeSeed(prn, examSession.id)
  const targetWord = pickWord(seed, wordPool)
  const scopedPage = pickPage(seed, 5)
  const expectedTotal = referenceTable[targetWord]?.total ?? 0
  const expectedScoped = referenceTable[targetWord]?.pages?.[scopedPage] ?? 0
  const magicCode = pickMagicCode(seed)

  const sheetSnapshot = examSession.sheet_snapshot as Record<string, SheetRow>
  const t3Row = sheetSnapshot[prn]
  if (!t3Row) return serverError(`Your PRN (${prn}) was not found in the spreadsheet. Contact the invigilator.`)

  const renderedPaper = buildRenderedPaper({
    prn, name,
    session: examSession,
    targetWord, scopedPage,
    t3Row, endsAt: examSession.ends_at!,
    appUrl: APP_URL,
    corpusPath: examDef.corpus_path ?? '/corpus',
    magicCode,
  })

  const { data: newPaper, error } = await db
    .from('ca1_question_papers')
    .insert({
      student_id: studentId,
      session_id: examSession.id,
      seed,
      t2_target_word: targetWord,
      t2_scoped_page: scopedPage,
      t2_expected_total: expectedTotal,
      t2_expected_scoped: expectedScoped,
      t3_city: t3Row.city,
      t3_lat: t3Row.lat,
      t3_lon: t3Row.lon,
      magic_code: magicCode,
      rendered_paper: renderedPaper,
    })
    .select('rendered_paper')
    .single()

  if (error) {
    const { data: racePaper } = await db
      .from('ca1_question_papers')
      .select('rendered_paper')
      .eq('student_id', studentId)
      .eq('session_id', examSession.id)
      .maybeSingle()
    if (racePaper) return ok(racePaper.rendered_paper)
    return serverError('Could not issue paper.')
  }

  return ok(newPaper!.rendered_paper)
}
