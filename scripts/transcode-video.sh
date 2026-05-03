#!/usr/bin/env bash
# Transcode video upload to web-optimized variants.
#
# Input:  $1 = path to original video file (e.g. media/hero.mov)
# Output: <stem>.webm (VP9), <stem>.mp4 (H.264), <stem>-poster.webp
#
# Idempotent: skips outputs that exist and are newer than input.
# Errors are logged to stderr but do not abort other variants.
#
# Wire up from a Media-collection afterChange hook to run on every video
# upload. The Boothside CLAUDE.md has notes on the AV1 phase-2 path if
# bandwidth ever justifies a third variant.

set -uo pipefail

INPUT="${1:-}"
if [[ -z "$INPUT" ]]; then
  echo "transcode-video.sh: missing input file path" >&2
  exit 2
fi
if [[ ! -f "$INPUT" ]]; then
  echo "transcode-video.sh: input file not found: $INPUT" >&2
  exit 2
fi

DIR="$(dirname "$INPUT")"
STEM="$(basename "$INPUT" | sed 's/\.[^.]*$//')"
WEBM="$DIR/$STEM.webm"
MP4="$DIR/$STEM.mp4"
POSTER="$DIR/$STEM-poster.webp"

is_outdated() {
  local out="$1"
  [[ ! -f "$out" ]] && return 0
  [[ "$INPUT" -nt "$out" ]] && return 0
  return 1
}

# Track variant attempts and successes for the final summary.
ATTEMPTED=0
SUCCEEDED=0
FAILED_VARIANTS=()

# Run ffmpeg with proper exit-status propagation through the tail pipe,
# log a clear marker on failure, and update the success/failure counters.
# Args: <variant-label> <ffmpeg arg…>
run_ffmpeg() {
  local label="$1"; shift
  ATTEMPTED=$((ATTEMPTED + 1))
  local status
  ffmpeg "$@" 2>&1 | tail -20
  # PIPESTATUS[0] is ffmpeg's exit code; the tail pipe would otherwise mask it.
  status=${PIPESTATUS[0]}
  if [[ $status -ne 0 ]]; then
    echo "✗ $label encoding failed for $INPUT (ffmpeg exit $status)" >&2
    FAILED_VARIANTS+=("$label")
    return 1
  fi
  SUCCEEDED=$((SUCCEEDED + 1))
  return 0
}

# WebM (VP9 + Opus) — primary modern codec.
# Audio flags chosen to avoid pumping/distortion on phone-recorded sources:
#   -ar 48000        Opus's only native rate; without this swresample
#                    introduces subtle resampling glitches on 44.1kHz input.
#   -ac 2            Stereo upmix — browser decoder paths are better tested
#                    for stereo than mono.
#   -vbr on -compression_level 10 + 128k target
#                    VBR avoids CBR pumping on signal peaks; high
#                    compression level is irrelevant cost-wise (background).
#   -application audio
#                    Overrides Opus auto-detect, which often mis-picks
#                    `voip` on short phone recordings and over-compresses.
# Background: docs/KNOWN-ISSUES.md → "Video-Audio klingt verzerrt / pumpt".
if is_outdated "$WEBM"; then
  echo "→ encoding WebM/VP9: $WEBM"
  run_ffmpeg "WebM/VP9" -y -i "$INPUT" \
    -c:v libvpx-vp9 -crf 32 -b:v 0 -row-mt 1 -tile-columns 2 \
    -c:a libopus -b:a 128k -vbr on -compression_level 10 \
    -ar 48000 -ac 2 -application audio \
    -movflags +faststart \
    "$WEBM" || true
fi

# MP4 (H.264) — fallback for Safari < 14 / older browsers
if is_outdated "$MP4" && [[ "$INPUT" != "$MP4" ]]; then
  echo "→ encoding MP4/H.264: $MP4"
  run_ffmpeg "MP4/H.264" -y -i "$INPUT" \
    -c:v libx264 -preset slow -crf 23 -profile:v high -level 4.1 \
    -c:a aac -b:a 128k \
    -movflags +faststart -pix_fmt yuv420p \
    "$MP4" || true
fi

# Poster frame at 0.5s. Capped at 1200px wide — even a 16:9 hero typically
# renders at <1000px on standard desktop, so 1200w covers retina without
# wasting bytes. Quality 78 instead of 82 — posters only flash for the
# split-second before video plays, perceptual loss is invisible.
if is_outdated "$POSTER"; then
  echo "→ encoding poster: $POSTER"
  run_ffmpeg "poster" -y -ss 0.5 -i "$INPUT" -frames:v 1 \
    -vf "scale='min(1200,iw)':-1" \
    -c:v libwebp -quality 78 \
    "$POSTER" || true
fi

# Final summary — reflect actual variant outcomes, not just script reaching the end.
if [[ $ATTEMPTED -eq 0 ]]; then
  echo "✓ transcode complete: $STEM (no variants needed — outputs up-to-date)"
  exit 0
fi

if [[ ${#FAILED_VARIANTS[@]} -eq 0 ]]; then
  echo "✓ transcode complete: $STEM ($SUCCEEDED/$ATTEMPTED variants)"
  exit 0
fi

if [[ $SUCCEEDED -eq 0 ]]; then
  echo "✗ transcode failed: $STEM (0/$ATTEMPTED variants — failed: ${FAILED_VARIANTS[*]})" >&2
  exit 1
fi

echo "⚠ transcode partial: $STEM ($SUCCEEDED/$ATTEMPTED variants — failed: ${FAILED_VARIANTS[*]})" >&2
exit 1
