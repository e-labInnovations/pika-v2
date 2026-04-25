'use client'

import { useRowLabel } from '@payloadcms/ui'

export function ModelRowLabel() {
  const { data, rowNumber } = useRowLabel<{ name?: string; id?: string }>()
  const label = data?.name || data?.id || `Model ${String((rowNumber ?? 0) + 1).padStart(2, '0')}`
  return <span>{label}</span>
}

export default ModelRowLabel
