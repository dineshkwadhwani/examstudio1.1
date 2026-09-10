import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

function load(filename, mocks) {
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const loadedModule = { exports: {} }
  new Function('require', 'module', 'exports', code)(name => {
    if (!(name in mocks)) throw new Error(`Unexpected import: ${name}`)
    return mocks[name]
  }, loadedModule, loadedModule.exports)
  return loadedModule.exports
}
function database(tables, failure) {
  return { from(table) {
    let rows = tables[table] ?? []
    const query = {
      select() { return query },
      eq(column, value) { rows = rows.filter(row => row[column] === value); return query },
      in(column, values) { rows = rows.filter(row => values.includes(row[column])); return query },
      order() { return query },
      range(start, end) { rows = rows.slice(start, end + 1); return query },
      then(resolve, reject) { return Promise.resolve({ data: rows, error: failure === table ? new Error('Unavailable') : null }).then(resolve, reject) },
    }
    return query
  } }
}
const exam = (id, date) => ({ id, started_at: date, created_at: date, status: 'archived' })

test('history includes MCQ-only, paper-only and submission-only sessions once, newest first, and excludes other students', async () => {
  const db = database({
    ca1_mcq_assignments: [{ student_id: 7, session_id: 1 }, { student_id: 8, session_id: 4 }],
    ca1_question_papers: [{ student_id: 7, session_id: 2 }],
    ca1_submissions: [{ student_id: 7, session_id: 3 }, { student_id: 7, session_id: 2 }, { student_id: 7, session_id: null }],
    ca1_exam_sessions: [exam(1, '2026-01-01'), exam(2, '2026-02-01'), exam(3, '2026-03-01'), exam(4, '2026-04-01')],
  })
  const { getStudentExams } = load('lib/student-exams.ts', { './db': { db } })
  assert.deepEqual((await getStudentExams(7)).map(row => row.id), [3, 2, 1])
  assert.deepEqual(await getStudentExams(99), [])
})

test('history reads participation beyond the database row limit', async () => {
  const rows = Array.from({ length: 1000 }, () => ({ student_id: 7, session_id: 1 }))
  rows.push({ student_id: 7, session_id: 2 })
  const db = database({ ca1_mcq_assignments: rows, ca1_exam_sessions: [exam(1, '2026-01-01'), exam(2, '2026-02-01')] })
  const { getStudentExams } = load('lib/student-exams.ts', { './db': { db } })
  assert.deepEqual((await getStudentExams(7)).map(row => row.id), [2, 1])
})

test('database failures do not become an empty exam history', async () => {
  const db = database({}, 'ca1_submissions')
  const { getStudentExams } = load('lib/student-exams.ts', { './db': { db } })
  await assert.rejects(getStudentExams(7), /Could not load/)
})

test('profile endpoint denies anonymous and staff sessions before accessing student data', async () => {
  for (const session of [null, { type: 'staff', id: 7 }]) {
    const { GET } = load('app/api/me/profile/route.ts', {
      '@/lib/session': { getSession: async () => session },
      '@/lib/api': { forbidden: () => ({ status: 403 }) },
      '@/lib/db': { db: { from() { throw new Error('Must not query student data') } } },
    })
    assert.equal((await GET()).status, 403)
  }
})

test('profile endpoint selects safe fields for the authenticated student only', async () => {
  const student = { name: 'Student', prn: '123', email: 'student@example.com', phone: '1234567890', registered_at: '2026-01-01' }
  const { GET } = load('app/api/me/profile/route.ts', {
    '@/lib/session': { getSession: async () => ({ type: 'student', id: 7 }) },
    '@/lib/api': { ok: data => data },
    '@/lib/db': { db: { from(table) {
      assert.equal(table, 'ca1_students')
      return { select(fields) {
        assert.equal(fields, 'name, prn, email, phone, registered_at')
        return { eq(key, value) {
          assert.equal(key, 'id'); assert.equal(value, 7)
          return { single: async () => ({ data: student, error: null }) }
        } }
      } }
    } } },
  })
  assert.deepEqual(await GET(), student)
})
