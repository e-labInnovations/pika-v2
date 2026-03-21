'use client'

import React, { useEffect, useState } from 'react'
import { FieldError, FieldLabel, useField } from '@payloadcms/ui'
import { cn } from '@/lib/utils'
import DynamicIcon from '@/components/lucide/dynamic-icon'
import type { IconName } from '@/components/lucide/lucide'

type Account = {
  id: string
  name: string
  icon?: string
  color?: string
  bgColor?: string
  description?: string
}

interface AccountPickerFieldProps {
  path: string
  field?: { label?: string; required?: boolean }
  validate?: any
  label?: string
}

export function AccountPickerField({ field, path, validate, label }: AccountPickerFieldProps) {
  const { value, setValue, showError, errorMessage } = useField<string>({ path, validate })
  const [accounts, setAccounts] = useState<Account[]>([])
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const displayLabel = label || field?.label || 'Account'
  const isRequired = field?.required

  useEffect(() => {
    fetch('/api/accounts?limit=200&depth=0')
      .then((r) => r.json())
      .then((data) => setAccounts(data.docs || []))
      .catch(() => {})
  }, [])

  const selected = accounts.find((a) => a.id === value)
  const filtered = accounts.filter(
    (a) => search === '' || a.name.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className={`field-type${showError ? ' error' : ''}`}>
      <FieldLabel label={displayLabel} required={isRequired} htmlFor={path} />
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
          {selected ? (
            <>
              <div
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                style={{
                  backgroundColor: selected.bgColor || 'var(--theme-elevation-150)',
                  color: selected.color || 'var(--theme-text)',
                }}
              >
                <DynamicIcon
                  name={(selected.icon || 'wallet') as IconName}
                  size={13}
                  color={selected.color || 'currentColor'}
                />
              </div>
              <span className="truncate">{selected.name}</span>
            </>
          ) : (
            <span className="opacity-40">Select an account…</span>
          )}
          <DynamicIcon name="chevron-down" size={14} className="ml-auto shrink-0 opacity-50" />
        </button>

        {/* Modal overlay */}
        {open && (
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4"
            onClick={() => setOpen(false)}
          >
            <div
              className="flex w-full max-w-sm flex-col overflow-hidden rounded-xl border border-[var(--theme-border-color)] bg-[var(--theme-elevation-0)] shadow-2xl"
              style={{ maxHeight: '65vh' }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-[var(--theme-border-color)] px-4 py-3">
                <span className="font-semibold text-[var(--theme-text)]">Select Account</span>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded p-1 opacity-50 hover:bg-[var(--theme-elevation-100)] hover:opacity-100"
                >
                  <DynamicIcon name="x" size={16} />
                </button>
              </div>

              {/* Search */}
              <div className="border-b border-[var(--theme-border-color)] px-3 py-2.5">
                <input
                  type="text"
                  placeholder="Search accounts…"
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
              <div className="flex-1 overflow-y-auto p-2">
                {filtered.length === 0 ? (
                  <p className="px-4 py-10 text-center text-sm opacity-40">
                    {search ? `No accounts matching "${search}"` : 'No accounts available'}
                  </p>
                ) : (
                  <div className="flex flex-col gap-1">
                    {filtered.map((account) => (
                      <button
                        key={account.id}
                        type="button"
                        onClick={() => {
                          setValue(account.id)
                          setOpen(false)
                          setSearch('')
                        }}
                        className={cn(
                          'flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors',
                          value === account.id
                            ? 'border-blue-500/50 bg-blue-500/10'
                            : 'border-[var(--theme-border-color)] hover:bg-[var(--theme-elevation-100)]',
                        )}
                      >
                        <div
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                          style={{
                            backgroundColor: account.bgColor || 'var(--theme-elevation-150)',
                            color: account.color || 'var(--theme-text)',
                          }}
                        >
                          <DynamicIcon
                            name={(account.icon || 'wallet') as IconName}
                            size={15}
                            color={account.color || 'currentColor'}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-[var(--theme-text)]">
                            {account.name}
                          </p>
                          {account.description && (
                            <p className="truncate text-xs opacity-50">{account.description}</p>
                          )}
                        </div>
                        {value === account.id && (
                          <DynamicIcon name="check" size={14} className="shrink-0" color="#3b82f6" />
                        )}
                      </button>
                    ))}
                  </div>
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

export default AccountPickerField
