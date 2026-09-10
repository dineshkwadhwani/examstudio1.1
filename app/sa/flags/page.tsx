'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Alert } from '@/components/ui/Alert'

interface Flag {
  id: number
  reason: string
  severity: string
  student_ids: number[]
  detail: Record<string, unknown>
  resolved: boolean
  resolution: string | null
  resolved_by: string | null
  resolved_at: string | null
  created_at: string
}

export default function FlagsPage() {
  const router = useRouter()
  const [flags, setFlags] = useState<Flag[]>([])
  const [loading, setLoading] = useState(true)
  const [resolutionText, setResolutionText] = useState<Record<number, string>>({})
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const [showResolved, setShowResolved] = useState(false)

  useEffect(() => {
    fetch('/api/sa/flags')
      .then(r => { if (r.status === 401) { router.push('/sa/login'); throw new Error() } return r.json() })
      .then(d => { setFlags(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [router])

  async function resolve(flagId: number) {
    const resolution = resolutionText[flagId]
    if (!resolution?.trim()) { setError('Resolution text is required.'); return }
    const res = await fetch('/api/sa/flags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ flag_id: flagId, resolution }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.message); return }
    setMsg('Flag resolved.')
    setFlags(flags.map(f => f.id === flagId ? { ...f, resolved: true, resolution } : f))
  }

  const displayFlags = flags.filter(f => showResolved || !f.resolved)

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="text-gray-400">Loading…</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="font-bold">Flags ({flags.filter(f => !f.resolved).length} open)</h1>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
              <input type="checkbox" checked={showResolved} onChange={e => setShowResolved(e.target.checked)} />
              Show resolved
            </label>
            <Link href="/sa/dashboard" className="btn-secondary text-xs">← Dashboard</Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {msg && <Alert type="success" message={msg} />}
        {error && <Alert type="error" message={error} />}

        {displayFlags.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            {showResolved ? 'No flags.' : 'No open flags.'}
          </div>
        )}

        {displayFlags.map(f => (
          <div key={f.id} className={`bg-gray-800 border rounded-xl p-4 ${
            f.resolved ? 'border-gray-700 opacity-60' :
            f.severity === 'serious' ? 'border-red-700' :
            f.severity === 'review' ? 'border-yellow-700' : 'border-gray-700'
          }`}>
            <div className="flex items-start justify-between mb-2">
              <div>
                <span className={`badge text-xs mr-2 ${
                  f.severity === 'serious' ? 'bg-red-900 text-red-300' :
                  f.severity === 'review' ? 'bg-yellow-900 text-yellow-300' :
                  'bg-gray-700 text-gray-300'
                }`}>
                  {f.severity}
                </span>
                <span className="font-semibold text-sm">{f.reason}</span>
              </div>
              <span className="text-xs text-gray-500">{new Date(f.created_at).toLocaleString()}</span>
            </div>

            <div className="text-xs text-gray-400 mb-3 space-y-1">
              <p>Affected student IDs: {f.student_ids.join(', ')}</p>
              {Object.entries(f.detail).map(([k, v]) => (
                <p key={k}><span className="text-gray-500">{k}:</span> {String(v)}</p>
              ))}
            </div>

            {f.resolved ? (
              <div className="text-xs text-green-400">
                ✓ Resolved by {f.resolved_by} — {f.resolution}
              </div>
            ) : (
              <div className="flex gap-2 items-center mt-2">
                <input
                  className="input bg-gray-700 border-gray-600 text-white text-sm flex-1"
                  placeholder="Resolution notes…"
                  value={resolutionText[f.id] ?? ''}
                  onChange={e => setResolutionText(prev => ({ ...prev, [f.id]: e.target.value }))}
                />
                <button onClick={() => resolve(f.id)} className="btn-primary text-xs">Resolve</button>
              </div>
            )}
          </div>
        ))}
      </main>
    </div>
  )
}
