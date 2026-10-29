const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'

let activeKeyIndex = 0

export class GroqRequestError extends Error {
  status: number
  body: string
  rateLimited: boolean

  constructor(status: number, body: string, rateLimited: boolean) {
    super(`Groq request failed with HTTP ${status}.`)
    this.name = 'GroqRequestError'
    this.status = status
    this.body = body
    this.rateLimited = rateLimited
  }
}

function configuredKeys() {
  return [
    process.env.GROQ_API_KEY,
    process.env.GROQ_API_KEY_BACKUP1,
    process.env.GROQ_API_KEY_BACKUP2,
  ].filter((key): key is string => Boolean(key?.trim()))
}

function isQuotaOrRateLimit(status: number, body: string) {
  const message = body.toLowerCase()
  return status === 429 || /rate.?limit|quota|tokens? per (day|minute)|tpd|itpm|requests? per day|daily limit|limit.{0,20}(reached|exceeded)/i.test(message)
}

export async function requestGroq(body: Record<string, unknown>) {
  const keys = configuredKeys()
  if (keys.length === 0) throw new Error('GROQ_API_KEY is not configured.')

  const firstKeyIndex = Math.min(activeKeyIndex, keys.length - 1)
  for (let keyIndex = firstKeyIndex; keyIndex < keys.length; keyIndex += 1) {
    const response = await fetch(GROQ_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${keys[keyIndex]}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (response.ok) {
      activeKeyIndex = keyIndex
      return response
    }

    const errorBody = (await response.text()).replace(/\s+/g, ' ').trim().slice(0, 500)
    const rateLimited = isQuotaOrRateLimit(response.status, errorBody)
    if (rateLimited && keyIndex < keys.length - 1) {
      activeKeyIndex = keyIndex + 1
      console.warn('Groq key limit reached; switching to configured backup key.', { keyIndex, nextKeyIndex: keyIndex + 1, status: response.status })
      continue
    }

    throw new GroqRequestError(response.status, errorBody, rateLimited)
  }

  throw new Error('GROQ_API_KEY is not configured.')
}
