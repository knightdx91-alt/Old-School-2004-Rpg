#!/bin/bash
# Deploy Sygl to itch.io via butler
# Usage: ./deploy.sh
# Requires: butler installed and logged in (butler login)

set -e

ITCH_USER="Knightdx91"
ITCH_GAME="sygl"
CHANNEL="html5"
BUILD_DIR="build"

echo "==> Checking for local babylon.js..."
if [ ! -f "js/babylon.js" ]; then
  echo "    babylon.js not found — downloading..."
  curl -L -o js/babylon.js "https://cdn.jsdelivr.net/npm/babylonjs@6.49.0/babylon.min.js"
  echo "    Done."
fi

echo "==> Building..."
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"
cp index.html styles.css "$BUILD_DIR/"
cp -r js assets "$BUILD_DIR/"

echo "==> Pushing to itch.io as $ITCH_USER/$ITCH_GAME:$CHANNEL..."
# Look for butler in PATH, then current directory, then repo root
BUTLER=$(command -v butler 2>/dev/null || echo "./butler")
if [ ! -x "$BUTLER" ]; then
  echo "ERROR: butler not found. Download it from https://itchio.itch.io/butler"
  exit 1
fi
"$BUTLER" push "$BUILD_DIR" "$ITCH_USER/$ITCH_GAME:$CHANNEL"

echo "==> Done! Live at https://$ITCH_USER.itch.io/$ITCH_GAME"
