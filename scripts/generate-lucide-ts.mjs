/**
 * Regenerates src/components/lucide/lucide.ts.
 *
 * - Preserves existing ICON_ALIAS_MAPPING
 * - Adds aliases for icons renamed/removed in the current lucide-static version
 * - Regenerates the IconName union type from lucide-static's tags.json
 * - Drops the duplicate iconsData array (it lives in icons-data.ts)
 */

import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

// ---------------------------------------------------------------------------
// New aliases for icons removed/renamed in lucide-static 1.7.0
// ---------------------------------------------------------------------------

const NEW_ALIASES = {
  // text / layout renames
  'align-center': 'text-align-center',
  'align-justify': 'text-align-justify',
  'align-left': 'text-align-start',
  'align-right': 'text-align-end',
  'indent-decrease': 'list-indent-decrease',
  'indent-increase': 'list-indent-increase',
  'wrap-text': 'text-wrap',
  'letter-text': 'text-initial',
  'text': 'text-initial',
  // interaction renames
  'grab': 'hand-grab',
  'flip-horizontal': 'mirror-rectangular',
  'flip-vertical': 'mirror-round',
  // file icon renames (-2 → -corner)
  'file-audio': 'file-headphone',
  'file-audio-2': 'file-headphone',
  'file-badge-2': 'file-badge',
  'file-check-2': 'file-check-corner',
  'file-code-2': 'file-code-corner',
  'file-json': 'file-braces',
  'file-json-2': 'file-braces-corner',
  'file-key-2': 'file-key',
  'file-lock-2': 'file-lock',
  'file-minus-2': 'file-minus-corner',
  'file-plus-2': 'file-plus-corner',
  'file-search-2': 'file-search-corner',
  'file-type-2': 'file-type-corner',
  'file-volume-2': 'file-volume',
  'file-warning': 'file-exclamation-point',
  'file-x-2': 'file-x-corner',
  // other renames
  'fingerprint': 'fingerprint-pattern',
  'rail-symbol': 'road',
  // brand icons removed from lucide – fall back to generic icon
  'chrome': 'globe',
  'codepen': 'code',
  'codesandbox': 'code',
  'dribbble': 'globe',
  'facebook': 'globe',
  'figma': 'pen-tool',
  'framer': 'pen-tool',
  'github': 'code',
  'gitlab': 'code',
  'instagram': 'camera',
  'linkedin': 'briefcase',
  'pocket': 'bookmark',
  'slack': 'message-square',
  'trello': 'layout-dashboard',
  'twitch': 'tv',
  'twitter': 'globe',
  'youtube': 'play-circle',
}

// ---------------------------------------------------------------------------
// Load existing alias mapping from lucide.ts
// ---------------------------------------------------------------------------

const existingContent = readFileSync(join(root, 'src/components/lucide/lucide.ts'), 'utf-8')

// Extract the existing ICON_ALIAS_MAPPING block
const aliasBlockMatch = existingContent.match(
  /export const ICON_ALIAS_MAPPING: Record<string, string> = \{([\s\S]*?)\};/,
)
if (!aliasBlockMatch) throw new Error('Could not find ICON_ALIAS_MAPPING in lucide.ts')

const existingAliases = {}
const aliasEntryRegex = /'([^']+)':\s*'([^']+)'/g
let m
while ((m = aliasEntryRegex.exec(aliasBlockMatch[1])) !== null) {
  existingAliases[m[1]] = m[2]
}

// Merge: existing aliases take priority; add new ones that aren't overridden
const mergedAliases = { ...existingAliases }
for (const [alias, target] of Object.entries(NEW_ALIASES)) {
  if (!(alias in mergedAliases)) {
    mergedAliases[alias] = target
  }
}

// ---------------------------------------------------------------------------
// Load icon names from lucide-static
// ---------------------------------------------------------------------------

const tagsData = JSON.parse(
  readFileSync(join(root, 'node_modules/lucide-static/tags.json'), 'utf-8'),
)
const iconNames = Object.keys(tagsData).sort()

// ---------------------------------------------------------------------------
// Emit lucide.ts
// ---------------------------------------------------------------------------

const aliasEntries = Object.entries(mergedAliases)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([k, v]) => `  '${k}': '${v}',`)
  .join('\n')

const iconNameUnion = iconNames
  .concat(Object.keys(mergedAliases))
  .sort()
  .filter((v, i, a) => a.indexOf(v) === i) // unique
  .map((n) => `  | '${n}'`)
  .join('\n')

const output = `\
/**
 * Icon alias mappings for Lucide Icons (Pika Project)
 *
 * Maps legacy/alternative icon names to current Lucide icon names.
 *
 * @generated Run \`pnpm generate:icons\` to regenerate.
 */

/**
 * Mapping of alias names to icon names
 */
export const ICON_ALIAS_MAPPING: Record<string, string> = {
${aliasEntries}
};

export type IconAliasName = keyof typeof ICON_ALIAS_MAPPING;

/**
 * Resolves an icon name from an alias. If the provided name is an alias,
 * returns the corresponding icon name. Otherwise, returns the original name.
 *
 * @param nameOrAlias - The icon name or alias to resolve
 * @returns The resolved icon name
 *
 * @example
 * resolveIconName('home') // returns 'house' (if 'home' is an alias for 'house')
 * resolveIconName('house') // returns 'house' (original name)
 * resolveIconName('unknown') // returns 'unknown' (not an alias)
 */
export function resolveIconName(nameOrAlias: string): string {
  return ICON_ALIAS_MAPPING[nameOrAlias] ?? nameOrAlias;
}

/**
 * All valid icon names (real names + aliases)
 */
export type IconName =
${iconNameUnion};
`

writeFileSync(join(root, 'src/components/lucide/lucide.ts'), output, 'utf-8')
console.log(
  `Generated lucide.ts — ${iconNames.length} icons, ${Object.keys(mergedAliases).length} aliases`,
)
