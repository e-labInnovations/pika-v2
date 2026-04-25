import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'

const DEFAULT_MODELS = [
  { id: 'gemini-2.5-flash',                name: 'Gemini 2.5 Flash',        provider: 'gemini',      enabled: true, maxUserMonthlyTokens: 0, contextWindow: 1048576 },
  { id: 'gemini-2.5-pro',                  name: 'Gemini 2.5 Pro',          provider: 'gemini',      enabled: true, maxUserMonthlyTokens: 0, contextWindow: 1048576 },
  { id: 'gemini-2.0-flash',                name: 'Gemini 2.0 Flash',        provider: 'gemini',      enabled: true, maxUserMonthlyTokens: 0, contextWindow: 1048576 },
  { id: 'Qwen/Qwen3-VL-8B-Instruct',       name: 'Qwen3-VL 8B Instruct',   provider: 'huggingface', enabled: true, maxUserMonthlyTokens: 0, contextWindow: 131072 },
  { id: 'Qwen/Qwen3-VL-30B-A3B-Instruct',  name: 'Qwen3-VL 30B Instruct',  provider: 'huggingface', enabled: true, maxUserMonthlyTokens: 0, contextWindow: 131072 },
  { id: 'Qwen/Qwen3-VL-235B-A22B-Instruct', name: 'Qwen3-VL 235B Instruct', provider: 'huggingface', enabled: true, maxUserMonthlyTokens: 0, contextWindow: 131072 },
]

export async function up({ payload }: MigrateUpArgs): Promise<void> {
  const current = await (payload as any).findGlobal({
    slug: 'app-settings',
    depth: 0,
    context: { internal: true },
  })

  const existing: unknown[] = current?.ai?.models ?? []
  if (existing.length > 0) return

  await (payload as any).updateGlobal({
    slug: 'app-settings',
    data: {
      ai: {
        ...(current?.ai ?? {}),
        models: DEFAULT_MODELS,
      },
    },
    context: { internal: true },
  })
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  await (payload as any).updateGlobal({
    slug: 'app-settings',
    data: { ai: { models: [] } },
    context: { internal: true },
  })
}
