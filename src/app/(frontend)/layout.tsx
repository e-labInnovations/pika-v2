import React from 'react'
import { Inter } from 'next/font/google'
import './styles.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata = {
  title: { default: 'Pika', template: '%s — Pika' },
  description: 'Personal finance tracker',
  icons: {
    icon: [
      { url: '/icons/favicon.svg', type: 'image/svg+xml' },
      { url: '/icons/favicon.ico', type: 'image/x-icon' },
    ],
    apple: '/icons/apple-touch-icon.png',
  },
}

export default function RootLayout(props: { children: React.ReactNode }) {
  const { children } = props

  return (
    <html lang="en" className={`dark ${inter.variable}`}>
      <body className="font-[family-name:var(--font-inter)]">
        <main>{children}</main>
      </body>
    </html>
  )
}
