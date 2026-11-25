export type SceneId = 'shop' | 'backroom' | 'hub' | 'hangar' | 'dungeon';

export type SectorId = 1 | 2 | 3 | 4 | 5;

export type SuitThemeId = 'classic' | 'crystal' | 'solar' | 'elder' | 'omega';

export type TimeOfDay = 'day' | 'night';

export type WeaponId = 'blade' | 'blaster' | 'hammer' | 'spear' | 'fists' | 'discus';

export type CompanionId = 'puck' | 'spark' | 'luma' | 'halo';

export type MarketEventId = 'normal' | 'trade_fair' | 'collector_visit' | 'night_rush';

export type MusicTrack =
  | 'shop_day'
  | 'shop_night'
  | 'hub'
  | 'dungeon'
  | 'dungeon_s2'
  | 'dungeon_s3'
  | 'dungeon_s4'
  | 'boss';

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
  sector?: 1 | 2 | 3 | 4;
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
  blade: number; // 0..7
  blaster: number; // 0..7
  hammer: number; // 0..7
  spear: number; // 0..7
  fists: number; // 0..7
  discus: number; // 0..7
  suit: number; // 0..7
  stimpack: number; // 0..3
  bioRegen: number; // 0..3 (Dr. Lyra Med-Bay)
  shopTier: number; // 0..2
  shopAura: number; // 0..2
  shopScanner: number; // 0..2
  shopAssistant: number; // 0..2
  modCrit: number; // 0..3
  modThruster: number; // 0..3
  modLuck: number; // 0..3
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
  sector?: SectorId;
  floorReached: number;
  sector1Cleared?: boolean;
  sector2Cleared?: boolean;
  sector3Cleared?: boolean;
  sector4Cleared?: boolean;
  omegaCleared?: boolean;
  roomsCleared: number;
  enemiesDefeated: number;
  itemsSaved: number;
  itemsLost: number;
  warpedToChest: string[];
  shatteredItems: string[];
  clonedItems?: string[];
  cursedLost?: string[];
  synthesizedItems?: string[];
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
  sector2Cleared?: boolean;
  sector3Cleared?: boolean;
  sector4Cleared?: boolean;
  omegaCleared?: boolean;
  ngPlusLevel?: number;
  deepestFloor?: number;
  deepestFloorS2?: number;
  deepestFloorS3?: number;
  deepestFloorS4?: number;
  totalEnemiesDefeated?: number;
  breacherDefeated?: boolean;
  coreWatcherDefeated?: boolean;
  unlockedCompanions?: Record<CompanionId, boolean>;
  equippedCompanion?: CompanionId | null;
  suitTheme?: SuitThemeId;
  unlockedAchievements?: string[];
  marketEvent?: MarketEventId;
  nyxStock?: BlackMarketOffer[];
  pinnedRecipes?: string[];
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
