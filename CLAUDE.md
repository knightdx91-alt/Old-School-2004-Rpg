# SYGL — A Magykal RPG: Codebase Guide

## What this game is
A browser-based 3D RPG built with **BabylonJS 6.49.0**, HTML/CSS/JS only. No build system. Based on a fantasy book series by the user. The game is called **Sygl** — players choose a magical "sygl" (sigil) that defines their character class.

## File structure
```
index.html          — single page app, loads all scripts
styles.css          — all CSS including HUD dock system
js/
  babylon-loader.js — CDN fallback loader for BabylonJS
  gamepad-patch.js  — gamepad support
  data.js           — SYGLS data (5 sygl types with stats/spells)
  state.js          — global state, constants (GRID_SIZE=100, TILE_SIZE=2)
  quiz.js           — sygl selection quiz
  world.js          — 3D scene, town layout, buildings, NPCs (~961 lines)
  combat.js         — turn-based combat system
  hud.js            — floating dock HUD, day/night cycle
  main.js           — game loop, save/load, zone transitions
```

## Active branch
`main` — this is the only working branch. Always commit and push to `main`. Never commit to any other branch. Run `git pull origin main` in Codespace to get changes.

## World: New Spring (current zone)
100×100 tile grid, TILE_SIZE=2 (each tile = 2 world units). gridToWorld(gx,gz) = {x: gx*2, z: gz*2}.

**Coordinate system:** lower gz = north (toward zone exit), higher gz = south (toward market). Camera faces +Z so higher gz appears at top of screen.

### Layout (grid coordinates)
- **Zone arch / north boundary:** gz=5, gx=46 and gx=54
- **North road:** gx=49..51, gz=6..48 (cobblestone, torch-lined)
- **Dawn Hall** (adventurers guild, 3 stories): gx=53..65, gz=25..38, door='west'
- **Market Square:** gx=42..62, gz=49..65 (cobblestone)
- **Inn** (2 stories): gx=63..74, gz=49..60, door='west'
- **Blacksmith** (1 story): gx=34..41, gz=49..60, door='east'
- **General Store** (2 stories): gx=43..61, gz=66..73, door='north'
- **house1** (player's house): gx=34..38, gz=35..40, door='south'
- **house2:** gx=34..38, gz=62..67, door='north'
- **house3:** gx=63..67, gz=35..40, door='south'
- **house4:** gx=63..67, gz=62..67, door='north'
- **Market stalls:** (46,53), (50,53), (54,53), (46,58), (50,58), (54,58)
- **Brazier:** gx=52, gz=57 (market square center, sets state.flame + state.brazierLight)

### Player start
gx=36, gz=42 — just outside house1's south door, facing toward market square (rotation.y=0 = faces +z = faces market).

### NPCs (world.npcs array)
- **Soren** (gx=58, gz=31) — Dawn Hall staff, placeholder dialogue
- **Kim** (gx=60, gz=32) — Dawn Hall counter staff, placeholder dialogue
- **vendor1/2/3** — market square vendors, placeholder dialogue

Click NPC → dialogue printed to log. Dialogue cycles through lines array.

## Key systems

### Building system (world._buildBuilding)
Parameters: scene, name, gx, gz, w, d, floors, wallColor, roofColor, doorSide, doorWidth

- Creates floor, 4 walls (with door gap on specified side), flat roof
- Marks perimeter tiles as obstacles in state.obstacles (Set of "gx,gz" strings)
- Door tiles left walkable
- Stores in world.buildings: { name, gxMin, gxMax, gzMin, gzMax, roofMesh }

### Roof transparency
`world.checkRoofTransparency()` called via `world.onPlayerStep()` each tick. If player is strictly inside a building's grid bounds, its roofMesh.isVisible = false.

### Zone transition
At gz ≤ 5 on the north road → logs message, placeholder for Academy zone. Academy is a SEPARATE zone (not yet built).

### HUD dock system (styles.css + hud.js)
Two floating corner docks: chat (left) and menu (right).
- **Portrait mode:** opening one dock hides the other toggle button
- **Landscape mode:** each toggle only hides for its own dock; each dock capped at 50% width
- Menu dock anchors to right via `margin-left: auto`
- Tabs are horizontally scrollable (overflow-x: auto, no scrollbar)
- Toggle buttons: #chat-toggle (left:12px), #menu-toggle (right:12px), both fixed bottom

### Day/night cycle
`updateDayNight()` in hud.js, driven by state.worldClock. Affects sunLight, ambientLight, scene fog, sky color. state.brazierLight dims during day, brightens at night.

### Combat
Turn-based, initiated by clicking enemy or walking adjacent. state.combat object. Combat tab appears in menu dock during combat.

### Save/load
localStorage key: `sygl_save_v1`. Auto-saves every 15s and on quit. Saves player stats + worldClock + hudScale.

## What needs to be done next (user's priorities)
1. **Visual upgrade** — buildings are plain boxes. User wants better visuals. Options discussed:
   - **Option A:** Improve procedural geometry (pitched roofs, windows, chimneys, better NPC models with limbs) — no external assets needed
   - **Option B:** Set up .glb model loader pipeline (Kenney assets) — user would download files
   - User was leaning toward Option A (geometry upgrade) as the immediate next step

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

## Code conventions
- No build system — plain JS, all globals
- state.obstacles = Set of "gx,gz" strings for pathfinding
- BFS pathfinder in world.findPath()
- world.onPlayerStep() called each movement tick — hook for roof transparency + zone transitions
- Mesh names must be unique strings across the whole scene
- All colors via new BABYLON.Color3(r,g,b)
