import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import ts from 'typescript'
import { PDFDocument } from 'pdf-lib'
import XLSX from 'xlsx'

const require = createRequire(import.meta.url)
function load(filename, mocks = {}) {
  const absolute = path.resolve(filename)
  const code = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const loadedModule = { exports: {} }
  const localRequire = name => {
    if (name in mocks) return mocks[name]
    if (name.startsWith('./')) return load(path.resolve(path.dirname(absolute), `${name}.ts`), mocks)
    if (name.startsWith('@/')) return load(`${name.slice(2)}.ts`, mocks)
    return require(name)
  }
  new Function('require', 'module', 'exports', code)(localRequire, loadedModule, loadedModule.exports)
  return loadedModule.exports
}
const math = load('lib/report-math.ts')
const question = { id: 1, stem: 'Which tool?', correct_key: 'A', rationale: 'A is correct.', options: [{ key: 'A', text: 'First' }, { key: 'B', text: 'Second' }] }
const answer = (correct, id = 1) => ({ slot_no: 1, question_id: id, is_correct: correct, answered_key: correct ? 'A' : 'B', option_order: ['B', 'A'], ca1_mcq_questions: { ...question, id } })
const student = (id, correct, marks = null, override = null) => ({ id, prn: String(23070122000 + id), name: `Student ${id}`, session_id: 1, ca1_mcq_assignments: [answer(correct)], ca1_submissions: [{ task_no: 1, marks_awarded: marks, override_marks: override, verification_status: 'verified' }], ca1_question_papers: null })
const data = () => ({ session: { id: 1, status: 'closed', label: 'Batch A' }, exam: { id: 1, code: 'CA1', course_code: 'F0003', title: 'AI', total_marks: 2.5, mcq_marks_each: 0.5, co_attainment_threshold: null }, slots: [{ slot_no: 1, co_code: 'CO3', bloom_level: 2, bloom_label: 'Understand', concept: 'Tools' }], tasks: [{ task_no: 1, title: 'Paper', marks: 2, co_codes: ['CO4'], bloom_level: 3, bloom_label: 'Apply' }], students: [student(1, true, 2, 0), student(2, false), student(3, true, 1, 2)], unassigned_students: 0 })

