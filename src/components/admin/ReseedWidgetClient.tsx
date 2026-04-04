'use client'

import React, { useState } from 'react'
import DynamicIcon from '@/components/lucide/dynamic-icon'

type Status = 'idle' | 'confirm' | 'loading' | 'success' | 'error'
type Action = 'reseed' | 'random'

export function ReseedWidgetClient() {
  const [status, setStatus] = useState<Status>('idle')
  const [pendingAction, setPendingAction] = useState<Action>('reseed')
  const [errorMsg, setErrorMsg] = useState('')
  const [log, setLog] = useState<string[]>([])
  const [people, setPeople] = useState(6)
  const [transactions, setTransactions] = useState(30)

  const reset = () => {
    setStatus('idle')
    setErrorMsg('')
    setLog([])
  }

  const requestConfirm = (action: Action) => {
    setPendingAction(action)
    setStatus('confirm')
  }

  const handleConfirm = async () => {
    setStatus('loading')
    setErrorMsg('')
    setLog([])

    try {
      if (pendingAction === 'reseed') {
        const res = await fetch('/api/seed/reseed', { method: 'POST' })
        const body = await res.json()
        if (!res.ok) throw new Error(body?.error || 'Reseed failed')
      } else {
        const res = await fetch('/api/seed/random', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ people, transactions }),
        })
        const body = await res.json()
        if (!res.ok) throw new Error(body?.error || 'Random seed failed')
        setLog(body.log ?? [])
      }
      setStatus('success')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error')
      setStatus('error')
    }
  }

  return (
    <div className="twp">
      <div
        style={{
          background: 'var(--theme-elevation-50)',
          border: '1px solid var(--theme-border-color)',
          borderRadius: '0.75rem',
          padding: '1.25rem',
        }}
      >
        <div className="mb-3 flex items-center gap-2">
          <DynamicIcon name="database" size={16} className="opacity-60" />
          <span className="text-sm font-semibold">Seed Data</span>
        </div>

        {/* Success */}
        {status === 'success' && (
          <div className="mb-4 rounded-lg bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-500">
            <div className="mb-1 flex items-center gap-2">
              <DynamicIcon name="circle-check" size={14} />
              {pendingAction === 'reseed' ? 'System data recreated.' : 'Random data added.'}
            </div>
            {log.length > 0 && (
              <ul className="mt-1 space-y-0.5 pl-1 opacity-80">
                {log.map((l, i) => <li key={i}>{l}</li>)}
              </ul>
            )}
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs font-medium text-red-400">
            <DynamicIcon name="circle-x" size={14} />
            {errorMsg}
          </div>
        )}

        {/* Confirm prompt */}
        {status === 'confirm' ? (
          <div className="space-y-3">
            {pendingAction === 'random' && (
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-xs opacity-70">
                  <span>People</span>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={people}
                    onChange={(e) => setPeople(Number(e.target.value))}
                    style={{ border: '1px solid var(--theme-border-color)', borderRadius: '0.375rem', background: 'var(--theme-elevation-100)' }}
                    className="w-14 px-2 py-1 text-xs"
                  />
                </label>
                <label className="flex items-center gap-1.5 text-xs opacity-70">
                  <span>Transactions</span>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={transactions}
                    onChange={(e) => setTransactions(Number(e.target.value))}
                    style={{ border: '1px solid var(--theme-border-color)', borderRadius: '0.375rem', background: 'var(--theme-elevation-100)' }}
                    className="w-16 px-2 py-1 text-xs"
                  />
                </label>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="text-xs opacity-60">
                {pendingAction === 'reseed' ? 'Delete and recreate system data?' : 'Generate random data now?'}
              </span>
              <button
                type="button"
                onClick={handleConfirm}
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700"
              >
                Confirm
              </button>
              <button
                type="button"
                onClick={reset}
                style={{ border: '1px solid var(--theme-border-color)', borderRadius: '0.5rem' }}
                className="px-3 py-1.5 text-xs font-medium opacity-60 transition hover:opacity-100"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : status === 'loading' ? (
          <div className="flex items-center gap-2 text-xs opacity-60">
            <DynamicIcon name="loader-circle" size={14} className="animate-spin" />
            {pendingAction === 'reseed' ? 'Reseeding…' : 'Generating random data…'}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {/* System reseed */}
            <div>
              <p className="mb-1.5 text-xs opacity-50">
                Recreate system categories &amp; tags from defaults.
              </p>
              <button
                type="button"
                onClick={() => requestConfirm('reseed')}
                style={{ border: '1px solid var(--theme-border-color)', borderRadius: '0.5rem' }}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium opacity-70 transition hover:opacity-100"
              >
                <DynamicIcon name="refresh-cw" size={14} />
                Reseed system data
              </button>
            </div>

            {/* Divider */}
            <div style={{ borderTop: '1px solid var(--theme-border-color)' }} className="my-1" />

            {/* Random seed */}
            <div>
              <p className="mb-1.5 text-xs opacity-50">
                Generate random people, tags, categories &amp; transactions with full combinations.
              </p>
              <button
                type="button"
                onClick={() => requestConfirm('random')}
                style={{ border: '1px solid var(--theme-border-color)', borderRadius: '0.5rem' }}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium opacity-70 transition hover:opacity-100"
              >
                <DynamicIcon name="sparkles" size={14} />
                Generate random data
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
