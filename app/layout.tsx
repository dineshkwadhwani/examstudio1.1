import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Exam Studio — F0003 CA1',
  description: 'CA1 Practical Examination — Autonomous AI Systems and Agent-Based Computing',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 min-h-screen" style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
        {children}
      </body>
    </html>
  )
}
