'use client'

import React, { useState, useEffect } from 'react'
import { FieldError, FieldLabel, useField, useFormFields } from '@payloadcms/ui'
import { cn } from '@/lib/utils'
import DynamicIcon from '@/components/lucide/dynamic-icon'
import type { IconName } from '@/components/lucide/lucide'

type Category = {
  id: string
  name: string
  icon?: string
  color?: string
  bgColor?: string
  description?: string
  type: string
  parent?: { id: string; name: string } | string | null
}

interface CategoryPickerFieldProps {
  path: string
  field?: { label?: string; required?: boolean }
  validate?: any
  label?: string
}

function IconBubble({
  icon,
  color,
  bgColor,
  size = 'md',
}: {
  icon?: string
  color?: string
  bgColor?: string
  size?: 'sm' | 'md' | 'lg'
}) {
  const dims = { sm: { box: 24, icon: 12 }, md: { box: 28, icon: 14 }, lg: { box: 32, icon: 16 } }[size]
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full"
      style={{
        width: dims.box,
        height: dims.box,
        backgroundColor: bgColor || 'var(--theme-elevation-150)',
        color: color || 'var(--theme-text)',
      }}
    >
      <DynamicIcon
        name={(icon || 'tag') as IconName}
        size={dims.icon}
        color={color || 'currentColor'}
      />
    </div>
  )
}

export function CategoryPickerField({ field, path, validate, label }: CategoryPickerFieldProps) {
  const { value, setValue, showError, errorMessage } = useField<string>({ path, validate })
  const transactionType = useFormFields(([fields]) => fields.type?.value as string | undefined)

  const [allCategories, setAllCategories] = useState<Category[]>([])
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const displayLabel = label || field?.label || 'Category'
  const isRequired = field?.required

  useEffect(() => {
    fetch('/api/categories?limit=500&depth=1')
      .then((r) => r.json())
      .then((data) => setAllCategories(data.docs || []))
      .catch(() => {})
  }, [])

  const parentId = (c: Category) =>
    c.parent ? (typeof c.parent === 'string' ? c.parent : c.parent.id) : null

  const topLevel = allCategories.filter(
    (c) => !parentId(c) && (!transactionType || c.type === transactionType),
  )

  const childrenOf = (id: string) =>
    allCategories.filter(
      (c) => parentId(c) === id && (!transactionType || c.type === transactionType),
    )

  const filteredParents = topLevel.filter((parent) => {
    if (!search) return true
    const parentMatch = parent.name.toLowerCase().includes(search.toLowerCase())
    const childMatch = childrenOf(parent.id).some((c) =>
      c.name.toLowerCase().includes(search.toLowerCase()),
    )
    return parentMatch || childMatch
  })

  const getVisibleChildren = (parent: Category) => {
    const children = childrenOf(parent.id)
    if (!search || parent.name.toLowerCase().includes(search.toLowerCase())) return children
    return children.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
  }

  const selectedCategory = allCategories.find((c) => c.id === value)
  const typeLabel = transactionType
    ? transactionType.charAt(0).toUpperCase() + transactionType.slice(1)
    : ''

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
          {selectedCategory ? (
            <>
              <IconBubble
                icon={selectedCategory.icon}
                color={selectedCategory.color}
                bgColor={selectedCategory.bgColor}
                size="sm"
              />
              <span className="truncate">{selectedCategory.name}</span>
            </>
          ) : (
            <span className="opacity-40">Select a category…</span>
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
              className="flex w-full max-w-lg flex-col overflow-hidden rounded-xl border border-[var(--theme-border-color)] bg-[var(--theme-elevation-0)] shadow-2xl"
              style={{ maxHeight: '75vh' }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-[var(--theme-border-color)] px-4 py-3">
                <span className="font-semibold text-[var(--theme-text)]">
                  {typeLabel ? `${typeLabel} Categories` : 'Select Category'}
                </span>
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
                  placeholder="Search categories…"
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

              {/* Categories */}
              <div className="flex-1 overflow-y-auto">
                {filteredParents.length === 0 ? (
                  <p className="px-4 py-10 text-center text-sm opacity-40">
                    {search ? `No categories matching "${search}"` : 'No categories available'}
                  </p>
                ) : (
                  <div className="flex flex-col gap-2 p-3">
                    {filteredParents.map((parent) => {
                      const children = getVisibleChildren(parent)
                      return (
                        <div
                          key={parent.id}
                          className="overflow-hidden rounded-lg border border-[var(--theme-border-color)]"
                        >
                          {/* Parent row */}
                          <div className="flex items-center gap-3 bg-[var(--theme-elevation-50)] px-3 py-2.5">
                            <IconBubble
                              icon={parent.icon}
                              color={parent.color}
                              bgColor={parent.bgColor}
                              size="lg"
                            />
                            <div>
                              <p className="text-sm font-semibold text-[var(--theme-text)]">
                                {parent.name}
                              </p>
                              {parent.description && (
                                <p className="text-xs opacity-50">{parent.description}</p>
                              )}
                            </div>
                          </div>

                          {/* Children grid */}
                          {children.length > 0 && (
                            <div className="grid grid-cols-2 gap-1.5 bg-[var(--theme-elevation-0)] p-2">
                              {children.map((child) => (
                                <button
                                  key={child.id}
                                  type="button"
                                  onClick={() => {
                                    setValue(child.id)
                                    setOpen(false)
                                    setSearch('')
                                  }}
                                  className={cn(
                                    'flex items-center gap-2 rounded-md border px-2 py-2 text-left transition-colors',
                                    value === child.id
                                      ? 'border-blue-500/50 bg-blue-500/10'
                                      : 'border-[var(--theme-border-color)] hover:bg-[var(--theme-elevation-100)]',
                                  )}
                                >
                                  <IconBubble
                                    icon={child.icon}
                                    color={child.color}
                                    bgColor={child.bgColor}
                                    size="sm"
                                  />
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-xs font-medium text-[var(--theme-text)]">
                                      {child.name}
                                    </p>
                                    {child.description && (
                                      <p className="truncate text-xs opacity-40">{child.description}</p>
                                    )}
                                  </div>
                                  {value === child.id && (
                                    <DynamicIcon
                                      name="check"
                                      size={13}
                                      className="shrink-0"
                                      color="#3b82f6"
                                    />
                                  )}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
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

export default CategoryPickerField
