# Deployment

The VPS runs a build. It does not contain one.

No repo, no `pnpm`, no `node_modules`, no build cache, no toolchain. Just a
directory of unpacked releases, the state that outlives them, and pm2.

```
GitHub Actions (ubuntu-x64)          /www/wwwroot/pika.elabins.com/app/
  pnpm install                       ├── releases/
  pnpm build   (standalone)          │   ├── <sha-1>/   previous
  tar + attach to a release          │   └── <sha-2>/   live
        │                            ├── current -> releases/<sha-2>
        │                            └── shared/          survives every deploy
        ▼                                ├── media/       uploads
  github.com/.../releases/               ├── model-cache/ MiniLM weights
      deploy-latest                      ├── logs/
        │                                ├── .env
        │  curl, no token                └── previous
        ▼
   deploy.sh
     download pika-<sha>.tar.gz
     unpack to releases/<sha>
     symlink shared/ into it
     ln -sfn current
     pm2 startOrReload
     health check ──► migrations run here, or the deploy fails
     prune to 5 releases
```

Postgres, uploads, and the model cache are never touched by a deploy. A release
is pure code.

## Why the build happens on CI

`next build` with `output: 'standalone'` traces `node_modules` **from the
machine doing the build**. On a Mac that resolves `@img/sharp-darwin-arm64` and
onnxruntime's darwin binding, neither of which can load on a linux/x64 server —
and [payload.config.ts](../src/payload.config.ts) imports `sharp` at module
scope, so the failure takes the whole app down.

Native modules do not cross platforms. The build architecture has to match the
server's. That is the only reason CI is involved — the deploy itself stays
manual, and you choose when it happens.

## Why a release asset and not an Actions artifact

`pika-v2` is public, so a release asset downloads over plain HTTPS with no
credentials. The workflow attaches each build to a rolling prerelease tagged
`deploy-latest` and prunes to the newest five. The VPS holds no GitHub token,
no `gh`, no SSH key for this — just `curl`.

(Actions artifacts would have needed a token even on a public repo. That is the
whole reason for the difference from elabins-v3, which is private.)

## One-time setup

### 1. Check the VPS

```bash
uname -m            # expect x86_64 — if aarch64, change runs-on in build.yml
                    # *and* the onnxruntime include in next.config.mjs
node --version      # expect v20+; v22 matches CI
pm2 --version
python3 --version   # deploy.sh uses it to read the release JSON
```

### 2. Baseline the database (required once — it was pushed, not migrated)

`prodMigrations` is now enabled, and the production database has never had a
migration run against it: `push` was left at its default, so the schema was
synced directly from the collections. Payload records that with a marker row:

```sql
SELECT name, batch FROM payload_migrations;
-- "dev"  -1        <- this is the marker
```

That row has to go before the first deploy. Two things happen while it exists:

1. `migrate()` sees `batch = -1` and asks, on stdin, whether to proceed given
   likely data loss ([migrate.js](../node_modules/@payloadcms/drizzle/dist/migrate.js)).
   Under pm2 there is no terminal — stdin is at EOF, the prompt cancels, and
   the handler calls `process.exit(0)`. The server exits on the first request
   that touches Payload, every time, and pm2 restarts it into the same wall.
2. If it did proceed, every migration would be treated as pending, starting
   with `20260404_060059` — the generated initial migration, 24 bare
   `CREATE TABLE` statements with no `IF NOT EXISTS`. The first one fails,
   `runMigrationFile` calls `process.exit(1)`, and the process dies again.

The fix is the standard "baseline an existing database" move: delete the marker
and insert a row for each migration whose effect the pushed schema already has.
`migrate()` matches by `name`, so a recorded name is simply skipped.

First find out what the schema actually has:

```sql
SELECT id, name, batch, created_at FROM payload_migrations ORDER BY created_at;

SELECT
  to_regclass('public.ai_prompts')             IS NOT NULL AS has_ai_prompts,
  to_regclass('public.transaction_embeddings') IS NOT NULL AS has_transaction_embeddings,
  EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_name = 'transactions' AND column_name = 'title_embedding')
    AS transactions_still_has_title_embedding;

-- Are the AI models already seeded into the app-settings global?
SELECT count(*) FROM app_settings_ai_models;
```

Take a dump before writing anything:

```bash
pg_dump "$DATABASE_URL" | gzip > /root/pre-baseline-$(date +%F).sql.gz
```

What that returned on 2026-09-01, and what it means:

