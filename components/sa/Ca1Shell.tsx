'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

const tabs = [
  { label: 'Dashboard', href: '/sa/ca1' },
  { label: 'Cohorts', href: '/sa/ca1/cohorts' },
  { label: 'Assessments', href: '/sa/ca1/assessments' },
  { label: 'Students', href: '/sa/ca1/students' },
  { label: 'Results', href: '/sa/ca1/results' },
]

export default function Ca1Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/sa/login')
  }

  return <div className="ca1-dark min-h-screen bg-gray-900 text-white">
    <header className="sticky top-0 z-20 border-b border-gray-700 bg-gray-800/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-4 sm:px-8 lg:px-12">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500 text-sm font-bold text-white shadow-sm">DW</div>
          <div><p className="text-lg font-bold tracking-tight text-gray-100">Exam Studio</p><p className="text-xs font-semibold uppercase tracking-wider text-blue-400">CA1</p></div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/sa/dashboard" className="hidden rounded-lg border border-gray-600 px-3 py-2 text-sm font-semibold text-gray-300 hover:border-gray-500 hover:text-white sm:inline-flex">← SA Dashboard</Link>
          <button onClick={() => void logout()} className="rounded-lg px-3 py-2 text-sm font-semibold text-gray-400 hover:bg-gray-700 hover:text-red-400">Log out</button>
        </div>
      </div>
      <nav className="mx-auto flex max-w-[1500px] gap-1 overflow-x-auto px-4 sm:px-8 lg:px-12" aria-label="CA1 navigation">
        {tabs.map(tab => {
          const active = tab.href === '/sa/ca1' ? pathname === tab.href : pathname.startsWith(tab.href)
          return <Link key={tab.href} href={tab.href} className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition ${active ? 'border-blue-400 text-blue-300' : 'border-transparent text-gray-400 hover:border-gray-500 hover:text-white'}`}>{tab.label}</Link>
        })}
      </nav>
    </header>
    <main className="mx-auto max-w-[1500px] px-4 py-8 sm:px-8 lg:px-12">{children}</main>
  </div>
}
