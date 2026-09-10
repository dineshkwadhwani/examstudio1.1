import crypto from 'crypto'
import type { ExamSession, RenderedPaper, SheetRow } from './types'

// ─── Deterministic seed from PRN + session ────────────────────
export function makeSeed(prn: string, sessionId: number): string {
  return crypto
    .createHash('sha256')
    .update(`${prn}:${sessionId}`)
    .digest('hex')
}

// Use first 15 hex chars to stay within safe integer range
function seedInt(seed: string): number {
  return parseInt(seed.slice(0, 12), 16)
}

// ─── Pick target word and scoped page ────────────────────────
export function pickWord(seed: string, words: string[]): string {
  const n = seedInt(seed)
  return words[n % words.length]
}

export function pickPage(seed: string, pageCount: number): number {
  const n = seedInt(seed)
  // Use a different offset in the seed for page vs word
  const n2 = parseInt(seed.slice(4, 16), 16)
  return 1 + (n2 % pageCount)
}

// ─── Build the rendered paper ─────────────────────────────────
export function buildRenderedPaper(params: {
  prn: string
  name: string
  session: ExamSession
  targetWord: string
  scopedPage: number
  t3Row: SheetRow
  endsAt: string
  appUrl: string
  corpusPath: string
  magicCode: string
}): RenderedPaper {
  return {
    prn: params.prn,
    name: params.name,
    issued_at: new Date().toISOString(),
    exam_ends_at: params.endsAt,
    magic_code: params.magicCode,
    task2: {
      corpus_index_url: `${params.appUrl}${params.corpusPath}/index.html`,
      target_word: params.targetWord,
      scoped_page: params.scopedPage,
      submit_endpoint: `${params.appUrl}/api/v1/submit/task2`,
    },
    task3: {
      sheet_csv_url: params.session.sheet_csv_url,
      submit_endpoint: `${params.appUrl}/api/v1/submit/task3`,
    },
  }
}

// ─── MCQ option order ────────────────────────────────────────
export function shuffleOptions(
  options: { key: string; text: string }[],
  seed: string,
  slotNo: number
): string[] {
  // Deterministic shuffle for this student + slot
  const slotSeed = seed + ':slot:' + slotNo
  const keys = options.map(o => o.key)
  const arr = [...keys]
  // Fisher-Yates with seeded values from different positions of the hash
  for (let i = arr.length - 1; i > 0; i--) {
    const n = parseInt(slotSeed.slice(i * 2, i * 2 + 6) || slotSeed.slice(0, 6), 16)
    const j = n % (i + 1)
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

// ─── Pick MCQ question for a slot ────────────────────────────
export function pickQuestion(
  seed: string,
  slotNo: number,
  questionIds: number[]
): number {
  const n = seedInt(seed + ':mcq:' + slotNo)
  return questionIds[n % questionIds.length]
}

// ─── Magic code colour ────────────────────────────────────────
const MAGIC_COLOURS = ['Red', 'Blue', 'Green', 'Orange'] as const
export type MagicColour = typeof MAGIC_COLOURS[number]
export const ALL_MAGIC_COLOURS: readonly string[] = MAGIC_COLOURS

export function pickMagicCode(seed: string): MagicColour {
  const n = seedInt(seed + ':magic')
  return MAGIC_COLOURS[n % MAGIC_COLOURS.length]
}
