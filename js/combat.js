/* ================================================================
   ACTIONS
   ================================================================ */
const actions = {
  walkTo(gx, gz, clientX, clientY) {
    if (state.combat) { log('You cannot move while engaged in combat. Flee first.', 'system'); return; }
    if (!world.walkable(gx, gz)) {
      // try to find nearest walkable adjacent
      log('You cannot walk there.', 'system');
      return;
    }
    const path = world.findPath(state.player.gx, state.player.gz, gx, gz);
    if (!path || path.length === 0) { log('No path.', 'system'); return; }
    state.path = path;
    state.pathStep = 0;
    state.pendingAction = null;
    // Show target marker in world
    const wp = world.gridToWorld(gx, gz);
    state.targetMarker.position.x = wp.x;
    state.targetMarker.position.z = wp.z;
    state.targetMarker.position.y = 0.05;
    state.targetMarker.isVisible = true;
    // Cursor pulse
    if (clientX !== undefined) showCursorTarget(clientX, clientY);
  },
  attack(enemy) {
    if (state.combat) {
      if (state.combat.enemy === enemy) return;
      log('You are already in combat.', 'system'); return;
    }
    // Adjacent?
    const dist = Math.abs(state.player.gx - enemy.gx) + Math.abs(state.player.gz - enemy.gz);
    if (dist === 1) {
      combat.start(enemy);
    } else {
      const path = world.findPathAdjacent(state.player.gx, state.player.gz, enemy.gx, enemy.gz);
      if (!path) { log('You cannot reach it.', 'system'); return; }
      state.path = path;
      state.pathStep = 0;
      state.pendingAction = { type: 'attack', enemy };
      const wp = world.gridToWorld(enemy.gx, enemy.gz);
      state.targetMarker.position.x = wp.x;
      state.targetMarker.position.z = wp.z;
      state.targetMarker.isVisible = true;
    }
  },
  examine(target) {
    if (target.type === 'enemy') {
      const e = target.enemy;
      log(`A ${e.type}. Looks harmless enough — until you swing at it.`, 'system');
    } else {
      log('Open ground. You could walk here.', 'system');
    }
  }
};

function showCursorTarget(x, y) {
  const el = document.getElementById('cursor-target');
  const rect = document.getElementById('canvas-wrap').getBoundingClientRect();
  el.style.left = (x - rect.left) + 'px';
  el.style.top = (y - rect.top) + 'px';
  el.classList.remove('active');
  void el.offsetWidth; // restart animation
  el.classList.add('active');
}

/* ================================================================
   CONTEXT MENU
   ================================================================ */
const ctxMenu = {
  showForEnemy(x, y, enemy) {
    const el = document.getElementById('ctx-menu');
    el.innerHTML = `
      <div class="ctx-header">${enemy.type}</div>
      <div class="ctx-item attack" onclick="actions.attack(state.enemies.find(e=>e.id==='${enemy.id}')); ctxMenu.hide()">Attack</div>
      <div class="ctx-item" onclick="actions.examine({type:'enemy', enemy: state.enemies.find(e=>e.id==='${enemy.id}')}); ctxMenu.hide()">Examine</div>
      <div class="ctx-item" onclick="ctxMenu.hide()">Cancel</div>
    `;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.classList.add('active');
  },
  showForTile(x, y, gx, gz) {
    const el = document.getElementById('ctx-menu');
    el.innerHTML = `
      <div class="ctx-header">Tile ${gx},${gz}</div>
      <div class="ctx-item" onclick="actions.walkTo(${gx}, ${gz}); ctxMenu.hide()">Walk here</div>
      <div class="ctx-item" onclick="actions.examine({type:'tile'}); ctxMenu.hide()">Examine</div>
      <div class="ctx-item" onclick="ctxMenu.hide()">Cancel</div>
    `;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.classList.add('active');
  },
  hide() {
    document.getElementById('ctx-menu').classList.remove('active');
  }
};
document.addEventListener('click', e => {
  if (!e.target.closest('.ctx-menu')) ctxMenu.hide();
});

/* ================================================================
   COMBAT
   ================================================================ */
