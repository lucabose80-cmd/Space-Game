export type SceneId = 'shop' | 'backroom' | 'hub' | 'dungeon';

export type TimeOfDay = 'day' | 'night';

export type WeaponId = 'blade' | 'blaster' | 'hammer' | 'spear' | 'fists' | 'discus';

export type CompanionId = 'puck' | 'spark' | 'luma' | 'halo';

export type MarketEventId = 'normal' | 'trade_fair' | 'collector_visit' | 'night_rush';

export type MusicTrack = 'shop_day' | 'shop_night' | 'hub' | 'dungeon' | 'boss';

export interface BlackMarketOffer {
  id: string;
  itemId: string;
  price: number;
  stock: number;
}

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic';

export type CargoModifier =
  | 'none'
  | 'fragile'
  | 'warp_anchor'
  | 'smuggler'
  | 'mirror_clone'
  | 'row_curse'
  | 'volatile_boost';

export type PriceReaction = 'cheap' | 'fair' | 'expensive' | 'outrageous';

export type DemandLevel = 'high' | 'normal' | 'low';

export type Direction = 'down' | 'up' | 'left' | 'right';

export interface Vec2 {
  x: number;
  y: number;
}

export interface ItemDef {
  id: string;
  name: string;
  rarity: Rarity;
  baseValue: number;
  maxStack: number;
  modifier: CargoModifier;
  modifierLabel?: string;
  description: string;
  glowColor: string;
  dropWeight: number;
  minDepth: number;
}

export interface ItemStack {
  itemId: string;
  qty: number;
}

export interface PedestalSlot {
  id: number;
  x: number;
  y: number;
  itemId: string | null;
  qty: number;
  price: number;
}

export interface BountyContract {
  id: string;
  clientName: string;
  itemId: string;
  qty: number;
  rewardCredits: number;
  completed: boolean;
}

export interface CodexEntry {
  itemId: string;
  discovered: boolean;
  timesSold: number;
  demandScore: number;
  maxCheapPrice: number | null;
  minFairPrice: number | null;
  maxFairPrice: number | null;
  minExpensivePrice: number | null;
  minOutrageousPrice: number | null;
  lastSetPrice: number | null;
}

export interface UpgradeLevels {
  blade: number; // 0..4
  blaster: number; // 0..4
  hammer: number; // 0..4
  spear: number; // 0..4 (Ionen-Speer!)
  fists: number; // 0..4 (Kinetik-Fäuste!)
  discus: number; // 0..4 (Phasen-Diskus!)
  suit: number; // 0..4
  stimpack: number; // 0..3
  bioRegen: number; // 0..3 (Dr. Lyra Med-Bay)
  shopTier: number; // 0..2 (Astro-Barter expansion: 4 -> 6 -> 8 pedestals, Sale-Box & 28/36/48 chest!)
  shopAura: number; // 0..2 (Astro-Barter Shop-Terminal: decor & tips)
  shopScanner: number; // 0..2 (Astro-Barter Shop-Terminal: checkout bonus & patience)
  shopAssistant: number; // 0..2 (Handels-Droide hinter dem Tresen, ab Shop-Stufe II!)
  modCrit: number; // 0..3 (Vex' Tech-Labor: Ionen-Kette Crit Chance)
  modThruster: number; // 0..3 (Vex' Tech-Labor: Schub-Kondensator Speed & Dash CD)
  modLuck: number; // 0..3 (Vex' Tech-Labor: Relikt-Scanner Rare/Epic Drop Boost)
}

export type UpgradeKey = keyof UpgradeLevels;

export interface UpgradeTier {
  level: number;
  name: string;
  description: string;
  creditCost: number;
  materials: Array<{ itemId: string; qty: number }>;
  statLabel: string;
}

export interface UpgradeTrack {
  key: UpgradeKey;
  shop: 'forge' | 'medbay' | 'shop_terminal' | 'techlab';
  weaponId?: WeaponId;
  requiresShopTier?: number;
  title: string;
  subtitle: string;
  primaryDesc?: string;
  secondaryDesc?: string;
  iconUrl: string;
  craftCost?: {
    creditCost: number;
    materials: Array<{ itemId: string; qty: number }>;
    statLabel: string;
  };
  tiers: UpgradeTier[];
}

export interface InventoryData {
  cargo: Array<ItemStack | null>; // 20 expedition slots (lost on death — extraction only!)
  chest: Array<ItemStack | null>; // 28 / 36 / 48 shop storage slots (always safe!)
}

export interface RunSummary {
  victory: boolean;
  reason: 'warp' | 'boss_victory' | 'defeat';
  floorReached: number;
  sector1Cleared?: boolean;
  roomsCleared: number;
  enemiesDefeated: number;
  itemsSaved: number;
  itemsLost: number;
  warpedToChest: string[];
  shatteredItems: string[];
  clonedItems?: string[];
  cursedLost?: string[];
  resonanceBonus?: number;
  nightRun?: boolean;
}

export interface SaveData {
  version: number;
  day: number;
  timeOfDay?: TimeOfDay;
  credits: number;
  totalEarned: number;
  totalSold: number;
  bossDefeatedCount: number;
  sector1Cleared?: boolean;
  deepestFloor?: number;
  totalEnemiesDefeated?: number;
  breacherDefeated?: boolean;
  coreWatcherDefeated?: boolean;
  unlockedCompanions?: Record<CompanionId, boolean>;
  equippedCompanion?: CompanionId | null;
  marketEvent?: MarketEventId;
  nyxStock?: BlackMarketOffer[];
  inventory: InventoryData & { safeBelt?: Array<ItemStack | null> };
  pedestals: Array<{ id: number; itemId: string | null; qty: number; price: number }>;
  saleBox?: ItemStack[];
  bounties?: BountyContract[];
  codex: Record<string, CodexEntry>;
  upgrades: UpgradeLevels;
  unlockedWeapons: Record<WeaponId, boolean>;
  equippedWeapon: WeaponId;
  secondaryWeapon: WeaponId | null;
  muted: boolean;
  musicMuted?: boolean;
}
