#!/usr/bin/env bash
#
# Regenerate WebP poster frames for every video in the media dir.
# Only the poster file is touched — existing .webm/.mp4 transcodes are kept
# (transcode-video.sh's is_outdated check skips them when newer than input).
#
# Use this after changing the poster encoding settings in transcode-video.sh
# (resolution cap, quality, etc.) so existing posters pick up the new config.
# New uploads going forward generate the new format automatically via the
# afterChange hook.
#
# Idempotent — re-running just regenerates again.
#
# NOTE on CDN cache: re-generated files keep the same URL → Bunny / your CDN
# serves the cached old version until TTL. Purge `*-poster.webp` paths in the
# CDN dashboard (or via Purge API) after running this script.

set -euo pipefail

MEDIA_DIR="${MEDIA_DIR:-media}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TRANSCODE="$SCRIPT_DIR/transcode-video.sh"

if [ ! -x "$TRANSCODE" ]; then
  echo "ERROR: $TRANSCODE not found or not executable" >&2
  exit 1
fi

count=0
for video in "$MEDIA_DIR"/*.mp4 "$MEDIA_DIR"/*.mov "$MEDIA_DIR"/*.webm; do
  [ -f "$video" ] || continue

  stem=$(basename "$video" | sed 's/\.[^.]*$//')
  poster="$MEDIA_DIR/$stem-poster.webp"

  # Heuristic: only regenerate if a poster already exists. That way we skip
  # files that aren't original uploads (e.g. a foo.mp4 transcoded from foo.mov
  # — only foo would have a poster, and the .mp4/.webm wouldn't).
  if [ -f "$poster" ]; then
    echo "→ Regenerating poster for $stem"
    rm "$poster"
    "$TRANSCODE" "$video"
    count=$((count + 1))
  fi
done

echo
echo "✓ Regenerated $count video poster(s)"
