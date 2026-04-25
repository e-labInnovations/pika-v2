import {
  GraphQLInt,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLScalarType,
  GraphQLString,
  GraphQLFloat,
  Kind,
} from 'graphql'

const GraphQLJSON = new GraphQLScalarType({
  name: 'AITransactionData',
  description: 'Arbitrary JSON value',
  serialize: (v) => v,
  parseValue: (v) => v,
  parseLiteral: (ast) => {
    if (ast.kind === Kind.STRING) { try { return JSON.parse(ast.value) } catch { return ast.value } }
    if (ast.kind === Kind.INT || ast.kind === Kind.FLOAT) return Number(ast.value)
    if (ast.kind === Kind.BOOLEAN) return ast.value
    if (ast.kind === Kind.NULL) return null
    return null
  },
})
import {
  processTextToTransaction,
  processImageToTransaction,
  processCategorySuggestion,
  type TxType,
} from '../utilities/ai/service'
import { processCategoryPrediction } from '../utilities/ai/predict-category'

// ─── Types ────────────────────────────────────────────────────────────────────

const AIUsageMetaType = new GraphQLObjectType({
  name: 'AIUsageMeta',
  fields: {
    promptTokenCount:     { type: new GraphQLNonNull(GraphQLInt) },
    candidatesTokenCount: { type: new GraphQLNonNull(GraphQLInt) },
    totalTokenCount:      { type: new GraphQLNonNull(GraphQLInt) },
  },
})

const AITransactionResultType = new GraphQLObjectType({
  name: 'AITransactionResult',
  fields: {
    data:       { type: GraphQLJSON, description: 'Predicted transaction fields' },
    model:      { type: new GraphQLNonNull(GraphQLString) },
    latencyMs:  { type: new GraphQLNonNull(GraphQLFloat) },
    usage:      { type: new GraphQLNonNull(AIUsageMetaType) },
  },
})

const AICategorySuggestionResultType = new GraphQLObjectType({
  name: 'AICategorySuggestionResult',
  fields: {
    category:   { type: GraphQLJSON, description: 'Resolved child Category object, or null if no match' },
    reason:     { type: new GraphQLNonNull(GraphQLString) },
    model:      { type: new GraphQLNonNull(GraphQLString) },
    latencyMs:  { type: new GraphQLNonNull(GraphQLFloat) },
    usage:      { type: new GraphQLNonNull(AIUsageMetaType) },
  },
})

const AICategoryPredictionResultType = new GraphQLObjectType({
  name: 'AICategoryPredictionResult',
  fields: {
    category:  { type: GraphQLJSON, description: 'Resolved child Category object, or null when no candidate clears the score threshold' },
    score:     { type: new GraphQLNonNull(GraphQLFloat), description: 'Best cosine similarity in [0, 1]' },
    model:     { type: new GraphQLNonNull(GraphQLString) },
    latencyMs: { type: new GraphQLNonNull(GraphQLFloat) },
  },
})

const ALLOWED_TX_TYPES: TxType[] = ['income', 'expense', 'transfer']

// ─── Mutations ────────────────────────────────────────────────────────────────

