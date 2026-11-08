import React from 'react'

import { DynamicIcon, type IconName } from '@/components/lucide'
import { cn } from '@/lib/utils'

/** A category / tag / account icon on its colour, as in the phone app. */
export function EntityIcon({
  icon,
  color,
  bgColor,
  size = 36,
  className,
}: {
  icon?: string | null
  color?: string | null
  bgColor?: string | null
  size?: number
  className?: string
}) {
  const fg = color || 'var(--primary)'
  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center rounded-xl', className)}
      style={{ width: size, height: size, background: bgColor || `color-mix(in srgb, ${fg} 18%, transparent)` }}
    >
      <DynamicIcon name={(icon || 'circle') as IconName} size={Math.round(size * 0.48)} color={fg} />
    </span>
  )
}
