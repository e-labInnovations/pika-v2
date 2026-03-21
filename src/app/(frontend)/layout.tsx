import React from 'react'
import './styles.css'
import { readFile } from 'fs/promises'
import { join } from 'path'

export const metadata = {
  description: 'A blank template using Payload in a Next.js app.',
  title: 'Payload Blank Template',
}

async function getLucideSvg() {
  try {
    const svgPath = join(process.cwd(), 'public', 'lucide.svg')
    const svgContent = await readFile(svgPath, 'utf-8')
    return svgContent
  } catch (error) {
    console.error('Failed to load Lucide SVG sprite:', error)
    return null
  }
}

export default async function RootLayout(props: { children: React.ReactNode }) {
  const { children } = props
  const lucideSvg = await getLucideSvg()

  return (
    <html lang="en">
      <body>
        {lucideSvg && (
          <div
            id="lucide-sprite"
            style={{ display: 'none' }}
            dangerouslySetInnerHTML={{ __html: lucideSvg }}
          />
        )}
        <main>{children}</main>
      </body>
    </html>
  )
}
