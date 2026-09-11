'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Alert } from '@/components/ui/Alert'

export default function SALoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, role: 'staff' }),
    })
    const data = await res.json()
    setLoading(false)

    if (!res.ok) { setError(data.message ?? 'Login failed.'); return }
    router.push('/sa/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-gray-800 to-gray-950">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🔐</div>
          <h1 className="text-2xl font-bold text-white">Staff Login</h1>
          <p className="text-gray-400 mt-1 text-sm">Exam Studio — F0003 CA2</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-700 rounded-xl p-6 space-y-4">
          <Alert type="error" message={error} />
          <div>
            <label className="label text-gray-300">Email</label>
            <input type="email" className="input bg-gray-800 border-gray-600 text-white placeholder-gray-500"
              value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="label text-gray-300">Password</label>
            <input type="password" className="input bg-gray-800 border-gray-600 text-white"
              value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
