import { NextRequest } from 'next/server'
import { db, audit } from '@/lib/db'
import { ok, conflict, serverError, getOpenSession, forbidden } from '@/lib/api'
import { getSession } from '@/lib/session'
import { generateApiKey, sha256 } from '@/lib/api'
import { decryptApiKey, encryptApiKey } from '@/lib/api-key-vault'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || session.type !== 'student') {
    return forbidden('Must be logged in as a student.')
  }

  // Check session allows key generation
  const examSession = await getOpenSession()
  if (!examSession) {
    return forbidden('Key generation is not available at this time.')
  }

  let replaceExisting = false
  try {
    replaceExisting = (await req.json() as { replace?: boolean }).replace === true
  } catch {
    // An empty request body is the normal generate-key request.
  }

  // Check for existing key
  const { data: existing } = await db
    .from('ca1_api_keys')
    .select('key_prefix, revoked')
    .eq('student_id', session.id)
    .single()

  if (existing && !existing.revoked && !replaceExisting) {
    return conflict(
      'key_already_exists',
      `You already have an active API key (prefix: ${existing.key_prefix}). Use View key to reveal it.`
    )
  }

  // Generate key
  const rawKey = generateApiKey()
  const keyHash = await sha256(rawKey)
  const keyPrefix = rawKey.substring(0, 12) // exk_live_xxxx

  let keyCiphertext: string
  try {
    keyCiphertext = await encryptApiKey(rawKey)
  } catch {
    return serverError('Could not protect API key. Check SESSION_SECRET configuration.')
  }

  const { error } = await db.from('ca1_api_keys').upsert(
    {
      student_id: session.id,
      key_hash: keyHash,
      key_prefix: keyPrefix,
      key_ciphertext: keyCiphertext,
      revoked: false,
      created_at: new Date().toISOString(),
    },
    { onConflict: 'student_id' }
  )

  if (error) return serverError('Could not generate API key.')

  await audit(`student:${session.prn}`, replaceExisting ? 'api_key_replaced' : 'api_key_generated', `student:${session.id}`)

  return ok({
    api_key: rawKey,
    prefix: keyPrefix,
    note: 'Store this key securely. You can also view it again from your dashboard while logged in.',
  }, 201)
}

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session || session.type !== 'student') {
    return forbidden('Must be logged in as a student.')
  }

  const { data } = await db
    .from('ca1_api_keys')
    .select('key_prefix, created_at, revoked, key_ciphertext')
    .eq('student_id', session.id)
    .single()

  if (!data) {
    return ok({ has_key: false })
  }

  if (req.nextUrl.searchParams.get('reveal') === '1') {
    if (data.revoked) return conflict('key_revoked', 'This API key has been revoked.')
    if (!data.key_ciphertext) {
      return conflict('key_not_recoverable', 'This key was created before secure key viewing was enabled. Generate a replacement key to make it viewable.')
    }
    try {
      return ok({ api_key: await decryptApiKey(data.key_ciphertext), prefix: data.key_prefix })
    } catch {
      return serverError('Could not decrypt API key.')
    }
  }

  return ok({
    has_key: true,
    key_prefix: data.key_prefix,
    created_at: data.created_at,
    revoked: data.revoked,
  })
}
