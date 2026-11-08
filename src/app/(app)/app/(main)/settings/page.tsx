import React from 'react'

import { SettingsForm } from '@/components/web/SettingsForm'
import { currencies } from '@/data/currencies'
import { timezones } from '@/data/timezones'
import { requireSession } from '@/lib/session'
import { loadSettings } from '@/lib/web/settings'
import { loadLookups } from '@/lib/web/transactions'

export const metadata = { title: 'Settings' }

export default async function SettingsPage() {
  const { payload, user } = await requireSession()
  const [settings, lookups] = await Promise.all([loadSettings(payload, user), loadLookups(payload, user)])
  return (
    <div className="grid grid-cols-1 gap-5">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
      <SettingsForm
        initial={settings}
        accounts={lookups.accounts.filter((a) => !a.archived).map((a) => ({ id: a.id, name: a.name }))}
        timezones={timezones.map((t) => ({ id: t.id, label: t.label }))}
        currencies={Object.values(currencies).map((c) => ({ code: c.code, label: `${c.code} — ${c.name} (${c.symbol_native})` })).sort((a, b) => a.code.localeCompare(b.code))}
      />
    </div>
  )
}
