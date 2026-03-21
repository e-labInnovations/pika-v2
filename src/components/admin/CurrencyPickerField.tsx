'use client'

import React, { useEffect, useRef, useState } from 'react'
import { FieldError, FieldLabel, useField } from '@payloadcms/ui'

interface Currency {
  code: string
  name: string
  symbol: string
  symbol_native: string
  decimal_digits: number
}

interface Props {
  path: string
  field?: { label?: string; required?: boolean }
}

export const CurrencyPickerField: React.FC<Props> = ({ field, path }) => {
  const { value, setValue, showError, errorMessage } = useField<string>({ path })

  const [currencies, setCurrencies] = useState<Currency[]>([])
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/currencies')
      .then((r) => r.json())
      .then((data) => setCurrencies(data.docs ?? []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selected = currencies.find((c) => c.code === value)

  const filtered = currencies.filter(
    (c) =>
      c.code.toLowerCase().includes(search.toLowerCase()) ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.symbol.toLowerCase().includes(search.toLowerCase()),
  )

  const handleSelect = (code: string) => {
    setValue(code)
    setOpen(false)
    setSearch('')
  }

  return (
    <div ref={containerRef} className={`field-type${showError ? ' error' : ''}`}>
      <FieldLabel label={field?.label ?? 'Currency'} required={field?.required} htmlFor={path} />

      <div className="twp" style={{ position: 'relative' }}>
        {/* Trigger */}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          style={{
            width: '100%',
            padding: '8px 12px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            border: '1px solid var(--theme-elevation-150)',
            borderRadius: '4px',
            background: 'var(--theme-bg)',
            color: 'var(--theme-text)',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          <span>
            {selected ? `${selected.code} — ${selected.name} (${selected.symbol})` : 'Select a currency…'}
          </span>
          <span style={{ opacity: 0.5 }}>{open ? '▲' : '▼'}</span>
        </button>

        {/* Dropdown */}
        {open && (
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              left: 0,
              right: 0,
              zIndex: 100,
              background: 'var(--theme-bg)',
              border: '1px solid var(--theme-elevation-150)',
              borderRadius: '4px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              maxHeight: '280px',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ padding: '8px' }}>
              <input
                autoFocus
                type="text"
                placeholder="Search by code, name or symbol…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  border: '1px solid var(--theme-elevation-150)',
                  borderRadius: '4px',
                  background: 'var(--theme-input-bg)',
                  color: 'var(--theme-text)',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <ul
              style={{
                margin: 0,
                padding: '0 0 4px',
                listStyle: 'none',
                overflowY: 'auto',
                flex: 1,
              }}
            >
              {filtered.length === 0 && (
                <li style={{ padding: '10px 14px', color: 'var(--theme-elevation-500)', fontSize: '13px' }}>
                  No currencies found
                </li>
              )}
              {filtered.map((c) => (
                <li
                  key={c.code}
                  onClick={() => handleSelect(c.code)}
                  style={{
                    padding: '8px 14px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: c.code === value ? 'var(--theme-elevation-50)' : 'transparent',
                    color: 'var(--theme-text)',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--theme-elevation-50)')}
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background =
                      c.code === value ? 'var(--theme-elevation-50)' : 'transparent')
                  }
                >
                  <span>
                    <strong>{c.code}</strong> — {c.name}
                  </span>
                  <span style={{ opacity: 0.6, marginLeft: '8px' }}>{c.symbol}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <FieldError showError={showError} message={errorMessage} />
    </div>
  )
}

export default CurrencyPickerField
