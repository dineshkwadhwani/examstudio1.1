'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

export function AccountMenu() {
  const [student, setStudent] = useState<{ name: string; prn: string; email: string } | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)
  const [error, setError] = useState('')
  const menu = useRef<HTMLDetailsElement>(null)

  useEffect(() => {
    let active = true
    fetch('/api/me/profile', { cache: 'no-store' })
      .then(async response => {
        if (!active) return
        if (response.status === 401 || response.status === 403) {
          window.location.replace('/login')
          return
        }
        if (!response.ok) throw new Error('Could not load account details.')
        const profile = await response.json()
        if (active) setStudent(profile)
      })
      .catch(() => {
        if (active) setError('Could not load account details. Refresh to try again.')
      })
    function closeOutside(event: PointerEvent) {
      if (menu.current && !menu.current.contains(event.target as Node)) menu.current.open = false
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && menu.current?.open) {
        menu.current.open = false
        menu.current.querySelector('summary')?.focus()
      }
    }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      active = false
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [])

  async function logout() {
    setLoggingOut(true)
    setError('')
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' })
      if (!response.ok) throw new Error('Logout failed')
      window.location.replace('/login')
    } catch {
      setError('Could not log out. Please try again.')
      setLoggingOut(false)
    }
  }

  return (
    <details ref={menu} className="relative shrink-0">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-blue-600" aria-label={`Account menu for ${student?.name ?? 'student'}`}>
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 font-semibold text-blue-800" aria-hidden="true">{student?.name?.trim().charAt(0).toUpperCase() || '●'}</span>
        <span className="max-w-28 truncate sm:max-w-48">{student?.name ?? 'My account'}</span>
        <span aria-hidden="true">▾</span>
      </summary>
      <div className="absolute right-0 z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-gray-200 bg-white p-2 text-sm text-gray-900 shadow-lg">
        {student && <div className="border-b border-gray-100 px-3 py-2">
          <p className="font-semibold break-words">{student.name}</p>
          <p className="text-xs text-gray-600 break-all">{student.email}</p>
          <p className="mt-1 text-xs text-gray-500">PRN: {student.prn}</p>
        </div>}
        <nav aria-label="Student account" onClick={() => { if (menu.current) menu.current.open = false }}>
          <Link href="/profile" className="block rounded-lg px-3 py-2 hover:bg-gray-100">My profile</Link>
          <Link href="/my-exams" className="block rounded-lg px-3 py-2 hover:bg-gray-100">My Exams</Link>
          <Link href="/dashboard" className="block rounded-lg px-3 py-2 hover:bg-gray-100">Dashboard</Link>
        </nav>
        <button onClick={logout} disabled={loggingOut} className="w-full rounded-lg px-3 py-2 text-left text-red-700 hover:bg-red-50 disabled:opacity-50">{loggingOut ? 'Logging out…' : 'Log out'}</button>
        {error && <p role="alert" className="px-3 py-2 text-xs text-red-700">{error}</p>}
      </div>
    </details>
  )
}
