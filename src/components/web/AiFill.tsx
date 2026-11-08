'use client'

import { ImagePlus, Loader2, Sparkles, X } from 'lucide-react'
import React from 'react'

import { aiPrefillAction } from '@/app/(app)/app/actions'
import type { Prefill } from '@/lib/web/prefill'

/** "Lunch 250 at Paragon with Rony" or a receipt → the form below is filled in to check and save. */
export function AiFill({ onFill }: { onFill: (p: Prefill) => void }) {
  const [text, setText] = React.useState('')
  const [image, setImage] = React.useState<File | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [done, setDone] = React.useState(false)
  const pick = React.useRef<HTMLInputElement>(null)
  const preview = React.useMemo(() => (image ? URL.createObjectURL(image) : null), [image])
  React.useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview])

  const run = async () => {
    const fd = new FormData()
    fd.append('text', text)
    if (image) fd.append('image', image)
    setBusy(true)
    setError(null)
    try {
      const res = await aiPrefillAction(fd)
      if ('error' in res) return setError(res.error)
      onFill(res.prefill)
      setDone(true)
    } catch {
      setError('Could not reach the AI. Try a smaller image or try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-2 rounded-2xl border border-primary/30 bg-primary/5 p-3">
      <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-primary uppercase">
        <Sparkles className="size-3.5" /> Fill with AI
      </div>
      <textarea
        value={text}
        rows={2}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void run()
        }}
        onPaste={(e) => {
          const f = [...e.clipboardData.files].find((x) => x.type.startsWith('image/'))
          if (f) {
            e.preventDefault()
            e.stopPropagation()
            setImage(f)
          }
        }}
        placeholder="Lunch 250 at Paragon with Rony — or paste a receipt"
        className="w-full min-w-0 rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40"
      />
      <div className="flex items-center gap-2">
        {preview ? (
          <span className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="" className="size-10 rounded-lg border object-cover" />
            <button type="button" aria-label="Remove image" onClick={() => setImage(null)} className="absolute -top-1.5 -right-1.5 rounded-full bg-black/70 p-0.5 text-white">
              <X className="size-3" />
            </button>
          </span>
        ) : (
          <button type="button" onClick={() => pick.current?.click()} className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-sm text-muted-foreground hover:bg-accent">
            <ImagePlus className="size-4" /> Receipt
          </button>
        )}
        <input ref={pick} type="file" accept="image/*" hidden onChange={(e) => setImage(e.target.files?.[0] ?? null)} />
        <span className="flex-1 text-xs text-muted-foreground">{done && !busy && !error ? 'Filled in — check below.' : ''}</span>
        <button type="button" disabled={busy || (!text.trim() && !image)} onClick={run} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {busy ? 'Reading…' : 'Fill'}
        </button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
