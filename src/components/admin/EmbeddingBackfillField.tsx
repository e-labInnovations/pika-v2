'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { FieldLabel } from '@payloadcms/ui'
import { cn } from '@/lib/utils'
import DynamicIcon from '@/components/lucide/dynamic-icon'

type Stats = { total: number; embedded: number; pending: number; running?: boolean }

async function fetchStats(): Promise<Stats> {
  const res = await fetch('/api/ai/backfill-embeddings/status', {
    credentials: 'include',
  })
  if (!res.ok) throw new Error(`Status ${res.status}`)
  return (await res.json()) as Stats
}

async function kickOff(): Promise<Stats> {
  const res = await fetch('/api/ai/backfill-embeddings', {
    method: 'POST',
    credentials: 'include',
  })
  if (!res.ok) throw new Error(`Status ${res.status}`)
  return (await res.json()) as Stats
}

/**
 * Admin-only UI field. Renders inside the App Settings → AI group. Lets an
 * admin kick off a background backfill of MiniLM title embeddings for their
 * own transactions (the history tier for local category prediction) and
 * watches progress with a poll-every-3-seconds status refresh.
 */
export function EmbeddingBackfillField({
  field,
}: {
  field?: { label?: string }
}) {
  const [stats, setStats] = useState<Stats | null>(null)
  const [kicking, setKicking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const refresh = useCallback(async () => {
    try {
      setError(null)
      setStats(await fetchStats())
    } catch (e) {
      setError((e as Error).message)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // Poll while there are pending rows.
  useEffect(() => {
    if (!stats || stats.pending <= 0) {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
      return
    }
    if (pollRef.current) return
    pollRef.current = setInterval(() => void refresh(), 3000)
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [stats, refresh])

  const handleClick = async () => {
    if (kicking) return
    setKicking(true)
    try {
      setError(null)
      setStats(await kickOff())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setKicking(false)
    }
  }

  const total = stats?.total ?? 0
  const embedded = stats?.embedded ?? 0
  const pending = stats?.pending ?? 0
  const percent = total > 0 ? Math.round((embedded / total) * 100) : 0
  const isComplete = stats !== null && total > 0 && pending === 0

  return (
    <div className="field-type">
      <FieldLabel label={field?.label ?? 'MiniLM Embedding Backfill'} />
      <div className="twp">
        <div
          className={cn(
            'rounded border p-3',
            'border-[var(--theme-border-color)] bg-[var(--theme-elevation-50)]',
          )}
        >
          <p className="mb-2 text-xs opacity-60">
            Generates a local MiniLM embedding for every transaction title so the
            history-tier category predictor can personalise suggestions. Runs in
            the background; safe to leave the page.
          </p>

          {stats && (
            <div className="mb-3">
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="font-mono">
                  {embedded.toLocaleString()} / {total.toLocaleString()} embedded
                  {pending > 0 && (
                    <span className="ml-2 opacity-60">({pending} pending)</span>
                  )}
                </span>
                <span className="font-mono opacity-70">{percent}%</span>
              </div>
              <div
                className="h-2 w-full overflow-hidden rounded"
                style={{ backgroundColor: 'var(--theme-elevation-100)' }}
              >
                <div
                  className="h-full transition-all"
                  style={{
                    width: `${percent}%`,
                    backgroundColor: isComplete
                      ? 'var(--theme-success-500, #10b981)'
                      : 'var(--theme-elevation-500, #6366f1)',
                  }}
                />
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClick}
              disabled={kicking}
              className={cn(
                'inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold transition-colors',
                'border border-[var(--theme-border-color)]',
                'bg-[var(--theme-elevation-100)] hover:bg-[var(--theme-elevation-150)]',
                'disabled:opacity-50',
              )}
            >
              <DynamicIcon name={pending > 0 ? 'refresh-cw' : 'play'} size={12} />
              {kicking
                ? 'Starting…'
                : pending > 0
                  ? 'Resume backfill'
                  : isComplete
                    ? 'All embedded — run again'
                    : 'Start backfill'}
            </button>
            {pending > 0 && (
              <span className="text-xs opacity-60">polling every 3s…</span>
            )}
          </div>

          {error && (
            <p className="mt-2 text-xs text-red-500">{error}</p>
          )}
        </div>
      </div>
    </div>
  )
}

export default EmbeddingBackfillField
