import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Lazy singleton — avoids throwing at module load time during build
let _db: SupabaseClient | null = null

export function getDb(): SupabaseClient {
  if (_db) return _db
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
  }
  _db = createClient(url, key, {
    auth: { persistSession: false },
    db:   { schema: 'public' },
  })
  return _db
}

// Convenience alias — all route files use this
export const db = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getDb() as unknown as Record<string | symbol, unknown>)[prop]
  }
})

// ─── Audit helper ─────────────────────────────────────────────
export async function audit(
  actor: string,
  action: string,
  target?: string,
  detail?: Record<string, unknown>
) {
  await db.from('ca1_audit_log').insert({ actor, action, target, detail })
}
