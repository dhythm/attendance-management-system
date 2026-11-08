#!/usr/bin/env bash
set -euo pipefail

if ! command -v ffmpeg >/dev/null; then
  echo "ffmpeg が見つからないため、docs/demo/*.webm のまま残します" >&2
  exit 0
fi

for webm in docs/demo/*.webm; do
  ffmpeg -y -loglevel error -i "$webm" -c:v libx264 -crf 28 -preset slow -pix_fmt yuv420p -movflags +faststart "${webm%.webm}.mp4"
  rm "$webm"
  echo "${webm%.webm}.mp4"
done
