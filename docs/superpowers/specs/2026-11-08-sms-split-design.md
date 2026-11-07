# Split one SMS payment into several transactions

Date: 2026-11-08. Repos: `pika-v2`, `pika-app`.

## Why

One UPI transfer can pay for several things. In production every monthly payment to the
landlord is rent (₹7,000) plus that month's electricity share, and was split by hand into
two transactions sharing one bank reference (e.g. 30 Jun, Ref 618105799833: Rent 7,000 +
Electricity 383.67). The pending SMS of 30 Oct (₹7,398.67) needs the same.

## Model

A split SMS is confirmed into **one transaction per part** (2+), each with its own title,
amount, category, tags and person, all with the bank's date, account, type, `source: sms`
and `externalRef`. Amounts add up to the bank amount **to the paisa**. `captured-sms.parts`
(hasMany → transactions, new `captured_sms_rels` table) lists them; `transaction` is the
first. Reports, budgets and duplicate detection need no change.

## Server

- `src/utilities/sms/split.ts`
  - `checkPartsTotal(parts, total)`: 400 unless 2+ parts, each > 0, sum == total.
  - `splitFromGroup(group, total)`: a past two-part payment applied to a new total — the
    larger part keeps its amount, the other takes the rest; null if the rest ≤ 0.
  - `historySplit(payload, userId, parsed, merchantKey, at)`: the last SMS confirmed as a
    split for the merchant, else the latest pair of past transactions mentioning the
    merchant that share one reference (`externalRef` or `Ref …` in the note); titles get
    the new month (`refreshTitleMonth`).
  - `splitSmsWithAI(payload, user, id, text)`: `processTextToSplit` (new; Gemini and HF
    split schemas) with the user's text + the bank SMS. Unknown/foreign categories are
    dropped; the last part takes the rest; 422 if that is ≤ 0 or fewer than 2 parts.
    Saves `suggestion.parts` (`partsFrom: 'ai'`), never confirms; 409 if not pending.
- `suggest()` attaches `parts` (`partsFrom: 'history'`) for SMS (when a time is given).
  Reused titles also get the payment's month (`Rent (Aug 2026)` → `(Oct 2026)`).
- `confirmCapturedSms`: `overrides.parts ?? suggestion.parts`; `[]` = one transaction.
  Split path checks totals and categories, creates parts in order, deletes the created ones
  if a later one fails. Transfers can't be split. Auto-confirm skips split suggestions.
- GraphQL `splitCapturedSmsWithAI(id, text): SmsConfirmOverrides` (the parts).
- Migration `20261108_000000_add_sms_split_parts`: the rels table, then
  `resuggestPendingSplits` (month fix + history split for pending SMS; idempotent).

## App

- `SmsSplitSheet`: part rows (title, amount, category), one blank amount takes the rest,
  "₹X left to assign", Add part, Split with AI (mention input), Confirm N transactions.
- Review screen: `SmsSplitActions` — the suggested split with Review split, or a Split
  button; the form's Confirm always saves one transaction (`parts: []`).
- Cards: `SmsSplitSummary` lines; Add confirms the parts (quick confirm needs every part's
  category).
- `useSplitSmsWithAI` defines its mutation inline (`gql`) until the next codegen run.

## Not covered

Per-part tags/person editing in the sheet (kept from AI/history, not editable); shares
inside a part; splitting already confirmed transactions.

## Tests

`tests/int/smsSplit.int.spec.ts` (16): month refresh, group split, totals, confirm into
parts, refusal, rollback, `[]` = single, history from a confirmed split, history from
imported notes, migration once, AI split and its rejection. Full int suite 121/121.
