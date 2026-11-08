# Web Dashboard — Phase A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A desktop web version of Pika at `/app`: Home, Transactions (table, filters, totals, export, side panel with edit), Reports, People.

**Architecture:** New Next.js route group `src/app/(app)/app` with its own layout and CSS. Server components read through existing utilities as the signed-in user (cookie `payload-token` → `payload.auth`). Filters live in URL params, parsed by a pure module. One write (edit transaction) through a server action.

**Tech Stack:** Next 15.4 / React 19 / Payload 3.79 (Postgres), Tailwind 4, shadcn (`radix-nova`, CLI), lucide-react, Recharts via shadcn `chart`, vitest.

**Spec:** `docs/superpowers/specs/2026-11-08-web-dashboard-design.md`

## Global Constraints

- Routes under `/app`; `/` (landing) and `/admin` unchanged.
- Every Local API call with `user` sets `overrideAccess: false` (AGENTS.md rule).
- Times shown in the user's timezone; UTC or empty → `Asia/Kolkata`.
- Amount filters/sorts use `amountValue`; date filters use local-day bounds; a parent category id means its children too (same as the phone app).
- Colours: phone app tokens (dark: surface `#0d1322`, surfaceMid `#191f2f`, primary `#adc6ff`, primaryBright `#4d8eff`, income `#4edea3`, expense `#ffb2b7`, onSurface `#dde2f7`, onSurfaceVariant `#c2c6d6`, outlineVariant `#424754`; light from `pika-app/src/theme/colors.ts` `lightColors`) mapped to shadcn variables; light/dark by `prefers-color-scheme`.
- Desktop-first; below `lg` (1024px) sidebar becomes a drawer. No phone layout, no PWA.
- Package manager: `npx -y pnpm@10.32.1`. Type check: `npx tsc --noEmit`. No admin components are added, so no import-map regeneration.
- Commits: no Claude attribution lines (user rule).

## Review Focus

1. Garbage URL params (`?min=abc`, `?from=2026-13-40`, `?page=-3`, unknown `type`) → ignored, page still renders.
2. A transaction at 00:30 IST on the 1st → counted in that local day/month, not the previous one (date range bounds).
3. `?page=` past the last page → empty table with the correct totals, not an error.
4. Editing the amount → `amountValue` updated (sort/filter by amount still right after edit).
5. Another user's transaction id in `/app/transactions/[id]` → 404, and the edit action refuses it.

Each has a test in its owning task (1–3 in Task 1, 4–5 in Task 5).

---

### Task 1: Pure filter and format modules (+ unit test setup)

**Files:**
- Create: `src/lib/web/filters.ts`, `src/lib/web/format.ts`
- Modify: `vitest.config.mts` (include `tests/unit/**/*.spec.ts`), `package.json` (`test:unit` script)
- Test: `tests/unit/webFilters.spec.ts`, `tests/unit/webFormat.spec.ts`

**Interfaces:**
- Produces:
  - `type TxQuery = { q?: string; types: ('expense'|'income'|'transfer')[]; from?: string /*YYYY-MM-DD*/; to?: string; categories: string[]; tags: string[]; people: string[]; accounts: string[]; min?: number; max?: number; sort: 'newest'|'oldest'|'highest'|'lowest'; page: number /*≥1*/ }`
  - `parseTxParams(sp: Record<string, string | string[] | undefined>): TxQuery` — lists are comma-separated (`?tags=a,b`); invalid values dropped; defaults `sort: 'newest'`, `page: 1`.
  - `toSearch(q: Partial<TxQuery>): string` — inverse (omits defaults/empties), leading `?` or `''`.
  - `toWhere(q: TxQuery, ctx: { userId: string; timeZone: string; childrenOf: (categoryId: string) => string[] }): Where` — Local API shape, always `user equals userId`; `q` matches title/note (contains) or amount (`amountValue equals` when numeric); people match `person` or `shares.person`; accounts match `account` or `toAccount`.
  - `SORT_FIELD: Record<TxQuery['sort'], string>` = `{ newest: '-date', oldest: 'date', highest: '-amountValue', lowest: 'amountValue' }`
  - `PAGE_SIZE = 50`
  - `formatMoney(n: number, currency = 'INR'): string` (`₹1,234.50`, en-IN grouping), `formatSigned(n, type)` (`-₹50` expense, `+₹50` income, plain transfer), `formatLocalDate(iso: string, tz: string): string` (`8 Nov 2026`), `formatLocalDateTime(iso, tz)` (`8 Nov 2026, 14:30`), `zone(tz?: string|null): string` (UTC/empty → `Asia/Kolkata`).

