export type SceneId = 'shop' | 'hub' | 'dungeon';

export type WeaponId = 'blade' | 'blaster' | 'hammer';

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic';

export type CargoModifier = 'none' | 'fragile' | 'warp_anchor' | 'smuggler';

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
  blade: number; // 0..3
  blaster: number; // 0..3
  hammer: number; // 0..3
  suit: number; // 0..3
  stimpack: number; // 0..3
  shopAura: number; // 0..2
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
  shop: 'forge' | 'medbay';
  weaponId?: WeaponId;
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
  chest: Array<ItemStack | null>; // 28 shop storage slots (always safe!)
}

export interface RunSummary {
  victory: boolean;
  reason: 'warp' | 'boss_victory' | 'defeat';
  roomsCleared: number;
  enemiesDefeated: number;
  itemsSaved: number;
  itemsLost: number;
  warpedToChest: string[];
  shatteredItems: string[];
}

export interface SaveData {
  version: number;
  day: number;
  credits: number;
  totalEarned: number;
  totalSold: number;
  bossDefeatedCount: number;
  inventory: InventoryData & { safeBelt?: Array<ItemStack | null> };
  pedestals: Array<{ id: number; itemId: string | null; qty: number; price: number }>;
  codex: Record<string, CodexEntry>;
  upgrades: UpgradeLevels;
  unlockedWeapons: Record<WeaponId, boolean>;
  equippedWeapon: WeaponId;
  secondaryWeapon: WeaponId | null;
  muted: boolean;
}