| check | value | consequence |
|---|---|---|
| `payload_migrations` | one row, `dev` / `-1` | nothing has ever been migrated |
| `ai_prompts` | exists | `add_ai_prompts` is already in the schema |
| `transaction_embeddings` | exists | `move_title_embeddings` created its table |
| `transactions.title_embedding` | **gone** | push dropped it — so that migration must be recorded |
| `app_settings_ai_models` | 0 rows | the model list is *not* seeded |

So three migrations get recorded and one is deliberately left to run:

```sql
BEGIN;

DELETE FROM payload_migrations WHERE batch = -1;

INSERT INTO payload_migrations (name, batch) VALUES
  ('20260404_060059',                       1),
  ('20260426_000000_add_ai_prompts',        1),
  ('20260426_200000_move_title_embeddings', 1);

COMMIT;
```

Why each one:

- **`20260404_060059`** — the generated initial migration. 24 bare
  `CREATE TABLE` statements, no `IF NOT EXISTS`. It would fail on the first
  one and take the process with it.
- **`20260426_000000_add_ai_prompts`** — idempotent, so recording it is a
  convenience rather than a necessity. The table already exists.
- **`20260426_200000_move_title_embeddings`** — recording this one is
  **required**. It copies `transactions.title_embedding` into the new table
  before dropping the column, and push already dropped that column, so its
  `INSERT INTO ... SELECT t."title_embedding"` would error on a column that no
  longer exists.
- **`20260425_000000_seed_ai_models`** — deliberately *not* recorded, so it
  runs on the first request after the deploy. It writes data, not schema.
  Note that it is a no-op in practice: the `ai.models` array in
  [AppSettings.ts](../src/globals/AppSettings.ts) carries the same six models
  as its `defaultValue`, and Payload applies a field default when reading a
  global that has never been saved
  ([afterRead/promise.js:239](../node_modules/payload/dist/fields/hooks/afterRead/promise.js)),
  so the migration's `if (existing.length > 0) return` guard always fires. It
  logs `Migrated:` and writes nothing. Harmless either way.

If you are reading this against a different database, work the same way: record
anything whose effect the schema already has, leave anything genuinely pending,
and never record a data-moving migration whose source column still holds data.

### The embeddings that push already destroyed

`transaction_embeddings` exists but `transactions.title_embedding` was dropped
by schema push, which copies no data. Any embeddings that predate the switch
are gone — they were not lost by the migration, they were lost when push
removed the column.

They are derived data and regenerate on demand. Per user, after the deploy:

```bash
curl -X POST https://pika.elabins.com/api/ai/backfill-embeddings \
  -H "Cookie: <an authenticated session>"
curl https://pika.elabins.com/api/ai/backfill-embeddings/status \
  -H "Cookie: <an authenticated session>"
```

Or from the admin panel, which calls the same endpoints.

Verify afterwards that nothing else is pending:

```sql
SELECT name, batch FROM payload_migrations ORDER BY created_at;
```

Expect three rows and no `-1`. `20260425_000000_seed_ai_models` should be
absent — it runs itself on the first request after the deploy and records a
fourth row as batch 2.

Do **not** expect rows in `app_settings_ai_models`. That table stays empty
until someone saves App Settings in the admin panel; until then the six models
come from the field's `defaultValue` on every read, which is also why the seed
migration finds a non-empty list and does nothing. The admin panel showing six
models with `SELECT count(*) FROM app_settings;` returning 0 is the expected
state, not a fault.

From here on this is a one-time exercise — every future schema change arrives
as a migration file and records itself.

### 3. Lay out the directories

`/www/wwwroot/pika.elabins.com` is aaPanel's document root and must keep
existing: the panel writes `.well-known` there when renewing the SSL
certificate. Releases go in an `app/` subdirectory so neither the docroot nor
any existing checkout is disturbed.

```
/www/wwwroot/pika.elabins.com/     <- aaPanel docroot, untouched
├── .well-known/                   <- cert renewal. keep.
├── pika-v2/                       <- the current checkout. fallback, then deleted.
└── app/                           <- everything below is ours (DEPLOY_ROOT)
    ├── releases/
    │   ├── <sha-1>/               previous
    │   └── <sha-2>/               live
    ├── current -> releases/<sha-2>
    └── shared/
        ├── media/  model-cache/  logs/  .env  previous
```

```bash
ROOT=/www/wwwroot/pika.elabins.com/app
OLD=/www/wwwroot/pika.elabins.com/pika-v2

mkdir -p "$ROOT"/{releases,shared/logs,shared/media,shared/model-cache}

# Uploads and the downloaded MiniLM weights, moved out of the old checkout.
mv "$OLD/media"/*                      "$ROOT/shared/media/"        2>/dev/null || true
mv "$OLD/.cache/transformers-models"/*  "$ROOT/shared/model-cache/" 2>/dev/null || true
cp "$OLD/.env"                         "$ROOT/shared/.env"

# Keep the old checkout runnable as a fallback for the first deploy, so it
# serves the same uploads rather than an empty directory.
rmdir "$OLD/media" 2>/dev/null && ln -s "$ROOT/shared/media" "$OLD/media"
```

