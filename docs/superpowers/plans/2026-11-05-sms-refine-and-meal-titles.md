# SMS Refine + Meal Titles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct meal words in SMS-suggested titles, and add "Edit with AI" / "Try again" for pending SMS.

**Architecture:** Pure `mealTitle.ts` used by `suggest()`, `refineSms()` and a data migration; `refineSms` reuses reply's suggestion builder and is exposed via GraphQL; the app adds a refine sheet on SMS cards and the review screen.

**Tech Stack:** Payload 3.79 (Postgres), vitest int tests, Expo / Apollo 4.

**Spec:** `docs/superpowers/specs/2026-11-05-sms-refine-and-meal-titles-design.md`

## Global Constraints

- Meal hours (local): 05–10 Breakfast, 11–15 Lunch, 16–18 Evening, 19–04 Dinner.
- Meal words recognised as a title's first word: breakfast, lunch, dinner, evening, supper.
- Refine never confirms; bank amount / time / account never come from the AI.
- Reply text limit 1000 chars; image types as `imageToTransaction` (`ALLOWED_MIME`).
- Test command (server): `npx -y pnpm@10.32.1 exec vitest run --config ./vitest.config.mts <files>`.
- App has no test runner: `npx tsc --noEmit` + device check.

## Review Focus

- Timezone missing on user-settings → UTC; must not throw.
- Title that merely contains a meal word mid-title ("Zomato dinner box") → unchanged.
- Refine on a non-pending SMS → 409, nothing written.
- AI returns a different amount → ignored (bank amount kept).
- AI disabled → refine returns the AI service's 403 error; app hides the buttons.

---

### Task 1: `mealTitle.ts` + `suggest()` fix

**Files:** Create `src/utilities/sms/mealTitle.ts`; modify `src/utilities/sms/ingest.ts` (`suggest`, its call in `ingestSms`); modify `src/utilities/statements/import.ts:151` (pass the row date); test `tests/int/smsMealTitle.int.spec.ts`.

**Interfaces:** Produces `mealFor(date: Date, timeZone: string): Meal`, `fixMealWord(title: string, date: Date, timeZone: string): string`, `userTimeZone(payload, userId): Promise<string>`; `suggest(payload, userId, p, people?, titleHint?, at?: Date)`.

- [ ] Tests: `mealFor` at IST 10:59 → Breakfast, 11:00 → Lunch, 15:59 → Lunch, 16:00 → Evening, 19:00 → Dinner, 04:59 → Dinner; `fixMealWord('Dinner - Zomato order', 12:07 IST, 'Asia/Kolkata')` → `'Lunch - Zomato order'`; `'Breakfast coffee and banana fry'` at 17:12 → `'Evening coffee and banana fry'`; `' Breakfast snacks - Malabar Bite'` at 09:09 → `'Breakfast snacks - Malabar Bite'`; `'Zomato dinner box'` unchanged; `'lunch'` at 20:00 → `'dinner'` (lower case kept). Integration: confirmed SMS at ETERNAL LIM titled "Dinner - Zomato order", then a new one at 12:07 IST for a user with timezone Asia/Kolkata → suggestion title `Lunch - Zomato order`.
- [ ] Run → fail; implement (Intl.DateTimeFormat hourCycle h23); run → pass; commit `fix: SMS titles use the meal word for the transaction's time`.

### Task 2: migration for pending items

**Files:** Create `src/migrations/20261105_000000_fix_sms_meal_titles.ts` (exports `fixPendingMealTitles(payload): Promise<number>` and `up`/`down`); register in `src/migrations/index.ts`; test in `tests/int/smsMealTitle.int.spec.ts`.

- [ ] Test: a pending captured-sms with suggestion "Dinner - Zomato order" at 12:07 IST → after `fixPendingMealTitles` title is "Lunch - Zomato order"; a confirmed one untouched; second run returns 0.
- [ ] Fail → implement (find pending with pagination false, depth 0; per user timezone cached) → pass → commit `fix: correct meal words in pending SMS suggestions`.

### Task 3: `refineSms` + GraphQL/REST

**Files:** Create `src/utilities/sms/refine.ts`; modify `src/utilities/sms/reply.ts` (extract `suggestionFromAI`); modify `src/graphql/sms.ts`, `src/endpoints/sms.ts`, `src/endpoints/index.ts`; test `tests/int/smsRefine.int.spec.ts` (mocks `processTextToTransaction` and `processImageToTransaction`).

**Interfaces:** Produces `refineSms(payload, user, id, { text?, image? }): Promise<{ suggestion: SmsSuggestion; complete: boolean }>`; GraphQL `refineCapturedSms(id: String!, text: String, image: String, mimeType: String): JSON`.

- [ ] Tests: text → text AI called with input containing the text and the SMS body, status stays pending, suggestion.from = 'ai', title from AI; AI amount ignored; image → image AI called with note containing SMS body; no input → text AI called with `Bank SMS:` only; confirmed SMS → rejects 409; existing smsReply spec still green.
- [ ] Fail → implement → pass (+ smsReply spec) → `generate:types`/`generate:schema` if present → `tsc` → commit `feat: refine a pending SMS suggestion with AI`.

### Task 4: app sheet + entry points (pika-app, branch `feat/sms-refine` from `feat/native-share`)

**Files:** `src/services/gql/sms/sms.gql` (+ `RefineCapturedSms`), `src/services/gql/types/*` (codegen against local schema or hand-add following generated style), `src/services/gql/sms/sms.service.ts` (`useRefineSms`), create `src/components/sms/SmsRefineSheet.tsx`, modify `src/components/home/SmsDeck.tsx`, `src/app/(protected)/sms/index.tsx`, `src/app/(protected)/sms/[id].tsx`.

**Interfaces:** `useRefineSms(): { refineSms(id, input: { text?: string; image?: { base64: string; mimeType: string } }): Promise<void>; loading }`; `<SmsRefineSheet smsId visible onClose onDone />`.

- [ ] Implement; `npx tsc --noEmit` → 0; commit `feat: Edit with AI and Try again on SMS suggestions`.
