import React from 'react'

import { cn } from '@/lib/utils'

const COLORS = ['#4d8eff', '#4edea3', '#ffb2b7', '#f5b14c', '#b18cff', '#5ccfe6', '#ff8a65']

/** A person's photo, or their initial on a colour picked from the name (stable). */
export function Avatar({ name, url, size = 32, className }: { name: string; url?: string | null; size?: number; className?: string }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" width={size} height={size} className={cn('shrink-0 rounded-full object-cover', className)} style={{ width: size, height: size }} />
  }
  const color = COLORS[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length]
  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center rounded-full font-semibold', className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42), color, background: `color-mix(in srgb, ${color} 20%, transparent)` }}
    >
      {(name.trim()[0] ?? '?').toUpperCase()}
    </span>
  )
}
