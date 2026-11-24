import { getItemDef, ITEMS } from '../data/items';
import { getPlayerCombatStats, UPGRADE_TRACKS } from '../data/upgrades';
import type {
  BountyContract,
  CodexEntry,
  InventoryData,
  ItemStack,
  PedestalSlot,
  SaveData,
  TimeOfDay,
  UpgradeKey,
  UpgradeLevels,
  WeaponId,
} from '../types';
import { createInitialCodex, decayDemandForNewDay } from './economy';
import {
  addItemAnywhere,
  addItemToChest,
  CARGO_SIZE,
  consumeItemTotal,
  countItemTotal,
  createEmptyInventory,
  ensureChestCapacity,
} from './inventory';

const SAVE_KEY = 'starlighter_save_v2';
const LEGACY_SAVE_KEY = 'starlighter_save_v1';
const SAVE_VERSION = 4;

export const SALE_BOX_MAX_SLOTS = 6;

export const SHOP_PEDESTAL_TIERS: Array<Array<{ id: number; x: number; y: number }>> = [
  // Tier 0: 4 Holo-Pedestals (Starter Shop)
  [
    { id: 0, x: 128, y: 152 },
    { id: 1, x: 128, y: 206 },
    { id: 2, x: 358, y: 148 },
    { id: 3, x: 358, y: 202 },
  ],
  // Tier 1: 6 Holo-Pedestals (Stufe II · Astro-Barter Galerie)
  [
    { id: 0, x: 108, y: 152 },
    { id: 1, x: 148, y: 152 },
    { id: 2, x: 128, y: 206 },
    { id: 3, x: 336, y: 148 },
    { id: 4, x: 376, y: 148 },
    { id: 5, x: 356, y: 202 },
  ],
  // Tier 2: 8 Holo-Pedestals (Stufe III · Solaris Flaggschiff-Basar)
  [
    { id: 0, x: 106, y: 152 },
    { id: 1, x: 146, y: 152 },
    { id: 2, x: 106, y: 206 },
    { id: 3, x: 146, y: 206 },
    { id: 4, x: 334, y: 148 },
    { id: 5, x: 374, y: 148 },
    { id: 6, x: 334, y: 202 },
    { id: 7, x: 374, y: 202 },
  ],
];

const BOUNTY_CLIENTS = [
  'Kapitän Orin',
  'Ingenieurin Vex',
  'Kartografin Nyx',
  'Sammler Korr',
  'Pilotin Mira',
  'Händler Sol',
  'Dr. Lyra',
  'Schmied Kael',
];

export class GameState {
  public day = 1;
  public timeOfDay: TimeOfDay = 'day';
  public credits = 120;
  public totalEarned = 0;
  public totalSold = 0;
  public bossDefeatedCount = 0;
  public sector1Cleared = false;
  public deepestFloor = 1;
  public inventory: InventoryData = createEmptyInventory();
  public pedestals: PedestalSlot[] = [];
  public saleBox: ItemStack[] = [];
  public bounties: BountyContract[] = [];
  public codex: Record<string, CodexEntry> = createInitialCodex();
  public upgrades: UpgradeLevels = {
    blade: 0,
    spear: 0,
    blaster: 0,
    hammer: 0,
    suit: 0,
    stimpack: 0,
    bioRegen: 0,
    shopTier: 0,
    shopAura: 0,
    shopScanner: 0,
    modCrit: 0,
    modThruster: 0,
    modLuck: 0,
  };
  public unlockedWeapons: Record<WeaponId, boolean> = {
    blade: true,
    spear: false,
    blaster: false,
    hammer: false,
  };
  public equippedWeapon: WeaponId = 'blade';
  public secondaryWeapon: WeaponId | null = null;
  public muted = false;

  // Live run stats
  public hp = 100;
  public energy = 100;
  public stimCharges = 2;

  constructor() {
    this.initFreshState();
  }

