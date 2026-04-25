export type AIProvider = 'gemini' | 'huggingface'

/**
 * Derive the AI provider from a model ID.
 * Gemini models always start with "gemini-".
 * Everything else is treated as a HuggingFace model.
 */
export function getProviderForModel(modelId: string): AIProvider {
  return modelId.startsWith('gemini-') ? 'gemini' : 'huggingface'
}
