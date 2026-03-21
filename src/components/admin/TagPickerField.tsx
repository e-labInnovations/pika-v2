'use client'

import React, { useState, useEffect } from 'react'
import { FieldError, FieldLabel, useField } from '@payloadcms/ui'
import { cn } from '@/lib/utils'
import DynamicIcon from '@/components/lucide/dynamic-icon'
import type { IconName } from '@/components/lucide/lucide'

type Tag = {
  id: string
  name: string
  icon?: string
  color?: string
  bgColor?: string
  description?: string
}

interface TagPickerFieldProps {
  path: string
  field?: {
    label?: string
    required?: boolean
  }
  validate?: any
  label?: string
}

export function TagPickerField({ field, path, validate, label }: TagPickerFieldProps) {
  const { value = [], setValue, showError, errorMessage } = useField<string[]>({ path, validate })
  const [tags, setTags] = useState<Tag[]>([])
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)

  const displayLabel = label || field?.label || 'Tags'
  const isRequired = field?.required

  useEffect(() => {
    fetch('/api/tags?limit=200&depth=0')
      .then((r) => r.json())
      .then((data) => setTags(data.docs || []))
      .catch(() => {})
  }, [])

  const selectedIds = Array.isArray(value) ? value : []
  const selectedTags = selectedIds.map((id) => tags.find((t) => t.id === id)).filter(Boolean) as Tag[]
  const filteredTags = tags.filter(
    (t) =>
      !selectedIds.includes(t.id) &&
      (search === '' || t.name.toLowerCase().includes(search.toLowerCase())),
  )

  const add = (id: string) => {
    setValue([...selectedIds, id])
    setSearch('')
  }

  const remove = (id: string) => {
    setValue(selectedIds.filter((v) => v !== id))
  }

  return (
    <div className={`field-type${showError ? ' error' : ''}`}>
      <FieldLabel label={displayLabel} required={isRequired} htmlFor={path} />
      <div className="twp flex flex-col gap-2">
        {/* Selected tag chips */}
        {selectedTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {selectedTags.map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
                style={{
                  backgroundColor: tag.bgColor || 'var(--theme-elevation-100)',
                  color: tag.color || 'var(--theme-text)',
                }}
              >
                {tag.icon && (
                  <DynamicIcon name={tag.icon as IconName} size={12} color={tag.color || 'currentColor'} />
                )}
                {tag.name}
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    remove(tag.id)
                  }}
                  className="ml-0.5 opacity-60 hover:opacity-100"
                >
                  <DynamicIcon name="x" size={11} color={tag.color || 'currentColor'} />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Search input */}
        <div className="relative">
          <input
            id={path}
            type="text"
            placeholder="Search tags…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            className={cn(
              'h-[40px] w-full rounded border px-3 text-sm outline-none transition-colors',
              'border-[var(--theme-border-color)] bg-[var(--theme-elevation-50)]',
              'text-[var(--theme-text)] placeholder:opacity-40',
              'focus:border-[var(--theme-elevation-500)]',
              showError && 'border-red-500',
            )}
          />

          {open && (
            <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded border border-[var(--theme-border-color)] bg-[var(--theme-elevation-0)] shadow-lg">
              {filteredTags.length === 0 ? (
                <p className="px-3 py-4 text-center text-sm opacity-50">
                  {search ? `No tags matching "${search}"` : selectedIds.length === tags.length ? 'All tags selected' : 'No tags available'}
                </p>
              ) : (
                <div className="max-h-52 overflow-y-auto">
                  {filteredTags.map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault()
                        add(tag.id)
                      }}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-[var(--theme-elevation-100)]"
                    >
                      <div
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                        style={{
                          backgroundColor: tag.bgColor || 'var(--theme-elevation-150)',
                          color: tag.color || 'var(--theme-text)',
                        }}
                      >
                        <DynamicIcon
                          name={(tag.icon || 'tag') as IconName}
                          size={14}
                          color={tag.color || 'currentColor'}
                        />
                      </div>
                      <div className="flex min-w-0 flex-col">
                        <span className="text-sm font-medium text-[var(--theme-text)]">{tag.name}</span>
                        {tag.description && (
                          <span className="truncate text-xs opacity-50">{tag.description}</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <FieldError showError={showError} message={errorMessage} />
    </div>
  )
}

export default TagPickerField