  public initFreshState(): void {
    this.day = 1;
    this.timeOfDay = 'day';
    this.credits = 120;
    this.totalEarned = 0;
    this.totalSold = 0;
    this.bossDefeatedCount = 0;
    this.sector1Cleared = false;
    this.deepestFloor = 1;
    this.inventory = createEmptyInventory();
    this.codex = createInitialCodex();
    this.saleBox = [];
    this.upgrades = {
      blade: 0,
      spear: 0,
      blaster: 0,
      hammer: 0,
      suit: 0,
      stimpack: 0,
      bioRegen: 0,
      shopTier: 0,
      shopAura: 0,
      shopScanner: 0,
      modCrit: 0,
      modThruster: 0,
      modLuck: 0,
    };
    this.unlockedWeapons = {
      blade: true,
      spear: false,
      blaster: false,
      hammer: false,
    };
    this.equippedWeapon = 'blade';
    this.secondaryWeapon = null;
    this.pedestals = [];
    this.syncShopCapacity();

    // Starter salvage stored safely in your Shop Chest so your Expedition Backpack starts clean!
    addItemToChest(this.inventory, 'scrap_coil', 2);
    addItemToChest(this.inventory, 'bio_gel', 2);
    addItemToChest(this.inventory, 'alien_prism', 1);
    this.markDiscovered('scrap_coil');
    this.markDiscovered('bio_gel');
    this.markDiscovered('alien_prism');

    this.bounties = this.generateBounties();
    this.restoreFullVitals();
  }

  public getStats() {
    return getPlayerCombatStats(this.upgrades);
  }

  /**
   * Synchronizes Holo-Pedestal layout (4 / 6 / 8) and Shop Chest capacity (28 / 36 / 48)
   * with the current shopTier while preserving all already stocked items!
   */
  public syncShopCapacity(): void {
    const stats = this.getStats();
    ensureChestCapacity(this.inventory, stats.chestCapacity);

    const tierIdx = Math.max(0, Math.min(SHOP_PEDESTAL_TIERS.length - 1, this.upgrades.shopTier ?? 0));
    const coords = SHOP_PEDESTAL_TIERS[tierIdx];
    const prev = this.pedestals;

    this.pedestals = coords.map((c, idx) => {
      const old = prev[idx];
      return {
        id: c.id,
        x: c.x,
        y: c.y,
        itemId: old?.itemId ?? null,
        qty: old?.qty ?? 0,
        price: old?.price ?? 0,
      };
    });
  }

  public restoreFullVitals(): void {
    const stats = this.getStats();
    this.hp = stats.maxHp;
    this.energy = 100;
    this.stimCharges = stats.maxStimCharges;
  }

  public markDiscovered(itemId: string): void {
    const entry = this.codex[itemId];
    if (entry) entry.discovered = true;
  }

  /**
   * Advances the real Moonlighter-style Day <-> Night rhythm:
   * - Day -> Night (same day, unlocks +35% Night Loot Bonus in Sector 1!)
   * - Night -> Next Day (day + 1, refreshes market demand & bulletin board bounties!)
   */
  public advanceTimeOfDay(): { day: number; timeOfDay: TimeOfDay; newDay: boolean } {
    if (this.timeOfDay === 'day') {
      this.timeOfDay = 'night';
      this.restoreFullVitals();
      this.save();
      return { day: this.day, timeOfDay: this.timeOfDay, newDay: false };
    }
    this.timeOfDay = 'day';
    this.day += 1;
    decayDemandForNewDay(this.codex);
    this.bounties = this.generateBounties();
    this.restoreFullVitals();
    this.save();
    return { day: this.day, timeOfDay: this.timeOfDay, newDay: true };
  }

  public advanceDay(): void {
    this.advanceTimeOfDay();
  }

  // ==================== BOUNTIES / SONDERAUFTRÄGE ====================
  public generateBounties(): BountyContract[] {
    const unlockedRare = this.day >= 2 || this.bossDefeatedCount > 0;
    const pool = ITEMS.filter((item) => {
      if (item.dropWeight <= 0) return false;
      if (item.rarity === 'epic') return this.day >= 3;
      if (item.rarity === 'rare') return unlockedRare;
      return true;
    });

    const chosen: typeof ITEMS = [];
    const available = [...pool];
    while (chosen.length < 3 && available.length > 0) {
      const idx = Math.floor(Math.random() * available.length);
      chosen.push(available.splice(idx, 1)[0]);
    }

    const clients = [...BOUNTY_CLIENTS].sort(() => Math.random() - 0.5);

    return chosen.map((item, idx) => {
      const qty =
        item.rarity === 'common'
          ? 2 + Math.floor(Math.random() * 2)
          : item.rarity === 'uncommon'
            ? 1 + Math.floor(Math.random() * 2)
            : 1;
      const rawReward = item.baseValue * qty * 1.65;
      const rewardCredits = Math.max(45, Math.round(rawReward / 5) * 5);
      return {
        id: `bounty_d${this.day}_${idx}_${item.id}`,
        clientName: clients[idx % clients.length],
        itemId: item.id,
        qty,
        rewardCredits,
        completed: false,
      };
    });
  }

