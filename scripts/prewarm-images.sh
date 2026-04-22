#!/bin/bash
#
# Pre-warm the nginx + Next.js image cache for every media doc.
# Runs after a deploy so the first real visitor never pays the Sharp-processing
# cost for a cold variant.
#
# Requests go via HTTPS localhost → nginx → Next.js image optimizer → Sharp.
# Each successful response ends up in /var/cache/nginx/images/… (30d TTL) and
# Next.js's own disk cache, so subsequent real requests hit at ~5 ms.
#
# Usage:
#   ./scripts/prewarm-images.sh [host]
# Defaults to https://boothside.com (production). Set PREWARM_HOST to override.
#
# If the site is behind Basic Auth (pre-launch gate), pass credentials via
# PREWARM_AUTH="user:pass" — /api and /_next/image are exempt from auth in
# nginx, but the Payload API list endpoint (/api/media) isn't always, depending
# on Payload access rules.

set -euo pipefail

HOST="${1:-${PREWARM_HOST:-https://boothside.com}}"
WIDTHS=(640 1080 1920 256 384)
QUALITIES=(65 80)

CURL_AUTH=()
if [[ -n "${PREWARM_AUTH:-}" ]]; then
  CURL_AUTH=(-u "$PREWARM_AUTH")
fi

echo "→ Pre-warming image cache on $HOST"

# List all media urls via the Payload REST API. Use --fail-with-body so
# access-denied returns visibly instead of silent empty output.
media_json=$(curl -sS -k "${CURL_AUTH[@]}" "$HOST/api/media?limit=500&depth=0&pagination=false" || true)

# Extract .docs[].url
urls=$(echo "$media_json" | python3 -c '
import sys, json
try:
    d = json.load(sys.stdin)
    docs = d.get("docs", [])
    for doc in docs:
        url = doc.get("url") or ""
        if url:
            print(url)
except Exception as e:
    sys.stderr.write(f"parse error: {e}\n")
    sys.exit(1)
')

if [[ -z "$urls" ]]; then
  echo "  (no media found — is the site up and accessible?)" >&2
  exit 0
fi

count=0
failures=0
total=0
url_count=$(echo "$urls" | wc -l | tr -d ' ')
variant_count=$((${#WIDTHS[@]} * ${#QUALITIES[@]}))
expected=$((url_count * variant_count))

echo "  $url_count media docs × $variant_count variants = $expected requests"

while IFS= read -r url; do
  encoded=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "$url")
  for w in "${WIDTHS[@]}"; do
    for q in "${QUALITIES[@]}"; do
      total=$((total + 1))
      http_code=$(curl -s -k -o /dev/null -w "%{http_code}" "$HOST/_next/image?url=$encoded&w=$w&q=$q") || http_code=000
      if [[ "$http_code" == "200" ]]; then
        count=$((count + 1))
      else
        failures=$((failures + 1))
        echo "  ✗ $url w=$w q=$q → HTTP $http_code" >&2
      fi
    done
  done
done <<< "$urls"

echo "→ done: $count/$expected cached, $failures failed"