const combat = {
  start(enemy) {
    state.combat = {
      enemy,
      playerCooldown: 4,   // 4 ticks = 2.4s between attacks
      enemyCooldown: 5,
      playerTicks: 0,
      enemyTicks: 0
    };
    state.path = null;
    state.targetMarker.isVisible = false;
    document.getElementById('combat-tab').style.display = 'block';
    hud.switchTab('combat');
    log(`You engage the ${enemy.type}!`, 'combat');
  },
  end() {
    state.combat = null;
    document.getElementById('combat-tab').style.display = 'none';
    if (state.currentTab === 'combat') hud.switchTab('stats');
  },
  tick() {
    if (!state.combat) return;
    const c = state.combat;
    c.playerTicks++;
    c.enemyTicks++;
    if (c.playerTicks >= c.playerCooldown) {
      c.playerTicks = 0;
      this.playerAttack();
      if (!state.combat) return;
    }
    if (c.enemyTicks >= c.enemyCooldown) {
      c.enemyTicks = 0;
      this.enemyAttack();
    }
  },
  rollHit(accuracy) {
    return Math.random() * 100 < accuracy;
  },
  playerAttack() {
    const p = state.player, e = state.combat.enemy;
    const acc = SYGLS[p.sygl].stats.acc;
    if (!this.rollHit(acc)) {
      log(`You swing at the ${e.type} — and miss.`, 'miss');
      spawnFloatAt(state.enemyMeshes.get(e.id).root.position, 'Miss', '#aaa', true);
      return;
    }
    const dmg = Math.max(1, p.atk + Math.floor(Math.random() * 4) - e.def);
    e.hp = Math.max(0, e.hp - dmg);
    spawnFloatAt(state.enemyMeshes.get(e.id).root.position, `-${dmg}`, '#ffcccc');
    log(`You strike the ${e.type} for ${dmg}.`, 'combat');
    world.updateEnemyHP(e);
    hud.render();
    if (e.hp <= 0) this.win(e);
  },
  enemyAttack() {
    const p = state.player, e = state.combat.enemy;
    if (!this.rollHit(e.acc)) {
      log(`The ${e.type} swings at you — and misses.`, 'miss');
      spawnFloatAt(state.playerMesh.position, 'Miss', '#aaa', true);
      return;
    }
    const dmg = Math.max(1, e.atk + Math.floor(Math.random() * 3) - p.def);
    p.hp = Math.max(0, p.hp - dmg);
    spawnFloatAt(state.playerMesh.position, `-${dmg}`, '#ff8888');
    log(`The ${e.type} hits you for ${dmg}.`, 'combat');
    hud.render();
    if (p.hp <= 0) this.lose();
  },
  castSpell() {
    if (!state.combat) return;
    const p = state.player, e = state.combat.enemy, spell = SYGLS[p.sygl].spell;
    if (p.mp < spell.cost) { log('Not enough magyk.', 'system'); return; }
    if (!this.rollHit(spell.acc)) {
      p.mp -= Math.floor(spell.cost / 2);
      log(`${spell.name} fizzles. The magyk slips through your fingers.`, 'magic');
      spawnFloatAt(state.enemyMeshes.get(e.id).root.position, 'Miss', SYGLS[p.sygl].accent, true);
      hud.render();
      return;
    }
    p.mp -= spell.cost;
    const dmg = spell.dmg[0] + Math.floor(Math.random() * (spell.dmg[1] - spell.dmg[0] + 1));
    e.hp = Math.max(0, e.hp - dmg);
    spawnFloatAt(state.enemyMeshes.get(e.id).root.position, `-${dmg}`, SYGLS[p.sygl].accent);
    log(`✦ ${spell.name} strikes the ${e.type} for ${dmg}.`, 'magic');
    if (spell.type === 'drain') {
      const heal = Math.floor(dmg / 2);
      p.hp = Math.min(p.hpMax, p.hp + heal);
      spawnFloatAt(state.playerMesh.position, `+${heal}`, '#a8d888');
      log(`The blood feeds you. +${heal} HP.`, 'magic');
    }
    world.updateEnemyHP(e);
    // Slight cooldown reset so spells feel impactful
    state.combat.playerTicks = -2;
    hud.render();
    if (e.hp <= 0) this.win(e);
  },
  flee() {
    if (!state.combat) return;
    if (Math.random() < 0.7) {
      log('You break away and retreat.', 'system');
      this.end();
    } else {
      log('You fail to escape!', 'combat');
      this.enemyAttack();
    }
  },
  win(e) {
    log(`The ${e.type} falls. (+${e.xp} XP)`, 'gain');
    world.removeEnemy(e);
    const p = state.player;
    p.xp += e.xp;
    while (p.xp >= p.xpNext) {
      p.xp -= p.xpNext;
      p.level++;
      p.xpNext = Math.floor(p.xpNext * 1.5);
      p.hpMax += 5; p.mpMax += 3; p.atk += 1; p.def += 1;
      p.hp = p.hpMax; p.mp = p.mpMax;
      log(`✦ You reach level ${p.level}! Your sygl grows stronger.`, 'gain');
    }
    this.end();
    hud.render();
    game.autoSave();
    // Respawn dummy after 30 seconds (60 ticks) — keeps testbed alive
    setTimeout(() => {
      if (!state.enemies.find(en => en.id === 'dummy1')) {
        world.spawnEnemy({ id: 'dummy1', type: 'Training Dummy', gx: 13, gz: 10, hp: 25, hpMax: 25, atk: 2, def: 1, acc: 50, xp: 35 });
        log('A new training dummy is hauled into place.', 'system');
      }
    }, 30000);
  },
  lose() {
    log('You collapse. Darkness takes you...', 'combat');
    setTimeout(() => {
      log('You wake at the academy gate, your wounds tended. (Half XP lost)', 'system');
      const p = state.player;
      p.hp = p.hpMax; p.mp = p.mpMax;
      p.xp = Math.floor(p.xp / 2);
      p.gx = 9; p.gz = 9;
      const wp = world.gridToWorld(p.gx, p.gz);
      state.playerMesh.position.x = wp.x;
      state.playerMesh.position.z = wp.z;
      this.end();
      hud.render();
      game.autoSave();
    }, 1500);
  }
};

