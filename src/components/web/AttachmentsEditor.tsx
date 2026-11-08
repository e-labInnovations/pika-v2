'use client'

import { FileText, Loader2, Paperclip, X } from 'lucide-react'
import React from 'react'

import { cn } from '@/lib/utils'

export type Attachment = { id: string; url?: string | null; thumb?: string | null; filename?: string | null; mimeType?: string | null }

const ACCEPT = 'image/*,application/pdf'
const MAX_BYTES = 20 * 1024 * 1024

/** Uploads one file to Payload's media collection as the signed-in user. */
async function upload(file: File): Promise<Attachment> {
  const body = new FormData()
  body.append('file', file)
  body.append('_payload', JSON.stringify({ type: 'attachment', entityType: 'transaction' }))
  const res = await fetch('/api/media', { method: 'POST', body, credentials: 'include' })
  const json = (await res.json().catch(() => null)) as { doc?: { id: string; url?: string; thumbnailURL?: string; filename?: string; mimeType?: string }; errors?: { message: string }[] } | null
  if (!res.ok || !json?.doc) throw new Error(json?.errors?.[0]?.message ?? `Upload failed (${res.status})`)
  const d = json.doc
  return { id: String(d.id), url: d.url, thumb: d.thumbnailURL, filename: d.filename, mimeType: d.mimeType }
}

/** Receipts and screenshots: drop, pick or paste (Ctrl/Cmd+V). Submits attachment ids. */
export function AttachmentsEditor({ value, onChange }: { value: Attachment[]; onChange: (next: Attachment[]) => void }) {
  const [busy, setBusy] = React.useState(0)
  const [error, setError] = React.useState<string | null>(null)
  const [over, setOver] = React.useState(false)
  const input = React.useRef<HTMLInputElement>(null)
  const latest = React.useRef(value)
  latest.current = value

  const add = React.useCallback(
    async (files: File[]) => {
      setError(null)
      const ok = files.filter((f) => (f.type.startsWith('image/') || f.type === 'application/pdf') && f.size <= MAX_BYTES)
      if (ok.length < files.length) setError('Only images and PDFs up to 20 MB.')
      for (const f of ok) {
        setBusy((n) => n + 1)
        try {
          const a = await upload(f)
          onChange([...latest.current, a])
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Upload failed.')
        } finally {
          setBusy((n) => n - 1)
        }
      }
    },
    [onChange],
  )

  React.useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = [...(e.clipboardData?.files ?? [])]
      if (files.length) {
        e.preventDefault()
        void add(files)
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [add])

  return (
    <div className="grid gap-2">
      <input type="hidden" name="attachments_present" value="1" />
      {value.map((a) => (
        <input key={a.id} type="hidden" name="attachments" value={a.id} />
      ))}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((a) => (
            <div key={a.id} className="group relative overflow-hidden rounded-xl border">
              <a href={a.url ?? '#'} target="_blank" rel="noreferrer" className="block">
                {a.mimeType?.startsWith('image/') ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.thumb || a.url || ''} alt={a.filename ?? ''} className="size-20 object-cover" />
                ) : (
                  <span className="flex size-20 flex-col items-center justify-center gap-1 p-1 text-center text-[10px] text-muted-foreground">
                    <FileText className="size-5" />
                    <span className="w-full truncate">{a.filename}</span>
                  </span>
                )}
              </a>
              <button
                type="button"
                aria-label="Remove"
                onClick={() => onChange(value.filter((x) => x.id !== a.id))}
                className="absolute top-1 right-1 rounded-full bg-black/60 p-0.5 text-white opacity-0 group-hover:opacity-100"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          void add([...e.dataTransfer.files])
        }}
        className={cn('flex items-center justify-center gap-2 rounded-xl border border-dashed px-3 py-3 text-sm text-muted-foreground hover:bg-accent/50', over && 'border-primary bg-primary/10 text-primary')}
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Paperclip className="size-4" />}
        {busy ? 'Uploading…' : 'Attach receipt: drop, click or paste'}
      </button>
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        multiple
        hidden
        onChange={(e) => {
          void add([...(e.target.files ?? [])])
          e.target.value = ''
        }}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
