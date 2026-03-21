'use client'

import React from 'react'

export default function Logo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <img src="/icon.svg" alt="Pika" style={{ width: 36, height: 36 }} />
      <span style={{ fontSize: '1.4rem', fontWeight: 700, letterSpacing: '-0.02em' }}>Pika</span>
    </div>
  )
}
