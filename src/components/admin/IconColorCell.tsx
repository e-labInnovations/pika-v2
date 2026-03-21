'use client'

import React from 'react'
import Link from 'next/link'
import DynamicIcon from '@/components/lucide/dynamic-icon'
import type { IconName } from '@/components/lucide/lucide'

interface IconColorCellProps {
  cellData?: string
  rowData?: Record<string, unknown>
  collectionSlug?: string
}

export function IconColorCell({ cellData, rowData, collectionSlug }: IconColorCellProps) {
  const icon = cellData
  const color = rowData?.color as string | undefined
  const bgColor = rowData?.bgColor as string | undefined
  const id = rowData?.id as string | undefined

  const bubble = icon ? (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 28,
        height: 28,
        borderRadius: '50%',
        backgroundColor: bgColor || 'var(--theme-elevation-150)',
        color: color || 'var(--theme-text)',
        flexShrink: 0,
      }}
    >
      <DynamicIcon name={icon as IconName} size={14} color="currentColor" />
    </div>
  ) : (
    <span style={{ opacity: 0.3 }}>—</span>
  )

  if (collectionSlug && id) {
    return (
      <Link href={`/admin/collections/${collectionSlug}/${id}`}>
        {bubble}
      </Link>
    )
  }

  return bubble
}

export default IconColorCell