- [ ] **Step 1: Write failing tests**

```ts
// tests/unit/webFilters.spec.ts
it('round-trips params', () => {
  const q = parseTxParams({ q: 'rent', types: 'expense', tags: 'a,b', from: '2026-11-01', to: '2026-11-30', min: '100', sort: 'highest', page: '2' })
  expect(q).toMatchObject({ q: 'rent', types: ['expense'], tags: ['a', 'b'], min: 100, sort: 'highest', page: 2 })
  expect(parseTxParams(Object.fromEntries(new URLSearchParams(toSearch(q))))).toEqual(q)
})
it('drops garbage', () => {
  expect(parseTxParams({ min: 'abc', from: '2026-13-40', page: '-3', types: 'nope', sort: 'x' }))
    .toEqual({ types: [], categories: [], tags: [], people: [], accounts: [], sort: 'newest', page: 1 })
})
it('date range uses local-day bounds', () => {
  const w = JSON.stringify(toWhere(parseTxParams({ from: '2026-11-01', to: '2026-11-01' }), { userId: 'u', timeZone: 'Asia/Kolkata', childrenOf: () => [] }))
  expect(w).toContain('2026-10-31T18:30:00.000Z') // greater_than_equal
  expect(w).toContain('2026-11-01T18:30:00.000Z') // less_than
})
it('parent category expands to children; numeric q also matches amount', () => {
  const w = JSON.stringify(toWhere(parseTxParams({ categories: 'p', q: '250' }), { userId: 'u', timeZone: 'Asia/Kolkata', childrenOf: (id) => (id === 'p' ? ['c1', 'c2'] : []) }))
  expect(w).toContain('"p","c1","c2"'); expect(w).toContain('"amountValue":{"equals":250}')
})
// tests/unit/webFormat.spec.ts
expect(formatMoney(1234.5)).toBe('₹1,234.50'); expect(formatSigned(50, 'expense')).toBe('-₹50.00')
expect(formatLocalDateTime('2026-11-08T09:00:00Z', 'UTC')).toBe('8 Nov 2026, 14:30')
```

- [ ] **Step 2:** Run `npx vitest run tests/unit` → FAIL (modules missing).
- [ ] **Step 3:** Implement both modules (use `localMidnight` from `src/utilities/localMonth.ts` for bounds; `to` bound = local midnight of the next day, `less_than`).
- [ ] **Step 4:** Run `npx vitest run tests/unit` → PASS.
- [ ] **Step 5:** Commit `feat(web): filter and format helpers`.

### Task 2: Session, login, shell layout and theme

**Files:**
- Create: `src/lib/session.ts`, `src/app/(app)/app/layout.tsx`, `src/app/(app)/app/app.css`, `src/app/(app)/app/login/page.tsx`, `src/app/(app)/app/(main)/layout.tsx`, `src/components/web/Sidebar.tsx`, `src/components/web/TopBar.tsx`
- Modify: `src/app/(frontend)/auth/callback/route.ts` (default redirect `/admin` → `/app`)
- Test: `tests/int/webSession.int.spec.ts`

**Interfaces:**
- Produces:
  - `userFromHeaders(payload: Payload, headers: Headers): Promise<User | null>` (testable core)
  - `getSession(): Promise<{ payload: Payload; user: User | null; timeZone: string; currency: string }>` (React `cache`; reads `user-settings`)
  - `requireSession()` → same with non-null `user`, else `redirect('/app/login')`
  - `(main)` layout: Sidebar (Home `/app`, Transactions `/app/transactions`, Reports `/app/reports`, People `/app/people`, Admin `/admin` when `user.role === 'admin'`), TopBar (search form GET → `/app/transactions?q=`; user name; sign out → `/api/users/logout` then `/app/login`)
