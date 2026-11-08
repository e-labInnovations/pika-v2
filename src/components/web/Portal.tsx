'use client'

import React from 'react'
import { createPortal } from 'react-dom'

/**
 * Renders into <body>. Overlays opened from the top bar need this: its backdrop-blur
 * makes it the containing block for position:fixed children, trapping them inside it.
 */
export function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])
  return mounted ? createPortal(children, document.body) : null
}
