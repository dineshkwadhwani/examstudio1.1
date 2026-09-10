'use client'
import { useEffect, useState } from 'react'

interface CountdownProps {
  endsAt: string
  onExpired?: () => void
}

export function Countdown({ endsAt, onExpired }: CountdownProps) {
  const [secsLeft, setSecsLeft] = useState(() =>
    Math.max(0, Math.floor((new Date(endsAt).getTime() - Date.now()) / 1000))
  )

  useEffect(() => {
    if (secsLeft <= 0) { onExpired?.(); return }
    const id = setInterval(() => {
      setSecsLeft(prev => {
        if (prev <= 1) { onExpired?.(); clearInterval(id); return 0 }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [endsAt, onExpired])

  const h = Math.floor(secsLeft / 3600)
  const m = Math.floor((secsLeft % 3600) / 60)
  const s = secsLeft % 60
  const str = [h > 0 ? String(h).padStart(2,'0') : null, String(m).padStart(2,'0'), String(s).padStart(2,'0')]
    .filter(Boolean).join(':')

  const urgent = secsLeft < 300

  return (
    <span className={`font-mono text-xl font-bold ${urgent ? 'text-red-600 animate-pulse' : 'text-gray-800'}`}>
      {str}
    </span>
  )
}
