import { getItemDef } from '../data/items';
import type { InventoryData, ItemStack } from '../types';

export type ContainerId = 'cargo' | 'chest';

export const CARGO_SIZE = 20;
export const CHEST_SIZE = 28;

export function createEmptyInventory(chestCapacity = CHEST_SIZE): InventoryData {
  return {
    cargo: Array.from({ length: CARGO_SIZE }, () => null),
    chest: Array.from({ length: Math.max(CHEST_SIZE, chestCapacity) }, () => null),
  };
}

export function ensureChestCapacity(inv: InventoryData, capacity: number): void {
  const target = Math.max(CHEST_SIZE, capacity);
  while (inv.chest.length < target) {
    inv.chest.push(null);
  }
}

function tryAddToSlots(slots: Array<ItemStack | null>, itemId: string, qty: number): number {
  const def = getItemDef(itemId);
  let remaining = qty;

  for (let i = 0; i < slots.length && remaining > 0; i++) {
    const slot = slots[i];
    if (slot && slot.itemId === itemId && slot.qty < def.maxStack) {
      const add = Math.min(remaining, def.maxStack - slot.qty);
      slot.qty += add;
      remaining -= add;
    }
  }

  for (let i = 0; i < slots.length && remaining > 0; i++) {
    if (slots[i] === null) {
      const add = Math.min(remaining, def.maxStack);
      slots[i] = { itemId, qty: add };
      remaining -= add;
    }
  }

  return remaining;
}

/**
 * Adds dungeon/expedition loot directly into the 20-slot Expedition Backpack (cargo).
 * Only secured upon extraction!
 */
export function addItemToBackpack(inv: InventoryData, itemId: string, qty = 1): number {
  return tryAddToSlots(inv.cargo, itemId, qty);
}

export function addItemToChest(inv: InventoryData, itemId: string, qty = 1): number {
  return tryAddToSlots(inv.chest, itemId, qty);
}

export function addItemAnywhere(inv: InventoryData, itemId: string, qty = 1): number {
  let rem = addItemToChest(inv, itemId, qty);
  if (rem > 0) {
    rem = addItemToBackpack(inv, itemId, rem);
  }
  return rem;
}

export function countItemTotal(inv: InventoryData, itemId: string): number {
  let total = 0;
  for (const list of [inv.cargo, inv.chest]) {
    for (const s of list) {
      if (s && s.itemId === itemId) total += s.qty;
    }
  }
  return total;
}

export function countBackpackItems(inv: InventoryData): number {
  let total = 0;
  for (const s of inv.cargo) {
    if (s) total += s.qty;
  }
  return total;
}

export function isBackpackFullFor(inv: InventoryData, itemId: string): boolean {
  const def = getItemDef(itemId);
  for (const s of inv.cargo) {
    if (s === null) return false;
    if (s.itemId === itemId && s.qty < def.maxStack) return false;
  }
  return true;
}

export function consumeItemTotal(inv: InventoryData, itemId: string, qty: number): boolean {
  if (countItemTotal(inv, itemId) < qty) return false;
  let rem = qty;
  for (const list of [inv.cargo, inv.chest]) {
    for (let i = 0; i < list.length && rem > 0; i++) {
      const slot = list[i];
      if (slot && slot.itemId === itemId) {
        const take = Math.min(rem, slot.qty);
        slot.qty -= take;
        rem -= take;
        if (slot.qty <= 0) list[i] = null;
      }
    }
  }
  return true;
}

export function takeOneFromSlot(
  inv: InventoryData,
  container: ContainerId,
  index: number,
): string | null {
  const list = inv[container];
  const slot = list[index];
  if (!slot || slot.qty <= 0) return null;
  const id = slot.itemId;
  slot.qty -= 1;
  if (slot.qty <= 0) list[index] = null;
  return id;
}

export function swapOrMergeSlots(
  inv: InventoryData,
  fromContainer: ContainerId,
  fromIdx: number,
  toContainer: ContainerId,
  toIdx: number,
): void {
  if (fromContainer === toContainer && fromIdx === toIdx) return;
  const srcList = inv[fromContainer];
  const dstList = inv[toContainer];
  const src = srcList[fromIdx];
  const dst = dstList[toIdx];
  if (!src) return;

  if (dst && dst.itemId === src.itemId) {
    const maxStack = getItemDef(src.itemId).maxStack;
    const space = maxStack - dst.qty;
    if (space > 0) {
      const move = Math.min(space, src.qty);
      dst.qty += move;
      src.qty -= move;
      if (src.qty <= 0) srcList[fromIdx] = null;
      return;
    }
  }
  dstList[toIdx] = src;
  srcList[fromIdx] = dst;
}

