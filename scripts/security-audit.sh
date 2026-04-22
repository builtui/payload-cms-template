#!/bin/bash
#
# Production security audit — one-shot check script.
#
# Runs all 12 sections of docs/SECURITY-AUDIT-checklist.md against a
# deployed instance. Emits color-coded PASS/WARN/FAIL per check and a
# summary at the end.
#
# Usage (on the server, or locally via SSH):
#   ./scripts/security-audit.sh
#   APP_NAME=hugenottenhaus APP_PATH=/opt/hugenottenhaus ./scripts/security-audit.sh
#   DOMAIN=example.com BASIC_AUTH="user:pass" ./scripts/security-audit.sh
#
# Env vars:
#   APP_NAME    — app/pm2 process name (default: guessed from APP_PATH)
#   APP_PATH    — /opt/<app> path where the .env + media live
#   DB_NAME     — postgres database name (default: $APP_NAME)
#   DB_USER     — postgres role the app uses (default: ${APP_NAME}_app)
#   DOMAIN      — canonical domain for external checks (default: parsed from .env)
#   BASIC_AUTH  — "user:pass" if the site is behind HTTP basic auth
#
# Writes a timestamped log to /tmp/audit-<date>.txt AND stdout.

set -uo pipefail

APP_PATH="${APP_PATH:-$(pwd)}"
APP_NAME="${APP_NAME:-$(basename "$APP_PATH")}"
DB_NAME="${DB_NAME:-$APP_NAME}"
DB_USER="${DB_USER:-${APP_NAME}_app}"

# Parse canonical domain from .env if not explicitly given
if [[ -z "${DOMAIN:-}" ]] && [[ -f "$APP_PATH/.env" ]]; then
  DOMAIN=$(grep -E '^NEXT_PUBLIC_SITE_URL=' "$APP_PATH/.env" 2>/dev/null | \
    sed -E 's#^NEXT_PUBLIC_SITE_URL=https?://##; s#/.*##')
fi
DOMAIN="${DOMAIN:-}"

LOG="/tmp/audit-$(date +%Y%m%d-%H%M%S).txt"
PASS=0
WARN=0
FAIL=0

# Colour output if stdout is a TTY
if [[ -t 1 ]]; then
  G=$'\033[32m'; Y=$'\033[33m'; R=$'\033[31m'; B=$'\033[1m'; N=$'\033[0m'
else
  G=''; Y=''; R=''; B=''; N=''
fi

log() { echo "$@" | tee -a "$LOG"; }
pass() { ((PASS++)); log "  ${G}✓ PASS${N}  $*"; }
warn() { ((WARN++)); log "  ${Y}⚠ WARN${N}  $*"; }
fail() { ((FAIL++)); log "  ${R}✗ FAIL${N}  $*"; }
section() { log ""; log "${B}── $* ──${N}"; }

curl_opts=()
[[ -n "${BASIC_AUTH:-}" ]] && curl_opts+=(-u "$BASIC_AUTH")

log "${B}Audit — $APP_NAME @ ${DOMAIN:-unknown}${N}"
log "App path: $APP_PATH  |  DB: $DB_NAME  |  DB user: $DB_USER"
log "Started: $(date -Iseconds)"
log "Log: $LOG"

# ── 1. Secrets & Credentials ───────────────────────────────────────
section "1. Secrets & Credentials"

if [[ -f "$APP_PATH/.env" ]]; then
  perms=$(stat -c "%a" "$APP_PATH/.env" 2>/dev/null || stat -f "%A" "$APP_PATH/.env")
  if [[ "$perms" == "600" ]]; then
    pass ".env permissions are 600"
  else
    fail ".env permissions are $perms, expected 600"
  fi
else
  warn "no .env at $APP_PATH/.env — cannot check"
fi

if [[ -f "$APP_PATH/.env" ]]; then
  if grep -qE "devpwd|changeme|password123" "$APP_PATH/.env"; then
    fail ".env contains default password tokens (devpwd/changeme/password123)"
  else
    pass ".env has no default-password tokens"
  fi

  secret_len=$(awk -F= '/^PAYLOAD_SECRET=/ { print length($2) }' "$APP_PATH/.env")
  if [[ -n "$secret_len" && "$secret_len" -ge 32 ]]; then
    pass "PAYLOAD_SECRET is $secret_len chars (≥32)"
  else
    fail "PAYLOAD_SECRET is too short or missing (${secret_len:-0} chars)"
  fi
fi

if command -v git >/dev/null && [[ -d "$APP_PATH/.git" ]]; then
  tracked_env=$(cd "$APP_PATH" && git ls-files | grep -cE '^\.env$' || true)
  [[ "$tracked_env" == "0" ]] && pass ".env is not tracked in git" || fail ".env IS tracked in git!"
fi

# ── 2. Network & Firewall ──────────────────────────────────────────
section "2. Network & Firewall"

