'use client'

import { Check, KeyRound } from 'lucide-react'
import { useRouter } from 'next/navigation'
import React from 'react'

import { saveSettingsAction } from '@/app/(app)/app/actions'
import type { SettingsInput, WebSettings } from '@/lib/web/settings'
import { cn } from '@/lib/utils'

const field = 'h-10 w-full min-w-0 rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-4 rounded-2xl border bg-card p-5">
      <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">{title}</h2>
      {children}
    </section>
  )
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5 md:grid-cols-[240px_1fr] md:items-center md:gap-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className={cn('relative h-6 w-11 rounded-full transition-colors', on ? 'bg-primary' : 'bg-muted')}>
      <span className={cn('absolute top-0.5 size-5 rounded-full bg-white shadow transition-all', on ? 'left-[22px]' : 'left-0.5')} />
    </button>
  )
}

/** A stored API key: shows only that it's set; replace with a new one or remove it. */
function KeyField({ has, onChange }: { has: boolean; onChange: (v: string | null | undefined) => void }) {
  const [mode, setMode] = React.useState<'keep' | 'new' | 'clear'>('keep')
  const [value, setValue] = React.useState('')
  React.useEffect(() => onChange(mode === 'keep' ? undefined : mode === 'clear' ? null : value || undefined), [mode, value, onChange])
  if (mode === 'new') {
    return (
      <div className="flex gap-2">
        <input type="password" autoComplete="off" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Paste the new key" className={field} />
        <button type="button" onClick={() => setMode('keep')} className="h-10 shrink-0 rounded-xl border px-3 text-sm">Cancel</button>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2 text-sm">
      <KeyRound className="size-4 text-muted-foreground" />
      <span className={cn('flex-1', mode === 'clear' && 'line-through')}>{has ? 'A key is saved' : 'No key'}</span>
      <button type="button" onClick={() => setMode('new')} className="h-9 rounded-lg border px-3 hover:bg-accent">{has ? 'Replace' : 'Add'}</button>
      {has && (
        <button type="button" onClick={() => setMode(mode === 'clear' ? 'keep' : 'clear')} className="h-9 rounded-lg border px-3 hover:bg-accent">
          {mode === 'clear' ? 'Keep' : 'Remove'}
        </button>
      )}
    </div>
  )
}

export function SettingsForm({
  initial,
  accounts,
  timezones,
  currencies,
}: {
  initial: WebSettings
  accounts: { id: string; name: string }[]
  timezones: { id: string; label: string }[]
  currencies: { code: string; label: string }[]
}) {
  const router = useRouter()
  const [s, setS] = React.useState(initial)
  const [gemini, setGemini] = React.useState<string | null | undefined>(undefined)
  const [hf, setHf] = React.useState<string | null | undefined>(undefined)
  const [busy, setBusy] = React.useState(false)
  const [msg, setMsg] = React.useState<{ ok?: string; error?: string } | null>(null)
  const set = <K extends keyof WebSettings>(k: K, v: WebSettings[K]) => setS((x) => ({ ...x, [k]: v }))

  const save = async () => {
    const input: SettingsInput = {
      name: s.name,
      currency: s.currency,
      timezone: s.timezone,
      defaultAccount: s.defaultAccount || null,
      preferredModel: s.preferredModel,
      allowFallback: s.allowFallback,
      categoryAiMethod: s.categoryAiMethod,
      aiNarrowPrompt: s.aiNarrowPrompt,
      smsAutoConfirm: s.smsAutoConfirm,
      smsAutoConfirmMaxAmount: Number(s.smsAutoConfirmMaxAmount) || 0,
      smsReplyAction: s.smsReplyAction,
      ...(gemini !== undefined ? { geminiApiKey: gemini } : {}),
      ...(hf !== undefined ? { hfApiKey: hf } : {}),
    }
    setBusy(true)
    setMsg(null)
    try {
      const res = await saveSettingsAction(input)
      if ('error' in res) setMsg({ error: res.error })
      else {
        setMsg({ ok: 'Saved.' })
        router.refresh()
      }
    } catch {
      setMsg({ error: 'Could not reach the server.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid max-w-4xl gap-5">
      <Section title="Profile">
        <Row label="Name">
          <input value={s.name} onChange={(e) => set('name', e.target.value)} className={field} />
        </Row>
        <Row label="Email" hint="Sign-in email; change it in the admin panel.">
          <p className="text-sm text-muted-foreground">{s.email}</p>
        </Row>
      </Section>

      <Section title="Money">
        <Row label="Currency">
          <select value={s.currency} onChange={(e) => set('currency', e.target.value)} className={field}>
            {currencies.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
          </select>
        </Row>
        <Row label="Timezone" hint="Dates, months and reports use this.">
          <select value={s.timezone} onChange={(e) => set('timezone', e.target.value)} className={field}>
            {timezones.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </Row>
        <Row label="Default account" hint="Picked first when you add a transaction.">
          <select value={s.defaultAccount ?? ''} onChange={(e) => set('defaultAccount', e.target.value || null)} className={field}>
            <option value="">— None —</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </Row>
      </Section>

      <Section title="AI">
        <Row label="Model" hint="Leave on default to use the app’s model.">
          <select value={s.preferredModel} onChange={(e) => set('preferredModel', e.target.value)} className={field}>
            <option value="">App default</option>
            {s.models.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.provider})</option>)}
          </select>
        </Row>
        <Row label="Fall back to the app’s model" hint="When you have no key for your model’s provider.">
          <Toggle on={s.allowFallback} onChange={(v) => set('allowFallback', v)} />
        </Row>
        <Row label="Gemini API key">
          <KeyField has={initial.hasGeminiKey} onChange={setGemini} />
        </Row>
        <Row label="HuggingFace API key">
          <KeyField has={initial.hasHfKey} onChange={setHf} />
        </Row>
        <Row label="Category suggestions" hint="Local is free and private; cloud uses your AI model.">
          <select value={s.categoryAiMethod} onChange={(e) => set('categoryAiMethod', e.target.value as 'minilm' | 'cloud')} className={field}>
            <option value="minilm">Local (MiniLM)</option>
            <option value="cloud">Cloud (AI model)</option>
          </select>
        </Row>
        <Row label="Send only likely categories, tags and people" hint="Smaller, cheaper prompts.">
          <Toggle on={s.aiNarrowPrompt} onChange={(v) => set('aiNarrowPrompt', v)} />
        </Row>
      </Section>

      <Section title="Bank SMS">
        <Row label="Auto-add trusted merchants" hint="SMS from merchants you always confirm the same way are added without review.">
          <Toggle on={s.smsAutoConfirm} onChange={(v) => set('smsAutoConfirm', v)} />
        </Row>
        <Row label="Auto-add up to" hint="Larger amounts always wait for review.">
          <input type="number" min="0" value={s.smsAutoConfirmMaxAmount} onChange={(e) => set('smsAutoConfirmMaxAmount', Number(e.target.value))} className={cn(field, 'max-w-48')} />
        </Row>
        <Row label="Replying to an SMS notification">
          <select value={s.smsReplyAction} onChange={(e) => set('smsReplyAction', e.target.value as 'add' | 'review')} className={field}>
            <option value="add">Adds the transaction</option>
            <option value="review">Updates the suggestion and asks</option>
          </select>
        </Row>
      </Section>

      <div className="flex items-center gap-3">
        <button type="button" onClick={save} disabled={busy} className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-60">
          <Check className="size-4" /> {busy ? 'Saving…' : 'Save settings'}
        </button>
        {msg?.ok && <span className="text-sm text-income">{msg.ok}</span>}
        {msg?.error && <span className="text-sm text-destructive">{msg.error}</span>}
      </div>
    </div>
  )
}