- Login page: "Continue with Google" link to `/api/auth/oauth/authorization/google`; signed-in users redirect to `/app`.

- [ ] **Step 1:** Write `webSession.int.spec.ts`: no cookie → `userFromHeaders` returns null; a valid `JWT <token>` from `payload.login` → returns that user.
- [ ] **Step 2:** Run `npx -y pnpm@10.32.1 exec vitest run --config ./vitest.config.mts tests/int/webSession.int.spec.ts` → FAIL.
- [ ] **Step 3:** Implement session + layouts. Add shadcn components: `npx shadcn@latest add sheet separator avatar dropdown-menu badge card table tabs select calendar chart` (accept into `src/components/ui`). `app.css` imports tailwind and defines the token variables (Global Constraints) under `:root` and `@media (prefers-color-scheme: dark)`.
- [ ] **Step 4:** Test → PASS; `npx tsc --noEmit` clean; `npx -y pnpm@10.32.1 dev`, open `/app` signed out → `/app/login`.
- [ ] **Step 5:** Commit `feat(web): session, login and app shell`.

### Task 3: Home

**Files:** Create `src/app/(app)/app/(main)/page.tsx`, `src/components/web/{StatCard,AccountsList,InsightsList,BudgetsList,RecentTransactions}.tsx`

**Interfaces:** Consumes `requireSession`, `format.ts`. Data: `calculateDashboard(payload, userId, tz)`, accounts via `payload.find('accounts', user, overrideAccess:false)` + `calculateAccountBalance`, `calculateInsights`, `budgetsOverview` filtered `!archived`, latest 10 transactions (`sort: '-date'`, depth 1). `RecentTransactions` rows link to `/app/transactions/[id]`; "See all" → `/app/transactions`.

- [ ] **Step 1:** Build the page (server component; `Promise.all` the reads). Empty states: "No budgets yet — set one in the app", "No transactions yet".
- [ ] **Step 2:** `npx tsc --noEmit` clean; check `/app` in browser light + dark against production data.
- [ ] **Step 3:** Commit `feat(web): home`.

### Task 4: Transactions list, totals, export

**Files:** Create `src/app/(app)/app/(main)/transactions/page.tsx`, `src/app/(app)/app/transactions/export/route.ts`, `src/components/web/{TxTable,FilterBar,TotalsBar,Pager}.tsx`, `src/lib/web/lookups.ts`
**Test:** `tests/int/webTransactions.int.spec.ts`

**Interfaces:**
- Produces `loadLookups(payload, user): Promise<{ categories, tags, people, accounts; childrenOf(id): string[] }>` (all incl. archived; each item `{ id, name, archived, icon?, color?, parentId? }`).
- `listTransactions(payload, user, q: TxQuery, tz): Promise<{ docs, totalDocs, totalPages, page, summary: SearchSummary }>` in `src/lib/web/transactions.ts` — `find` with `toWhere`, `SORT_FIELD`, `PAGE_SIZE`, depth 1, `overrideAccess: false`; `summary = searchSummary(payload, userId, where, tz)` (pass Local-shape where; `toLocalWhere` is a no-op on it).
- Export route GET `/app/transactions/export?<same params>` → `text/csv` from `transactionsCsv(payload, userId, where, tz)`, filename `pika-transactions-YYYY-MM-DD.csv`; 401 → redirect login.
- FilterBar is a client component that edits the URL (`router.replace(pathname + toSearch(next))`); archived lookup items listed under an "Archived" group.

- [ ] **Step 1:** Write int test: create user + 3 transactions (two in Nov, one 00:30 IST on 1 Dec); `listTransactions` with `from=2026-12-01&to=2026-12-01` returns only the 1 Dec one; `page: 99` → `docs: []`, `summary.count` = full match; another user's rows never appear.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement module, page, components, export route.
- [ ] **Step 4:** Test → PASS; tsc clean; browser: filter by tag, sort by highest, export downloads.
- [ ] **Step 5:** Commit `feat(web): transactions table, filters, totals, export`.

