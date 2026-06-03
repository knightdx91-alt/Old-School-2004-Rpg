#!/bin/bash
# Deploy Sygl to itch.io via butler
# Usage: BUTLER_API_KEY=your_key ./deploy.sh

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

# Core files
cp index.html styles.css "$BUILD_DIR/"
cp -r js "$BUILD_DIR/"

# Helper: copy a single GLB into the build, mirroring directory structure
copy_glb() {
  local src="$1"
  local dst="$BUILD_DIR/$1"
  mkdir -p "$(dirname "$dst")"
  cp "$src" "$dst"
}

# Polygonal Mind medieval fair props
for f in assets/models/*.glb; do
  [ -f "$f" ] && copy_glb "$f"
done

# Nature kit trees
N="assets/kenney/nature-kit/Models/GLTF format"
for name in tree_default tree_oak tree_fat tree_pineDefaultA tree_small; do
  copy_glb "$N/$name.glb"
done

# Fantasy town kit
F="assets/kenney/fantasy-town-kit/Models/GLB format"
for name in stall stall-green stall-red fountain-round cart lantern; do
  copy_glb "$F/$name.glb"
done

# Graveyard kit
G="assets/kenney/graveyard-kit/Models/GLB format"
for name in lightpost-single fire-basket character-keeper character-skeleton character-zombie character-vampire character-ghost; do
  copy_glb "$G/$name.glb"
done

# Retro fantasy kit
R="assets/kenney/retro-fantasy-kit/Models/GLB format"
for name in detail-barrel detail-crate; do
  copy_glb "$R/$name.glb"
done

# Castle kit
C="assets/kenney/castle-kit/Models/GLB format"
for name in tower-square wall wall-corner wall-doorway flag-banner-long; do
  copy_glb "$C/$name.glb"
done

# Modular buildings
M="assets/kenney/modular-buildings/Models/GLB format"
for name in building-sample-house-a building-sample-house-b building-sample-house-c \
            building-sample-tower-a building-sample-tower-b building-sample-tower-c building-sample-tower-d; do
  copy_glb "$M/$name.glb"
done

echo "==> File count in build: $(find "$BUILD_DIR" | wc -l)"

echo "==> Pushing to itch.io as $ITCH_USER/$ITCH_GAME:$CHANNEL..."
BUTLER=$(command -v butler 2>/dev/null || echo "./butler")
if [ ! -x "$BUTLER" ]; then
  echo "ERROR: butler not found."
  exit 1
fi
"$BUTLER" push "$BUILD_DIR" "$ITCH_USER/$ITCH_GAME:$CHANNEL"

echo "==> Done! Live at https://$ITCH_USER.itch.io/$ITCH_GAME"
