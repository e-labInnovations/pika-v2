/**
 * Regenerates src/components/ui/icons-data.ts from lucide-static's tags.json.
 *
 * - Preserves existing category assignments for icons that still exist
 * - Infers categories for new icons based on their tags via keyword matching
 */

import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

// ---------------------------------------------------------------------------
// Load source data
// ---------------------------------------------------------------------------

const tagsData = JSON.parse(
  readFileSync(join(root, 'node_modules/lucide-static/tags.json'), 'utf-8'),
)

const existingContent = readFileSync(
  join(root, 'src/components/ui/icons-data.ts'),
  'utf-8',
)

// ---------------------------------------------------------------------------
// Parse existing categories from the current icons-data.ts
// ---------------------------------------------------------------------------

const existingCategories = {}
const blockRegex = /\{\s*name:\s*'([^']+)'[^}]*categories:\s*\[([^\]]*)\]/gs
let m
while ((m = blockRegex.exec(existingContent)) !== null) {
  const name = m[1]
  const cats = [...m[2].matchAll(/'([^']+)'/g)].map((x) => x[1])
  existingCategories[name] = cats
}

// ---------------------------------------------------------------------------
// Category keyword rules for new icons (ordered: first match wins)
// ---------------------------------------------------------------------------

const CATEGORY_RULES = [
  // text / typography
  { cats: ['text'], keywords: ['text', 'font', 'letter', 'align', 'indent', 'wrap', 'paragraph', 'heading', 'italic', 'bold', 'underline', 'strikethrough', 'superscript', 'subscript'] },
  // development
  { cats: ['development'], keywords: ['git', 'code', 'database', 'api', 'server', 'terminal', 'command', 'branch', 'merge', 'commit', 'deploy', 'cloud sync', 'backup', 'form', 'json', 'braces'] },
  // security
  { cats: ['security'], keywords: ['shield', 'lock', 'key', 'fingerprint', 'cctv', 'password', 'auth', 'encrypted', 'firewall'] },
  // gaming
  { cats: ['gaming'], keywords: ['chess', 'game', 'gamepad', 'joystick', 'controller', 'play', 'puzzle'] },
  // shapes
  { cats: ['shapes'], keywords: ['circle', 'square', 'ellipse', 'triangle', 'rectangle', 'polygon', 'star', 'diamond', 'hexagon'] },
  // arrows
  { cats: ['arrows'], keywords: ['arrow', 'direction', 'pointer'] },
  // time
  { cats: ['time'], keywords: ['calendar', 'clock', 'time', 'date', 'schedule', 'alarm', 'timer', 'stopwatch', 'zodiac'] },
  // communication
  { cats: ['communication'], keywords: ['message', 'chat', 'mail', 'email', 'phone', 'notification', 'broadcast'] },
  // multimedia
  { cats: ['multimedia'], keywords: ['music', 'audio', 'video', 'camera', 'image', 'photo', 'sound', 'metronome', 'turntable', 'radio', 'hd', 'film', 'speaker', 'headphone', 'microphone'] },
  // transportation
  { cats: ['transportation'], keywords: ['car', 'truck', 'bus', 'train', 'plane', 'ship', 'motorcycle', 'motorbike', 'scooter', 'helicopter', 'vehicle', 'ev', 'charger', 'van', 'bike', 'bicycle'] },
  // maps / navigation
  { cats: ['maps'], keywords: ['map', 'location', 'pin', 'globe', 'navigate', 'compass', 'gps', 'road'] },
  // home
  { cats: ['home'], keywords: ['house', 'home', 'room', 'furniture', 'sofa', 'bed', 'shelf', 'towel', 'solar', 'birdhouse', 'kitchen'] },
  // food
  { cats: ['food'], keywords: ['food', 'eat', 'drink', 'beef', 'fruit', 'vegetable', 'meat', 'pizza', 'coffee', 'tea', 'cannabis'] },
  // nature
  { cats: ['nature'], keywords: ['tree', 'plant', 'flower', 'rose', 'leaf', 'nature', 'animal', 'mountain', 'sun', 'moon', 'star', 'balloon', 'stone', 'rock'] },
  // sports / outdoors
  { cats: ['sports'], keywords: ['sport', 'fish', 'fishing', 'kayak', 'shoe', 'gym', 'fitness', 'exercise'] },
  // users / people
  { cats: ['users'], keywords: ['user', 'person', 'people', 'team', 'group', 'avatar', 'profile', 'account'] },
  // devices
  { cats: ['devices'], keywords: ['device', 'monitor', 'computer', 'phone', 'tablet', 'printer', 'mouse', 'keyboard', 'screen'] },
  // tools
  { cats: ['tools'], keywords: ['tool', 'wrench', 'hammer', 'screwdriver', 'toolbox', 'settings', 'build'] },
  // science
  { cats: ['science'], keywords: ['science', 'lab', 'experiment', 'atom', 'molecule', 'chemical', 'weight', 'measure', 'scale'] },
  // layout / design
  { cats: ['layout', 'design'], keywords: ['layout', 'panel', 'grid', 'column', 'row', 'layer', 'mirror', 'lens', 'line', 'style'] },
  // files
  { cats: ['files'], keywords: ['file', 'document', 'folder', 'book', 'note', 'search', 'braces'] },
  // cursors
  { cats: ['cursors'], keywords: ['cursor', 'hand', 'grab', 'pointer', 'click', 'drag'] },
  // shopping
  { cats: ['shopping'], keywords: ['cart', 'shop', 'store', 'bag', 'buy', 'purchase', 'price', 'tag'] },
  // buildings
  { cats: ['buildings'], keywords: ['building', 'office', 'city', 'wall', 'brick', 'architecture'] },
  // medical
  { cats: ['medical'], keywords: ['medical', 'health', 'hospital', 'doctor', 'medicine', 'pill', 'syringe', 'heart'] },
  // navigation
  { cats: ['navigation'], keywords: ['navigation', 'menu', 'search', 'find', 'discover'] },
]

