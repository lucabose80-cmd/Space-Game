import { BOUNTY_REWARD_MULT, SELL_PRICE_MULT, scaledSellValue, WEAPON_TIER_GATES, WEAPON_TYPE_GATES } from '../data/balance';
import { COMPANION_ORDER, evaluateCompanionUnlock, SUIT_THEME_ORDER } from '../data/companions';
import {
  ALCHEMY_BUFFS,
  ALCHEMY_BUFF_ORDER,
  createInitialPatronProgress,
  getPatronTier,
  MAX_ACTIVE_BANK_INVESTMENTS,
  PATRON_DEFS,
  PATRON_ORDER,
  TRADE_ROUTES,
  TRADE_ROUTE_ORDER,
} from '../data/guildMarket';
import { sanitizeGreeting } from '../data/ghostGreetings';
import { getInfusionDef } from '../data/infusions';
import { getItemDef, ITEMS } from '../data/items';
import { computeStoryChapter, createEmptyStory, STORY_CHAPTERS } from '../data/story/storyChapters';
import type { StoryChoice, StoryScene } from '../data/story/storyTypes';
import { HUB_BUILDING_IDS, type HubBuildingId } from '../data/hubBuildings';
import { getPlayerCombatStats, UPGRADE_TRACKS } from '../data/upgrades';
import { firebaseService, formatDurationSec } from '../services/firebaseService';
import type {
  AlchemyBuffId,
  BankInvestment,
  BlackMarketOffer,
  BountyContract,
  CaptainRecords,
  CodexEntry,
  CompanionId,
  InfusionId,
  InventoryData,
  ItemStack,
  MarketEventId,
  PatronId,
  PatronProgress,
  PedestalSlot,
  SaveData,
  SectorId,
  StoryNpcId,
  StoryProgress,
  SuitThemeId,
  TimeOfDay,
  TradeRouteId,
  TrialBadge,
  UpgradeKey,
  UpgradeTrack,
  UpgradeLevels,
  WeaponId,
  WeeklyTrialInfo,
  WeeklyTrialRecord,
  WeeklyTrialResultSummary,
} from '../types';
import { createInitialCodex, decayDemandForNewDay, getOptimalCodexPrice } from './economy';
import {
  addItemAnywhere,
  addItemToChest,
  CARGO_SIZE,
  consumeItemTotal,
  countItemTotal,
  createEmptyInventory,
  ensureChestCapacity,
} from './inventory';
import {
  computeTrialScore,
  countBadges,
  formatWeekLabel,
  getTrialBadge,
  isBetterBadge,
  sanitizeBadgeHistory,
  sanitizeTrialRecord,
  TRIAL_COMBAT_LEVELS,
  trimBadgeHistory,
} from './weeklyTrial';
import { applyChoice, getPendingScene as storyPendingScene, hasTrustPerk as storyHasTrustPerk, isSceneSkipped, sanitizeStory } from './storyEngine';

const SAVE_KEY = 'starlighter_save_v2';
const LEGACY_SAVE_KEY = 'starlighter_save_v1';
const SAVE_VERSION = 11;

function createEmptyRecords(): CaptainRecords {
  return {
    bestSectorClearSec: {},
    fastestSector4Days: null,
    fastestOmegaDays: null,
    fastestNgPlusDays: null,
    deepestRiftFloor: 0,
    riftsCleared: 0,
    totalCyclesPlayed: 0,
    lastActivityText: 'Startet gerade in Astro-Barter',
    recentMilestones: [],
  };
}

function createEmptyWeaponInfusions(): Record<WeaponId, InfusionId> {
  return {
    blade: 'none',
    spear: 'none',
    fists: 'none',
    discus: 'none',
    blaster: 'none',
    hammer: 'none',
  };
}

function createEmptyUnlockedInfusions(): Record<WeaponId, InfusionId[]> {
  return {
    blade: [],
    spear: [],
    fists: [],
    discus: [],
    blaster: [],
    hammer: [],
  };
}

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

export interface PinnedRecipeMaterial {
  itemId: string;
  name: string;
  owned: number;
  required: number;
}

export interface PinnedRecipeDetail {
  key: string;
  title: string;
  subtitle: string;
  creditCost: number;
  materials: PinnedRecipeMaterial[];
  allMatsReady: boolean;
  canAffordNow: boolean;
}

export interface TimeAdvanceResult {
  day: number;
  timeOfDay: TimeOfDay;
  newDay: boolean;
  marketEvent: MarketEventId;
  maturedBankCount: number;
}

