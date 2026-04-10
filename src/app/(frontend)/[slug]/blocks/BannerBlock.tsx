import React from 'react'
import { Info, AlertTriangle, CheckCircle, XCircle } from 'lucide-react'

type Props = {
  style: 'info' | 'warning' | 'success' | 'error'
  content: string
}

const VARIANTS = {
  info:    { icon: Info,          class: 'border-blue-500 bg-blue-500/10 text-blue-300' },
  warning: { icon: AlertTriangle, class: 'border-yellow-500 bg-yellow-500/10 text-yellow-300' },
  success: { icon: CheckCircle,   class: 'border-emerald-500 bg-emerald-500/10 text-emerald-300' },
  error:   { icon: XCircle,       class: 'border-red-500 bg-red-500/10 text-red-300' },
}

export function BannerBlockRenderer({ style, content }: Props) {
  const variant = VARIANTS[style] ?? VARIANTS.info
  const Icon = variant.icon
  return (
    <div className={`my-6 flex gap-3 border-l-4 rounded-r-lg p-4 ${variant.class}`}>
      <Icon size={18} className="mt-0.5 flex-shrink-0" />
      <p className="text-sm leading-relaxed">{content}</p>
    </div>
  )
}
