'use client'

import React, { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import DynamicIcon from '@/components/lucide/dynamic-icon'
import { IconPicker, Icon, type IconName } from '@/components/ui/icon-picker'
import { iconsData } from '@/components/ui/icons-data'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Credentials = { url: string; username: string; appPassword: string }

type OldMedia = { id: number; url: string; name: string; size: number; type: string }
type OldAccount = { id: number; name: string; icon: string; color: string; bgColor: string; description?: string; avatar?: OldMedia | null }
type OldCategory = { id: number; name: string; icon: string; color: string; bgColor: string; type: string; parentId?: number | null; description?: string; children?: OldCategory[] }
type OldTag = { id: number; name: string; icon: string; color: string; bgColor: string; description?: string }
type OldPerson = { id: number; name: string; email?: string; phone?: string; description?: string; avatar?: OldMedia | null }
type OldTransaction = {
  id: number; title: string; amount: number; date: string; type: string
  category?: { id: number }; account?: { id: number }; toAccount?: { id: number }; person?: { id: number }
  tags?: Array<{ id: number }>; note?: string; attachments?: OldMedia[]
}

type V2Record = { id: string; name: string; hasAvatar?: boolean }
type V2CategoryRecord = { id: string; name: string; parentId?: string | null }

type FailedTransactionDetail = {
  title: string
  amount: string
  date: string
  type: string
  note: string
  categoryV2Id?: string
  accountV2Id?: string
  reason: string
  rawOldData?: Record<string, unknown>
}

type ItemAction = 'create' | 'use_existing' | 'skip'
type AvatarAction = 'skip' | 'upload_new' | 'override_existing' | 'keep_existing'

type AccountMapping = { oldItem: OldAccount; action: ItemAction; existingId?: string; icon: string; avatarAction: AvatarAction }
type TagMapping = { oldItem: OldTag; action: ItemAction; existingId?: string; icon: string }
type PersonMapping = { oldPerson: OldPerson; action: ItemAction; existingId?: string; avatarAction: AvatarAction }
type CategoryMapping = {
  oldItem: OldCategory; action: ItemAction; existingId?: string; icon: string; newParentId?: string
}

type MigrationResult = { created: number; skipped: number; failed: number; errors?: string[]; idMap?: Record<string, string> }

type StepResults = {
  accounts?: MigrationResult & { idMap: Record<string, string> }
  tags?: MigrationResult & { idMap: Record<string, string> }
  people?: MigrationResult & { idMap: Record<string, string> }
  categories?: MigrationResult & { idMap: Record<string, string> }
  transactions?: MigrationResult
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_ICON_NAMES = new Set(iconsData.map((i) => i.name))

function isValidIcon(name: string): name is IconName {
  return VALID_ICON_NAMES.has(name)
}

function safeIcon(name: string, fallback: string): string {
  return isValidIcon(name) ? name : fallback
}

async function apiPost<T = unknown>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
  return data as T
}

// ---------------------------------------------------------------------------
// Small shared UI pieces
// ---------------------------------------------------------------------------

function StepHeader({ icon, title, subtitle }: { icon: string; title: string; subtitle?: string }) {
  return (
    <div className="mb-6 flex items-start gap-3">
      <div
        style={{
          background: 'var(--theme-elevation-100)',
          borderRadius: '0.75rem',
          padding: '0.6rem',
          flexShrink: 0,
        }}
      >
        <DynamicIcon name={icon as IconName} size={20} style={{ color: 'var(--theme-text)' }} />
      </div>
      <div>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 600, margin: 0 }}>{title}</h2>
        {subtitle && (
          <p style={{ fontSize: '0.8rem', opacity: 0.55, marginTop: '0.2rem', marginBottom: 0 }}>
            {subtitle}
          </p>
        )}
      </div>
    </div>
  )
}

function Alert({ type, children }: { type: 'error' | 'success' | 'warning' | 'info'; children: React.ReactNode }) {
  const cfg: Record<string, { bg: string; fg: string; icon: string }> = {
    error: { bg: 'rgba(239,68,68,0.08)', fg: '#ef4444', icon: 'circle-x' },
    success: { bg: 'rgba(16,185,129,0.08)', fg: '#10b981', icon: 'circle-check' },
    warning: { bg: 'rgba(245,158,11,0.08)', fg: '#f59e0b', icon: 'triangle-alert' },
    info: { bg: 'rgba(99,102,241,0.08)', fg: '#6366f1', icon: 'info' },
  }
  const { bg, fg, icon } = cfg[type]
  return (
    <div
      style={{
        background: bg,
        color: fg,
        borderRadius: '0.5rem',
        padding: '0.625rem 0.875rem',
        fontSize: '0.8rem',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.5rem',
        marginBottom: '1rem',
      }}
    >
      <DynamicIcon name={icon as IconName} size={14} style={{ flexShrink: 0, marginTop: 2 }} />
      <span>{children}</span>
    </div>
  )
}

function Btn({
  onClick,
  disabled,
  loading,
  variant = 'primary',
  children,
}: {
  onClick?: () => void
  disabled?: boolean
  loading?: boolean
  variant?: 'primary' | 'secondary' | 'danger'
  children: React.ReactNode
}) {
  const bg: Record<string, string> = {
    primary: 'var(--theme-success-400)',
    secondary: 'var(--theme-elevation-150)',
    danger: '#ef4444',
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        background: disabled || loading ? 'var(--theme-elevation-100)' : bg[variant],
        color: variant === 'secondary' ? 'var(--theme-text)' : '#fff',
        border: variant === 'secondary' ? '1px solid var(--theme-border-color)' : 'none',
        borderRadius: '0.5rem',
        padding: '0.5rem 1.1rem',
        fontSize: '0.85rem',
        fontWeight: 600,
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '0.45rem',
        opacity: disabled ? 0.5 : 1,
        transition: 'opacity 0.15s, background 0.15s',
      }}
    >
      {loading && <DynamicIcon name="loader-circle" size={13} className="animate-spin" />}
      {children}
    </button>
  )
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        background: 'var(--theme-elevation-50)',
        border: '1px solid var(--theme-border-color)',
        borderRadius: '0.75rem',
        padding: '1rem 1.125rem',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

