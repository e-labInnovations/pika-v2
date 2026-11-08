'use client'

import { LogOut } from 'lucide-react'
import React from 'react'

export function SignOut() {
  const [busy, setBusy] = React.useState(false)
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true)
        await fetch('/api/users/logout', { method: 'POST', credentials: 'include' }).catch(() => {})
        window.location.href = '/app/login'
      }}
      className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
    >
      <LogOut className="size-4" />
      <span className="hidden sm:inline">Sign out</span>
    </button>
  )
}
