import { NextRequest } from 'next/server'
import { db, audit } from '@/lib/db'
import {
  resolveApiKey, getActiveSession, isWithinWindow,
  err, ok, serverError
} from '@/lib/api'
import { makeSeed, pickWord, pickPage, buildRenderedPaper, pickMagicCode } from '@/lib/paper'
import type { SheetRow, ReferenceTable } from '@/lib/types'


const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://examstudioca2.thecoachdinesh.com'
const RATE_LIMIT = 30

const fetchCounts = new Map<number, { count: number; window: number }>()
function checkRateLimit(studentId: number): boolean {
  const now = Math.floor(Date.now() / 60_000)
  const entry = fetchCounts.get(studentId)
  if (!entry || entry.window !== now) {
    fetchCounts.set(studentId, { count: 1, window: now })
    return true
  }
  entry.count++
  return entry.count <= RATE_LIMIT
}

export async function GET(req: NextRequest) {
  const resolved = await resolveApiKey(req)
  if (!resolved) return err('unauthorized', 'Valid X-API-Key header required.', 401)

  const { studentId, prn, name } = resolved

  if (!checkRateLimit(studentId)) {
    return err('rate_limited', 'Too many requests. Wait a moment and try again.', 429)
  }

  const session = await getActiveSession()
  if (!session) return err('exam_not_started', 'The exam is not currently running.', 403)
  if (!isWithinWindow(session)) return err('exam_ended', 'The exam has ended.', 403)

  // Return existing paper if already issued — fully idempotent
  const { data: existingPaper } = await db
    .from('ca1_question_papers')
    .select('*')
    .eq('student_id', studentId)
    .eq('session_id', session.id)
    .maybeSingle()

  if (existingPaper) {
    await db.from('ca1_question_papers').update({
      fetch_count: existingPaper.fetch_count + 1,
      last_fetched_at: new Date().toISOString(),
    }).eq('id', existingPaper.id)
    await audit(`student:${prn}`, 'paper_fetched_again', `student:${studentId}`, {
      fetch_count: existingPaper.fetch_count + 1,
    })
    return ok(existingPaper.rendered_paper)
  }

  // Load corpus from exam definition
  const { data: examDef } = await db
    .from('ca1_exam_definitions')
    .select('corpus_reference_table, corpus_path')
    .eq('id', session.exam_id)
    .single()

  if (!examDef) return serverError('Exam definition not found.')

  const referenceTable = examDef.corpus_reference_table as ReferenceTable
  const wordPool = Object.keys(referenceTable)
  if (!wordPool.length) return serverError('Corpus not loaded in exam definition.')

  const seed = makeSeed(prn, session.id)
  const targetWord = pickWord(seed, wordPool)
  const scopedPage = pickPage(seed, 5)
  const expectedTotal = referenceTable[targetWord]?.total ?? 0
  const expectedScoped = referenceTable[targetWord]?.pages?.[scopedPage] ?? 0
  const magicCode = pickMagicCode(seed)

  const sheetSnapshot = session.sheet_snapshot as Record<string, SheetRow>
  const t3Row = sheetSnapshot[prn]
  if (!t3Row) {
    return serverError(`Your PRN (${prn}) was not found in the exam spreadsheet. Contact the invigilator.`)
  }

  const renderedPaper = buildRenderedPaper({
    prn, name, session,
    targetWord, scopedPage,
    t3Row, endsAt: session.ends_at!,
    appUrl: APP_URL,
    corpusPath: examDef.corpus_path ?? '/corpus',
    magicCode,
  })

  const { data: newPaper, error } = await db
    .from('ca1_question_papers')
    .insert({
      student_id: studentId,
      session_id: session.id,
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
      .eq('session_id', session.id)
      .maybeSingle()
    if (racePaper) return ok(racePaper.rendered_paper)
    return serverError('Could not issue paper. Please try again.')
  }

  // Task 1 marks are awarded when student submits their magic code colour
  await audit(`student:${prn}`, 'paper_fetched', `student:${studentId}`, {
    target_word: targetWord, scoped_page: scopedPage,
    t3_city: t3Row.city, magic_code: magicCode,
  })

  return ok(newPaper!.rendered_paper)
}
