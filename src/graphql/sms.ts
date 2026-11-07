import { GraphQLBoolean, GraphQLNonNull, GraphQLObjectType, GraphQLScalarType, GraphQLString, Kind } from 'graphql'
import {
  confirmCapturedSms,
  dismissCapturedSms,
  markCapturedSmsDuplicate,
  undoAutoConfirmedSms,
  type ConfirmOverrides,
} from '../utilities/sms/confirm'
import { refineSms } from '../utilities/sms/refine'
import { splitSmsWithAI } from '../utilities/sms/split'

const SmsOverridesJSON = new GraphQLScalarType({
  name: 'SmsConfirmOverrides',
  description: 'Optional fields to change before confirming: title, type, category, account, toAccount, person, tags, note, shares, amount, date, attachments, parts (split: [{title, amount, category, tags, person}], [] = not split)',
  serialize: (v) => v,
  parseValue: (v) => v,
  parseLiteral: (ast) => (ast.kind === Kind.STRING ? JSON.parse(ast.value) : null),
})

const ConfirmSmsResultType = new GraphQLObjectType({
  name: 'ConfirmSmsResult',
  fields: {
    transaction: { type: new GraphQLNonNull(GraphQLString), description: 'ID of the created transaction' },
    linked: { type: GraphQLString, description: 'Purchase a refund was linked to, if any' },
  },
})

const RefineSmsResultType = new GraphQLObjectType({
  name: 'RefineSmsResult',
  fields: {
    suggestion: { type: new GraphQLNonNull(SmsOverridesJSON), description: 'The new suggestion (title, type, category, tags, person, toAccount, shares)' },
    complete: { type: new GraphQLNonNull(GraphQLBoolean), description: 'Whether one tap (Add) can confirm it' },
  },
})

export const smsMutations = () => ({
  /**
   * mutation { refineCapturedSms(id: "…", text: "team lunch", image: "<base64>", mimeType: "image/jpeg") { suggestion complete } }
   * Re-reads a pending SMS with the AI, with optional extra text and/or image; with
   * neither it simply tries again. Saves the suggestion, never confirms.
   */
  refineCapturedSms: {
    type: RefineSmsResultType,
    args: {
      id: { type: new GraphQLNonNull(GraphQLString) },
      text: { type: GraphQLString },
      image: { type: GraphQLString, description: 'Base64 or data URL' },
      mimeType: { type: GraphQLString },
    },
    resolve: async (
      _: unknown,
      args: { id: string; text?: string | null; image?: string | null; mimeType?: string | null },
      { req }: { req: any },
    ) => {
      if (!req.user) throw new Error('Unauthorized')
      return refineSms(req.payload, req.user, args.id, {
        text: args.text,
        image: args.image ? { base64: args.image, mimeType: args.mimeType ?? 'image/jpeg' } : null,
      })
    },
  },
  /**
   * mutation { splitCapturedSmsWithAI(id: "…", text: "7000 rent, rest electricity") }
   * Splits a pending SMS into parts with the AI; returns the parts and saves them as the
   * suggestion. Never confirms. The parts always add up to the bank amount.
   */
  splitCapturedSmsWithAI: {
    type: new GraphQLNonNull(SmsOverridesJSON),
    args: {
      id: { type: new GraphQLNonNull(GraphQLString) },
      text: { type: GraphQLString },
    },
    resolve: async (_: unknown, args: { id: string; text?: string | null }, { req }: { req: any }) => {
      if (!req.user) throw new Error('Unauthorized')
      const { parts } = await splitSmsWithAI(req.payload, req.user, args.id, args.text ?? '')
      return parts
    },
  },
  /** mutation { confirmCapturedSms(id: "…", overrides: {category: "…"}) { transaction } } */
  confirmCapturedSms: {
    type: ConfirmSmsResultType,
    args: {
      id: { type: new GraphQLNonNull(GraphQLString) },
      overrides: { type: SmsOverridesJSON },
    },
    resolve: async (_: unknown, args: { id: string; overrides?: ConfirmOverrides }, { req }: { req: any }) => {
      if (!req.user) throw new Error('Unauthorized')
      return confirmCapturedSms(req.payload, req.user, args.id, args.overrides ?? {})
    },
  },
  /** mutation { dismissCapturedSms(id: "…") } */
  dismissCapturedSms: {
    type: GraphQLBoolean,
    args: { id: { type: new GraphQLNonNull(GraphQLString) } },
    resolve: async (_: unknown, args: { id: string }, { req }: { req: any }) => {
      if (!req.user) throw new Error('Unauthorized')
      await dismissCapturedSms(req.payload, req.user, args.id)
      return true
    },
  },
  /** mutation { markCapturedSmsDuplicate(id: "…", transaction: "…") } — the SMS is already in Pika as that transaction */
  markCapturedSmsDuplicate: {
    type: GraphQLBoolean,
    args: {
      id: { type: new GraphQLNonNull(GraphQLString) },
      transaction: { type: new GraphQLNonNull(GraphQLString) },
    },
    resolve: async (_: unknown, args: { id: string; transaction: string }, { req }: { req: any }) => {
      if (!req.user) throw new Error('Unauthorized')
      await markCapturedSmsDuplicate(req.payload, req.user, args.id, args.transaction)
      return true
    },
  },
  /** mutation { undoAutoConfirmedSms(id: "…") } — deletes the auto-added transaction, SMS back to pending */
  undoAutoConfirmedSms: {
    type: GraphQLBoolean,
    args: { id: { type: new GraphQLNonNull(GraphQLString) } },
    resolve: async (_: unknown, args: { id: string }, { req }: { req: any }) => {
      if (!req.user) throw new Error('Unauthorized')
      await undoAutoConfirmedSms(req.payload, req.user, args.id)
      return true
    },
  },
})
