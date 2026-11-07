# MCP v2: task tools for ChatGPT

Date: 2026-11-08. Repo: `pika-v2` (`src/plugins/mcp.ts`, new `src/utilities/mcp/`).

## Problems (from use with ChatGPT)

- Dates: the raw `date` field is UTC ISO; the model writes local (IST) times as if UTC
  → transactions 5h30 off. Replies show UTC, so it never notices.
- `createTransactions` (Payload's generated tool) saves one record per call.
- Every relation needs an ID, so each add costs several find calls (categories, tags,
  accounts, people) and the model often gives up or picks wrong.
- Newer features (search totals, insights, budgets, SMS queue, splits, duplicates) are
  not reachable.

## Design

Domain tools that take **names or IDs** and **local times**, work in **batches**, and
answer in local time. ChatGPT is the main client: few tools, compact JSON replies.

| Tool | Purpose |
|---|---|
| `get_context` | Today (local + offset), timezone, currency; accounts, category tree, tags, people as `{id, name}`. Call first. |
| `add_transactions` | Up to 50 items; `dry_run`; duplicate check per item (skipped unless `allow_duplicate`). |
| `update_transactions` | Up to 50 `{id, ...fields}`; same resolution and times. |
| `delete_transactions` | Up to 50 ids. |
| `search_transactions` | Text (title/note/category/tag/person/account names, amount) + filters (type, names, local date range, amount range); totals, 12-month spending, rows (local times), paging, sort. |
| `get_overview` | Dashboard, this month's insights and budgets in one call. |
| `get_balances` | Account balances; people who owe you / you owe. |
| `sms_queue` | `list` pending, `confirm` (optional overrides by name), `split` (parts by name), `dismiss`. |
| `split_transaction` | Split a saved transaction into parts by name. |

Kept: `get_monthly_categories/tags/people`, `get_current_user`, resources. Removed:
`get_dashboard_summary` (in `get_overview`). The generated transaction tools stay enabled
(turning one off drops its permission column on MCP API keys — a destructive schema change);
their description now says not to use them for writes.

### Rules

- **Dates in**: `YYYY-MM-DD` (noon local), `YYYY-MM-DD HH:mm[:ss]` (local), or ISO with
  `Z`/offset (exact). Out: `"2026-11-07 14:30 (+05:30)"`.
- **Names**: exact (case-insensitive) → id → unique partial; categories also accept
  `"Parent > Child"`; only child categories of the transaction's type. Ambiguous or
  missing → the item fails with the candidates listed.
- **Amounts**: positive numbers.
- Each item reports `{index, status: created|would_create|updated|deleted|duplicate|error, id?, errors?, duplicate_of?}`.
- Writes run as the user with access control (`overrideAccess: false`).

## Tests

`tests/int/mcpTools.int.spec.ts`: date parsing/formatting, name resolution (exact,
partial, ambiguous, Parent > Child, wrong type), batch add (local time stored as UTC
correctly, mixed success/error, dry run, duplicate skip), update, delete, search (names,
amount, local date range, totals), sms_queue confirm with names.