### Task 5: Transaction panel and edit

**Files:** Create `src/app/(app)/app/(main)/transactions/[id]/page.tsx`, `src/app/(app)/app/(main)/transactions/@panel/(.)[id]/page.tsx` + `@panel/default.tsx` (intercepting route → shadcn `Sheet`), `src/app/(app)/app/actions.ts`, `src/components/web/{TxDetail,EditTxForm}.tsx`
**Test:** extend `tests/int/webTransactions.int.spec.ts`

**Interfaces:**
- `editTransaction(payload, user, id: string, input: { title?: string; note?: string; date?: string /*YYYY-MM-DD HH:mm local*/; amount?: number; category?: string; tags?: string[]; person?: string | null; account?: string }, tz: string): Promise<{ ok: true } | { error: string }>` in `src/lib/web/transactions.ts` — `payload.update` with `user`, `overrideAccess: false`; date via `parseLocalDate` from `src/utilities/mcp/time.ts`; amount positive.
- Server action `saveTransaction(_: ActionState, form: FormData): Promise<ActionState>` in `actions.ts` → `editTransaction`, then `revalidatePath('/app/transactions')`, `revalidatePath('/app')`. `ActionState = { ok: string } | { error: string } | null`.
- Pickers in EditTxForm hide archived items except the current value (same rule as the app; reuse `choosable` logic — copy the 10-line helper into `src/lib/web/archive.ts`).

- [ ] **Step 1:** Tests: edit amount 100 → 250 → `amountValue` = 250; edit another user's id → `{ error }` and row unchanged; findByID of another user's id with `overrideAccess: false` throws (page maps to `notFound()`).
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Tests PASS; tsc clean; browser: click row → panel; edit title → list updates; direct URL renders full page.
- [ ] **Step 5:** Commit `feat(web): transaction panel and edit`.

### Task 6: Reports

**Files:** Create `src/app/(app)/app/(main)/reports/page.tsx`, `src/components/web/{MonthSwitcher,CategoryReport,TagReport,PeopleReport}.tsx`

**Interfaces:** Params `?month=YYYY-MM&tab=categories|tags|people` (default current local month, `categories`). Data: `calculateMonthlyCategories/Tags/People(payload, userId, m, y, tz)`. Category tab: parent rows with child rows, horizontal bar (shadcn chart) of top 10 parents. Every row links to `/app/transactions` + `toSearch({ categories|tags|people: [id], from: first day, to: last day })`.

- [ ] **Step 1:** Implement; invalid `month` → current month.
- [ ] **Step 2:** tsc clean; browser: switch months, open a row → filtered transactions with matching total.
- [ ] **Step 3:** Commit `feat(web): monthly reports`.

### Task 7: People

**Files:** Create `src/app/(app)/app/(main)/people/page.tsx`, `src/app/(app)/app/(main)/people/[id]/page.tsx`, `src/components/web/PersonBalance.tsx`

**Interfaces:** List from `calculateMonthlyPeople` (current month; `balance` all-time): owes you / you owe / settled; archived in a collapsed "Archived" group. Detail: `calculatePersonBalance(payload, id)` after verifying ownership with `findByID(..., user, overrideAccess: false)` (else `notFound()`); open shares list; their transactions via `listTransactions` with `people: [id]`.

- [ ] **Step 1:** Implement.
- [ ] **Step 2:** tsc clean; browser check against the phone app's numbers for two people.
- [ ] **Step 3:** Commit `feat(web): people`.

### Task 8: Finish

- [ ] **Step 1:** `npx -y pnpm@10.32.1 exec vitest run --config ./vitest.config.mts` and `npx vitest run tests/unit` → all pass; `npx tsc --noEmit` clean; `npx -y pnpm@10.32.1 build` succeeds.
- [ ] **Step 2:** Browser pass over every route in light and dark, at 1440px and 900px (drawer).
- [ ] **Step 3:** Commit any fixes; leave unpushed for the user's review.