test('zero override wins, missing tasks are zero, totals retain MCQ', () => {
  const d = data()
  assert.equal(math.taskMarks(d.students[0], 1), 0)
  assert.equal(math.taskMarks(d.students[0], 3), 0)
  assert.equal(math.totalMarks(d.students[0], d), 0.5)
  assert.equal(math.totalMarks(d.students[2], d), 2.5)
})
test('summary handles empty, odd/even cohorts and population standard deviation', () => {
  assert.equal(math.statistics([]).mean, null)
  assert.equal(math.statistics([1, 2, 3]).median, 2)
  assert.deepEqual(math.statistics([1, 3]), { count: 2, mean: 2, median: 2, std_dev: 1, max: 3, min: 1 })
})
test('attainment keeps non-submissions in denominator and leaves unknown threshold unset', () => {
  const d = data(), r = math.attainment(d)
  assert.equal(r.rows[1].class_average_marks, 2 / 3)
  assert.equal(r.rows[1].students_above_threshold, null)
  d.exam.co_attainment_threshold = 100
  assert.equal(math.attainment(d).rows[1].students_above_threshold, 1)
  assert.equal(r.blooms.reduce((s, b) => s + b.percentage, 0), 100)
  d.students = []
  assert.equal(math.attainment(d).rows[0].attainment_percent, null)
})
test('item analysis uses enrolled denominator, effective total rank and separate variants', () => {
  const d = data()
  d.students[0].ca1_mcq_assignments[0] = answer(true, 2)
  const item = math.itemAnalysis(d)[0]
  assert.equal(item.difficulty_index, 2 / 3 * 100)
  assert.equal(item.discrimination, 1)
  assert.equal(item.variants.length, 2)
  d.students = d.students.slice(0, 2)
  assert.equal(math.itemAnalysis(d)[0].discrimination, null)
})
test('PDF generates multipage records with long text and Unicode without crashing', async () => {
  const d = data()
  d.students[0].name = 'विद्यार्थी 😀'
  d.students[0].ca1_mcq_assignments[0].ca1_mcq_questions = { ...question, stem: 'A very long question '.repeat(500) }
  const bytes = await load('lib/student-pdf.ts').studentPdf(d, d.students[0])
  const pdf = await PDFDocument.load(bytes)
  assert.ok(pdf.getPageCount() > 1)
})
const api = { ok: (d, status = 200) => Response.json(d, { status }), forbidden: () => Response.json({}, { status: 403 }), badRequest: () => Response.json({}, { status: 400 }) }
const helpers = { positiveId: v => { if (!/^[1-9]\d*$/.test(String(v))) throw new Error('invalid'); return Number(v) }, reportError: () => Response.json({}, { status: 403 }), download: (bytes, filename, type) => new Response(bytes, { headers: { 'Content-Type': type } }) }
test('marks workbook round-trips with string PRNs and zero overrides', async () => {
  const d = data(); d.students[0].name = '=1+1'
  const route = load('app/api/sa/reports/marks-sheet/route.ts', { '@/lib/session': { requireStaff: async () => ({ email: 'staff@example.test' }) }, '@/lib/db': { audit: async () => {} }, '@/lib/reports': { ...helpers, loadReport: async () => d } })
  const res = await route.GET({ nextUrl: new URL('http://localhost/?session_id=1') })
  assert.equal(res.status, 200)
  const wb = XLSX.read(await res.arrayBuffer(), { type: 'array' })
  assert.equal(wb.Sheets.Marks.A2.t, 's')
  assert.equal(wb.Sheets.Marks.B2.f, undefined)
  assert.equal(wb.Sheets.Marks.D2.v, 0)
  assert.ok(wb.Sheets.Summary)
})
test('debrief denies running, registration and unknown batches before reading answers', async () => {
  for (const status of ['running', 'registration_open', 'setup', null]) {
    let touched = false
    const route = load('app/api/me/mcq-results/route.ts', { '@/lib/session': { requireStudent: async () => ({ id: 1 }) }, '@/lib/api': api,
      '@/lib/reports': { ...helpers, studentExamSession: async () => status ? { status } : null }, '@/lib/db': { db: { from: () => { touched = true; throw new Error('Must not read answers') } } } })
    assert.equal((await route.GET({})).status, 403)
    assert.equal(touched, false)
  }
})
test('all report downloads and analyses reject unauthenticated users before loading data', async () => {
  for (const name of ['marks-sheet', 'student-pdf', 'co-attainment', 'item-analysis']) {
    const route = load(`app/api/sa/reports/${name}/route.ts`, { '@/lib/session': { requireStaff: async () => { throw new Error('UNAUTHORIZED') } }, '@/lib/db': {}, '@/lib/reports': helpers })
    assert.equal((await route.GET({})).status, 403)
  }
})
test('exception route rejects invalid kind and blank details', async () => {
  const route = load('app/api/sa/exceptions/route.ts', { '@/lib/session': { requireStaff: async () => ({ email: 'staff@example.test' }) }, '@/lib/db': {}, '@/lib/api': api, '@/lib/reports': helpers })
  assert.equal((await route.POST({ json: async () => ({ student_id: 1, kind: 'invalid', detail: 'test' }) })).status, 400)
  assert.equal((await route.POST({ json: async () => ({ student_id: 1, kind: 'extension', detail: ' ' }) })).status, 400)
})

test('student session lookup follows enrollment, never the latest batch', async () => {
  const calls = []
  const db = { from(table) {
    calls.push(table)
    return { select() { return this }, eq(column, value) { calls.push([column, value]); return this },
      maybeSingle: async () => ({ data: { session_id: 12 }, error: null }),
      single: async () => ({ data: { id: 12, status: 'running' }, error: null }) }
  } }
  const reports = load('lib/reports.ts', { './db': { db }, './api': api })
  assert.equal((await reports.studentExamSession(4)).id, 12)
  assert.deepEqual(calls, ['ca1_students', ['id', 4], 'ca1_exam_sessions', ['id', 12]])
})
test('closed and archived debrief returns served option order and private caching', async () => {
  for (const status of ['closed', 'archived']) {
    const db = { from(table) {
      const result = table === 'ca1_mcq_assignments' ? { data: [answer(true)], error: null } : { data: { mcq_marks_each: 0.5 }, error: null }
      return { select() { return this }, eq() { return this }, order: async () => result, single: async () => result }
    } }
    const route = load('app/api/me/mcq-results/route.ts', { '@/lib/session': { requireStudent: async () => ({ id: 4 }) }, '@/lib/api': api, '@/lib/db': { db }, '@/lib/reports': { ...helpers, studentExamSession: async () => ({ id: 12, exam_id: 1, status }) } })
    const res = await route.GET({})
    assert.equal(res.status, 200)
    assert.equal(res.headers.get('Cache-Control'), 'private, no-store')
    const q = (await res.json()).questions[0]
    assert.deepEqual(q.options.map(o => o.key), ['B', 'A'])
    assert.equal(q.correct_key, 'A')
    assert.equal(q.marks, 0.5)
  }
})
