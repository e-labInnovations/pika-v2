'use client'

import React from 'react'

/** Optional email + password sign-in (Payload's local login sets the same payload-token cookie). */
export function PasswordLogin() {
  const [open, setOpen] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-4 text-sm text-muted-foreground hover:text-foreground hover:underline">
        Sign in with email and password
      </button>
    )
  }

  return (
    <form
      className="mt-6 grid gap-3 text-left"
      onSubmit={async (e) => {
        e.preventDefault()
        const form = new FormData(e.currentTarget)
        setBusy(true)
        setError(null)
        const res = await fetch('/api/users/login', {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email: form.get('email'), password: form.get('password') }),
        }).catch(() => null)
        if (res?.ok) {
          window.location.href = '/app'
          return
        }
        setBusy(false)
        setError(res?.status === 401 ? 'Wrong email or password.' : 'Sign-in failed. Try again.')
      }}
    >
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>
      <input name="email" type="email" required autoComplete="email" placeholder="Email" className="h-11 rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40" />
      <input name="password" type="password" required autoComplete="current-password" placeholder="Password" className="h-11 rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40" />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <button type="submit" disabled={busy} className="h-11 rounded-xl border bg-secondary text-sm font-semibold hover:bg-accent disabled:opacity-60">
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}
