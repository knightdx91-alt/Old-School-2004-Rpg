/* ================================================================
   TICK
   ================================================================ */
let tickAccum = 0;
let lastTime = 0;

function tickNPCs() {
  for (const npc of world.npcs) {
    if (!npc.wander) continue;

    // Wait at destination before picking next target
    if (npc.waitTimer > 0) { npc.waitTimer--; continue; }

    // Step along current path
    if (npc.path.length > 0 && npc.pathIdx < npc.path.length) {
      npc.moveTimer--;
      if (npc.moveTimer <= 0) {
        const [nx, nz] = npc.path[npc.pathIdx++];
        const dx = nx - npc.gx, dz = nz - npc.gz;
        if (npc.mesh && (dx || dz)) npc.mesh.rotation.y = Math.atan2(dx, dz);
        state.obstacles.delete(`${npc.gx},${npc.gz}`);
        npc.gx = nx; npc.gz = nz;
        state.obstacles.add(`${npc.gx},${npc.gz}`);
        const wp = world.gridToWorld(npc.gx, npc.gz);
        if (npc.mesh) { npc.mesh.position.x = wp.x; npc.mesh.position.z = wp.z; }
        npc.moveTimer = 14;
      }
    } else {
      // Path done — wait, then pick a new nearby destination
      npc.path = []; npc.pathIdx = 0;
      npc.waitTimer = 50 + Math.floor(Math.random() * 80);
      const range = 12;
      for (let i = 0; i < 20; i++) {
        const tx = npc.homeGx + Math.round((Math.random() - 0.5) * range * 2);
        const tz = npc.homeGz + Math.round((Math.random() - 0.5) * range * 2);
        if (!world.walkable(tx, tz)) continue;
        const p = world.findPath(npc.gx, npc.gz, tx, tz);
        if (p && p.length > 0 && p.length <= 16) {
          npc.path = p; npc.pathIdx = 0; npc.moveTimer = 14;
          break;
        }
      }
    }
  }
}

function gameTick() {
  state.worldClock++;
  updateDayNight();

  // Movement
  if (state.path && state.path.length > 0 && !state.combat) {
    const steps = (state.running && state.runEnergy > 0) ? 2 : 1;
    for (let s = 0; s < steps; s++) {
      const next = state.path[state.pathStep];
      if (!next) break;
      state.player.gx = next[0];
      state.player.gz = next[1];
      const wp = world.gridToWorld(next[0], next[1]);
      state.playerTargetPos = new BABYLON.Vector3(wp.x, 0, wp.z);
      state.pathStep++;
      if (state.pathStep >= state.path.length) {
        state.path = null;
        state.targetMarker.isVisible = false;
        if (state.pendingAction && state.pendingAction.type === 'attack') {
          const e = state.pendingAction.enemy;
          state.pendingAction = null;
          if (state.enemies.includes(e)) {
            const dist = Math.abs(state.player.gx - e.gx) + Math.abs(state.player.gz - e.gz);
            if (dist === 1) combat.start(e);
          }
        }
        break;
      }
    }
    // Drain run energy while running
    if (state.running && state.runEnergy > 0) {
      state.runEnergy = Math.max(0, state.runEnergy - 1.5);
      if (state.runEnergy <= 0) {
        state.running = false;
        log('You are out of run energy.', 'system');
      }
      hud.updateRunBtn && hud.updateRunBtn();
    }
  } else if (!state.path) {
    // Recover energy while standing still
    if (state.runEnergy < 100) {
      state.runEnergy = Math.min(100, state.runEnergy + 0.4);
      hud.updateRunBtn && hud.updateRunBtn();
    }
  }

  // NPC wander
  tickNPCs();
  // onPlayerStep hook
  world.onPlayerStep && world.onPlayerStep();
  // Combat
  if (state.combat) combat.tick();
}

/* ================================================================
   MAIN LOOP — drives the tick clock and smooth movement lerp
   ================================================================ */
function loop(now) {
  if (!state.ready) { requestAnimationFrame(loop); return; }
  if (!lastTime) lastTime = now;
  const dt = now - lastTime;
  lastTime = now;
  tickAccum += dt;
  while (tickAccum >= TICK_MS) {
    tickAccum -= TICK_MS;
    gameTick();
  }
  // Smooth player movement between tiles
  if (state.playerMesh && state.playerTargetPos) {
    const cur = state.playerMesh.position;
    const tgt = state.playerTargetPos;
    cur.x += (tgt.x - cur.x) * 0.25;
    cur.z += (tgt.z - cur.z) * 0.25;
    // Face direction of movement
    const dx = tgt.x - cur.x, dz = tgt.z - cur.z;
    if (Math.abs(dx) + Math.abs(dz) > 0.05) {
      state.playerMesh.rotation.y = Math.atan2(dx, dz);
    }
  }
  hud.updateBubblePos && hud.updateBubblePos();
  requestAnimationFrame(loop);
}

/* ================================================================
   GAME (high-level flow + save/load)
   ================================================================ */
