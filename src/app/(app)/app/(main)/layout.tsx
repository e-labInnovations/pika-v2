import React from 'react'

import { Sidebar } from '@/components/web/Sidebar'
import { TopBar } from '@/components/web/TopBar'
import { requireSession } from '@/lib/session'

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const { payload, user } = await requireSession()
  const isAdmin = user.role === 'admin'
  const sms = await payload.count({ collection: 'captured-sms', where: { and: [{ user: { equals: user.id } }, { status: { equals: 'pending' } }] }, user, overrideAccess: false })
  return (
    <>
      <Sidebar isAdmin={isAdmin} smsCount={sms.totalDocs} />
      <div className="min-w-0 lg:pl-60">
        <TopBar name={user.name || user.email} isAdmin={isAdmin} smsCount={sms.totalDocs} />
        <main className="mx-auto max-w-[1280px] min-w-0 px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </>
  )
}
