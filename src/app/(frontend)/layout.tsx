import React from 'react'
import './styles.css'

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
    <html lang="en">
      <body>
        <main>{children}</main>
      </body>
    </html>
  )
}
