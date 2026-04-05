'use client'

import React, { useCallback, useRef, useState } from 'react'
import { useFormFields } from '@payloadcms/ui'
import DynamicIcon from '@/components/lucide/dynamic-icon'

type ResolvedEntity = { id: string; name: string; [key: string]: unknown }

type ParsedTransaction = {
  title?: string
  amount?: string
  type?: string
  date?: string
  category?: ResolvedEntity | null
  account?: ResolvedEntity | null
  toAccount?: ResolvedEntity | null
  person?: ResolvedEntity | null
  tags?: ResolvedEntity[]
  note?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // strip data URL prefix — endpoint handles both
      resolve(result)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function payloadDate(dateStr: string): string {
  // AI returns "YYYY-MM-DD HH:MM:SS", Payload date field needs ISO string
  if (!dateStr) return ''
  const iso = dateStr.replace(' ', 'T')
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '' : d.toISOString()
}

// ─── Subcomponents ───────────────────────────────────────────────────────────

function Spinner() {
  return (
    <span style={{
      display: 'inline-block', width: 14, height: 14,
      border: '2px solid rgba(255,255,255,0.3)',
      borderTopColor: '#fff',
      borderRadius: '50%',
      animation: 'ai-spin 0.7s linear infinite',
    }} />
  )
}

function ResultRow({ label, value }: { label: string; value: string | string[] | undefined }) {
  if (!value || (Array.isArray(value) && value.length === 0)) return null
  const display = Array.isArray(value) ? value.join(', ') : value
  return (
    <div style={{ display: 'flex', gap: 8, padding: '4px 0', borderBottom: '1px solid var(--theme-elevation-100)' }}>
      <span style={{ minWidth: 90, fontSize: 11, color: 'var(--color-base-400)', textTransform: 'uppercase', letterSpacing: '0.05em', paddingTop: 1 }}>{label}</span>
      <span style={{ fontSize: 13, color: 'var(--theme-text)', wordBreak: 'break-all' }}>{display}</span>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function AITransactionPanel() {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'text' | 'image'>('text')
  const [text, setText] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ParsedTransaction | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [applied, setApplied] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const dispatchFields = useFormFields(([, dispatch]) => dispatch)

  // ── Analyze ────────────────────────────────────────────────────────────────

  const analyze = useCallback(async () => {
    setLoading(true)
    setError(null)
    setResult(null)
    setApplied(false)

    try {
      let res: Response

      if (tab === 'text') {
        if (!text.trim()) { setError('Enter some text to analyze.'); setLoading(false); return }
        res = await fetch('/api/ai/text-to-transaction', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: text.trim() }),
        })
      } else {
        if (!imageFile) { setError('Select an image first.'); setLoading(false); return }
        const image = await fileToBase64(imageFile)
        res = await fetch('/api/ai/image-to-transaction', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image, mimeType: imageFile.type }),
        })
      }

      const json = await res.json()
      if (!res.ok) {
        const msg = json?.errors?.[0]?.message ?? `Error ${res.status}`
        setError(msg)
        return
      }
      setResult(json.data ?? {})
    } catch (e: any) {
      setError(e?.message ?? 'Network error')
    } finally {
      setLoading(false)
    }
  }, [tab, text, imageFile])

  // ── Apply to form ──────────────────────────────────────────────────────────

  const apply = useCallback(() => {
    if (!result) return
    const fields: { path: string; value: unknown }[] = []

    if (result.title)          fields.push({ path: 'title',     value: result.title })
    if (result.amount)         fields.push({ path: 'amount',    value: result.amount })
    if (result.type)           fields.push({ path: 'type',      value: result.type })
    if (result.date)           fields.push({ path: 'date',      value: payloadDate(result.date) })
    if (result.category?.id)   fields.push({ path: 'category',  value: result.category.id })
    if (result.account?.id)    fields.push({ path: 'account',   value: result.account.id })
    if (result.toAccount?.id)  fields.push({ path: 'toAccount', value: result.toAccount.id })
    if (result.person?.id)     fields.push({ path: 'person',    value: result.person.id })
    if (result.note)           fields.push({ path: 'note',      value: result.note })
    if (result.tags?.length)   fields.push({ path: 'tags',      value: result.tags.map(t => t.id) })

    for (const f of fields) {
      dispatchFields({ type: 'UPDATE', path: f.path, value: f.value } as any)
    }
    setApplied(true)
  }, [result, dispatchFields])

  // ── Image picker ───────────────────────────────────────────────────────────

  const onImageChange = (file: File | null) => {
    setImageFile(file)
    setResult(null)
    setError(null)
    setApplied(false)
    if (imagePreview) URL.revokeObjectURL(imagePreview)
    setImagePreview(file ? URL.createObjectURL(file) : null)
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @keyframes ai-spin { to { transform: rotate(360deg); } }
        @keyframes ai-slide-down {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .ai-panel-body { animation: ai-slide-down 0.18s ease; }
        .ai-btn { cursor: pointer; border: none; font-family: inherit; transition: opacity 0.15s, background 0.15s; }
        .ai-btn:hover { opacity: 0.85; }
        .ai-btn:active { opacity: 0.7; }
        .ai-tab { cursor: pointer; background: none; border: none; font-family: inherit; font-size: 13px; padding: 6px 14px; border-radius: 6px; transition: background 0.15s, color 0.15s; color: var(--color-base-400); }
        .ai-tab:hover { color: var(--theme-text); }
        .ai-tab.active { background: var(--theme-elevation-150, var(--theme-elevation-100)); color: var(--theme-text); font-weight: 500; }
        .ai-drop-zone { border: 1.5px dashed var(--theme-elevation-200, var(--theme-border-color)); border-radius: 8px; padding: 24px; text-align: center; cursor: pointer; transition: border-color 0.15s, background 0.15s; }
        .ai-drop-zone:hover { border-color: #4a90e2; background: rgba(74,144,226,0.04); }
      `}</style>

      {/* ── Toggle button ── */}
      <div style={{ marginBottom: 20 }}>
        <button
          type="button"
          className="ai-btn"
          onClick={() => { setOpen(v => !v); setResult(null); setError(null); setApplied(false) }}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            padding: '8px 16px', borderRadius: 8,
            background: open ? 'rgba(74,144,226,0.15)' : 'var(--theme-elevation-50)',
            border: `1px solid ${open ? 'rgba(74,144,226,0.4)' : 'var(--theme-elevation-150, var(--theme-border-color))'}`,
            color: open ? '#4a90e2' : 'var(--theme-text)',
            fontSize: 13, fontWeight: 500,
          }}
        >
          <DynamicIcon name="sparkles" size={15} />
          AI Assistant
          <span style={{
            fontSize: 10, opacity: 0.6, marginLeft: 2,
            transform: open ? 'rotate(180deg)' : 'none',
            display: 'inline-block', transition: 'transform 0.2s',
          }}>▼</span>
        </button>
      </div>

      {/* ── Panel ── */}
      {open && (
        <div
          className="ai-panel-body"
          style={{
            marginBottom: 24,
            borderRadius: 10,
            border: '1px solid var(--theme-elevation-150, var(--theme-border-color))',
            background: 'var(--theme-elevation-50)',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 16px',
            borderBottom: '1px solid var(--theme-elevation-100)',
            background: 'var(--theme-elevation-100)',
          }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--theme-text)' }}>AI Transaction Parser</span>
            <span style={{ fontSize: 11, color: 'var(--color-base-400)', marginLeft: 'auto' }}>Powered by Gemini</span>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, padding: '10px 12px 0' }}>
            <button className={`ai-tab${tab === 'text' ? ' active' : ''}`} type="button" onClick={() => { setTab('text'); setResult(null); setError(null) }}>
              <DynamicIcon name="message-square-text" size={14} style={{ marginRight: 5, verticalAlign: 'middle' }} />
              Text / SMS
            </button>
            <button className={`ai-tab${tab === 'image' ? ' active' : ''}`} type="button" onClick={() => { setTab('image'); setResult(null); setError(null) }}>
              <DynamicIcon name="scan" size={14} style={{ marginRight: 5, verticalAlign: 'middle' }} />
              Receipt / Image
            </button>
          </div>

          {/* Body */}
          <div style={{ padding: 16 }}>
            {tab === 'text' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <textarea
                  value={text}
                  onChange={e => { setText(e.target.value); setResult(null); setError(null); setApplied(false) }}
                  placeholder={'Paste SMS, bank alert, or describe naturally…\ne.g. "Rs 500 debited via UPI to Swiggy"\nor "Spent 200 on fruits from federal bank"'}
                  rows={4}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 7,
                    border: '1px solid var(--theme-elevation-200, var(--theme-border-color))',
                    background: 'var(--theme-elevation-0, var(--theme-bg))',
                    color: 'var(--theme-text)', fontSize: 13, lineHeight: 1.5,
                    resize: 'vertical', fontFamily: 'inherit',
                    outline: 'none',
                  }}
                />
              </div>
            )}

            {tab === 'image' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp"
                  style={{ display: 'none' }}
                  onChange={e => onImageChange(e.target.files?.[0] ?? null)}
                />
                {!imagePreview ? (
                  <div className="ai-drop-zone" onClick={() => fileInputRef.current?.click()}>
                    <DynamicIcon name="file-image" size={28} style={{ marginBottom: 6, color: 'var(--color-base-400)' }} />
                    <p style={{ fontSize: 13, color: 'var(--theme-text)', margin: 0 }}>Click to upload receipt or screenshot</p>
                    <p style={{ fontSize: 11, color: 'var(--color-base-400)', margin: '4px 0 0' }}>PNG, JPG, WEBP · max 10 MB</p>
                  </div>
                ) : (
                  <div style={{ position: 'relative', display: 'inline-flex', gap: 10, alignItems: 'flex-start' }}>
                    <img
                      src={imagePreview}
                      alt="receipt preview"
                      style={{ maxHeight: 160, maxWidth: '100%', borderRadius: 6, border: '1px solid var(--theme-elevation-150, var(--theme-border-color))' }}
                    />
                    <button
                      type="button"
                      className="ai-btn"
                      onClick={() => { onImageChange(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                      style={{ padding: '3px 8px', borderRadius: 5, background: 'var(--theme-elevation-100)', color: 'var(--theme-text)', fontSize: 12, border: '1px solid var(--theme-elevation-150, var(--theme-border-color))' }}
                    >
                      ✕ Remove
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Analyze button */}
            <div style={{ marginTop: 12 }}>
              <button
                type="button"
                className="ai-btn"
                onClick={analyze}
                disabled={loading}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  padding: '8px 18px', borderRadius: 7,
                  background: loading ? 'rgba(74,144,226,0.5)' : '#4a90e2',
                  color: '#fff', fontSize: 13, fontWeight: 500,
                  opacity: loading ? 1 : undefined,
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
              >
                {loading
                  ? <><Spinner /> Analyzing…</>
                  : <><DynamicIcon name="sparkles" size={14} /> Analyze</>
                }
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              margin: '0 16px 16px',
              padding: '10px 14px', borderRadius: 7,
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.25)',
              color: '#ef4444', fontSize: 13,
            }}>
              ⚠ {error}
            </div>
          )}

          {/* Result */}
          {result && Object.keys(result).some(k => (result as any)[k] && (result as any)[k] !== '' && !(Array.isArray((result as any)[k]) && (result as any)[k].length === 0)) && (
            <div style={{ margin: '0 16px 16px' }}>
              <div style={{
                borderRadius: 8,
                border: '1px solid rgba(16,185,129,0.25)',
                background: 'rgba(16,185,129,0.05)',
                overflow: 'hidden',
              }}>
                <div style={{ padding: '8px 14px', borderBottom: '1px solid rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#10b981' }}>✓ AI Analysis Complete</span>
                  {applied && <span style={{ fontSize: 11, color: '#10b981', opacity: 0.7 }}>Applied to form</span>}
                </div>
                <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <ResultRow label="Title"     value={result.title} />
                  <ResultRow label="Amount"    value={result.amount} />
                  <ResultRow label="Type"      value={result.type} />
                  <ResultRow label="Date"      value={result.date} />
                  <ResultRow label="Category"  value={result.category?.name} />
                  <ResultRow label="Account"   value={result.account?.name} />
                  <ResultRow label="To Acct"   value={result.toAccount?.name} />
                  <ResultRow label="Person"    value={result.person?.name} />
                  <ResultRow label="Tags"      value={result.tags?.map(t => t.name)} />
                  <ResultRow label="Note"      value={result.note} />
                </div>
                <div style={{ padding: '10px 14px', borderTop: '1px solid rgba(16,185,129,0.15)', display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    className="ai-btn"
                    onClick={apply}
                    style={{
                      padding: '7px 16px', borderRadius: 6, fontSize: 13, fontWeight: 500,
                      background: applied ? 'rgba(16,185,129,0.15)' : '#10b981',
                      color: applied ? '#10b981' : '#fff',
                      border: applied ? '1px solid rgba(16,185,129,0.3)' : 'none',
                    }}
                  >
                    {applied ? '✓ Applied' : '↓ Apply to Form'}
                  </button>
                  <button
                    type="button"
                    className="ai-btn"
                    onClick={() => { setResult(null); setApplied(false) }}
                    style={{ padding: '7px 12px', borderRadius: 6, fontSize: 13, background: 'var(--theme-elevation-100)', color: 'var(--theme-text)', border: '1px solid var(--theme-elevation-150, var(--theme-border-color))' }}
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  )
}
