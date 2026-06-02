/* ================================================================
   BABYLON SCENE
   ================================================================ */
const world = {
  build() {
    if (typeof BABYLON === 'undefined') {
      // Babylon hasn't finished loading yet — poll until it does, or fail loudly.
      let waited = 0;
      const poll = setInterval(() => {
        waited += 200;
        if (typeof BABYLON !== 'undefined') {
          clearInterval(poll);
          world.build();
        } else if (waited > 15000) {
          clearInterval(poll);
          log('Babylon.js failed to load. Check console for CDN errors and refresh.', 'system');
          alert('The 3D engine (Babylon.js) could not be loaded from any CDN. Check your internet connection or ad blocker settings, then refresh the page.');
        }
      }, 200);
      log('Loading 3D engine...', 'system');
      return;
    }
    const canvas = document.getElementById('render-canvas');
    state.engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: false, stencil: true });
    const scene = new BABYLON.Scene(state.engine);
    state.scene = scene;
    scene.clearColor = new BABYLON.Color4(0.04, 0.03, 0.02, 1);
    scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
    scene.fogDensity = 0.012;
    scene.fogColor = new BABYLON.Color3(0.08, 0.06, 0.05);

    // Camera — orbital, follows player. One-finger drag (or left-click drag) rotates;
    // pinch-zoom on touch and wheel on mouse. upperBetaLimit kept well above horizon.
    const cam = new BABYLON.ArcRotateCamera('cam', -Math.PI / 2, Math.PI / 3.2, 22, BABYLON.Vector3.Zero(), scene);
    cam.lowerRadiusLimit = 8;
    cam.upperRadiusLimit = 36;
    cam.lowerBetaLimit = 0.35;          // can't go directly overhead
    cam.upperBetaLimit = Math.PI / 2.4;  // stop well above horizon (~75°) so we never see beneath ground
    cam.wheelPrecision = 30;
    cam.pinchPrecision = 60;             // touch pinch zoom sensitivity
    cam.panningSensibility = 0;          // no two-finger pan
    cam.useNaturalPinchZoom = true;
    cam.attachControl(canvas, true);
    // Left-click / one-finger drag rotates. Right-click is reserved for context menu.
    if (cam.inputs.attached.pointers) {
      cam.inputs.attached.pointers.buttons = [0];
    }
    state.camera = cam;

    // Lights
    state.ambientLight = new BABYLON.HemisphericLight('amb', new BABYLON.Vector3(0, 1, 0), scene);
    state.ambientLight.intensity = 0.45;
    state.ambientLight.groundColor = new BABYLON.Color3(0.15, 0.12, 0.1);
    state.ambientLight.diffuse = new BABYLON.Color3(0.95, 0.88, 0.7);

    state.sunLight = new BABYLON.DirectionalLight('sun', new BABYLON.Vector3(-0.5, -1, -0.4), scene);
    state.sunLight.intensity = 0.85;
    state.sunLight.diffuse = new BABYLON.Color3(1.0, 0.9, 0.7);

    // Ground
    const groundMat = new BABYLON.StandardMaterial('groundMat', scene);
    groundMat.diffuseColor = new BABYLON.Color3(0.22, 0.28, 0.14);
    groundMat.specularColor = new BABYLON.Color3(0.03, 0.03, 0.03);
    const ground = BABYLON.MeshBuilder.CreateGround('ground', { width: GRID_SIZE * TILE_SIZE, height: GRID_SIZE * TILE_SIZE, subdivisions: GRID_SIZE }, scene);
    ground.material = groundMat;
    ground.position.x = (GRID_SIZE * TILE_SIZE) / 2 - TILE_SIZE / 2;
    ground.position.z = (GRID_SIZE * TILE_SIZE) / 2 - TILE_SIZE / 2;
    ground.position.y = 0;
    ground.receiveShadows = true;

    // Path/stone plaza in center
    const plazaMat = new BABYLON.StandardMaterial('plazaMat', scene);
    plazaMat.diffuseColor = new BABYLON.Color3(0.36, 0.31, 0.24);
    plazaMat.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05);
    const plaza = BABYLON.MeshBuilder.CreateGround('plaza', { width: 8, height: 8 }, scene);
    plaza.material = plazaMat;
    plaza.position = new BABYLON.Vector3((GRID_SIZE * TILE_SIZE) / 2 - TILE_SIZE / 2, 0.01, (GRID_SIZE * TILE_SIZE) / 2 - TILE_SIZE / 2);

    // Trees around perimeter (also acts as obstacles)
    state.obstacles.clear();
    const treeMat = new BABYLON.StandardMaterial('treeMat', scene);
    treeMat.diffuseColor = new BABYLON.Color3(0.08, 0.18, 0.06);
    treeMat.specularColor = new BABYLON.Color3(0, 0, 0);
    const trunkMat = new BABYLON.StandardMaterial('trunkMat', scene);
    trunkMat.diffuseColor = new BABYLON.Color3(0.18, 0.11, 0.05);
    trunkMat.specularColor = new BABYLON.Color3(0, 0, 0);

    const placeTree = (gx, gz) => {
      const key = `${gx},${gz}`;
      if (state.obstacles.has(key)) return;
      state.obstacles.add(key);
      const wp = world.gridToWorld(gx, gz);
      const trunk = BABYLON.MeshBuilder.CreateCylinder(`tr_${gx}_${gz}`, { height: 1.4, diameterTop: 0.35, diameterBottom: 0.5 }, scene);
      trunk.material = trunkMat;
      trunk.position = new BABYLON.Vector3(wp.x, 0.7, wp.z);
      const canopy = BABYLON.MeshBuilder.CreateSphere(`tc_${gx}_${gz}`, { diameter: 2.6, segments: 6 }, scene);
      canopy.material = treeMat;
      canopy.position = new BABYLON.Vector3(wp.x, 2.0, wp.z);
      canopy.scaling.y = 1.3;
    };

    // Border ring of trees, plus some scattered
    for (let i = 0; i < GRID_SIZE; i++) {
      placeTree(0, i);
      placeTree(GRID_SIZE - 1, i);
      placeTree(i, 0);
      placeTree(i, GRID_SIZE - 1);
    }
    // Cluster of inner trees (cover, not blocking center plaza)
    [[3,3],[4,3],[3,4],[16,4],[16,5],[15,16],[16,16],[4,16],[3,15]].forEach(([x,z]) => placeTree(x,z));

    // Stone pillars marking the plaza corners
    const pillarMat = new BABYLON.StandardMaterial('pillarMat', scene);
    pillarMat.diffuseColor = new BABYLON.Color3(0.45, 0.4, 0.32);
    [[8,8],[11,8],[8,11],[11,11]].forEach(([gx,gz]) => {
      const wp = world.gridToWorld(gx, gz);
      const p = BABYLON.MeshBuilder.CreateCylinder(`pl_${gx}_${gz}`, { height: 2.4, diameter: 0.45 }, scene);
      p.material = pillarMat;
      p.position = new BABYLON.Vector3(wp.x, 1.2, wp.z);
      state.obstacles.add(`${gx},${gz}`);
    });

    // Brazier (decorative flame) in plaza center for night
    const brazierMat = new BABYLON.StandardMaterial('brazMat', scene);
    brazierMat.diffuseColor = new BABYLON.Color3(0.25, 0.15, 0.08);
    const brazier = BABYLON.MeshBuilder.CreateCylinder('brazier', { height: 1.0, diameterTop: 0.7, diameterBottom: 0.4 }, scene);
    brazier.material = brazierMat;
    const cp = world.gridToWorld(9, 9);
    brazier.position = new BABYLON.Vector3(cp.x + TILE_SIZE/2, 0.5, cp.z + TILE_SIZE/2);
    const flameMat = new BABYLON.StandardMaterial('flameMat', scene);
    flameMat.emissiveColor = new BABYLON.Color3(1, 0.6, 0.2);
    flameMat.diffuseColor = new BABYLON.Color3(1, 0.5, 0.1);
    const flame = BABYLON.MeshBuilder.CreateSphere('flame', { diameter: 0.5 }, scene);
    flame.material = flameMat;
    flame.position = new BABYLON.Vector3(cp.x + TILE_SIZE/2, 1.1, cp.z + TILE_SIZE/2);
    state.flame = flame;
    const brazierLight = new BABYLON.PointLight('brzL', flame.position.clone(), scene);
    brazierLight.diffuse = new BABYLON.Color3(1, 0.55, 0.2);
    brazierLight.intensity = 0;
    brazierLight.range = 10;
    state.brazierLight = brazierLight;

    // Tile click marker (decal-ish)
    const markerMat = new BABYLON.StandardMaterial('markerMat', scene);
    markerMat.emissiveColor = new BABYLON.Color3(0.83, 0.66, 0.28);
    markerMat.diffuseColor = new BABYLON.Color3(0.83, 0.66, 0.28);
    markerMat.alpha = 0.5;
    const marker = BABYLON.MeshBuilder.CreateDisc('marker', { radius: 0.7, tessellation: 24 }, scene);
    marker.material = markerMat;
    marker.rotation.x = Math.PI / 2;
    marker.position.y = 0.05;
    marker.isVisible = false;
    state.targetMarker = marker;

    // Player mesh
    world.buildPlayerMesh();

    // Training dummy enemy
    world.spawnEnemy({
      id: 'dummy1', type: 'Training Dummy',
      gx: 13, gz: 10,
      hp: 25, hpMax: 25, atk: 2, def: 1, acc: 50, xp: 35
    });

    // Render loop
    state.engine.runRenderLoop(() => {
      if (state.scene && state.ready) {
        // camera follow player
        if (state.playerMesh) {
          const target = state.playerMesh.position;
          cam.target = BABYLON.Vector3.Lerp(cam.target, target, 0.1);
        }
        // flame flicker
        if (state.flame) {
          const t = performance.now() * 0.005;
          state.flame.scaling.y = 1 + Math.sin(t) * 0.15;
          state.flame.scaling.x = 1 + Math.sin(t * 1.3) * 0.1;
        }
        // enemy HP bar billboards face camera (handled by Billboard mode set on mesh creation)
        state.scene.render();
      }
    });

    // Snap camera to player and set initial day lighting BEFORE first render
    if (state.playerMesh) {
      cam.target = state.playerMesh.position.clone();
    }
    updateDayNight();

    window.addEventListener('resize', () => state.engine.resize());

    // Click vs drag detection — both touch and mouse.
    // Tap (release without much movement, quick) = game click. Drag = camera (Babylon handled it).
    let downX = 0, downY = 0, downTime = 0, downButton = 0, downId = null;
    const TAP_MOVE_MAX = 10;     // pixels
    const TAP_TIME_MAX = 350;    // ms

    canvas.addEventListener('pointerdown', (ev) => {
      // Right-click goes straight to the context menu — no rotation.
      if (ev.button === 2) {
        world.handleRightClick(ev);
        ev.preventDefault();
        return;
      }
      downX = ev.clientX; downY = ev.clientY;
      downTime = performance.now();
      downButton = ev.button;
      downId = ev.pointerId;
    });

    canvas.addEventListener('pointerup', (ev) => {
      if (ev.pointerId !== downId) return;
      const dx = ev.clientX - downX;
      const dy = ev.clientY - downY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const dt = performance.now() - downTime;
      downId = null;
      if (dist < TAP_MOVE_MAX && dt < TAP_TIME_MAX) {
        // It was a tap — treat as a left-click for game logic.
        world.handleTap(ev);
      }
      // Otherwise camera already rotated; do nothing.
    });

    canvas.addEventListener('contextmenu', e => e.preventDefault());
  },

  buildPlayerMesh() {
    const scene = state.scene;
    const accent = SYGLS[state.player.sygl].accentRGB;
    const accentColor = new BABYLON.Color3(accent[0]/255, accent[1]/255, accent[2]/255);

    const root = new BABYLON.TransformNode('playerRoot', scene);
    // Robe (cylinder)
    const robeMat = new BABYLON.StandardMaterial('robeMat', scene);
    robeMat.diffuseColor = new BABYLON.Color3(0.1, 0.08, 0.06);
    robeMat.specularColor = new BABYLON.Color3(0, 0, 0);
    const robe = BABYLON.MeshBuilder.CreateCylinder('robe', { height: 1.3, diameterTop: 0.55, diameterBottom: 0.85 }, scene);
    robe.material = robeMat;
    robe.position.y = 0.65;
    robe.parent = root;

    // Trim (sygl-colored ring)
    const trimMat = new BABYLON.StandardMaterial('trimMat', scene);
    trimMat.diffuseColor = accentColor;
    trimMat.emissiveColor = accentColor.scale(0.3);
    const trim = BABYLON.MeshBuilder.CreateTorus('trim', { diameter: 0.85, thickness: 0.06 }, scene);
    trim.material = trimMat;
    trim.position.y = 0.05;
    trim.parent = root;

    // Head
    const headMat = new BABYLON.StandardMaterial('headMat', scene);
    headMat.diffuseColor = new BABYLON.Color3(0.85, 0.7, 0.55);
    const head = BABYLON.MeshBuilder.CreateSphere('head', { diameter: 0.42, segments: 12 }, scene);
    head.material = headMat;
    head.position.y = 1.55;
    head.parent = root;

    // Hair (dark cap)
    const hairMat = new BABYLON.StandardMaterial('hairMat', scene);
    hairMat.diffuseColor = new BABYLON.Color3(0.16, 0.1, 0.06);
    const hair = BABYLON.MeshBuilder.CreateSphere('hair', { diameter: 0.45, segments: 10 }, scene);
    hair.material = hairMat;
    hair.position.y = 1.62;
    hair.scaling.y = 0.55;
    hair.parent = root;

    // Sygl glow at left wrist (orb)
    const glowMat = new BABYLON.StandardMaterial('glowMat', scene);
    glowMat.emissiveColor = accentColor;
    glowMat.diffuseColor = accentColor;
    const glow = BABYLON.MeshBuilder.CreateSphere('glow', { diameter: 0.18 }, scene);
    glow.material = glowMat;
    glow.position = new BABYLON.Vector3(-0.32, 0.7, 0.1);
    glow.parent = root;

    // Point light for sygl glow
    const glowLight = new BABYLON.PointLight('glL', glow.position.clone(), scene);
    glowLight.diffuse = accentColor;
    glowLight.intensity = 0.4;
    glowLight.range = 4;
    glowLight.parent = root;

    state.playerMesh = root;
    const startWP = world.gridToWorld(state.player.gx, state.player.gz);
    root.position = new BABYLON.Vector3(startWP.x, 0, startWP.z);
  },

  spawnEnemy(e) {
    const scene = state.scene;
    state.enemies.push(e);
    const root = new BABYLON.TransformNode(`en_${e.id}`, scene);

    // Training dummy: wooden post + sack body
    const postMat = new BABYLON.StandardMaterial('postMat', scene);
    postMat.diffuseColor = new BABYLON.Color3(0.32, 0.2, 0.1);
    const post = BABYLON.MeshBuilder.CreateCylinder('post', { height: 1.6, diameter: 0.18 }, scene);
    post.material = postMat;
    post.position.y = 0.8;
    post.parent = root;

    const cross = BABYLON.MeshBuilder.CreateBox('cross', { width: 0.9, height: 0.12, depth: 0.12 }, scene);
    cross.material = postMat;
    cross.position.y = 1.3;
    cross.parent = root;

    const sackMat = new BABYLON.StandardMaterial('sackMat', scene);
    sackMat.diffuseColor = new BABYLON.Color3(0.55, 0.45, 0.32);
    const sack = BABYLON.MeshBuilder.CreateSphere('sack', { diameter: 0.65, segments: 8 }, scene);
    sack.material = sackMat;
    sack.scaling.y = 1.3;
    sack.position.y = 1.05;
    sack.parent = root;

    // Face stitches (small dark spheres)
    const faceMat = new BABYLON.StandardMaterial('faceMat', scene);
    faceMat.diffuseColor = new BABYLON.Color3(0.1, 0.05, 0.03);
    [[-0.1, 1.15, 0.3],[0.1, 1.15, 0.3]].forEach(([x,y,z],i) => {
      const eye = BABYLON.MeshBuilder.CreateSphere(`eye${i}`, { diameter: 0.06 }, scene);
      eye.material = faceMat;
      eye.position = new BABYLON.Vector3(x,y,z);
      eye.parent = root;
    });

    // HP bar (plane, billboarded)
    const hpBg = BABYLON.MeshBuilder.CreatePlane(`hpbg_${e.id}`, { width: 0.9, height: 0.12 }, scene);
    const hpBgMat = new BABYLON.StandardMaterial(`hpbgmat_${e.id}`, scene);
    hpBgMat.diffuseColor = new BABYLON.Color3(0.05, 0.02, 0.02);
    hpBgMat.emissiveColor = new BABYLON.Color3(0.05, 0.02, 0.02);
    hpBgMat.disableLighting = true;
    hpBg.material = hpBgMat;
    hpBg.position.y = 1.9;
    hpBg.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
    hpBg.parent = root;
    hpBg.isVisible = false;

    const hpFill = BABYLON.MeshBuilder.CreatePlane(`hpfill_${e.id}`, { width: 0.86, height: 0.08 }, scene);
    const hpFillMat = new BABYLON.StandardMaterial(`hpfillmat_${e.id}`, scene);
    hpFillMat.diffuseColor = new BABYLON.Color3(0.7, 0.1, 0.16);
    hpFillMat.emissiveColor = new BABYLON.Color3(0.7, 0.1, 0.16);
    hpFillMat.disableLighting = true;
    hpFill.material = hpFillMat;
    hpFill.position.y = 1.9;
    hpFill.position.z = -0.005;
    hpFill.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
    hpFill.parent = root;
    hpFill.isVisible = false;

    const wp = world.gridToWorld(e.gx, e.gz);
    root.position = new BABYLON.Vector3(wp.x, 0, wp.z);
    state.enemyMeshes.set(e.id, { root, hpBg, hpFill, hpFillMat });
    state.obstacles.add(`${e.gx},${e.gz}`);
  },

  removeEnemy(e) {
    const m = state.enemyMeshes.get(e.id);
    if (m) {
      m.root.dispose(false, true);
      state.enemyMeshes.delete(e.id);
    }
    state.obstacles.delete(`${e.gx},${e.gz}`);
    const idx = state.enemies.indexOf(e);
    if (idx >= 0) state.enemies.splice(idx, 1);
  },

  updateEnemyHP(e) {
    const m = state.enemyMeshes.get(e.id);
    if (!m) return;
    if (e.hp < e.hpMax) {
      m.hpBg.isVisible = true;
      m.hpFill.isVisible = true;
      const pct = Math.max(0, e.hp / e.hpMax);
      m.hpFill.scaling.x = pct;
      m.hpFill.position.x = -(0.86 / 2) * (1 - pct);
    } else {
      m.hpBg.isVisible = false;
      m.hpFill.isVisible = false;
    }
  },

  gridToWorld(gx, gz) {
    return { x: gx * TILE_SIZE, z: gz * TILE_SIZE };
  },
  worldToGrid(wx, wz) {
    return { gx: Math.round(wx / TILE_SIZE), gz: Math.round(wz / TILE_SIZE) };
  },
  inBounds(gx, gz) {
    return gx >= 0 && gz >= 0 && gx < GRID_SIZE && gz < GRID_SIZE;
  },
  walkable(gx, gz, ignoreEnemy = null) {
    if (!world.inBounds(gx, gz)) return false;
    const key = `${gx},${gz}`;
    if (state.obstacles.has(key)) {
      // Check whether it's the ignored enemy's tile
      if (ignoreEnemy && ignoreEnemy.gx === gx && ignoreEnemy.gz === gz) return true;
      return false;
    }
    return true;
  },

  /* BFS pathfinder. Returns array of [gx,gz] not including start. */
  findPath(sx, sz, tx, tz, ignoreEnemy = null) {
    if (!world.walkable(tx, tz, ignoreEnemy)) return null;
    if (sx === tx && sz === tz) return [];
    const visited = new Set([`${sx},${sz}`]);
    const queue = [[sx, sz, []]];
    while (queue.length) {
      const [x, z, path] = queue.shift();
      for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx = x + dx, nz = z + dz;
        const key = `${nx},${nz}`;
        if (visited.has(key)) continue;
        if (!world.walkable(nx, nz, ignoreEnemy)) continue;
        visited.add(key);
        const newPath = [...path, [nx, nz]];
        if (nx === tx && nz === tz) return newPath;
        queue.push([nx, nz, newPath]);
      }
    }
    return null;
  },
  findPathAdjacent(sx, sz, tx, tz) {
    let best = null;
    for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = tx + dx, nz = tz + dz;
      if (!world.walkable(nx, nz)) continue;
      const p = world.findPath(sx, sz, nx, nz);
      if (p && (!best || p.length < best.length)) best = p;
    }
    return best;
  },

  /* Tap handling — fires on quick pointerup that didn't drag. Left-click or one-finger tap. */
  handleTap(ev) {
    if (!state.ready) return;
    if (dialogue.active) return;
    ctxMenu.hide();
    const scene = state.scene;
    const pick = scene.pick(scene.pointerX, scene.pointerY);
    if (!pick.hit) return;

    // Did we click an enemy?
    let enemyClicked = null;
    if (pick.pickedMesh) {
      let node = pick.pickedMesh;
      while (node && !node.name.startsWith('en_')) node = node.parent;
      if (node && node.name.startsWith('en_')) {
        const id = node.name.slice(3);
        enemyClicked = state.enemies.find(e => e.id === id);
      }
    }

    if (enemyClicked) {
      actions.attack(enemyClicked);
      return;
    }
    if (pick.pickedPoint) {
      const { gx, gz } = world.worldToGrid(pick.pickedPoint.x, pick.pickedPoint.z);
      actions.walkTo(gx, gz, ev.clientX, ev.clientY);
    }
  },

  /* Right-click handling — opens context menu, never rotates camera. */
  handleRightClick(ev) {
    if (!state.ready) return;
    if (dialogue.active) return;
    const scene = state.scene;
    const pick = scene.pick(scene.pointerX, scene.pointerY);
    if (!pick.hit) return;

    let enemyClicked = null;
    if (pick.pickedMesh) {
      let node = pick.pickedMesh;
      while (node && !node.name.startsWith('en_')) node = node.parent;
      if (node && node.name.startsWith('en_')) {
        const id = node.name.slice(3);
        enemyClicked = state.enemies.find(e => e.id === id);
      }
    }

    if (enemyClicked) {
      ctxMenu.showForEnemy(ev.clientX, ev.clientY, enemyClicked);
    } else if (pick.pickedPoint) {
      const { gx, gz } = world.worldToGrid(pick.pickedPoint.x, pick.pickedPoint.z);
      ctxMenu.showForTile(ev.clientX, ev.clientY, gx, gz);
    }
  }
};
