'use client'

import { useState } from 'react'
import { CreditCard, BarChart2, Users, Settings } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

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

const FULL_PERMISSIONS = {
  transactions: { find: true, create: true, update: true, delete: true },
  accounts: { find: true, create: true, update: true, delete: true },
  people: { find: true, create: true, update: true, delete: true },
  categories: { find: true },
  tags: { find: true },
  reminders: { find: true, create: true, update: true, delete: true },
  userSettings: { find: true, update: true },
  'payload-mcp-tool': {
    getDashboardSummary: true,
    getMonthlyCategories: true,
    getMonthlyTags: true,
    getMonthlyPeople: true,
  },
  'payload-mcp-resource': {
    currencies: true,
    currency: true,
    timezones: true,
    timezone: true,
  },
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
          permissions: FULL_PERMISSIONS,
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
    <div style={{ maxWidth: 440, margin: '60px auto', fontFamily: 'system-ui, sans-serif', padding: '0 16px' }}>
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '28px 32px 24px', borderBottom: '1px solid #f3f4f6' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.svg" alt="Pika" width={36} height={36} style={{ borderRadius: 8 }} />
            <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>Pika</span>
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 6px' }}>
            {clientName} wants access to your account
          </h1>
          <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
            Signed in as <strong>{userEmail}</strong>
          </p>
        </div>

        {/* Access list */}
        <div style={{ padding: '20px 32px' }}>
          <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
            If you approve, <strong>{clientName}</strong> will be able to:
          </p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {ACCESS_LIST.map(({ icon: Icon, label }) => (
              <li key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
                <Icon size={18} style={{ flexShrink: 0, color: '#6b7280' }} />
                <span style={{ color: '#374151' }}>{label}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Details */}
        <div style={{ padding: '0 32px 20px' }}>
          <div style={{ background: '#f9fafb', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: '#6b7280' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <span style={{ flexShrink: 0 }}>Redirect URI:</span>
              <span style={{ color: '#374151', wordBreak: 'break-all' }}>{redirectUri}</span>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <p style={{ color: '#dc2626', fontSize: 14, padding: '0 32px 16px', margin: 0 }}>{error}</p>
        )}

        {/* Actions */}
        <div style={{ padding: '16px 32px 28px', display: 'flex', gap: 12 }}>
          <button
            onClick={handleDeny}
            disabled={loading}
            style={{
              flex: 1,
              padding: '10px 16px',
              border: '1px solid #d1d5db',
              borderRadius: 8,
              background: 'white',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleAllow}
            disabled={loading}
            style={{
              flex: 1,
              padding: '10px 16px',
              border: 'none',
              borderRadius: 8,
              background: loading ? '#9ca3af' : '#111827',
              color: 'white',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            {loading ? 'Connecting…' : 'Approve'}
          </button>
        </div>

        <p style={{ fontSize: 12, color: '#9ca3af', padding: '0 32px 20px', margin: 0, textAlign: 'center' }}>
          You can revoke access anytime from the Pika App under Settings → Connected Apps.
        </p>
      </div>
    </div>
  )
}
