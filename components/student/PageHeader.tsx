import Link from 'next/link'
import { AccountMenu } from './AccountMenu'

export function PageHeader({ title }: { title: string }) {
  return <header className="sticky top-0 z-20 border-b border-gray-200 bg-white">
    <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div><Link href="/dashboard" className="text-xs text-blue-700">Exam Studio</Link><h1 className="text-xl font-bold text-gray-900">{title}</h1></div>
      <AccountMenu />
    </div>
  </header>
}
