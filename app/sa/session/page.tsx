import { Suspense } from 'react'
import SessionConfigClient from './SessionConfigClient'

export default function SessionConfigPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-400">Loading…</div>
      </div>
    }>
      <SessionConfigClient />
    </Suspense>
  )
}
