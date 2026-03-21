import { readFile } from 'fs/promises'
import { join } from 'path'

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

export default async function LucideSprite() {
  const lucideSvg = await getLucideSvg()

  if (lucideSvg) return (
      <div
        id="lucide-sprite"
        style={{ display: 'none' }}
        dangerouslySetInnerHTML={{ __html: lucideSvg }}
      />
    )
  
    return null
}
