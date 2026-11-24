import { getItemDef } from '../data/items';
import type { InventoryData, ItemStack } from '../types';

export type ContainerId = 'safeBelt' | 'cargo' | 'chest';

export const SAFE_BELT_SIZE = 5;
export const CARGO_SIZE = 15;
export const CHEST_SIZE = 28;

export function createEmptyInventory(): InventoryData {
  return {
    safeBelt: Array.from({ length: SAFE_BELT_SIZE }, () => null),
    cargo: Array.from({ length: CARGO_SIZE }, () => null),
    chest: Array.from({ length: CHEST_SIZE }, () => null),
  };
}

function tryAddToSlots(slots: Array<ItemStack | null>, itemId: string, qty: number): number {
  const def = getItemDef(itemId);
  let remaining = qty;

  // 1. Stack onto existing partial stacks
  for (let i = 0; i < slots.length && remaining > 0; i++) {
    const slot = slots[i];
    if (slot && slot.itemId === itemId && slot.qty < def.maxStack) {
      const add = Math.min(remaining, def.maxStack - slot.qty);
      slot.qty += add;
      remaining -= add;
    }
  }

  // 2. Fill empty slots
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
 * Adds item to player backpack (safeBelt first for convenience, then cargo).
 * Returns leftover quantity that could not fit.
 */
export function addItemToBackpack(inv: InventoryData, itemId: string, qty = 1): number {
  let rem = tryAddToSlots(inv.safeBelt, itemId, qty);
  if (rem > 0) {
    rem = tryAddToSlots(inv.cargo, itemId, rem);
  }
  return rem;
}

export function addItemToChest(inv: InventoryData, itemId: string, qty = 1): number {
  return tryAddToSlots(inv.chest, itemId, qty);
}

export function addItemAnywhere(inv: InventoryData, itemId: string, qty = 1): number {
  let rem = addItemToBackpack(inv, itemId, qty);
  if (rem > 0) {
    rem = addItemToChest(inv, itemId, rem);
  }
  return rem;
}

export function countItemTotal(inv: InventoryData, itemId: string): number {
  let total = 0;
  for (const list of [inv.safeBelt, inv.cargo, inv.chest]) {
    for (const s of list) {
      if (s && s.itemId === itemId) total += s.qty;
    }
  }
  return total;
}

export function countBackpackItems(inv: InventoryData): number {
  let total = 0;
  for (const list of [inv.safeBelt, inv.cargo]) {
    for (const s of list) {
      if (s) total += s.qty;
    }
  }
  return total;
}

export function isBackpackFullFor(inv: InventoryData, itemId: string): boolean {
  const def = getItemDef(itemId);
  for (const list of [inv.safeBelt, inv.cargo]) {
    for (const s of list) {
      if (s === null) return false;
      if (s.itemId === itemId && s.qty < def.maxStack) return false;
    }
  }
  return true;
}

export function consumeItemTotal(inv: InventoryData, itemId: string, qty: number): boolean {
  if (countItemTotal(inv, itemId) < qty) return false;
  let rem = qty;
  // Prefer consuming from cargo, then chest, then safeBelt
  for (const list of [inv.cargo, inv.chest, inv.safeBelt]) {
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
  const srcList = inv[fromContainer];
  const slot = srcList[index];
  if (!slot) return false;

  if (fromContainer === 'chest') {
    const rem = addItemToBackpack(inv, slot.itemId, slot.qty);
    if (rem === 0) srcList[index] = null;
    else slot.qty = rem;
    return true;
  }

  if (chestAvailable) {
    const rem = addItemToChest(inv, slot.itemId, slot.qty);
    if (rem === 0) srcList[index] = null;
    else slot.qty = rem;
    return true;
  }

  // Otherwise toggle between cargo and safeBelt
  const target = fromContainer === 'cargo' ? inv.safeBelt : inv.cargo;
  const rem = tryAddToSlots(target, slot.itemId, slot.qty);
  if (rem === 0) srcList[index] = null;
  else slot.qty = rem;
  return true;
}

/**
 * Processes Moonlighter-style Cargo Modifiers upon returning safely via Warp/Boss.
 * - warp_anchor: sends the slot immediately to the right in the same row directly to the shop chest!
 */
export function processSafeReturnEffects(inv: InventoryData): {
  warpedToChest: string[];
  savedCount: number;
} {
  const warpedToChest: string[] = [];

  const checkGrid = (slots: Array<ItemStack | null>, cols: number) => {
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      if (!s) continue;
      if (getItemDef(s.itemId).modifier === 'warp_anchor') {
        const col = i % cols;
        if (col < cols - 1) {
          const rightIdx = i + 1;
          const neighbor = slots[rightIdx];
          if (neighbor) {
            const rem = addItemToChest(inv, neighbor.itemId, neighbor.qty);
            if (rem < neighbor.qty) {
              warpedToChest.push(getItemDef(neighbor.itemId).name);
            }
            if (rem === 0) slots[rightIdx] = null;
            else neighbor.qty = rem;
          }
        }
      }
    }
  };

  checkGrid(inv.safeBelt, 5);
  checkGrid(inv.cargo, 5);

  return {
    warpedToChest,
    savedCount: countBackpackItems(inv),
  };
}

/**
 * Processes defeat penalty:
 * - All 15 cargo slots are lost (unless a warp_anchor in safeBelt saves a right neighbor first? Keep clear: cargo lost!).
 * - All 5 safeBelt slots are kept, EXCEPT items with modifier === 'fragile' which shatter!
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
      inv.cargo[i] = null;
    }
  }

  for (let i = 0; i < inv.safeBelt.length; i++) {
    const s = inv.safeBelt[i];
    if (s && getItemDef(s.itemId).modifier === 'fragile') {
      itemsLost += s.qty;
      shatteredItems.push(getItemDef(s.itemId).name);
      inv.safeBelt[i] = null;
    }
  }

  return {
    itemsLost,
    itemsSaved: countBackpackItems(inv),
    shatteredItems,
  };
}

export function getAllAvailableShopItems(inv: InventoryData): Array<{
  container: ContainerId;
  index: number;
  stack: ItemStack;
}> {
  const result: Array<{ container: ContainerId; index: number; stack: ItemStack }> = [];
  const containers: ContainerId[] = ['safeBelt', 'cargo', 'chest'];
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
