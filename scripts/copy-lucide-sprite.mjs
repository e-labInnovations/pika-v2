import { cpSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

cpSync(
  join(root, 'node_modules/lucide-static/sprite.svg'),
  join(root, 'public/lucide.svg'),
)
console.log('Lucide sprite copied to public/lucide.svg')
