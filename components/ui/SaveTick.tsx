'use client'
import { useEffect, useState } from 'react'

interface SaveTickProps {
  show: boolean
  error?: boolean
}

export function SaveTick({ show, error }: SaveTickProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (show) {
      setVisible(true)
      const id = setTimeout(() => setVisible(false), 2000)
      return () => clearTimeout(id)
    }
  }, [show])

  if (!visible) return null

  return (
    <span className={`text-xs font-medium flex items-center gap-1 ${error ? 'text-red-600' : 'text-green-600'}`}>
      {error ? (
        <>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          Save failed
        </>
      ) : (
        <>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Saved
        </>
      )}
    </span>
  )
}
