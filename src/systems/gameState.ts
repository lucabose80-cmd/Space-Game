import { ITEMS } from '../data/items';
import { getPlayerCombatStats, UPGRADE_TRACKS } from '../data/upgrades';
import type {
  CodexEntry,
  InventoryData,
  PedestalSlot,
  SaveData,
  UpgradeKey,
  UpgradeLevels,
} from '../types';
import { createInitialCodex, decayDemandForNewDay } from './economy';
import {
  addItemToBackpack,
  consumeItemTotal,
  countItemTotal,
  createEmptyInventory,
} from './inventory';

const SAVE_KEY = 'starlighter_save_v1';
const SAVE_VERSION = 1;

export const SHOP_PEDESTAL_COORDS: Array<{ id: number; x: number; y: number }> = [
  { id: 0, x: 144, y: 176 },
  { id: 1, x: 192, y: 176 },
  { id: 2, x: 288, y: 176 },
  { id: 3, x: 336, y: 176 },
];

export class GameState {
  public day = 1;
  public credits = 120;
  public totalEarned = 0;
  public totalSold = 0;
  public bossDefeatedCount = 0;
  public inventory: InventoryData = createEmptyInventory();
  public pedestals: PedestalSlot[] = [];
  public codex: Record<string, CodexEntry> = createInitialCodex();
  public upgrades: UpgradeLevels = {
    blade: 0,
    blaster: 0,
    suit: 0,
    stimpack: 0,
    shopAura: 0,
  };
  public muted = false;

  // Live run stats (refreshed on entering dungeon / healed in shop)
  public hp = 100;
  public energy = 100;
  public stimCharges = 2;

  constructor() {
    this.initFreshState();
  }

  public initFreshState(): void {
    this.day = 1;
    this.credits = 120;
    this.totalEarned = 0;
    this.totalSold = 0;
    this.bossDefeatedCount = 0;
    this.inventory = createEmptyInventory();
    this.codex = createInitialCodex();
    this.upgrades = {
      blade: 0,
      blaster: 0,
      suit: 0,
      stimpack: 0,
      shopAura: 0,
    };
    this.pedestals = SHOP_PEDESTAL_COORDS.map((c) => ({
      id: c.id,
      x: c.x,
      y: c.y,
      itemId: null,
      qty: 0,
      price: 0,
    }));

    // Starter salvage so player can immediately test the Shop OR dive straight into Sector 1!
    addItemToBackpack(this.inventory, 'scrap_coil', 2);
    addItemToBackpack(this.inventory, 'bio_gel', 2);
    addItemToBackpack(this.inventory, 'alien_prism', 1);
    this.markDiscovered('scrap_coil');
    this.markDiscovered('bio_gel');
    this.markDiscovered('alien_prism');

    this.restoreFullVitals();
  }

  public getStats() {
    return getPlayerCombatStats(this.upgrades);
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

  public advanceDay(): void {
    this.day += 1;
    decayDemandForNewDay(this.codex);
    this.save();
  }

  public canAffordUpgrade(key: UpgradeKey): boolean {
    const track = UPGRADE_TRACKS.find((t) => t.key === key);
    if (!track) return false;
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
    this.restoreFullVitals();
    this.save();
    return true;
  }

  public hasSave(): boolean {
    try {
      return localStorage.getItem(SAVE_KEY) !== null;
    } catch {
      return false;
    }
  }

  public save(): void {
    try {
      const payload: SaveData = {
        version: SAVE_VERSION,
        day: this.day,
        credits: this.credits,
        totalEarned: this.totalEarned,
        totalSold: this.totalSold,
        bossDefeatedCount: this.bossDefeatedCount,
        inventory: this.inventory,
        pedestals: this.pedestals.map((p) => ({
          id: p.id,
          itemId: p.itemId,
          qty: p.qty,
          price: p.price,
        })),
        codex: this.codex,
        upgrades: this.upgrades,
        muted: this.muted,
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage quota / privacy errors
    }
  }

  public load(): boolean {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as SaveData;
      if (!parsed || parsed.version !== SAVE_VERSION) return false;

      this.day = parsed.day ?? 1;
      this.credits = parsed.credits ?? 120;
      this.totalEarned = parsed.totalEarned ?? 0;
      this.totalSold = parsed.totalSold ?? 0;
      this.bossDefeatedCount = parsed.bossDefeatedCount ?? 0;
      this.inventory = parsed.inventory ?? createEmptyInventory();
      this.upgrades = {
        blade: parsed.upgrades?.blade ?? 0,
        blaster: parsed.upgrades?.blaster ?? 0,
        suit: parsed.upgrades?.suit ?? 0,
        stimpack: parsed.upgrades?.stimpack ?? 0,
        shopAura: parsed.upgrades?.shopAura ?? 0,
      };
      this.muted = Boolean(parsed.muted);

      const baseCodex = createInitialCodex();
      for (const item of ITEMS) {
        if (parsed.codex?.[item.id]) {
          baseCodex[item.id] = { ...baseCodex[item.id], ...parsed.codex[item.id] };
        }
      }
      this.codex = baseCodex;

      this.pedestals = SHOP_PEDESTAL_COORDS.map((c, i) => {
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

      this.restoreFullVitals();
      return true;
    } catch {
      return false;
    }
  }

  public resetSave(): void {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      // ignore
    }
    this.initFreshState();
    this.save();
  }
}
