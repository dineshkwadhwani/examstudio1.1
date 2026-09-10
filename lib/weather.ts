export interface WeatherResult {
  temperature_c: number | null
  raw: Record<string, unknown> | null
  read_at: string
  error: string | null
}

export async function getCurrentTemperature(
  lat: number,
  lon: number
): Promise<WeatherResult> {
  const read_at = new Date().toISOString()
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m&timezone=auto`
    const wc = new AbortController(); setTimeout(() => wc.abort(), 10_000)
    const res = await fetch(url, { signal: wc.signal })
    if (!res.ok) {
      return { temperature_c: null, raw: null, read_at, error: `open-meteo ${res.status}` }
    }
    const json = await res.json()
    const temperature_c = json?.current?.temperature_2m ?? null
    return { temperature_c, raw: json, read_at, error: null }
  } catch (e) {
    return { temperature_c: null, raw: null, read_at, error: String(e) }
  }
}
