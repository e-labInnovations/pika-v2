'use client'

import { useEffect, useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { DynamicIcon } from '@/components/lucide'
import { cn } from '@/lib/utils'

interface ColorPickerProps {
  color: string
  setColor: (color: string) => void
  className?: string
}

const suggestedColors = [
  ['#3B82F6', '#06B6D4', '#10B981', '#84CC16', '#EAB308', '#F97316', '#EF4444', '#EC4899'],
  ['#93C5FD', '#67E8F9', '#6EE7B7', '#BEF264', '#FDE047', '#FDBA74', '#FCA5A5', '#F9A8D4'],
  ['#1D4ED8', '#0891B2', '#059669', '#65A30D', '#CA8A04', '#EA580C', '#DC2626', '#DB2777'],
  ['#1E3A8A', '#164E63', '#064E3B', '#365314', '#92400E', '#9A3412', '#991B1B', '#BE185D'],
  ['#F8FAFC', '#F1F5F9', '#E2E8F0', '#CBD5E1', '#94A3B8', '#64748B', '#475569', '#334155'],
]

const ColorPicker = ({ color, setColor, className }: ColorPickerProps) => {
  const [hexInput, setHexInput] = useState(color)
  const [hexError, setHexError] = useState('')

  useEffect(() => {
    setHexInput(color)
  }, [color])

  const handleColorSelect = (newColor: string) => {
    setColor(newColor)
    setHexInput(newColor)
    setHexError('')
  }

  const handleHexInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setHexInput(value)
    const hexRegex = /^#[A-Fa-f0-9]{6}$/
    if (hexRegex.test(value)) {
      setColor(value)
      setHexError('')
    } else if (value.length === 7) {
      setHexError('Invalid hex color')
    } else {
      setHexError('')
    }
  }

  const handleHexInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const hexRegex = /^#[A-Fa-f0-9]{6}$/
      if (hexRegex.test(hexInput)) {
        setColor(hexInput)
        setHexError('')
      } else {
        setHexError('Invalid color')
      }
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex h-[40px]! w-full cursor-pointer items-center gap-2.5 rounded px-3 text-sm transition-colors',
            'border border-[var(--theme-border-color)] bg-[var(--theme-elevation-50)]',
            'text-[var(--theme-text)] hover:bg-[var(--theme-elevation-100)]',
            className,
          )}
        >
          <div
            className="h-4 w-4 shrink-0 rounded border border-black/10 dark:border-white/10"
            style={{ backgroundColor: color }}
          />
          <span className="font-mono text-xs tracking-wide">{color}</span>
          <DynamicIcon name="chevron-down" className="ml-auto h-3.5 w-3.5 opacity-40" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="twp flex w-auto flex-col gap-3 p-3 dark:border-gray-700 dark:bg-gray-900"
        align="start"
      >
        {/* Color swatches */}
        <div className="grid grid-cols-8 gap-1">
          {suggestedColors.map((row, rowIndex) =>
            row.map((suggestedColor, colIndex) => (
              <button
                key={`${rowIndex}-${colIndex}`}
                type="button"
                onClick={() => handleColorSelect(suggestedColor)}
                className={cn(
                  'h-5 w-5 rounded border transition-transform hover:scale-110 hover:cursor-pointer',
                  color === suggestedColor
                    ? 'border-gray-800 ring-1 ring-offset-1 ring-gray-400 dark:border-gray-200'
                    : 'border-gray-200 dark:border-gray-700',
                )}
                style={{ backgroundColor: suggestedColor }}
                title={suggestedColor}
              />
            )),
          )}
        </div>

        {/* Hex Input */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={hexInput}
              onChange={handleHexInputChange}
              onKeyDown={handleHexInputKeyDown}
              className={cn(
                'h-8 flex-1 rounded border px-2.5 font-mono text-xs focus:outline-none focus:ring-2',
                'bg-white text-gray-900 placeholder:text-gray-400 dark:bg-gray-800 dark:text-gray-100',
                hexError
                  ? 'border-red-400 focus:ring-red-400/30 dark:border-red-500'
                  : 'border-gray-200 focus:border-blue-400 focus:ring-blue-500/20 dark:border-gray-600',
              )}
              placeholder="#000000"
            />
            <div
              className="h-8 w-8 shrink-0 rounded border border-black/10 dark:border-white/10"
              style={{ backgroundColor: color }}
            />
          </div>
          {hexError && (
            <div className="flex items-center gap-1 text-red-500 dark:text-red-400">
              <DynamicIcon name="triangle-alert" className="h-3 w-3" />
              <p className="text-xs">{hexError}</p>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export default ColorPicker
