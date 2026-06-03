/* ================================================================
   BABYLON SCENE — New Spring
   ================================================================ */
const world = {
  buildings: [],
  npcs: [],
  _transitioning: false,

  build() {
    if (typeof BABYLON === 'undefined') {
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
    scene.fogDensity = 0.004;
    scene.fogColor = new BABYLON.Color3(0.08, 0.06, 0.05);
    // Flat-shade all new materials by default (RS2004 look)
    scene.onNewMaterialAddedObservable.add(mat => {
      if (mat instanceof BABYLON.StandardMaterial) {
        mat.specularColor = new BABYLON.Color3(0, 0, 0);
      }
    });

    const startWP = world.gridToWorld(48, 52);
    const cam = new BABYLON.ArcRotateCamera('cam', -Math.PI / 2, Math.PI / 2.6, 20, new BABYLON.Vector3(startWP.x, 0, startWP.z), scene);
    cam.lowerRadiusLimit = 8;
    cam.upperRadiusLimit = 45;
    cam.lowerBetaLimit = 0.6;
    cam.upperBetaLimit = Math.PI / 2.15;
    cam.wheelPrecision = 30;
    cam.panningSensibility = 0;
    cam.attachControl(canvas, true);

    // ── TOON / CEL SHADER (RS2004-style flat shading) ──────────
    BABYLON.Effect.ShadersStore['toonFragmentShader'] = `
      precision highp float;
      varying vec2 vUV;
      uniform sampler2D textureSampler;
      void main(void) {
        vec4 c = texture2D(textureSampler, vUV);
        float steps = 6.0;
        c.rgb = floor(c.rgb * steps + 0.5) / steps;
        gl_FragColor = c;
      }
    `;
    const toonPass = new BABYLON.PostProcess('toon', 'toon', null, null, 1.0, cam);
    state.toonPass = toonPass;
    if (cam.inputs.attached.pointers) {
      cam.inputs.attached.pointers.buttons = [0];
      cam.inputs.attached.pointers.pinchPrecision = 12;
      cam.inputs.attached.pointers.useNaturalPinchZoom = false;
    }
    state.camera = cam;

    state.ambientLight = new BABYLON.HemisphericLight('amb', new BABYLON.Vector3(0, 1, 0), scene);
    state.ambientLight.intensity = 0.45;
    state.ambientLight.groundColor = new BABYLON.Color3(0.15, 0.12, 0.1);
    state.ambientLight.diffuse = new BABYLON.Color3(0.95, 0.88, 0.7);

    state.sunLight = new BABYLON.DirectionalLight('sun', new BABYLON.Vector3(-0.5, -1, -0.4), scene);
    state.sunLight.intensity = 0.85;
    state.sunLight.diffuse = new BABYLON.Color3(1.0, 0.9, 0.7);

    // Reset state
    state.obstacles.clear();
    world.buildings = [];
    world.npcs = [];

    // Ground
    world._buildGround(scene);

    // Build New Spring
    world._buildNewSpring(scene);

    // Tile click marker
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

    world.buildPlayerMesh();

    // Render loop
    state.engine.runRenderLoop(() => {
      if (state.scene && state.ready) {
        if (state.playerMesh) {
          const target = state.playerMesh.position;
          cam.target = BABYLON.Vector3.Lerp(cam.target, target, 0.1);
        }
        if (state.flame) {
          const t = performance.now() * 0.005;
          state.flame.scaling.y = 1 + Math.sin(t) * 0.15;
          state.flame.scaling.x = 1 + Math.sin(t * 1.3) * 0.1;
        }
        state.scene.render();
      }
    });

    if (state.playerMesh) {
      cam.target = state.playerMesh.position.clone();
    }
    updateDayNight();

    window.addEventListener('resize', () => state.engine.resize());

    let downX = 0, downY = 0, downTime = 0, downId = null;
    let longPressTimer = null;
    let suppressNextTap = false;
    const TAP_MOVE_MAX = 10;
    const TAP_TIME_MAX = 350;
    const LONG_PRESS_MS = 500;

    canvas.addEventListener('pointerdown', (ev) => {
      if (ev.button === 2) {
        // Desktop right-click → show context menu
        world.handleLongPress(ev);
        ev.preventDefault();
        return;
      }
      // If ctx menu is open, the tap should only dismiss it, not move the player
      suppressNextTap = document.getElementById('ctx-menu').classList.contains('active');
      downX = ev.clientX; downY = ev.clientY;
      downTime = performance.now();
      downId = ev.pointerId;
      // Start long-press timer
      longPressTimer = setTimeout(() => {
        longPressTimer = null;
        downId = null; // suppress tap on pointerup
        world.handleLongPress(ev);
      }, LONG_PRESS_MS);
    });

    canvas.addEventListener('pointermove', (ev) => {
      if (!longPressTimer) return;
      const dx = ev.clientX - downX, dy = ev.clientY - downY;
      if (Math.sqrt(dx*dx + dy*dy) > TAP_MOVE_MAX) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    });

    canvas.addEventListener('pointerup', (ev) => {
      if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
      if (ev.pointerId !== downId) return;
      const dx = ev.clientX - downX;
      const dy = ev.clientY - downY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const dt = performance.now() - downTime;
      downId = null;
      if (dist < TAP_MOVE_MAX && dt < TAP_TIME_MAX) {
        if (suppressNextTap) { suppressNextTap = false; return; }
        world.handleTap(ev);
      }
    });

    canvas.addEventListener('contextmenu', e => e.preventDefault());
  },

  _buildGround(scene) {
    const groundMat = new BABYLON.StandardMaterial('groundMat', scene);
    groundMat.specularColor = new BABYLON.Color3(0.02, 0.02, 0.02);
    const grassTex = new BABYLON.DynamicTexture('grassTex', { width: 256, height: 256 }, scene);
    const gc = grassTex.getContext();
    gc.fillStyle = '#3a4f18'; gc.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 120; i++) {
      const hue = (Math.sin(i * 47.1) * 0.5 + 0.5);
      const lum = 22 + Math.floor(hue * 10);
      gc.fillStyle = `hsl(88,50%,${lum}%)`;
      const tx = (Math.sin(i * 31.7) * 0.5 + 0.5) * 256;
      const tz = (Math.cos(i * 17.3) * 0.5 + 0.5) * 256;
      gc.fillRect(tx, tz, 2 + (i % 3), 7 + (i % 4));
    }
    grassTex.update();
    grassTex.uScale = 25; grassTex.vScale = 25;
    groundMat.diffuseTexture = grassTex;
    const ground = BABYLON.MeshBuilder.CreateGround('ground', {
      width: GRID_SIZE * TILE_SIZE,
      height: GRID_SIZE * TILE_SIZE,
      subdivisions: 1
    }, scene);
    ground.material = groundMat;
    ground.position.x = (GRID_SIZE * TILE_SIZE) / 2 - TILE_SIZE / 2;
    ground.position.z = (GRID_SIZE * TILE_SIZE) / 2 - TILE_SIZE / 2;
    ground.position.y = 0;
    ground.receiveShadows = true;
  },

  _buildNewSpring(scene) {
    state.torchLights = [];

    // ── MATERIALS ──────────────────────────────────────────────
    const cobbleMat = new BABYLON.StandardMaterial('cobbleMat', scene);
    cobbleMat.specularColor = new BABYLON.Color3(0.04, 0.04, 0.04);
    const cobTex = new BABYLON.DynamicTexture('cobTex', { width: 256, height: 256 }, scene);
    const cc = cobTex.getContext();
    cc.fillStyle = '#3a3228'; cc.fillRect(0, 0, 256, 256);
    const sh = (r, c) => (Math.sin(r * 127.3 + c * 311.7) * 0.5 + 0.5);
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const ofs = (r % 2) * 16;
        const sx = (c * 32 + ofs) % 256, sy = r * 32;
        cc.fillStyle = `hsl(26,16%,${30 + Math.floor(sh(r, c) * 12)}%)`;
        cc.fillRect(sx + 2, sy + 2, 28, 28);
      }
    }
    cobTex.update(); cobTex.uScale = 8; cobTex.vScale = 8;
    cobbleMat.diffuseTexture = cobTex;

    const dirtMat = new BABYLON.StandardMaterial('dirtMat', scene);
    dirtMat.diffuseColor = new BABYLON.Color3(0.50, 0.36, 0.18);
    dirtMat.specularColor = new BABYLON.Color3(0, 0, 0);

    const waterMat = new BABYLON.StandardMaterial('waterMat', scene);
    waterMat.diffuseColor = new BABYLON.Color3(0.22, 0.48, 0.72);
    waterMat.emissiveColor = new BABYLON.Color3(0.04, 0.12, 0.26);
    waterMat.specularColor = new BABYLON.Color3(0.4, 0.4, 0.4);

    const wallStoneMat = new BABYLON.StandardMaterial('wallStoneMat', scene);
    wallStoneMat.diffuseColor = new BABYLON.Color3(0.38, 0.33, 0.25);
    wallStoneMat.specularColor = new BABYLON.Color3(0.02, 0.02, 0.02);

    const treeMat = new BABYLON.StandardMaterial('treeMat', scene);
    treeMat.diffuseColor = new BABYLON.Color3(0.08, 0.18, 0.06);
    treeMat.specularColor = new BABYLON.Color3(0, 0, 0);
    const trunkMat = new BABYLON.StandardMaterial('trunkMat', scene);
    trunkMat.diffuseColor = new BABYLON.Color3(0.18, 0.11, 0.05);
    trunkMat.specularColor = new BABYLON.Color3(0, 0, 0);
    const orchLeafMat = new BABYLON.StandardMaterial('orchLeafMat', scene);
    orchLeafMat.diffuseColor = new BABYLON.Color3(0.14, 0.32, 0.10);
    const orchTrunkMat = new BABYLON.StandardMaterial('orchTrunkMat', scene);
    orchTrunkMat.diffuseColor = new BABYLON.Color3(0.22, 0.14, 0.06);

    const torchMat = new BABYLON.StandardMaterial('torchMat', scene);
    torchMat.diffuseColor = new BABYLON.Color3(0.25, 0.15, 0.08);
    const torchFlameMat = new BABYLON.StandardMaterial('torchFlameMat', scene);
    torchFlameMat.emissiveColor = new BABYLON.Color3(1, 0.6, 0.2);
    torchFlameMat.diffuseColor = new BABYLON.Color3(1, 0.5, 0.1);

    // Building palette (from map)
    const amberC  = new BABYLON.Color3(0.82, 0.64, 0.28), amberR  = new BABYLON.Color3(0.38, 0.22, 0.08);
    const woodC   = new BABYLON.Color3(0.55, 0.32, 0.14), woodR   = new BABYLON.Color3(0.30, 0.16, 0.07);
    const purpleC = new BABYLON.Color3(0.42, 0.24, 0.52), purpleR = new BABYLON.Color3(0.22, 0.10, 0.30);
    const blueC   = new BABYLON.Color3(0.28, 0.44, 0.72), blueR   = new BABYLON.Color3(0.14, 0.22, 0.42);
    const redC    = new BABYLON.Color3(0.72, 0.20, 0.20), redR    = new BABYLON.Color3(0.40, 0.08, 0.08);
    const greenC  = new BABYLON.Color3(0.22, 0.50, 0.34), greenR  = new BABYLON.Color3(0.10, 0.26, 0.16);
    const shopC   = new BABYLON.Color3(0.72, 0.50, 0.18), shopR   = new BABYLON.Color3(0.34, 0.20, 0.07);

    // ── HELPERS ────────────────────────────────────────────────
    const placeTree = (gx, gz) => {
      const key = `${gx},${gz}`;
      if (state.obstacles.has(key)) return;
      state.obstacles.add(key);
      const variants = [
        { file: 'tree_default.glb',     scale: 2.2 },
        { file: 'tree_oak.glb',         scale: 2.0 },
        { file: 'tree_fat.glb',         scale: 1.8 },
        { file: 'tree_pineDefaultA.glb', scale: 2.0 },
      ];
      const v = variants[(gx + gz) % 4];
      world._loadProp(scene, v.file, gx, gz, {
        scale: v.scale,
        ry: (gx * 0.7 + gz * 0.3) % (Math.PI * 2),
        basePath: 'assets/kenney/nature-kit/Models/GLTF format/'
      });
    };

    const placeOrchard = (gx, gz) => {
      const key = `${gx},${gz}`;
      if (state.obstacles.has(key)) return;
      state.obstacles.add(key);
      world._loadProp(scene, 'tree_small.glb', gx, gz, {
        scale: 1.5,
        ry: (gx + gz) % (Math.PI * 2),
        basePath: 'assets/kenney/nature-kit/Models/GLTF format/'
      });
    };

    const placeTorch = (gx, gz) => {
      const wp = world.gridToWorld(gx, gz);
      const pole = BABYLON.MeshBuilder.CreateCylinder(`torchPole_${gx}_${gz}`, { height: 3.0, diameter: 0.12 }, scene);
      pole.material = torchMat;
      pole.position = new BABYLON.Vector3(wp.x, 1.5, wp.z);
      const flame = BABYLON.MeshBuilder.CreateCylinder(`torchFlame_${gx}_${gz}`, { height: 0.35, diameterTop: 0.0, diameterBottom: 0.22, tessellation: 6 }, scene);
      flame.material = torchFlameMat;
      flame.position = new BABYLON.Vector3(wp.x, 3.18, wp.z);
      const tl = new BABYLON.PointLight(`tl_${gx}_${gz}`, new BABYLON.Vector3(wp.x, 3.5, wp.z), scene);
      tl.diffuse = new BABYLON.Color3(1, 0.75, 0.4);
      tl.intensity = 0;
      tl.range = 9;
      state.torchLights.push(tl);
    };

    // ── BORDER TREES ───────────────────────────────────────────
    for (let i = 0; i < GRID_SIZE; i++) {
      placeTree(0, i); placeTree(1, i);
      placeTree(GRID_SIZE - 1, i); placeTree(GRID_SIZE - 2, i);
      placeTree(i, 0); placeTree(i, 1);
      placeTree(i, GRID_SIZE - 1); placeTree(i, GRID_SIZE - 2);
    }

    // ── ORCHARDS (SW and SE outside walls) ─────────────────────
    for (let gx = 3; gx <= 19; gx += 3)
      for (let gz = 76; gz <= 96; gz += 3) placeOrchard(gx, gz);
    for (let gx = 81; gx <= 97; gx += 3)
      for (let gz = 76; gz <= 96; gz += 3) placeOrchard(gx, gz);

    // ── WEST WOOD ──────────────────────────────────────────────
    [[3,42],[4,44],[5,41],[6,46],[3,49],[5,51],[4,54],
     [6,56],[3,58],[5,60],[4,63],[6,65],[3,67],[8,43],[9,47],
     [8,52],[7,57],[9,61],[8,65]].forEach(([gx, gz]) => placeTree(gx, gz));

    // ── SOUTH PINE WOOD ────────────────────────────────────────
    [[5,79],[7,81],[10,80],[13,79],[16,81],[19,80],
     [22,79],[25,81],[28,80],[31,79]].forEach(([gx, gz]) => placeTree(gx, gz));

    // ── HOLLOW WOOD (east) ─────────────────────────────────────
    [[82,67],[84,68],[87,66],[90,68],[83,71],[87,73],[91,70]].forEach(([gx, gz]) => placeTree(gx, gz));

    // ── SCATTERED WILDERNESS ───────────────────────────────────
    [[12,12],[13,12],[88,12],[89,12],[12,88],[88,88],
     [35,10],[65,10],[10,35],[90,35],[10,65],[90,65]].forEach(([gx, gz]) => placeTree(gx, gz));

    // ── FARMLAND PATCHES (NW and NE outside walls) ─────────────
    const fieldMat = new BABYLON.StandardMaterial('fieldMat', scene);
    const fieldTex = new BABYLON.DynamicTexture('fieldTex', { width: 128, height: 128 }, scene);
    const fc = fieldTex.getContext();
    for (let row = 0; row < 8; row++) {
      fc.fillStyle = row % 2 === 0 ? '#3a5215' : '#507028';
      fc.fillRect(0, row * 16, 128, 16);
    }
    fieldTex.update(); fieldTex.uScale = 3; fieldTex.vScale = 5;
    fieldMat.diffuseTexture = fieldTex;
    const farmNW = BABYLON.MeshBuilder.CreateGround('farmNW', { width: 18*TILE_SIZE, height: 22*TILE_SIZE }, scene);
    farmNW.material = fieldMat;
    farmNW.position = new BABYLON.Vector3(11*TILE_SIZE, 0.02, 14*TILE_SIZE);
    const farmNE = BABYLON.MeshBuilder.CreateGround('farmNE', { width: 18*TILE_SIZE, height: 22*TILE_SIZE }, scene);
    farmNE.material = fieldMat;
    farmNE.position = new BABYLON.Vector3(89*TILE_SIZE, 0.02, 14*TILE_SIZE);

    // ── ROADS ──────────────────────────────────────────────────
    // Dirt roads outside walls
    const dirtSegs = [
      [50*TILE_SIZE, 13*TILE_SIZE, 7*TILE_SIZE, 24*TILE_SIZE], // N
      [50*TILE_SIZE, 87*TILE_SIZE, 7*TILE_SIZE, 24*TILE_SIZE], // S
      [11*TILE_SIZE, 50*TILE_SIZE, 20*TILE_SIZE, 7*TILE_SIZE], // W
      [89*TILE_SIZE, 50*TILE_SIZE, 20*TILE_SIZE, 7*TILE_SIZE], // E
    ];
    dirtSegs.forEach(([cx, cz, w, h], i) => {
      const r = BABYLON.MeshBuilder.CreateGround(`dirtRd_${i}`, { width: w, height: h }, scene);
      r.material = dirtMat; r.position = new BABYLON.Vector3(cx, 0.02, cz);
    });
    // Cobblestone inside: N-S road gz=27-73, E-W road gx=22-78
    const nsRd = BABYLON.MeshBuilder.CreateGround('nsRoad', { width: 7*TILE_SIZE, height: 46*TILE_SIZE }, scene);
    nsRd.material = cobbleMat; nsRd.position = new BABYLON.Vector3(50*TILE_SIZE, 0.04, 50*TILE_SIZE);
    const ewRd = BABYLON.MeshBuilder.CreateGround('ewRoad', { width: 56*TILE_SIZE, height: 7*TILE_SIZE }, scene);
    ewRd.material = cobbleMat; ewRd.position = new BABYLON.Vector3(50*TILE_SIZE, 0.04, 50*TILE_SIZE);

    // ── TOWN WALLS ─────────────────────────────────────────────
    const WALL_H = 2.8, WALL_T = 0.5;
    const NWZ = 27, SWZ = 73, WWX = 22, EWX = 78;
    const GNXL = 47, GNXR = 53, GNZN = 47, GNZS = 53; // gate openings

    const mkWallBox = (name, cx, cz, w, d) => {
      const m = BABYLON.MeshBuilder.CreateBox(name, { width: w, height: WALL_H, depth: d }, scene);
      m.material = wallStoneMat; m.position = new BABYLON.Vector3(cx, WALL_H / 2, cz);
    };
    const mkMerlons = (name, ax, az, len, horiz) => {
      const step = 1.6, n = Math.max(1, Math.floor(len / step));
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        const m = BABYLON.MeshBuilder.CreateBox(`${name}m${i}`, {
          width: horiz ? 0.55 : WALL_T + 0.1, height: 0.42, depth: horiz ? WALL_T + 0.1 : 0.55
        }, scene);
        m.material = wallStoneMat;
        m.position = new BABYLON.Vector3(horiz ? ax + len * t : ax, WALL_H + 0.21, horiz ? az : az + len * t);
      }
    };

    // N wall segments
    { const wz = NWZ * TILE_SIZE;
      const s1w = (GNXL - WWX) * TILE_SIZE, s2w = (EWX - GNXR) * TILE_SIZE;
      mkWallBox('nWL', (WWX + GNXL) / 2 * TILE_SIZE, wz, s1w, WALL_T);
      mkMerlons('nWL', WWX * TILE_SIZE, wz, s1w, true);
      mkWallBox('nWR', (GNXR + EWX) / 2 * TILE_SIZE, wz, s2w, WALL_T);
      mkMerlons('nWR', GNXR * TILE_SIZE, wz, s2w, true);
      for (let gx = WWX; gx < GNXL; gx++) state.obstacles.add(`${gx},${NWZ}`);
      for (let gx = GNXR + 1; gx <= EWX; gx++) state.obstacles.add(`${gx},${NWZ}`);
    }
    // S wall
    { const wz = SWZ * TILE_SIZE;
      const s1w = (GNXL - WWX) * TILE_SIZE, s2w = (EWX - GNXR) * TILE_SIZE;
      mkWallBox('sWL', (WWX + GNXL) / 2 * TILE_SIZE, wz, s1w, WALL_T);
      mkMerlons('sWL', WWX * TILE_SIZE, wz, s1w, true);
      mkWallBox('sWR', (GNXR + EWX) / 2 * TILE_SIZE, wz, s2w, WALL_T);
      mkMerlons('sWR', GNXR * TILE_SIZE, wz, s2w, true);
      for (let gx = WWX; gx < GNXL; gx++) state.obstacles.add(`${gx},${SWZ}`);
      for (let gx = GNXR + 1; gx <= EWX; gx++) state.obstacles.add(`${gx},${SWZ}`);
    }
    // W wall
    { const wx = WWX * TILE_SIZE;
      const s1d = (GNZN - NWZ) * TILE_SIZE, s2d = (SWZ - GNZS) * TILE_SIZE;
      mkWallBox('wWN', wx, (NWZ + GNZN) / 2 * TILE_SIZE, WALL_T, s1d);
      mkMerlons('wWN', wx, NWZ * TILE_SIZE, s1d, false);
      mkWallBox('wWS', wx, (GNZS + SWZ) / 2 * TILE_SIZE, WALL_T, s2d);
      mkMerlons('wWS', wx, GNZS * TILE_SIZE, s2d, false);
      for (let gz = NWZ; gz < GNZN; gz++) state.obstacles.add(`${WWX},${gz}`);
      for (let gz = GNZS + 1; gz <= SWZ; gz++) state.obstacles.add(`${WWX},${gz}`);
    }
    // E wall
    { const wx = EWX * TILE_SIZE;
      const s1d = (GNZN - NWZ) * TILE_SIZE, s2d = (SWZ - GNZS) * TILE_SIZE;
      mkWallBox('eWN', wx, (NWZ + GNZN) / 2 * TILE_SIZE, WALL_T, s1d);
      mkMerlons('eWN', wx, NWZ * TILE_SIZE, s1d, false);
      mkWallBox('eWS', wx, (GNZS + SWZ) / 2 * TILE_SIZE, WALL_T, s2d);
      mkMerlons('eWS', wx, GNZS * TILE_SIZE, s2d, false);
      for (let gz = NWZ; gz < GNZN; gz++) state.obstacles.add(`${EWX},${gz}`);
      for (let gz = GNZS + 1; gz <= SWZ; gz++) state.obstacles.add(`${EWX},${gz}`);
    }

    // Corner towers — procedural stacked cylinders
    [[WWX, NWZ], [EWX, NWZ], [WWX, SWZ], [EWX, SWZ]].forEach(([gx, gz]) => {
      state.obstacles.add(`${gx},${gz}`);
      const wp = world.gridToWorld(gx, gz);
      const base = BABYLON.MeshBuilder.CreateCylinder(`twr_base_${gx}_${gz}`, { height: WALL_H + 0.6, diameter: 3.2, tessellation: 8 }, scene);
      base.material = wallStoneMat; base.position = new BABYLON.Vector3(wp.x, (WALL_H + 0.6) / 2, wp.z);
      const top = BABYLON.MeshBuilder.CreateCylinder(`twr_top_${gx}_${gz}`, { height: 0.45, diameterTop: 3.6, diameterBottom: 3.2, tessellation: 8 }, scene);
      top.material = wallStoneMat; top.position = new BABYLON.Vector3(wp.x, WALL_H + 0.6 + 0.22, wp.z);
      const cap = BABYLON.MeshBuilder.CreateCylinder(`twr_cap_${gx}_${gz}`, { height: 1.1, diameterTop: 0.4, diameterBottom: 3.4, tessellation: 8 }, scene);
      const capMat = new BABYLON.StandardMaterial(`twrCapMat_${gx}_${gz}`, scene);
      capMat.diffuseColor = new BABYLON.Color3(0.25, 0.18, 0.10);
      cap.material = capMat; cap.position = new BABYLON.Vector3(wp.x, WALL_H + 0.6 + 0.45 + 0.55, wp.z);
    });

    // Gate arches (pillars + lintel)
    const gateArchMat = new BABYLON.StandardMaterial('gateArchMat', scene);
    gateArchMat.diffuseColor = new BABYLON.Color3(0.30, 0.26, 0.18);
    const mkGateH = (name, gx1, gx2, gz) => { // horizontal gate (N or S wall)
      const wz = gz * TILE_SIZE, ARCH_H = 4.0;
      [[gx1, gz], [gx2, gz]].forEach(([gx, gz], i) => {
        const wp = world.gridToWorld(gx, gz);
        const p = BABYLON.MeshBuilder.CreateBox(`${name}p${i}`, { width: 0.8, height: ARCH_H, depth: 0.8 }, scene);
        p.material = gateArchMat; p.position = new BABYLON.Vector3(wp.x, ARCH_H / 2, wz);
      });
      const lw = (gx2 - gx1) * TILE_SIZE + 0.8;
      const l = BABYLON.MeshBuilder.CreateBox(`${name}l`, { width: lw, height: 0.5, depth: 0.9 }, scene);
      l.material = gateArchMat; l.position = new BABYLON.Vector3((gx1 + gx2) / 2 * TILE_SIZE, ARCH_H + 0.25, wz);
    };
    const mkGateV = (name, gx, gz1, gz2) => { // vertical gate (W or E wall)
      const wx = gx * TILE_SIZE, ARCH_H = 4.0;
      [[gx, gz1], [gx, gz2]].forEach(([gx, gz], i) => {
        const wp = world.gridToWorld(gx, gz);
        const p = BABYLON.MeshBuilder.CreateBox(`${name}p${i}`, { width: 0.8, height: ARCH_H, depth: 0.8 }, scene);
        p.material = gateArchMat; p.position = new BABYLON.Vector3(wx, ARCH_H / 2, wp.z);
      });
      const ld = (gz2 - gz1) * TILE_SIZE + 0.8;
      const l = BABYLON.MeshBuilder.CreateBox(`${name}l`, { width: 0.9, height: 0.5, depth: ld }, scene);
      l.material = gateArchMat; l.position = new BABYLON.Vector3(wx, ARCH_H + 0.25, (gz1 + gz2) / 2 * TILE_SIZE);
    };
    mkGateH('gN', GNXL, GNXR, NWZ);
    mkGateH('gS', GNXL, GNXR, SWZ);
    mkGateV('gW', WWX, GNZN, GNZS);
    mkGateV('gE', EWX, GNZN, GNZS);

    // Gate sign labels (emissive)
    const gateSignMat = new BABYLON.StandardMaterial('gateSignMat', scene);
    gateSignMat.emissiveColor = new BABYLON.Color3(0.72, 0.50, 0.12);
    ['gNSign','gSSign'].forEach((name, i) => {
      const s = BABYLON.MeshBuilder.CreateBox(name, { width: 2.0, height: 0.38, depth: 0.1 }, scene);
      s.material = gateSignMat;
      s.position = new BABYLON.Vector3(50 * TILE_SIZE, 4.6, (i === 0 ? NWZ : SWZ) * TILE_SIZE);
    });

    // Torches at each gate + along main roads
    [[GNXL, NWZ],[GNXR, NWZ],[GNXL, SWZ],[GNXR, SWZ],
     [WWX, GNZN],[WWX, GNZS],[EWX, GNZN],[EWX, GNZS]].forEach(([gx, gz]) => placeTorch(gx, gz));
    for (let gz = 32; gz <= 68; gz += 7) {
      [46, 54].forEach(gx => placeTorch(gx, gz));
    }

    // ── TOWN SQUARE (cobblestone + fountain) ───────────────────
    const SQ1X = 43, SQ2X = 57, SQ1Z = 43, SQ2Z = 57;
    const sq = BABYLON.MeshBuilder.CreateGround('townSquare', {
      width: (SQ2X - SQ1X) * TILE_SIZE, height: (SQ2Z - SQ1Z) * TILE_SIZE
    }, scene);
    sq.material = cobbleMat;
    sq.position = new BABYLON.Vector3((SQ1X + SQ2X) / 2 * TILE_SIZE, 0.04, (SQ1Z + SQ2Z) / 2 * TILE_SIZE);

    // Fountain — procedural
    ['50,50','49,50','51,50','50,49','50,51'].forEach(k => state.obstacles.add(k));
    { const fwp = world.gridToWorld(50, 50);
      const basinMat = new BABYLON.StandardMaterial('fountainBasinMat', scene);
      basinMat.diffuseColor = new BABYLON.Color3(0.38, 0.33, 0.25);
      const basin = BABYLON.MeshBuilder.CreateCylinder('fountainBasin', { height: 0.55, diameterTop: 3.8, diameterBottom: 3.4, tessellation: 16 }, scene);
      basin.material = basinMat; basin.position = new BABYLON.Vector3(fwp.x, 0.28, fwp.z);
      const water = BABYLON.MeshBuilder.CreateDisc('fountainWater', { radius: 1.7, tessellation: 16 }, scene);
      water.material = waterMat; water.rotation.x = Math.PI / 2; water.position = new BABYLON.Vector3(fwp.x, 0.53, fwp.z);
      const pillar = BABYLON.MeshBuilder.CreateCylinder('fountainPillar', { height: 1.4, diameter: 0.35, tessellation: 8 }, scene);
      pillar.material = basinMat; pillar.position = new BABYLON.Vector3(fwp.x, 0.7, fwp.z);
      const bowl = BABYLON.MeshBuilder.CreateCylinder('fountainBowl', { height: 0.3, diameterTop: 1.2, diameterBottom: 1.0, tessellation: 12 }, scene);
      bowl.material = basinMat; bowl.position = new BABYLON.Vector3(fwp.x, 1.55, fwp.z);
      const topWater = BABYLON.MeshBuilder.CreateDisc('fountainTopWater', { radius: 0.55, tessellation: 12 }, scene);
      topWater.material = waterMat; topWater.rotation.x = Math.PI / 2; topWater.position = new BABYLON.Vector3(fwp.x, 1.68, fwp.z);
    }

    // ── MARKET STALLS (procedural) ────────────────────────────
    [[44, 43], [56, 43], [44, 57], [56, 57]].forEach(([gx, gz], idx) => {
      world._buildStall(scene, gx, gz, idx);
      state.obstacles.add(`${gx},${gz}`);
      state.obstacles.add(`${gx},${gz - 1}`);
      state.obstacles.add(`${gx},${gz + 1}`);
      state.obstacles.add(`${gx - 1},${gz}`);
      state.obstacles.add(`${gx + 1},${gz}`);
    });

    // ── MARKET PROPS (procedural) ──────────────────────────────
    const barrelMat = new BABYLON.StandardMaterial('barrelMat', scene);
    barrelMat.diffuseColor = new BABYLON.Color3(0.32, 0.20, 0.08);
    [[62,42],[64,42],[27,58],[27,60]].forEach(([gx,gz]) => {
      const wp = world.gridToWorld(gx, gz);
      const b = BABYLON.MeshBuilder.CreateCylinder(`barrel_${gx}_${gz}`, { height: 0.7, diameter: 0.5, tessellation: 10 }, scene);
      b.material = barrelMat; b.position = new BABYLON.Vector3(wp.x, 0.35, wp.z);
    });

    // ── BRAZIER (south of fountain) — procedural ───────────────
    state.obstacles.add('50,55');
    state.flame = null;
    { const brazWP = world.gridToWorld(50, 55);
      const brazMat = new BABYLON.StandardMaterial('brazMat', scene);
      brazMat.diffuseColor = new BABYLON.Color3(0.22, 0.16, 0.10);
      const bowl = BABYLON.MeshBuilder.CreateCylinder('brazBowl', { height: 0.45, diameterTop: 0.7, diameterBottom: 0.4, tessellation: 8 }, scene);
      bowl.material = brazMat; bowl.position = new BABYLON.Vector3(brazWP.x, 0.92, brazWP.z);
      [[0.3,0],[-0.3,0],[0,0.3],[0,-0.3]].forEach(([ox,oz],li) => {
        const leg = BABYLON.MeshBuilder.CreateCylinder(`brazLeg_${li}`, { height: 0.9, diameter: 0.07, tessellation: 6 }, scene);
        leg.material = brazMat; leg.position = new BABYLON.Vector3(brazWP.x + ox, 0.45, brazWP.z + oz);
      });
      const flameMat = new BABYLON.StandardMaterial('brazFlameMat', scene);
      flameMat.emissiveColor = new BABYLON.Color3(1, 0.55, 0.1);
      flameMat.diffuseColor = new BABYLON.Color3(1, 0.4, 0.0);
      const flame = BABYLON.MeshBuilder.CreateCylinder('brazFlame', { height: 0.5, diameterTop: 0.0, diameterBottom: 0.38, tessellation: 8 }, scene);
      flame.material = flameMat; flame.position = new BABYLON.Vector3(brazWP.x, 1.4, brazWP.z);
      state.flame = flame;
      const brazierLight = new BABYLON.PointLight('brzL', new BABYLON.Vector3(brazWP.x, 1.5, brazWP.z), scene);
      brazierLight.diffuse = new BABYLON.Color3(1, 0.55, 0.2); brazierLight.intensity = 0; brazierLight.range = 12;
      state.brazierLight = brazierLight;
    }

    // ── BUILDINGS ──────────────────────────────────────────────
    // Obstacle/roof registration done via _buildBuilding (glbReplaced=true skips visual meshes).
    // GLBs are loaded once per unique file, then cloned for each placement — avoids async timing issues.
    const BMOD = 'assets/kenney/modular-buildings/Models/GLB format/';
    const buildingDefs = [
      { name: 'dawnHall',         gx: 28, gz: 29, w: 13, d: 12, floors: 3, wC: amberC,  rC: amberR,  door: 'south', dw: 2, file: 'building-sample-tower-a.glb', scale: 5.5, ry: 0 },
      { name: 'inn',              gx: 60, gz: 29, w: 13, d: 12, floors: 2, wC: woodC,   rC: woodR,   door: 'south', dw: 2, file: 'building-sample-tower-b.glb', scale: 5.0, ry: 0 },
      { name: 'enchantedWeapons', gx: 24, gz: 55, w: 10, d:  9, floors: 1, wC: purpleC, rC: purpleR, door: 'east',  dw: 1, file: 'building-sample-house-a.glb', scale: 4.0, ry: -Math.PI/2 },
      { name: 'jeweler',          gx: 24, gz: 65, w:  9, d:  7, floors: 1, wC: redC,    rC: redR,    door: 'east',  dw: 1, file: 'building-sample-house-b.glb', scale: 3.5, ry: -Math.PI/2 },
      { name: 'apothecary',       gx: 34, gz: 65, w:  9, d:  7, floors: 1, wC: greenC,  rC: greenR,  door: 'east',  dw: 1, file: 'building-sample-house-c.glb', scale: 3.5, ry: -Math.PI/2 },
      { name: 'familiarSupplies', gx: 66, gz: 55, w: 10, d:  9, floors: 1, wC: blueC,   rC: blueR,   door: 'west',  dw: 1, file: 'building-sample-house-a.glb', scale: 4.0, ry: Math.PI/2 },
      { name: 'restaurant',       gx: 60, gz: 65, w:  8, d:  7, floors: 1, wC: shopC,   rC: shopR,   door: 'west',  dw: 1, file: 'building-sample-house-b.glb', scale: 3.5, ry: Math.PI/2 },
      { name: 'teaHouse',         gx: 68, gz: 65, w:  8, d:  7, floors: 1, wC: amberC,  rC: amberR,  door: 'west',  dw: 1, file: 'building-sample-house-c.glb', scale: 3.5, ry: Math.PI/2 },
    ];

    // Register obstacles/roofs now (synchronous); GLB visuals load after
    buildingDefs.forEach(def => {
      world._buildBuilding(scene, def.name, def.gx, def.gz, def.w, def.d, def.floors, def.wC, def.rC, def.door, def.dw, { glbReplaced: true });
    });

    // Load each building via AssetContainer so the same GLB file can be instanced
    // multiple times without mesh name conflicts
    buildingDefs.forEach(def => {
      const cx = (def.gx + def.w / 2) * TILE_SIZE;
      const cz = (def.gz + def.d / 2) * TILE_SIZE;
      // Scale so the building fills its grid footprint (Kenney sample buildings are ~4 units wide at scale 1)
      const targetW = def.w * TILE_SIZE;
      const targetD = def.d * TILE_SIZE;
      const sc = Math.min(targetW, targetD) / 4.0;
      BABYLON.SceneLoader.LoadAssetContainerAsync(BMOD, def.file, scene)
        .then(container => {
          const inst = container.instantiateModelsToScene(n => `bldg_${def.name}_${n}`, false);
          const root = inst.rootNodes[0];
          root.position = new BABYLON.Vector3(cx, 0, cz);
          root.scaling = new BABYLON.Vector3(sc, sc, sc);
          root.rotation.y = def.ry;
          const b = world.buildings.find(b => b.name === def.name);
          if (b) b.glbRoot = root;
        }).catch(e => console.warn('Building load failed:', def.file, e));
    });

    // Porch columns + signs for Dawn Hall and Inn
    const porchMat = new BABYLON.StandardMaterial('porchMat', scene);
    porchMat.diffuseColor = new BABYLON.Color3(0.45, 0.38, 0.22);
    [[33, 41], [37, 41]].forEach(([gx, gz], i) => {
      const wp = world.gridToWorld(gx, gz);
      const col = BABYLON.MeshBuilder.CreateCylinder(`porchCol_${i}`, { height: 3.5, diameter: 0.35 }, scene);
      col.material = porchMat; col.position = new BABYLON.Vector3(wp.x, 1.75, wp.z);
    });
    const dawnSignMat = new BABYLON.StandardMaterial('dawnSignMat', scene);
    dawnSignMat.emissiveColor = new BABYLON.Color3(0.80, 0.55, 0.15);
    const dawnSign = BABYLON.MeshBuilder.CreateBox('dawnSign', { width: 2.0, height: 0.4, depth: 0.1 }, scene);
    dawnSign.material = dawnSignMat;
    dawnSign.position = new BABYLON.Vector3(35 * TILE_SIZE, 4.3, 40 * TILE_SIZE + 0.3);
    const dawnPath = BABYLON.MeshBuilder.CreateGround('dawnPath', { width: 4*TILE_SIZE, height: 3*TILE_SIZE }, scene);
    dawnPath.material = cobbleMat; dawnPath.position = new BABYLON.Vector3(35*TILE_SIZE, 0.02, 42*TILE_SIZE);

    const innSignMat = new BABYLON.StandardMaterial('innSignMat', scene);
    innSignMat.emissiveColor = new BABYLON.Color3(0.55, 0.30, 0.10);
    const innSign = BABYLON.MeshBuilder.CreateBox('innSign', { width: 2.0, height: 0.4, depth: 0.1 }, scene);
    innSign.material = innSignMat;
    innSign.position = new BABYLON.Vector3(66 * TILE_SIZE, 4.3, 41 * TILE_SIZE + 0.3);
    const innPath = BABYLON.MeshBuilder.CreateGround('innPath', { width: 4*TILE_SIZE, height: 3*TILE_SIZE }, scene);
    innPath.material = cobbleMat; innPath.position = new BABYLON.Vector3(66*TILE_SIZE, 0.02, 42*TILE_SIZE);

    // ── NPCS ───────────────────────────────────────────────────
    world._spawnNPC(scene, {
      id: 'soren', name: 'Soren', gx: 33, gz: 36,
      dialogue: [
        'Welcome to the Dawn Hall. Premier guild of New Spring.',
        'We post quests, take contracts, and train adventurers.',
        'Speak to Kim at the counter for available work.'
      ],
      robeColor: new BABYLON.Color3(0.12, 0.12, 0.30),
      accentColor: new BABYLON.Color3(0.80, 0.55, 0.15)
    });
    world._spawnNPC(scene, {
      id: 'kim', name: 'Kim', gx: 36, gz: 37,
      dialogue: [
        'No quests posted yet — check back soon.',
        'Guild membership is open to any willing adventurer.'
      ],
      robeColor: new BABYLON.Color3(0.12, 0.12, 0.30),
      accentColor: new BABYLON.Color3(0.80, 0.55, 0.15)
    });
    world._spawnNPC(scene, {
      id: 'vendor1', name: 'Market Vendor', gx: 44, gz: 44,
      dialogue: ['Fresh goods! Wares coming soon.'],
      robeColor: new BABYLON.Color3(0.40, 0.26, 0.14),
      accentColor: new BABYLON.Color3(0.60, 0.42, 0.20)
    });
    world._spawnNPC(scene, {
      id: 'vendor2', name: 'Reagent Seller', gx: 50, gz: 44,
      dialogue: ['Finest magyk reagents in the region. Stock coming soon.'],
      robeColor: new BABYLON.Color3(0.18, 0.10, 0.28),
      accentColor: new BABYLON.Color3(0.55, 0.30, 0.70)
    });
    world._spawnNPC(scene, {
      id: 'vendor3', name: 'Food Merchant', gx: 56, gz: 44,
      dialogue: ['Fresh bread and provisions. Come back when stock arrives.'],
      robeColor: new BABYLON.Color3(0.55, 0.46, 0.30),
      accentColor: new BABYLON.Color3(0.70, 0.60, 0.35)
    });
  },

  _buildBuilding(scene, name, gx, gz, w, d, floors, wallColor, roofColor, doorSide, doorWidth, options = {}) {
    const worldW = w * TILE_SIZE;
    const worldD = d * TILE_SIZE;
    const originX = gx * TILE_SIZE;
    const originZ = gz * TILE_SIZE;
    const centerX = originX + worldW / 2;
    const centerZ = originZ + worldD / 2;

    // Register building bounds for roof transparency
    const buildingEntry = { name, gxMin: gx, gxMax: gx + w, gzMin: gz, gzMax: gz + d, roofMeshes: [], glbRoot: null };
    world.buildings.push(buildingEntry);

    // Mark perimeter as obstacles (door tiles left walkable)
    const doorTiles = new Set();
    const midGx = Math.round(gx + w / 2), midGz = Math.round(gz + d / 2);
    if (doorSide === 'south') for (let dx = 0; dx < doorWidth; dx++) doorTiles.add(`${midGx - Math.floor(doorWidth/2) + dx},${gz + d}`);
    if (doorSide === 'north') for (let dx = 0; dx < doorWidth; dx++) doorTiles.add(`${midGx - Math.floor(doorWidth/2) + dx},${gz}`);
    if (doorSide === 'east')  for (let dz = 0; dz < doorWidth; dz++) doorTiles.add(`${gx + w},${midGz - Math.floor(doorWidth/2) + dz}`);
    if (doorSide === 'west')  for (let dz = 0; dz < doorWidth; dz++) doorTiles.add(`${gx},${midGz - Math.floor(doorWidth/2) + dz}`);
    for (let x = gx; x <= gx + w; x++) {
      const kN = `${x},${gz}`, kS = `${x},${gz + d}`;
      if (!doorTiles.has(kN)) state.obstacles.add(kN);
      if (!doorTiles.has(kS)) state.obstacles.add(kS);
    }
    for (let z = gz; z <= gz + d; z++) {
      const kW = `${gx},${z}`, kE = `${gx + w},${z}`;
      if (!doorTiles.has(kW)) state.obstacles.add(kW);
      if (!doorTiles.has(kE)) state.obstacles.add(kE);
    }

    // If replaced by a GLB, skip all visual mesh creation
    if (options.glbReplaced) return;

    const wallT = 0.3;
    const floorH = 3.0;
    const totalH = floors * floorH;
    const doorH = 2.6;
    const doorWW = doorWidth * TILE_SIZE;

    const wallMat = new BABYLON.StandardMaterial(`wallMat_${name}`, scene);
    wallMat.specularColor = new BABYLON.Color3(0.02, 0.02, 0.02);
    { const bTex = new BABYLON.DynamicTexture(`brickTex_${name}`, { width: 256, height: 256 }, scene);
      const bc = bTex.getContext();
      const r = Math.round(wallColor.r * 255), g = Math.round(wallColor.g * 255), b = Math.round(wallColor.b * 255);
      const dark = `rgb(${Math.max(0,r-28)},${Math.max(0,g-22)},${Math.max(0,b-18)})`;
      const mid  = `rgb(${r},${g},${b})`;
      const lite = `rgb(${Math.min(255,r+22)},${Math.min(255,g+18)},${Math.min(255,b+14)})`;
      bc.fillStyle = dark; bc.fillRect(0, 0, 256, 256);
      const BW = 30, BH = 13, GAP = 3;
      for (let row = 0; row * (BH + GAP) < 256; row++) {
        const ox = (row % 2) * (BW / 2 + GAP / 2);
        for (let col = -1; col * (BW + GAP) < 256; col++) {
          const bx = col * (BW + GAP) + ox + GAP, by = row * (BH + GAP) + GAP;
          const shade = ((row * 7 + col * 13) % 3 === 0) ? lite : mid;
          bc.fillStyle = shade;
          bc.fillRect(bx, by, BW, BH);
        }
      }
      bTex.update();
      bTex.uScale = Math.max(2, Math.round(worldW / 2));
      bTex.vScale = Math.max(2, Math.round(totalH / 1.5));
      wallMat.diffuseTexture = bTex;
      wallMat.diffuseColor = new BABYLON.Color3(1, 1, 1);
    }

    const roofMat = new BABYLON.StandardMaterial(`roofMat_${name}`, scene);
    { const rTex = new BABYLON.DynamicTexture(`roofTex_${name}`, { width: 128, height: 64 }, scene);
      const rc = rTex.getContext();
      const r = Math.round(roofColor.r * 255), g = Math.round(roofColor.g * 255), b = Math.round(roofColor.b * 255);
      rc.fillStyle = `rgb(${r},${g},${b})`; rc.fillRect(0, 0, 128, 64);
      rc.fillStyle = `rgb(${Math.max(0,r-20)},${Math.max(0,g-16)},${Math.max(0,b-12)})`;
      for (let row = 0; row < 8; row++) {
        const ox = (row % 2) * 8;
        for (let col = 0; col < 10; col++) {
          rc.fillRect(col * 16 + ox, row * 8 + 1, 14, 6);
        }
      }
      rTex.update(); rTex.uScale = 4; rTex.vScale = 2;
      roofMat.diffuseTexture = rTex;
    }

    const floorMat = new BABYLON.StandardMaterial(`floorMat_${name}`, scene);
    floorMat.diffuseColor = new BABYLON.Color3(0.28, 0.20, 0.10);

    // Floor
    const floor = BABYLON.MeshBuilder.CreateBox(`floor_${name}`, { width: worldW, height: 0.1, depth: worldD }, scene);
    floor.material = floorMat;
    floor.position = new BABYLON.Vector3(centerX, 0.05, centerZ);

    // Helper to create a wall segment
    const makeWall = (wname, wx, wy, wz, ww, wh, wd) => {
      const m = BABYLON.MeshBuilder.CreateBox(wname, { width: ww, height: wh, depth: wd }, scene);
      m.material = wallMat;
      m.position = new BABYLON.Vector3(wx, wy, wz);
    };

    // Build 4 walls with optional door gap
    const buildWall = (side) => {
      const hasDoor = (side === doorSide);
      if (side === 'north') {
        // north wall: z = originZ, x spans worldW
        if (!hasDoor) {
          makeWall(`wall_${name}_N`, centerX, totalH / 2, originZ + wallT / 2, worldW, totalH, wallT);
        } else {
          const gapCenterX = centerX; // centered
          const halfTotal = worldW / 2;
          const halfGap = doorWW / 2;
          // left piece
          const leftW = halfTotal - halfGap;
          makeWall(`wall_${name}_NL`, originX + leftW / 2, totalH / 2, originZ + wallT / 2, leftW, totalH, wallT);
          // right piece
          makeWall(`wall_${name}_NR`, originX + halfTotal + halfGap + (halfTotal - halfGap) / 2, totalH / 2, originZ + wallT / 2, leftW, totalH, wallT);
          // lintel
          const lintelH = totalH - doorH;
          if (lintelH > 0) {
            makeWall(`wall_${name}_NLint`, gapCenterX, doorH + lintelH / 2, originZ + wallT / 2, doorWW, lintelH, wallT);
          }
          // Mark door tiles walkable (don't add to obstacles)
          // door tiles at north wall center
          for (let dx = 0; dx < doorWidth; dx++) {
            // don't add to obstacles — leave walkable
          }
        }
      } else if (side === 'south') {
        const wallZ = originZ + worldD - wallT / 2;
        if (!hasDoor) {
          makeWall(`wall_${name}_S`, centerX, totalH / 2, wallZ, worldW, totalH, wallT);
        } else {
          const halfTotal = worldW / 2;
          const halfGap = doorWW / 2;
          const leftW = halfTotal - halfGap;
          makeWall(`wall_${name}_SL`, originX + leftW / 2, totalH / 2, wallZ, leftW, totalH, wallT);
          makeWall(`wall_${name}_SR`, originX + halfTotal + halfGap + (halfTotal - halfGap) / 2, totalH / 2, wallZ, leftW, totalH, wallT);
          const lintelH = totalH - doorH;
          if (lintelH > 0) makeWall(`wall_${name}_SLint`, centerX, doorH + lintelH / 2, wallZ, doorWW, lintelH, wallT);
        }
      } else if (side === 'west') {
        const wallX = originX + wallT / 2;
        if (!hasDoor) {
          makeWall(`wall_${name}_W`, wallX, totalH / 2, centerZ, wallT, totalH, worldD - wallT * 2);
        } else {
          const halfTotal = worldD / 2;
          const halfGap = doorWW / 2;
          const pieceD = halfTotal - halfGap;
          makeWall(`wall_${name}_WL`, wallX, totalH / 2, originZ + wallT + pieceD / 2, wallT, totalH, pieceD);
          makeWall(`wall_${name}_WR`, wallX, totalH / 2, originZ + worldD - wallT - pieceD / 2, wallT, totalH, pieceD);
          const lintelH = totalH - doorH;
          if (lintelH > 0) makeWall(`wall_${name}_WLint`, wallX, doorH + lintelH / 2, centerZ, wallT, lintelH, doorWW);
        }
      } else if (side === 'east') {
        const wallX = originX + worldW - wallT / 2;
        if (!hasDoor) {
          makeWall(`wall_${name}_E`, wallX, totalH / 2, centerZ, wallT, totalH, worldD - wallT * 2);
        } else {
          const halfTotal = worldD / 2;
          const halfGap = doorWW / 2;
          const pieceD = halfTotal - halfGap;
          makeWall(`wall_${name}_EL`, wallX, totalH / 2, originZ + wallT + pieceD / 2, wallT, totalH, pieceD);
          makeWall(`wall_${name}_ER`, wallX, totalH / 2, originZ + worldD - wallT - pieceD / 2, wallT, totalH, pieceD);
          const lintelH = totalH - doorH;
          if (lintelH > 0) makeWall(`wall_${name}_ELint`, wallX, doorH + lintelH / 2, centerZ, wallT, lintelH, doorWW);
        }
      }
    };

    // Build north and south walls (full width)
    ['north', 'south'].forEach(side => buildWall(side));

    // Build east and west walls (inset to not overlap corners)
    const makeEWWall = (side) => {
      const hasDoor = (side === doorSide);
      const wallX = side === 'west' ? originX + wallT / 2 : originX + worldW - wallT / 2;
      const innerD = worldD - wallT * 2; // inset at corners
      const innerOriginZ = originZ + wallT;
      const innerCenterZ = originZ + wallT + innerD / 2;
      if (!hasDoor) {
        makeWall(`wall_${name}_${side === 'west' ? 'Ww' : 'Ew'}`, wallX, totalH / 2, innerCenterZ, wallT, totalH, innerD);
      } else {
        const halfTotal = innerD / 2;
        const halfGap = doorWW / 2;
        const pieceD = halfTotal - halfGap;
        const suf = side === 'west' ? 'W' : 'E';
        makeWall(`wall_${name}_${suf}L`, wallX, totalH / 2, innerOriginZ + pieceD / 2, wallT, totalH, pieceD);
        makeWall(`wall_${name}_${suf}R`, wallX, totalH / 2, innerOriginZ + innerD - pieceD / 2, wallT, totalH, pieceD);
        const lintelH = totalH - doorH;
        if (lintelH > 0) makeWall(`wall_${name}_${suf}Lint`, wallX, doorH + lintelH / 2, innerCenterZ, wallT, lintelH, doorWW);
      }
    };
    makeEWWall('west');
    makeEWWall('east');

    // Floor dividers for multi-story
    for (let f = 1; f < floors; f++) {
      const divY = f * floorH;
      const div = BABYLON.MeshBuilder.CreateBox(`floorDiv_${name}_${f}`, { width: worldW - wallT * 2, height: 0.15, depth: worldD - wallT * 2 }, scene);
      div.material = floorMat;
      div.position = new BABYLON.Vector3(centerX, divY, centerZ);
    }

    // Pitched roof, timber framing, windows
    const roofMeshes = world._addPitchedRoof(scene, name, centerX, centerZ, worldW, worldD, totalH, roofMat, options);
    world._addTimberFraming(scene, name, centerX, centerZ, originX, originZ, worldW, worldD, totalH, floors, floorH);
    world._addWindows(scene, name, worldW, worldD, floors, floorH, wallT, originX, originZ, centerX, centerZ, doorSide, doorWidth);

    // Store roofMeshes on the pre-registered building entry
    const bEntry = world.buildings.find(b => b.name === name);
    if (bEntry) bEntry.roofMeshes = roofMeshes;

  },

  _addPitchedRoof(scene, name, centerX, centerZ, worldW, worldD, totalH, roofMat, options = {}) {
    const roofH = Math.max(1.4, worldW * 0.18);
    const overhang = 0.5;
    const meshes = [];

    const profile = [
      new BABYLON.Vector3(-(worldW / 2 + overhang), 0, 0),
      new BABYLON.Vector3(0, roofH, 0),
      new BABYLON.Vector3(worldW / 2 + overhang, 0, 0),
    ];
    const path = [
      new BABYLON.Vector3(0, 0, 0),
      new BABYLON.Vector3(0, 0, worldD + overhang * 2),
    ];
    const roofMesh = BABYLON.MeshBuilder.ExtrudeShape(`roof_${name}`, {
      shape: profile, path, closeShape: true, cap: BABYLON.Mesh.CAP_ALL
    }, scene);
    roofMesh.material = roofMat;
    roofMesh.position = new BABYLON.Vector3(centerX, totalH, centerZ - worldD / 2 - overhang);
    meshes.push(roofMesh);

    // Ridge cap
    const ridgeMat = new BABYLON.StandardMaterial(`ridgeMat_${name}`, scene);
    ridgeMat.diffuseColor = roofMat.diffuseColor.scale(0.65);
    const ridge = BABYLON.MeshBuilder.CreateBox(`ridge_${name}`, {
      width: 0.22, height: 0.2, depth: worldD + overhang * 2 + 0.3
    }, scene);
    ridge.material = ridgeMat;
    ridge.position = new BABYLON.Vector3(centerX, totalH + roofH + 0.08, centerZ);
    meshes.push(ridge);

    // Chimney (skip on very large buildings unless forced)
    if (options.chimney !== false) {
      const chimMat = new BABYLON.StandardMaterial(`chimMat_${name}`, scene);
      chimMat.diffuseColor = new BABYLON.Color3(0.30, 0.23, 0.16);
      const chimH = roofH * 0.65 + 0.9;
      const chim = BABYLON.MeshBuilder.CreateBox(`chimney_${name}`, {
        width: 0.55, height: chimH, depth: 0.55
      }, scene);
      chim.material = chimMat;
      chim.position = new BABYLON.Vector3(
        centerX + worldW * 0.18,
        totalH + roofH * 0.28 + chimH / 2 - 0.25,
        centerZ - worldD * 0.12
      );
      meshes.push(chim);
      const capMat = new BABYLON.StandardMaterial(`chimCapMat_${name}`, scene);
      capMat.diffuseColor = new BABYLON.Color3(0.20, 0.15, 0.10);
      const cap = BABYLON.MeshBuilder.CreateBox(`chimneyCap_${name}`, {
        width: 0.72, height: 0.12, depth: 0.72
      }, scene);
      cap.material = capMat;
      cap.position = new BABYLON.Vector3(
        centerX + worldW * 0.18,
        totalH + roofH * 0.28 + chimH - 0.19,
        centerZ - worldD * 0.12
      );
      meshes.push(cap);
    }
    return meshes;
  },

  _addTimberFraming(scene, name, centerX, centerZ, originX, originZ, worldW, worldD, totalH, floors, floorH) {
    const timberMat = new BABYLON.StandardMaterial(`timberMat_${name}`, scene);
    timberMat.diffuseColor = new BABYLON.Color3(0.16, 0.10, 0.04);
    timberMat.specularColor = new BABYLON.Color3(0, 0, 0);
    const t = 0.11;

    const beamYs = [0.08];
    for (let f = 1; f <= floors; f++) beamYs.push(f * floorH);

    beamYs.forEach((y, bi) => {
      const bn = BABYLON.MeshBuilder.CreateBox(`tfrHN_${name}_${bi}`, { width: worldW + t, height: t, depth: t }, scene);
      bn.material = timberMat; bn.position = new BABYLON.Vector3(centerX, y, originZ);
      const bs = BABYLON.MeshBuilder.CreateBox(`tfrHS_${name}_${bi}`, { width: worldW + t, height: t, depth: t }, scene);
      bs.material = timberMat; bs.position = new BABYLON.Vector3(centerX, y, originZ + worldD);
      const bw = BABYLON.MeshBuilder.CreateBox(`tfrHW_${name}_${bi}`, { width: t, height: t, depth: worldD + t }, scene);
      bw.material = timberMat; bw.position = new BABYLON.Vector3(originX, y, centerZ);
      const be = BABYLON.MeshBuilder.CreateBox(`tfrHE_${name}_${bi}`, { width: t, height: t, depth: worldD + t }, scene);
      be.material = timberMat; be.position = new BABYLON.Vector3(originX + worldW, y, centerZ);
    });

    [[originX, originZ], [originX + worldW, originZ],
     [originX, originZ + worldD], [originX + worldW, originZ + worldD]].forEach(([x, z], ci) => {
      const post = BABYLON.MeshBuilder.CreateBox(`tfrVC_${name}_${ci}`, { width: t, height: totalH, depth: t }, scene);
      post.material = timberMat;
      post.position = new BABYLON.Vector3(x, totalH / 2, z);
    });

    const sp = TILE_SIZE * 2;
    const numNS = Math.floor(worldW / sp) - 1;
    for (let pi = 0; pi < numNS; pi++) {
      const px = originX + sp * (pi + 1);
      const pN = BABYLON.MeshBuilder.CreateBox(`tfrVN_${name}_${pi}`, { width: t, height: totalH, depth: t }, scene);
      pN.material = timberMat; pN.position = new BABYLON.Vector3(px, totalH / 2, originZ);
      const pS = BABYLON.MeshBuilder.CreateBox(`tfrVS_${name}_${pi}`, { width: t, height: totalH, depth: t }, scene);
      pS.material = timberMat; pS.position = new BABYLON.Vector3(px, totalH / 2, originZ + worldD);
    }
    const numEW = Math.floor(worldD / sp) - 1;
    for (let pi = 0; pi < numEW; pi++) {
      const pz = originZ + sp * (pi + 1);
      const pW = BABYLON.MeshBuilder.CreateBox(`tfrVW_${name}_${pi}`, { width: t, height: totalH, depth: t }, scene);
      pW.material = timberMat; pW.position = new BABYLON.Vector3(originX, totalH / 2, pz);
      const pE = BABYLON.MeshBuilder.CreateBox(`tfrVE_${name}_${pi}`, { width: t, height: totalH, depth: t }, scene);
      pE.material = timberMat; pE.position = new BABYLON.Vector3(originX + worldW, totalH / 2, pz);
    }
  },

  _addWindows(scene, name, worldW, worldD, floors, floorH, wallT, originX, originZ, centerX, centerZ, doorSide, doorWidth) {
    const winMat = new BABYLON.StandardMaterial(`winMat_${name}`, scene);
    winMat.diffuseColor = new BABYLON.Color3(0.04, 0.06, 0.14);
    winMat.emissiveColor = new BABYLON.Color3(0.02, 0.04, 0.10);
    winMat.specularColor = new BABYLON.Color3(0, 0, 0);

    const frameMat = new BABYLON.StandardMaterial(`winFrMat_${name}`, scene);
    frameMat.diffuseColor = new BABYLON.Color3(0.16, 0.10, 0.04);
    frameMat.specularColor = new BABYLON.Color3(0, 0, 0);

    const wW = 0.55, wH = 0.72, fT = 0.09;
    const doorWW = doorWidth * TILE_SIZE;

    const addWin = (wname, x, y, z, isNS) => {
      const pane = BABYLON.MeshBuilder.CreateBox(wname, {
        width: isNS ? wW : (wallT * 0.8), height: wH, depth: isNS ? (wallT * 0.8) : wW
      }, scene);
      pane.material = winMat;
      pane.position = new BABYLON.Vector3(x, y, z);
      const frame = BABYLON.MeshBuilder.CreateBox(`${wname}Fr`, {
        width: isNS ? (wW + fT * 2) : (wallT * 0.9), height: wH + fT * 2, depth: isNS ? (wallT * 0.9) : (wW + fT * 2)
      }, scene);
      frame.material = frameMat;
      frame.position = new BABYLON.Vector3(x, y, z);
    };

    for (let f = 0; f < floors; f++) {
      const winY = f * floorH + floorH * 0.55;
      const isDoorFloor = (f === 0);
      const numNS = Math.max(1, Math.floor(worldW / (TILE_SIZE * 2.5)));
      const numEW = Math.max(1, Math.floor(worldD / (TILE_SIZE * 2.5)));

      for (let wi = 0; wi < numNS; wi++) {
        const tx = (wi + 1) / (numNS + 1);
        const wx = originX + worldW * tx;
        if (!(doorSide === 'north' && isDoorFloor && Math.abs(wx - centerX) < doorWW / 2 + 0.5))
          addWin(`winN_${name}_${f}_${wi}`, wx, winY, originZ, true);
        if (!(doorSide === 'south' && isDoorFloor && Math.abs(wx - centerX) < doorWW / 2 + 0.5))
          addWin(`winS_${name}_${f}_${wi}`, wx, winY, originZ + worldD, true);
      }
      for (let wi = 0; wi < numEW; wi++) {
        const tz = (wi + 1) / (numEW + 1);
        const wz = originZ + worldD * tz;
        if (!(doorSide === 'west' && isDoorFloor && Math.abs(wz - centerZ) < doorWW / 2 + 0.5))
          addWin(`winW_${name}_${f}_${wi}`, originX, winY, wz, false);
        if (!(doorSide === 'east' && isDoorFloor && Math.abs(wz - centerZ) < doorWW / 2 + 0.5))
          addWin(`winE_${name}_${f}_${wi}`, originX + worldW, winY, wz, false);
      }
    }
  },

  _loadProp(scene, modelName, gx, gz, { scale = 0.01, ry = 0, basePath = 'assets/models/' } = {}) {
    const wp = world.gridToWorld(gx, gz);
    const filename = modelName.endsWith('.glb') ? modelName : modelName + '.glb';
    BABYLON.SceneLoader.ImportMeshAsync('', basePath, filename, scene).then(result => {
      const root = result.meshes[0];
      root.position = new BABYLON.Vector3(wp.x, 0, wp.z);
      root.scaling = new BABYLON.Vector3(scale, scale, scale);
      root.rotation.y = ry;
    }).catch(err => console.warn('Failed to load prop ' + modelName, err));
  },

  _buildStall(scene, gx, gz, idx) {
    const tableMat = new BABYLON.StandardMaterial(`stallTableMat_${idx}`, scene);
    tableMat.diffuseColor = new BABYLON.Color3(0.40, 0.28, 0.14);
    const awningMat = new BABYLON.StandardMaterial(`stallAwningMat_${idx}`, scene);
    awningMat.diffuseColor = new BABYLON.Color3(0.72, 0.55, 0.15);
    awningMat.emissiveColor = new BABYLON.Color3(0.20, 0.15, 0.04);
    const poleMat = new BABYLON.StandardMaterial(`stallPoleMat_${idx}`, scene);
    poleMat.diffuseColor = new BABYLON.Color3(0.30, 0.20, 0.08);
    const goodsMat = new BABYLON.StandardMaterial(`stallGoodsMat_${idx}`, scene);
    goodsMat.diffuseColor = new BABYLON.Color3(0.55, 0.32, 0.18);

    const wp = world.gridToWorld(gx, gz);
    const cx = wp.x;
    const cz = wp.z;

    // Table
    const table = BABYLON.MeshBuilder.CreateBox(`stallTable_${idx}`, { width: 1.8, height: 0.1, depth: 0.9 }, scene);
    table.material = tableMat;
    table.position = new BABYLON.Vector3(cx, 0.8, cz);

    // Table legs
    [[0.8, 0.4], [-0.8, 0.4], [0.8, -0.4], [-0.8, -0.4]].forEach(([ox, oz], li) => {
      const leg = BABYLON.MeshBuilder.CreateBox(`stallLeg_${idx}_${li}`, { width: 0.08, height: 0.8, depth: 0.08 }, scene);
      leg.material = poleMat;
      leg.position = new BABYLON.Vector3(cx + ox, 0.4, cz + oz);
    });

    // Awning
    const awning = BABYLON.MeshBuilder.CreateBox(`stallAwning_${idx}`, { width: 2.2, height: 0.08, depth: 1.4 }, scene);
    awning.material = awningMat;
    awning.position = new BABYLON.Vector3(cx, 2.4, cz);

    // 2 poles
    [[-0.9, 0], [0.9, 0]].forEach(([ox, oz], pi) => {
      const pole = BABYLON.MeshBuilder.CreateCylinder(`stallPole_${idx}_${pi}`, { height: 2.4, diameter: 0.08 }, scene);
      pole.material = poleMat;
      pole.position = new BABYLON.Vector3(cx + ox, 1.2, cz + oz);
    });

    // Goods boxes on table
    [[-0.5, 0.05], [0.0, 0.05], [0.5, 0.05]].forEach(([ox, oz], gi) => {
      const goods = BABYLON.MeshBuilder.CreateBox(`stallGoods_${idx}_${gi}`, { width: 0.3, height: 0.2, depth: 0.3 }, scene);
      goods.material = goodsMat;
      goods.position = new BABYLON.Vector3(cx + ox, 0.95, cz + oz);
    });
  },

  _spawnNPC(scene, { id, name, gx, gz, dialogue, robeColor, accentColor }) {
    const wp = world.gridToWorld(gx, gz);
    state.obstacles.add(`${gx},${gz}`);

    const root = new BABYLON.TransformNode(`npc_${id}`, scene);
    root.position = new BABYLON.Vector3(wp.x, 0, wp.z);
    world.npcs.push({ id, name, gx, gz, dialogue, mesh: root, dialogueIndex: 0 });

    const robeMat = new BABYLON.StandardMaterial(`npcRobeMat_${id}`, scene);
    robeMat.diffuseColor = robeColor;
    const headMat = new BABYLON.StandardMaterial(`npcHeadMat_${id}`, scene);
    headMat.diffuseColor = new BABYLON.Color3(0.80, 0.65, 0.50);
    const accentMat = new BABYLON.StandardMaterial(`npcAccentMat_${id}`, scene);
    accentMat.diffuseColor = accentColor;
    accentMat.emissiveColor = accentColor.scale(0.3);

    const body = BABYLON.MeshBuilder.CreateBox(`npcBody_${id}`, { width: 0.52, height: 1.1, depth: 0.36 }, scene);
    body.material = robeMat; body.position.y = 0.75; body.parent = root;
    body.metadata = { npcId: id };

    const skirt = BABYLON.MeshBuilder.CreateCylinder(`npcSkirt_${id}`, { height: 0.5, diameterTop: 0.52, diameterBottom: 0.72, tessellation: 8 }, scene);
    skirt.material = robeMat; skirt.position.y = 0.25; skirt.parent = root;
    skirt.metadata = { npcId: id };

    const head = BABYLON.MeshBuilder.CreateSphere(`npcHead_${id}`, { diameter: 0.42, segments: 8 }, scene);
    head.material = headMat; head.position.y = 1.52; head.parent = root;
    head.metadata = { npcId: id };

    const orb = BABYLON.MeshBuilder.CreateSphere(`npcOrb_${id}`, { diameter: 0.14, segments: 6 }, scene);
    orb.material = accentMat; orb.position = new BABYLON.Vector3(0.32, 1.15, 0); orb.parent = root;
    orb.metadata = { npcId: id };
  },

  checkRoofTransparency() {
    const pgx = state.player.gx;
    const pgz = state.player.gz;
    for (const b of world.buildings) {
      const inside = pgx > b.gxMin && pgx < b.gxMax && pgz > b.gzMin && pgz < b.gzMax;
      if (b.roofMeshes) for (const m of b.roofMeshes) m.isVisible = !inside;
      if (b.glbRoot) b.glbRoot.setEnabled(!inside);
    }
  },

  onPlayerStep() {
    world.checkRoofTransparency();
    if (world._transitioning) return;
    const { gx, gz } = state.player;
    let msg = null;
    if (gz <= 5  && gx >= 47 && gx <= 53) msg = 'You follow the road north toward Sygldry Academy...';
    else if (gz >= 95 && gx >= 47 && gx <= 53) msg = 'The south road winds toward The Heir\'s School...';
    else if (gx <= 5  && gz >= 47 && gz <= 53) msg = 'The west road winds into the open countryside...';
    else if (gx >= 95 && gz >= 47 && gz <= 53) msg = 'The east road leads toward Whitehaven...';
    if (msg) {
      world._transitioning = true;
      log(msg, 'system');
      setTimeout(() => { world._transitioning = false; }, 3000);
    }
  },

  buildPlayerMesh() {
    const scene = state.scene;
    const accent = SYGLS[state.player.sygl].accentRGB;
    const accentColor = new BABYLON.Color3(accent[0]/255, accent[1]/255, accent[2]/255);
    const startWP = world.gridToWorld(state.player.gx, state.player.gz);

    const root = new BABYLON.TransformNode('playerRoot', scene);
    root.position = new BABYLON.Vector3(startWP.x, 0, startWP.z);

    const capMat = new BABYLON.StandardMaterial('plrCapMat', scene);
    capMat.diffuseColor = new BABYLON.Color3(0.12, 0.09, 0.07);
    const body = BABYLON.MeshBuilder.CreateCylinder('plrBody', { height: 1.1, diameterTop: 0.42, diameterBottom: 0.58, tessellation: 10 }, scene);
    body.material = capMat; body.position.y = 0.75; body.parent = root;

    const headMat = new BABYLON.StandardMaterial('plrHeadMat', scene);
    headMat.diffuseColor = new BABYLON.Color3(0.80, 0.65, 0.50);
    const head = BABYLON.MeshBuilder.CreateSphere('plrHead', { diameter: 0.44, segments: 8 }, scene);
    head.material = headMat; head.position.y = 1.52; head.parent = root;

    const glowMat = new BABYLON.StandardMaterial('plrGlowMat', scene);
    glowMat.emissiveColor = accentColor;
    glowMat.diffuseColor = accentColor;
    const orb = BABYLON.MeshBuilder.CreateSphere('staffOrb', { diameter: 0.22, segments: 8 }, scene);
    orb.material = glowMat; orb.position = new BABYLON.Vector3(0.38, 1.2, 0); orb.parent = root;

    const glowLight = new BABYLON.PointLight('plrGlL', new BABYLON.Vector3(0.38, 1.2, 0), scene);
    glowLight.diffuse = accentColor;
    glowLight.intensity = 0.5;
    glowLight.range = 5;
    glowLight.parent = root;

    state.playerMesh = root;
    state.playerTargetPos = new BABYLON.Vector3(startWP.x, 0, startWP.z);
  },

  spawnEnemy(e) {
    const scene = state.scene;
    state.enemies.push(e);
    const root = new BABYLON.TransformNode(`en_${e.id}`, scene);

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

    const faceMat = new BABYLON.StandardMaterial('faceMat', scene);
    faceMat.diffuseColor = new BABYLON.Color3(0.1, 0.05, 0.03);
    [[-0.1, 1.15, 0.3],[0.1, 1.15, 0.3]].forEach(([x,y,z],i) => {
      const eye = BABYLON.MeshBuilder.CreateSphere(`eye${i}`, { diameter: 0.06 }, scene);
      eye.material = faceMat;
      eye.position = new BABYLON.Vector3(x,y,z);
      eye.parent = root;
    });

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
      if (ignoreEnemy && ignoreEnemy.gx === gx && ignoreEnemy.gz === gz) return true;
      return false;
    }
    return true;
  },

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

    // Did we click an NPC?
    if (pick.pickedMesh) {
      const npcId = (pick.pickedMesh.metadata && pick.pickedMesh.metadata.npcId) ||
        (() => { let n = pick.pickedMesh; while (n && !n.name.startsWith('npc_')) n = n.parent; return n ? n.name.slice(4) : null; })();
      const npc = npcId ? world.npcs.find(n => n.id === npcId) : null;
      if (npc) {
        log(`${npc.name}: "${npc.dialogue[npc.dialogueIndex % npc.dialogue.length]}"`, 'system');
        npc.dialogueIndex++;
        return;
      }
    }

    if (pick.pickedPoint) {
      const { gx, gz } = world.worldToGrid(pick.pickedPoint.x, pick.pickedPoint.z);
      actions.walkTo(gx, gz, ev.clientX, ev.clientY);
    }
  },

  handleLongPress(ev) {
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

    let npcClicked = null;
    if (!enemyClicked && pick.pickedMesh) {
      const npcId = (pick.pickedMesh.metadata && pick.pickedMesh.metadata.npcId) ||
        (() => { let n = pick.pickedMesh; while (n && !n.name.startsWith('npc_')) n = n.parent; return n ? n.name.slice(4) : null; })();
      npcClicked = npcId ? world.npcs.find(n => n.id === npcId) : null;
    }

    if (enemyClicked) {
      ctxMenu.showForEnemy(ev.clientX, ev.clientY, enemyClicked);
    } else if (npcClicked) {
      ctxMenu.showForNpc(ev.clientX, ev.clientY, npcClicked);
    } else if (pick.pickedPoint) {
      const { gx, gz } = world.worldToGrid(pick.pickedPoint.x, pick.pickedPoint.z);
      ctxMenu.showForTile(ev.clientX, ev.clientY, gx, gz);
    }
  }
};
