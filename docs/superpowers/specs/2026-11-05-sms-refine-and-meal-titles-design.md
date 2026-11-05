# SMS: refine with AI, try again, meal-word titles

Date: 2026-11-05. Repos: `pika-v2` (server), `pika-app` (mobile).

## Problems

1. **Wrong meal word in titles.** `suggest()` (`src/utilities/sms/ingest.ts`) copies the
   title of the last confirmed transaction at the same merchant. One "Dinner - Zomato
   order" makes every later Zomato order "Dinner - …", including ~12:00 ones. In
   production 25 pending items had this on 2026-11-05.
2. **No AI help on a pending SMS.** The card offers Dismiss / Edit / Add. Improving a
   suggestion means editing it by hand; the AI is reachable only by replying to the
   notification.

## Design

### Meal word (server)

`src/utilities/sms/mealTitle.ts`:

- `mealFor(date: Date, timeZone: string): 'Breakfast' | 'Lunch' | 'Evening' | 'Dinner'`
  by local hour: 05–10 Breakfast, 11–15 Lunch, 16–18 Evening, 19–04 Dinner.
- `fixMealWord(title: string, date: Date, timeZone: string): string`: if the title's
  first word (after trimming) is breakfast / lunch / dinner / evening / supper
  (case-insensitive), replace it with `mealFor`, keeping the word's capitalisation style
  (Title case) and the rest of the title. Other titles unchanged.

`suggest()` applies `fixMealWord` to titles reused from history (`from` = `sms` and
`note`), with the date `p.occurredAt ?? receivedAt` and the user's timezone from
user-settings (fallback `UTC`, as `getUserTimezone`). `suggest` gains an optional
`at: Date` parameter; callers pass the SMS time.

Migration `20261105_000000_fix_sms_meal_titles`: for every `captured-sms` with
`status = pending` and a suggestion title starting with a meal word, rewrite the title with
`fixMealWord` using the item's time and its user's timezone. Idempotent.

### Refine (server)

`refineSms(payload, user, id, input: { text?: string; image?: { base64: string; mimeType: string } })`
in `src/utilities/sms/refine.ts`, sharing the suggestion-building code with `replyToSms`
(extract `suggestionFromAI(d, before, parsed)` in `reply.ts`):

- pending + parsed only (same 409 / 422 errors as reply). Text ≤ 1000 chars.
- image → `processImageToTransaction(…, text = [user text, "Bank SMS: <body>"])`.
- text only → `processTextToTransaction("<text>\n\nBank SMS: <body>")`.
- neither ("try again") → `processTextToTransaction("Bank SMS: <body>")` — the AI reads the
  SMS fresh, without the learned title.
- Result is always saved as the suggestion, `from: 'ai'`; never confirmed. Bank amount,
  time and account are never taken from the AI. The AI's title gets `fixMealWord` too.
- Returns `{ suggestion, complete }`.

Exposed as GraphQL `refineCapturedSms(id: String!, text: String, image: String, mimeType: String): JSON`
(next to `confirmCapturedSms` in `src/graphql/sms.ts`) and REST `POST /api/sms/:id/refine`.
Image size limit and allowed types: as `imageToTransaction`.

### App

- `useRefineSms()` in `src/services/gql/sms/sms.service.ts`; refetches pending SMS and the
  captured SMS on success.
- `SmsRefineSheet` (`src/components/sms/SmsRefineSheet.tsx`): bottom sheet with a text
  box, attach image (camera / gallery via the picker the AI sheet already uses), **Apply**
  (needs text or image) and **Try again** (AI only). Busy state, error alert.
- Pending SMS cards (Home `SmsDeck`, `sms/index.tsx`): a ✨ button opening the sheet.
- Review screen `sms/[id].tsx`: "Edit with AI" and "Try again" in the header; on success
  the form remounts with the new suggestion.
- Hidden when `appSettings.ai.enabled` is false.

## Testing

Server (vitest int, AI mocked as in `smsReply.int.spec.ts`): `mealFor` boundaries,
`fixMealWord` cases, `suggest` fixing a learned "Dinner" at 12:07 IST, `refineSms` for
text / image / try-again (right AI function, input contains the SMS, saved not confirmed,
amount kept), and the migration logic via its exported function. App: `tsc`, device check.
