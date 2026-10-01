import { GraphQLBoolean, GraphQLNonNull, GraphQLObjectType, GraphQLScalarType, GraphQLString, Kind } from 'graphql'
import { confirmCapturedSms, dismissCapturedSms, type ConfirmOverrides } from '../utilities/sms/confirm'

const SmsOverridesJSON = new GraphQLScalarType({
  name: 'SmsConfirmOverrides',
  description: 'Optional fields to change before confirming: title, type, category, account, toAccount, person, tags, note, shares',
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

export const smsMutations = () => ({
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
})
