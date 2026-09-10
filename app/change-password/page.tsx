'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Alert } from '@/components/ui/Alert'

export default function ChangePasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match.'); return }
    if (password.length < 8)  { setError('Password must be at least 8 characters.'); return }

    setLoading(true)
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ new_password: password }),
    })
    const data = await res.json()
    setLoading(false)

    if (!res.ok) { setError(data.message ?? 'Failed.'); return }
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-blue-50 to-gray-100">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Set Your Password</h1>
          <p className="text-gray-600 mt-1 text-sm">Your password has been reset. Please set a new one to continue.</p>
        </div>
        <form onSubmit={handleSubmit} className="card space-y-4">
          <Alert type="error" message={error} />
          <div>
            <label className="label">New Password</label>
            <input type="password" className="input" value={password}
              onChange={e => setPassword(e.target.value)} required minLength={8} placeholder="Min 8 characters" />
          </div>
          <div>
            <label className="label">Confirm Password</label>
            <input type="password" className="input" value={confirm}
              onChange={e => setConfirm(e.target.value)} required placeholder="Repeat password" />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Saving…' : 'Set Password'}
          </button>
        </form>
      </div>
    </div>
  )
}
