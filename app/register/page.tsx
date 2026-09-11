'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Alert } from '@/components/ui/Alert'

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({ name: '', prn: '', email: '', phone: '', password: '' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  function set(field: string) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [field]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.message ?? 'Registration failed.')
      return
    }

    setSuccess('Registration successful! Redirecting to login…')
    setTimeout(() => router.push('/login'), 2000)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-blue-50 to-gray-100">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">📝</div>
          <h1 className="text-2xl font-bold text-gray-900">Student Registration</h1>
          <p className="text-gray-600 mt-1 text-sm">F0003 CA2 Practical Examination</p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4">
          <Alert type="error" message={error} />
          <Alert type="success" message={success} />

          <div>
            <label className="label">Full Name</label>
            <input className="input" placeholder="As per roster" value={form.name} onChange={set('name')} required />
          </div>

          <div>
            <label className="label">PRN</label>
            <input className="input" placeholder="e.g. 23070122004" value={form.prn} onChange={set('prn')} required />
          </div>

          <div>
            <label className="label">SIT Email Address</label>
            <input type="email" className="input" placeholder="yourname@sitpune.edu.in"
              value={form.email} onChange={set('email')} required />
          </div>

          <div>
            <label className="label">Mobile Number</label>
            <input type="tel" className="input" placeholder="10-digit Indian number"
              value={form.phone} onChange={set('phone')} required />
          </div>

          <div>
            <label className="label">Password</label>
            <input type="password" className="input" placeholder="Minimum 8 characters"
              value={form.password} onChange={set('password')} required minLength={8} />
          </div>

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Registering…' : 'Create Account'}
          </button>

          <p className="text-center text-sm text-gray-600">
            Already registered?{' '}
            <Link href="/login" className="text-blue-600 hover:underline">Log in</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