Moving the model cache is optional — if `shared/model-cache` is empty the
server downloads the ~22MB model on the first category suggestion. Moving it
just avoids that one slow request.

Once the first deploy is verified, cleanup is one directory — nothing near
`.well-known`:

```bash
rm -rf /www/wwwroot/pika.elabins.com/pika-v2
```

### 4. Point shared/.env at shared/

Two runtime paths have to leave the release directory, or they vanish on the
next prune:

```bash
cat >> /www/wwwroot/pika.elabins.com/app/shared/.env <<'ENV'
TRANSFORMERS_CACHE_DIR=/www/wwwroot/pika.elabins.com/app/shared/model-cache
ENV
```

Uploads need no equivalent: `deploy.sh` symlinks `shared/media` into every
release at `media/`, which is where Payload's default `staticDir` (the
collection slug, resolved against the process cwd) looks. `deploy.sh` also
symlinks the model cache into `.cache/transformers-models`, so the env var
above is belt and braces — but set it anyway, so the path is explicit rather
than depending on a symlink nobody remembers.

`shared/.env` must contain at least:

```bash
DATABASE_URL=postgres://...
PAYLOAD_SECRET=...
NEXT_PUBLIC_SERVER_URL=https://pika.elabins.com
NEXT_PUBLIC_PAYLOAD_AUTH_URL=https://pika.elabins.com
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
TRANSFORMERS_CACHE_DIR=/www/wwwroot/pika.elabins.com/app/shared/model-cache
```

The two `NEXT_PUBLIC_*` values are also **baked into the client bundle at build
time** — see step 6. Keeping them in `.env` too matters because server code
reads them at runtime.

### 5. Put deploy.sh on the server

The default is `DEPLOY_HOST=local`: every step runs on the VPS, no inbound SSH,
no laptop in the loop.

```bash
scp scripts/deploy.sh <vps>:/www/wwwroot/pika.elabins.com/app/deploy.sh
# or just paste it into an editor on the box
chmod +x /www/wwwroot/pika.elabins.com/app/deploy.sh
```

Only outbound HTTPS is required. To drive it from your laptop over the VPN
instead, set `DEPLOY_HOST` to an ssh host alias and the script does the ssh and
rsync itself.

### 6. Tell CI the public URL

`NEXT_PUBLIC_*` variables are inlined into the client bundle by `next build`,
so they cannot be changed later from `shared/.env`. The workflow defaults both
to `https://pika.elabins.com`; to change either without editing the file, set a
repository variable of the same name (Settings → Secrets and variables →
Actions → Variables).

Get `NEXT_PUBLIC_SERVER_URL` wrong and the OAuth discovery documents advertise
the wrong issuer, so MCP clients fail discovery — see
[production-deploy-mcp-oauth.md](./production-deploy-mcp-oauth.md) for the
nginx side of that feature.

### 7. Retire the old process

```bash
pm2 delete pika     # whatever the existing process is called
```

`deploy.sh` starts it from the [ecosystem.config.cjs](../ecosystem.config.cjs)
shipped inside each release. After the first successful deploy, run `pm2 save`
once so it survives a reboot.

Nginx needs no changes — it already proxies to `localhost:3333`.

## Deploying

```bash
git push origin main                    # Actions builds and publishes it
```

then, on the VPS:

```bash
cd /www/wwwroot/pika.elabins.com/app
./deploy.sh                             # newest build on deploy-latest
```

That is the whole routine. There is no migrate step — see below.

Other forms:

```bash
./deploy.sh <sha>                 # a specific commit's build (short sha ok)
./deploy.sh --file <path>         # an artifact you moved by hand
./deploy.sh --list                # what's live, what's rollback-able
./deploy.sh --list-builds         # what's downloadable
./deploy.sh --rollback            # previous release, symlink flip + reload
```

Rollback repoints the symlink and reloads. It does **not** revert the database
— see the caveat below.

## Migrations

You do not run them. [payload.config.ts](../src/payload.config.ts) sets
`prodMigrations`, so pending migrations execute during Payload's initialisation
on the server.

