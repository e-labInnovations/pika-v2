import { GraphQLList, GraphQLNonNull, GraphQLScalarType, GraphQLString, Kind } from 'graphql'
import { importStatementRows, parseStatement, type ImportRow } from '../utilities/statements/import'

const JSONValue = new GraphQLScalarType({
  name: 'StatementJSON',
  description: 'Statement parse result / import rows (JSON)',
  serialize: (v) => v,
  parseValue: (v) => v,
  parseLiteral: (ast) => (ast.kind === Kind.STRING ? JSON.parse(ast.value) : null),
})

export const statementMutations = () => ({
  /**
   * Reads a bank statement PDF (base64) and marks which rows Pika already has. Writes nothing.
   * mutation { parseStatement(file: "…", password: "…") }
   */
  parseStatement: {
    type: JSONValue,
    args: {
      file: { type: new GraphQLNonNull(GraphQLString) },
      password: { type: GraphQLString },
      account: { type: GraphQLString, description: 'Pika account to match against; found from SMS identifiers when omitted' },
    },
    resolve: async (_: unknown, args: { file: string; password?: string; account?: string }, { req }: { req: any }) => {
      if (!req.user) throw new Error('Unauthorized')
      return parseStatement(req.payload, req.user, args)
    },
  },
  /** Creates transactions for picked statement rows; returns their ids. */
  importStatementRows: {
    type: new GraphQLList(GraphQLString),
    args: {
      account: { type: new GraphQLNonNull(GraphQLString) },
      rows: { type: new GraphQLNonNull(JSONValue) },
    },
    resolve: async (_: unknown, args: { account: string; rows: ImportRow[] }, { req }: { req: any }) => {
      if (!req.user) throw new Error('Unauthorized')
      return importStatementRows(req.payload, req.user, args.account, args.rows)
    },
  },
})
