#!/usr/bin/env bash
#
# Deploy script for a Payload-CMS-template-based site (run on the prod
# server as the app user).
#
# Usage (from local):
#   ssh HOST "sudo -u $APP_USER -i $REPO_DIR/scripts/deploy.sh [BRANCH]"
#
# Configure via env (export in ~/.bashrc on the server, or pass inline):
#   APP_NAME    pm2 process name (default: app)
#   REPO_DIR    absolute path to the checked-out repo (default: /opt/app)
#   BRANCH      git branch to deploy (default: $1 or main)
#   SMOKE_URL   URL to GET as a post-restart smoke check
#               (default: http://127.0.0.1:3000/)
#
# WHY this script exists rather than inline `ssh HOST 'bash -c "..."'`:
# nested ssh + sudo + bash -c quoting is fundamentally broken. The OUTER
# remote shell expands `$?` inside the bash -c double-quoted argument BEFORE
# the inner bash sees it, silently leaving variables empty and breaking
# `if`-checks. Using a real script in the repo, called by a single ssh
# invocation, eliminates ALL escaping concerns.
#
# WHY `set -euo pipefail`: ensures any command failure aborts with a clear
# marker. Without it, the classic anti-pattern `pnpm build 2>&1 | tail -N`
# masks build failure (tail returns 0 even when build failed) → pm2
# restarts against a broken/missing .next → crash loop. Don't chain
# `pnpm build && pm2 restart` either — wrap in a proper if/then/else so
# pm2 only restarts on a green build.

set -euo pipefail

APP_NAME="${APP_NAME:-app}"
REPO_DIR="${REPO_DIR:-/opt/app}"
BRANCH="${1:-${BRANCH:-main}}"
SMOKE_URL="${SMOKE_URL:-http://127.0.0.1:3000/}"
LOG="/tmp/deploy.log"

cd "$REPO_DIR"

echo "→ Pulling $BRANCH"
git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH" | tail -3

echo "→ Migrating DB"
pnpm payload migrate 2>&1 | tail -10

# Regenerate the admin importMap so any new schema features (Lexical
# LinkFeature collections, custom RowLabel components, custom admin
# views, etc.) actually show up in the admin UI after deploy. The build
# bundles this file, so it has to run BEFORE pnpm build, not after.
# Skipping this step is silent: deploy reports green, the new feature
# just doesn't appear in admin until the next build picks up the file.
echo "→ Regenerating admin importMap"
pnpm generate:importmap 2>&1 | tail -3

echo "→ Building (webpack, output to $LOG)"
rm -rf .next
if pnpm build > "$LOG" 2>&1; then
  echo "✓ Build succeeded"
else
  echo "✗ Build failed — tail of $LOG:"
  tail -30 "$LOG"
  exit 1
fi

# Source .env into the shell before pm2 restart so the new env vars
# reach the restarted process via --update-env. Next.js's "auto-load
# .env" doesn't reliably propagate through pnpm + cross-env + pm2;
# explicit export here is the only path that survives. Symptom when
# missing: SMTP credentials in .env are correct but the running process
# sees them as empty, nodemailer auth fails with 535.
echo "→ Restarting pm2 ($APP_NAME) with .env loaded into shell"
set -a; source "$REPO_DIR/.env"; set +a
pm2 restart "$APP_NAME" --update-env

# Tiny pause so pm2 finishes booting before the smoke check runs
sleep 4

echo "→ Smoke check ($SMOKE_URL)"
HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$SMOKE_URL")
echo "  GET $SMOKE_URL → HTTP $HTTP"
if [ "$HTTP" != "200" ]; then
  echo "✗ Smoke check failed — site is not responding 200"
  exit 1
fi

echo "✓ Deploy done — commit $(git rev-parse --short HEAD)"
