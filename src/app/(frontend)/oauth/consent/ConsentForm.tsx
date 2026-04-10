'use client'

import { useState } from 'react'
import Image from 'next/image'
import { CreditCard, BarChart2, Users, Settings } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { MCP_FULL_PERMISSIONS } from '../../../../plugins/mcp-constants'

interface ConsentFormProps {
  userEmail: string
  clientId: string
  clientName: string
  redirectUri: string
  codeChallenge: string
  state?: string
}

interface AccessItem {
  icon: LucideIcon
  label: string
}

const ACCESS_LIST: AccessItem[] = [
  { icon: CreditCard, label: 'View and manage your accounts and transactions' },
  { icon: BarChart2, label: 'Read your dashboard, categories, and analytics' },
  { icon: Users, label: 'View and manage people and reminders' },
  { icon: Settings, label: 'Read and update your preferences' },
]

export default function ConsentForm({
  userEmail,
  clientId,
  clientName,
  redirectUri,
  codeChallenge,
  state,
}: ConsentFormProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleAllow() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/oauth/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          clientId,
          redirectUri,
          state,
          codeChallenge,
          permissions: MCP_FULL_PERMISSIONS,
          label: clientName,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.redirectTo) {
        setError(data.error_description || data.error || 'Something went wrong')
        setLoading(false)
        return
      }
      window.location.href = data.redirectTo
    } catch {
      setError('Network error — please try again')
      setLoading(false)
    }
  }

  function handleDeny() {
    const url = new URL(redirectUri)
    url.searchParams.set('error', 'access_denied')
    url.searchParams.set('error_description', 'The user denied access')
    if (state) url.searchParams.set('state', state)
    window.location.href = url.toString()
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-[420px]">
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl">
          {/* Header */}
          <div className="px-8 pt-7 pb-6 border-b border-border">
            <div className="flex items-center gap-2.5 mb-5 justify-center">
              <Image src="/icon.svg" alt="Pika" width={32} height={32} className="rounded-lg" />
              <span className="text-base font-semibold text-foreground tracking-tight">Pika</span>
            </div>
            <h1 className="text-xl font-bold text-foreground mb-1.5 leading-snug">
              {clientName} wants access to your account
            </h1>
            <p className="text-sm text-muted-foreground">
              Signed in as <span className="text-foreground font-bold">{userEmail}</span>
            </p>
          </div>

          {/* Access list */}
          <div className="px-8 py-6">
            <p className="text-sm text-muted-foreground mb-4">
              If you approve, <span className="text-foreground font-medium">{clientName}</span> will
              be able to:
            </p>
            <ul className="space-y-3">
              {ACCESS_LIST.map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-3 text-sm">
                  <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center shrink-0">
                    <Icon size={15} className="text-primary" />
                  </div>
                  <span className="text-foreground">{label}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Redirect URI */}
          <div className="px-8 pb-6">
            <div className="bg-muted rounded-xl px-4 py-3 text-xs text-muted-foreground flex gap-2">
              <span className="shrink-0">Redirect URI:</span>
              <span className="text-foreground/70 break-all">{redirectUri}</span>
            </div>
          </div>

          {/* Error */}
          {error && <p className="text-destructive text-sm px-8 pb-4">{error}</p>}

          {/* Actions */}
          <div className="px-8 pb-6 flex gap-3">
            <button
              onClick={handleDeny}
              disabled={loading}
              className="flex-1 py-2.5 px-4 rounded-xl border border-border bg-secondary text-secondary-foreground text-sm font-medium cursor-pointer hover:bg-accent transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleAllow}
              disabled={loading}
              className="flex-1 py-2.5 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold cursor-pointer hover:opacity-90 transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Connecting…' : 'Approve'}
            </button>
          </div>

          {/* Footer note */}
          <p className="text-xs text-muted-foreground/60 px-8 pb-6 text-center leading-relaxed">
            You can revoke access anytime from the Pika App under Settings → Connected Apps.
          </p>
        </div>
      </div>
    </div>
  )
}
