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

    const cam = new BABYLON.ArcRotateCamera('cam', -Math.PI / 2, Math.PI / 3.2, 22, BABYLON.Vector3.Zero(), scene);
    cam.lowerRadiusLimit = 8;
    cam.upperRadiusLimit = 45;
    cam.lowerBetaLimit = 0.35;
    cam.upperBetaLimit = Math.PI / 2.4;
    cam.wheelPrecision = 30;
    cam.panningSensibility = 0;
    cam.attachControl(canvas, true);
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

    let downX = 0, downY = 0, downTime = 0, downButton = 0, downId = null;
    const TAP_MOVE_MAX = 10;
    const TAP_TIME_MAX = 350;

    canvas.addEventListener('pointerdown', (ev) => {
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
        world.handleTap(ev);
      }
    });

    canvas.addEventListener('contextmenu', e => e.preventDefault());
  },

  _buildGround(scene) {
    const groundMat = new BABYLON.StandardMaterial('groundMat', scene);
    groundMat.diffuseColor = new BABYLON.Color3(0.22, 0.28, 0.14);
    groundMat.specularColor = new BABYLON.Color3(0.03, 0.03, 0.03);
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
    // Materials reused
    const cobbleMat = new BABYLON.StandardMaterial('cobbleMat', scene);
    cobbleMat.diffuseColor = new BABYLON.Color3(0.36, 0.31, 0.24);
    cobbleMat.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05);

    const treeMat = new BABYLON.StandardMaterial('treeMat', scene);
    treeMat.diffuseColor = new BABYLON.Color3(0.08, 0.18, 0.06);
    treeMat.specularColor = new BABYLON.Color3(0, 0, 0);
    const trunkMat = new BABYLON.StandardMaterial('trunkMat', scene);
    trunkMat.diffuseColor = new BABYLON.Color3(0.18, 0.11, 0.05);
    trunkMat.specularColor = new BABYLON.Color3(0, 0, 0);

    const stoneMat = new BABYLON.StandardMaterial('stoneMat', scene);
    stoneMat.diffuseColor = new BABYLON.Color3(0.45, 0.4, 0.32);

    const torchMat = new BABYLON.StandardMaterial('torchMat', scene);
    torchMat.diffuseColor = new BABYLON.Color3(0.25, 0.15, 0.08);
    const torchFlameMat = new BABYLON.StandardMaterial('torchFlameMat', scene);
    torchFlameMat.emissiveColor = new BABYLON.Color3(1, 0.6, 0.2);
    torchFlameMat.diffuseColor = new BABYLON.Color3(1, 0.5, 0.1);

    const placeTree = (gx, gz, suffix) => {
      const key = `${gx},${gz}`;
      if (state.obstacles.has(key)) return;
      state.obstacles.add(key);
      const wp = world.gridToWorld(gx, gz);
      const id = suffix || `${gx}_${gz}`;
      const trunk = BABYLON.MeshBuilder.CreateCylinder(`tr_${id}`, { height: 1.4, diameterTop: 0.35, diameterBottom: 0.5 }, scene);
      trunk.material = trunkMat;
      trunk.position = new BABYLON.Vector3(wp.x, 0.7, wp.z);
      const canopy = BABYLON.MeshBuilder.CreateSphere(`tc_${id}`, { diameter: 2.6, segments: 6 }, scene);
      canopy.material = treeMat;
      canopy.position = new BABYLON.Vector3(wp.x, 2.0, wp.z);
      canopy.scaling.y = 1.3;
    };

    // Border trees (outer 2 tiles)
    for (let i = 0; i < GRID_SIZE; i++) {
      placeTree(0, i); placeTree(1, i);
      placeTree(GRID_SIZE - 1, i); placeTree(GRID_SIZE - 2, i);
      placeTree(i, 0); placeTree(i, 1);
      placeTree(i, GRID_SIZE - 1); placeTree(i, GRID_SIZE - 2);
    }

    // Road-side trees gx=47,48 and gx=52,53 every 3 tiles from gz=6 to gz=46
    for (let gz = 6; gz <= 46; gz += 3) {
      [47, 48, 52, 53].forEach(gx => placeTree(gx, gz));
    }

    // Scattered clusters in wilderness (avoid building zones and road)
    const scatterTrees = [
      [10,10],[11,10],[10,11],[20,15],[21,15],[20,16],
      [70,20],[71,20],[70,21],[80,30],[81,30],
      [15,70],[16,70],[15,71],[85,70],[85,71],[86,70],
      [25,85],[26,85],[25,86],[75,85],[76,85],
      [10,50],[11,50],[10,51],[90,50],[91,50]
    ];
    scatterTrees.forEach(([gx,gz]) => placeTree(gx, gz));

    // North Road cobblestone: gx=49..51, gz=6..48
    const roadW = 3 * TILE_SIZE;
    const roadH = 43 * TILE_SIZE;
    const roadPatch = BABYLON.MeshBuilder.CreateGround('northRoad', { width: roadW, height: roadH }, scene);
    roadPatch.material = cobbleMat;
    const roadCenterGx = 50; // center of 49-51
    const roadCenterGz = (6 + 48) / 2;
    const roadWP = world.gridToWorld(roadCenterGx, Math.round(roadCenterGz));
    roadPatch.position = new BABYLON.Vector3(roadWP.x, 0.01, roadCenterGz * TILE_SIZE);

    // Zone arch at gz=5
    const archPillarMat = new BABYLON.StandardMaterial('archPillarMat', scene);
    archPillarMat.diffuseColor = new BABYLON.Color3(0.45, 0.4, 0.32);
    [[46, 5], [54, 5]].forEach(([gx, gz], i) => {
      const wp = world.gridToWorld(gx, gz);
      const p = BABYLON.MeshBuilder.CreateCylinder(`archPillar_${i}`, { height: 5, diameter: 0.6 }, scene);
      p.material = archPillarMat;
      p.position = new BABYLON.Vector3(wp.x, 2.5, wp.z);
      state.obstacles.add(`${gx},${gz}`);
    });
    // Lintel
    const lintelMat = new BABYLON.StandardMaterial('lintelMat', scene);
    lintelMat.diffuseColor = new BABYLON.Color3(0.45, 0.4, 0.32);
    const lintel = BABYLON.MeshBuilder.CreateBox('archLintel', { width: (54 - 46) * TILE_SIZE + 0.6, height: 0.4, depth: 0.5 }, scene);
    lintel.material = lintelMat;
    const lintelWP = world.gridToWorld(50, 5);
    lintel.position = new BABYLON.Vector3(lintelWP.x, 5.2, lintelWP.z);

    // Road torches at gx=48 and gx=52, every 6 tiles gz=8..44
    for (let gz = 8; gz <= 44; gz += 6) {
      [48, 52].forEach((gx, ti) => {
        const wp = world.gridToWorld(gx, gz);
        const post = BABYLON.MeshBuilder.CreateCylinder(`tpost_${gx}_${gz}`, { height: 2.0, diameter: 0.1 }, scene);
        post.material = torchMat;
        post.position = new BABYLON.Vector3(wp.x, 1.0, wp.z);
        const tflame = BABYLON.MeshBuilder.CreateSphere(`tflame_${gx}_${gz}`, { diameter: 0.25 }, scene);
        tflame.material = torchFlameMat;
        tflame.position = new BABYLON.Vector3(wp.x, 2.2, wp.z);
      });
    }

    // Market Square cobblestone: gx=42, gz=49, w=21, d=17
    const mktPatch = BABYLON.MeshBuilder.CreateGround('marketSquare', { width: 21 * TILE_SIZE, height: 17 * TILE_SIZE }, scene);
    mktPatch.material = cobbleMat;
    const mktCenterWP = world.gridToWorld(42 + 10, 49 + 8);
    mktPatch.position = new BABYLON.Vector3(mktCenterWP.x, 0.01, mktCenterWP.z);

    // Buildings
    const amberColor = new BABYLON.Color3(0.72, 0.48, 0.18);
    const amberRoof = new BABYLON.Color3(0.38, 0.22, 0.08);
    const warmWood = new BABYLON.Color3(0.55, 0.32, 0.14);
    const warmWoodRoof = new BABYLON.Color3(0.30, 0.16, 0.07);
    const stoneColor = new BABYLON.Color3(0.50, 0.46, 0.38);
    const stoneRoof = new BABYLON.Color3(0.35, 0.30, 0.24);
    const woodColor = new BABYLON.Color3(0.52, 0.36, 0.16);
    const woodRoof = new BABYLON.Color3(0.28, 0.18, 0.08);

    // Dawn Hall
    world._buildBuilding(scene, 'dawnHall', 53, 25, 13, 14, 3, amberColor, amberRoof, 'west', 2);

    // Connecting path to dawn hall: gx=51..52, gz=30..32
    const connW = 2 * TILE_SIZE;
    const connH = 3 * TILE_SIZE;
    const connPatch = BABYLON.MeshBuilder.CreateGround('dawnHallPath', { width: connW, height: connH }, scene);
    connPatch.material = cobbleMat;
    const connWP = world.gridToWorld(51, 31);
    connPatch.position = new BABYLON.Vector3(connWP.x + TILE_SIZE / 2, 0.01, connWP.z);

    // Dawn Hall porch columns
    const porchMat = new BABYLON.StandardMaterial('porchMat', scene);
    porchMat.diffuseColor = new BABYLON.Color3(0.45, 0.38, 0.22);
    [[53, 31], [53, 33]].forEach(([gx, gz], i) => {
      const wp = world.gridToWorld(gx, gz);
      const col = BABYLON.MeshBuilder.CreateCylinder(`porchCol_${i}`, { height: 3.5, diameter: 0.35 }, scene);
      col.material = porchMat;
      col.position = new BABYLON.Vector3(wp.x, 1.75, wp.z);
    });

    // Dawn Hall sign (amber emissive box above door)
    const signMat = new BABYLON.StandardMaterial('dawnSignMat', scene);
    signMat.emissiveColor = new BABYLON.Color3(0.80, 0.55, 0.15);
    signMat.diffuseColor = new BABYLON.Color3(0.80, 0.55, 0.15);
    const sign = BABYLON.MeshBuilder.CreateBox('dawnSign', { width: 1.5, height: 0.4, depth: 0.1 }, scene);
    sign.material = signMat;
    const doorWP = world.gridToWorld(53, 31);
    sign.position = new BABYLON.Vector3(doorWP.x, 4.2, doorWP.z);

    // Inn
    world._buildBuilding(scene, 'inn', 63, 49, 8, 12, 2, warmWood, warmWoodRoof, 'west', 1);

    // Blacksmith
    world._buildBuilding(scene, 'blacksmith', 34, 49, 8, 12, 1, stoneColor, stoneRoof, 'east', 1);

    // General Store
    world._buildBuilding(scene, 'generalStore', 43, 66, 19, 8, 2, woodColor, woodRoof, 'north', 1);

    // Houses
    world._buildBuilding(scene, 'house1', 34, 35, 5, 6, 1, woodColor, woodRoof, 'south', 1);
    world._buildBuilding(scene, 'house2', 34, 62, 5, 6, 1, woodColor, woodRoof, 'north', 1);
    world._buildBuilding(scene, 'house3', 63, 35, 5, 6, 1, woodColor, woodRoof, 'south', 1);
    world._buildBuilding(scene, 'house4', 63, 62, 5, 6, 1, woodColor, woodRoof, 'north', 1);

    // Market Stalls
    const stallPositions = [[46,53],[50,53],[54,53],[46,58],[50,58],[54,58]];
    stallPositions.forEach(([gx, gz], idx) => {
      world._buildStall(scene, gx, gz, idx);
    });

    // Brazier at market square center gx=52, gz=57
    const brazierMat = new BABYLON.StandardMaterial('brazMat', scene);
    brazierMat.diffuseColor = new BABYLON.Color3(0.25, 0.15, 0.08);
    const brazier = BABYLON.MeshBuilder.CreateCylinder('brazier', { height: 1.0, diameterTop: 0.7, diameterBottom: 0.4 }, scene);
    brazier.material = brazierMat;
    const brazWP = world.gridToWorld(52, 57);
    brazier.position = new BABYLON.Vector3(brazWP.x, 0.5, brazWP.z);
    const flameMat = new BABYLON.StandardMaterial('flameMat', scene);
    flameMat.emissiveColor = new BABYLON.Color3(1, 0.6, 0.2);
    flameMat.diffuseColor = new BABYLON.Color3(1, 0.5, 0.1);
    const flame = BABYLON.MeshBuilder.CreateSphere('flame', { diameter: 0.5 }, scene);
    flame.material = flameMat;
    flame.position = new BABYLON.Vector3(brazWP.x, 1.1, brazWP.z);
    state.flame = flame;
    const brazierLight = new BABYLON.PointLight('brzL', flame.position.clone(), scene);
    brazierLight.diffuse = new BABYLON.Color3(1, 0.55, 0.2);
    brazierLight.intensity = 0;
    brazierLight.range = 10;
    state.brazierLight = brazierLight;

    // NPCs
    world._spawnNPC(scene, {
      id: 'soren', name: 'Soren', gx: 58, gz: 31,
      dialogue: [
        'Welcome to the Dawn Hall. We are the premier adventuring guild in New Spring.',
        'Post quests, take contracts, and rise through the ranks.',
        'Speak to Kim at the counter for available work.'
      ],
      robeColor: new BABYLON.Color3(0.12, 0.12, 0.30),
      accentColor: new BABYLON.Color3(0.80, 0.55, 0.15)
    });
    world._spawnNPC(scene, {
      id: 'kim', name: 'Kim', gx: 60, gz: 32,
      dialogue: [
        'No quests available just yet — check back soon.',
        'Guild membership is open to all willing adventurers.'
      ],
      robeColor: new BABYLON.Color3(0.12, 0.12, 0.30),
      accentColor: new BABYLON.Color3(0.80, 0.55, 0.15)
    });
    world._spawnNPC(scene, {
      id: 'vendor1', name: 'Market Vendor', gx: 46, gz: 52,
      dialogue: ['Fresh goods! Wares coming soon.'],
      robeColor: new BABYLON.Color3(0.40, 0.26, 0.14),
      accentColor: new BABYLON.Color3(0.60, 0.42, 0.20)
    });
    world._spawnNPC(scene, {
      id: 'vendor2', name: 'Reagent Seller', gx: 50, gz: 52,
      dialogue: ['Finest magyk reagents in the region. Stock coming soon.'],
      robeColor: new BABYLON.Color3(0.18, 0.10, 0.28),
      accentColor: new BABYLON.Color3(0.55, 0.30, 0.70)
    });
    world._spawnNPC(scene, {
      id: 'vendor3', name: 'Food Merchant', gx: 54, gz: 52,
      dialogue: ['Fresh bread and provisions. Come back when stock arrives.'],
      robeColor: new BABYLON.Color3(0.55, 0.46, 0.30),
      accentColor: new BABYLON.Color3(0.70, 0.60, 0.35)
    });
  },

  _buildBuilding(scene, name, gx, gz, w, d, floors, wallColor, roofColor, doorSide, doorWidth) {
    const wallT = 0.3; // wall thickness
    const floorH = 3.0; // height per floor
    const totalH = floors * floorH;
    const doorH = 2.6;
    const doorWW = doorWidth * TILE_SIZE;

    const wallMat = new BABYLON.StandardMaterial(`wallMat_${name}`, scene);
    wallMat.diffuseColor = wallColor;
    wallMat.specularColor = new BABYLON.Color3(0.02, 0.02, 0.02);

    const roofMat = new BABYLON.StandardMaterial(`roofMat_${name}`, scene);
    roofMat.diffuseColor = roofColor;

    const floorMat = new BABYLON.StandardMaterial(`floorMat_${name}`, scene);
    floorMat.diffuseColor = new BABYLON.Color3(0.28, 0.20, 0.10);

    const worldW = w * TILE_SIZE;
    const worldD = d * TILE_SIZE;
    const originX = gx * TILE_SIZE;
    const originZ = gz * TILE_SIZE;
    const centerX = originX + worldW / 2;
    const centerZ = originZ + worldD / 2;

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

    // Roof
    const roofMesh = BABYLON.MeshBuilder.CreateBox(`roof_${name}`, { width: worldW + 0.4, height: 0.5, depth: worldD + 0.4 }, scene);
    roofMesh.material = roofMat;
    roofMesh.position = new BABYLON.Vector3(centerX, totalH + 0.25, centerZ);

    // Mark wall perimeter as obstacles (except door tiles)
    // Determine door tile positions to skip
    const doorTiles = new Set();
    if (doorSide === 'north') {
      const doorGxCenter = Math.round(gx + w / 2 - doorWidth / 2);
      for (let dx = 0; dx < doorWidth; dx++) doorTiles.add(`${doorGxCenter + dx},${gz}`);
    } else if (doorSide === 'south') {
      const doorGxCenter = Math.round(gx + w / 2 - doorWidth / 2);
      for (let dx = 0; dx < doorWidth; dx++) doorTiles.add(`${doorGxCenter + dx},${gz + d - 1}`);
    } else if (doorSide === 'west') {
      const doorGzCenter = Math.round(gz + d / 2 - doorWidth / 2);
      for (let dz = 0; dz < doorWidth; dz++) doorTiles.add(`${gx},${doorGzCenter + dz}`);
    } else if (doorSide === 'east') {
      const doorGzCenter = Math.round(gz + d / 2 - doorWidth / 2);
      for (let dz = 0; dz < doorWidth; dz++) doorTiles.add(`${gx + w - 1},${doorGzCenter + dz}`);
    }

    // North wall tiles
    for (let x = gx; x < gx + w; x++) {
      const key = `${x},${gz}`;
      if (!doorTiles.has(key)) state.obstacles.add(key);
    }
    // South wall tiles
    for (let x = gx; x < gx + w; x++) {
      const key = `${x},${gz + d - 1}`;
      if (!doorTiles.has(key)) state.obstacles.add(key);
    }
    // West wall tiles (excluding corners already done)
    for (let z = gz + 1; z < gz + d - 1; z++) {
      const key = `${gx},${z}`;
      if (!doorTiles.has(key)) state.obstacles.add(key);
    }
    // East wall tiles
    for (let z = gz + 1; z < gz + d - 1; z++) {
      const key = `${gx + w - 1},${z}`;
      if (!doorTiles.has(key)) state.obstacles.add(key);
    }

    world.buildings.push({
      name,
      gxMin: gx, gxMax: gx + w - 1,
      gzMin: gz, gzMax: gz + d - 1,
      roofMesh
    });
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
    const darkColor = new BABYLON.Color3(0.08, 0.06, 0.04);
    const skinColor = new BABYLON.Color3(0.75, 0.62, 0.48);

    const root = new BABYLON.TransformNode(`npc_${id}`, scene);

    const robeMat = new BABYLON.StandardMaterial(`npcRobeMat_${id}`, scene);
    robeMat.diffuseColor = robeColor;
    robeMat.specularColor = new BABYLON.Color3(0, 0, 0);
    const robe = BABYLON.MeshBuilder.CreateCylinder(`npcRobe_${id}`, { height: 1.3, diameterTop: 0.5, diameterBottom: 0.78 }, scene);
    robe.material = robeMat;
    robe.position.y = 0.65;
    robe.parent = root;

    const trimMat = new BABYLON.StandardMaterial(`npcTrimMat_${id}`, scene);
    trimMat.diffuseColor = accentColor || robeColor;
    trimMat.emissiveColor = (accentColor || robeColor).scale(0.3);
    const trim = BABYLON.MeshBuilder.CreateTorus(`npcTrim_${id}`, { diameter: 0.78, thickness: 0.05 }, scene);
    trim.material = trimMat;
    trim.position.y = 0.05;
    trim.parent = root;

    const headMat = new BABYLON.StandardMaterial(`npcHeadMat_${id}`, scene);
    headMat.diffuseColor = skinColor;
    const head = BABYLON.MeshBuilder.CreateSphere(`npcHead_${id}`, { diameter: 0.38, segments: 10 }, scene);
    head.material = headMat;
    head.position.y = 1.5;
    head.parent = root;

    const hairMat = new BABYLON.StandardMaterial(`npcHairMat_${id}`, scene);
    hairMat.diffuseColor = darkColor;
    const hair = BABYLON.MeshBuilder.CreateSphere(`npcHair_${id}`, { diameter: 0.40, segments: 8 }, scene);
    hair.material = hairMat;
    hair.position.y = 1.55;
    hair.scaling.y = 0.5;
    hair.parent = root;

    const wp = world.gridToWorld(gx, gz);
    root.position = new BABYLON.Vector3(wp.x, 0, wp.z);

    world.npcs.push({ id, name, gx, gz, dialogue, mesh: root, dialogueIndex: 0 });
  },

  checkRoofTransparency() {
    const pgx = state.player.gx;
    const pgz = state.player.gz;
    for (const b of world.buildings) {
      if (!b.roofMesh) continue;
      const inside = pgx > b.gxMin && pgx < b.gxMax && pgz > b.gzMin && pgz < b.gzMax;
      b.roofMesh.isVisible = !inside;
    }
  },

  onPlayerStep() {
    world.checkRoofTransparency();
    // Zone transition north
    if (state.player.gz <= 5 && state.player.gx >= 49 && state.player.gx <= 51 && !world._transitioning) {
      world._transitioning = true;
      log('You follow the road north toward Sygldry Academy...', 'system');
      setTimeout(() => { world._transitioning = false; }, 3000);
    }
  },

  buildPlayerMesh() {
    const scene = state.scene;
    const accent = SYGLS[state.player.sygl].accentRGB;
    const accentColor = new BABYLON.Color3(accent[0]/255, accent[1]/255, accent[2]/255);

    const root = new BABYLON.TransformNode('playerRoot', scene);
    const robeMat = new BABYLON.StandardMaterial('robeMat', scene);
    robeMat.diffuseColor = new BABYLON.Color3(0.1, 0.08, 0.06);
    robeMat.specularColor = new BABYLON.Color3(0, 0, 0);
    const robe = BABYLON.MeshBuilder.CreateCylinder('robe', { height: 1.3, diameterTop: 0.55, diameterBottom: 0.85 }, scene);
    robe.material = robeMat;
    robe.position.y = 0.65;
    robe.parent = root;

    const trimMat = new BABYLON.StandardMaterial('trimMat', scene);
    trimMat.diffuseColor = accentColor;
    trimMat.emissiveColor = accentColor.scale(0.3);
    const trim = BABYLON.MeshBuilder.CreateTorus('trim', { diameter: 0.85, thickness: 0.06 }, scene);
    trim.material = trimMat;
    trim.position.y = 0.05;
    trim.parent = root;

    const headMat = new BABYLON.StandardMaterial('headMat', scene);
    headMat.diffuseColor = new BABYLON.Color3(0.85, 0.7, 0.55);
    const head = BABYLON.MeshBuilder.CreateSphere('head', { diameter: 0.42, segments: 12 }, scene);
    head.material = headMat;
    head.position.y = 1.55;
    head.parent = root;

    const hairMat = new BABYLON.StandardMaterial('hairMat', scene);
    hairMat.diffuseColor = new BABYLON.Color3(0.16, 0.1, 0.06);
    const hair = BABYLON.MeshBuilder.CreateSphere('hair', { diameter: 0.45, segments: 10 }, scene);
    hair.material = hairMat;
    hair.position.y = 1.62;
    hair.scaling.y = 0.55;
    hair.parent = root;

    const glowMat = new BABYLON.StandardMaterial('glowMat', scene);
    glowMat.emissiveColor = accentColor;
    glowMat.diffuseColor = accentColor;
    const glow = BABYLON.MeshBuilder.CreateSphere('glow', { diameter: 0.18 }, scene);
    glow.material = glowMat;
    glow.position = new BABYLON.Vector3(-0.32, 0.7, 0.1);
    glow.parent = root;

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
      let node = pick.pickedMesh;
      while (node && !node.name.startsWith('npc_')) node = node.parent;
      if (node && node.name.startsWith('npc_')) {
        const id = node.name.slice(4);
        const npc = world.npcs.find(n => n.id === id);
        if (npc) {
          log(`${npc.name}: "${npc.dialogue[npc.dialogueIndex % npc.dialogue.length]}"`, 'system');
          npc.dialogueIndex++;
          return;
        }
      }
    }

    if (pick.pickedPoint) {
      const { gx, gz } = world.worldToGrid(pick.pickedPoint.x, pick.pickedPoint.z);
      actions.walkTo(gx, gz, ev.clientX, ev.clientY);
    }
  },

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

    // Check NPC right-click
    let npcClicked = null;
    if (!enemyClicked && pick.pickedMesh) {
      let node = pick.pickedMesh;
      while (node && !node.name.startsWith('npc_')) node = node.parent;
      if (node && node.name.startsWith('npc_')) {
        const id = node.name.slice(4);
        npcClicked = world.npcs.find(n => n.id === id);
      }
    }

    if (enemyClicked) {
      ctxMenu.showForEnemy(ev.clientX, ev.clientY, enemyClicked);
    } else if (npcClicked) {
      // Right-click on NPC: same as left-click dialogue
      log(`${npcClicked.name}: "${npcClicked.dialogue[npcClicked.dialogueIndex % npcClicked.dialogue.length]}"`, 'system');
      npcClicked.dialogueIndex++;
    } else if (pick.pickedPoint) {
      const { gx, gz } = world.worldToGrid(pick.pickedPoint.x, pick.pickedPoint.z);
      ctxMenu.showForTile(ev.clientX, ev.clientY, gx, gz);
    }
  }
};
