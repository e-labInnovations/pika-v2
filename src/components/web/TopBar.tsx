import { Search } from 'lucide-react'
import React from 'react'

import { AddTransaction } from './AddTransaction'
import { MobileNav } from './Sidebar'
import { SignOut } from './SignOut'

/** Search (→ /app/transactions?q=), the account name, sign out. */
export function TopBar({ name, isAdmin, smsCount }: { name: string; isAdmin: boolean; smsCount?: number }) {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-3 px-4 lg:px-8">
        <MobileNav isAdmin={isAdmin} smsCount={smsCount} />
        <form action="/app/transactions" className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            name="q"
            type="search"
            placeholder="Search transactions"
            className="h-10 w-full rounded-xl border bg-card pr-3 pl-9 text-sm outline-none focus:ring-2 focus:ring-ring/40"
          />
        </form>
        <div className="ml-auto flex items-center gap-3">
          <AddTransaction />
          <span className="hidden text-sm text-muted-foreground sm:inline">{name}</span>
          <SignOut />
        </div>
      </div>
    </header>
  )
}
