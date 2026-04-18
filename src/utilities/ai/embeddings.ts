/**
 * Sentence-embedding helper.
 *
 * Uses `@huggingface/transformers` (transformers.js) with the quantized
 * `Xenova/all-MiniLM-L6-v2` model (~22 MB, 384-dim). The pipeline is loaded
 * lazily on the first call and reused for the lifetime of the process.
 *
 * WHY: we need a fast, local, zero-cost way to semantically compare a
 * transaction title to our set of category names/descriptions. Gemini handles
 * the heavier "reasoning" suggestion path; this is the lightweight
 * "auto-prefill as the user types" path.
 */

import path from 'node:path'
import type { FeatureExtractionPipeline } from '@huggingface/transformers'

export const EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2'
export const EMBEDDING_DIM = 384

/** Where downloaded model weights live on disk (reused across restarts). */
const MODEL_CACHE_DIR = path.resolve(process.cwd(), '.cache', 'transformers-models')

let cached: Promise<FeatureExtractionPipeline> | null = null

async function loadPipeline(): Promise<FeatureExtractionPipeline> {
  // NOTE: `@huggingface/transformers` MUST be listed in next.config's
  // `serverExternalPackages` — otherwise Turbopack bundles the web build which
  // strips `node:fs` and model loading fails with a cryptic "Unable to get
  // model file path or buffer" error.
  const lib = await import('@huggingface/transformers')
  // Configure env on first import:
  // - disable local-path lookups (they use a nonsense default path on Node)
  // - keep remote download enabled (default, stated for clarity)
  // - persist to a real directory so we don't re-download on every restart
  lib.env.allowLocalModels = false
  lib.env.allowRemoteModels = true
  lib.env.cacheDir = MODEL_CACHE_DIR

  return lib.pipeline('feature-extraction', EMBEDDING_MODEL, {
    dtype: 'q8', // 8-bit quantized weights — ~22MB, tiny accuracy hit
  }) as unknown as Promise<FeatureExtractionPipeline>
}

/**
 * Returns the shared feature-extraction pipeline. Kicks off model loading on
 * first call (~3s cold start) and returns the cached instance on every call
 * after that.
 */
export function getEmbedder(): Promise<FeatureExtractionPipeline> {
  if (!cached) cached = loadPipeline()
  return cached
}

/**
 * Embed a single piece of text. Returns a Float32Array (length = EMBEDDING_DIM)
 * of L2-normalised activations — so `cosine(a, b) === dot(a, b)` for outputs
 * of this function.
 */
export async function embed(text: string): Promise<Float32Array> {
  const embedder = await getEmbedder()
  const output = await embedder(text, { pooling: 'mean', normalize: true })
  // Tensor → typed array
  const data = output.data as Float32Array | number[]
  return data instanceof Float32Array ? data : Float32Array.from(data)
}

/** Cosine similarity on two equally-sized vectors. Returns a value in [-1, 1]. */
export function cosine(a: Float32Array, b: Float32Array): number {
  const len = Math.min(a.length, b.length)
  let dot = 0
  let magA = 0
  let magB = 0
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i]
    magA += a[i] * a[i]
    magB += b[i] * b[i]
  }
  if (magA === 0 || magB === 0) return 0
  return dot / (Math.sqrt(magA) * Math.sqrt(magB))
}

/**
 * Warm the pipeline without blocking the caller. Useful to call on server
 * boot so the first real request doesn't pay the ~3s cold-start penalty.
 */
export function warmEmbedder(): void {
  // Fire-and-forget; swallow failures — callers will see them on a real request.
  void getEmbedder().catch(() => {})
}
