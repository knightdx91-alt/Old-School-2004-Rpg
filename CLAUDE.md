# SYGL — A Magykal RPG: Codebase Guide

## What this game is
A browser-based 3D RPG built with **BabylonJS 6.49.0**, HTML/CSS/JS only. No build system. Based on a fantasy book series by the user. The game is called **Sygl** — players choose a magical "sygl" (sigil) that defines their character class.

## File structure
```
index.html          — single page app, loads all scripts
styles.css          — all CSS including HUD dock system
assets/maps/        — SVG zone maps for reference (imported from Google Drive)
  Game Maps/
    01_new_spring_town.svg
    02_surrounding_countryside.svg
    03_outer_school_grounds.svg
    04_first_floor_interior.svg
js/
  babylon-loader.js — CDN fallback loader for BabylonJS
  gamepad-patch.js  — gamepad support
  data.js           — SYGLS data (5 sygl types with stats/spells)
  state.js          — global state, constants (GRID_SIZE=100, TILE_SIZE=2)
  quiz.js           — sygl selection quiz
  world.js          — 3D scene, town layout, buildings, NPCs
  combat.js         — turn-based combat system, context menu, actions
  hud.js            — floating dock HUD, day/night cycle, minimap, head bubble
  main.js           — game loop, save/load, zone transitions
```

## Active branch
`main` — this is the only working branch. Always commit and push to `main`. Never commit to any other branch. Run `git pull origin main` in Codespace to get changes.

**Push = live.** Every push to `main` auto-deploys (see below), so anything committed and pushed goes live automatically. The working rule for this project: finish a change → commit → push to `main`. Don't leave work uncommitted; pushing is how it reaches players.

## Deploying / Hosting

### Live links
- **GitHub Pages (auto, primary):** https://knightdx91-alt.github.io/Old-School-2004-Rpg/ — free, always-current; republishes on every push to `main`.
- **itch.io (storefront):** https://Knightdx91.itch.io/sygl — channel `Knightdx91/sygl:html5`.

Saves use `localStorage`, which is **per-domain** — progress on the Pages URL and the itch URL are separate stores.

### Auto-deploy (GitHub Actions) — runs on every push to `main`
- `.github/workflows/pages.yml` → builds + publishes to **GitHub Pages**. Reliable; this is the primary auto-deploy.
- `.github/workflows/deploy.yml` → pushes to **itch.io** via butler. Needs the `BUTLER_API_KEY` repo secret (already set). Butler is downloaded from `broth.itch.ovh`; if that CDN is unreachable from the runner the step fails — that's an itch-side outage, not a config problem, and it recovers on its own (the download retries).

Both builds bundle Babylon + loaders locally and ship only runtime assets (`.glb`/`.png`), excluding source-format duplicates (`.zip/.fbx/.obj/.mtl/.stl/.dae`) — ~72M vs ~211M.

