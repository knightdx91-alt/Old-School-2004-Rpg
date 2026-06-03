/* ================================================================
   ITEMS
   ================================================================ */

const SLOTS = ['head','cape','amulet','weapon','body','shield','legs','gloves','boots','ring','ammo'];

const ITEMS = {
  apprentice_robe: {
    name: 'Apprentice Robe', slot: 'body', def: 2,
    desc: 'Plain grey robes issued to academy students.',
    icon: '🧥'
  },
  apprentice_hat: {
    name: 'Apprentice Hat', slot: 'head', def: 1,
    desc: 'A brimmed hat marked with a first-year stripe.',
    icon: '🎓'
  },
  leather_boots: {
    name: 'Leather Boots', slot: 'boots', def: 1,
    desc: 'Sturdy travelling boots.',
    icon: '👢'
  },
  iron_amulet: {
    name: 'Iron Amulet', slot: 'amulet', def: 1,
    desc: 'A plain iron pendant. Mild protection.',
    icon: '📿'
  },
  // Melee
  oak_staff_melee: {
    name: 'Oak Staff', slot: 'weapon', atk: 4,
    desc: 'A simple oak staff. Can be used to strike foes.',
    icon: '🪄'
  },
  // Magic ranged
  magic_staff: {
    name: 'Apprentice Staff', slot: 'weapon', atk: 6, range: true,
    desc: 'An academy-issue staff that channels sygl energy over distance.',
    icon: '✨'
  },
  // Bow (ranged, requires ammo)
  short_bow: {
    name: 'Short Bow', slot: 'weapon', atk: 5, range: true, requiresAmmo: true,
    desc: 'A compact yew bow. Requires arrows to fire.',
    icon: '🏹'
  },
  // Quiver — goes in ammo slot; arrow count tracked in player.ammoCount
  quiver_arrows: {
    name: 'Quiver of Arrows', slot: 'ammo', maxArrows: 25,
    desc: 'Holds up to 25 arrows.',
    icon: '🎯'
  },
  // Consumable
  health_potion: {
    name: 'Health Potion', slot: null, hp: 20,
    desc: 'Restores 20 HP when consumed.',
    icon: '🧪',
    type: 'consumable'
  }
};

/* ── Chest definitions ──────────────────────────────────────── */
const CHESTS = {
  fountain: {
    name: 'Old Chest',
    desc: 'A weathered chest left beside the fountain. The lid creaks open.',
    loot: [
      'apprentice_hat',
      'apprentice_robe',
      'leather_boots',
      'iron_amulet',
      'magic_staff',
      'short_bow',
      'quiver_arrows',
      'health_potion',
    ],
    taken: [],   // item ids already taken by the player
    opened: false
  }
};

/* ── Loot overlay ───────────────────────────────────────────── */
const loot = {
  active: false,
  _chestId: null,

  open(chestId) {
    const chest = CHESTS[chestId];
    if (!chest) return;
    this.active = true;
    this._chestId = chestId;
    chest.opened = true;
    world.openChestLid(chestId);
    this._render();
    document.getElementById('loot-overlay').classList.add('active');
  },

  _render() {
    const chest = CHESTS[this._chestId];
    const remaining = chest.loot.filter(id => !chest.taken.includes(id));
    const el = document.getElementById('loot-items');
    document.getElementById('loot-title').textContent = chest.name;
    if (remaining.length === 0) {
      el.innerHTML = '<div class="loot-empty">The chest is empty.</div>';
      document.getElementById('loot-take-all').style.display = 'none';
    } else {
      document.getElementById('loot-take-all').style.display = '';
      el.innerHTML = remaining.map(id => {
        const item = ITEMS[id];
        const extra = id === 'quiver_arrows' ? ' (25 arrows)' : '';
        return `<div class="loot-row">
          <span class="loot-icon">${item.icon}</span>
          <span class="loot-name">${item.name}${extra}</span>
          <span class="loot-desc">${item.desc}</span>
          <button class="btn small" onclick="loot.take('${id}')">Take</button>
        </div>`;
      }).join('');
    }
  },

  take(itemId) {
    const p = state.player;
    const chest = CHESTS[this._chestId];
    if (chest.taken.includes(itemId)) return;
    chest.taken.push(itemId);
    const item = ITEMS[itemId];
    if (itemId === 'quiver_arrows') {
      // If quiver already in ammo slot, refill arrows; otherwise add to inventory
      if (p.equipped.ammo === 'quiver_arrows') {
        p.ammoCount = item.maxArrows;
        log(`Refilled quiver — ${item.maxArrows} arrows.`, 'system');
      } else {
        if (!p.inventory.includes('quiver_arrows')) p.inventory.push('quiver_arrows');
        p.ammoCount = item.maxArrows;
        log(`Took ${item.name} — ${item.maxArrows} arrows.`, 'system');
      }
    } else {
      p.inventory.push(itemId);
      log(`Took: ${item.name}.`, 'system');
    }
    this._render();
    hud.render();
  },

  takeAll() {
    const chest = CHESTS[this._chestId];
    const remaining = chest.loot.filter(id => !chest.taken.includes(id));
    remaining.forEach(id => this.take(id));
  },

  close() {
    this.active = false;
    this._chestId = null;
    document.getElementById('loot-overlay').classList.remove('active');
  }
};

/* ── Equipment helpers ──────────────────────────────────────── */
function getEquipBonuses() {
  const p = state.player;
  if (!p || !p.equipped) return { atk: 0, def: 0 };
  let atk = 0, def = 0;
  for (const slot of SLOTS) {
    const id = p.equipped[slot];
    if (!id) continue;
    const item = ITEMS[id];
    if (!item) continue;
    atk += (item.atk || 0);
    def += (item.def || 0);
  }
  return { atk, def };
}

function equipItem(itemId) {
  const p = state.player;
  const item = ITEMS[itemId];
  if (!item || !item.slot) return;
  const prev = p.equipped[item.slot];
  if (prev) {
    if (!p.inventory.includes(prev)) p.inventory.push(prev);
  }
  p.equipped[item.slot] = itemId;
  const idx = p.inventory.indexOf(itemId);
  if (idx !== -1) p.inventory.splice(idx, 1);
  log(`Equipped: ${item.name}.`, 'system');
  hud.render();
}

function unequipSlot(slot) {
  const p = state.player;
  const id = p.equipped[slot];
  if (!id) return;
  p.equipped[slot] = null;
  if (!p.inventory.includes(id)) p.inventory.push(id);
  log(`Unequipped: ${ITEMS[id].name}.`, 'system');
  hud.render();
}

function useItem(itemId) {
  const p = state.player;
  const item = ITEMS[itemId];
  if (!item || item.type !== 'consumable') return;
  const idx = p.inventory.indexOf(itemId);
  if (idx === -1) return;
  if (item.hp) {
    const healed = Math.min(item.hp, p.hpMax - p.hp);
    p.hp = Math.min(p.hpMax, p.hp + item.hp);
    log(`You drink the ${item.name}. Restored ${healed} HP.`, 'system');
  }
  p.inventory.splice(idx, 1);
  hud.render();
}
