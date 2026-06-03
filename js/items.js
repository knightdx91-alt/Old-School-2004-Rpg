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
  oak_staff: {
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
  _sourceType: null, // 'chest' | 'bag'
  _sourceId: null,

  _getSource() {
    if (this._sourceType === 'chest') return CHESTS[this._sourceId];
    if (this._sourceType === 'bag') return (world.groundBags && world.groundBags[this._sourceId]);
    return null;
  },

  open(sourceType, sourceId) {
    const src = sourceType === 'chest' ? CHESTS[sourceId] : (world.groundBags && world.groundBags[sourceId]);
    if (!src) return;
    this.active = true;
    this._sourceType = sourceType;
    this._sourceId = sourceId;
    if (sourceType === 'chest') {
      src.opened = true;
      world.openChestLid(sourceId);
    }
    this._render();
    document.getElementById('loot-overlay').classList.add('active');
  },

  _render() {
    const src = this._getSource();
    if (!src) { this.close(); return; }
    const remaining = src.loot.filter(id => !src.taken.includes(id));
    const el = document.getElementById('loot-items');
    document.getElementById('loot-title').textContent = src.name || 'Chest';
    if (remaining.length === 0) {
      el.innerHTML = '<div class="loot-empty">Empty.</div>';
      document.getElementById('loot-take-all').style.display = 'none';
    } else {
      document.getElementById('loot-take-all').style.display = '';
      el.innerHTML = remaining.map(id => {
        const item = ITEMS[id];
        if (!item) return '';
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

  // Returns true if item was taken, false if inventory full
  take(itemId) {
    const p = state.player;
    const src = this._getSource();
    if (!src || src.taken.includes(itemId)) return true; // already taken, not a failure
    const maxInv = p.maxInventory || 20;
    const item = ITEMS[itemId];
    if (!item) return true;

    if (itemId === 'quiver_arrows') {
      if (p.equipped.ammo === 'quiver_arrows') {
        src.taken.push(itemId);
        p.ammoCount = item.maxArrows;
        log(`Refilled quiver — ${item.maxArrows} arrows.`, 'system');
      } else if (p.inventory.length < maxInv) {
        src.taken.push(itemId);
        if (!p.inventory.includes('quiver_arrows')) p.inventory.push('quiver_arrows');
        p.ammoCount = item.maxArrows;
        log(`Took ${item.name} — ${item.maxArrows} arrows.`, 'system');
      } else {
        return false; // inventory full
      }
    } else {
      if (p.inventory.length >= maxInv) return false;
      src.taken.push(itemId);
      p.inventory.push(itemId);
      log(`Took: ${item.name}.`, 'system');
    }
    this._render();
    hud.renderWindows && hud.renderWindows();
    return true;
  },

  takeAll() {
    const src = this._getSource();
    if (!src) return;
    const remaining = src.loot.filter(id => !src.taken.includes(id));
    const overflow = [];
    for (const id of remaining) {
      if (!this.take(id)) overflow.push(id);
    }
    if (overflow.length > 0) {
      world.spawnGroundBag(state.player.gx, state.player.gz, overflow);
      log(`Inventory full — ${overflow.length} item(s) dropped nearby.`, 'system');
    }
    this.close();
  },

  close() {
    if (this._sourceType === 'chest' && this._sourceId) {
      world.closeChestLid(this._sourceId);
    } else if (this._sourceType === 'bag' && this._sourceId) {
      const bag = world.groundBags && world.groundBags[this._sourceId];
      if (bag) {
        const remaining = bag.loot.filter(id => !bag.taken.includes(id));
        if (remaining.length === 0) {
          bag.meshes.forEach(m => m.dispose && m.dispose());
          delete world.groundBags[this._sourceId];
        }
      }
    }
    this.active = false;
    this._sourceType = null;
    this._sourceId = null;
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
  if (prev && !p.inventory.includes(prev)) p.inventory.push(prev);
  p.equipped[item.slot] = itemId;
  const idx = p.inventory.indexOf(itemId);
  if (idx !== -1) p.inventory.splice(idx, 1);
  if (item.slot === 'weapon') world.updatePlayerWeapon && world.updatePlayerWeapon(itemId);
  log(`Equipped: ${item.name}.`, 'system');
  hud.renderWindows ? hud.renderWindows() : hud.render();
}

function unequipSlot(slot) {
  const p = state.player;
  const id = p.equipped[slot];
  if (!id) return;
  p.equipped[slot] = null;
  if (!p.inventory.includes(id)) p.inventory.push(id);
  if (slot === 'weapon') world.updatePlayerWeapon && world.updatePlayerWeapon(null);
  log(`Unequipped: ${ITEMS[id].name}.`, 'system');
  hud.renderWindows ? hud.renderWindows() : hud.render();
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
  hud.renderWindows ? hud.renderWindows() : hud.render();
}
