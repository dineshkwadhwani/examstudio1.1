'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Alert } from '@/components/ui/Alert'

interface Session {
  id: number
  label: string
  status: string
  corpus_hash: string
  corpus_manifest: unknown[]
  reference_table: Record<string, unknown>
  sheet_csv_url: string
  sheet_snapshot: Record<string, unknown>
  relax_apify_verification: boolean
  created_at: string
}

export default function SessionConfigClient() {
  const router = useRouter()
  const params = useSearchParams()
  const sessionId = params.get('id')

  const [session, setSession] = useState<Session | null>(null)
  const [allSessions, setAllSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')
  const [errMsg, setErrMsg] = useState('')
  const [saving, setSaving] = useState(false)

  const [refJson, setRefJson] = useState('')
  const [manifestJson, setManifestJson] = useState('')
  const [corpusHash, setCorpusHash] = useState('')

  const load = useCallback(async () => {
    const res = await fetch('/api/sa/session')
    if (res.status === 401 || res.status === 403) { router.push('/sa/login'); return }
    const sessions: Session[] = await res.json()
    setAllSessions(sessions)
    const s = sessionId ? sessions.find(s => String(s.id) === sessionId) : sessions[0]
    if (s) setSession(s)
    setLoading(false)
  }, [sessionId, router])

  useEffect(() => { load() }, [load])

  async function uploadRefTable() {
    if (!session) return
    setSaving(true); setMsg(''); setErrMsg('')

    let parsed: unknown
    try { parsed = JSON.parse(refJson) } catch {
      setErrMsg('Invalid JSON in reference table.'); setSaving(false); return
    }

    let manifestParsed: unknown[] = []
    if (manifestJson.trim()) {
      try { manifestParsed = JSON.parse(manifestJson) } catch {
        setErrMsg('Invalid JSON in manifest.'); setSaving(false); return
      }
    }

    const res = await fetch('/api/sa/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'set_reference_table',
        session_id: session.id,
        reference_table: parsed,
        corpus_hash: corpusHash.trim(),
        corpus_manifest: manifestParsed,
      }),
    })
    const data = await res.json()
    setSaving(false)
    if (res.ok) {
      setMsg('Reference table uploaded successfully.')
      setRefJson(''); setManifestJson(''); setCorpusHash('')
      load()
    } else {
      setErrMsg(data.message ?? 'Failed.')
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-gray-400">Loading…</div>
    </div>
  )

  const wordCount = session?.reference_table ? Object.keys(session.reference_table).length : 0
  const snapshotCount = session?.sheet_snapshot ? Object.keys(session.sheet_snapshot).length : 0

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/sa/dashboard" className="text-gray-400 hover:text-white text-sm">← Dashboard</Link>
            <span className="text-gray-600">|</span>
            <h1 className="font-bold text-white">Session Configuration</h1>
          </div>
          {session && (
            <span className={`text-xs px-3 py-1 rounded-full font-medium ${
              session.status === 'running' ? 'bg-green-900 text-green-300' :
              session.status === 'registration_open' ? 'bg-blue-900 text-blue-300' :
              'bg-gray-700 text-gray-400'
            }`}>
              {session.label} — {session.status}
            </span>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {msg && <Alert type="success" message={msg} />}
        {errMsg && <Alert type="error" message={errMsg} />}

        {/* Session selector if multiple */}
        {allSessions.length > 1 && (
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
            <label className="label text-gray-300 text-xs mb-2">Select session</label>
            <div className="flex flex-wrap gap-2">
              {allSessions.filter(s => s.status !== 'archived').map(s => (
                <button
                  key={s.id}
                  onClick={() => setSession(s)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium ${
                    session?.id === s.id ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {s.label} ({s.status})
                </button>
              ))}
            </div>
          </div>
        )}

        {!session && (
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
            <p className="text-gray-400 text-sm">No session found. <Link href="/sa/dashboard" className="text-blue-400 underline">Create one from the dashboard.</Link></p>
          </div>
        )}

        {session && (
          <>
            {/* Info */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 space-y-3">
              <h2 className="font-semibold text-gray-100">Session Status</h2>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-gray-400 text-xs">Reference table</p>
                  <p className={wordCount > 0 ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>
                    {wordCount > 0 ? `${wordCount} words ✓` : 'Not set ⚠'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs">Sheet snapshot</p>
                  <p className={snapshotCount > 0 ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>
                    {snapshotCount > 0 ? `${snapshotCount} students ✓` : 'Not set ⚠'}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-gray-400 text-xs">Corpus hash</p>
                  <p className="text-gray-300 font-mono text-xs break-all">{session.corpus_hash || '—'}</p>
                </div>
              </div>
            </div>

            {/* Upload form */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 space-y-4">
              <div>
                <h2 className="font-semibold text-gray-100 mb-1">Upload Reference Table</h2>
                <p className="text-xs text-gray-400">
                  Run: <code className="bg-gray-700 px-1.5 py-0.5 rounded text-green-400">npx ts-node --project tsconfig.node.json scripts/generate-corpus.ts</code>
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Then paste the contents of <code className="bg-gray-700 px-1 rounded">public/corpus/reference-table.json</code> below.
                </p>
              </div>

              <div>
                <label className="label text-gray-300 text-xs">reference-table.json</label>
                <textarea
                  className="input bg-gray-700 border-gray-600 text-gray-100 text-xs font-mono h-48 resize-y mt-1"
                  value={refJson}
                  onChange={e => setRefJson(e.target.value)}
                  placeholder={'{\n  "agent": { "total": 3847, "pages": { "1": 782, "2": 761, "3": 798, "4": 756, "5": 750 } },\n  "model": { "total": 3912, "pages": { ... } },\n  ...\n}'}
                />
                <p className="text-xs text-gray-500 mt-1">{refJson.trim().length} characters</p>
              </div>

              <div>
                <label className="label text-gray-300 text-xs">Corpus SHA-256 hash (from manifest.json)</label>
                <input
                  className="input bg-gray-700 border-gray-600 text-gray-100 text-xs font-mono mt-1"
                  value={corpusHash}
                  onChange={e => setCorpusHash(e.target.value)}
                  placeholder="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
                />
              </div>

              <div>
                <label className="label text-gray-300 text-xs">manifest.json (optional)</label>
                <textarea
                  className="input bg-gray-700 border-gray-600 text-gray-100 text-xs font-mono h-20 resize-y mt-1"
                  value={manifestJson}
                  onChange={e => setManifestJson(e.target.value)}
                  placeholder={'[{ "filename": "page1.html", "url": "/corpus/page1.html", "hash": "...", "page_no": 1 }, ...]'}
                />
              </div>

              <button onClick={uploadRefTable} disabled={saving || !refJson.trim()} className="btn-primary">
                {saving ? 'Uploading…' : 'Upload Reference Table'}
              </button>
            </div>

            {/* Checklist */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
              <h2 className="font-semibold text-gray-100 mb-3">Pre-exam Checklist</h2>
              <ol className="space-y-2 text-sm list-decimal list-inside">
                <li className={snapshotCount > 0 ? 'text-green-400' : 'text-gray-400'}>
                  Sheet snapshot — {snapshotCount > 0 ? `${snapshotCount} students ✓` : 'set when session was created'}
                </li>
                <li className={wordCount > 0 ? 'text-green-400' : 'text-yellow-400'}>
                  Reference table — {wordCount > 0 ? `${wordCount} words ✓` : '⚠ upload above before starting'}
                </li>
                <li className="text-gray-300">Open registration → students register and generate keys</li>
                <li className="text-gray-300">Students complete MCQ (10 questions)</li>
                <li className="text-gray-300">Start exam (50-minute clock begins)</li>
                <li className="text-gray-300">Close exam (or auto-closes at end time)</li>
                <li className="text-gray-300">Archive after verification completes and reports generated</li>
              </ol>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
