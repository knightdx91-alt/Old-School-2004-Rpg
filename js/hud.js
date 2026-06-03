/* ================================================================
   HUD
   ================================================================ */
const hud = {
  switchTab(tab) {
    state.currentTab = tab;
    document.querySelectorAll('.hud-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    this.render();
  },
  render() {
    const panel = document.getElementById('hud-panel');
    const tab = state.currentTab;
    if (tab === 'stats') panel.innerHTML = this.renderStats();
    else if (tab === 'combat') panel.innerHTML = this.renderCombat();
    else if (tab === 'options') panel.innerHTML = this.renderOptions();
    else if (tab === 'inventory') panel.innerHTML = this.renderPlaceholder('Inventory', 'Your pack is empty. Items, pickups, and crafted goods will appear here in a coming update.');
    else if (tab === 'spellbook') panel.innerHTML = this.renderSpellbook();
    else if (tab === 'quests') panel.innerHTML = this.renderPlaceholder('Quests', 'No quests yet. Speak with the academy faculty in a coming update to take on your first task.');
  },
  renderStats() {
    const p = state.player; const s = SYGLS[p.sygl];
    return `
      <div class="char-name-line">Apprentice</div>
      <div class="char-sygl-line" style="color:${s.accent}">— ${s.name} of ${s.originator} —</div>
      <div class="stat-row"><span class="label">Health</span><span>${p.hp}/${p.hpMax}</span></div>
      <div class="bar"><div class="bar-fill hp" style="width:${p.hp/p.hpMax*100}%"></div></div>
      <div class="stat-row"><span class="label">Magyk</span><span>${p.mp}/${p.mpMax}</span></div>
      <div class="bar"><div class="bar-fill mp" style="width:${p.mp/p.mpMax*100}%"></div></div>
      <div class="stat-row"><span class="label">Level ${p.level}</span><span>${p.xp}/${p.xpNext} XP</span></div>
      <div class="bar"><div class="bar-fill xp" style="width:${p.xp/p.xpNext*100}%"></div></div>
      <div class="stats-attrs">
        <div><span class="label">ATK</span><span>${p.atk}</span></div>
        <div><span class="label">DEF</span><span>${p.def}</span></div>
        <div><span class="label">ACC</span><span>${s.stats.acc}%</span></div>
        <div><span class="label">SYGL</span><span style="color:${s.accent}">${s.name}</span></div>
      </div>`;
  },
  renderCombat() {
    if (!state.combat) return '<div class="placeholder-tab">No active combat.</div>';
    const e = state.combat.enemy; const s = SYGLS[state.player.sygl];
    return `
      <div class="enemy-display">
        <div class="enemy-name-row">⚔ ${e.type}</div>
        <div class="stat-row"><span class="label">Health</span><span>${Math.max(0,e.hp)}/${e.hpMax}</span></div>
        <div class="bar"><div class="bar-fill hp" style="width:${Math.max(0,e.hp/e.hpMax*100)}%"></div></div>
      </div>
      <div class="combat-actions">
        <button class="btn small" onclick="combat.castSpell()">${s.spell.name} (${s.spell.cost} MP)</button>
        <button class="btn small danger" onclick="combat.flee()">Flee</button>
      </div>
      <div style="margin-top:10px; font-size:0.8rem; font-style:italic; color:rgba(217,201,168,0.55)">Auto-attacking. Cast spell or flee at will.</div>`;
  },
  renderSpellbook() {
    const s = SYGLS[state.player.sygl];
    const sp = s.spell;
    return `
      <div style="font-family:'Cinzel'; font-size:0.8rem; color:rgba(217,201,168,0.6); letter-spacing:0.1em; margin-bottom:10px;">YOUR ${s.name.toUpperCase()} SPELLS</div>
      <div style="padding: 12px; background: rgba(58,47,37,0.3); border: 1px solid ${s.accent};">
        <div style="font-family:'Cinzel'; color:${s.accent}; font-size:1.05rem; letter-spacing:0.1em; margin-bottom:4px;">${sp.name}</div>
        <div style="font-size:0.85rem; color:rgba(217,201,168,0.8)">Damage: ${sp.dmg[0]}–${sp.dmg[1]} • Cost: ${sp.cost} MP • Accuracy: ${sp.acc}%${sp.type==='drain'?' • Drains life':''}</div>
        <div style="font-size:0.85rem; font-style:italic; margin-top:6px; color:rgba(217,201,168,0.75)">${sp.desc}</div>
      </div>
      <div style="font-style:italic; font-size:0.8rem; color:rgba(217,201,168,0.5); margin-top:12px;">More spells will reveal themselves as you grow in power...</div>`;
  },
  renderPlaceholder(title, text) {
    return `<div class="placeholder-tab"><div class="pt-title">${title}</div>${text}</div>`;
  },
  renderOptions() {
    return `
      <div class="opt-row">
        <span class="opt-label">HUD Size</span>
        <div class="opt-buttons">
          <button class="btn small ${state.hudScale===0.85?'primary':''}" onclick="hud.setScale(0.85)">Small</button>
          <button class="btn small ${state.hudScale===1?'primary':''}" onclick="hud.setScale(1)">Medium</button>
          <button class="btn small ${state.hudScale===1.2?'primary':''}" onclick="hud.setScale(1.2)">Large</button>
        </div>
      </div>
      <div class="opt-row">
        <span class="opt-label">Save Game</span>
        <div class="opt-buttons"><button class="btn small" onclick="game.saveNow()">Save Now</button></div>
      </div>
      <div class="opt-row">
        <span class="opt-label">Delete Save</span>
        <div class="opt-buttons"><button class="btn small danger" onclick="game.deleteSave()">Delete</button></div>
      </div>
      <div class="opt-row">
        <span class="opt-label">Return to Title</span>
        <div class="opt-buttons"><button class="btn small danger" onclick="game.confirmQuit()">Quit</button></div>
      </div>`;
  },
  setScale(v) {
    state.hudScale = v;
    document.documentElement.style.setProperty('--hud-scale', v);
    this.render();
    // Force engine resize after CSS layout settles
    setTimeout(() => state.engine && state.engine.resize(), 220);
  }
};

/* ================================================================
   DAY / NIGHT (cosmetic) — slow cycle, night stays dim but visible
   ================================================================ */
const DAY_LENGTH_TICKS = 1000; // 1000 ticks * 600ms = 10 min per full day/night cycle
function updateDayNight() {
  const t = state.worldClock % DAY_LENGTH_TICKS;
  const phase = t / DAY_LENGTH_TICKS;
  const angle = phase * Math.PI * 2;
  const sunY = Math.sin(angle);
  const sunX = Math.cos(angle);
  state.sunLight.direction = new BABYLON.Vector3(-0.4 * sunX, -Math.max(0.15, sunY), -0.4).normalize();
  const dayFactor = Math.max(0, sunY); // 0..1 — how high the sun is

  if (dayFactor > 0.7) {
    // Bright day
    state.sunLight.intensity = 0.9;
    state.sunLight.diffuse = new BABYLON.Color3(1.0, 0.95, 0.8);
    state.ambientLight.intensity = 0.55;
    state.ambientLight.diffuse = new BABYLON.Color3(0.95, 0.88, 0.7);
    state.scene.clearColor = new BABYLON.Color4(0.45, 0.55, 0.65, 1);
    state.scene.fogColor = new BABYLON.Color3(0.5, 0.55, 0.55);
  } else if (dayFactor > 0.3) {
    // Dawn / dusk — warm orange tones, still well-lit
    const k = (dayFactor - 0.3) / 0.4; // 0..1 between dusk and full day
    state.sunLight.intensity = 0.55 + k * 0.35;
    state.sunLight.diffuse = new BABYLON.Color3(1.0, 0.7 + k * 0.25, 0.45 + k * 0.35);
    state.ambientLight.intensity = 0.5 + k * 0.05;
    state.ambientLight.diffuse = new BABYLON.Color3(0.95, 0.85, 0.7);
    state.scene.clearColor = new BABYLON.Color4(0.4 + k * 0.05, 0.35 + k * 0.2, 0.3 + k * 0.35, 1);
    state.scene.fogColor = new BABYLON.Color3(0.42, 0.35, 0.3);
  } else {
    // Night — just dim, never black. Cool blue tint.
    state.sunLight.intensity = 0.35;
    state.sunLight.diffuse = new BABYLON.Color3(0.55, 0.62, 0.85);
    state.ambientLight.intensity = 0.55;
    state.ambientLight.diffuse = new BABYLON.Color3(0.6, 0.65, 0.85);
    state.scene.clearColor = new BABYLON.Color4(0.16, 0.18, 0.26, 1);
    state.scene.fogColor = new BABYLON.Color3(0.18, 0.2, 0.28);
  }
  // Brazier glows brightest at night, off in full day
  if (state.brazierLight) {
    state.brazierLight.intensity = (1 - dayFactor) * 1.0;
  }
  if (state.torchLights) {
    const tIntensity = (1 - dayFactor) * 0.6;
    for (const tl of state.torchLights) tl.intensity = tIntensity;
  }
  // Top-bar label
  let label;
  if (dayFactor > 0.7) label = 'Day';
  else if (dayFactor > 0.3) label = sunX > 0 ? 'Dusk' : 'Dawn';
  else label = 'Night';
  const el = document.getElementById('time-of-day');
  if (el) el.textContent = `— ${label} —`;
}

/* ================================================================
   HUD LAYOUT — Session 1 (landscape, floating corner docks)
   Adds methods to existing `hud` object. Append-only.
   ================================================================ */
hud.ui = { chatOpen: false, menuOpen: false, chatMode: 'log', fullscreenAttempted: false };

hud.initLayout = function() {
  const hudEl = document.querySelector('.hud');
  const log = document.querySelector('.hud-log');
  const tabs = document.querySelector('.hud-tabs');
  const panel = document.getElementById('hud-panel');
  if (!hudEl || !log || !tabs || !panel) {
    console.warn('[hud] initLayout: missing .hud / .hud-log / .hud-tabs / #hud-panel — aborting');
    return;
  }

  const chatDock = document.createElement('div');
  chatDock.id = 'chat-dock';
  chatDock.className = 'dock';
  chatDock.innerHTML =
    '<div class="dock-header">' +
      '<div class="chat-mode-tabs">' +
        '<button class="chat-mode-tab active" data-mode="log">Log</button>' +
        '<button class="chat-mode-tab" data-mode="chat">Chat</button>' +
      '</div>' +
      '<button class="dock-close" data-dock="chat" aria-label="Close chat">×</button>' +
    '</div>' +
    '<div class="dock-body">' +
      '<div id="player-chat" style="display:none">' +
        '<div id="player-chat-messages"></div>' +
        '<form id="player-chat-form">' +
          '<input id="player-chat-input" type="text" placeholder="Say something..." maxlength="200" autocomplete="off" />' +
          '<button type="submit" class="btn small">Send</button>' +
        '</form>' +
      '</div>' +
    '</div>';

  const menuDock = document.createElement('div');
  menuDock.id = 'menu-dock';
  menuDock.className = 'dock';
  menuDock.innerHTML =
    '<div class="dock-header">' +
      '<div class="dock-title">Menu</div>' +
      '<button class="dock-close" data-dock="menu" aria-label="Close menu">×</button>' +
    '</div>' +
    '<div class="dock-body"></div>';

  // Reparent existing elements (preserves them — combat.js etc. keep working)
  const chatBody = chatDock.querySelector('.dock-body');
  chatBody.insertBefore(log, chatBody.firstChild);
  const menuBody = menuDock.querySelector('.dock-body');
  menuBody.appendChild(tabs);
  menuBody.appendChild(panel);

  hudEl.innerHTML = '';
  hudEl.appendChild(chatDock);
  hudEl.appendChild(menuDock);

  // Floating overlays — sit on game-screen, outside .hud
  const host = document.getElementById('game-screen') || document.body;
  host.insertAdjacentHTML('beforeend',
    '<button id="chat-toggle" class="dock-toggle" aria-label="Open chat">💬</button>' +
    '<button id="menu-toggle" class="dock-toggle" aria-label="Open menu">☰</button>' +
    '<button id="fullscreen-btn" aria-label="Fullscreen">⛶</button>' +
    '<div id="minimap-zone">' +
      '<canvas id="minimap-canvas" width="120" height="120" aria-label="Minimap"></canvas>' +
      '<button id="run-toggle" aria-label="Toggle run">Run</button>' +
    '</div>'
  );

  // Wire events
  document.getElementById('chat-toggle').addEventListener('click', hud.toggleChat);
  document.getElementById('menu-toggle').addEventListener('click', hud.toggleMenu);
  document.getElementById('fullscreen-btn').addEventListener('click', hud.enterFullscreen);
  document.getElementById('run-toggle').addEventListener('click', () => {
    if (!state.ready) return;
    if (state.runEnergy <= 0 && !state.running) { log('No run energy.', 'system'); return; }
    state.running = !state.running;
    hud.updateRunBtn();
    if (typeof log === 'function') log(state.running ? 'Running.' : 'Walking.', 'system');
  });
  chatDock.querySelectorAll('.chat-mode-tab').forEach(t => {
    t.addEventListener('click', () => hud.switchChatMode(t.dataset.mode));
  });
  hudEl.querySelectorAll('.dock-close').forEach(b => {
    b.addEventListener('click', () => b.dataset.dock === 'chat' ? hud.toggleChat() : hud.toggleMenu());
  });
  document.getElementById('player-chat-form').addEventListener('submit', hud.sendChat);

  window.addEventListener('resize', hud.applyDockState);
  window.addEventListener('orientationchange', hud.applyDockState);

  hud.applyDockState();
  // Canvas container changed shape — tell Babylon
  setTimeout(() => state.engine && state.engine.resize(), 50);
  setTimeout(() => state.engine && state.engine.resize(), 400);
};

hud.applyDockState = function() {
  const hudEl = document.querySelector('.hud');
  if (!hudEl) return;
  const { chatOpen, menuOpen } = hud.ui;
  document.getElementById('chat-dock').classList.toggle('open', chatOpen);
  document.getElementById('menu-dock').classList.toggle('open', menuOpen);
  const portrait = window.innerHeight > window.innerWidth;
  document.getElementById('chat-toggle').classList.toggle('hidden', chatOpen || (portrait && menuOpen));
  document.getElementById('menu-toggle').classList.toggle('hidden', menuOpen || (portrait && chatOpen));
  hudEl.classList.toggle('both-open',  chatOpen && menuOpen);
  hudEl.classList.toggle('only-chat',  chatOpen && !menuOpen);
  hudEl.classList.toggle('only-menu', !chatOpen &&  menuOpen);
  hudEl.classList.toggle('all-closed',!chatOpen && !menuOpen);
};

hud.toggleChat = function() {
  hud.ui.chatOpen = !hud.ui.chatOpen;
  hud.applyDockState();
  setTimeout(() => state.engine && state.engine.resize(), 280);
};

hud.toggleMenu = function() {
  hud.ui.menuOpen = !hud.ui.menuOpen;
  hud.applyDockState();
  setTimeout(() => state.engine && state.engine.resize(), 280);
};

hud.switchChatMode = function(mode) {
  hud.ui.chatMode = mode;
  document.querySelectorAll('.chat-mode-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.mode === mode);
  });
  const log = document.querySelector('.hud-log');
  const chat = document.getElementById('player-chat');
  if (mode === 'log') { log.style.display = ''; chat.style.display = 'none'; }
  else { log.style.display = 'none'; chat.style.display = 'flex'; }
};

