'use client'

import { X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import React from 'react'

/** Side panel over the list; closing goes back to it. */
export function Panel({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && router.back()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [router])
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={() => router.back()} />
      <aside className="absolute inset-y-0 right-0 w-full max-w-md overflow-y-auto border-l bg-card p-6 shadow-2xl">
        <button type="button" aria-label="Close" onClick={() => router.back()} className="absolute top-4 right-4 rounded-lg p-2 hover:bg-accent">
          <X className="size-4" />
        </button>
        {children}
      </aside>
    </div>
  )
}
