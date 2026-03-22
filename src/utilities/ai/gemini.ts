import { GoogleGenAI, Type } from '@google/genai'

export type GeminiUsage = {
  promptTokenCount: number
  candidatesTokenCount: number
  totalTokenCount: number
}

export type GeminiResult = {
  data: Record<string, unknown>
  usage: GeminiUsage
  latencyMs: number
}

// Shared response schema (Gemini SDK format uses Type enum)
// amount is STRING to match Transactions collection which stores decimals as text
export const TRANSACTION_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  required: ['title', 'amount', 'type', 'date', 'account', 'toAccount', 'category', 'tags', 'person', 'note'],
  properties: {
    title:     { type: Type.STRING, description: 'Short descriptive title for the transaction' },
    amount:    { type: Type.STRING, description: 'Positive numeric string, e.g. "500.00". No currency symbols.' },
    category:  { type: Type.STRING, description: 'Category ID from the provided list, or empty string' },
    tags:      { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Array of tag IDs from the provided list' },
    date:      { type: Type.STRING, description: 'YYYY-MM-DD HH:MM:SS in user timezone. Use current datetime if unknown.' },
    type:      { type: Type.STRING, enum: ['income', 'expense', 'transfer'] },
    person:    { type: Type.STRING, description: 'Person ID from the provided list, or empty string' },
    account:   { type: Type.STRING, description: 'Account ID. For expense/income: the primary account. For transfer: the source account.' },
    toAccount: { type: Type.STRING, description: 'Account ID for transfer destination. Empty string for income/expense.' },
    note:      { type: Type.STRING, description: 'Optional extra context or note' },
  },
}

export async function callGeminiText(params: {
  apiKey: string
  model: string
  systemPrompt: string
  userPrompt: string
}): Promise<GeminiResult> {
  const ai = new GoogleGenAI({ apiKey: params.apiKey })
  const start = Date.now()

  const response = await ai.models.generateContent({
    model: params.model,
    config: {
      systemInstruction: params.systemPrompt,
      responseMimeType: 'application/json',
      responseSchema: TRANSACTION_RESPONSE_SCHEMA,
    },
    contents: params.userPrompt,
  })

  const latencyMs = Date.now() - start

  let data: Record<string, unknown> = {}
  try {
    data = JSON.parse(response.text ?? '{}')
  } catch { /* unreadable — return empty */ }

  const usage: GeminiUsage = {
    promptTokenCount: response.usageMetadata?.promptTokenCount ?? 0,
    candidatesTokenCount: response.usageMetadata?.candidatesTokenCount ?? 0,
    totalTokenCount: response.usageMetadata?.totalTokenCount ?? 0,
  }

  return { data, usage, latencyMs }
}

export async function callGeminiImage(params: {
  apiKey: string
  model: string
  systemPrompt: string
  userPrompt: string
  imageBase64: string
  mimeType: string
}): Promise<GeminiResult> {
  const ai = new GoogleGenAI({ apiKey: params.apiKey })
  const start = Date.now()

  const response = await ai.models.generateContent({
    model: params.model,
    config: {
      systemInstruction: params.systemPrompt,
      responseMimeType: 'application/json',
      responseSchema: TRANSACTION_RESPONSE_SCHEMA,
    },
    contents: [
      {
        parts: [
          { inlineData: { mimeType: params.mimeType, data: params.imageBase64 } },
          { text: params.userPrompt },
        ],
      },
    ],
  })

  const latencyMs = Date.now() - start

  let data: Record<string, unknown> = {}
  try {
    data = JSON.parse(response.text ?? '{}')
  } catch { /* unreadable receipt — return empty */ }

  const usage: GeminiUsage = {
    promptTokenCount: response.usageMetadata?.promptTokenCount ?? 0,
    candidatesTokenCount: response.usageMetadata?.candidatesTokenCount ?? 0,
    totalTokenCount: response.usageMetadata?.totalTokenCount ?? 0,
  }

  return { data, usage, latencyMs }
}
