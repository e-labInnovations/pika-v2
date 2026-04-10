'use client'

import React, { useState } from 'react'
import { Copy, Check } from 'lucide-react'

type Props = {
  code: string
  language?: string
  caption?: string
}

export function CodeBlockRenderer({ code, language, caption }: Props) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="my-6 rounded-xl overflow-hidden border border-border">
      <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b border-border">
        <span className="text-xs font-mono text-muted-foreground">{caption || language || 'code'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="p-4 bg-card overflow-x-auto text-xs font-mono leading-relaxed text-foreground/80">
        <code>{code}</code>
      </pre>
    </div>
  )
}
