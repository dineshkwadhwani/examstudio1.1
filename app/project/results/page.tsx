'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/student/PageHeader'

type Result = {
  team: { name: string }
  sections: Array<{ category: string; max_marks: number; marks: number | null }>
  individual: { max_marks: number; marks: number | null }
  total_marks: number
  total_max_marks: number
}

export default function ProjectResultsPage() {
  const router = useRouter()
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/me/ca3-results').then(async response => {
      if (response.status === 401) { router.push('/login'); return }
      const payload = await response.json()
      if (!response.ok) { setError(payload.message ?? payload.error ?? 'Results are not available.'); return }
      setResult(payload)
    }).catch(() => setError('Could not load results.'))
  }, [router])

  return <>
    <PageHeader title="CA3 Results" />
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <Link href="/project/artifacts" className="text-sm text-blue-700 hover:underline">← Back to artifacts</Link>
      {error && <div className="card text-red-700">{error}</div>}
      {!result && !error && <div className="card text-sm text-gray-600">Loading results…</div>}
      {result && <>
        <section className="card">
          <p className="text-sm text-gray-500">Team</p>
          <h2 className="text-xl font-bold text-gray-900">{result.team.name}</h2>
        </section>
        <section className="card">
          <h2 className="font-semibold text-gray-900">Section-wise marks</h2>
          <div className="mt-4 divide-y rounded-lg border">
            {result.sections.map(section => <div key={section.category} className="flex items-center justify-between p-3 text-sm">
              <span className="capitalize text-gray-700">{section.category.replaceAll('_', ' ')}</span>
              <span className="font-semibold text-gray-900">{section.marks ?? '—'} / {section.max_marks}</span>
            </div>)}
            <div className="flex items-center justify-between p-3 text-sm">
              <span className="text-gray-700">Individual contribution</span>
              <span className="font-semibold text-gray-900">{result.individual.marks ?? '—'} / {result.individual.max_marks}</span>
            </div>
          </div>
          <div className="mt-6 flex items-center justify-between border-t pt-4 text-lg font-bold text-gray-900">
            <span>Total</span><span>{result.total_marks} / {result.total_max_marks}</span>
          </div>
        </section>
      </>}
    </main>
  </>
}
