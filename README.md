<div align="center">
  <img src="public/icon.svg" width="120" height="120" alt="Pika logo">
  <h1>Pika</h1>
  <p><strong>Self-hosted personal finance server: web dashboard, GraphQL API, admin panel, AI entry and an MCP server.</strong></p>

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
    <a href="#web-dashboard">Web dashboard</a> •
    <a href="#mcp">MCP</a> •
    <a href="#getting-started">Getting started</a> •
    <a href="#project-structure">Structure</a> •
    <a href="#deployment">Deployment</a> •
    <a href="#contributing">Contributing</a>
  </p>
</div>

---

Pika tracks income, expenses, transfers, and money shared with friends. This
repository is the server: a [Payload](https://payloadcms.com) app on Next.js
and Postgres. One deployment provides:

| Path | What |
| :-- | :-- |
| `/app` | Web dashboard for desktop: the same account and data as the phone app |
| `/api/graphql` | GraphQL API for the [mobile app](https://github.com/e-labInnovations/pika-app) |
| `/api/mcp` | MCP server, so AI assistants (ChatGPT, Claude) can read and add transactions |
| `/admin` | Payload admin panel |

| Repository | What it is |
| :-- | :-- |
| **pika-v2** (this repo) | Server: web dashboard, API, admin panel, AI, MCP |
| [**pika-app**](https://github.com/e-labInnovations/pika-app) | Android / iOS app (Expo, React Native) |
| [pika](https://github.com/e-labInnovations/pika) | Pika v1, a WordPress plugin + PWA. Discontinued |

## Features

- 💰 **Accounts and transactions**: income, expense and transfer entries with
  two-level categories, tags, people and attachments. Balances, monthly reports
  by category, tag and person, budgets and insights are computed on the server.
- 🤝 **Splits and people balances**: split an expense into friends' shares and
  track who owes whom, or split one payment into several transactions (rent +
  electricity). Transactions can be linked, e.g. a repayment to the expense it
  settles.
- 🤖 **AI entry**: turn a sentence or a receipt photo into a draft transaction
  with Gemini or HuggingFace. Each user picks the provider and model and can
  bring their own key. Prompts can name people, accounts, categories and tags,
  and describe splits.
- 🧠 **Local category prediction**: MiniLM embeddings
  ([transformers.js](https://huggingface.co/docs/transformers.js)) of your past
  transaction titles suggest a category, with no external API call.
- 📩 **Bank SMS capture**: bank SMS forwarded by the phone app are parsed,
  matched to an account, checked for duplicates and queued for review with a
  suggested title, category and split. Trusted merchants can be added
  automatically up to a limit you set. Parsers exist for Federal Bank and Pluxee.
- 📄 **Statement import**: read a Federal Bank PDF statement, see which rows are
  already in Pika, and add the missing ones.
- 🔎 **Search and export**: filters, sorting, totals over every match, CSV export.
- 🗄️ **Archive**: retire a category, tag, person or account (say, a finished
  trip's tag). It leaves pickers and AI prompts; history and reports keep it.
- 🔌 **MCP server with OAuth 2.1**: task tools that take names and local times,
  for ChatGPT, Claude and other clients.
- 🔐 **Encrypted secrets**: users' AI API keys are stored AES-256-GCM encrypted
  and never sent back to a browser.

## Web dashboard

Sign in at `/app` with Google, or with email and password. It is built for
wide screens (on a phone, use the app), in the app's colours, light or dark
following the system.

| Page | What you can do |
| :-- | :-- |
| Home | Balance, this month's income and spending, accounts, budgets, insights, recent transactions |
| Transactions | Table with filters, sort, totals and CSV export. Open one in a side panel to edit, delete, split or attach files |
| Add (top bar) | Add a transaction, or fill it in from a sentence or a receipt with AI; warns about likely duplicates |
| Reports | Monthly categories, tags and people; every row opens the matching transactions |
| People | Who owes whom, open shares, each person's transactions |
| Budgets | Monthly limits per category |
| SMS review | Confirm, edit, split or dismiss captured bank SMS |
| Manage | Categories, tags, people and accounts: add, edit, archive, delete |
| Import | Bank statement PDF import |
| MCP | Server URL and API keys |
| Settings | Profile, currency, timezone, AI provider and keys, SMS rules |

Every page reads and writes as the signed-in user only, admins included. Code:
`src/app/(app)/app` (pages and server actions), `src/lib/web` (data and
ownership checks), `src/components/web` (UI).

## MCP

Point an MCP client at `<server>/api/mcp`. ChatGPT and other OAuth clients sign
in with your Pika account; other clients use an API key from the dashboard's
**MCP** page (or the app's settings).

| Tool | Does |
| :-- | :-- |
| `get_context` | Today in your timezone, your currency, and your accounts, categories, tags and people. Call it first |
| `add_transactions` / `update_transactions` / `delete_transactions` | Up to 50 at a time, by name or id, in local time; likely duplicates are skipped unless allowed |
| `search_transactions` | Text and filters, with totals and a 12-month spending series |
| `get_overview` / `get_balances` | This month at a glance; account balances and who owes whom |
| `sms_queue` / `split_transaction` | Review captured SMS; split a saved transaction into parts |

Design notes: [docs/superpowers/specs/2026-11-08-mcp-v2-design.md](docs/superpowers/specs/2026-11-08-mcp-v2-design.md).

## Tech stack

| Layer | Tools |
| :-- | :-- |
| Framework | [Payload 3](https://payloadcms.com), [Next.js 15](https://nextjs.org), React 19 |
| Database | PostgreSQL via `@payloadcms/db-postgres` |
| API | GraphQL (Payload + custom resolvers), REST endpoints, Next.js server actions (dashboard) |
| Web UI | Tailwind CSS 4, [shadcn/ui](https://ui.shadcn.com), Lucide icons, Recharts |
| Auth | Payload auth, Google OAuth (`payload-auth-plugin`), OAuth 2.1 provider for MCP |
| AI | Google Gemini (`@google/genai`), HuggingFace, `@huggingface/transformers` (MiniLM) |
| MCP | `@payloadcms/plugin-mcp`, `@modelcontextprotocol/sdk` |
| Testing | Vitest, Playwright |

## Getting started

### Prerequisites

- Node.js 22 or newer
- PostgreSQL
- pnpm 10 (`corepack enable` picks up the version pinned in `package.json`)
- A Google OAuth client for sign-in
- Optional: a Gemini or HuggingFace API key for the AI features (users can
  also enter their own)

### Setup

```bash
git clone https://github.com/e-labInnovations/pika-v2.git
cd pika-v2
cp .env.example .env      # fill in the values below
pnpm install
pnpm dev
```

Open <http://localhost:3333/admin> and create the first user (it becomes the
admin). Then:

- web dashboard: <http://localhost:3333/app>
- GraphQL: <http://localhost:3333/api/graphql>, playground at `/api/graphql-playground`
- MCP: <http://localhost:3333/api/mcp>

In dev mode Payload pushes schema changes straight to the database, so point
`.env` at a local database, not production.

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
| `pnpm generate:importmap` | Regenerate the admin import map after adding admin components |
| `pnpm payload migrate:create <name>` | Create a migration for a schema change |
| `pnpm test:int` | All Vitest tests (integration tests use the database in `.env`) |
| `pnpm test:unit` | Unit tests only, no database needed |
| `pnpm test:e2e` | End-to-end tests (Playwright) |

The mobile app generates its GraphQL types from this server's schema, so after
a schema change, run `npm run codegen` in `pika-app` too.

## Project structure

```
src/
├── app/              Next.js routes
│   ├── (app)/app/      web dashboard: pages, layout, server actions
│   ├── (frontend)/     landing page, sign-in callback, OAuth consent
│   └── (payload)/      admin panel and API routes
├── collections/      Payload collections: Transactions, Accounts, People, CapturedSms, …
├── globals/          App-wide settings
├── graphql/          Custom queries and mutations (analytics, AI, SMS, search, budgets)
├── endpoints/        Custom REST endpoints (/api/ai, /api/sms, /api/export, …)
├── plugins/          Google auth, MCP server and its tools, MCP OAuth provider
├── utilities/        Business logic: analytics, SMS, statements, AI, MCP tools, encryption
├── lib/              Session helpers; lib/web holds the dashboard's data logic
├── components/       Admin components; components/web is the dashboard UI
└── migrations/       Database migrations, applied automatically in production
docs/                 Deployment and MCP OAuth runbooks; design specs in docs/superpowers
scripts/deploy.sh     Ships a CI-built release to a server
tests/                Vitest unit and integration tests, Playwright e2e tests
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

Contributions are welcome: bug reports, fixes, and new bank SMS or statement
parsers especially.

1. Fork the repo and create a branch: `git checkout -b feat/my-change`
2. Make your change. If you touch the schema, run `pnpm generate:types` and
   add a migration.
3. Check it: `npx tsc --noEmit && pnpm test:int`, against a local database.
4. Use [Conventional Commits](https://www.conventionalcommits.org)
   (`feat:`, `fix:`, `docs:` …) and open a pull request.

**Data access:** the Local API skips access control unless you pass
`overrideAccess: false`, and admins pass most access checks. Anything that acts
for a user must check that the record is theirs; see `src/lib/web` for the
pattern.

**Adding a bank:** SMS parsing lives in
[`src/utilities/sms/`](src/utilities/sms/), statements in
[`src/utilities/statements/`](src/utilities/statements/). Add the formats with
fixtures in `tests/int/`. Use made-up names and numbers in fixtures, never real
messages or statements.

Found a security issue? Please report it privately through GitHub's
[security advisories](https://github.com/e-labInnovations/pika-v2/security/advisories/new)
instead of opening a public issue.

## License

[MIT](LICENSE) © [e-Lab Innovations](https://elabins.com)
