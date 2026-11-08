import Link from 'next/link'
import React from 'react'

import { cn } from '@/lib/utils'

export function Card({ title, action, className, children }: { title?: string; action?: { href: string; label: string }; className?: string; children: React.ReactNode }) {
  return (
    <section className={cn('rounded-2xl border bg-card p-5', className)}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between">
          {title && <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">{title}</h2>}
          {action && (
            <Link href={action.href} className="text-sm font-medium text-primary hover:underline">
              {action.label}
            </Link>
          )}
        </div>
      )}
      {children}
    </section>
  )
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>
}