The reason it works this way: `payload migrate` cannot run on a deployed build.
Standalone output traces only what the server *imports*, so `payload/bin.js`,
`tsx`, and the raw `src/migrations/*.ts` files are all absent from the
artifact. Importing [the migrations array](../src/migrations/index.ts) into the
config puts them in the module graph instead, so they compile into the bundle
and never need to be read off disk.

Payload initialises lazily — on the first request that touches it, not at
process boot. `deploy.sh` sends that request itself and waits for a 200, which
is what converts "migrations run sometime later" into "a bad migration fails
the deploy".

`onInit` (the system-user/category/tag seed in [src/seed/init.ts](../src/seed/init.ts))
runs in that same first-request window. It is a no-op when the seed data is
already present.

### Migrations never run during a build

`next build` sets `NODE_ENV=production` and initialises Payload while
collecting page data — which is enough to satisfy `prodMigrations`' gate and
migrate whatever database the build machine points at. A `pnpm build` on your
laptop would migrate your dev database; a CI build with real credentials would
migrate production.

[payload.config.ts](../src/payload.config.ts) therefore withholds
`prodMigrations` whenever `NEXT_PHASE=phase-production-build` (set by Next) or
`PAYLOAD_DISABLE_PROD_MIGRATIONS=true` (set by the workflow, since static
generation runs in forked workers that Next's own flag may not reach).

Creating migrations is unchanged, on your laptop:

```bash
npx -y pnpm@10.32.1 payload migrate:create
git add src/migrations && git commit
```

`src/migrations/index.ts` must list the new file — `migrate:create` updates it
for you, but hand-written migrations need adding by hand.

Two cases where you might still run one yourself, from your laptop with a
tunnel to the prod database:

- **A slow migration.** It runs inside the first request after deploy, so a
  migration that takes a minute on a large table means nginx 504s and the site
  is down until it finishes. Run it deliberately beforehand instead.
- **Checking what's pending**: `payload migrate:status`.

Before a migration you don't fully trust, take a dump. It runs against the live
database on the first request after cutover, and rollback won't undo it:

```bash
pg_dump "$DATABASE_URL" | gzip > /root/pre-deploy-$(date +%F).sql.gz
```

## Caveats

**Rollback does not undo a migration.** Reverting code to a release built
against the previous schema leaves it running against the new one. Additive
migrations survive this; a dropped or renamed column does not. For destructive
changes use expand/contract — add the new column, deploy, backfill, drop the
old one in a later release.

**The artifact is linux/x64 only.** [next.config.mjs](../next.config.mjs) keeps
one onnxruntime platform build and excludes the other four, because the loader
requires its addon through a template literal the tracer cannot resolve — left
alone it ships all five (~210MB) or none. A consequence: a standalone build
made on your Mac cannot run locally, because the darwin binding was excluded.
Run `pnpm dev` for local work; the standalone output is for the server.

**Never derive a runtime path from `import.meta.url`.** Webpack inlines it as
the source file's absolute path *on the build machine*, so a CI-built bundle
carries `/home/runner/work/pika-v2/...` and writes to directories that do not
exist on the VPS. Anything resolving at runtime — uploads, the model cache,
`public/lucide.svg` — must come from `process.cwd()`, which Next's standalone
server sets to the release root. To check for regressions:

```bash
grep -rho "file:///[^\"]*" .next/server/chunks/*.js | sort -u
```

Hits under `src/` mean something in the app baked a build-machine path.

**`media/` and `.cache/` are never in the artifact.** Next's file tracer reads
`path.resolve(...)` expressions and will happily copy the directories they
point at. `outputFileTracingExcludes` in [next.config.mjs](../next.config.mjs)
keeps them out and the workflow asserts they stayed out. If you add code that
resolves a new runtime directory, expect to add it there too.

**A local `pnpm build` bakes your `.env` into the output.** Next copies `.env`
into the standalone directory unconditionally — that is
`writeStandaloneDirectory`, not the tracer, so it cannot be excluded. CI builds
from a clean checkout where the file does not exist, and the workflow fails if
one appears. Don't hand a locally-built `.next/standalone` to anyone.

**One instance only.** The MiniLM pipeline is a per-process singleton holding
the model plus an onnxruntime session; `exec_mode: 'fork'` with `instances: 1`
keeps that to one copy.

**The build makes no database connection.** `(frontend)/[slug]` is
`force-dynamic` precisely so nothing queries Payload at build time. Adding a
route that calls `getPayload()` *without* that export reintroduces the
requirement and will fail CI, where no database exists.

**Use the pinned pnpm.** `packageManager` says `pnpm@10.32.1`; invoke it as
`npx -y pnpm@10.32.1 <cmd>`. A different major produces lockfile churn that
only surfaces in CI, where `--frozen-lockfile` is enforced.
