<div align="center">
  <img src="public/icon.svg" width="120" height="120" alt="Pika logo">
  <h1>Pika</h1>
  <p><strong>Self-hosted personal finance backend: GraphQL API, admin panel, AI entry and an MCP server.</strong></p>

  <p>
    <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
    <a href="https://payloadcms.com"><img src="https://img.shields.io/badge/Payload-3.79-000000.svg" alt="Payload 3"></a>
    <a href="https://nextjs.org"><img src="https://img.shields.io/badge/Next.js-15-000000.svg?logo=nextdotjs" alt="Next.js 15"></a>
    <a href="https://www.postgresql.org"><img src="https://img.shields.io/badge/PostgreSQL-4169e1.svg?logo=postgresql&logoColor=white" alt="PostgreSQL"></a>
    <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-5-3178c6.svg?logo=typescript&logoColor=white" alt="TypeScript"></a>
    <a href="https://modelcontextprotocol.io"><img src="https://img.shields.io/badge/MCP-server-8a2be2.svg" alt="MCP server"></a>
  </p>

  <p>
    <a href="#features">Features</a> •
    <a href="#getting-started">Getting started</a> •
    <a href="#project-structure">Structure</a> •
    <a href="#deployment">Deployment</a> •
    <a href="#contributing">Contributing</a>
  </p>
</div>

---

