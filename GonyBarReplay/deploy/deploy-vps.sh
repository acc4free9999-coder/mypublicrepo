#!/usr/bin/env bash
# Build locally and upload the static site to a VPS served by host Nginx.
#   VPS=user@1.2.3.4 ./deploy/deploy-vps.sh              # uploads to /var/www/gony-bar-replay
#   VPS=user@host REMOTE_DIR=/srv/gony ./deploy/deploy-vps.sh
# The remote user needs write access to REMOTE_DIR (e.g. sudo chown -R $USER /var/www/gony-bar-replay).
set -euo pipefail
cd "$(dirname "$0")/.."

: "${VPS:?Set VPS=user@host}"
REMOTE_DIR="${REMOTE_DIR:-/var/www/gony-bar-replay}"
SSH_PORT="${SSH_PORT:-22}"

npm run build
ssh -p "$SSH_PORT" "$VPS" "mkdir -p '$REMOTE_DIR'"
rsync -az --delete -e "ssh -p $SSH_PORT" dist/ "$VPS:$REMOTE_DIR/"
echo "Deployed to $VPS:$REMOTE_DIR"