export const aiMutations = () => ({
  /**
   * mutation { textToTransaction(text: "Rs 500 debited via UPI") { data model latencyMs usage { totalTokenCount } } }
   */
  textToTransaction: {
    type: AITransactionResultType,
    args: {
      text:  { type: new GraphQLNonNull(GraphQLString) },
      model: { type: GraphQLString },
    },
    resolve: async (
      _: unknown,
      args: { text: string; model?: string },
      context: { req: any },
    ) => {
      const { req } = context
      if (!req.user) throw new Error('Unauthorized')
      return processTextToTransaction(req.payload, String(req.user.id), args.text, args.model)
    },
  },

  /**
   * mutation { imageToTransaction(image: "<base64>", mimeType: "image/jpeg") { data model latencyMs } }
   */
  imageToTransaction: {
    type: AITransactionResultType,
    args: {
      image:    { type: new GraphQLNonNull(GraphQLString), description: 'Base64-encoded image or data URL' },
      mimeType: { type: GraphQLString, description: 'MIME type (default: image/jpeg)' },
      model:    { type: GraphQLString },
    },
    resolve: async (
      _: unknown,
      args: { image: string; mimeType?: string; model?: string },
      context: { req: any },
    ) => {
      const { req } = context
      if (!req.user) throw new Error('Unauthorized')

      let imageBase64 = args.image
      let mimeType = args.mimeType ?? 'image/jpeg'

      const dataUrlMatch = imageBase64.match(/^data:([^;]+);base64,(.+)$/)
      if (dataUrlMatch) { mimeType = dataUrlMatch[1]; imageBase64 = dataUrlMatch[2] }

      const allowed = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
      if (!allowed.includes(mimeType)) throw new Error(`Unsupported image type "${mimeType}". Allowed: ${allowed.join(', ')}`)

      return processImageToTransaction(req.payload, String(req.user.id), imageBase64, mimeType, args.model)
    },
  },

  /**
   * mutation {
   *   suggestCategory(type: "expense", title: "Starbucks coffee") {
   *     category
   *     reason
   *     model
   *     latencyMs
   *     usage { totalTokenCount }
   *   }
   * }
   */
  suggestCategory: {
    type: AICategorySuggestionResultType,
    args: {
      type:        { type: new GraphQLNonNull(GraphQLString) },
      title:       { type: new GraphQLNonNull(GraphQLString) },
      amount:      { type: GraphQLString },
      date:        { type: GraphQLString },
      note:        { type: GraphQLString },
      personId:    { type: GraphQLString },
      model:       { type: GraphQLString },
      forceMethod: { type: GraphQLString, description: '"minilm" | "cloud" — overrides the user preference for this one call' },
    },
    resolve: async (
      _: unknown,
      args: {
        type: string
        title: string
        amount?: string
        date?: string
        note?: string
        personId?: string
        model?: string
        forceMethod?: string
      },
      context: { req: any },
    ) => {
      const { req } = context
      if (!req.user) throw new Error('Unauthorized')

      if (!ALLOWED_TX_TYPES.includes(args.type as TxType)) {
        throw new Error(`"type" must be one of: ${ALLOWED_TX_TYPES.join(', ')}`)
      }
      const title = args.title?.trim()
      if (!title) throw new Error('"title" is required')

      const fm = args.forceMethod
      if (fm && fm !== 'minilm' && fm !== 'cloud') {
        throw new Error('"forceMethod" must be "minilm" or "cloud"')
      }

      return processCategorySuggestion(
        req.payload,
        String(req.user.id),
        {
          type: args.type as TxType,
          title,
          amount: args.amount || undefined,
          date: args.date || undefined,
          note: args.note || undefined,
          personId: args.personId || undefined,
          forceMethod: fm as 'minilm' | 'cloud' | undefined,
        },
        args.model,
      )
    },
  },

  /**
   * mutation {
   *   predictCategory(type: "expense", title: "Starbucks") {
   *     category score model latencyMs
   *   }
   * }
   *
   * Fast local prediction using transformers.js — designed to be called
   * debounced as the user types. Returns `category: null` when no candidate
   * clears the score threshold.
   */
  predictCategory: {
    type: AICategoryPredictionResultType,
    args: {
      type:  { type: new GraphQLNonNull(GraphQLString) },
      title: { type: new GraphQLNonNull(GraphQLString) },
    },
    resolve: async (
      _: unknown,
      args: { type: string; title: string },
      context: { req: any },
    ) => {
      const { req } = context
      if (!req.user) throw new Error('Unauthorized')

      if (!ALLOWED_TX_TYPES.includes(args.type as TxType)) {
        throw new Error(`"type" must be one of: ${ALLOWED_TX_TYPES.join(', ')}`)
      }
      const title = args.title?.trim()
      if (!title) throw new Error('"title" is required')

      return processCategoryPrediction(req.payload, String(req.user.id), {
        type: args.type as TxType,
        title,
      })
    },
  },
})
