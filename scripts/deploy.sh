#!/usr/bin/env bash
#
# Ship a CI-built artifact to the VPS and cut over to it.
#
# Nothing is built here. The artifact comes from .github/workflows/build.yml,
# which runs on linux/x64 so the traced native modules (sharp, onnxruntime)
# match the server. See docs/DEPLOYMENT.md.
#
#   ./deploy.sh                     # newest build on the rolling release
#   ./deploy.sh <sha>               # a specific commit's build (short sha ok)
#   ./deploy.sh --file <path>       # a tarball (or .zip) you already have
#   ./deploy.sh --rollback          # back to the previous release
#   ./deploy.sh --list              # what's on the server
#   ./deploy.sh --list-builds       # what's downloadable
#
# pika-v2 is a public repo, so the artifact is published as an asset on the
# `deploy-latest` prerelease and downloads over plain HTTPS. No token, no gh,
# no credential of any kind lives on the server for this.
#
# Runs on the VPS itself by default (DEPLOY_HOST=local) — no inbound SSH, no
# laptop in the loop. To drive it from your laptop over the VPN instead, set
# DEPLOY_HOST to an ssh host alias; the script then does the ssh and rsync
# itself and needs ssh + rsync locally.
#
# Overridable: DEPLOY_HOST, DEPLOY_ROOT, DEPLOY_APP, DEPLOY_PORT,
# DEPLOY_HEALTH_PATH, DEPLOY_KEEP, DEPLOY_REPO, DEPLOY_RELEASE_TAG.
#
# Database migrations are not run here. payload.config.ts sets
# `prodMigrations`, so pending migrations execute inside Payload's own
# initialisation — which the health check below deliberately triggers, so a
# failed migration fails this script instead of silently 500ing in production.

set -euo pipefail

REMOTE="${DEPLOY_HOST:-local}"
ROOT="${DEPLOY_ROOT:-/www/wwwroot/pika.elabins.com/app}"
APP="${DEPLOY_APP:-pika}"
PORT="${DEPLOY_PORT:-3333}"
HEALTH_PATH="${DEPLOY_HEALTH_PATH:-/api/access}"
KEEP="${DEPLOY_KEEP:-5}"
REPO="${DEPLOY_REPO:-e-labInnovations/pika-v2}"
RELEASE_TAG="${DEPLOY_RELEASE_TAG:-deploy-latest}"

LOCAL=0
[ "$REMOTE" = "local" ] && LOCAL=1

die() { printf '\033[31merror:\033[0m %s\n' "$*" >&2; exit 1; }
log() { printf '\033[36m==>\033[0m %s\n' "$*"; }

REQUIRED_BINS="tar curl"
[ "$LOCAL" -eq 1 ] || REQUIRED_BINS="$REQUIRED_BINS ssh rsync"
for bin in $REQUIRED_BINS; do
  command -v "$bin" >/dev/null || die "$bin is not installed"
done

# ---------------------------------------------------------------- remote ops

# Everything that touches the server lives in one heredoc, so a deploy is a
# single SSH round trip and can't be left half-applied by a connection dropped
# mid-sequence.
remote() {
  if [ "$LOCAL" -eq 1 ]; then
    bash -s -- "$@"
  else
    ssh "$REMOTE" bash -s -- "$@"
  fi
}

# The release's asset list. Public repo, so this is an unauthenticated GET.
release_json() {
  curl -fsS -H 'Accept: application/vnd.github+json' \
    "https://api.github.com/repos/$REPO/releases/tags/$RELEASE_TAG"
}

# python3 rather than jq: it's on every Debian/Ubuntu box, jq often isn't.
# Prints "<name> <url>" for the newest asset whose name starts with
# pika-<prefix>; an empty prefix means "the newest build there is".
newest_asset() {
  python3 -c '
import json, sys
prefix = "pika-" + (sys.argv[1] if len(sys.argv) > 1 else "")
assets = [a for a in json.load(sys.stdin).get("assets", [])
          if a["name"].startswith(prefix) and a["name"].endswith(".tar.gz")]
if not assets:
    sys.exit(1)
newest = max(assets, key=lambda a: a["created_at"])
print(newest["name"], newest["browser_download_url"])
' "$1"
}

case "${1:-}" in
  --list)
    remote "$ROOT" <<'EOF'
set -euo pipefail
ROOT="$1"
echo "current  -> $(readlink -f "$ROOT/current" 2>/dev/null || echo '(none)')"
echo "previous -> $(cat "$ROOT/shared/previous" 2>/dev/null || echo '(none)')"
echo
echo "releases (newest first):"
ls -1t "$ROOT/releases" 2>/dev/null || echo "  (none)"
EOF
    exit 0
    ;;

  --list-builds)
    command -v python3 >/dev/null || die "python3 is required to list builds"
    log "builds on $REPO@$RELEASE_TAG (newest first)"
    release_json | python3 -c '
