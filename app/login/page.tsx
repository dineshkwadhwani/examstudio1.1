'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Alert } from '@/components/ui/Alert'

interface RegistrationOption {
  session_id: number
  label: string
  code: string
  title: string
  course_code: string | null
  total_marks: number | null
  duration_minutes: number | null
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [registrationOptions, setRegistrationOptions] = useState<RegistrationOption[]>([])

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

  useEffect(() => {
    let active = true
    fetch('/api/auth/registration-options')
      .then(response => response.ok ? response.json() as Promise<{ exams?: RegistrationOption[] }> : null)
      .then(data => {
        if (active) setRegistrationOptions(data?.exams ?? [])
      })
      .catch(() => {
        // Registration discovery is supplemental; keep the login form usable.
      })
    return () => { active = false }
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-gradient-to-br from-blue-50 to-gray-100">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🎓</div>
          <h1 className="text-2xl font-bold text-gray-900">Exam Studio</h1>
          <p className="text-gray-600 mt-1 text-sm">F0003 CA2/CA3 — Student Login</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,28rem)_minmax(0,1fr)] lg:items-start">
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

          <section aria-labelledby="open-registrations-title" className="space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Open now</p>
              <h2 id="open-registrations-title" className="mt-1 text-xl font-bold text-gray-900">Register for an exam</h2>
              <p className="mt-1 text-sm text-gray-600">Choose an exam below to create your student account.</p>
            </div>

            {registrationOptions.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {registrationOptions.map(exam => (
                  <Link
                    key={exam.session_id}
                    href="/register"
                    className="card border-blue-200 bg-white transition hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">{exam.code}</p>
                        <h3 className="mt-1 font-semibold text-gray-900">{exam.title}</h3>
                      </div>
                      <span className="shrink-0 rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">Open</span>
                    </div>
                    <p className="mt-2 text-sm text-gray-600">{exam.label}</p>
                    <p className="mt-3 text-sm font-semibold text-blue-700">Register now →</p>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-gray-300 bg-white/70 p-5 text-sm text-gray-600">
                No exam registrations are open right now. Please check back later.
              </div>
            )}
          </section>
        </div>

        <p className="text-center mt-4 text-xs text-gray-500">
          <Link href="/sa/login" className="hover:underline">Staff login →</Link>
        </p>
      </div>
    </div>
  )
}