export function quickTransferSlot(
  inv: InventoryData,
  fromContainer: ContainerId,
  index: number,
  chestAvailable: boolean,
): boolean {
  if (!chestAvailable) return false;
  const srcList = inv[fromContainer];
  const slot = srcList[index];
  if (!slot) return false;

  if (fromContainer === 'chest') {
    const rem = addItemToBackpack(inv, slot.itemId, slot.qty);
    if (rem === 0) srcList[index] = null;
    else slot.qty = rem;
    return true;
  }

  const rem = addItemToChest(inv, slot.itemId, slot.qty);
  if (rem === 0) srcList[index] = null;
  else slot.qty = rem;
  return true;
}

/**
 * Moves all cargo items cleanly into the Shop Storage Chest (handy 1-click button!).
 */
export function depositAllCargoToChest(inv: InventoryData): number {
  let moved = 0;
  for (let i = 0; i < inv.cargo.length; i++) {
    const s = inv.cargo[i];
    if (!s) continue;
    const rem = addItemToChest(inv, s.itemId, s.qty);
    moved += s.qty - rem;
    if (rem === 0) inv.cargo[i] = null;
    else s.qty = rem;
  }
  return moved;
}

/**
 * Safe extraction (Start Warp Pad, Warp-Beacon [R], or Boss Victory):
 * Evaluates all directional positional modifiers on the 5x4 Expedition Cargo Grid:
 * - row_curse (▲): decays unless placed in the top row (indices 0..4)
 * - volatile_boost (←): consumes 1 unit from left neighbor for +180 Cr resonance bonus
 * - mirror_clone (↑): duplicates +1 copy of the relic directly above (index - 5)
 * - warp_anchor (→): teleports right neighbor straight into the Shop Chest
 */
export function processSafeReturnEffects(inv: InventoryData): {
  warpedToChest: string[];
  clonedItems: string[];
  cursedLost: string[];
  synthesizedItems: string[];
  resonanceBonus: number;
  savedCount: number;
} {
  const warpedToChest: string[] = [];
  const clonedItems: string[] = [];
  const cursedLost: string[] = [];
  const synthesizedItems: string[] = [];
  const resonanceBonus = 0;
  let extraChestSaved = 0;
  const cols = 5;

  // 1. row_curse (▲): must sit in top row (0..4) or it destabilizes on warp!
  for (let i = cols; i < inv.cargo.length; i++) {
    const s = inv.cargo[i];
    if (!s) continue;
    const def = getItemDef(s.itemId);
    if (def.modifier === 'row_curse') {
      cursedLost.push(s.qty > 1 ? `${def.name} (×${s.qty})` : def.name);
      inv.cargo[i] = null;
    }
  }

  // 2. volatile_boost (←): transmutes 1 unit of the left neighbor into 1 Star Compass relic (0 direct credits!)
  let synthCount = 0;
  for (let i = 0; i < inv.cargo.length; i++) {
    const s = inv.cargo[i];
    if (!s) continue;
    if (getItemDef(s.itemId).modifier === 'volatile_boost') {
      const col = i % cols;
      if (col > 0) {
        const leftIdx = i - 1;
        const left = inv.cargo[leftIdx];
        if (left && left.qty > 0 && left.itemId !== 'star_compass') {
          left.qty -= 1;
          if (left.qty <= 0) inv.cargo[leftIdx] = null;
          synthCount += 1;
        }
      }
    }
  }
  for (let k = 0; k < synthCount; k++) {
    const remBag = addItemToBackpack(inv, 'star_compass', 1);
    if (remBag === 0) {
      synthesizedItems.push(getItemDef('star_compass').name);
    } else {
      const remChest = addItemToChest(inv, 'star_compass', 1);
      if (remChest === 0) {
        extraChestSaved += 1;
        synthesizedItems.push(getItemDef('star_compass').name);
      }
    }
  }

  // 3. mirror_clone (↑): snapshot targets directly above before cloning +1 unit!
  const cloneTargets: string[] = [];
  for (let i = cols; i < inv.cargo.length; i++) {
    const s = inv.cargo[i];
    if (!s) continue;
    if (getItemDef(s.itemId).modifier === 'mirror_clone') {
      const above = inv.cargo[i - cols];
      if (above && above.qty > 0) {
        cloneTargets.push(above.itemId);
      }
    }
  }
  for (const itemId of cloneTargets) {
    const remBag = addItemToBackpack(inv, itemId, 1);
    if (remBag === 0) {
      clonedItems.push(getItemDef(itemId).name);
    } else {
      const remChest = addItemToChest(inv, itemId, 1);
      if (remChest === 0) {
        extraChestSaved += 1;
        clonedItems.push(getItemDef(itemId).name);
      }
    }
  }

  // 4. warp_anchor (→): teleports right neighbor straight into the Shop Chest!
  for (let i = 0; i < inv.cargo.length; i++) {
    const s = inv.cargo[i];
    if (!s) continue;
    if (getItemDef(s.itemId).modifier === 'warp_anchor') {
      const col = i % cols;
      if (col < cols - 1) {
        const rightIdx = i + 1;
        const neighbor = inv.cargo[rightIdx];
        if (neighbor) {
          const rem = addItemToChest(inv, neighbor.itemId, neighbor.qty);
          const moved = neighbor.qty - rem;
          if (moved > 0) {
            extraChestSaved += moved;
            warpedToChest.push(getItemDef(neighbor.itemId).name);
          }
          if (rem === 0) inv.cargo[rightIdx] = null;
          else neighbor.qty = rem;
        }
      }
    }
  }

  return {
    warpedToChest,
    clonedItems,
    cursedLost,
    synthesizedItems,
    resonanceBonus,
    savedCount: countBackpackItems(inv) + extraChestSaved,
  };
}

