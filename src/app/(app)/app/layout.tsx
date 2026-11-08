import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import React from 'react'

import './app.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })

export const metadata: Metadata = {
  title: { default: 'Pika', template: '%s · Pika' },
  description: 'Your Pika money, on a big screen.',
  icons: { icon: [{ url: '/icons/favicon.svg', type: 'image/svg+xml' }], apple: '/icons/apple-touch-icon.png' },
  robots: { index: false },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f4f6ff' },
    { media: '(prefers-color-scheme: dark)', color: '#0d1322' },
  ],
}

export default function AppRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  )
}