hud.sendChat = function(e) {
  e.preventDefault();
  const input = document.getElementById('player-chat-input');
  const msgs = document.getElementById('player-chat-messages');
  const text = (input.value || '').trim();
  if (!text) return false;
  const safe = text.replace(/[<>&]/g, c => ({ '<':'&lt;', '>':'&gt;', '&':'&amp;' }[c]));
  const line = document.createElement('div');
  line.className = 'chat-line';
  line.innerHTML = '<span class="chat-author">You:</span> ' + safe;
  msgs.appendChild(line);
  msgs.scrollTop = msgs.scrollHeight;
  hud.showHeadBubble(text);
  input.value = '';
  return false;
};

hud.enterFullscreen = async function() {
  const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
  if (fsEl) {
    // Already fullscreen — exit
    try {
      if (document.exitFullscreen) await document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    } catch (err) { console.warn('[hud] exit fullscreen failed', err); }
    setTimeout(hud.checkOrientation, 300);
    return;
  }
  hud.ui.fullscreenAttempted = true;
  try {
    const el = document.documentElement;
    if (el.requestFullscreen) await el.requestFullscreen();
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    if (screen.orientation && screen.orientation.lock) {
      try { await screen.orientation.lock('landscape'); } catch (_) { /* iOS Safari: ignored */ }
    }
  } catch (err) { console.warn('[hud] fullscreen failed', err); }
  setTimeout(hud.checkOrientation, 300);
};