const game = {
  init() {
    try {
      if (localStorage.getItem(SAVE_KEY)) {
        document.getElementById('continue-btn').style.display = '';
      }
    } catch (e) {}
  },
  startNewGame() { quiz.start(); },
  skipQuiz() { state.recommendedSygl = null; syglSelect.show(false); },
  confirmSygl() {
    if (!state.selectedSygl) return;
    const s = SYGLS[state.selectedSygl];
    state.player = {
      sygl: state.selectedSygl,
      gx: 48, gz: 52,
      hp: s.stats.hp, hpMax: s.stats.hp,
      mp: s.stats.mp, mpMax: s.stats.mp,
      atk: s.stats.atk, def: s.stats.def,
      level: 1, xp: 0, xpNext: 100
    };
    intro.start();
  },
  startWorld() {
    showScreen('game-screen');
    void document.getElementById('render-canvas').offsetHeight;
    if (!state.scene) {
      world.build();
    } else {
      if (state.playerMesh) state.playerMesh.dispose(false, true);
      world.buildPlayerMesh();
    }
    state.ready = true;
    if (state.engine) {
      state.engine.resize();
      setTimeout(() => state.engine && state.engine.resize(), 100);
      setTimeout(() => state.engine && state.engine.resize(), 500);
    }
    hud.switchTab('stats');
    hud.render();
    log('You stand beside the fountain in the town square of New Spring.', 'system');
    log('Tap ground to walk. Tap NPC or enemy to interact. Long-press for options.', 'system');
    requestAnimationFrame(loop);
    game.autoSave();
  },
  continueGame() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      state.player = data.player;
      state.worldClock = data.worldClock || 0;
      state.hudScale = data.hudScale || 1;
      document.documentElement.style.setProperty('--hud-scale', state.hudScale);
      showScreen('game-screen');
      if (!state.scene) world.build();
      else if (state.playerMesh) { state.playerMesh.dispose(false, true); world.buildPlayerMesh(); }
      state.ready = true;
      const wp = world.gridToWorld(state.player.gx, state.player.gz);
      state.playerMesh.position.x = wp.x;
      state.playerMesh.position.z = wp.z;
      hud.switchTab('stats');
      hud.render();
      log('Save loaded. Welcome back.', 'system');
      requestAnimationFrame(loop);
    } catch (e) {
      alert('Failed to load save: ' + e.message);
    }
  },
  autoSave() {
    try {
      const data = {
        player: state.player,
        worldClock: state.worldClock,
        hudScale: state.hudScale,
        version: 1
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch (e) {}
  },
  saveNow() {
    game.autoSave();
    log('Progress saved.', 'system');
  },
  deleteSave() {
    if (!confirm('Delete the saved game? This cannot be undone.')) return;
    state.ready = false;
    localStorage.removeItem(SAVE_KEY);
    document.getElementById('continue-btn').style.display = 'none';
    log('Save deleted. Refreshing...', 'system');
    setTimeout(() => location.reload(), 1000);
  },
  confirmQuit() {
    if (!confirm('Return to title? Current progress will be auto-saved.')) return;
    game.autoSave();
    state.ready = false;
    state.combat = null;
    state.path = null;
    if (state.engine) state.engine.stopRenderLoop();
    if (state.scene) {
      state.scene.dispose(); state.scene = null;
    }
    if (state.engine) {
      state.engine.dispose(); state.engine = null;
    }
    state.playerMesh = null;
    state.enemies = [];
    state.enemyMeshes.clear();
    state.obstacles.clear();
    showScreen('title-screen');
    game.init();
  }
};

// Auto-save periodically while playing
setInterval(() => { if (state.ready) game.autoSave(); }, 15000);

game.init();

// Global error surface
window.addEventListener('error', (e) => {
  const msg = e.error ? (e.error.stack || e.error.message) : (e.message + ' at ' + e.filename + ':' + e.lineno);
  console.error('SYGL ERROR:', msg);
  let box = document.getElementById('err-box');
  if (!box) {
    box = document.createElement('div');
    box.id = 'err-box';
    box.style.cssText = 'position:fixed;top:10px;left:10px;right:10px;z-index:9999;background:#2a0a0a;border:1px solid #a01a2a;color:#ffcccc;padding:10px 14px;font-family:monospace;font-size:12px;max-height:40vh;overflow:auto;white-space:pre-wrap;';
    box.innerHTML = '<div style="color:#ff8888;font-weight:bold;margin-bottom:6px;">⚠ Error (click to dismiss)</div><div id="err-content"></div>';
    box.onclick = () => box.remove();
    document.body.appendChild(box);
  }
  document.getElementById('err-content').textContent += msg + '\n\n';
});
window.addEventListener('unhandledrejection', (e) => {
  const msg = 'Unhandled promise: ' + (e.reason && e.reason.stack ? e.reason.stack : e.reason);
  window.dispatchEvent(new ErrorEvent('error', { message: msg, error: new Error(msg) }));
});