  public canCompleteBounty(bountyId: string): boolean {
    const b = this.bounties.find((entry) => entry.id === bountyId);
    if (!b || b.completed) return false;
    return countItemTotal(this.inventory, b.itemId) >= b.qty;
  }

  public hasReadyBounty(): boolean {
    return this.bounties.some((b) => !b.completed && countItemTotal(this.inventory, b.itemId) >= b.qty);
  }

  public completeBounty(bountyId: string): BountyContract | null {
    const b = this.bounties.find((entry) => entry.id === bountyId);
    if (!b || b.completed) return null;
    if (!consumeItemTotal(this.inventory, b.itemId, b.qty)) return null;

    b.completed = true;
    this.credits += b.rewardCredits;
    this.totalEarned += b.rewardCredits;
    this.totalSold += b.qty;
    this.save();
    return b;
  }

  // ==================== SALE-BOX / SONDERANGEBOTS-KISTE ====================
  public countSaleBoxItems(): number {
    return this.saleBox.reduce((sum, s) => sum + s.qty, 0);
  }

  public addToSaleBox(itemId: string, qty = 1): boolean {
    if (qty <= 0) return false;
    const def = getItemDef(itemId);
    let rem = qty;

    // First check if enough space exists before consuming inventory
    let space = 0;
    for (const s of this.saleBox) {
      if (s.itemId === itemId) space += Math.max(0, def.maxStack - s.qty);
    }
    space += Math.max(0, SALE_BOX_MAX_SLOTS - this.saleBox.length) * def.maxStack;
    if (space < qty) return false;
    if (!consumeItemTotal(this.inventory, itemId, qty)) return false;

    for (const s of this.saleBox) {
      if (s.itemId === itemId && s.qty < def.maxStack && rem > 0) {
        const add = Math.min(rem, def.maxStack - s.qty);
        s.qty += add;
        rem -= add;
      }
    }
    while (rem > 0 && this.saleBox.length < SALE_BOX_MAX_SLOTS) {
      const add = Math.min(rem, def.maxStack);
      this.saleBox.push({ itemId, qty: add });
      rem -= add;
    }

    this.save();
    return true;
  }

  public takeFromSaleBox(index: number): boolean {
    const stack = this.saleBox[index];
    if (!stack || stack.qty <= 0) return false;
    const rem = addItemAnywhere(this.inventory, stack.itemId, stack.qty);
    if (rem === 0) {
      this.saleBox.splice(index, 1);
    } else {
      stack.qty = rem;
    }
    this.save();
    return true;
  }

  public popSaleBoxSale(): { itemId: string; itemName: string; price: number } | null {
    const idx = this.saleBox.findIndex((s) => s.qty > 0);
    if (idx === -1) return null;
    const stack = this.saleBox[idx];
    const def = getItemDef(stack.itemId);
    const price = Math.max(10, Math.round(def.baseValue * 0.7));

    stack.qty -= 1;
    if (stack.qty <= 0) {
      this.saleBox.splice(idx, 1);
    }

    this.credits += price;
    this.totalEarned += price;
    this.totalSold += 1;
    this.save();
    return { itemId: def.id, itemName: def.name, price };
  }

  public swapEquippedWeapons(): boolean {
    if (!this.secondaryWeapon) return false;
    const prev = this.equippedWeapon;
    this.equippedWeapon = this.secondaryWeapon;
    this.secondaryWeapon = prev;
    this.save();
    return true;
  }

  public equipWeapon(weaponId: WeaponId, slot: 'primary' | 'secondary' = 'primary'): void {
    if (!this.unlockedWeapons[weaponId]) return;
    if (slot === 'primary') {
      if (this.secondaryWeapon === weaponId) {
        this.secondaryWeapon = this.equippedWeapon;
      }
      this.equippedWeapon = weaponId;
    } else {
      if (this.equippedWeapon === weaponId) {
        if (this.secondaryWeapon) {
          this.equippedWeapon = this.secondaryWeapon;
          this.secondaryWeapon = weaponId;
        }
      } else {
        this.secondaryWeapon = weaponId;
      }
    }
    this.save();
  }

