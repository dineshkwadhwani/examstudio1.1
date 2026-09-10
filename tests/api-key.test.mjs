import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
import { NextResponse } from 'next/server.js'

function resolver(result) {
  let queried = false
  const db = { from() {
    queried = true
    const query = { select() { return query }, eq() { return query }, maybeSingle: async () => result }
    return query
  } }
  const code = ts.transpileModule(fs.readFileSync('lib/api.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const loaded = { exports: {} }
  new Function('require', 'module', 'exports', code)(name => name === 'next/server' ? { NextResponse } : { db }, loaded, loaded.exports)
  return { resolve: loaded.exports.resolveApiKey, queried: () => queried }
}

for (const headers of [{}, { Authorization: 'Bearer example' }, { 'X-API-Key': ' ' }]) {
  test(`missing or misplaced header: ${JSON.stringify(headers)}`, async () => {
    const auth = resolver({})
    const response = await auth.resolve(new Request('https://example.com', { headers }))
    assert.equal(response.status, 401)
    assert.equal((await response.json()).error, 'missing_api_key')
    assert.equal(auth.queried(), false)
  })
}
for (const [result, status, code] of [
  [{ data: null, error: null }, 401, 'invalid_api_key'],
  [{ data: { revoked: true }, error: null }, 401, 'revoked_api_key'],
  [{ data: null, error: { message: 'Database unavailable' } }, 500, 'server_error'],
]) {
  test(code, async () => {
    const auth = resolver(result)
    const response = await auth.resolve(new Request('https://example.com', { headers: { 'X-API-Key': 'example-key' } }))
    assert.equal(response.status, status)
    const body = await response.json()
    assert.equal(body.error, code)
    assert.ok(body.message)
    assert.ok(!body.message.includes('example-key'))
  })
}
test('valid key returns identity and accepts header casing', async () => {
  const auth = resolver({ data: { student_id: 7, revoked: false, ca1_students: { prn: '123', name: 'Student' } }, error: null })
  assert.deepEqual(await auth.resolve(new Request('https://example.com', { headers: { 'x-api-key': 'example-key' } })), { studentId: 7, prn: '123', name: 'Student' })
})
