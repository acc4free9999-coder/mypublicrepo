#!/usr/bin/env bash
# Build the app and package it for IIS on Windows Server (2012 R2+):
#   ./deploy/package-windows.sh      → deploy/gony-bar-replay-iis.zip  (dist + web.config)
# Copy the zip and deploy/iis/install-iis.ps1 to the server, then run the script there.
set -euo pipefail
cd "$(dirname "$0")/.."

OUT="deploy/gony-bar-replay-iis.zip"
npm run build
cp deploy/iis/web.config dist/web.config
rm -f "$OUT"
(cd dist && zip -qr "../$OUT" .)
echo "Created $OUT ($(du -h "$OUT" | cut -f1))"