  public canCraftWeapon(weaponId: WeaponId): boolean {
    if (this.unlockedWeapons[weaponId]) return false;
    const track = UPGRADE_TRACKS.find((t) => t.weaponId === weaponId);
    if (!track?.craftCost) return false;
    if (this.credits < track.craftCost.creditCost) return false;
    for (const mat of track.craftCost.materials) {
      if (countItemTotal(this.inventory, mat.itemId) < mat.qty) return false;
    }
    return true;
  }

  public craftWeapon(weaponId: WeaponId): boolean {
    if (!this.canCraftWeapon(weaponId)) return false;
    const track = UPGRADE_TRACKS.find((t) => t.weaponId === weaponId);
    if (!track?.craftCost) return false;

    this.credits -= track.craftCost.creditCost;
    for (const mat of track.craftCost.materials) {
      consumeItemTotal(this.inventory, mat.itemId, mat.qty);
    }
    this.unlockedWeapons[weaponId] = true;
    // Automatically place newly forged weapon in secondary slot if empty so player can test right away!
    if (!this.secondaryWeapon) {
      this.secondaryWeapon = weaponId;
    }
    this.save();
    return true;
  }

  public canAffordUpgrade(key: UpgradeKey): boolean {
    const track = UPGRADE_TRACKS.find((t) => t.key === key);
    if (!track) return false;
    if (track.weaponId && !this.unlockedWeapons[track.weaponId]) return false;
    const currentLvl = this.upgrades[key];
    const nextTier = track.tiers[currentLvl];
    if (!nextTier) return false;
    if (this.credits < nextTier.creditCost) return false;
    for (const mat of nextTier.materials) {
      if (countItemTotal(this.inventory, mat.itemId) < mat.qty) return false;
    }
    return true;
  }

  public purchaseUpgrade(key: UpgradeKey): boolean {
    if (!this.canAffordUpgrade(key)) return false;
    const track = UPGRADE_TRACKS.find((t) => t.key === key);
    if (!track) return false;
    const nextTier = track.tiers[this.upgrades[key]];
    if (!nextTier) return false;

    this.credits -= nextTier.creditCost;
    for (const mat of nextTier.materials) {
      consumeItemTotal(this.inventory, mat.itemId, mat.qty);
    }
    this.upgrades[key] += 1;
    if (key === 'shopTier') {
      this.syncShopCapacity();
    }
    this.restoreFullVitals();
    this.save();
    return true;
  }

  public hasSave(): boolean {
    try {
      return localStorage.getItem(SAVE_KEY) !== null || localStorage.getItem(LEGACY_SAVE_KEY) !== null;
    } catch {
      return false;
    }
  }

