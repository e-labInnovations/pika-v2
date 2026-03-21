'use client'

import React, { useState } from 'react'
import { FieldError, FieldLabel, useField } from '@payloadcms/ui'
import { cn } from '@/lib/utils'
import DynamicIcon from '@/components/lucide/dynamic-icon'

interface ApiKeyFieldProps {
  path: string
  field?: { label?: string; required?: boolean }
}

export function ApiKeyField({ field, path }: ApiKeyFieldProps) {
  const { value, setValue, showError, errorMessage } = useField<string>({ path })
  const [visible, setVisible] = useState(false)

  const isMasked = typeof value === 'string' && value.includes('****')
  const displayValue = visible && !isMasked ? value : value

  return (
    <div className={`field-type${showError ? ' error' : ''}`}>
      <FieldLabel label={field?.label ?? 'API Key'} required={field?.required} htmlFor={path} />
      <div className="twp">
        <div className="relative flex items-center">
          <input
            id={path}
            type={visible ? 'text' : 'password'}
            value={displayValue ?? ''}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Enter API key…"
            autoComplete="off"
            className={cn(
              'h-[40px] w-full rounded border pr-10 pl-3 font-mono text-sm outline-none transition-colors',
              'border-[var(--theme-border-color)] bg-[var(--theme-elevation-50)]',
              'text-[var(--theme-text)] placeholder:opacity-40 placeholder:font-sans',
              'focus:border-[var(--theme-elevation-500)]',
              showError && 'border-red-500',
            )}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            tabIndex={-1}
            className="absolute right-3 opacity-40 hover:opacity-100 transition-opacity"
          >
            <DynamicIcon name={visible ? 'eye-off' : 'eye'} size={15} />
          </button>
        </div>

        {isMasked && (
          <p className="mt-1.5 text-xs opacity-50">
            A key is already configured. Type a new one to replace it.
          </p>
        )}
      </div>
      <FieldError showError={showError} message={errorMessage} />
    </div>
  )
}

export default ApiKeyField