if command -v ss >/dev/null; then
  db_listen=$(ss -tlnp 2>/dev/null | awk '/:5432/ { print $4 }' | head -3)
  if echo "$db_listen" | grep -qE '^(127\.0\.0\.1:|\[::1\]:)'; then
    if echo "$db_listen" | grep -qE '^0\.0\.0\.0:|^\[::\]:'; then
      fail "PostgreSQL listens on public interface!"
    else
      pass "PostgreSQL listens only on localhost"
    fi
  else
    warn "couldn't verify PostgreSQL listener"
  fi
else
  warn "ss command unavailable"
fi

if command -v ufw >/dev/null; then
  ufw_status=$(ufw status 2>/dev/null | head -1)
  if echo "$ufw_status" | grep -qi active; then
    pass "UFW firewall active"
  else
    warn "UFW is not active"
  fi
fi

# ── 3. SSH hardening ───────────────────────────────────────────────
section "3. SSH hardening"

pwdauth=$(grep -hiE '^PasswordAuthentication' /etc/ssh/sshd_config /etc/ssh/sshd_config.d/*.conf 2>/dev/null | tail -1 | awk '{print $2}')
if [[ "$pwdauth" =~ ^([Nn]o)$ ]]; then
  pass "PasswordAuthentication = no"
else
  fail "PasswordAuthentication is '$pwdauth' (should be no — ubuntu default is yes)"
fi

rootlogin=$(grep -hiE '^PermitRootLogin' /etc/ssh/sshd_config 2>/dev/null | tail -1 | awk '{print $2}')
if [[ "$rootlogin" =~ ^(no|prohibit-password)$ ]]; then
  pass "PermitRootLogin = $rootlogin"
else
  warn "PermitRootLogin is '$rootlogin' (consider 'prohibit-password')"
fi

if systemctl is-enabled fail2ban >/dev/null 2>&1; then
  jails=$(fail2ban-client status 2>/dev/null | grep -oE 'Number of jail:\s*[0-9]+' | awk '{print $4}')
  if [[ -n "$jails" && "$jails" -ge 1 ]]; then
    pass "fail2ban active ($jails jails)"
  else
    warn "fail2ban enabled but no jails active"
  fi
else
  warn "fail2ban not installed or disabled"
fi

if [[ -f /etc/nginx/.htpasswd ]]; then
  hperms=$(stat -c "%a %U:%G" /etc/nginx/.htpasswd 2>/dev/null)
  if [[ "$hperms" =~ ^6[04]0 ]]; then
    pass ".htpasswd permissions ok ($hperms)"
  else
    fail ".htpasswd permissions $hperms (should be 640 or 600)"
  fi
fi

# ── 4. TLS / SSL ───────────────────────────────────────────────────
section "4. TLS / SSL"

if command -v certbot >/dev/null; then
  certbot_out=$(certbot certificates 2>/dev/null | grep -E "Expiry Date" | head -1)
  if [[ -n "$certbot_out" ]]; then
    pass "certbot certificates present ($certbot_out)"
  else
    warn "no certbot certificates found"
  fi
  if systemctl is-enabled certbot.timer >/dev/null 2>&1; then
    pass "certbot.timer enabled (auto-renewal)"
  else
    fail "certbot.timer not enabled"
  fi
fi

if [[ -n "$DOMAIN" ]]; then
  tls=$(echo | openssl s_client -servername "$DOMAIN" -connect "$DOMAIN:443" 2>/dev/null | grep -E '^\s+Protocol\s*:' | head -1 | awk '{print $3}')
  if [[ "$tls" =~ ^TLSv1\.(2|3)$ ]]; then
    pass "TLS version $tls (modern)"
  elif [[ -n "$tls" ]]; then
    fail "TLS version $tls (outdated)"
  else
    warn "couldn't probe TLS"
  fi
fi

# ── 5. Security Headers ────────────────────────────────────────────
section "5. Security Headers"

if [[ -n "$DOMAIN" ]]; then
  headers=$(curl -sIk "${curl_opts[@]}" "https://$DOMAIN/" 2>/dev/null)
  for h in "strict-transport-security" "x-content-type-options" "x-frame-options" "referrer-policy" "permissions-policy"; do
    if echo "$headers" | grep -qi "^${h}:"; then
      pass "header $h present"
    else
      warn "header $h missing"
    fi
  done
fi

# ── 6. Backups ─────────────────────────────────────────────────────
section "6. Backups"

BACKUP_DIR="/var/backups/postgresql"
if [[ -d "$BACKUP_DIR" ]]; then
  latest=$(ls -t "$BACKUP_DIR"/*.sql.gz 2>/dev/null | head -1)
  if [[ -n "$latest" ]]; then
    age_hours=$(( ($(date +%s) - $(stat -c %Y "$latest" 2>/dev/null || stat -f %m "$latest")) / 3600 ))
    size=$(du -h "$latest" | cut -f1)
    if [[ "$age_hours" -le 26 ]]; then
      pass "latest backup $size, ${age_hours}h old"
    else
      fail "latest backup is ${age_hours}h old (>26h, cron may not be running)"
    fi
    head=$(zcat "$latest" 2>/dev/null | head -1)
    if [[ "$head" =~ "PostgreSQL database dump" ]]; then
      pass "backup content valid"
    else
      fail "backup content corrupt (no PG dump header)"
    fi
  else
    fail "no backups in $BACKUP_DIR"
  fi
else
  warn "$BACKUP_DIR does not exist — no backups configured"
fi

# ── 7. Database ────────────────────────────────────────────────────
section "7. Database"

if command -v psql >/dev/null; then
  role=$(sudo -u postgres psql -t -c "SELECT rolsuper::text || ',' || rolcreatedb::text || ',' || rolcreaterole::text FROM pg_roles WHERE rolname='$DB_USER';" 2>/dev/null | tr -d ' ')
  if [[ "$role" == "f,f,f" ]]; then
    pass "$DB_USER has no superuser/createdb/createrole flags"
  elif [[ -n "$role" ]]; then
    fail "$DB_USER has elevated privileges: $role"
  else
    warn "couldn't query pg_roles for $DB_USER"
  fi
fi

# ── 8. System updates ──────────────────────────────────────────────
section "8. System updates"

if command -v apt >/dev/null; then
  sec_updates=$(apt list --upgradable 2>/dev/null | grep -ic security || true)
  if [[ "$sec_updates" -eq 0 ]]; then
    pass "no pending security updates"
  else
    fail "$sec_updates pending security updates"
  fi
fi

# Node version sanity
if command -v node >/dev/null; then
  nver=$(node --version)
  pass "Node version: $nver"
fi

# ── 9. App-specific ────────────────────────────────────────────────
section "9. App-specific (Next.js / Payload)"

if [[ -f "$APP_PATH/.env" ]]; then
  env_mode=$(grep -E '^NODE_ENV=' "$APP_PATH/.env" | cut -d= -f2 | tr -d '"')
  if [[ "$env_mode" == "production" ]]; then
    pass "NODE_ENV=production"
  else
    fail "NODE_ENV=$env_mode (should be 'production')"
  fi
fi

if [[ -n "$DOMAIN" ]]; then
  code=$(curl -sIk "${curl_opts[@]}" -o /dev/null -w '%{http_code}' "https://$DOMAIN/.next/BUILD_ID")
  if [[ "$code" == "200" ]]; then
    fail "/.next/BUILD_ID is publicly accessible!"
  else
    pass "/.next/ paths not publicly exposed (code $code)"
  fi
fi

# ── 10. Monitoring ─────────────────────────────────────────────────
section "10. Monitoring & Logs"

if systemctl is-enabled "pm2-$APP_NAME" >/dev/null 2>&1; then
  pass "pm2-$APP_NAME autostart enabled"
else
  warn "pm2-$APP_NAME autostart not enabled (or different name)"
fi

if command -v journalctl >/dev/null; then
  failed_ssh=$(journalctl -u ssh --since today 2>/dev/null | grep -cE 'Failed password|Invalid user' || true)
  if [[ "$failed_ssh" -lt 100 ]]; then
    pass "failed SSH attempts today: $failed_ssh"
  else
    warn "failed SSH attempts today: $failed_ssh (high; ensure fail2ban banning is effective)"
  fi
fi

# ── 11. Pre-launch status ──────────────────────────────────────────
section "11. Pre-launch status"

if [[ -n "$DOMAIN" ]]; then
  code_no_auth=$(curl -sIk -o /dev/null -w '%{http_code}' "https://$DOMAIN/")
  if [[ "$code_no_auth" == "401" ]]; then
    warn "site returns 401 without auth — pre-launch gate active"
  elif [[ "$code_no_auth" =~ ^(200|307)$ ]]; then
    pass "site returns $code_no_auth publicly — live"
  else
    fail "site returns unexpected $code_no_auth"
  fi

  if [[ -n "${BASIC_AUTH:-}" ]]; then
    code_with_auth=$(curl -sIk -u "$BASIC_AUTH" -o /dev/null -w '%{http_code}' "https://$DOMAIN/")
    [[ "$code_with_auth" =~ ^(200|307)$ ]] && pass "auth works (code $code_with_auth)"
  fi

  robots=$(curl -sIk "${curl_opts[@]}" "https://$DOMAIN/" | grep -i x-robots || true)
  if echo "$robots" | grep -qi noindex; then
    warn "X-Robots-Tag noindex active — good for pre-launch, remove at go-live"
  fi
fi

# ── 12. Domain & Redirects ─────────────────────────────────────────
section "12. Domain & Redirects"

if [[ -n "$DOMAIN" ]]; then
  http_redir=$(curl -sI "http://$DOMAIN/" 2>/dev/null | head -1)
  if echo "$http_redir" | grep -q 301; then
    pass "HTTP → HTTPS redirect (301)"
  else
    fail "HTTP does not 301 → HTTPS"
  fi
fi

# ── Summary ────────────────────────────────────────────────────────
log ""
log "${B}── Summary ──${N}"
log "  ${G}✓ PASS:${N} $PASS"
log "  ${Y}⚠ WARN:${N} $WARN"
log "  ${R}✗ FAIL:${N} $FAIL"
log ""
log "Full log: $LOG"

if [[ "$FAIL" -gt 0 ]]; then
  exit 1
elif [[ "$WARN" -gt 0 ]]; then
  exit 2
else
  exit 0
fi
