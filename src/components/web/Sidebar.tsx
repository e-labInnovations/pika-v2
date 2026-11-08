'use client'

import { BarChart3, Home, List, MessageSquareText, Shield, Users, X } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React from 'react'

import { cn } from '@/lib/utils'
import { NAV, isActive } from './nav'
import { Portal } from './Portal'

const ICONS = { home: Home, list: List, chart: BarChart3, people: Users, sms: MessageSquareText } as const

function Links({ isAdmin, smsCount = 0, onNavigate }: { isAdmin: boolean; smsCount?: number; onNavigate?: () => void }) {
  const path = usePathname()
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map((n) => {
        const Icon = ICONS[n.icon]
        const active = isActive(n.href, path)
        return (
          <Link
            key={n.href}
            href={n.href}
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
              active ? 'bg-sidebar-accent text-sidebar-primary' : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground',
            )}
          >
            <Icon className="size-4" />
            <span className="flex-1">{n.label}</span>
            {n.icon === 'sms' && smsCount > 0 && (
              <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">{smsCount}</span>
            )}
          </Link>
        )
      })}
      {isAdmin && (
        <a href="/admin" className="mt-4 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground">
          <Shield className="size-4" />
          Admin
        </a>
      )}
    </nav>
  )
}

function Brand() {
  return (
    <Link href="/app" className="flex items-center gap-2 px-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/favicon.svg" alt="" className="size-7" />
      <span className="text-lg font-bold tracking-tight">Pika</span>
    </Link>
  )
}

/** Fixed sidebar from lg up. */
export function Sidebar({ isAdmin, smsCount }: { isAdmin: boolean; smsCount?: number }) {
  return (
    <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col gap-6 border-r bg-sidebar px-3 py-6 lg:flex">
      <Brand />
      <Links isAdmin={isAdmin} smsCount={smsCount} />
    </aside>
  )
}

/** Below lg: the same links in a drawer opened from the top bar. */
export function MobileNav({ isAdmin, smsCount }: { isAdmin: boolean; smsCount?: number }) {
  const [open, setOpen] = React.useState(false)
  return (
    <>
      <button type="button" aria-label="Menu" onClick={() => setOpen(true)} className="rounded-lg p-2 hover:bg-accent lg:hidden">
        <List className="size-5" />
      </button>
      {open && (
        <Portal>
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col gap-6 bg-sidebar px-3 py-6 shadow-xl">
            <div className="flex items-center justify-between">
              <Brand />
              <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="rounded-lg p-2 hover:bg-accent">
                <X className="size-4" />
              </button>
            </div>
            <Links isAdmin={isAdmin} smsCount={smsCount} onNavigate={() => setOpen(false)} />
          </aside>
        </div>
        </Portal>
      )}
    </>
  )
}
