'use client'

import * as React from 'react'
import { useState, useCallback, useRef } from 'react'
import { cn } from '@/lib/utils'

interface SimpleTooltipProps {
  content: React.ReactNode
  children: React.ReactNode
  className?: string
  delayMs?: number
}

/**
 * Lightweight tooltip using position:fixed + trigger bounding rect.
 * Renders inline (no Portal) so it inherits the nearest .twp ancestor — unlike
 * Radix Tooltip which portals to <body> and loses scoped Tailwind styles.
 */
export function SimpleTooltip({ content, children, className, delayMs = 300 }: SimpleTooltipProps) {
  const [visible, setVisible] = useState(false)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const triggerRef = useRef<HTMLSpanElement>(null)

  const show = useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    setPos({ x: rect.left + rect.width / 2, y: rect.top - 8 })
    timerRef.current = setTimeout(() => setVisible(true), delayMs)
  }, [delayMs])

  const hide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setVisible(false)
  }, [])

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        style={{ display: 'contents' }}
      >
        {children}
      </span>
      {visible && (
        <div
          role="tooltip"
          style={{
            position: 'fixed',
            left: pos.x,
            top: pos.y,
            transform: 'translate(-50%, -100%)',
            zIndex: 9999,
            pointerEvents: 'none',
          }}
          className={cn(
            'rounded-md bg-foreground px-2 py-1 text-xs text-background shadow-md',
            className,
          )}
        >
          {content}
        </div>
      )}
    </>
  )
}
