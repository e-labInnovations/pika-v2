'use client'

import React from 'react'
import { AuthClient } from 'payload-auth-plugin/client'

const authClient = new AuthClient('auth')

export default function GoogleSignInButton() {
  const { oauth } = authClient.signin()

  const handleSignIn = () => {
    oauth('google')
  }

  return (
    <div style={{ marginTop: '1rem' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        marginBottom: '1rem',
      }}>
        <div style={{ flex: 1, height: 1, background: 'var(--theme-elevation-100)' }} />
        <span style={{ fontSize: 12, color: 'var(--color-base-400)', whiteSpace: 'nowrap' }}>or continue with</span>
        <div style={{ flex: 1, height: 1, background: 'var(--theme-elevation-100)' }} />
      </div>

      <button
        type="button"
        onClick={handleSignIn}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.6rem',
          width: '100%',
          padding: '0.6rem 1rem',
          borderRadius: '0.4rem',
          border: '1px solid var(--theme-elevation-150, var(--theme-border-color))',
          background: 'var(--theme-elevation-50)',
          color: 'var(--theme-text)',
          fontSize: 14,
          fontWeight: 500,
          cursor: 'pointer',
          transition: 'background 0.15s, border-color 0.15s',
          fontFamily: 'inherit',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLButtonElement).style.background = 'var(--theme-elevation-100)'
          ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--theme-elevation-200)'
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.background = 'var(--theme-elevation-50)'
          ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--theme-elevation-150)'
        }}
      >
        <GoogleIcon />
        Sign in with Google
      </button>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  )
}