**One-time settings that make Pages work** (already configured — don't undo): Settings → Pages → **Source = GitHub Actions**; Settings → Actions → General → **Workflow permissions = Read and write**.

### Manual itch deploy (fallback)
Butler is installed in the Codespace. To deploy by hand from the repo root:
```bash
BUTLER_API_KEY=your_key_here ./deploy.sh
```
Replace `your_key_here` with your itch.io API key (itch.io → Account Settings → API keys). Do **not** run `butler login` — it hangs waiting for browser auth; the `BUTLER_API_KEY` env var bypasses that. The script builds the game into `build/` and pushes it to `Knightdx91/sygl:html5` automatically.

## World: New Spring (current zone)
100×100 tile grid, TILE_SIZE=2 (each tile = 2 world units). gridToWorld(gx,gz) = {x: gx*2, z: gz*2}.

**Coordinate system:** lower gz = north (toward zone exit), higher gz = south (toward market). Camera faces +Z so higher gz appears at top of screen.

### Layout (grid coordinates) — based on assets/maps/Game Maps/01_new_spring_town.svg
- **Town walls:** N wall gz=27, S wall gz=73, W wall gx=22, E wall gx=78 — crenellated stone
- **Gates:** N gate gx=47-53/gz=27, S gate gx=47-53/gz=73, W gate gx=22/gz=47-53, E gate gx=78/gz=47-53
- **Corner towers:** at (22,27), (78,27), (22,73), (78,73)
- **N-S road:** gx=47-53, full height (dirt outside walls, cobblestone inside)
- **E-W road:** gz=47-53, full width (same)
- **Town Square:** gx=43-57, gz=43-57 (cobblestone) with fountain at gx=50, gz=50
- **Dawn Hall** (guild/job board, 3 floors): gx=28-40, gz=29-40, door='south'
- **Inn & Tavern** (2 floors): gx=60-72, gz=29-40, door='south'
- **Enchanted Weapons** (1 floor, purple): gx=24-33, gz=55-63, door='east'
- **Jeweler** (1 floor, red): gx=24-32, gz=65-71, door='east'
- **Apothecary** (1 floor, green): gx=34-42, gz=65-71, door='east'
- **Familiar Supplies** (1 floor, blue): gx=66-75, gz=55-63, door='west'
- **Restaurant** (1 floor, amber): gx=60-67, gz=65-71, door='west'
- **Tea House** (1 floor, amber): gx=68-75, gz=65-71, door='west'
- **Market stalls:** (44,43), (56,43), (44,57), (56,57)
- **Brazier:** gx=50, gz=55 (south of fountain, sets state.flame + state.brazierLight)
- **Farmland:** NW (gx=2-20, gz=2-25) and NE (gx=80-98, gz=2-25) — striped field texture
- **Orchards:** SW (gx=3-19, gz=76-96) and SE (gx=81-97, gz=76-96) — organized apple trees
- **West Wood:** scattered trees gx=3-9, gz=41-68
- **South Pine Wood:** trees gx=5-31, gz=79-81
- **Hollow Wood:** trees gx=82-91, gz=66-73

### Zone exits (from onPlayerStep)
- gz≤5 + gx=47-53 → Sygldry Academy (north)
- gz≥95 + gx=47-53 → The Heir's School (south)
- gx≤5 + gz=47-53 → Open countryside (west)
- gx≥95 + gz=47-53 → Whitehaven (east)

### Player start
gx=34, gz=43 — just south of Dawn Hall door, facing the town square.

### NPCs (world.npcs array)
- **Soren** (gx=33, gz=36) — Dawn Hall staff, placeholder dialogue
- **Kim** (gx=36, gz=37) — Dawn Hall counter staff, placeholder dialogue
- **vendor1** (gx=44, gz=44), **vendor2** (gx=50, gz=44), **vendor3** (gx=56, gz=44) — market square vendors

Click NPC → dialogue printed to log. Dialogue cycles through lines array.

## Key systems

### Building system (world._buildBuilding)
Parameters: scene, name, gx, gz, w, d, floors, wallColor, roofColor, doorSide, doorWidth

- Creates floor, 4 walls (with door gap on specified side), pitched gabled roof, timber framing, windows
- Marks perimeter tiles as obstacles in state.obstacles (Set of "gx,gz" strings)
- Door tiles left walkable
- Stores in world.buildings: { name, gxMin, gxMax, gzMin, gzMax, roofMeshes[] }

### Roof transparency
`world.checkRoofTransparency()` called via `world.onPlayerStep()` each tick. If player is strictly inside a building's grid bounds, all meshes in `roofMeshes[]` are hidden (includes pitched roof, ridge, chimney).

### Zone transition
At gz ≤ 5 on the north road → logs message, placeholder for Academy zone. Academy is a SEPARATE zone (not yet built).

### HUD dock system (styles.css + hud.js)
Two floating corner docks: chat (left) and menu (right).
- **Portrait mode:** opening one dock hides the other toggle button
- **Landscape mode:** each toggle only hides for its own dock; each dock capped at 50% width
- Menu dock anchors to right via `margin-left: auto`
- Tabs are horizontally scrollable (overflow-x: auto, no scrollbar)
- Toggle buttons: #chat-toggle (left:12px), #menu-toggle (right:12px), both fixed bottom
- Save/Quit buttons removed from topbar — live in Options tab of menu dock

### Minimap (hud.js)
Circular 120px canvas in top-right corner (`#minimap-zone`). Draws obstacles (brown), NPCs (blue), enemies (red), player (white dot) within 20-tile radius. Redraws every 200ms via `hud.drawMinimap()`.

### Run toggle (hud.js + main.js)
Button below minimap. Toggles `state.running`. Running moves 2 tiles per tick (RS2004 style), drains `state.runEnergy` at 1.5%/step, recovers at 0.4%/tick while standing. Button shows energy % and turns green when active.

### Long-press context menu (world.js + combat.js)
500ms hold triggers `world.handleLongPress()` (desktop right-click does the same). Shows options based on target:
- NPC → Talk, Examine, Close
- Enemy → Attack, Examine, Close
- Ground → Examine, Close
Regular tap still auto-interacts (walk/talk/attack).

### Head bubble (hud.js)
Chat text typed in the chat box appears above the player's head in yellow, anchored via `BABYLON.Vector3.Project()` each frame. Fades after 4s. `hud.showHeadBubble(text)`, updated each frame by `hud.updateBubblePos()`.

### Day/night cycle
`updateDayNight()` in hud.js, driven by state.worldClock. Affects sunLight, ambientLight, scene fog, sky color. state.brazierLight dims during day, brightens at night.

### Combat
Turn-based, initiated by clicking enemy or walking adjacent. state.combat object. Combat tab appears in menu dock during combat.

### Save/load
localStorage key: `sygl_save_v1`. Auto-saves every 15s and on quit. Saves player stats + worldClock + hudScale.

## Next coding session — start here (CRITICAL FIXES FIRST)

### 1. Fix buildings, stalls, and props not showing — GLB approach is broken, revert to procedural
The `placeBuilding` helper in `_buildNewSpring` loads modular-building GLBs asynchronously — they are not showing up. The Kenney stall GLBs (stall-green, stall-red), fountain, barrels, carts, lantern, and fire-basket are also not appearing. The entire `_loadProp` / async GLB approach for scene props is unreliable in this setup.

**Fix:** Revert everything to procedural meshes:
- Remove the `placeBuilding` helper entirely. Call `world._buildBuilding` directly for all 8 buildings with proper colours: dawnHall=amber, inn=wood, enchantedWeapons=purple, jeweler=red, apothecary=green, familiarSupplies=blue, restaurant=amber, teaHouse=amber.
- Remove the `glbReplaced` option from `_buildBuilding` — no longer needed.
- Replace the Kenney stall GLBs with the existing procedural `_buildStall` helper (already in world.js — just call it for the 4 stall positions).
- Replace the fountain GLB with a procedural fountain (cylinder basin + sphere top, water material).
- Replace fire-basket GLB with the old procedural brazier (box + emissive flame cone).
- Replace lightpost GLBs with the old procedural torch (thin cylinder + emissive flame orb + PointLight).
- Replace corner tower GLBs with procedural stone towers (stacked cylinders or boxes, wallStoneMat).
- Keep barrels/carts/lantern as GLBs only if they load reliably — otherwise replace with simple box primitives.

**Exception — town walls and corner towers CAN use castle-kit GLBs via cloning:**
The castle-kit has modular pieces (`wall.glb`, `wall-corner.glb`, `wall-doorway.glb`, `gate.glb`, `tower-square-base/mid/roof.glb`, `flag-banner-long.glb`) that are designed to be tiled. Load each unique GLB **once** with `ImportMeshAsync`, then call `.clone()` for every repeated placement — clones are instant since geometry is already in memory. This avoids the async timing problem that broke the building GLBs. Suggested approach:
1. Load `wall.glb` once → clone it for every wall segment tile around the perimeter
2. Stack `tower-square-base` + `tower-square-mid` + `tower-square-roof` clones at each corner
3. Place `gate.glb` / `wall-doorway.glb` clones at the 4 gate openings
4. Add `flag-banner-long.glb` clones on the corner towers
This would make the town walls look significantly better with minimal code change.

### 2. Fix player model — revert to procedural capsule
`buildPlayerMesh()` uses `character-keeper.glb` which looks wrong. Revert to the procedural capsule (simple coloured cylinder+sphere with an accent-coloured orb). The GLB character is not the right look for the game right now.

### 3. Fix NPC models — revert to procedural boxes
`_spawnNPC()` uses `character-keeper.glb` which looks wrong. Revert to the procedural robed figure (body box + head sphere + colour from `robeColor` param). Keep the `metadata: { npcId }` tagging for click detection.

### 4. Fix ground flicker + upgrade ground textures
The ground plane and road planes at y=0/0.01/0.013/0.014 are z-fighting. Consolidate: set the main grass ground to y=0, dirt roads to y=0.02, cobblestone roads/square to y=0.03, farmland to y=0.02. Each layer must be clearly separated to stop flicker.

**Also upgrade ground textures using existing assets:**
- Roads and town square: replace the dynamic canvas cobblestone with `assets/kenney/retro-fantasy-kit/Models/GLB format/Textures/cobblestone.png` — load as `BABYLON.Texture` and tile it (uScale/vScale ~8). Use `cobblestoneAlternative.png` for the E-W road to vary it.
- Water (fountain basin, future river): use `retro-fantasy-kit/Textures/water.png`
- Scatter survival-kit ground detail props across the countryside for RS2004-style terrain variation:
  - `patch-grass.glb` and `grass-large.glb` — random grass tufts on the open terrain
  - `rock-flat.glb` and `rock-flat-grass.glb` — flat rocks scattered outside the walls
  - `rock-a/b/c.glb` — larger rocks near the tree lines
  - Load these via the clone approach (load once, clone for each placement)

### 5. Wolf enemy (after fixes above)
Spawn near market square (gx=52, gz=45). Wolf mesh from primitives (body, 4 legs, head, snout, ears, tail — grey-brown). Chase AI: pursues player if within 8 tiles, auto-starts combat at distance 1. Flee by walking. Combat ends if distance > 12 ("You escaped") or wolf/player dies. Respawns after 60s.

## What needs to be done next (user's priorities)
1. **Visual upgrade** — fix procedural buildings first (see critical fixes above), then improve them with pitched roofs, timber framing, windows, chimneys (already coded in `_addPitchedRoof`, `_addTimberFraming`, `_addWindows` — just need buildings back to call them)

2. **Academy zone** — second zone, reached via north road. Separate scene load. Sygldry Academy building, grounds, courtyards. Training dummy enemy should move here.

3. **Quest system** — Dawn Hall job board, NPCs post quests, player can take/complete them

4. **Inventory + shop system** — vendor NPCs currently have placeholder dialogue

5. **Better NPC dialogue** — proper dialogue box UI instead of just logging to chat

6. **Companion / party system** — single companion recruited from Dawn Hall. Follows player, auto-fights in combat, has personality dialogue that reacts to events. Start simple (one companion, follow AI, auto-combat), then expand to party inventory and player-directed orders (Attack/Defend/Cast) once inventory system exists. Designed for solo players who don't want multiplayer.

7. **Profession system (WoW-style)** — Secondary skills learned from profession trainers at Dawn Hall, separate from and stackable with the player's sygl. Players can learn 1-2 professions. When the game starts, two professions are *suggested* (not forced) based on the player's chosen sygl — e.g. a Fire sygl might be nudged toward Runesmith and Blade-for-Hire, a Nature sygl toward Herbalist and Alchemist. Professions have skill tiers: Apprentice → Journeyman → Expert → Master, leveled through use not just gold.
   - **Planned professions:** Alchemist (brew potions from herbs), Runesmith (craft sygl-infused gear), Scholar (identify items, translate texts for quests), Herbalist (gather ingredients in the world), Blade-for-Hire (combat perks, ties into Dawn Faction jobs)
   - **Synergies:** Herbalist feeds Alchemist; Alchemist potions usable from hotbar in combat; Runesmith gear feeds into equip system
   - **Dependencies:** Requires inventory system (#4), shop system (#4), and NPC dialogue UI (#5) to be built first. Profession tab added to menu dock once implemented.

## Lore context
- Game: Sygl — based on user's book series
- Town: **New Spring** (starting town)
- Guild: **Dawn Faction** — warm, lived-in adventurers guild. Amber/gold colors, rising sun motif. Staff: Soren, Kim. Members get wooden cards, pay monthly dues, take posted jobs.
- Academy: **Sygldry Academy** — north of New Spring, separate zone
- 5 Sygls (magic types): each tied to an "Originator" — defines player stats, spell, and accent color

## Asset & library ideas (future sessions)

### Audio
- **Kenney sound packs** — RPG audio, UI sounds, ambient town noise. Free, direct zip download from kenney.nl same as other packs.
- **Howler.js** (CDN) — standard browser audio library. Handles positional audio, looping, format fallbacks. One `<script>` tag, no build needed.

### Character animations
- **Mixamo** (Adobe, free) — upload the Kenney FBX character model, download idle/walk/run/attack animations as FBX, convert to GLB. No CLI download — manual export from the Mixamo website.
- The animated-characters-protagonists and animated-characters-survivors packs already downloaded have `idle.fbx`, `run.fbx`, `jump.fbx` — could be converted to GLB and wired up in BabylonJS.

### JS libraries (CDN drop-in, no build needed)
- **nipplejs** — virtual joystick for mobile. Much better than tap-to-move for RPG feel. One script tag.
- **animejs** — lightweight tweening for UI animations (health bar drops, damage numbers floating up, etc.).

### UI packs to download BEFORE next session (user action required)
Download these from kenney.nl and unzip into `assets/kenney/` the same way as the other packs:
1. **kenney.nl/assets/ui-pack-rpg-expansion** — RPG-specific: health/mana orbs, hotbar slots, inventory grid, skill icons, potion icons. This is the one closest to the OSRS UI style.
2. **kenney.nl/assets/ui-pack** — base UI pack: buttons, panels, scrollbars, window frames. Needed alongside the RPG expansion.
3. **kenney.nl/assets/game-icons** — 1000+ RPG icons (swords, shields, potions, spells) in a consistent style. Free, CC0.

These are needed before building the inventory system, hotbar, and skill/spell icons.

### More Kenney packs worth grabbing
- **Kenney RPG audio** — footsteps, sword hits, magic sounds, ambient town noise. Download from kenney.nl same as other packs.

### 3D asset sources
- **assets/kenney/** — already downloaded: fantasy-town-kit, nature-kit, castle-kit, retro-fantasy-kit, graveyard-kit, modular-buildings, animated characters, and more. Use `_loadProp(scene, filename, gx, gz, { basePath, scale, ry })` to place any GLB from these packs.
- GLB files are in subfolders like `assets/kenney/<pack>/Models/GLB format/<name>.glb`

## Code conventions
- No build system — plain JS, all globals
- state.obstacles = Set of "gx,gz" strings for pathfinding
- BFS pathfinder in world.findPath()
- world.onPlayerStep() called each movement tick — hook for roof transparency + zone transitions
- Mesh names must be unique strings across the whole scene
- All colors via new BABYLON.Color3(r,g,b)