function ResultBadge({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.15rem',
        minWidth: 64,
      }}
    >
      <span style={{ fontSize: '1.5rem', fontWeight: 700, color }}>{count}</span>
      <span style={{ fontSize: '0.72rem', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 1 — Connect
// ---------------------------------------------------------------------------

function ConnectStep({
  onConnected,
}: {
  onConnected: (creds: Credentials, siteInfo: unknown) => void
}) {
  const [url, setUrl] = useState('')
  const [username, setUsername] = useState('')
  const [appPassword, setAppPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleConnect = async () => {
    setError('')
    setLoading(true)
    try {
      const data = await apiPost<{ ok: boolean; user: unknown }>('/migrate/connect', {
        url,
        username,
        appPassword,
      })
      onConnected({ url, username, appPassword }, data.user)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.55rem 0.75rem',
    borderRadius: '0.45rem',
    border: '1px solid var(--theme-border-color)',
    background: 'var(--theme-elevation-100)',
    color: 'var(--theme-text)',
    fontSize: '0.875rem',
    outline: 'none',
    boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.78rem',
    fontWeight: 600,
    opacity: 0.7,
    marginBottom: '0.35rem',
  }

  return (
    <div style={{ maxWidth: 480 }}>
      <StepHeader icon="plug" title="Connect to Old Pika" subtitle="Enter your WordPress site URL and App Password to authenticate." />

      {error && <Alert type="error">{error}</Alert>}

      <Alert type="info">
        In your WordPress admin, go to <strong>Users → Profile → Application Passwords</strong> and
        generate a new password for Pika migration. Use your WordPress username and that app password
        below.
      </Alert>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <label htmlFor="migrate-url" style={labelStyle}>Old Pika WordPress URL</label>
          <input
            id="migrate-url"
            style={inputStyle}
            type="url"
            placeholder="https://yoursite.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="migrate-username" style={labelStyle}>WordPress Username</label>
          <input
            id="migrate-username"
            style={inputStyle}
            type="text"
            placeholder="admin"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="migrate-password" style={labelStyle}>Application Password</label>
          <input
            id="migrate-password"
            style={inputStyle}
            type="password"
            placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
            value={appPassword}
            onChange={(e) => setAppPassword(e.target.value)}
          />
          <p style={{ fontSize: '0.72rem', opacity: 0.5, marginTop: '0.3rem' }}>
            Credentials are only used for this session and are never stored.
          </p>
        </div>

        <Btn
          onClick={handleConnect}
          loading={loading}
          disabled={!url || !username || !appPassword}
        >
          <DynamicIcon name="plug" size={13} />
          Test Connection
        </Btn>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 2 — Accounts
// ---------------------------------------------------------------------------

function AccountsStep({
  creds,
  v2Accounts,
  onComplete,
}: {
  creds: Credentials
  v2Accounts: V2Record[]
  onComplete: (mappings: AccountMapping[], result: MigrationResult & { idMap: Record<string, string> }) => void
}) {
  const [oldAccounts, setOldAccounts] = useState<OldAccount[]>([])
  const [mappings, setMappings] = useState<AccountMapping[]>([])
  const [loading, setLoading] = useState(true)
  const [migrating, setMigrating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    apiPost<OldAccount[]>('/migrate/fetch', { ...creds, resource: 'accounts' })
      .then((data) => {
        const items = Array.isArray(data) ? data : []
        const maps: AccountMapping[] = items.map((a) => {
          const match = v2Accounts.find((v) => v.name.toLowerCase() === a.name.toLowerCase())
          let avatarAction: AvatarAction = 'skip'
          if (a.avatar) {
            if (match) {
              avatarAction = match.hasAvatar ? 'keep_existing' : 'upload_new'
            } else {
              avatarAction = 'upload_new'
            }
          }
          return {
            oldItem: a,
            action: match ? 'use_existing' : 'create',
            existingId: match?.id,
            icon: safeIcon(a.icon, 'wallet'),
            avatarAction,
          }
        })
        setOldAccounts(items)
        setMappings(maps)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const updateMapping = (idx: number, patch: Partial<AccountMapping>) => {
    setMappings((prev) => prev.map((m, i) => (i === idx ? { ...m, ...patch } : m)))
  }

  const handleMigrate = async () => {
    setMigrating(true)
    try {
      const payload = mappings.map((m) => ({
        action: m.action,
        oldId: m.oldItem.id,
        existingId: m.existingId,
        name: m.oldItem.name,
        icon: m.icon,
        color: m.oldItem.color,
        bgColor: m.oldItem.bgColor,
        description: m.oldItem.description,
        avatarAction: m.avatarAction,
        oldAvatarUrl: m.oldItem.avatar?.url,
        avatarName: m.oldItem.avatar?.name,
      }))
      const result = await apiPost<MigrationResult & { idMap: Record<string, string> }>('/migrate/run', {
        step: 'accounts',
        mappings: payload,
      })
      onComplete(mappings, result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Migration failed')
    } finally {
      setMigrating(false)
    }
  }

  if (loading) return <LoadingSpinner label="Loading accounts from old Pika…" />
  if (error) return <Alert type="error">{error}</Alert>

  return (
    <div>
      <StepHeader icon="wallet" title="Accounts" subtitle={`${oldAccounts.length} account(s) found in old Pika.`} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
        {mappings.map((m, idx) => (
          <Card key={m.oldItem.id}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              {/* Icon preview / picker */}
              <div className="twp">
                <IconPicker
                  value={m.icon as IconName}
                  onValueChange={(icon) => updateMapping(idx, { icon })}
                  searchable
                  categorized
                >
                  <button
                    type="button"
                    style={{
                      background: m.oldItem.bgColor || '#3B82F6',
                      color: m.oldItem.color || '#fff',
                      borderRadius: '0.5rem',
                      width: 36,
                      height: 36,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: 'none',
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                    title={isValidIcon(m.oldItem.icon) ? undefined : `"${m.oldItem.icon}" not available — click to choose`}
                  >
                    <Icon name={m.icon as IconName} size={16} />
                  </button>
                </IconPicker>
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {m.oldItem.name}
                </div>
                {!isValidIcon(m.oldItem.icon) && (
                  <div style={{ fontSize: '0.72rem', color: '#f59e0b', marginTop: '0.15rem' }}>
                    Icon &quot;{m.oldItem.icon}&quot; not in V2 — click icon to change
                  </div>
                )}
              </div>

              {/* Action selector */}
              <select
                value={m.action}
                onChange={(e) => {
                  const action = e.target.value as ItemAction
                  updateMapping(idx, {
                    action,
                    existingId: action === 'use_existing' ? (v2Accounts.find((v) => v.name.toLowerCase() === m.oldItem.name.toLowerCase())?.id) : undefined,
                  })
                }}
                style={{
                  border: '1px solid var(--theme-border-color)',
                  borderRadius: '0.375rem',
                  background: 'var(--theme-elevation-100)',
                  color: 'var(--theme-text)',
                  fontSize: '0.8rem',
                  padding: '0.3rem 0.5rem',
                }}
              >
                <option value="create">Create New</option>
                <option value="use_existing">Use Existing</option>
                <option value="skip">Skip</option>
              </select>

              {/* V2 account picker when use_existing */}
              {m.action === 'use_existing' && (
                <select
                  value={m.existingId || ''}
                  onChange={(e) => updateMapping(idx, { existingId: e.target.value })}
                  style={{
                    border: '1px solid var(--theme-border-color)',
                    borderRadius: '0.375rem',
                    background: 'var(--theme-elevation-100)',
                    color: 'var(--theme-text)',
                    fontSize: '0.8rem',
                    padding: '0.3rem 0.5rem',
                    maxWidth: 160,
                  }}
                >
                  <option value="">— pick V2 account —</option>
                  {v2Accounts.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Avatar Action UI */}
            {m.oldItem.avatar && m.action !== 'skip' && (
              <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'var(--theme-elevation-100)', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <img src={m.oldItem.avatar.url} alt="Avatar" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                <div style={{ flex: 1, fontSize: '0.8rem' }}>
                  <div style={{ fontWeight: 600 }}>Old account has an avatar</div>
                  {m.action === 'use_existing' && m.existingId && (
                    <div style={{ opacity: 0.7 }}>
                      {v2Accounts.find((v) => v.id === m.existingId)?.hasAvatar
                        ? 'V2 account already has an avatar. Do you want to override it?'
                        : 'V2 account missing an avatar. Uploading.'}
                    </div>
                  )}
                </div>
                {m.action === 'use_existing' && m.existingId && v2Accounts.find((v) => v.id === m.existingId)?.hasAvatar ? (
                  <select
                    value={m.avatarAction}
                    onChange={(e) => updateMapping(idx, { avatarAction: e.target.value as AvatarAction })}
                    style={{ border: '1px solid var(--theme-border-color)', borderRadius: '0.375rem', background: 'var(--theme-elevation-50)', color: 'var(--theme-text)', fontSize: '0.8rem', padding: '0.3rem 0.5rem' }}
                  >
                    <option value="keep_existing">Keep Existing V2 Avatar</option>
                    <option value="override_existing">Override with Old Avatar</option>
                  </select>
                ) : (
                  <div style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: 600 }}>Will upload</div>
                )}
              </div>
            )}
          </Card>
        ))}
      </div>

      {error && <Alert type="error">{error}</Alert>}
      <Btn onClick={handleMigrate} loading={migrating}>
        <DynamicIcon name="arrow-right" size={13} />
        Migrate Accounts
      </Btn>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 3 — Categories
// ---------------------------------------------------------------------------

function flattenOldCategories(cats: OldCategory[], parentId: number | null = null): OldCategory[] {
  const result: OldCategory[] = []
  for (const cat of cats) {
    result.push({ ...cat, parentId: cat.parentId ?? parentId })
    if (cat.children?.length) {
      result.push(...flattenOldCategories(cat.children, cat.id))
    }
  }
  return result
}

function CategoriesStep({
  creds,
  v2Categories,
  onComplete,
}: {
  creds: Credentials
  v2Categories: V2CategoryRecord[]
  onComplete: (mappings: CategoryMapping[], result: MigrationResult & { idMap: Record<string, string> }) => void
}) {
  const [oldCategories, setOldCategories] = useState<OldCategory[]>([])
  const [mappings, setMappings] = useState<CategoryMapping[]>([])
  const [loading, setLoading] = useState(true)
  const [migrating, setMigrating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    apiPost<OldCategory[]>('/migrate/fetch', { ...creds, resource: 'categories' })
      .then((data) => {
        const nested = Array.isArray(data) ? data : []
        const items = flattenOldCategories(nested)
        const maps: CategoryMapping[] = items.map((c) => {
          const match = v2Categories.find((v) => v.name.toLowerCase() === c.name.toLowerCase())
          return {
            oldItem: c,
            action: match ? 'use_existing' : 'create',
            existingId: match?.id,
            icon: safeIcon(c.icon, 'folder'),
          }
        })
        setOldCategories(items)
        setMappings(maps)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const updateMapping = (idx: number, patch: Partial<CategoryMapping>) => {
    setMappings((prev) => prev.map((m, i) => (i === idx ? { ...m, ...patch } : m)))
  }

  const typeColor: Record<string, string> = {
    income: '#10b981',
    expense: '#ef4444',
    transfer: '#6366f1',
  }

  const handleMigrate = async () => {
    setMigrating(true)
    try {
      const payload = mappings.map((m) => ({
        action: m.action,
        oldId: m.oldItem.id,
        existingId: m.existingId,
        name: m.oldItem.name,
        icon: m.icon,
        color: m.oldItem.color,
        bgColor: m.oldItem.bgColor,
        description: m.oldItem.description,
        type: m.oldItem.type,
        parentOldId: m.oldItem.parentId ?? null,
      }))
      const result = await apiPost<MigrationResult & { idMap: Record<string, string> }>('/migrate/run', {
        step: 'categories',
        mappings: payload,
      })
      onComplete(mappings, result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Migration failed')
    } finally {
      setMigrating(false)
    }
  }

  if (loading) return <LoadingSpinner label="Loading categories…" />
  if (error) return <Alert type="error">{error}</Alert>

  const parents = oldCategories.filter((c) => !c.parentId)
  const childrenByParent = (parentId: number) => oldCategories.filter((c) => c.parentId === parentId)

  const totalChildren = oldCategories.filter((c) => c.parentId).length

  const renderCategoryCard = (cat: OldCategory, isChild: boolean, parentMapping?: CategoryMapping) => {
    const idx = mappings.findIndex((m) => m.oldItem.id === cat.id)
    const m = mappings[idx]
    if (!m) return null

    // For child "use_existing": filter to only v2 children of the mapped parent
    const parentV2Id = parentMapping?.action === 'use_existing' ? parentMapping.existingId : undefined
    const availableV2 = isChild
      ? parentV2Id
        ? v2Categories.filter((v) => v.parentId === parentV2Id)
        : v2Categories.filter((v) => v.parentId)
      : v2Categories.filter((v) => !v.parentId)

    return (
      <Card key={cat.id} style={{ marginLeft: isChild ? '1.5rem' : 0, borderLeft: isChild ? '3px solid var(--theme-elevation-200)' : undefined }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div className="twp">
            <IconPicker value={m.icon as IconName} onValueChange={(icon) => updateMapping(idx, { icon })} searchable categorized>
              <button
                type="button"
                style={{
                  background: cat.bgColor || '#6366f1',
                  color: cat.color || '#fff',
                  borderRadius: '0.5rem',
                  width: 32,
                  height: 32,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: 'none',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                <Icon name={m.icon as IconName} size={14} />
              </button>
            </IconPicker>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{cat.name}</div>
            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: typeColor[cat.type] || 'var(--theme-text)', marginTop: 2, textTransform: 'capitalize' }}>
              {cat.type}
            </div>
            {!isValidIcon(cat.icon) && (
              <div style={{ fontSize: '0.7rem', color: '#f59e0b' }}>Icon &quot;{cat.icon}&quot; not in V2 — click to change</div>
            )}
          </div>

          <select
            value={m.action}
            onChange={(e) => updateMapping(idx, { action: e.target.value as ItemAction, existingId: undefined })}
            style={{ border: '1px solid var(--theme-border-color)', borderRadius: '0.375rem', background: 'var(--theme-elevation-100)', color: 'var(--theme-text)', fontSize: '0.8rem', padding: '0.3rem 0.5rem' }}
          >
            <option value="create">Create New</option>
            <option value="use_existing">Use Existing</option>
            <option value="skip">Skip</option>
          </select>

          {m.action === 'use_existing' && (
            <select
              value={m.existingId || ''}
              onChange={(e) => updateMapping(idx, { existingId: e.target.value })}
              style={{ border: '1px solid var(--theme-border-color)', borderRadius: '0.375rem', background: 'var(--theme-elevation-100)', color: 'var(--theme-text)', fontSize: '0.8rem', padding: '0.3rem 0.5rem', maxWidth: 160 }}
            >
              <option value="">— pick V2 category —</option>
              {availableV2.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              {availableV2.length === 0 && isChild && (
                <option disabled value="">No child categories for selected parent</option>
              )}
            </select>
          )}
        </div>
      </Card>
    )
  }

  return (
    <div>
      <StepHeader icon="folder" title="Categories" subtitle={`${oldCategories.length} categor${oldCategories.length === 1 ? 'y' : 'ies'} found (${parents.length} parent, ${totalChildren} child).`} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
        {parents.map((parentCat) => {
          const parentIdx = mappings.findIndex((m) => m.oldItem.id === parentCat.id)
          const parentMapping = mappings[parentIdx]
          const childCats = childrenByParent(parentCat.id)
          return (
            <React.Fragment key={parentCat.id}>
              {renderCategoryCard(parentCat, false)}
              {childCats.map((childCat) => renderCategoryCard(childCat, true, parentMapping))}
            </React.Fragment>
          )
        })}
      </div>
      {error && <Alert type="error">{error}</Alert>}
      <Btn onClick={handleMigrate} loading={migrating}>
        <DynamicIcon name="arrow-right" size={13} />
        Migrate Categories
      </Btn>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 4 — Tags
// ---------------------------------------------------------------------------

function TagsStep({
  creds,
  v2Tags,
  onComplete,
}: {
  creds: Credentials
  v2Tags: V2Record[]
  onComplete: (mappings: TagMapping[], result: MigrationResult & { idMap: Record<string, string> }) => void
}) {
  const [oldTags, setOldTags] = useState<OldTag[]>([])
  const [mappings, setMappings] = useState<TagMapping[]>([])
  const [loading, setLoading] = useState(true)
  const [migrating, setMigrating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    apiPost<OldTag[]>('/migrate/fetch', { ...creds, resource: 'tags' })
      .then((data) => {
        const items = Array.isArray(data) ? data : []
        const maps: TagMapping[] = items.map((t) => {
          const match = v2Tags.find((v) => v.name.toLowerCase() === t.name.toLowerCase())
          return { oldItem: t, action: match ? 'use_existing' : 'create', existingId: match?.id, icon: safeIcon(t.icon, 'tag') }
        })
        setOldTags(items)
        setMappings(maps)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const updateMapping = (idx: number, patch: Partial<TagMapping>) =>
    setMappings((prev) => prev.map((m, i) => (i === idx ? { ...m, ...patch } : m)))

  const handleMigrate = async () => {
    setMigrating(true)
    try {
      const payload = mappings.map((m) => ({
        action: m.action,
        oldId: m.oldItem.id,
        existingId: m.existingId,
        name: m.oldItem.name,
        icon: m.icon,
        color: m.oldItem.color,
        bgColor: m.oldItem.bgColor,
        description: m.oldItem.description,
      }))
      const result = await apiPost<MigrationResult & { idMap: Record<string, string> }>('/migrate/run', { step: 'tags', mappings: payload })
      onComplete(mappings, result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Migration failed')
    } finally {
      setMigrating(false)
    }
  }

  if (loading) return <LoadingSpinner label="Loading tags…" />

  return (
    <div>
      <StepHeader icon="tag" title="Tags" subtitle={`${oldTags.length} tag(s) found.`} />
      {error && <Alert type="error">{error}</Alert>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginBottom: '1.25rem' }}>
        {mappings.map((m, idx) => (
          <Card key={m.oldItem.id}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div className="twp">
                <IconPicker value={m.icon as IconName} onValueChange={(icon) => updateMapping(idx, { icon })} searchable categorized>
                  <button type="button" style={{ background: m.oldItem.bgColor || '#6366f1', color: m.oldItem.color || '#fff', borderRadius: '0.5rem', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' }}>
                    <Icon name={m.icon as IconName} size={13} />
                  </button>
                </IconPicker>
              </div>
              <div style={{ flex: 1, fontWeight: 600, fontSize: '0.875rem' }}>{m.oldItem.name}</div>
              {!isValidIcon(m.oldItem.icon) && <span style={{ fontSize: '0.7rem', color: '#f59e0b' }}>Icon needs update</span>}
              <select value={m.action} onChange={(e) => updateMapping(idx, { action: e.target.value as ItemAction })} style={{ border: '1px solid var(--theme-border-color)', borderRadius: '0.375rem', background: 'var(--theme-elevation-100)', color: 'var(--theme-text)', fontSize: '0.8rem', padding: '0.3rem 0.5rem' }}>
                <option value="create">Create New</option>
                <option value="use_existing">Use Existing</option>
                <option value="skip">Skip</option>
              </select>
              {m.action === 'use_existing' && (
                <select value={m.existingId || ''} onChange={(e) => updateMapping(idx, { existingId: e.target.value })} style={{ border: '1px solid var(--theme-border-color)', borderRadius: '0.375rem', background: 'var(--theme-elevation-100)', color: 'var(--theme-text)', fontSize: '0.8rem', padding: '0.3rem 0.5rem', maxWidth: 140 }}>
                  <option value="">— pick V2 tag —</option>
                  {v2Tags.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              )}
            </div>
          </Card>
        ))}
      </div>
      <Btn onClick={handleMigrate} loading={migrating}>
        <DynamicIcon name="arrow-right" size={13} />
        Migrate Tags
      </Btn>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 5 — People
// ---------------------------------------------------------------------------

function PeopleStep({
  creds,
  v2People,
  onComplete,
}: {
  creds: Credentials
  v2People: V2Record[]
  onComplete: (mappings: PersonMapping[], result: MigrationResult & { idMap: Record<string, string> }) => void
}) {
  const [oldPeople, setOldPeople] = useState<OldPerson[]>([])
  const [mappings, setMappings] = useState<PersonMapping[]>([])
  const [loading, setLoading] = useState(true)
  const [migrating, setMigrating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    apiPost<OldPerson[]>('/migrate/fetch', { ...creds, resource: 'people' })
      .then((data) => {
        const items = Array.isArray(data) ? data : []
        const maps: PersonMapping[] = items.map((p) => {
          const match = v2People.find((v) => v.name.toLowerCase() === p.name.toLowerCase())
          let avatarAction: AvatarAction = 'skip'
          if (p.avatar) {
            if (match) {
              avatarAction = match.hasAvatar ? 'keep_existing' : 'upload_new'
            } else {
              avatarAction = 'upload_new'
            }
          }
          return { 
            oldPerson: p, 
            action: match ? 'use_existing' : 'create', 
            existingId: match?.id,
            avatarAction 
          }
        })
        setOldPeople(items)
        setMappings(maps)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const updateMapping = (idx: number, patch: Partial<PersonMapping>) =>
    setMappings((prev) => prev.map((m, i) => (i === idx ? { ...m, ...patch } : m)))

  const handleMigrate = async () => {
    setMigrating(true)
    try {
      const payload = mappings.map((m) => ({
        action: m.action,
        oldId: m.oldPerson.id,
        existingId: m.existingId,
        name: m.oldPerson.name,
        email: m.oldPerson.email,
        phone: m.oldPerson.phone,
        description: m.oldPerson.description,
        avatarAction: m.avatarAction,
        oldAvatarUrl: m.oldPerson.avatar?.url,
        avatarName: m.oldPerson.avatar?.name,
      }))
      const result = await apiPost<MigrationResult & { idMap: Record<string, string> }>('/migrate/run', { step: 'people', mappings: payload })
      onComplete(mappings, result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Migration failed')
    } finally {
      setMigrating(false)
    }
  }

  if (loading) return <LoadingSpinner label="Loading people…" />

  return (
    <div>
      <StepHeader icon="users" title="People" subtitle={`${oldPeople.length} person(s) found.`} />
      {error && <Alert type="error">{error}</Alert>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginBottom: '1.25rem' }}>
        {mappings.map((m, idx) => (
          <Card key={m.oldPerson.id}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{ background: 'var(--theme-elevation-200)', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <DynamicIcon name="user" size={14} style={{ opacity: 0.7 }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{m.oldPerson.name}</div>
                {m.oldPerson.email && <div style={{ fontSize: '0.72rem', opacity: 0.5 }}>{m.oldPerson.email}</div>}
              </div>
              <select value={m.action} onChange={(e) => updateMapping(idx, { action: e.target.value as ItemAction })} style={{ border: '1px solid var(--theme-border-color)', borderRadius: '0.375rem', background: 'var(--theme-elevation-100)', color: 'var(--theme-text)', fontSize: '0.8rem', padding: '0.3rem 0.5rem' }}>
                <option value="create">Create New</option>
                <option value="use_existing">Use Existing</option>
                <option value="skip">Skip</option>
              </select>
              {m.action === 'use_existing' && (
                <select value={m.existingId || ''} onChange={(e) => updateMapping(idx, { existingId: e.target.value })} style={{ border: '1px solid var(--theme-border-color)', borderRadius: '0.375rem', background: 'var(--theme-elevation-100)', color: 'var(--theme-text)', fontSize: '0.8rem', padding: '0.3rem 0.5rem', maxWidth: 140 }}>
                  <option value="">— pick V2 person —</option>
                  {v2People.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              )}
            </div>

            {/* Avatar Action UI */}
            {m.oldPerson.avatar && m.action !== 'skip' && (
              <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'var(--theme-elevation-100)', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <img src={m.oldPerson.avatar.url} alt="Avatar" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                <div style={{ flex: 1, fontSize: '0.8rem' }}>
                  <div style={{ fontWeight: 600 }}>Old person has an avatar</div>
                  {m.action === 'use_existing' && m.existingId && (
                    <div style={{ opacity: 0.7 }}>
                      {v2People.find((v) => v.id === m.existingId)?.hasAvatar
                        ? 'V2 person already has an avatar. Do you want to override it?'
                        : 'V2 person missing an avatar. Uploading.'}
                    </div>
                  )}
                </div>
                {m.action === 'use_existing' && m.existingId && v2People.find((v) => v.id === m.existingId)?.hasAvatar ? (
                  <select
                    value={m.avatarAction}
                    onChange={(e) => updateMapping(idx, { avatarAction: e.target.value as AvatarAction })}
                    style={{ border: '1px solid var(--theme-border-color)', borderRadius: '0.375rem', background: 'var(--theme-elevation-50)', color: 'var(--theme-text)', fontSize: '0.8rem', padding: '0.3rem 0.5rem' }}
                  >
                    <option value="keep_existing">Keep Existing V2 Avatar</option>
                    <option value="override_existing">Override with Old Avatar</option>
                  </select>
                ) : (
                  <div style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: 600 }}>Will upload</div>
                )}
              </div>
            )}
          </Card>
        ))}
      </div>
      <Btn onClick={handleMigrate} loading={migrating}>
        <DynamicIcon name="arrow-right" size={13} />
        Migrate People
      </Btn>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 6 — Transactions
// ---------------------------------------------------------------------------

function TransactionsStep({
  creds,
  accountIdMap,
  categoryIdMap,
  tagIdMap,
  personIdMap,
  onComplete,
}: {
  creds: Credentials
  accountIdMap: Record<string, string>
  categoryIdMap: Record<string, string>
  tagIdMap: Record<string, string>
  personIdMap: Record<string, string>
  onComplete: (result: MigrationResult) => void
}) {
  const [_total, setTotal] = useState<number | null>(null)
  const [progress, setProgress] = useState(0)
  const [migrating, setMigrating] = useState(false)
  const [done, setDone] = useState(false)
  const [result, setResult] = useState<{ created: number; failed: string[] }>({ created: 0, failed: [] })
  const [failedDetails, setFailedDetails] = useState<FailedTransactionDetail[]>([])
  const [finalResult, setFinalResult] = useState<MigrationResult | null>(null)
  const [error, setError] = useState('')

  const [migrationTagName, setMigrationTagName] = useState(`Imported on ${new Date().toLocaleDateString()}`)
  const [migrationTagDesc, setMigrationTagDesc] = useState('Transactions imported from Pika V1')

  const PAGE_SIZE = 100

  // First load: just probe (one-shot, creds stable)
  useEffect(() => {
    apiPost<OldTransaction[]>('/migrate/fetch', {
      ...creds,
      resource: 'transactions',
      params: { limit: '1', offset: '0' },
    })
      .then((data) => {
        const arr = Array.isArray(data) ? data : []
        setTotal(arr.length >= 1 ? -1 : 0)
      })
      .catch((e) => setError(e.message))
  }, [])

  const handleMigrate = async () => {
    setMigrating(true)
    setProgress(0)
    const allFailed: string[] = []
    const allFailedDetails: FailedTransactionDetail[] = []
    let totalCreated = 0
    let offset = 0
    let keepFetching = true

    let globalMigrationTagId: string | undefined = undefined

    if (migrationTagName.trim()) {
      try {
        const tagRes = await fetch('/api/tags', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: migrationTagName.trim(),
            description: migrationTagDesc.trim(),
            icon: 'download',
            color: '#ffffff',
            bgColor: '#6366f1',
          }),
        }).then((r) => r.json())
        if (tagRes.doc?.id) {
          globalMigrationTagId = tagRes.doc.id
        }
      } catch (err) {
        console.warn('Failed to create migration tag:', err)
      }
    }

    while (keepFetching) {
      let batch: OldTransaction[] = []
      try {
        const data = await apiPost<OldTransaction[]>('/migrate/fetch', {
          ...creds,
          resource: 'transactions',
          params: { limit: String(PAGE_SIZE), offset: String(offset) },
        })
        batch = Array.isArray(data) ? data : []
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Fetch failed')
        break
      }

      if (batch.length === 0) { keepFetching = false; break }

      // Build a lookup map from old Pika transactions by title+date key for matching failures
      const oldTxByKey = new Map(
        batch.map((t) => [`${t.title}|${t.date}`, t as unknown as Record<string, unknown>])
      )

      const allMappings = batch.map((t) => {
        const categoryV2Id = t.category?.id ? categoryIdMap[String(t.category.id)] : undefined
        const accountV2Id = t.account?.id ? accountIdMap[String(t.account.id)] : undefined
        return {
          title: t.title,
          amount: String(t.amount),
          date: t.date,
          type: t.type,
          categoryV2Id,
          accountV2Id,
          toAccountV2Id: t.toAccount?.id ? accountIdMap[String(t.toAccount.id)] : undefined,
          personV2Id: t.person?.id ? personIdMap[String(t.person.id)] : undefined,
          tagV2Ids: [
            ...(t.tags || []).map((tg) => tagIdMap[String(tg.id)]),
            globalMigrationTagId,
          ].filter(Boolean),
          note: t.note,
          oldAttachments: t.attachments || [],
          _skipReason: !accountV2Id
            ? `account not mapped (old ID: ${t.account?.id ?? 'none'})`
            : !categoryV2Id
            ? `category not mapped (old ID: ${t.category?.id ?? 'none'})`
            : null,
        }
      })

      // Track unmapped/skipped transactions with full raw old data
      for (const m of allMappings) {
        if (m._skipReason) {
          const reason = `Skipped — ${m._skipReason}`
          allFailed.push(`"${m.title}": ${reason}`)
          allFailedDetails.push({
            title: m.title, amount: m.amount, date: m.date, type: m.type,
            note: m.note || '', categoryV2Id: m.categoryV2Id, accountV2Id: m.accountV2Id,
            reason, rawOldData: oldTxByKey.get(`${m.title}|${m.date}`),
          })
        }
      }

      const validMappings = allMappings
        .filter((m) => !m._skipReason)
        .map(({ _skipReason: _sr, ...rest }) => rest)

      if (validMappings.length > 0) {
        try {
          const res = await apiPost<{ created: number; failed: number; errors: string[]; failedItems?: FailedTransactionDetail[] }>('/migrate/run', {
            step: 'transactions',
            mappings: validMappings,
            userId: '',
          })
          totalCreated += res.created
          allFailed.push(...(res.errors || []))
          // Attach raw old data to each backend failure by matching on title+date
          if (res.failedItems?.length) {
            for (const item of res.failedItems) {
              allFailedDetails.push({
                ...item,
                rawOldData: oldTxByKey.get(`${item.title}|${item.date}`),
              })
            }
          }
        } catch (e) {
          allFailed.push(e instanceof Error ? e.message : 'Batch failed')
        }
      }

      offset += PAGE_SIZE
      setProgress(offset)
      setResult({ created: totalCreated, failed: allFailed })

      if (batch.length < PAGE_SIZE) { keepFetching = false }
    }

    const completedResult = { created: totalCreated, skipped: 0, failed: allFailed.length, errors: allFailed }
    setFailedDetails(allFailedDetails)
    setFinalResult(completedResult)
    setDone(true)
    setMigrating(false)
  }

  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const csvCell = (s: string) => `"${s.replace(/"/g, '""')}"`

  const downloadFailedAs = (format: 'json' | 'csv' | 'html') => {
    let content = ''
    let mime = ''
    let ext = ''

    if (format === 'json') {
      content = JSON.stringify(failedDetails, null, 2)
      mime = 'application/json'
      ext = 'json'
    } else if (format === 'csv') {
      const headers = ['Title', 'Amount', 'Date', 'Type', 'Note', 'Failure Reason', 'Old Pika Raw Data (JSON)']
      const rows = failedDetails.map((d) => [
        csvCell(d.title),
        d.amount,
        d.date,
        d.type,
        csvCell(d.note || ''),
        csvCell(d.reason),
        csvCell(d.rawOldData ? JSON.stringify(d.rawOldData) : ''),
      ])
      content = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
      mime = 'text/csv'
      ext = 'csv'
    } else {
      const rows = failedDetails.map((d) => {
        const rawJson = d.rawOldData ? JSON.stringify(d.rawOldData, null, 2) : ''
        return `
        <tr>
          <td>${esc(d.title)}</td>
          <td style="white-space:nowrap">${esc(d.amount)}</td>
          <td style="white-space:nowrap">${esc(d.date)}</td>
          <td>${esc(d.type)}</td>
          <td>${esc(d.note || '')}</td>
          <td style="color:#dc2626;font-weight:500">${esc(d.reason)}</td>
          <td><details><summary style="cursor:pointer;font-size:11px;opacity:0.6">View raw</summary><pre style="font-size:11px;margin:4px 0 0;white-space:pre-wrap;max-width:340px;overflow-x:auto">${esc(rawJson)}</pre></details></td>
        </tr>`
      }).join('')
      content = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Failed Transactions — Pika Migration</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:2rem;color:#111}
  h2{margin-bottom:1rem}
  table{border-collapse:collapse;width:100%;font-size:13px}
  th,td{border:1px solid #e5e7eb;padding:8px 10px;text-align:left;vertical-align:top}
  th{background:#f9fafb;font-weight:600;white-space:nowrap}
  tr:nth-child(even){background:#fafafa}
  summary{outline:none}
  pre{background:#f3f4f6;border-radius:4px;padding:6px;font-size:11px}
</style>
</head><body>
<h2>Failed Transactions (${failedDetails.length})</h2>
<p style="font-size:13px;color:#6b7280;margin-bottom:1.5rem">Generated from Pika V1→V2 migration on ${new Date().toLocaleString()}</p>
<table>
  <thead><tr>
    <th>Title</th><th>Amount</th><th>Date</th><th>Type</th><th>Note</th><th>Failure Reason</th><th>Old Pika Raw Data</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>
</body></html>`
      mime = 'text/html'
      ext = 'html'
    }

    const blob = new Blob([content], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `failed-transactions-${new Date().toISOString().slice(0, 10)}.${ext}`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <StepHeader icon="file-text" title="Transactions" subtitle="Transactions are imported in batches of 100." />
      {error && <Alert type="error">{error}</Alert>}
      <Alert type="warning">
        Running migration twice will create duplicate transactions. Make sure you only run this once.
      </Alert>

      {migrating && (
        <Card style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <DynamicIcon name="loader-circle" size={16} className="animate-spin" style={{ color: '#6366f1' }} />
            <span style={{ fontSize: '0.875rem' }}>Importing… {progress} processed so far</span>
          </div>
          <div style={{ height: 6, background: 'var(--theme-elevation-150)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: '#6366f1', width: `${Math.min(100, (result.created / Math.max(progress, 1)) * 100)}%`, transition: 'width 0.3s', borderRadius: 3 }} />
          </div>
        </Card>
      )}

      {done && (
        <Card style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', gap: '2rem', padding: '0.5rem 0', marginBottom: result.failed.length > 0 ? '0.75rem' : 0 }}>
            <ResultBadge label="Created" count={result.created} color="#10b981" />
            <ResultBadge label="Failed" count={result.failed.length} color="#ef4444" />
          </div>
          {result.failed.length > 0 && (
            <div style={{ marginTop: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#ef4444' }}>
                  {result.failed.length} transaction{result.failed.length === 1 ? '' : 's'} failed — see reasons below:
                </div>
                {failedDetails.length > 0 && (
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    {(['json', 'csv', 'html'] as const).map((fmt) => (
                      <button
                        key={fmt}
                        type="button"
                        onClick={() => downloadFailedAs(fmt)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.3rem',
                          background: 'var(--theme-elevation-150)',
                          border: '1px solid var(--theme-border-color)',
                          borderRadius: '0.375rem',
                          padding: '0.25rem 0.6rem',
                          fontSize: '0.75rem', fontWeight: 600,
                          cursor: 'pointer', color: 'var(--theme-text)',
                        }}
                      >
                        <DynamicIcon name="download" size={11} />
                        {fmt.toUpperCase()}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div
                style={{
                  background: 'rgba(239,68,68,0.06)',
                  border: '1px solid rgba(239,68,68,0.2)',
                  borderRadius: '0.5rem',
                  padding: '0.5rem 0.75rem',
                  maxHeight: 320,
                  overflowY: 'auto',
                }}
              >
                {result.failed.map((e, i) => (
                  <div
                    key={i}
                    style={{
                      fontSize: '0.775rem',
                      color: 'var(--theme-text)',
                      padding: '0.3rem 0',
                      borderBottom: i < result.failed.length - 1 ? '1px solid rgba(239,68,68,0.1)' : 'none',
                      display: 'flex',
                      gap: '0.5rem',
                      alignItems: 'flex-start',
                    }}
                  >
                    <DynamicIcon name="circle-x" size={12} style={{ color: '#ef4444', flexShrink: 0, marginTop: 2 }} />
                    <span style={{ wordBreak: 'break-word' }}>{e}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {!done && !migrating && (
        <Card style={{ marginBottom: '1.25rem' }}>
          <StepHeader icon="tag" title="Migration Tag" subtitle="Automatically attach a specific tag to all imported transactions to easily group and identify them later." />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '-0.5rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, opacity: 0.7, marginBottom: '0.35rem' }}>Tag Name</label>
              <input
                style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '0.45rem', border: '1px solid var(--theme-border-color)', background: 'var(--theme-elevation-100)', color: 'var(--theme-text)', fontSize: '0.875rem' }}
                type="text"
                value={migrationTagName}
                onChange={(e) => setMigrationTagName(e.target.value)}
                placeholder="E.g., Legacy Import, 2024 Migration"
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, opacity: 0.7, marginBottom: '0.35rem' }}>Description (Optional)</label>
              <input
                style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '0.45rem', border: '1px solid var(--theme-border-color)', background: 'var(--theme-elevation-100)', color: 'var(--theme-text)', fontSize: '0.875rem' }}
                type="text"
                value={migrationTagDesc}
                onChange={(e) => setMigrationTagDesc(e.target.value)}
                placeholder="Automatically tagged during V1 to V2 migration"
              />
            </div>
          </div>
        </Card>
      )}

      {!done && (
        <Btn onClick={handleMigrate} loading={migrating}>
          <DynamicIcon name="download" size={13} />
          Start Transaction Import
        </Btn>
      )}

      {done && finalResult && (
        <Btn onClick={() => onComplete(finalResult)}>
          <DynamicIcon name="arrow-right" size={13} />
          Continue to Summary
        </Btn>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 7 — Summary
// ---------------------------------------------------------------------------

function SummaryStep({ results }: { results: StepResults }) {
  const steps: Array<{ key: keyof StepResults; label: string; icon: string }> = [
    { key: 'accounts', label: 'Accounts', icon: 'wallet' },
    { key: 'categories', label: 'Categories', icon: 'folder' },
    { key: 'tags', label: 'Tags', icon: 'tag' },
    { key: 'people', label: 'People', icon: 'users' },
    { key: 'transactions', label: 'Transactions', icon: 'file-text' },
  ]

  return (
    <div>
      <StepHeader icon="party-popper" title="Migration Complete!" subtitle="Here's a summary of what was imported." />
      <Alert type="success">All migration steps have been completed. Your data is now in Pika V2.</Alert>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {steps.map(({ key, label, icon }) => {
          const r = results[key]
          if (!r) return null
          return (
            <Card key={key}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <DynamicIcon name={icon as IconName} size={16} style={{ opacity: 0.7, flexShrink: 0 }} />
                <span style={{ fontWeight: 600, fontSize: '0.9rem', flex: 1 }}>{label}</span>
                <span style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: 600 }}>{r.created} created</span>
                <span style={{ fontSize: '0.75rem', opacity: 0.5 }}>{r.skipped} skipped</span>
                {r.failed > 0 && <span style={{ fontSize: '0.75rem', color: '#ef4444' }}>{r.failed} failed</span>}
              </div>
            </Card>
          )
        })}
      </div>
      <div style={{ marginTop: '1.5rem' }}>
        <Link
          href="/admin"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'var(--theme-success-400)', color: '#fff', borderRadius: '0.5rem', padding: '0.5rem 1.1rem', fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none' }}
        >
          <DynamicIcon name="layout-dashboard" size={14} />
          Go to Dashboard
        </Link>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Generic loading spinner
// ---------------------------------------------------------------------------

function LoadingSpinner({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1.5rem 0', opacity: 0.6 }}>
      <DynamicIcon name="loader-circle" size={18} className="animate-spin" />
      <span style={{ fontSize: '0.875rem' }}>{label}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Wizard
// ---------------------------------------------------------------------------

const STEPS = ['Connect', 'Accounts', 'Categories', 'Tags', 'People', 'Transactions', 'Done'] as const
type StepName = (typeof STEPS)[number]

export function MigrationPageClient({ userName }: { userId?: string; userName: string }) {
  const [currentStep, setCurrentStep] = useState<StepName>('Connect')
  const [creds, setCreds] = useState<Credentials | null>(null)
  const [v2Data, setV2Data] = useState<{
    accounts: V2Record[]
    categories: V2CategoryRecord[]
    tags: V2Record[]
    people: V2Record[]
  }>({ accounts: [], categories: [], tags: [], people: [] })
  const [stepResults, setStepResults] = useState<StepResults>({})
  const [idMaps, setIdMaps] = useState<{
    accounts: Record<string, string>
    categories: Record<string, string>
    tags: Record<string, string>
    people: Record<string, string>
  }>({ accounts: {}, categories: {}, tags: {}, people: {} })
  const [v2Loading, setV2Loading] = useState(false)

  const stepIndex = STEPS.indexOf(currentStep)

  // Fetch V2 existing data when connected
  const loadV2Data = useCallback(async () => {
    setV2Loading(true)
    try {
      const [accRes, catRes, tagRes, peopleRes] = await Promise.all([
        fetch('/api/accounts?limit=200&depth=0').then((r) => r.json()),
        fetch('/api/categories?limit=500&depth=1').then((r) => r.json()),
        fetch('/api/tags?limit=500&depth=0').then((r) => r.json()),
        fetch('/api/people?limit=200&depth=0').then((r) => r.json()),
      ])
      setV2Data({
        accounts: (accRes.docs || []).map((d: { id: string; name: string; avatar?: unknown }) => ({ id: d.id, name: d.name, hasAvatar: !!d.avatar })),
        categories: (catRes.docs || []).map((d: { id: string; name: string; parent?: { id: string } | string | null }) => ({
          id: d.id,
          name: d.name,
          parentId: d.parent ? (typeof d.parent === 'string' ? d.parent : d.parent.id) : null,
        })),
        tags: (tagRes.docs || []).map((d: { id: string; name: string }) => ({ id: d.id, name: d.name })),
        people: (peopleRes.docs || []).map((d: { id: string; name: string; avatar?: unknown }) => ({ id: d.id, name: d.name, hasAvatar: !!d.avatar })),
      })
    } finally {
      setV2Loading(false)
    }
  }, [])

  const handleConnected = useCallback(
    (c: Credentials) => {
      setCreds(c)
      loadV2Data()
      setCurrentStep('Accounts')
    },
    [loadV2Data],
  )

  const saveResult = useCallback(
    (key: keyof StepResults, result: MigrationResult & { idMap?: Record<string, string> }) => {
      setStepResults((prev) => ({ ...prev, [key]: result }))
      if (result.idMap) {
        setIdMaps((prev) => ({ ...prev, [key]: result.idMap! }))
      }
    },
    [],
  )

  const containerStyle: React.CSSProperties = {
    minHeight: '100vh',
    background: 'var(--theme-bg)',
    padding: '2rem',
    boxSizing: 'border-box',
  }

  const headerStyle: React.CSSProperties = {
    marginBottom: '2rem',
    paddingBottom: '1.25rem',
    borderBottom: '1px solid var(--theme-border-color)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '1rem',
  }

  const stepperStyle: React.CSSProperties = {
    display: 'flex',
    gap: '0',
    marginBottom: '2rem',
    overflowX: 'auto',
    paddingBottom: '0.25rem',
  }

  return (
    <div style={containerStyle}>
      {/* Page header */}
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', borderRadius: '0.75rem', padding: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <DynamicIcon name="database" size={20} style={{ color: '#fff' }} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Pika Data Migration</h1>
            <p style={{ fontSize: '0.78rem', opacity: 0.5, marginTop: '0.15rem', marginBottom: 0 }}>
              Migrating as <strong>{userName}</strong>
            </p>
          </div>
        </div>
      </div>

      {/* Step progress bar */}
      <div style={stepperStyle}>
        {STEPS.map((step, idx) => {
          const done = idx < stepIndex
          const active = idx === stepIndex
          return (
            <div
              key={step}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 0,
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.3rem 0.6rem',
                  borderRadius: '2rem',
                  fontSize: '0.78rem',
                  fontWeight: active ? 700 : 500,
                  background: done ? 'rgba(16,185,129,0.12)' : active ? 'rgba(99,102,241,0.12)' : 'transparent',
                  color: done ? '#10b981' : active ? '#6366f1' : 'var(--theme-text)',
                  opacity: done || active ? 1 : 0.4,
                }}
              >
                {done ? (
                  <DynamicIcon name="check" size={11} />
                ) : (
                  <span style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${active ? '#6366f1' : 'currentColor'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 700 }}>{idx + 1}</span>
                )}
                {step}
              </div>
              {idx < STEPS.length - 1 && (
                <div style={{ width: 20, height: 1, background: 'var(--theme-border-color)', flexShrink: 0 }} />
              )}
            </div>
          )
        })}
      </div>

      {/* Step content */}
      <div style={{ maxWidth: 720 }}>
        {currentStep === 'Connect' && (
          <ConnectStep onConnected={handleConnected} />
        )}

        {currentStep === 'Accounts' && creds && (
          v2Loading
            ? <LoadingSpinner label="Loading V2 data…" />
            : (
              <AccountsStep
                creds={creds}
                v2Accounts={v2Data.accounts}
                onComplete={(_, result) => {
                  saveResult('accounts', result)
                  setCurrentStep('Categories')
                }}
              />
            )
        )}

        {currentStep === 'Categories' && creds && (
          <CategoriesStep
            creds={creds}
            v2Categories={v2Data.categories}
            onComplete={(_, result) => {
              saveResult('categories', result)
              setCurrentStep('Tags')
            }}
          />
        )}

        {currentStep === 'Tags' && creds && (
          <TagsStep
            creds={creds}
            v2Tags={v2Data.tags}
            onComplete={(_, result) => {
              saveResult('tags', result)
              setCurrentStep('People')
            }}
          />
        )}

        {currentStep === 'People' && creds && (
          <PeopleStep
            creds={creds}
            v2People={v2Data.people}
            onComplete={(_, result) => {
              saveResult('people', result)
              setCurrentStep('Transactions')
            }}
          />
        )}

        {currentStep === 'Transactions' && creds && (
          <TransactionsStep
            creds={creds}
            accountIdMap={idMaps.accounts}
            categoryIdMap={idMaps.categories}
            tagIdMap={idMaps.tags}
            personIdMap={idMaps.people}
            onComplete={(result) => {
              saveResult('transactions', result)
              setCurrentStep('Done')
            }}
          />
        )}

        {currentStep === 'Done' && <SummaryStep results={stepResults} />}
      </div>
    </div>
  )
}
