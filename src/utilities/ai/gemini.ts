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
export const TRANSACTION_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title:     { type: Type.STRING },
    amount:    { type: Type.NUMBER },
    category:  { type: Type.STRING },
    tags:      { type: Type.ARRAY, items: { type: Type.STRING } },
    date:      { type: Type.STRING },
    type:      { type: Type.STRING, enum: ['income', 'expense', 'transfer'] },
    person:    { type: Type.STRING, nullable: true },
    account:   { type: Type.STRING },
    toAccount: { type: Type.STRING, nullable: true },
    note:      { type: Type.STRING },
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