Pika tracks income, expenses, transfers, and money shared with friends. This
repository is the server: a [Payload](https://payloadcms.com) app on Next.js
and Postgres. It serves the [mobile app](https://github.com/e-labInnovations/pika-app)
over GraphQL, provides an admin panel at `/admin`, and exposes an MCP server
at `/api/mcp` so AI assistants can read and add transactions for you.

| Repository | What it is |
| :-- | :-- |
| **pika-v2** (this repo) | Backend: API, admin panel, AI, MCP |
| [**pika-app**](https://github.com/e-labInnovations/pika-app) | Android / iOS app (Expo, React Native) |
| [pika](https://github.com/e-labInnovations/pika) | Pika v1, a WordPress plugin + PWA. Discontinued |

## Features

- 💰 **Accounts and transactions**: income, expense and transfer entries with
  hierarchical categories, tags, people and receipt attachments. Balances and
  monthly analytics by category, tag and person are computed on the server.
- 🤝 **Splits and people balances**: split an expense into friends' shares and
  track who owes whom. Transactions can be linked, e.g. a repayment to the
  expense it settles.
- 🤖 **AI entry**: turn a sentence or a receipt photo into a draft transaction
  with Gemini or HuggingFace. Each user picks the provider and model. Prompts
  can tag existing people, accounts, categories and tags, and can describe
  splits.
- 🧠 **Local category prediction**: MiniLM embeddings
  ([transformers.js](https://huggingface.co/docs/transformers.js)) of your past
  transaction titles suggest a category, with no external API call.
- 📩 **Bank SMS capture**: forwarded bank SMS are parsed on the server, matched
  to an account, de-duplicated, and queued as pending items. Nothing touches a
  balance until you confirm it. Parsers exist today for Federal Bank and Pluxee.
- 🔌 **MCP server with OAuth 2.1**: connect Claude or another MCP client to your
  own data, with per-user scopes and API keys.
- 🔐 **Encrypted secrets**: users' AI API keys are stored AES-256-GCM encrypted.
- 🛠️ **Admin panel**: every collection is editable in Payload's admin UI.

## Tech stack

| Layer | Tools |
| :-- | :-- |
| Framework | [Payload 3](https://payloadcms.com), [Next.js 15](https://nextjs.org), React 19 |
| Database | PostgreSQL via `@payloadcms/db-postgres` |
| API | GraphQL (Payload + custom resolvers), REST endpoints |
| Auth | Payload auth, Google OAuth (`payload-auth-plugin`), OAuth 2.1 provider for MCP |
| AI | Google Gemini (`@google/genai`), HuggingFace, `@huggingface/transformers` (MiniLM) |
| MCP | `@payloadcms/plugin-mcp`, `@modelcontextprotocol/sdk` |
| Testing | Vitest, Playwright |

## Getting started

### Prerequisites

- Node.js 22
- PostgreSQL
- pnpm 10 (`corepack enable` picks up the version pinned in `package.json`)
- A Google OAuth client for sign-in
- Optional: a Gemini or HuggingFace API key for the AI features (users can
  also enter their own in the app)

### Setup

```bash
git clone https://github.com/e-labInnovations/pika-v2.git
cd pika-v2
cp .env.example .env      # fill in the values below
pnpm install
pnpm dev
```

Open <http://localhost:3333/admin> and create the first user. The API runs at
<http://localhost:3333/api/graphql>, with a playground at `/api/graphql-playground`.

### Environment variables

| Variable | Required | Description |
| :-- | :-: | :-- |
| `DATABASE_URL` | ✅ | Postgres connection string |
| `PAYLOAD_SECRET` | ✅ | Signs sessions **and** encrypts stored AI API keys. If you change it, stored keys become unreadable and users must enter them again |
| `NEXT_PUBLIC_SERVER_URL` | ✅ | Public base URL, used in OAuth/MCP metadata and links |
| `NEXT_PUBLIC_PAYLOAD_AUTH_URL` | ✅ | Base URL the auth plugin redirects through |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | ✅ | Google sign-in. Callback: `<server>/api/auth/oauth/callback/google` |
| `TRANSFORMERS_CACHE_DIR` | | Where the MiniLM weights (~22 MB) are cached. Defaults to `.cache/transformers-models` |

### Scripts

| Command | Does |
| :-- | :-- |
| `pnpm dev` | Dev server on port 3333 |
| `pnpm build` / `pnpm start` | Production build and server |
| `pnpm generate:types` | Regenerate `src/payload-types.ts` after a schema change |
| `pnpm generate:importmap` | Regenerate the admin import map after adding components |
| `pnpm payload migrate:create <name>` | Create a migration for a schema change |
| `pnpm test:int` | Integration tests (Vitest) |
| `pnpm test:e2e` | End-to-end tests (Playwright) |

The mobile app generates its GraphQL types from this server's schema, so after
a schema change, run `npm run codegen` in `pika-app` too.

## Project structure

```
src/
├── collections/    Payload collections: Transactions, Accounts, People, CapturedSms, …
├── globals/        App-wide settings
├── graphql/        Custom queries and mutations (analytics, AI, SMS, balances)
├── endpoints/      Custom REST endpoints (/api/ai, /api/sms, …)
├── plugins/        Google auth, MCP server, MCP OAuth provider
├── utilities/      Business logic: analytics, SMS parsing, encryption, …
├── migrations/     Database migrations, applied automatically in production
└── app/            Next.js routes: admin, API, OAuth consent pages
docs/               Deployment and MCP OAuth runbooks
scripts/deploy.sh   Ships a CI-built release to a server
tests/              Vitest integration tests and Playwright e2e tests
```

## Deployment

GitHub Actions builds a Next.js standalone bundle on linux/x64 and attaches it
to the rolling `deploy-latest` prerelease. On the server,
[`scripts/deploy.sh`](scripts/deploy.sh) downloads that bundle, unpacks it into
`releases/<sha>`, switches the `current` symlink, and restarts it with pm2.
The server never builds anything and never needs a GitHub credential.

```bash
./deploy.sh               # newest build
./deploy.sh <sha>         # a specific build
./deploy.sh --rollback    # previous release
./deploy.sh --list-builds # builds available to download
```

Migrations run on the first request after a deploy (`prodMigrations`). The
deploy script's health check sends that request, so a failed migration fails
the deploy.

Before changing anything about deploys, runtime paths, migrations, backups or
secrets, read [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). For the MCP OAuth
setup (nginx, discovery endpoints), see
[docs/production-deploy-mcp-oauth.md](docs/production-deploy-mcp-oauth.md).

## Contributing

Contributions are welcome: bug reports, fixes, and new bank SMS parsers
especially.

1. Fork the repo and create a branch: `git checkout -b feat/my-change`
2. Make your change. If you touch the schema, run `pnpm generate:types` and
   add a migration.
3. Check it: `npx tsc --noEmit && pnpm test:int`
4. Use [Conventional Commits](https://www.conventionalcommits.org)
   (`feat:`, `fix:`, `docs:` …) and open a pull request.

**Adding a bank:** SMS parsing lives in
[`src/utilities/sms/`](src/utilities/sms/). Add the sender's formats to
`parse.ts`, with fixtures in `tests/int/smsParse.int.spec.ts`. Use made-up
names and numbers in fixtures, never real messages.

Found a security issue? Please report it privately through GitHub's
[security advisories](https://github.com/e-labInnovations/pika-v2/security/advisories/new)
instead of opening a public issue.

## License

[MIT](LICENSE) © [e-Lab Innovations](https://elabins.com)
