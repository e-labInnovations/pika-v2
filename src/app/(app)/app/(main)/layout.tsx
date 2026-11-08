import React from 'react'

import { Sidebar } from '@/components/web/Sidebar'
import { TopBar } from '@/components/web/TopBar'
import { requireSession } from '@/lib/session'

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireSession()
  const isAdmin = user.role === 'admin'
  return (
    <>
      <Sidebar isAdmin={isAdmin} />
      <div className="min-w-0 lg:pl-60">
        <TopBar name={user.name || user.email} isAdmin={isAdmin} />
        <main className="mx-auto max-w-[1280px] min-w-0 px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </>
  )
}