hud.updateRunBtn = function() {
  const btn = document.getElementById('run-toggle');
  if (!btn) return;
  const energy = Math.round(state.runEnergy);
  btn.textContent = state.running ? `Run ${energy}%` : `Walk`;
  btn.classList.toggle('run-active', state.running);
  btn.classList.toggle('run-empty', state.runEnergy <= 0);
};

hud.drawMinimap = function() {
  const canvas = document.getElementById('minimap-canvas');
  if (!canvas || !state.player) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const R = W / 2;
  // View radius in grid tiles
  const VIEW = 20;

  ctx.clearRect(0, 0, W, H);

  // Circular clip
  ctx.save();
  ctx.beginPath();
  ctx.arc(R, R, R - 1, 0, Math.PI * 2);
  ctx.clip();

  // Background
  ctx.fillStyle = '#1a2410';
  ctx.fillRect(0, 0, W, H);

  const px = state.player.gx, pz = state.player.gz;
  const scale = R / VIEW;

  // Draw obstacles (buildings/walls as darker boxes)
  ctx.fillStyle = '#5a4a35';
  state.obstacles.forEach(key => {
    const [ox, oz] = key.split(',').map(Number);
    const sx = R + (ox - px) * scale;
    const sy = R + (oz - pz) * scale;
    if (sx > -2 && sx < W + 2 && sy > -2 && sy < H + 2) {
      ctx.fillRect(sx - scale * 0.5, sy - scale * 0.5, scale, scale);
    }
  });

  // Enemies
  state.enemies.forEach(e => {
    const sx = R + (e.gx - px) * scale;
    const sy = R + (e.gz - pz) * scale;
    ctx.fillStyle = '#cc3333';
    ctx.beginPath();
    ctx.arc(sx, sy, Math.max(2, scale * 0.6), 0, Math.PI * 2);
    ctx.fill();
  });

  // NPCs
  world.npcs && world.npcs.forEach(n => {
    const sx = R + (n.gx - px) * scale;
    const sy = R + (n.gz - pz) * scale;
    ctx.fillStyle = '#88ccff';
    ctx.beginPath();
    ctx.arc(sx, sy, Math.max(2, scale * 0.6), 0, Math.PI * 2);
    ctx.fill();
  });

  // Player dot
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(R, R, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  // Border ring
  ctx.strokeStyle = '#8a7040';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(R, R, R - 1, 0, Math.PI * 2);
  ctx.stroke();
};

// Draw minimap every ~200ms
setInterval(() => { if (state.ready) hud.drawMinimap(); }, 200);

/* ================================================================
   HEAD BUBBLE — chat text floats above player like RS2004
   ================================================================ */
hud._bubble = null;

hud.showHeadBubble = function(text) {
  // Remove any existing bubble
  if (hud._bubble) { hud._bubble.remove(); hud._bubble = null; }

  const el = document.createElement('div');
  el.className = 'head-bubble';
  // Clamp long messages to ~60 chars
  el.textContent = text.length > 60 ? text.slice(0, 57) + '…' : text;
  document.getElementById('canvas-wrap').appendChild(el);
  hud._bubble = el;

  // Fade out after 4s
  const DURATION = 4000;
  const FADE = 800;
  setTimeout(() => {
    if (hud._bubble !== el) return;
    el.style.transition = `opacity ${FADE}ms`;
    el.style.opacity = '0';
    setTimeout(() => { if (hud._bubble === el) { el.remove(); hud._bubble = null; } }, FADE);
  }, DURATION - FADE);
};

hud.updateBubblePos = function() {
  if (!hud._bubble || !state.playerMesh || !state.scene || !state.engine) return;
  const mesh = state.playerMesh;
  // Project a point ~1.8 units above the player mesh
  const above = mesh.position.clone();
  above.y += 1.8;
  const viewport = state.scene.activeCamera.viewport.toGlobal(
    state.engine.getRenderWidth(), state.engine.getRenderHeight()
  );
  const projected = BABYLON.Vector3.Project(
    above,
    BABYLON.Matrix.Identity(),
    state.scene.getTransformMatrix(),
    viewport
  );
  // Only show if in front of camera (z < 1)
  if (projected.z < 0 || projected.z > 1) {
    hud._bubble.style.display = 'none';
    return;
  }
  hud._bubble.style.display = '';
  hud._bubble.style.left = projected.x + 'px';
  hud._bubble.style.top = projected.y + 'px';
};

// Scripts load dynamically after Babylon, so DOMContentLoaded has already fired.
// Call initLayout directly — DOM elements are in the HTML from page load.
setTimeout(() => hud.initLayout(), 0);
