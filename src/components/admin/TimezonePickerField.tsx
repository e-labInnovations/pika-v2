'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { FieldError, FieldLabel, useField } from '@payloadcms/ui'
import { cn } from '@/lib/utils'
import DynamicIcon from '@/components/lucide/dynamic-icon'

type TimezoneInfo = {
  id: string
  region: string
  city: string
  offset: string
  label: string
}

interface Props {
  path: string
  field?: { label?: string; required?: boolean }
}

export function TimezonePickerField({ field, path }: Props) {
  const { value, setValue, showError, errorMessage } = useField<string>({ path })

  const [allTimezones, setAllTimezones] = useState<TimezoneInfo[]>([])
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('/api/timezones')
      .then((r) => r.json())
      .then((data) => setAllTimezones(data.docs ?? []))
      .catch(() => {})
  }, [])

  const grouped = useMemo(() => {
    const filtered = allTimezones.filter(
      (tz) =>
        !search ||
        tz.id.toLowerCase().includes(search.toLowerCase()) ||
        tz.city.toLowerCase().includes(search.toLowerCase()) ||
        tz.label.toLowerCase().includes(search.toLowerCase()),
    )

    return filtered.reduce<Record<string, TimezoneInfo[]>>((acc, tz) => {
      if (!acc[tz.region]) acc[tz.region] = []
      acc[tz.region].push(tz)
      return acc
    }, {})
  }, [allTimezones, search])

  const selected = allTimezones.find((tz) => tz.id === value)
  const regions = Object.keys(grouped).sort()

  return (
    <div className={`field-type${showError ? ' error' : ''}`}>
      <FieldLabel label={field?.label ?? 'Timezone'} required={field?.required} htmlFor={path} />
      <div className="twp">
        {/* Trigger */}
        <button
          type="button"
          id={path}
          onClick={() => setOpen(true)}
          className={cn(
            'flex h-[40px]! w-full items-center gap-2.5 rounded border px-3 text-sm transition-colors',
            'border-[var(--theme-border-color)] bg-[var(--theme-elevation-50)]',
            'text-[var(--theme-text)] hover:bg-[var(--theme-elevation-100)]',
            showError && 'border-red-500',
          )}
        >
          <DynamicIcon name="globe" size={14} className="shrink-0 opacity-50" />
          {selected ? (
            <span className="truncate">{selected.label}</span>
          ) : (
            <span className="opacity-40">Select a timezone…</span>
          )}
          <DynamicIcon name="chevron-down" size={14} className="ml-auto shrink-0 opacity-50" />
        </button>

        {/* Modal overlay */}
        {open && (
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4"
            onClick={() => { setOpen(false); setSearch('') }}
          >
            <div
              className="flex w-full max-w-lg flex-col overflow-hidden rounded-xl border border-[var(--theme-border-color)] bg-[var(--theme-elevation-0)] shadow-2xl"
              style={{ maxHeight: '75vh' }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-[var(--theme-border-color)] px-4 py-3">
                <span className="font-semibold text-[var(--theme-text)]">Select Timezone</span>
                <button
                  type="button"
                  onClick={() => { setOpen(false); setSearch('') }}
                  className="rounded p-1 opacity-50 hover:bg-[var(--theme-elevation-100)] hover:opacity-100"
                >
                  <DynamicIcon name="x" size={16} />
                </button>
              </div>

              {/* Search */}
              <div className="border-b border-[var(--theme-border-color)] px-3 py-2.5">
                <input
                  type="text"
                  placeholder="Search by city, region, or abbreviation…"
                  value={search}
                  // eslint-disable-next-line jsx-a11y/no-autofocus
                  autoFocus
                  onChange={(e) => setSearch(e.target.value)}
                  className={cn(
                    'h-9 w-full rounded border px-3 text-sm outline-none transition-colors',
                    'border-[var(--theme-border-color)] bg-[var(--theme-elevation-50)]',
                    'text-[var(--theme-text)] placeholder:opacity-40',
                    'focus:border-[var(--theme-elevation-500)]',
                  )}
                />
              </div>

              {/* List */}
              <div className="flex-1 overflow-y-auto">
                {regions.length === 0 ? (
                  <p className="px-4 py-10 text-center text-sm opacity-40">
                    No timezones matching &quot;{search}&quot;
                  </p>
                ) : (
                  regions.map((region) => (
                    <div key={region}>
                      <div className="sticky top-0 bg-[var(--theme-elevation-50)] px-4 py-1.5">
                        <span className="text-xs font-semibold uppercase tracking-wider opacity-50">
                          {region}
                        </span>
                      </div>
                      {grouped[region].map((tz) => (
                        <button
                          key={tz.id}
                          type="button"
                          onClick={() => {
                            setValue(tz.id)
                            setOpen(false)
                            setSearch('')
                          }}
                          className={cn(
                            'flex w-full items-center gap-3 px-4 py-2 text-left transition-colors',
                            value === tz.id
                              ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                              : 'hover:bg-[var(--theme-elevation-100)]',
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <span className="block truncate text-sm">{tz.label}</span>
                            <span className="block truncate text-xs opacity-40">{tz.id}</span>
                          </div>
                          {value === tz.id && (
                            <DynamicIcon name="check" size={14} className="shrink-0" color="#3b82f6" />
                          )}
                        </button>
                      ))}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      <FieldError showError={showError} message={errorMessage} />
    </div>
  )
}

export default TimezonePickerField