/* ================================================================
   FLOAT NUMBERS (project 3D → screen)
   ================================================================ */
function spawnFloatAt(pos3d, text, color, miss=false) {
  const scene = state.scene;
  const engine = state.engine;
  const proj = BABYLON.Vector3.Project(
    new BABYLON.Vector3(pos3d.x, pos3d.y + 1.6, pos3d.z),
    BABYLON.Matrix.Identity(),
    scene.getTransformMatrix(),
    state.camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight())
  );
  const wrap = document.getElementById('canvas-wrap');
  const rect = wrap.getBoundingClientRect();
  // proj is in canvas pixel coords (not CSS) — scale to CSS
  const scaleX = rect.width / engine.getRenderWidth();
  const scaleY = rect.height / engine.getRenderHeight();
  const cssX = proj.x * scaleX;
  const cssY = proj.y * scaleY;
  const el = document.createElement('div');
  el.className = 'float-num' + (miss ? ' miss' : '');
  el.textContent = text;
  el.style.color = color;
  el.style.left = cssX + 'px';
  el.style.top = cssY + 'px';
  el.style.fontSize = '18px';
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 1100);
}

/* ================================================================
   DIALOGUE
   ================================================================ */
const dialogue = {
  active: false,
  lines: [],
  index: 0,
  start(speaker, color, lines) {
    this.active = true; this.lines = lines; this.index = 0;
    document.getElementById('dialogue-overlay').classList.add('active');
    document.getElementById('dialogue-speaker').textContent = speaker;
    document.getElementById('dialogue-speaker').style.color = color || 'var(--gold)';
    this.render();
  },
  render() { document.getElementById('dialogue-text').textContent = this.lines[this.index]; },
  advance() {
    this.index++;
    if (this.index >= this.lines.length) this.end();
    else this.render();
  },
  end() {
    document.getElementById('dialogue-overlay').classList.remove('active');
    this.active = false;
  }
};