export class GameState {
  public day = 1;
  public timeOfDay: TimeOfDay = 'day';
  public captainName = 'Sternen-Kapitän';
  public credits = 120;
  public totalEarned = 0;
  public totalSold = 0;
  public bossDefeatedCount = 0;
  public sector1Cleared = false;
  public sector2Cleared = false;
  public sector3Cleared = false;
  public sector4Cleared = false;
  public omegaCleared = false;
  public ngPlusLevel = 0;
  public deepestFloor = 1;
  public deepestFloorS2 = 1;
  public deepestFloorS3 = 1;
  public deepestFloorS4 = 1;
  public suitTheme: SuitThemeId = 'classic';
  public unlockedAchievements: string[] = [];
  public records: CaptainRecords = createEmptyRecords();
  public totalEnemiesDefeated = 0;
  public breacherDefeated = false;
  public coreWatcherDefeated = false;
  public unlockedCompanions: Record<CompanionId, boolean> = {
    puck: false,
    spark: false,
    luma: false,
    halo: false,
  };
  public equippedCompanion: CompanionId | null = null;
  public marketEvent: MarketEventId = 'normal';
  public nyxStock: BlackMarketOffer[] = [];
  public pinnedRecipes: string[] = [];
  public inventory: InventoryData = createEmptyInventory();
  public pedestals: PedestalSlot[] = [];
  public saleBox: ItemStack[] = [];
  public bounties: BountyContract[] = [];
  public codex: Record<string, CodexEntry> = createInitialCodex();
  public upgrades: UpgradeLevels = {
    blade: 0,
    spear: 0,
    fists: 0,
    discus: 0,
    blaster: 0,
    hammer: 0,
    suit: 0,
    stimpack: 0,
    bioRegen: 0,
    shopTier: 0,
    quartersTier: 0,
    shopAura: 0,
    shopScanner: 0,
    shopAssistant: 0,
    modCrit: 0,
    modThruster: 0,
    modLuck: 0,
  };
  public unlockedWeapons: Record<WeaponId, boolean> = {
    blade: true,
    spear: false,
    fists: false,
    discus: false,
    blaster: false,
    hammer: false,
  };
  public equippedWeapon: WeaponId = 'blade';
  public secondaryWeapon: WeaponId | null = null;
  public weaponInfusions: Record<WeaponId, InfusionId> = createEmptyWeaponInfusions();
  public unlockedInfusions: Record<WeaponId, InfusionId[]> = createEmptyUnlockedInfusions();
  // Milestone 8: Händler-Gilde, Verhandeln & Port-Solaris-Marktplatz
  public patronProgress: Record<PatronId, PatronProgress> = createInitialPatronProgress();
  public activeAlchemyBuff: AlchemyBuffId | null = null;
  public bankInvestments: BankInvestment[] = [];
  public lastPedestalItems: Record<number, string> = {};
  public haggleWinsTotal = 0;
  // Milestone 9: Galaktisches Netzwerk (Save v10)
  // Milestone 10-A: Story (Save v11)
  public story: StoryProgress = createEmptyStory();
  /** Gesehene Intro-, Feier-, Gehilfin- & Story-Cutscenes (optional, Save-v11-kompatibel) */
  public seenCutscenes: string[] = [];
  /** Geöffnete Hub-Gebäude (P4). Neues Spiel: leer → Gebäude im Aufbau. */
  public hubUnlocks: HubBuildingId[] = [];
  /** Nur Laufzeit: gerade geöffnete Gebäude, die der Hub mit Enthüllungs-Effekt zeigt. */
  public pendingHubReveals: HubBuildingId[] = [];
  /** M10-C: gelernte Codex-/Podest-Preise wurden einmalig auf den neuen Preisfaktor skaliert (Altspielstände) */
  public priceScaleV2 = true;
  public ghostGreeting = '';
  public weeklyTrial: WeeklyTrialRecord | null = null;
  public trialBadgeHistory: Record<string, TrialBadge> = {};
  /** Nur Laufzeit (nicht gespeichert): aktive Galaktische Prüfung → normierte Werte. */
  public activeTrial: WeeklyTrialInfo | null = null;
  public muted = false;
  public musicMuted = false;

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
    this.captainName = firebaseService.currentUser?.displayName || 'Sternen-Kapitän';
    this.credits = 120;
    this.totalEarned = 0;
    this.totalSold = 0;
    this.bossDefeatedCount = 0;
    this.sector1Cleared = false;
    this.sector2Cleared = false;
    this.sector3Cleared = false;
    this.sector4Cleared = false;
    this.omegaCleared = false;
    this.ngPlusLevel = 0;
    this.deepestFloor = 1;
    this.deepestFloorS2 = 1;
    this.deepestFloorS3 = 1;
    this.deepestFloorS4 = 1;
    this.suitTheme = 'classic';
    this.unlockedAchievements = [];
    this.records = createEmptyRecords();
    this.totalEnemiesDefeated = 0;
    this.breacherDefeated = false;
    this.coreWatcherDefeated = false;
    // Companion Bots are NEVER unlocked at game start — earned via gameplay milestones!
    this.unlockedCompanions = {
      puck: false,
      spark: false,
      luma: false,
      halo: false,
    };
    this.equippedCompanion = null;
    this.marketEvent = 'normal';
    this.pinnedRecipes = [];
    this.inventory = createEmptyInventory();
    this.codex = createInitialCodex();
    this.saleBox = [];
    this.upgrades = {
      blade: 0,
      spear: 0,
      fists: 0,
      discus: 0,
      blaster: 0,
      hammer: 0,
      suit: 0,
      stimpack: 0,
      bioRegen: 0,
      shopTier: 0,
      quartersTier: 0,
      shopAura: 0,
      shopScanner: 0,
      shopAssistant: 0,
      modCrit: 0,
      modThruster: 0,
      modLuck: 0,
    };
    this.unlockedWeapons = {
      blade: true,
      spear: false,
      fists: false,
      discus: false,
      blaster: false,
      hammer: false,
    };
    this.equippedWeapon = 'blade';
    this.secondaryWeapon = null;
    this.weaponInfusions = createEmptyWeaponInfusions();
    this.unlockedInfusions = createEmptyUnlockedInfusions();
    this.patronProgress = createInitialPatronProgress();
    this.activeAlchemyBuff = null;
    this.bankInvestments = [];
    this.lastPedestalItems = {};
    this.haggleWinsTotal = 0;
    this.ghostGreeting = '';
    this.weeklyTrial = null;
    this.trialBadgeHistory = {};
    this.activeTrial = null;
    this.story = createEmptyStory();
    this.seenCutscenes = [];
    this.hubUnlocks = [];
    this.pendingHubReveals = [];
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
    this.nyxStock = this.generateNyxStock();
    this.restoreFullVitals();
  }

  public getStats() {
    // Galaktische Prüfung: normierte Kampf-Stufen, kein Alchemie-Buff (Shop-Upgrades bleiben unberührt)
    const trialActive = this.activeTrial !== null;
    const base = getPlayerCombatStats(trialActive ? { ...this.upgrades, ...TRIAL_COMBAT_LEVELS } : this.upgrades);
    const buff = trialActive ? null : this.activeAlchemyBuff;
    // Vertrauensbonus Lyra („Notfallset“): +1 Stimpack-Ladung — in der Galaktischen Prüfung aus
    const lyraStim = !trialActive && this.hasTrustPerk('lyra') ? 1 : 0;
    const dmgMult = buff === 'solar_espresso' ? 1.2 : 1.0;
    const maxHpMult = buff === 'aegis_tonic' ? 1.25 : 1.0;
    const extraStim = buff === 'aegis_tonic' ? 1 : 0;
    const extraLuck = buff === 'nebula_nectar' ? 0.35 : 0;
    const extraSpeedMult = buff === 'chrono_fizz' ? 1.18 : 1.0;
    const extraDashCdMult = buff === 'chrono_fizz' ? 0.8 : 1.0;
    const extraCrit = buff === 'void_elixir' ? 0.15 : 0;
    const extraEnergyMult = buff === 'void_elixir' ? 1.25 : 1.0;

    // Patron Tier 2 Shop Decoration Passives
    const vanceTipBonus = this.patronProgress?.vance?.decoUnlocked ? 0.05 : 0;
    const zoraPatienceBonus = this.patronProgress?.zora?.decoUnlocked ? 0.15 : 0;

    return {
      ...base,
      bladeDamage: Math.round(base.bladeDamage * dmgMult),
      spearDamage: Math.round(base.spearDamage * dmgMult),
      fistsDamage: Math.round(base.fistsDamage * dmgMult),
      discusDamage: Math.round(base.discusDamage * dmgMult),
      blasterDamage: Math.round(base.blasterDamage * dmgMult),
      hammerDamage: Math.round(base.hammerDamage * dmgMult),
      maxHp: Math.round(base.maxHp * maxHpMult),
      maxStimCharges: base.maxStimCharges + extraStim + lyraStim,
      lootLuckBonus: base.lootLuckBonus + extraLuck,
      moveSpeedMult: base.moveSpeedMult * extraSpeedMult,
      dashCooldownMult: base.dashCooldownMult * extraDashCdMult,
      critChance: Math.min(0.85, base.critChance + extraCrit),
      energyRegenMult: base.energyRegenMult * extraEnergyMult,
      shopTipBonus: base.shopTipBonus + vanceTipBonus,
      customerPatienceBonus: base.customerPatienceBonus + zoraPatienceBonus,
    };
  }

  public getCompanionProgressSnapshot() {
    return {
      totalSold: this.totalSold,
      shopTier: this.upgrades.shopTier ?? 0,
      totalEnemiesDefeated: this.totalEnemiesDefeated,
      bossDefeatedCount: this.bossDefeatedCount,
      breacherDefeated: this.breacherDefeated,
      coreWatcherDefeated: this.coreWatcherDefeated,
      deepestFloor: this.deepestFloor,
      sector1Cleared: this.sector1Cleared,
      sector2Cleared: this.sector2Cleared,
    };
  }

  /**
   * Evaluates all 4 Companion Bot unlock gates. Returns any newly unlocked IDs
   * so callers can display celebratory toasts & sound!
   */
  public checkCompanionUnlocks(persist = true): CompanionId[] {
    const snap = this.getCompanionProgressSnapshot();
    const newlyUnlocked: CompanionId[] = [];
    for (const id of COMPANION_ORDER) {
      if (this.unlockedCompanions[id]) continue;
      if (evaluateCompanionUnlock(id, snap).unlocked) {
        this.unlockedCompanions[id] = true;
        newlyUnlocked.push(id);
      }
    }
    if (persist && newlyUnlocked.length > 0) {
      this.save();
    }
    return newlyUnlocked;
  }

  public equipCompanion(id: CompanionId | null): boolean {
    if (id !== null && !this.unlockedCompanions[id]) return false;
    this.equippedCompanion = id;
    this.save();
    return true;
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

  public rollDailyMarketEvent(): MarketEventId {
    if (this.day <= 1) return 'normal';
    const r = Math.random();
    if (r < 0.28) return 'trade_fair';
    if (r < 0.56) return 'collector_visit';
    if (r < 0.72) return 'night_rush';
    return 'normal';
  }

  /**
   * M10-C Tag/Nacht-Schleife (Moonlighter umgedreht):
   * - Tag → Nacht: beim Zurückkommen aus einem Tag-Run (`startNight`)
   * - Nacht → nächster Tag: Laden schließen, Nacht-Run beenden oder Schicht überspringen (`startDay`)
   */
  public startNight(): TimeAdvanceResult {
    if (this.timeOfDay !== 'day') return this.noTimeChange();
    this.records.totalCyclesPlayed += 1;
    const maturedBankCount = this.tickBankInvestments();
    this.timeOfDay = 'night';
    this.restoreFullVitals();
    this.save();
    return {
      day: this.day,
      timeOfDay: this.timeOfDay,
      newDay: false,
      marketEvent: this.marketEvent,
      maturedBankCount,
    };
  }

  public startDay(): TimeAdvanceResult {
    if (this.timeOfDay !== 'night') return this.noTimeChange();
    this.records.totalCyclesPlayed += 1;
    const maturedBankCount = this.tickBankInvestments();
    this.timeOfDay = 'day';
    this.day += 1;
    decayDemandForNewDay(this.codex);
    this.bounties = this.generateBounties();
    this.nyxStock = this.generateNyxStock();
    this.marketEvent = this.rollDailyMarketEvent();
    this.restoreFullVitals();
    this.save();
    return {
      day: this.day,
      timeOfDay: this.timeOfDay,
      newDay: true,
      marketEvent: this.marketEvent,
      maturedBankCount,
    };
  }

  private noTimeChange(): TimeAdvanceResult {
    return {
      day: this.day,
      timeOfDay: this.timeOfDay,
      newDay: false,
      marketEvent: this.marketEvent,
      maturedBankCount: 0,
    };
  }

  /** Kompatibilität: schaltet je nach Zustand weiter (Tag → Nacht, Nacht → Tag). */
  public advanceTimeOfDay(): TimeAdvanceResult {
    return this.timeOfDay === 'day' ? this.startNight() : this.startDay();
  }

  public advanceDay(): void {
    this.advanceTimeOfDay();
  }

  // ==================== NYX' SCHWARZMARKT (TÄGLICH ROTIERENDE SELTENE TEILE) ====================
  public generateNyxStock(): BlackMarketOffer[] {
    const allowedSector = (i: (typeof ITEMS)[number]) => {
      const sec = i.sector ?? 1;
      if (sec === 1) return true;
      if (sec === 2) return this.sector1Cleared;
      if (sec === 3) return this.sector2Cleared;
      return this.sector3Cleared;
    };
    const commonPool = ITEMS.filter(
      (i) => allowedSector(i) && (i.rarity === 'common' || i.rarity === 'uncommon'),
    );
    const rarePool = ITEMS.filter(
      (i) =>
        allowedSector(i) &&
        i.rarity === 'rare' &&
        (i.id !== 'mk4_heart' || this.deepestFloor >= 2 || this.day >= 3),
    );
    const epicPool = ITEMS.filter(
      (i) =>
        allowedSector(i) &&
        i.rarity === 'epic' &&
        (i.id !== 'leviathan_core' || this.sector1Cleared || this.deepestFloor >= 3) &&
        (i.id !== 'archon_heart' || this.sector2Cleared || this.deepestFloorS2 >= 3) &&
        (i.id !== 'vulkan_heart' || this.sector3Cleared || this.deepestFloorS3 >= 3) &&
        (i.id !== 'archon_crown' || this.sector4Cleared || this.deepestFloorS4 >= 3),
    );

    const pickFrom = (arr: typeof ITEMS, exclude: Set<string>) => {
      const candidates = arr.filter((i) => !exclude.has(i.id));
      if (candidates.length === 0) return null;
      const chosen = candidates[Math.floor(Math.random() * candidates.length)];
      exclude.add(chosen.id);
      return chosen;
    };

    const used = new Set<string>();
    const chosen: Array<{ def: (typeof ITEMS)[number]; stock: number }> = [];

    const c1 = pickFrom(commonPool, used);
    if (c1) chosen.push({ def: c1, stock: 3 });
    const r1 = pickFrom(rarePool.length > 0 ? rarePool : commonPool, used);
    if (r1) chosen.push({ def: r1, stock: 2 });
    const r2 = pickFrom(rarePool.length > 0 ? rarePool : commonPool, used);
    if (r2) chosen.push({ def: r2, stock: 1 });
    // Vertrauensbonus Nyx („Hinterzimmer-Ware“): +1 zusätzliches seltenes Angebot
    if (this.hasTrustPerk('nyx')) {
      const r3 = pickFrom(rarePool.length > 0 ? rarePool : commonPool, used);
      if (r3) chosen.push({ def: r3, stock: 1 });
    }
    const e1 = pickFrom(epicPool.length > 0 ? epicPool : rarePool, used);
    if (e1) chosen.push({ def: e1, stock: 1 });

    return chosen.map(({ def, stock }, idx) => {
      // Smuggler markup: ~1.55x base value (worth it when you need a missing crafting part!)
      const markup = def.rarity === 'epic' ? 1.7 : def.rarity === 'rare' ? 1.55 : 1.4;
      const price = Math.max(40, Math.round((def.baseValue * markup) / 5) * 5);
      return {
        id: `nyx_d${this.day}_${idx}_${def.id}`,
        itemId: def.id,
        price,
        stock,
      };
    });
  }

  public getNyxOfferPrice(offer: BlackMarketOffer): number {
    if (this.patronProgress?.rix?.bigOrderCompleted) {
      return Math.max(20, Math.round((offer.price * 0.85) / 5) * 5);
    }
    return offer.price;
  }

  public buyFromNyx(offerId: string): { ok: boolean; reason?: string; itemName?: string } {
    const offer = this.nyxStock.find((o) => o.id === offerId);
    if (!offer || offer.stock <= 0) return { ok: false, reason: 'Ausverkauft!' };
    const finalPrice = this.getNyxOfferPrice(offer);
    if (this.credits < finalPrice) return { ok: false, reason: 'Nicht genug Credits!' };

    const rem = addItemAnywhere(this.inventory, offer.itemId, 1);
    if (rem > 0) return { ok: false, reason: 'Frachtraum & Truhe voll!' };

    this.credits -= finalPrice;
    offer.stock -= 1;
    this.markDiscovered(offer.itemId);
    this.save();
    return { ok: true, itemName: getItemDef(offer.itemId).name };
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
      const rawReward = item.baseValue * qty * 1.65 * BOUNTY_REWARD_MULT;
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
    this.checkCompanionUnlocks();
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
    const price = Math.max(5, Math.round(scaledSellValue(def.baseValue) * 0.7));

    stack.qty -= 1;
    if (stack.qty <= 0) {
      this.saleBox.splice(idx, 1);
    }

    this.credits += price;
    this.totalEarned += price;
    this.totalSold += 1;
    this.checkCompanionUnlocks();
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

  /** M10-C: Zweitwaffe entfernen (Slot ② leeren). */
  public clearSecondaryWeapon(): void {
    if (this.secondaryWeapon === null) return;
    this.secondaryWeapon = null;
    this.save();
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

  /** M12 (E): Sektor-Endboss je Sektor jemals besiegt? (alte Saves, NG+ und Rekorde zählen mit — keine neuen Save-Felder) */
  public hasClearedSector(sector: number): boolean {
    const flags = [false, this.sector1Cleared, this.sector2Cleared, this.sector3Cleared, this.sector4Cleared];
    return (
      Boolean(flags[sector]) ||
      this.ngPlusLevel >= 1 ||
      this.records.bestSectorClearSec[sector as SectorId] !== undefined
    );
  }

  /** M12 (E): Sperrtext „Bauplan: besiege …“, solange die Waffen-Art noch gesperrt ist — sonst null. */
  public getWeaponTypeLock(weaponId: WeaponId): string | null {
    const gate = WEAPON_TYPE_GATES[weaponId];
    if (!gate) return null;
    return gate.check((s) => this.hasClearedSector(s)) ? null : `Bauplan: besiege ${gate.boss}`;
  }

  /** M12 (E): Hub-Vitrine „A.E.G.I.S.-Herzlinse“ — nach dem Erstsieg dauerhaft. */
  public hasLeviathanTrophy(): boolean {
    return this.hasClearedSector(1);
  }

  public canCraftWeapon(weaponId: WeaponId): boolean {
    if (this.unlockedWeapons[weaponId]) return false;
    if (this.getWeaponTypeLock(weaponId)) return false;
    const track = UPGRADE_TRACKS.find((t) => t.weaponId === weaponId);
    if (!track?.craftCost) return false;
    if (this.credits < this.getForgeCreditCost(track.craftCost.creditCost, track.shop)) return false;
    for (const mat of track.craftCost.materials) {
      if (countItemTotal(this.inventory, mat.itemId) < mat.qty) return false;
    }
    return true;
  }

  public craftWeapon(weaponId: WeaponId): boolean {
    if (!this.canCraftWeapon(weaponId)) return false;
    const track = UPGRADE_TRACKS.find((t) => t.weaponId === weaponId);
    if (!track?.craftCost) return false;

    this.credits -= this.getForgeCreditCost(track.craftCost.creditCost, track.shop);
    for (const mat of track.craftCost.materials) {
      consumeItemTotal(this.inventory, mat.itemId, mat.qty);
    }
    this.unlockedWeapons[weaponId] = true;
    // Automatically place newly forged weapon in secondary slot if empty so player can test right away!
    if (!this.secondaryWeapon) {
      this.secondaryWeapon = weaponId;
    }
    this.prunePinnedRecipes();
    this.save();
    return true;
  }

  /** M10-C (E6c): Sperrtext, solange die Waffen-Stufe noch nicht freigespielt ist — sonst null. */
  public getWeaponTierLock(key: UpgradeKey): string | null {
    const track = UPGRADE_TRACKS.find((t) => t.key === key);
    if (!track?.weaponId) return null;
    const nextTier = track.tiers[this.upgrades[key]];
    if (!nextTier) return null;
    const gate = WEAPON_TIER_GATES[nextTier.level];
    if (!gate) return null;
    return gate.check({
      deepestFloor: this.deepestFloor,
      deepestFloorS2: this.deepestFloorS2,
      sector1Cleared: this.sector1Cleared,
      sector2Cleared: this.sector2Cleared,
      sector3Cleared: this.sector3Cleared,
    })
      ? null
      : gate.text;
  }

  public canAffordUpgrade(key: UpgradeKey): boolean {
    const track = UPGRADE_TRACKS.find((t) => t.key === key);
    if (!track) return false;
    if (track.weaponId && !this.unlockedWeapons[track.weaponId]) return false;
    if (this.getWeaponTierLock(key)) return false;
    if (track.requiresShopTier !== undefined && (this.upgrades.shopTier ?? 0) < track.requiresShopTier) {
      return false;
    }
    const currentLvl = this.upgrades[key];
    const nextTier = track.tiers[currentLvl];
    if (!nextTier) return false;
    if (this.credits < this.getForgeCreditCost(nextTier.creditCost, track.shop)) return false;
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

    this.credits -= this.getForgeCreditCost(nextTier.creditCost, track.shop);
    for (const mat of nextTier.materials) {
      consumeItemTotal(this.inventory, mat.itemId, mat.qty);
    }
    this.upgrades[key] += 1;
    if (key === 'shopTier') {
      this.syncShopCapacity();
    }
    this.checkCompanionUnlocks();
    this.prunePinnedRecipes();
    this.restoreFullVitals();
    this.save();
    return true;
  }

  public isRecipePinned(recipeKey: string): boolean {
    return this.pinnedRecipes.includes(recipeKey);
  }

  public togglePinRecipe(recipeKey: string): boolean {
    const idx = this.pinnedRecipes.indexOf(recipeKey);
    if (idx >= 0) {
      this.pinnedRecipes.splice(idx, 1);
      this.save();
      return false;
    }
    // Keep up to 4 active pinned recipes so the HUD stays clean on desktop & mobile
    if (this.pinnedRecipes.length >= 4) {
      this.pinnedRecipes.shift();
    }
    this.pinnedRecipes.push(recipeKey);
    this.prunePinnedRecipes();
    this.save();
    return this.pinnedRecipes.includes(recipeKey);
  }

  public prunePinnedRecipes(): void {
    this.pinnedRecipes = this.pinnedRecipes.filter((key) => {
      if (key.startsWith('craft:')) {
        const wep = key.slice('craft:'.length) as WeaponId;
        const track = UPGRADE_TRACKS.find((t) => t.weaponId === wep);
        return Boolean(track?.craftCost && !this.unlockedWeapons[wep]);
      }
      if (key.startsWith('upgrade:')) {
        const upg = key.slice('upgrade:'.length) as UpgradeKey;
        const track = UPGRADE_TRACKS.find((t) => t.key === upg);
        if (!track) return false;
        const lvl = this.upgrades[upg] ?? 0;
        return Boolean(track.tiers[lvl]);
      }
      return false;
    });
  }

  public getPinnedRecipeDetails(): PinnedRecipeDetail[] {
    const list: PinnedRecipeDetail[] = [];
    for (const key of this.pinnedRecipes) {
      if (key.startsWith('craft:')) {
        const wep = key.slice('craft:'.length) as WeaponId;
        const track = UPGRADE_TRACKS.find((t) => t.weaponId === wep);
        if (!track?.craftCost || this.unlockedWeapons[wep]) continue;
        const mats: PinnedRecipeMaterial[] = track.craftCost.materials.map((m) => ({
          itemId: m.itemId,
          name: getItemDef(m.itemId).name,
          owned: countItemTotal(this.inventory, m.itemId),
          required: m.qty,
        }));
        const allMatsReady = mats.every((m) => m.owned >= m.required);
        list.push({
          key,
          title: `${track.title} (Schmieden)`,
          subtitle: track.craftCost.statLabel,
          creditCost: track.craftCost.creditCost,
          materials: mats,
          allMatsReady,
          canAffordNow: allMatsReady && this.credits >= track.craftCost.creditCost,
        });
      } else if (key.startsWith('upgrade:')) {
        const upg = key.slice('upgrade:'.length) as UpgradeKey;
        const track = UPGRADE_TRACKS.find((t) => t.key === upg);
        if (!track) continue;
        const nextTier = track.tiers[this.upgrades[upg] ?? 0];
        if (!nextTier) continue;
        const mats: PinnedRecipeMaterial[] = nextTier.materials.map((m) => ({
          itemId: m.itemId,
          name: getItemDef(m.itemId).name,
          owned: countItemTotal(this.inventory, m.itemId),
          required: m.qty,
        }));
        const allMatsReady = mats.every((m) => m.owned >= m.required);
        list.push({
          key,
          title: nextTier.name,
          subtitle: nextTier.statLabel,
          creditCost: nextTier.creditCost,
          materials: mats,
          allMatsReady,
          canAffordNow: allMatsReady && this.credits >= nextTier.creditCost,
        });
      }
    }
    return list;
  }

  public getPinnedItemNeed(itemId: string): {
    required: number;
    owned: number;
    stillNeeded: number;
    recipeTitles: string[];
  } | null {
    const details = this.getPinnedRecipeDetails();
    let required = 0;
    const recipeTitles: string[] = [];
    for (const d of details) {
      for (const m of d.materials) {
        if (m.itemId === itemId) {
          required += m.required;
          if (!recipeTitles.includes(d.title)) recipeTitles.push(d.title);
        }
      }
    }
    if (required <= 0) return null;
    const owned = countItemTotal(this.inventory, itemId);
    return {
      required,
      owned,
      stillNeeded: Math.max(0, required - owned),
      recipeTitles,
    };
  }

  // ==================== ANZUG-STILE, KAPITÄNS-LOGBUCH, NEW GAME+ & SAVEGAME EXPORT/IMPORT ====================
  public isSuitThemeUnlocked(id: SuitThemeId): boolean {
    if (id === 'classic') return true;
    if (id === 'crystal') return this.sector2Cleared || this.omegaCleared;
    if (id === 'solar') return this.sector3Cleared || this.omegaCleared;
    if (id === 'elder') return this.sector4Cleared || this.omegaCleared;
    return this.omegaCleared;
  }

  public setSuitTheme(id: SuitThemeId): boolean {
    if (!SUIT_THEME_ORDER.includes(id) || !this.isSuitThemeUnlocked(id)) return false;
    this.suitTheme = id;
    this.save();
    return true;
  }

  public checkAchievements(persist = true): string[] {
    const unlockedSet = new Set(this.unlockedAchievements);
    const newly: string[] = [];
    const grant = (id: string, cond: boolean) => {
      if (cond && !unlockedSet.has(id)) {
        unlockedSet.add(id);
        this.unlockedAchievements.push(id);
        newly.push(id);
      }
    };

    const allComp = Object.values(this.unlockedCompanions).every(Boolean);
    const allWeps = Object.values(this.unlockedWeapons).every(Boolean);
    const anyInfusion = Object.values(this.unlockedInfusions).some((arr) => arr.length > 0);
    const anyTier3Patron = PATRON_ORDER.some((pid) => (this.patronProgress[pid]?.tier ?? 0) >= 3);

    grant('first_sale', this.totalSold >= 1);
    grant('master_merchant', (this.upgrades.shopTier ?? 0) >= 2 && this.totalSold >= 30);
    grant('sector1_clear', this.sector1Cleared);
    grant('sector2_clear', this.sector2Cleared);
    grant('sector3_clear', this.sector3Cleared);
    grant('sector4_clear', this.sector4Cleared);
    grant('omega_clear', this.omegaCleared);
    grant('all_companions', allComp);
    grant('arsenal_6', allWeps);
    grant('ng_plus', this.ngPlusLevel >= 1);
    grant('infusion_master', anyInfusion);
    grant('spiral_walker', (this.records.deepestRiftFloor ?? 0) >= 6);
    grant('master_haggler', this.haggleWinsTotal >= 10);
    grant('guild_patron', anyTier3Patron);
    grant('trial_runner', Boolean(this.weeklyTrial?.completed) || Object.keys(this.trialBadgeHistory).length > 0);
    grant('trial_gold', Object.values(this.trialBadgeHistory).includes('gold'));
    // Milestone 10-A: Story-Erfolge
    grant(
      'chronicler',
      this.story.chapter >= 5 && ['kael', 'lyra', 'nyx', 'vex'].every((n) => this.story.seenScenes.includes(`${n}_c5`)),
    );
    grant('heart_of_solaris', (['kael', 'lyra', 'nyx', 'vex'] as StoryNpcId[]).every((n) => this.hasTrustPerk(n)));

    if (persist && newly.length > 0) {
      this.save();
    }
    return newly;
  }

  // ==================== MEILENSTEIN 8: STAMMKUNDEN, ALCHEMIE-BAR, HANDELSBANK & QUICK-REFILL ====================
  public recordPatronVisit(patronId: PatronId): void {
    const p = this.patronProgress[patronId];
    if (!p) return;
    p.visits += 1;
  }

  public recordPatronSale(
    patronId: PatronId,
    itemId: string,
    haggled: boolean,
  ): { xpGained: number; prevTier: number; newTier: number; unlockedDeco: boolean; unlockedBigOrder: boolean } {
    const p = this.patronProgress[patronId];
    const def = PATRON_DEFS[patronId];
    const itemDef = getItemDef(itemId);
    const isFav = def.isFavoriteItem(itemDef);
    const xpGained = (isFav ? 25 : 15) + (haggled ? 10 : 0);

    const prevTier = p.tier;
    p.xp = Math.min(300, p.xp + xpGained);
    const newTier = getPatronTier(p.xp);
    p.tier = newTier;

    let unlockedDeco = false;
    if (newTier >= 2 && !p.decoUnlocked) {
      p.decoUnlocked = true;
      unlockedDeco = true;
    }
    const unlockedBigOrder = prevTier < 3 && newTier >= 3;
    if (unlockedBigOrder) {
      this.logMilestone(
        `Erreichte Rufstufe 3 (Ehrengast) bei ${def.name}!`,
        def.shortTag,
        def.accentColor,
      );
    }
    this.checkAchievements(false);
    this.save();
    return { xpGained, prevTier, newTier, unlockedDeco, unlockedBigOrder };
  }

  public getPatronSaleBonusMult(itemId: string): number {
    const def = getItemDef(itemId);
    const sec = def.sector ?? 1;
    let mult = 1.0;
    if (this.patronProgress?.vance?.bigOrderCompleted && (sec === 1 || sec === 3)) {
      mult += 0.05;
    }
    if (this.patronProgress?.zora?.bigOrderCompleted && (sec === 2 || sec === 4)) {
      mult += 0.05;
    }
    return mult;
  }

  public canCompleteBigOrder(patronId: PatronId): boolean {
    const p = this.patronProgress[patronId];
    if (!p || p.tier < 3 || p.bigOrderCompleted) return false;
    const order = PATRON_DEFS[patronId].bigOrder;
    return order.items.every((req) => countItemTotal(this.inventory, req.itemId) >= req.qty);
  }

  public hasReadyBigOrder(): boolean {
    return PATRON_ORDER.some((pid) => this.canCompleteBigOrder(pid));
  }

  public completeBigOrder(patronId: PatronId): { ok: boolean; rewardCredits?: number; patronName?: string } {
    if (!this.canCompleteBigOrder(patronId)) return { ok: false };
    const def = PATRON_DEFS[patronId];
    const order = def.bigOrder;
    for (const req of order.items) {
      if (!consumeItemTotal(this.inventory, req.itemId, req.qty)) return { ok: false };
    }
    const p = this.patronProgress[patronId];
    p.bigOrderCompleted = true;
    p.xp = Math.min(300, p.xp + order.rewardXp);
    p.tier = getPatronTier(p.xp);

    this.credits += order.rewardCredits;
    this.totalEarned += order.rewardCredits;
    this.totalSold += order.items.reduce((sum, r) => sum + r.qty, 0);
    this.logMilestone(
      `Lieferte Großauftrag „${order.title}“ für ${def.name}!`,
      'GROSSAUFTRAG',
      def.accentColor,
    );
    this.checkCompanionUnlocks(false);
    this.checkAchievements(false);
    this.save();
    return { ok: true, rewardCredits: order.rewardCredits, patronName: def.name };
  }

  // ---- Milo's Alchemie-Bar (Run-Buffs) ----
  public canBrewAlchemyBuff(buffId: AlchemyBuffId): boolean {
    if (this.activeAlchemyBuff === buffId) return false;
    const def = ALCHEMY_BUFFS[buffId];
    if (!def) return false;
    if (this.credits < def.creditCost) return false;
    return def.materials.every((m) => countItemTotal(this.inventory, m.itemId) >= m.qty);
  }

  public brewAlchemyBuff(buffId: AlchemyBuffId): { ok: boolean; reason?: string; buffName?: string } {
    const def = ALCHEMY_BUFFS[buffId];
    if (!def) return { ok: false, reason: 'Unbekanntes Elixier.' };
    if (this.activeAlchemyBuff === buffId) return { ok: false, reason: 'Dieses Elixier wirkt bereits!' };
    if (this.credits < def.creditCost) return { ok: false, reason: 'Nicht genug Credits!' };
    if (!def.materials.every((m) => countItemTotal(this.inventory, m.itemId) >= m.qty)) {
      return { ok: false, reason: 'Fehlende Sektor-Zutaten!' };
    }

    this.credits -= def.creditCost;
    for (const m of def.materials) {
      consumeItemTotal(this.inventory, m.itemId, m.qty);
    }
    this.activeAlchemyBuff = buffId;
    this.restoreFullVitals();
    this.save();
    return { ok: true, buffName: def.name };
  }

  public consumeAlchemyBuff(): AlchemyBuffId | null {
    const prev = this.activeAlchemyBuff;
    if (!prev) return null;
    this.activeAlchemyBuff = null;
    return prev;
  }

  // ---- Solaris-Handelsbank (Handelsrouten-Investments) ----
  public isTradeRouteUnlocked(routeId: TradeRouteId): boolean {
    if (routeId === 'solaris_shuttle') return true;
    if (routeId === 'crystal_convoy') return this.sector1Cleared || (this.upgrades.shopTier ?? 0) >= 1;
    if (routeId === 'foundry_freight') return this.sector2Cleared;
    return this.sector3Cleared;
  }

  public canInvestTradeRoute(routeId: TradeRouteId): boolean {
    if (!this.isTradeRouteUnlocked(routeId)) return false;
    if (this.bankInvestments.length >= MAX_ACTIVE_BANK_INVESTMENTS) return false;
    const def = TRADE_ROUTES[routeId];
    if (!def) return false;
    return this.credits >= def.principal;
  }

  public startBankInvestment(routeId: TradeRouteId): { ok: boolean; reason?: string } {
    if (!this.isTradeRouteUnlocked(routeId)) return { ok: false, reason: 'Handelsroute noch gesperrt!' };
    if (this.bankInvestments.length >= MAX_ACTIVE_BANK_INVESTMENTS) {
      return { ok: false, reason: `Maximal ${MAX_ACTIVE_BANK_INVESTMENTS} aktive Routen gleichzeitig!` };
    }
    const def = TRADE_ROUTES[routeId];
    if (!def) return { ok: false, reason: 'Unbekannte Route.' };
    if (this.credits < def.principal) return { ok: false, reason: 'Nicht genug Credits!' };

    this.credits -= def.principal;
    this.bankInvestments.push({
      id: `inv_${Date.now()}_${Math.floor(Math.random() * 9999)}`,
      routeId,
      principal: def.principal,
      cyclesTotal: def.cycles,
      cyclesRemaining: def.cycles,
      minReturnMult: def.minReturnMult,
      maxReturnMult: def.maxReturnMult,
      maturedPayout: null,
    });
    this.save();
    return { ok: true };
  }

  public tickBankInvestments(): number {
    let newlyMatured = 0;
    const talaBonus = this.patronProgress?.tala?.bigOrderCompleted ? 0.05 : 0;
    for (const inv of this.bankInvestments) {
      if (inv.maturedPayout !== null) continue;
      inv.cyclesRemaining = Math.max(0, inv.cyclesRemaining - 1);
      if (inv.cyclesRemaining === 0) {
        const roll = Math.random();
        const mult = inv.minReturnMult + roll * (inv.maxReturnMult - inv.minReturnMult) + talaBonus;
        const payout = Math.round((inv.principal * mult) / 5) * 5;
        const pct = Math.round(((payout - inv.principal) / Math.max(1, inv.principal)) * 100);
        inv.maturedPayout = payout;
        inv.outcomeLabel =
          roll > 0.72
            ? `Boom-Konjunktur (+${pct} %)`
            : roll > 0.35
              ? `Günstiger Sonnenwind (+${pct} %)`
              : `Stabile Passage (+${pct} %)`;
        newlyMatured += 1;
      }
    }
    return newlyMatured;
  }

  public hasReadyBankPayout(): boolean {
    return this.bankInvestments.some((inv) => inv.maturedPayout !== null);
  }

  public claimBankInvestment(invId: string): { ok: boolean; payout?: number; profit?: number; routeName?: string } {
    const idx = this.bankInvestments.findIndex((i) => i.id === invId);
    if (idx === -1) return { ok: false };
    const inv = this.bankInvestments[idx];
    if (inv.maturedPayout === null) return { ok: false };

    const payout = inv.maturedPayout;
    const profit = Math.max(0, payout - inv.principal);
    const routeName = TRADE_ROUTES[inv.routeId]?.name ?? 'Handelsroute';
    this.bankInvestments.splice(idx, 1);

    this.credits += payout;
    this.totalEarned += profit;
    this.save();
    return { ok: true, payout, profit, routeName };
  }

  // ---- [F] Schnell-Nachfüllen am Holo-Podest ----
  public canQuickRefillPedestal(pedestalId: number): { can: boolean; itemId: string | null; price: number } {
    const ped = this.pedestals.find((p) => p.id === pedestalId);
    if (!ped) return { can: false, itemId: null, price: 0 };

    if (ped.itemId && ped.qty > 0) {
      const def = getItemDef(ped.itemId);
      if (ped.qty >= Math.min(5, def.maxStack)) return { can: false, itemId: ped.itemId, price: ped.price };
      const owned = countItemTotal(this.inventory, ped.itemId);
      return { can: owned >= 1, itemId: ped.itemId, price: ped.price };
    }

    const remembered = this.lastPedestalItems[pedestalId];
    if (!remembered) return { can: false, itemId: null, price: 0 };
    const owned = countItemTotal(this.inventory, remembered);
    const price = getOptimalCodexPrice(remembered, this.codex[remembered]);
    return { can: owned >= 1, itemId: remembered, price };
  }

  public quickRefillPedestal(
    pedestalId: number,
  ): { ok: boolean; itemName?: string; price?: number; qty?: number } {
    const check = this.canQuickRefillPedestal(pedestalId);
    if (!check.can || !check.itemId) return { ok: false };
    const ped = this.pedestals.find((p) => p.id === pedestalId);
    if (!ped) return { ok: false };

    if (!consumeItemTotal(this.inventory, check.itemId, 1)) return { ok: false };

    if (ped.itemId === check.itemId && ped.qty > 0) {
      ped.qty += 1;
    } else {
      ped.itemId = check.itemId;
      ped.qty = 1;
      ped.price = check.price;
      const entry = this.codex[check.itemId];
      if (entry) entry.lastSetPrice = check.price;
    }
    this.lastPedestalItems[pedestalId] = check.itemId;
    this.save();
    return { ok: true, itemName: getItemDef(check.itemId).name, price: ped.price, qty: ped.qty };
  }

  // ==================== ELEMENTAR-PRÄGUNGEN (MEILENSTEIN 7) ====================
  public getActiveInfusion(weaponId: WeaponId = this.equippedWeapon): InfusionId {
    if (this.activeTrial) return 'none'; // Prüfung: keine Prägungen (faire Ausgangslage)
    return this.weaponInfusions[weaponId] ?? 'none';
  }

  public isInfusionUnlocked(weaponId: WeaponId, infusionId: Exclude<InfusionId, 'none'>): boolean {
    return (this.unlockedInfusions[weaponId] ?? []).includes(infusionId);
  }

  public canUnlockInfusion(weaponId: WeaponId, infusionId: Exclude<InfusionId, 'none'>): boolean {
    if (!this.unlockedWeapons[weaponId]) return false;
    if (this.isInfusionUnlocked(weaponId, infusionId)) return true;
    const def = getInfusionDef(infusionId);
    if (!def) return false;
    if (this.credits < def.creditCost) return false;
    return def.materials.every((m) => countItemTotal(this.inventory, m.itemId) >= m.qty);
  }

  public unlockAndEquipInfusion(
    weaponId: WeaponId,
    infusionId: Exclude<InfusionId, 'none'>,
  ): { ok: boolean; error?: string } {
    if (!this.unlockedWeapons[weaponId]) {
      return { ok: false, error: 'Waffe muss zuerst geschmiedet werden!' };
    }
    const def = getInfusionDef(infusionId);
    if (!def) return { ok: false, error: 'Unbekannte Prägung.' };

    if (!this.isInfusionUnlocked(weaponId, infusionId)) {
      if (!this.canUnlockInfusion(weaponId, infusionId)) {
        return { ok: false, error: 'Nicht genug Credits oder Rift-Materialien!' };
      }
      this.credits -= def.creditCost;
      for (const m of def.materials) {
        consumeItemTotal(this.inventory, m.itemId, m.qty);
      }
      if (!this.unlockedInfusions[weaponId]) {
        this.unlockedInfusions[weaponId] = [];
      }
      this.unlockedInfusions[weaponId].push(infusionId);
      this.logMilestone(
        `Prägte eine Waffe mit ${def.icon} ${def.name}!`,
        def.shortName,
        def.color,
      );
    }

    this.weaponInfusions[weaponId] = infusionId;
    this.checkAchievements(false);
    this.save();
    return { ok: true };
  }

  public equipInfusion(weaponId: WeaponId, infusionId: InfusionId): boolean {
    if (!this.unlockedWeapons[weaponId]) return false;
    if (infusionId !== 'none' && !this.isInfusionUnlocked(weaponId, infusionId)) return false;
    this.weaponInfusions[weaponId] = infusionId;
    this.save();
    return true;
  }

  public recordRiftDepth(depthReached: number): boolean {
    const clean = Math.max(0, Math.floor(depthReached));
    const prev = this.records.deepestRiftFloor ?? 0;
    const isNewRecord = clean > prev;
    if (isNewRecord) {
      this.records.deepestRiftFloor = clean;
      this.logMilestone(
        `Erreichte Ebene ${clean} in der ∞ Unendlichen Spirale!`,
        `RIFT E${clean}`,
        '#c084fc',
      );
    }
    this.checkAchievements(false);
    return isNewRecord;
  }

  public recordRiftChamberCleared(): void {
    this.records.riftsCleared = (this.records.riftsCleared ?? 0) + 1;
  }

  public logMilestone(text: string, badge: string, accent: string): void {
    this.records.lastActivityText = text;
    this.records.recentMilestones.unshift({ text, badge, accent, ts: Date.now() });
    if (this.records.recentMilestones.length > 15) {
      this.records.recentMilestones.length = 15;
    }
    void firebaseService.publishActivity(this.captainName, text, badge, accent);
  }

  public recordSectorClear(sector: SectorId, elapsedSec: number): boolean {
    const cleanSec = Math.max(1, Math.round(elapsedSec));
    const prev = this.records.bestSectorClearSec[sector];
    const isNewRecord = prev === undefined || cleanSec < prev;
    if (isNewRecord) {
      this.records.bestSectorClearSec[sector] = cleanSec;
    }

    const sectorLabels: Record<SectorId, { boss: string; badge: string; accent: string }> = {
      1: { boss: 'A.E.G.I.S. LEVIATHAN', badge: 'S1 CLEAR', accent: '#fde047' },
      2: { boss: '★ PRISMA-ARCHON', badge: 'S2 CLEAR', accent: '#e879f9' },
      3: { boss: '★ VULKAN-TITAN', badge: 'S3 CLEAR', accent: '#fb923c' },
      4: { boss: '★ DER STERNEN-ARCHON', badge: 'S4 CLEAR', accent: '#38e8d4' },
      5: { boss: '★ OMEGA STERNEN-ARCHON', badge: '5. TOR FINALE', accent: '#fde047' },
    };
    const meta = sectorLabels[sector];
    const timeStr = formatDurationSec(cleanSec);
    const ngSuffix = this.ngPlusLevel > 0 ? ` (NG+${this.ngPlusLevel})` : '';

    if (sector === 4) {
      if (this.records.fastestSector4Days === null || this.day < this.records.fastestSector4Days) {
        this.records.fastestSector4Days = this.day;
      }
    }
    if (sector === 5) {
      if (this.records.fastestOmegaDays === null || this.day < this.records.fastestOmegaDays) {
        this.records.fastestOmegaDays = this.day;
      }
      if (
        this.ngPlusLevel > 0 &&
        (this.records.fastestNgPlusDays === null || this.day < this.records.fastestNgPlusDays)
      ) {
        this.records.fastestNgPlusDays = this.day;
      }
    }

    this.logMilestone(
      `Besiegte ${meta.boss} in ${timeStr} an Tag ${this.day}${ngSuffix}!`,
      meta.badge,
      meta.accent,
    );
    return isNewRecord;
  }

  // ==================== MEILENSTEIN 10-A: STORY, VERTRAUEN & BONI ====================
  /** Hebt das Story-Kapitel an (sinkt nie). Gibt das neue Kapitel zurück, wenn es gestiegen ist. */
  public refreshStoryChapter(persist = true): number | null {
    const earned = computeStoryChapter(this);
    if (earned <= this.story.chapter) return null;
    this.story.chapter = earned;
    this.checkAchievements(false);
    if (persist) this.save();
    return earned;
  }

  public getStoryChapterTitle(): string {
    return STORY_CHAPTERS[Math.max(0, Math.min(STORY_CHAPTERS.length - 1, this.story.chapter))].title;
  }

  public isSceneSkipped(sceneId: string): boolean {
    return isSceneSkipped(this.story, sceneId);
  }

  /** Wendet eine Antwort sofort an (nicht erst am Szenenende), damit nichts verloren geht. */
  public recordStoryChoice(sceneId: string, choice: StoryChoice): { newPerks: StoryNpcId[] } {
    const res = applyChoice(this.story, sceneId, choice);
    // Nyx' neuer Bonus soll sofort im Sortiment sichtbar sein
    if (res.newPerks.includes('nyx')) this.nyxStock = this.generateNyxStock();
    this.checkAchievements(false);
    this.save();
    return { newPerks: res.newPerks };
  }

  public markSceneSeen(sceneId: string): void {
    if (!this.story.seenScenes.includes(sceneId)) this.story.seenScenes.push(sceneId);
    this.story.skippedScenes = this.story.skippedScenes.filter((x) => x !== sceneId);
    this.checkAchievements(false);
    this.save();
  }

  public markSceneSkipped(sceneId: string): void {
    if (!this.story.skippedScenes.includes(sceneId) && !this.story.seenScenes.includes(sceneId)) {
      this.story.skippedScenes.push(sceneId);
      this.save();
    }
  }

  public hasTrustPerk(npc: StoryNpcId): boolean {
    return storyHasTrustPerk(this.story, npc);
  }

  /** Älteste ungelesene Szene dieses NPCs (oder null). */
  public getPendingScene(npc: StoryNpcId): StoryScene | null {
    return storyPendingScene(this.story, npc);
  }

  /** Setzt ein Story-Flag direkt (z. B. `festival_seen` nach dem Omega-Fest). */
  public setStoryFlag(flag: StoryProgress['flags'][number]): void {
    if (!this.story.flags.includes(flag)) {
      this.story.flags.push(flag);
      this.save();
    }
  }

  /** Kael-Vertrauensbonus „Meisterhand“: −5 % Credits auf Schmiede-Upgrades & Waffen-Fertigung. */
  public getForgeCreditCost(base: number, shop: UpgradeTrack['shop']): number {
    if (shop === 'forge' && this.hasTrustPerk('kael')) return Math.round(base * 0.95);
    return base;
  }

  // ==================== MEILENSTEIN 9: WÖCHENTLICHE GALAKTISCHE PRÜFUNG ====================
  /** Freigeschaltet ab Sektor 1 (bleibt nach NG+-Reset durch ngPlusLevel/omegaCleared erhalten). */
  public isWeeklyTrialUnlocked(): boolean {
    return this.sector1Cleared || this.omegaCleared || this.ngPlusLevel >= 1;
  }

  public recordWeeklyTrialResult(input: {
    weekId: string;
    sector: 1 | 2 | 3 | 4;
    completed: boolean;
    timeSec: number;
    floorReached: number;
    roomsCleared: number;
  }): WeeklyTrialResultSummary {
    let rec = this.weeklyTrial;
    if (!rec || rec.weekId !== input.weekId) {
      rec = {
        weekId: input.weekId,
        sector: input.sector,
        attempts: 0,
        completed: false,
        bestTimeSec: null,
        bestFloorReached: 0,
        bestRoomsCleared: 0,
        bestScore: 2_000_000,
        badge: null,
        uploaded: true,
      };
    }
    rec.attempts += 1;
    const score = computeTrialScore(input);
    const isNewBest = score < rec.bestScore;
    if (isNewBest) {
      rec.sector = input.sector;
      rec.completed = input.completed;
      rec.bestTimeSec = input.completed ? Math.max(1, Math.round(input.timeSec)) : null;
      rec.bestFloorReached = Math.max(0, Math.min(3, input.floorReached));
      rec.bestRoomsCleared = Math.max(0, input.roomsCleared);
      rec.bestScore = score;
      rec.badge = getTrialBadge(input.sector, input.completed, input.timeSec);
      rec.uploaded = false;
      if (rec.badge && isBetterBadge(rec.badge, this.trialBadgeHistory[input.weekId] ?? null)) {
        this.trialBadgeHistory[input.weekId] = rec.badge;
        this.trialBadgeHistory = trimBadgeHistory(this.trialBadgeHistory);
      }
      const label = formatWeekLabel(input.weekId);
      this.logMilestone(
        input.completed
          ? `Bestand die Galaktische Prüfung ${label} in ${formatDurationSec(input.timeSec)}${rec.badge ? ` (${rec.badge === 'gold' ? 'Gold' : rec.badge === 'silver' ? 'Silber' : 'Bronze'})` : ''}!`
          : `Wagte die Galaktische Prüfung ${label} (Ebene ${rec.bestFloorReached}/3).`,
        'PRÜFUNG',
        '#fde047',
      );
    }
    this.weeklyTrial = rec;
    this.checkAchievements(false);
    this.save();
    return { isNewBest, badge: rec.badge, record: { ...rec } };
  }

  public getTrialBadgeCounts(): { gold: number; silver: number; bronze: number } {
    return countBadges(this.trialBadgeHistory);
  }

  public startNewGamePlus(): void {
    this.ngPlusLevel += 1;
    this.day = 1;
    this.timeOfDay = 'day';
    // Keep all upgrades, forged weapons, companions, codex, credits, suit themes, achievements, records & chest items!
    this.sector1Cleared = false;
    this.sector2Cleared = false;
    this.sector3Cleared = false;
    this.sector4Cleared = false;
    this.deepestFloor = 1;
    this.deepestFloorS2 = 1;
    this.deepestFloorS3 = 1;
    this.deepestFloorS4 = 1;
    this.bounties = this.generateBounties();
    this.nyxStock = this.generateNyxStock();
    this.refreshStoryChapter(false);
    this.checkAchievements(false);
    this.logMilestone(`Startete New Game+ ${this.ngPlusLevel}!`, `NG+${this.ngPlusLevel}`, '#c084fc');
    this.restoreFullVitals();
    this.save();
  }

  private buildSavePayload(): SaveData {
    return {
      version: SAVE_VERSION,
      day: this.day,
      timeOfDay: this.timeOfDay,
      captainName: this.captainName,
      credits: this.credits,
      totalEarned: this.totalEarned,
      totalSold: this.totalSold,
      bossDefeatedCount: this.bossDefeatedCount,
      sector1Cleared: this.sector1Cleared,
      sector2Cleared: this.sector2Cleared,
      sector3Cleared: this.sector3Cleared,
      sector4Cleared: this.sector4Cleared,
      omegaCleared: this.omegaCleared,
      ngPlusLevel: this.ngPlusLevel,
      deepestFloor: this.deepestFloor,
      deepestFloorS2: this.deepestFloorS2,
      deepestFloorS3: this.deepestFloorS3,
      deepestFloorS4: this.deepestFloorS4,
      suitTheme: this.suitTheme,
      unlockedAchievements: this.unlockedAchievements,
      records: this.records,
      totalEnemiesDefeated: this.totalEnemiesDefeated,
      breacherDefeated: this.breacherDefeated,
      coreWatcherDefeated: this.coreWatcherDefeated,
      unlockedCompanions: this.unlockedCompanions,
      equippedCompanion: this.equippedCompanion,
      marketEvent: this.marketEvent,
      nyxStock: this.nyxStock,
      pinnedRecipes: this.pinnedRecipes,
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
      weaponInfusions: this.weaponInfusions,
      unlockedInfusions: this.unlockedInfusions,
      patronProgress: this.patronProgress,
      activeAlchemyBuff: this.activeAlchemyBuff,
      bankInvestments: this.bankInvestments,
      lastPedestalItems: this.lastPedestalItems,
      haggleWinsTotal: this.haggleWinsTotal,
      story: this.story,
      seenCutscenes: [...this.seenCutscenes],
      hubUnlocks: [...this.hubUnlocks],
      priceScaleV2: this.priceScaleV2,
      ghostGreeting: this.ghostGreeting,
      weeklyTrial: this.weeklyTrial ?? undefined,
      trialBadgeHistory: this.trialBadgeHistory,
      muted: this.muted,
      musicMuted: this.musicMuted,
    };
  }

  public exportSaveJson(): string {
    return JSON.stringify(this.buildSavePayload(), null, 2);
  }

  public importSaveJson(raw: string): { ok: boolean; error?: string } {
    try {
      const parsed = JSON.parse(raw) as Partial<SaveData>;
      if (!parsed || typeof parsed !== 'object' || typeof parsed.credits !== 'number') {
        return { ok: false, error: 'Ungültiges STARLIGHTER-Savegame-Format!' };
      }
      localStorage.setItem(SAVE_KEY, JSON.stringify(parsed));
      const loaded = this.load();
      if (!loaded) return { ok: false, error: 'Spielstand konnte nicht geladen werden.' };
      this.save();
      return { ok: true };
    } catch {
      return { ok: false, error: 'JSON-Syntaxfehler — bitte vollständigen Export-Code einfügen.' };
    }
  }

  public hasSave(): boolean {
    try {
      return localStorage.getItem(SAVE_KEY) !== null || localStorage.getItem(LEGACY_SAVE_KEY) !== null;
    } catch {
      return false;
    }
  }

  /** Dev-Werkzeug (Boss-Labor): verhindert jedes Speichern/Synchronisieren des Spielstands. */
  public saveLocked = false;

  public save(): void {
    if (this.saveLocked) return;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.buildSavePayload()));
      firebaseService.scheduleAutoSync(this);
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
      this.captainName =
        typeof parsed.captainName === 'string' && parsed.captainName.trim().length > 0
          ? parsed.captainName.trim().slice(0, 22)
          : firebaseService.currentUser?.displayName || 'Sternen-Kapitän';
      this.credits = parsed.credits ?? 120;
      this.totalEarned = parsed.totalEarned ?? 0;
      this.totalSold = parsed.totalSold ?? 0;
      this.bossDefeatedCount = parsed.bossDefeatedCount ?? 0;
      this.sector1Cleared = Boolean(parsed.sector1Cleared);
      this.sector2Cleared = Boolean(parsed.sector2Cleared);
      this.sector3Cleared = Boolean(parsed.sector3Cleared);
      this.sector4Cleared = Boolean(parsed.sector4Cleared);
      this.omegaCleared = Boolean(parsed.omegaCleared);
      this.ngPlusLevel = Math.max(0, Math.floor(parsed.ngPlusLevel ?? 0));
      this.deepestFloor = Math.max(1, Math.min(3, parsed.deepestFloor ?? 1));
      this.deepestFloorS2 = Math.max(1, Math.min(3, parsed.deepestFloorS2 ?? 1));
      this.deepestFloorS3 = Math.max(1, Math.min(3, parsed.deepestFloorS3 ?? 1));
      this.deepestFloorS4 = Math.max(1, Math.min(3, parsed.deepestFloorS4 ?? 1));
      this.suitTheme =
        parsed.suitTheme && SUIT_THEME_ORDER.includes(parsed.suitTheme) ? parsed.suitTheme : 'classic';
      this.unlockedAchievements = Array.isArray(parsed.unlockedAchievements)
        ? parsed.unlockedAchievements.filter((a): a is string => typeof a === 'string')
        : [];
      const baseRec = createEmptyRecords();
      if (parsed.records && typeof parsed.records === 'object') {
        this.records = {
          bestSectorClearSec: { ...(parsed.records.bestSectorClearSec ?? {}) },
          fastestSector4Days: parsed.records.fastestSector4Days ?? null,
          fastestOmegaDays: parsed.records.fastestOmegaDays ?? null,
          fastestNgPlusDays: parsed.records.fastestNgPlusDays ?? null,
          deepestRiftFloor: Math.max(0, Math.floor(parsed.records.deepestRiftFloor ?? 0)),
          riftsCleared: Math.max(0, Math.floor(parsed.records.riftsCleared ?? 0)),
          totalCyclesPlayed: Math.max(0, Math.floor(parsed.records.totalCyclesPlayed ?? 0)),
          lastActivityText: parsed.records.lastActivityText || baseRec.lastActivityText,
          recentMilestones: Array.isArray(parsed.records.recentMilestones)
            ? parsed.records.recentMilestones.slice(0, 15)
            : [],
        };
      } else {
        this.records = baseRec;
      }
      this.totalEnemiesDefeated = parsed.totalEnemiesDefeated ?? 0;
      this.breacherDefeated = Boolean(parsed.breacherDefeated || this.deepestFloor >= 2 || this.bossDefeatedCount >= 1);
      this.coreWatcherDefeated = Boolean(
        parsed.coreWatcherDefeated || this.deepestFloor >= 3 || this.sector1Cleared,
      );

      this.upgrades = {
        blade: parsed.upgrades?.blade ?? 0,
        spear: parsed.upgrades?.spear ?? 0,
        fists: parsed.upgrades?.fists ?? 0,
        discus: parsed.upgrades?.discus ?? 0,
        blaster: parsed.upgrades?.blaster ?? 0,
        hammer: parsed.upgrades?.hammer ?? 0,
        suit: parsed.upgrades?.suit ?? 0,
        stimpack: parsed.upgrades?.stimpack ?? 0,
        bioRegen: parsed.upgrades?.bioRegen ?? 0,
        shopTier: parsed.upgrades?.shopTier ?? 0,
        // Alt-Saves ohne Feld: wer schon Begleiter/Sektor 1 hat, behält Drohnen-Dock & Jukebox (Stufe 1)
        quartersTier:
          parsed.upgrades?.quartersTier ??
          (Object.values(parsed.unlockedCompanions ?? {}).some(Boolean) || parsed.sector1Cleared || (parsed.day ?? 1) > 3 ? 1 : 0),
        shopAura: parsed.upgrades?.shopAura ?? 0,
        shopScanner: parsed.upgrades?.shopScanner ?? 0,
        shopAssistant: parsed.upgrades?.shopAssistant ?? 0,
        modCrit: parsed.upgrades?.modCrit ?? 0,
        modThruster: parsed.upgrades?.modThruster ?? 0,
        modLuck: parsed.upgrades?.modLuck ?? 0,
      };

      this.unlockedCompanions = {
        puck: Boolean(parsed.unlockedCompanions?.puck),
        spark: Boolean(parsed.unlockedCompanions?.spark),
        luma: Boolean(parsed.unlockedCompanions?.luma),
        halo: Boolean(parsed.unlockedCompanions?.halo),
      };
      this.checkCompanionUnlocks(false);
      this.equippedCompanion =
        parsed.equippedCompanion && this.unlockedCompanions[parsed.equippedCompanion]
          ? parsed.equippedCompanion
          : null;

      const validEvents: MarketEventId[] = ['normal', 'trade_fair', 'collector_visit', 'night_rush'];
      this.marketEvent =
        parsed.marketEvent && validEvents.includes(parsed.marketEvent) ? parsed.marketEvent : 'normal';

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
        fists: parsed.unlockedWeapons?.fists ?? false,
        discus: parsed.unlockedWeapons?.discus ?? false,
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
      const baseInf = createEmptyWeaponInfusions();
      const baseUnlInf = createEmptyUnlockedInfusions();
      const validInfs: InfusionId[] = ['none', 'solar_burn', 'cryo_stasis', 'ion_chain', 'void_siphon'];
      for (const w of ['blade', 'spear', 'fists', 'discus', 'blaster', 'hammer'] as WeaponId[]) {
        const rawList = parsed.unlockedInfusions?.[w];
        if (Array.isArray(rawList)) {
          baseUnlInf[w] = rawList.filter((x): x is InfusionId => x !== 'none' && validInfs.includes(x));
        }
        const rawEq = parsed.weaponInfusions?.[w];
        if (rawEq && rawEq !== 'none' && validInfs.includes(rawEq) && baseUnlInf[w].includes(rawEq)) {
          baseInf[w] = rawEq;
        }
      }
      this.weaponInfusions = baseInf;
      this.unlockedInfusions = baseUnlInf;
      this.muted = Boolean(parsed.muted);
      this.musicMuted = Boolean(parsed.musicMuted);

      const baseCodex = createInitialCodex();
      for (const item of ITEMS) {
        if (parsed.codex?.[item.id]) {
          baseCodex[item.id] = { ...baseCodex[item.id], ...parsed.codex[item.id] };
        }
      }
      this.codex = baseCodex;
      // M10-C Altspielstände: bereits gelernte Preise einmalig auf den neuen Preisfaktor skalieren
      this.priceScaleV2 = parsed.priceScaleV2 === true;
      const needsPriceScale = !this.priceScaleV2;
      if (needsPriceScale) {
        const sc = (v: number | null): number | null => (v === null || v === undefined ? v : Math.max(5, Math.round((v * SELL_PRICE_MULT) / 5) * 5));
        for (const id of Object.keys(this.codex)) {
          const c = this.codex[id];
          c.maxCheapPrice = sc(c.maxCheapPrice);
          c.minFairPrice = sc(c.minFairPrice);
          c.maxFairPrice = sc(c.maxFairPrice);
          c.minExpensivePrice = sc(c.minExpensivePrice);
          c.minOutrageousPrice = sc(c.minOutrageousPrice);
          c.lastSetPrice = sc(c.lastSetPrice);
        }
        this.priceScaleV2 = true;
      }

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
          price: needsPriceScale && saved?.price ? Math.max(5, Math.round((saved.price * SELL_PRICE_MULT) / 5) * 5) : saved?.price ?? 0,
        };
      });

      this.saleBox = Array.isArray(parsed.saleBox)
        ? parsed.saleBox.filter((s) => s && typeof s.itemId === 'string' && s.qty > 0).slice(0, SALE_BOX_MAX_SLOTS)
        : [];
      this.bounties =
        Array.isArray(parsed.bounties) && parsed.bounties.length > 0
          ? parsed.bounties
          : this.generateBounties();
      this.nyxStock =
        Array.isArray(parsed.nyxStock) && parsed.nyxStock.length > 0
          ? parsed.nyxStock
          : this.generateNyxStock();
      this.pinnedRecipes = Array.isArray(parsed.pinnedRecipes)
        ? parsed.pinnedRecipes.filter((k): k is string => typeof k === 'string').slice(0, 4)
        : [];

      // Milestone 8: Defensives Laden für nahtlose v8 -> v9 Migration
      const basePatrons = createInitialPatronProgress();
      if (parsed.patronProgress && typeof parsed.patronProgress === 'object') {
        for (const pid of PATRON_ORDER) {
          const rawP = parsed.patronProgress[pid];
          if (rawP && typeof rawP === 'object') {
            const xp = Math.max(0, Math.min(300, Math.floor(rawP.xp ?? 0)));
            const tier = getPatronTier(xp);
            basePatrons[pid] = {
              xp,
              tier,
              visits: Math.max(0, Math.floor(rawP.visits ?? 0)),
              bigOrderCompleted: Boolean(rawP.bigOrderCompleted),
              decoUnlocked: Boolean(rawP.decoUnlocked || tier >= 2),
            };
          }
        }
      }
      this.patronProgress = basePatrons;

      this.activeAlchemyBuff =
        parsed.activeAlchemyBuff && ALCHEMY_BUFF_ORDER.includes(parsed.activeAlchemyBuff)
          ? parsed.activeAlchemyBuff
          : null;

      this.bankInvestments = Array.isArray(parsed.bankInvestments)
        ? parsed.bankInvestments
            .filter(
              (inv): inv is BankInvestment =>
                Boolean(inv) &&
                typeof inv.id === 'string' &&
                TRADE_ROUTE_ORDER.includes(inv.routeId) &&
                typeof inv.principal === 'number',
            )
            .slice(0, MAX_ACTIVE_BANK_INVESTMENTS)
        : [];

      const loadedLast: Record<number, string> = {};
      if (parsed.lastPedestalItems && typeof parsed.lastPedestalItems === 'object') {
        for (const [k, v] of Object.entries(parsed.lastPedestalItems)) {
          const idx = Number(k);
          if (!Number.isNaN(idx) && typeof v === 'string') {
            loadedLast[idx] = v;
          }
        }
      }
      this.lastPedestalItems = loadedLast;
      this.haggleWinsTotal = Math.max(0, Math.floor(parsed.haggleWinsTotal ?? 0));

      // Milestone 9: Defensives Laden für nahtlose v9 -> v10 Migration
      this.ghostGreeting =
        typeof parsed.ghostGreeting === 'string' ? sanitizeGreeting(parsed.ghostGreeting) : '';
      this.weeklyTrial = sanitizeTrialRecord(parsed.weeklyTrial);
      this.trialBadgeHistory = sanitizeBadgeHistory(parsed.trialBadgeHistory);
      this.activeTrial = null;

      // Milestone 10-A: Defensives Laden für nahtlose v10 -> v11 Migration
      this.story = sanitizeStory(parsed.story);
      this.seenCutscenes = Array.isArray(parsed.seenCutscenes)
        ? parsed.seenCutscenes.filter((k): k is string => typeof k === 'string')
        : [];
      // Altspielstände mit bereits vorhandenem Fortschritt nicht nachträglich mit dem Intro überraschen
      if (!Array.isArray(parsed.seenCutscenes) && (this.day > 1 || this.totalSold > 0 || this.bossDefeatedCount > 0)) {
        this.seenCutscenes.push('intro_arrival');
      }
      // P4: Altspielstände (Feld fehlt) behalten alle Gebäude offen
      this.hubUnlocks = Array.isArray(parsed.hubUnlocks)
        ? parsed.hubUnlocks.filter((k): k is HubBuildingId => (HUB_BUILDING_IDS as string[]).includes(k))
        : [...HUB_BUILDING_IDS];
      this.pendingHubReveals = [];
      this.refreshStoryChapter(false);

      this.prunePinnedRecipes();
      this.checkAchievements(false);

      this.restoreFullVitals();
      return true;
    } catch {
      return false;
    }
  }

  /** Aussehens-Stufe (0..2) der Läden auf Port Solaris aus den Upgrade-Ständen. */
  public getHubTiers(): Record<'forge' | 'med' | 'tech' | 'shop', number> {
    const u = this.upgrades;
    const weaponMax = Math.max(u.blade, u.spear, u.fists, u.discus, u.blaster, u.hammer);
    const med = Math.max(u.bioRegen ?? 0, u.stimpack ?? 0);
    const mods = (u.modCrit ?? 0) + (u.modThruster ?? 0) + (u.modLuck ?? 0);
    return {
      forge: weaponMax >= 5 ? 2 : weaponMax >= 2 ? 1 : 0,
      med: med >= 3 ? 2 : med >= 2 ? 1 : 0,
      tech: mods >= 6 ? 2 : mods >= 3 ? 1 : 0,
      shop: Math.max(0, Math.min(2, u.shopTier ?? 0)),
    };
  }

  public isHubBuildingOpen(id: HubBuildingId): boolean {
    return this.hubUnlocks.includes(id);
  }

  /** Prüft die Öffnungs-Bedingungen der Hub-Gebäude; gibt die neu geöffneten zurück (für Toast & Enthüllung). */
  public checkHubUnlocks(): HubBuildingId[] {
    const cond: Record<HubBuildingId, boolean> = {
      techlab: this.totalEnemiesDefeated > 0 || this.deepestFloor > 1 || this.sector1Cleared || this.bossDefeatedCount > 0,
      blackmarket: this.totalSold >= 3 || this.sector1Cleared,
      terrace: this.sector1Cleared || this.bossDefeatedCount > 0,
    };
    const opened: HubBuildingId[] = [];
    for (const id of HUB_BUILDING_IDS) {
      if (cond[id] && !this.hubUnlocks.includes(id)) {
        this.hubUnlocks.push(id);
        this.pendingHubReveals.push(id);
        opened.push(id);
      }
    }
    if (opened.length > 0) this.save();
    return opened;
  }

  public hasSeenCutscene(id: string): boolean {
    return this.seenCutscenes.includes(id);
  }

  public markCutsceneSeen(id: string): void {
    if (!this.seenCutscenes.includes(id)) {
      this.seenCutscenes.push(id);
    }
  }

  /** Vex' Echo-Sonde Ping (ab Kapitel 3, nach dem Gießerei-Sektor) im Tech-Labor. */
  public isPingPresent(): boolean {
    return this.story.chapter >= 3 || this.story.seenScenes.includes('vex_c3');
  }

  /** Nyx' Void-Katze Mitternacht (ab Kapitel 4, seit der Obelisk leuchtet) am Schwarzmarkt. */
  public isMidnightPresent(): boolean {
    return this.story.chapter >= 4 || this.story.seenScenes.includes('nyx_c4');
  }

  /** Lyras Assistenz-Droide Pip arbeitet ab Kapitel 2 (nach dem Echo-Fieber) in der Med-Bay. */
  public isPipPresent(): boolean {
    return this.story.chapter >= 2 || this.story.seenScenes.includes('lyra_c2');
  }

  /** Kaels Schmiede-Gehilfin Mina steht dauerhaft an der 2. Werkbank nach Sektor 1 + Kaels Kapitel-1-Gespräch (oder ab Kapitel 2). */
  public isMinaPresent(): boolean {
    return (
      this.story.chapter >= 2 ||
      (this.sector1Cleared && this.story.seenScenes.includes('kael_c1')) ||
      this.seenCutscenes.includes('story_mina_arrives')
    );
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
