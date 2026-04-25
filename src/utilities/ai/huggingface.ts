const HF_BASE_URL = 'https://router.huggingface.co/v1'

// Plain JSON Schema versions of the Gemini schemas (OpenAI-compatible format)
const TRANSACTION_JSON_SCHEMA = {
  type: 'object',
  required: [
    'title',
    'amount',
    'type',
    'date',
    'account',
    'toAccount',
    'category',
    'tags',
    'person',
    'note',
  ],
  properties: {
    title: {
      type: 'string',
      description:
        'REQUIRED — never empty. Merchant name, payee, or brief transaction description (e.g. "Breakfast Coffee", "Zomato", "Loan to Shamil").',
    },
    amount: {
      type: 'string',
      description: 'Positive numeric string, e.g. "500.00". No currency symbols.',
    },
    category: {
      type: 'string',
      description:
        'Exact child category ID from the provided list (the string before ":"). Empty string if no match.',
    },
    tags: {
      type: 'array',
      items: { type: 'string' },
      description: 'Array of tag IDs (exact ID strings) from the provided list.',
    },
    date: {
      type: 'string',
      description: 'YYYY-MM-DD HH:MM:SS in user timezone. Use current datetime if unknown.',
    },
    type: { type: 'string', enum: ['income', 'expense', 'transfer'] },
    person: {
      type: 'string',
      description: 'Exact person ID from the provided list. Empty string if unknown.',
    },
    account: {
      type: 'string',
      description:
        'Exact account ID from AVAILABLE ACCOUNTS — the string before ":" (e.g. "abc123", not the account name). Empty string if unknown.',
    },
    toAccount: {
      type: 'string',
      description:
        'Exact account ID for transfer destination (same format as account). Empty string for income/expense.',
    },
    note: {
      type: 'string',
      description: 'Any extra context not captured by other fields. Empty string if none.',
    },
  },
  additionalProperties: false,
}

const CATEGORY_SUGGESTION_JSON_SCHEMA = {
  type: 'object',
  required: ['categoryId'],
  properties: {
    categoryId: {
      type: 'string',
      description: 'Chosen child category ID from the provided list, or empty string if no match',
    },
  },
  additionalProperties: false,
}

export type HFUsage = {
  promptTokenCount: number
  candidatesTokenCount: number
  totalTokenCount: number
}

export type HFResult = {
  data: Record<string, unknown>
  usage: HFUsage
  latencyMs: number
}

async function callHF(params: {
  apiKey: string
  model: string
  systemPrompt: string
  userContent: Array<{ type: string; text?: string; image_url?: { url: string } }>
  jsonSchema: Record<string, unknown>
}): Promise<HFResult> {
  const start = Date.now()

  const response = await fetch(`${HF_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify({
      model: params.model,
      messages: [
        { role: 'system', content: params.systemPrompt },
        { role: 'user', content: params.userContent },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'response',
          schema: params.jsonSchema,
        },
      },
    }),
  })

  const latencyMs = Date.now() - start

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    const err = new Error(`HuggingFace API error ${response.status}: ${body}`)
    ;(err as any).status = response.status
    ;(err as any).responseBody = body
    throw err
  }

  const json = await response.json()

  let data: Record<string, unknown> = {}
  try {
    const content = json.choices?.[0]?.message?.content ?? '{}'
    data = JSON.parse(content)
  } catch {
    /* unreadable — return empty */
  }

  const usage: HFUsage = {
    promptTokenCount: json.usage?.prompt_tokens ?? 0,
    candidatesTokenCount: json.usage?.completion_tokens ?? 0,
    totalTokenCount: json.usage?.total_tokens ?? 0,
  }

  return { data, usage, latencyMs }
}

export async function callHFText(params: {
  apiKey: string
  model: string
  systemPrompt: string
  userPrompt: string
  useCategorySchema?: boolean
}): Promise<HFResult> {
  return callHF({
    apiKey: params.apiKey,
    model: params.model,
    systemPrompt: params.systemPrompt,
    userContent: [{ type: 'text', text: params.userPrompt }],
    jsonSchema: params.useCategorySchema
      ? CATEGORY_SUGGESTION_JSON_SCHEMA
      : TRANSACTION_JSON_SCHEMA,
  })
}

export async function callHFImage(params: {
  apiKey: string
  model: string
  systemPrompt: string
  userPrompt: string
  imageBase64: string
  mimeType: string
}): Promise<HFResult> {
  return callHF({
    apiKey: params.apiKey,
    model: params.model,
    systemPrompt: params.systemPrompt,
    userContent: [
      {
        type: 'image_url',
        image_url: { url: `data:${params.mimeType};base64,${params.imageBase64}` },
      },
      { type: 'text', text: params.userPrompt },
    ],
    jsonSchema: TRANSACTION_JSON_SCHEMA,
  })
}