function inferCategories(iconName, tags) {
  const haystack = [iconName, ...tags].join(' ').toLowerCase()

  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((kw) => haystack.includes(kw))) {
      return rule.cats
    }
  }

  return ['design'] // safe fallback
}

// ---------------------------------------------------------------------------
// Build updated icons list
// ---------------------------------------------------------------------------

const icons = Object.entries(tagsData).map(([name, tags]) => ({
  name,
  categories: existingCategories[name] ?? inferCategories(name, tags),
  tags,
}))

// ---------------------------------------------------------------------------
// Emit the TypeScript file
// ---------------------------------------------------------------------------

const lines = [
  `/**`,
  ` * Icon data array for Lucide Icons`,
  ` *`,
  ` * This file contains metadata for all Lucide icons including their names,`,
  ` * categories, and tags. Generated automatically from lucide-static.`,
  ` *`,
  ` * @generated Run \`pnpm generate:icons\` to regenerate.`,
  ` */`,
  ``,
  `export const IconCategory = {`,
  `  Text: 'text',`,
  `  Design: 'design',`,
  `  Layout: 'layout',`,
  `  Navigation: 'navigation',`,
  `  Social: 'social',`,
  `  Finance: 'finance',`,
  `  Business: 'business',`,
  `  Development: 'development',`,
  `  Devices: 'devices',`,
  `  Files: 'files',`,
  `  Maps: 'maps',`,
  `  Users: 'users',`,
  `  Cursors: 'cursors',`,
  `  Gaming: 'gaming',`,
  `  Weather: 'weather',`,
  `  Animals: 'animals',`,
  `  Food: 'food',`,
  `  Travel: 'travel',`,
  `  Buildings: 'buildings',`,
  `  Home: 'home',`,
  `  Medical: 'medical',`,
  `  Transportation: 'transportation',`,
  `  Tools: 'tools',`,
  `  Security: 'security',`,
  `  Multimedia: 'multimedia',`,
  `  Communication: 'communication',`,
  `  Shopping: 'shopping',`,
  `  Sports: 'sports',`,
  `  Science: 'science',`,
  `  Brands: 'brands',`,
  `  Arrows: 'arrows',`,
  `  Shapes: 'shapes',`,
  `  Accessibility: 'accessibility',`,
  `  Account: 'account',`,
  `  Notifications: 'notifications',`,
  `  Time: 'time',`,
  `  Money: 'money',`,
  `  Clothing: 'clothing',`,
  `  Nature: 'nature',`,
  `  Photos: 'photos',`,
  `  Charts: 'charts',`,
  `} as const;`,
  ``,
  `/**`,
  ` * Type definition for icon data`,
  ` */`,
  `export type IconData = {`,
  `  name: string;`,
  `  categories: string[];`,
  `  tags: string[];`,
  `};`,
  ``,
  `/**`,
  ` * Array of all Lucide icons with their metadata`,
  ` */`,
  `export const iconsData: IconData[] = [`,
]

for (const icon of icons) {
  lines.push(`  {`)
  lines.push(`    name: '${icon.name}',`)
  const cats = icon.categories.map((c) => `'${c}'`).join(', ')
  lines.push(`    categories: [${cats}],`)
  const tags = icon.tags.map((t) => `'${t.replace(/'/g, "\\'")}'`).join(', ')
  lines.push(`    tags: [${tags}],`)
  lines.push(`  },`)
}

lines.push(`]`)
lines.push(``)

writeFileSync(join(root, 'src/components/ui/icons-data.ts'), lines.join('\n'), 'utf-8')

console.log(`Generated icons-data.ts with ${icons.length} icons`)