import json, sys
assets = [a for a in json.load(sys.stdin).get("assets", []) if a["name"].endswith(".tar.gz")]
for a in sorted(assets, key=lambda a: a["created_at"], reverse=True):
    print("  %-26s %6.0f MB  %s" % (a["name"], a["size"] / 1e6, a["created_at"]))
'
    exit 0
    ;;

  --rollback)
    log "rolling back on $REMOTE"
    remote "$ROOT" "$APP" "$PORT" "$HEALTH_PATH" <<'EOF'
set -euo pipefail
ROOT="$1"; APP="$2"; PORT="$3"; HEALTH_PATH="$4"

# pm2 pins a running app to the cwd and script it was first started with, and
# `startOrReload` keeps them: after the symlink flip a reload would restart the
# *old* release (ecosystem.config.cjs sets cwd to its real release directory).
# So stop it and start it again from the release `current` points at. In fork
# mode a reload is a restart anyway, so this costs no extra downtime.
restart_current() {
  pm2 delete "$APP" >/dev/null 2>&1 || true
  pm2 start "$ROOT/current/ecosystem.config.cjs" --update-env
}
# Release directory the running process was started from, e.g. <sha>
live_release() {
  pm2 jlist 2>/dev/null | python3 -c "import json,os,sys
for a in json.load(sys.stdin):
    if a.get('name') == sys.argv[1]: print(os.path.basename(a['pm2_env'].get('pm_cwd', '')))" "$APP"
}

PREV="$(cat "$ROOT/shared/previous" 2>/dev/null || true)"
[ -n "$PREV" ] || { echo "no previous release recorded" >&2; exit 1; }
[ -d "$ROOT/releases/$PREV" ] || { echo "previous release $PREV is gone" >&2; exit 1; }

CURRENT="$(basename "$(readlink -f "$ROOT/current")")"
ln -sfn "$ROOT/releases/$PREV" "$ROOT/current"
echo "$CURRENT" > "$ROOT/shared/previous"

restart_current
sleep 3
curl -fsS -m 60 -o /dev/null "http://127.0.0.1:${PORT}${HEALTH_PATH}"
echo "rolled back to $PREV"
EOF
    exit 0
    ;;
esac

# ------------------------------------------------------------ fetch artifact

STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

if [ "${1:-}" = "--file" ]; then
  # Hand-downloaded artifact. Accept the .zip a browser might wrap it in, so
  # the file straight out of ~/Downloads works.
  SRC="${2:-}"
  [ -n "$SRC" ] && [ -f "$SRC" ] || die "--file needs a path to an artifact (.zip or .tar.gz)"

  case "$SRC" in
    *.zip)
      command -v unzip >/dev/null || die "unzip is not installed"
      log "unpacking $(basename "$SRC")"
      unzip -q "$SRC" -d "$STAGE"
      TARBALL="$(find "$STAGE" -name 'pika-*.tar.gz' -type f | head -1)"
      [ -n "$TARBALL" ] || die "no pika-*.tar.gz inside $SRC"
      ;;
    *.tar.gz) TARBALL="$SRC" ;;
    *) die "expected a .zip or .tar.gz, got $SRC" ;;
  esac
else
  command -v python3 >/dev/null || die "python3 is required to resolve the download URL"

  WANT="${1:-}"
  if [ -n "$WANT" ]; then
    log "looking up the build for $WANT"
  else
    log "looking up the newest build on $RELEASE_TAG"
  fi

  META="$(release_json | newest_asset "$WANT")" \
    || die "no matching build on $REPO@$RELEASE_TAG — try --list-builds"

  NAME="${META%% *}"
  URL="${META##* }"

  log "downloading $NAME"
  # Public repo: no Authorization header, no gh, nothing to leak.
  curl -fSL --progress-bar -o "$STAGE/$NAME" "$URL" || die "download failed"
  TARBALL="$STAGE/$NAME"

  # A truncated download looks exactly like a corrupt archive; find out now
  # rather than half way through unpacking over the release directory.
  tar -tzf "$TARBALL" >/dev/null 2>&1 || die "$NAME is not a valid tarball — transfer truncated?"
fi

SHA="$(basename "$TARBALL" .tar.gz)"; SHA="${SHA#pika-}"
SHORT="${SHA:0:7}"
log "release $SHORT ($(du -h "$TARBALL" | cut -f1))"

# ------------------------------------------------------------------- upload

if [ "$LOCAL" -eq 1 ]; then
  log "staging artifact"
  # Guard against cp'ing a file onto itself when --file already points at the
  # staging path.
  if [ "$(cd "$(dirname "$TARBALL")" && pwd)/$(basename "$TARBALL")" != "/tmp/pika-${SHA}.tar.gz" ]; then
    cp "$TARBALL" "/tmp/pika-${SHA}.tar.gz"
  fi
else
  log "uploading to $REMOTE"
  rsync -h --progress "$TARBALL" "$REMOTE:/tmp/pika-${SHA}.tar.gz"
fi