/**
 * Moonlighter-style Extraction Defeat Penalty:
 * - First, any 'warp_anchor' (→) relic rescues its RIGHT neighbor slot straight into the Shop Chest!
 * - All remaining carried expedition backpack items are lost at 0 HP!
 */
export function processDefeatPenalty(inv: InventoryData): {
  itemsLost: number;
  itemsSaved: number;
  shatteredItems: string[];
  warpedToChest: string[];
} {
  let itemsLost = 0;
  let itemsSaved = 0;
  const shatteredItems: string[] = [];
  const warpedToChest: string[] = [];
  const cols = 5;

  // Step 1: Collect right-neighbor indices protected by warp_anchor (→) BEFORE wiping cargo!
  const protectedRightSlots = new Set<number>();
  for (let i = 0; i < inv.cargo.length; i++) {
    const s = inv.cargo[i];
    if (!s) continue;
    if (getItemDef(s.itemId).modifier === 'warp_anchor' && i % cols < cols - 1) {
      protectedRightSlots.add(i + 1);
    }
  }

  for (const idx of protectedRightSlots) {
    const neighbor = inv.cargo[idx];
    if (!neighbor) continue;
    const rem = addItemToChest(inv, neighbor.itemId, neighbor.qty);
    const moved = neighbor.qty - rem;
    if (moved > 0) {
      itemsSaved += moved;
      warpedToChest.push(getItemDef(neighbor.itemId).name);
    }
    if (rem === 0) inv.cargo[idx] = null;
    else neighbor.qty = rem;
  }

  // Step 2: Wipe all remaining cargo slots
  for (let i = 0; i < inv.cargo.length; i++) {
    const s = inv.cargo[i];
    if (s) {
      itemsLost += s.qty;
      if (getItemDef(s.itemId).modifier === 'fragile') {
        shatteredItems.push(getItemDef(s.itemId).name);
      }
      inv.cargo[i] = null;
    }
  }

  return {
    itemsLost,
    itemsSaved,
    shatteredItems,
    warpedToChest,
  };
}

export function getAllAvailableShopItems(inv: InventoryData): Array<{
  container: ContainerId;
  index: number;
  stack: ItemStack;
}> {
  const result: Array<{ container: ContainerId; index: number; stack: ItemStack }> = [];
  const containers: ContainerId[] = ['cargo', 'chest'];
  for (const c of containers) {
    const list = inv[c];
    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      if (s && s.qty > 0) {
        result.push({ container: c, index: i, stack: s });
      }
    }
  }
  return result;
}
