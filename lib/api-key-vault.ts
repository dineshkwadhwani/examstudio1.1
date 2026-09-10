const encoder = new TextEncoder()
const decoder = new TextDecoder()

async function vaultKey(): Promise<CryptoKey> {
  const secret = process.env.SESSION_SECRET
  if (!secret) throw new Error('SESSION_SECRET must be configured to protect API keys.')
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(secret))
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

export async function encryptApiKey(value: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await vaultKey(), encoder.encode(value))
  return `${Buffer.from(iv).toString('base64url')}.${Buffer.from(encrypted).toString('base64url')}`
}

export async function decryptApiKey(ciphertext: string): Promise<string> {
  const [ivValue, encryptedValue] = ciphertext.split('.')
  if (!ivValue || !encryptedValue) throw new Error('Invalid encrypted API key.')
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: Buffer.from(ivValue, 'base64url') },
    await vaultKey(),
    Buffer.from(encryptedValue, 'base64url')
  )
  return decoder.decode(decrypted)
}
