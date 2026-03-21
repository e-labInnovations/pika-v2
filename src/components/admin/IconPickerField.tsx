'use client'

import React from 'react'
import { FieldError, FieldLabel, useField } from '@payloadcms/ui'
import { cn } from '@/lib/utils'
import { Icon, IconPicker, type IconName } from '../ui/icon-picker'

interface IconPickerFieldProps {
  path: string
  field?: {
    label?: string
    required?: boolean
  }
  validate?: any
  label?: string
}

export const IconPickerField: React.FC<IconPickerFieldProps> = ({ field, path, validate, label }) => {
  const { value, setValue, showError, errorMessage } = useField<string>({ path, validate })

  const displayLabel = label || field?.label || 'Icon'
  const isRequired = field?.required

  return (
    <div className={`field-type${showError ? ' error' : ''}`}>
      <FieldLabel label={displayLabel} required={isRequired} htmlFor={path} />
      <div className="twp">
        <IconPicker value={value as IconName} onValueChange={(icon) => setValue(icon)} searchable categorized>
          <button
            type="button"
            id={path}
            className={cn(
              'flex h-[40px]! w-full cursor-pointer items-center gap-2.5 rounded px-3 text-sm transition-colors',
              'border border-[var(--theme-border-color)] bg-[var(--theme-elevation-50)]',
              'text-[var(--theme-text)] hover:bg-[var(--theme-elevation-100)]',
              showError && 'border-red-500',
            )}
          >
            {value ? (
              <>
                <Icon name={value as IconName} size={15} className="shrink-0 opacity-70" />
                <span className="truncate">{value}</span>
              </>
            ) : (
              <span className="opacity-40">Select an icon…</span>
            )}
          </button>
        </IconPicker>
      </div>
      <FieldError showError={showError} message={errorMessage} />
    </div>
  )
}

export default IconPickerField
