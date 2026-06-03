/* ================================================================
   ITEMS
   ================================================================ */

// Equipment slots used by the paper doll
const SLOTS = ['head','cape','amulet','weapon','body','shield','legs','gloves','boots','ring','ammo'];

// Item definitions: id → { name, slot, atk, def, desc, icon }
const ITEMS = {
  // Starter gear examples (not given to player at start — to be found/bought)
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
  oak_staff: {
    name: 'Oak Staff', slot: 'weapon', atk: 4,
    desc: 'A simple oak staff. Focuses sygl energy.',
    icon: '🪄'
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
  // Consumable
  health_potion: {
    name: 'Health Potion', slot: null, hp: 20,
    desc: 'Restores 20 HP when consumed.',
    icon: '🧪',
    type: 'consumable'
  }
};

// Return stat bonuses from all equipped items
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

// Equip an item from inventory
function equipItem(itemId) {
  const p = state.player;
  const item = ITEMS[itemId];
  if (!item || !item.slot) return;
  // Move current equipped back to inventory
  const prev = p.equipped[item.slot];
  if (prev) {
    if (!p.inventory.includes(prev)) p.inventory.push(prev);
  }
  p.equipped[item.slot] = itemId;
  // Remove from inventory
  const idx = p.inventory.indexOf(itemId);
  if (idx !== -1) p.inventory.splice(idx, 1);
  log(`Equipped: ${item.name}.`, 'system');
  hud.render();
}

// Unequip a slot — move item back to inventory
function unequipSlot(slot) {
  const p = state.player;
  const id = p.equipped[slot];
  if (!id) return;
  p.equipped[slot] = null;
  if (!p.inventory.includes(id)) p.inventory.push(id);
  log(`Unequipped: ${ITEMS[id].name}.`, 'system');
  hud.render();
}

// Use a consumable from inventory
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