  public save(): void {
    try {
      const payload: SaveData = {
        version: SAVE_VERSION,
        day: this.day,
        timeOfDay: this.timeOfDay,
        credits: this.credits,
        totalEarned: this.totalEarned,
        totalSold: this.totalSold,
        bossDefeatedCount: this.bossDefeatedCount,
        sector1Cleared: this.sector1Cleared,
        deepestFloor: this.deepestFloor,
        inventory: this.inventory,
        pedestals: this.pedestals.map((p) => ({
          id: p.id,
          itemId: p.itemId,
          qty: p.qty,
          price: p.price,
        })),
        saleBox: this.saleBox,
        bounties: this.bounties,
        codex: this.codex,
        upgrades: this.upgrades,
        unlockedWeapons: this.unlockedWeapons,
        equippedWeapon: this.equippedWeapon,
        secondaryWeapon: this.secondaryWeapon,
        muted: this.muted,
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage errors
    }
  }

  public load(): boolean {
    try {
      const raw = localStorage.getItem(SAVE_KEY) ?? localStorage.getItem(LEGACY_SAVE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as Partial<SaveData>;
      if (!parsed) return false;

      this.day = parsed.day ?? 1;
      this.timeOfDay = parsed.timeOfDay === 'night' ? 'night' : 'day';
      this.credits = parsed.credits ?? 120;
      this.totalEarned = parsed.totalEarned ?? 0;
      this.totalSold = parsed.totalSold ?? 0;
      this.bossDefeatedCount = parsed.bossDefeatedCount ?? 0;
      this.sector1Cleared = Boolean(parsed.sector1Cleared);
      this.deepestFloor = Math.max(1, Math.min(3, parsed.deepestFloor ?? 1));

      this.upgrades = {
        blade: parsed.upgrades?.blade ?? 0,
        spear: parsed.upgrades?.spear ?? 0,
        blaster: parsed.upgrades?.blaster ?? 0,
        hammer: parsed.upgrades?.hammer ?? 0,
        suit: parsed.upgrades?.suit ?? 0,
        stimpack: parsed.upgrades?.stimpack ?? 0,
        bioRegen: parsed.upgrades?.bioRegen ?? 0,
        shopTier: parsed.upgrades?.shopTier ?? 0,
        shopAura: parsed.upgrades?.shopAura ?? 0,
        shopScanner: parsed.upgrades?.shopScanner ?? 0,
        modCrit: parsed.upgrades?.modCrit ?? 0,
        modThruster: parsed.upgrades?.modThruster ?? 0,
        modLuck: parsed.upgrades?.modLuck ?? 0,
      };

      // Migrate v1/v2/v3 inventory cleanly up to current shopTier chest capacity (28 / 36 / 48)
      const chestCap = this.getStats().chestCapacity;
      const inv = createEmptyInventory(chestCap);
      const rawChest = parsed.inventory?.chest ?? [];
      for (let i = 0; i < Math.min(chestCap, rawChest.length); i++) {
        inv.chest[i] = rawChest[i] ?? null;
      }
      const rawBelt = parsed.inventory?.safeBelt ?? [];
      for (const s of rawBelt) {
        if (s) addItemToChest(inv, s.itemId, s.qty);
      }
      const rawCargo = parsed.inventory?.cargo ?? [];
      for (let i = 0; i < Math.min(CARGO_SIZE, rawCargo.length); i++) {
        inv.cargo[i] = rawCargo[i] ?? null;
      }
      this.inventory = inv;

      this.unlockedWeapons = {
        blade: true,
        spear: parsed.unlockedWeapons?.spear ?? false,
        blaster: parsed.unlockedWeapons?.blaster ?? false,
        hammer: parsed.unlockedWeapons?.hammer ?? false,
      };
      this.equippedWeapon =
        parsed.equippedWeapon && this.unlockedWeapons[parsed.equippedWeapon]
          ? parsed.equippedWeapon
          : 'blade';
      this.secondaryWeapon =
        parsed.secondaryWeapon &&
        this.unlockedWeapons[parsed.secondaryWeapon] &&
        parsed.secondaryWeapon !== this.equippedWeapon
          ? parsed.secondaryWeapon
          : null;
      this.muted = Boolean(parsed.muted);

      const baseCodex = createInitialCodex();
      for (const item of ITEMS) {
        if (parsed.codex?.[item.id]) {
          baseCodex[item.id] = { ...baseCodex[item.id], ...parsed.codex[item.id] };
        }
      }
      this.codex = baseCodex;

      const tierIdx = Math.max(0, Math.min(SHOP_PEDESTAL_TIERS.length - 1, this.upgrades.shopTier));
      const coords = SHOP_PEDESTAL_TIERS[tierIdx];
      this.pedestals = coords.map((c, i) => {
        const saved = parsed.pedestals?.[i];
        return {
          id: c.id,
          x: c.x,
          y: c.y,
          itemId: saved?.itemId ?? null,
          qty: saved?.qty ?? 0,
          price: saved?.price ?? 0,
        };
      });

      this.saleBox = Array.isArray(parsed.saleBox)
        ? parsed.saleBox.filter((s) => s && typeof s.itemId === 'string' && s.qty > 0).slice(0, SALE_BOX_MAX_SLOTS)
        : [];
      this.bounties =
        Array.isArray(parsed.bounties) && parsed.bounties.length > 0
          ? parsed.bounties
          : this.generateBounties();

      this.restoreFullVitals();
      return true;
    } catch {
      return false;
    }
  }

  public resetSave(): void {
    try {
      localStorage.removeItem(SAVE_KEY);
      localStorage.removeItem(LEGACY_SAVE_KEY);
    } catch {
      // ignore
    }
    this.initFreshState();
    this.save();
  }
}
