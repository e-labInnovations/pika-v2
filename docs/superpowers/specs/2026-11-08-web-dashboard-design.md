# Web dashboard (`/app`)

Date: 2026-11-08. Repo: `pika-v2`. Reference: `labstash` (`src/app/(app)`, `src/lib/session.ts`).

## Goal

Pika on a laptop: the same account and data as the phone app, laid out for a wide
screen (sidebar, wide tables, a detail panel beside the list). Built in three phases:

- **A — view and analyse** (this spec, in detail)
- **B — daily work**: add / edit / split / delete transactions, SMS review queue, archive in manage lists
- **C — everything else**: settings, budgets editing, AI add, MCP keys, statement import

The phone stays the main place transactions are added; A is where a big screen helps most.

## Decisions

| Topic | Decision |
|---|---|
| URL | `/app` and below. `/` stays the landing page, `/admin` the admin panel. |
| Sign-in | Google, as today. `/auth/callback` defaults to `/app` instead of `/admin` (client and MCP flows unchanged). `/app/login` is one "Continue with Google" button. |
| Session | `src/lib/session.ts`: `getSession()` = `payload.auth({ headers })` on the `payload-token` cookie, cached per request; `requireSession()` redirects to `/app/login`. |
| Reads | Server components call the existing utilities as the user (`overrideAccess: false`). No GraphQL, no client data library. |
| Filters | URL search params: every view is bookmarkable and server-rendered. |
| Writes | Server actions in `src/app/(app)/app/actions.ts`, Local API with `user` + `overrideAccess: false`, then `revalidatePath`. |
| Times | User's timezone setting (UTC/empty read as Asia/Kolkata, as in `mcp/time.ts`), via `localMonth.ts`. |
| Look | The phone app's colour tokens mapped onto shadcn CSS variables (`--background` = surface, `--primary`, plus `--income`, `--expense`); light/dark follow the system. shadcn components (already configured, `radix-nova`) added with the CLI as needed; charts with shadcn `chart` (Recharts). |
| Layout | Desktop-first: fixed sidebar (Home, Transactions, Reports, People; Admin for admins), top bar (search, month switcher), content max ~1280px. Below `lg` (1024px) the sidebar becomes a drawer. No phone layout, no PWA. |
| Isolation | Own route group `src/app/(app)/app` with its own `<html>`, layout and `app.css`; landing page and admin styles untouched. |

## Phase A screens

| Route | Content | Data |
|---|---|---|
| `/app/login` | Continue with Google | existing `/api/auth/oauth/authorization/google` |
| `/app` (Home) | Balance + month pulse (income / expenses / surplus vs last month); accounts with balances; insights; budgets; 10 latest transactions | `calculateDashboard`, `calculateAccountBalance`, `calculateInsights`, `budgetsOverview` (archived hidden), transactions find |
| `/app/transactions` | Full-width table (date local, title, category, tags, person, account, amount coloured by type). Search box; filters for type, date range (presets + custom), categories, tags, people, accounts, amount range; sort (newest, oldest, highest, lowest). Totals header (count, income, expenses, net) for the whole match. Paging. Export CSV of the match. Archived items appear in filter lists under "Archived". | transactions find with a `Where` built from params; `searchSummary`; `transactionsCsv` |
| `/app/transactions/[id]` | Opens as a side panel over the list (intercepting route; full page when opened directly): all fields, shares, attachments, linked transactions. **Edit** for title, note, date, amount, category, tags, person, account (the only write in A). | findByID depth 1; update via server action |
| `/app/reports` | Month switcher. Tabs: Categories (parent → child breakdown, bar + table), Tags, People. Each row links to the matching transactions view. | `calculateMonthlyCategories`, `calculateMonthlyTags`, `calculateMonthlyPeople` |
| `/app/people` | People with balance (owes you / you owe), last activity; archived under "Archived". | `calculateMonthlyPeople` (balance) |
| `/app/people/[id]` | Balance, open shares, that person's transactions. | `calculatePersonBalance`, transactions find |

Search in the top bar goes to `/app/transactions?q=…`.

## Units

- `src/lib/session.ts` — session helpers (server-only).
- `src/lib/web/filters.ts` — pure: `parseTxParams(searchParams) → TxQuery` and `toWhere(TxQuery, userId, tz) → Where`; `toSearch(TxQuery) → string` for links. Same filter meaning as the phone app (`amountValue` for amount, local-day bounds for dates, parent category = its children).
- `src/lib/web/format.ts` — pure: money (user currency), local date/time, signed amounts.
- `src/app/(app)/app/…` — layout, pages, `actions.ts`.
- `src/components/web/…` — Sidebar, TopBar, TxTable, FilterBar, TotalsBar, MonthSwitcher, charts, TxPanel, EditTxForm.

## Errors and edge cases

- Signed out or expired token → `/app/login`; after sign-in, back to `/app`.
- A transaction id that isn't the user's → 404 (access control returns nothing).
- Empty states for no transactions / no budgets / no people.
- Edit validation reuses the collection's hooks; errors shown inline from the action result.

## Tests

- Unit (vitest): `filters.ts` (params ↔ query round trip; Where for each filter incl. local date bounds and parent category; bad params ignored), `format.ts`.
- Integration: session redirect (no cookie → login); edit action changes only the caller's transaction and refuses another user's.
- Manual: each phase-A screen in a desktop browser, light and dark.

## Later phases (outline only)

- **B**: add transaction (form + AI text), split, delete, duplicate check; SMS queue page (confirm / split / dismiss); manage lists for categories, tags, people, accounts with archive.
- **C**: budgets editing, settings (profile, timezone, currency, AI), MCP API keys, statement import.
