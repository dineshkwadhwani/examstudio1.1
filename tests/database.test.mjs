import { test } from 'node:test'
import assert from 'node:assert/strict'
import { databaseConfig, databaseError } from '../scripts/database.mjs'

const env = {
  DATABASE_URL: 'postgresql://postgres.example:fake%40password@aws-0-ap-south-1.pooler.supabase.com:6543/postgres',
  SUPABASE_URL: 'https://example.supabase.co',
}
test('database configuration verifies CA and hostname and decodes the password', () => {
  const config = databaseConfig(env)
  assert.equal(config.ssl.rejectUnauthorized, true)
  assert.equal(config.ssl.servername, config.host)
  assert.match(config.ssl.ca, /BEGIN CERTIFICATE/)
  assert.equal(config.password, 'fake@password')
  assert.equal(config.port, 6543)
})
test('URL parameters cannot disable configured TLS verification', () => {
  const config = databaseConfig({ ...env, DATABASE_URL: env.DATABASE_URL + '?sslmode=disable&sslrootcert=untrusted' })
  assert.equal(config.ssl.rejectUnauthorized, true)
  assert.match(config.ssl.ca, /BEGIN CERTIFICATE/)
})
test('database configuration rejects a different project before opening a connection', () => {
  assert.throws(() => databaseConfig({ ...env, SUPABASE_URL: 'https://another.supabase.co' }), /does not match/)
})
test('database errors explain incorrect pooler routing without exposing connection strings', () => {
  const message = databaseError({ code: 'XX000', message: 'tenant/user postgres.example not found' })
  assert.match(message, /exact Session pooler connection string/)
  assert.ok(!message.includes('postgres.example'))
  assert.ok(!databaseError({ code: '28P01', message: env.DATABASE_URL }).includes('fake'))
})