# ------------------------------------------------------------------ cut over

log "unpacking and reloading"
remote "$ROOT" "$APP" "$PORT" "$HEALTH_PATH" "$SHA" "$KEEP" <<'EOF'
set -euo pipefail
ROOT="$1"; APP="$2"; PORT="$3"; HEALTH_PATH="$4"; SHA="$5"; KEEP="$6"

# pm2 pins a running app to the cwd and script it was first started with, and
# `startOrReload` keeps them: after the symlink flip a reload would restart the
# *old* release (ecosystem.config.cjs sets cwd to its real release directory).
# So stop it and start it again from the release `current` points at. In fork
# mode a reload is a restart anyway, so this costs no extra downtime.
restart_current() {
  pm2 delete "$APP" >/dev/null 2>&1 || true
  pm2 start "$ROOT/current/ecosystem.config.cjs" --update-env
}
# Release directory the running process was started from, e.g. <sha>
live_release() {
  pm2 jlist 2>/dev/null | python3 -c "import json,os,sys
for a in json.load(sys.stdin):
    if a.get('name') == sys.argv[1]: print(os.path.basename(a['pm2_env'].get('pm_cwd', '')))" "$APP"
}

REL="$ROOT/releases/$SHA"
TARBALL="/tmp/pika-${SHA}.tar.gz"

[ -d "$ROOT/shared" ] || { echo "$ROOT/shared missing — run the one-time setup in docs/DEPLOYMENT.md" >&2; exit 1; }

# Re-deploying the same SHA is a legitimate thing to want (config change,
# recovering a botched release), so replace rather than refuse.
rm -rf "$REL"
mkdir -p "$REL"
tar -xzf "$TARBALL" -C "$REL"
rm -f "$TARBALL"

# Wire the release to the state that outlives it. Next's standalone server
# chdir()s to its own directory and loads .env from there; Payload's default
# upload staticDir is the collection slug resolved against that same cwd; and
# the MiniLM weights are cached under .cache/transformers-models unless
# TRANSFORMERS_CACHE_DIR says otherwise. All three have to land at the release
# root, pointing at shared/.
ln -sfn "$ROOT/shared/.env" "$REL/.env"
ln -sfn "$ROOT/shared/media" "$REL/media"
mkdir -p "$REL/.cache"
ln -sfn "$ROOT/shared/model-cache" "$REL/.cache/transformers-models"

# Test the symlink itself, not the path: `readlink -f` happily resolves a
# missing final component, so on the very first deploy — when `current` does
# not exist yet — it returns "<root>/current" and the basename of that is the
# literal string "current". That would get written to shared/previous as a
# rollback target that is not a release.
PREV=""
if [ -L "$ROOT/current" ]; then
  PREV="$(basename "$(readlink -f "$ROOT/current")")"
fi

ln -sfn "$REL" "$ROOT/current"
restart_current

# Payload initialises lazily — on the first request that touches it, which is
# also when prodMigrations run and when onInit checks the seed data. Poll until
# it answers so a bad migration surfaces here rather than to a visitor.
# Generous window: a migration on a large table is slow, and that is not a
# failure.
echo "waiting for $APP to answer (this is where migrations run)..."
OK=0
for _ in $(seq 1 60); do
  if curl -fsS -m 10 -o /dev/null "http://127.0.0.1:${PORT}${HEALTH_PATH}"; then
    OK=1; break
  fi
  sleep 2
done

if [ "$OK" -ne 1 ]; then
  echo "health check failed" >&2
  if [ -n "$PREV" ] && [ -d "$ROOT/releases/$PREV" ]; then
    echo "rolling back to $PREV" >&2
    ln -sfn "$ROOT/releases/$PREV" "$ROOT/current"
    restart_current
  else
    echo "no previous release to roll back to" >&2
  fi
  echo "--- recent logs ---" >&2
  pm2 logs "$APP" --lines 40 --nostream >&2 || true
  exit 1
fi

# The health check proves something answers on the port; make sure it is the
# release we just installed, not a process left running from an older one.
LIVE="$(live_release)"
if [ "$LIVE" != "$(basename "$REL")" ]; then
  echo "pm2 is running release '${LIVE:-none}', expected $(basename "$REL")" >&2
  exit 1
fi

if [ -n "$PREV" ]; then
  echo "$PREV" > "$ROOT/shared/previous"
fi
pm2 save >/dev/null 2>&1 || true

# Keep a few releases back so --rollback has somewhere to go. Never prune the
# live one or the rollback target.
CURRENT_NAME="$(basename "$(readlink -f "$ROOT/current")")"
cd "$ROOT/releases"
ls -1t | tail -n "+$((KEEP + 1))" | while read -r old; do
  if [ "$old" = "$CURRENT_NAME" ] || [ "$old" = "$PREV" ]; then
    continue
  fi
  echo "pruning $old"
  rm -rf "$old"
done

echo "live: $SHA"
EOF

log "deployed $SHORT"
