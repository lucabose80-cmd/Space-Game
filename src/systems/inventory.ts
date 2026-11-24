import { getItemDef } from '../data/items';
import type { InventoryData, ItemStack } from '../types';

export type ContainerId = 'cargo' | 'chest';

export const CARGO_SIZE = 20;
export const CHEST_SIZE = 28;

export function createEmptyInventory(): InventoryData {
  return {
    cargo: Array.from({ length: CARGO_SIZE }, () => null),
    chest: Array.from({ length: CHEST_SIZE }, () => null),
  };
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
 * - All carried backpack loot is secured!
 * - Any 'warp_anchor' relic teleports its right-neighbor slot straight into the Shop Chest!
 */
export function processSafeReturnEffects(inv: InventoryData): {
  warpedToChest: string[];
  savedCount: number;
} {
  const warpedToChest: string[] = [];
  let warpedCount = 0;
  const cols = 5;

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
            warpedCount += moved;
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
    savedCount: countBackpackItems(inv) + warpedCount,
  };
}

/**
 * Moonlighter-style Extraction Defeat Penalty:
 * - Falling at 0 HP in the dungeon loses ALL carried expedition backpack items!
 * - Only items previously stored in your Shop Storage Chest remain safe!
 */
export function processDefeatPenalty(inv: InventoryData): {
  itemsLost: number;
  itemsSaved: number;
  shatteredItems: string[];
} {
  let itemsLost = 0;
  const shatteredItems: string[] = [];

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
    itemsSaved: 0,
    shatteredItems,
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
