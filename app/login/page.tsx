'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Alert } from '@/components/ui/Alert'

export default function LoginPage() {
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
      body: JSON.stringify({ email, password, role: 'student' }),
    })

    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.message ?? 'Login failed.')
      return
    }

    if (data.must_change_password) {
      router.push('/change-password')
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-blue-50 to-gray-100">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🎓</div>
          <h1 className="text-2xl font-bold text-gray-900">Exam Studio</h1>
          <p className="text-gray-600 mt-1 text-sm">F0003 CA2 — Student Login</p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4">
          <Alert type="error" message={error} />

          <div>
            <label className="label">SIT Email Address</label>
            <input
              type="email"
              className="input"
              placeholder="yourname@sitpune.edu.in"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div>
            <label className="label">Password</label>
            <input
              type="password"
              className="input"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>

          <p className="text-center text-sm text-gray-600">
            Not registered?{' '}
            <Link href="/register" className="text-blue-600 hover:underline">
              Register here
            </Link>
          </p>

          <p className="text-center text-xs text-gray-500">
            Forgot password? Ask the invigilator to reset it.
          </p>
        </form>

        <p className="text-center mt-4 text-xs text-gray-500">
          <Link href="/sa/login" className="hover:underline">Staff login →</Link>
        </p>
      </div>
    </div>
  )
}
