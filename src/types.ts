export type SceneId = 'shop' | 'backroom' | 'hub' | 'hangar' | 'market_terrace' | 'dungeon';

export type SectorId = 1 | 2 | 3 | 4 | 5;

export type SuitThemeId = 'classic' | 'crystal' | 'solar' | 'elder' | 'omega';

export type TimeOfDay = 'day' | 'night';

export type WeaponId = 'blade' | 'blaster' | 'hammer' | 'spear' | 'fists' | 'discus';

export type InfusionId = 'none' | 'solar_burn' | 'cryo_stasis' | 'ion_chain' | 'void_siphon';

export type RiftMutatorId = 'overcharged' | 'armored' | 'vampiric' | 'hasted';

export type CompanionId = 'puck' | 'spark' | 'luma' | 'halo';

export type MarketEventId = 'normal' | 'trade_fair' | 'collector_visit' | 'night_rush';

export type PatronId = 'vance' | 'zora' | 'rix' | 'tala';

export type AlchemyBuffId =
  | 'solar_espresso'
  | 'aegis_tonic'
  | 'nebula_nectar'
  | 'chrono_fizz'
  | 'void_elixir';

export type TradeRouteId =
  | 'solaris_shuttle'
  | 'crystal_convoy'
  | 'foundry_freight'
  | 'elder_expedition';

// ==================== MEILENSTEIN 10-A: STORY, STEUERUNG ====================
export type StoryNpcId = 'kael' | 'lyra' | 'nyx' | 'vex';

/** Crew-Begleiter der Shop-Besitzer: im Dungeon gefangen, per Rettung befreit (Welt-Überarbeitung P7). */
export type CrewId = 'mina' | 'pip' | 'ping' | 'midnight';

export type StoryFlagId =
  | 'knows_juno'
  | 'kael_memorial'
  | 'kael_forward'
  | 'lyra_clinic'
  | 'lyra_told_truth'
  | 'vex_shared_signal'
  | 'vex_spiral'
  | 'vex_stays'
  | 'nyx_helion_known'
  | 'nyx_confronted'
  | 'nyx_covered'
  | 'nyx_redeemed'
  | 'festival_seen';

export type AimAssistMode = 'off' | 'standard' | 'smart';

export type TextSpeed = 'normal' | 'fast' | 'instant';

export interface StoryProgress {
  /** 0..6, sinkt nie (NG+ setzt die Sektor-Flags zurück, das Kapitel bleibt). */
  chapter: number;
  /** 0..10, Start 2. */
  trust: Record<StoryNpcId, number>;
  flags: StoryFlagId[];
  /** Abgeschlossene Szenen-IDs. */
  seenScenes: string[];
  /** Mit „Später“ übersprungene Szenen (nur für den ruhigen Marker). */
  skippedScenes: string[];
  /** Gewählte Antworten (max. 80, älteste werden gekappt). */
  choiceLog: Array<{ sceneId: string; choiceId: string; ts: number }>;
}

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
  sector?: 1 | 2 | 3 | 4 | 5;
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
  /** Kapitäns-Quartier-Ausbau: 0 = Notkoje (Drohnen-Dock & Jukebox gesperrt), 1 = Kajüte, 2 = Flaggschiff-Suite */
  quartersTier: number; // 0..2
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

export interface CaptainRecords {
  /** Fastest real-time clear in seconds for Sectors 1..4 & 5th Omega Gate */
  bestSectorClearSec: Partial<Record<SectorId, number>>;
  /** Fewest Day/Night cycles (day count) to beat Sector 4 */
  fastestSector4Days: number | null;
  /** Fewest Day/Night cycles (day count) to beat the 5th Omega Gate */
  fastestOmegaDays: number | null;
  /** Fewest Day/Night cycles to complete a New Game+ Omega clear */
  fastestNgPlusDays: number | null;
  /** Deepest floor cleared in the Endless Rift ("Die Unendliche Spirale") */
  deepestRiftFloor?: number;
  /** Total mid-sector Rift Anomaly chambers cleared */
  riftsCleared?: number;
  /** Total Day↔Night transitions played across this save */
  totalCyclesPlayed: number;
  /** Latest notable in-game milestone shown on the Guild Board */
  lastActivityText: string;
  /** Recent local/personal activity log entries */
  recentMilestones: Array<{ text: string; badge: string; accent: string; ts: number }>;
}

export interface LeaderboardEntry {
  uid: string;
  captainName: string;
  sectorsCleared: number;
  omegaCleared: boolean;
  ngPlusLevel: number;
  day: number;
  totalCyclesPlayed: number;
  fastestSector4Days: number | null;
  fastestOmegaDays: number | null;
  fastestNgPlusDays: number | null;
  deepestRiftFloor?: number;
  activeInfusion?: InfusionId;
  bestSectorClearSec: Partial<Record<SectorId, number>>;
  totalEarned: number;
  totalSold: number;
  bossDefeatedCount: number;
  achievementsCount: number;
  suitTheme: SuitThemeId;
  equippedWeapon: WeaponId;
  shopTier: number;
  lastActivityText: string;
  updatedAt: number;
  // Milestone 9: Galaktisches Netzwerk (alle optional — alte Einträge bleiben gültig)
  achievementIds?: string[];
  riftsCleared?: number;
  ghostGreeting?: string;
  trialBadges?: { gold: number; silver: number; bronze: number };
  bestTrialWeekId?: string;
  bestTrialTimeSec?: number;
}

export interface ActivityFeedEntry {
  id: string;
  uid: string;
  captainName: string;
  text: string;
  badge: string;
  accent: string;
  createdAt: number;
}

export interface PatronProgress {
  xp: number;
  tier: 0 | 1 | 2 | 3;
  visits: number;
  bigOrderCompleted: boolean;
  decoUnlocked: boolean;
}

export interface BigOrderContract {
  patronId: PatronId;
  title: string;
  items: Array<{ itemId: string; qty: number }>;
  rewardCredits: number;
  rewardXp: number;
  completed: boolean;
}

export interface BankInvestment {
  id: string;
  routeId: TradeRouteId;
  principal: number;
  cyclesTotal: number;
  cyclesRemaining: number;
  minReturnMult: number;
  maxReturnMult: number;
  maturedPayout: number | null;
  outcomeLabel?: string;
}

export interface ShiftSummary {
  day: number;
  timeOfDay: TimeOfDay;
  itemsSold: number;
  totalCredits: number;
  vipSales: number;
  haggleWins: number;
  haggleBonusCredits: number;
  thievesCaught: number;
  thievesEscaped: number;
  saleBoxCredits: number;
  patronVisits: PatronId[];
  topItemName: string | null;
  topItemPrice: number;
  newDay: boolean;
  nextDay: number;
  nextTimeOfDay: TimeOfDay;
  nextMarketEvent: MarketEventId;
  maturedBankCount: number;
}

export interface HagglePayload {
  customerId: number;
  customerTitle: string;
  patronId: PatronId | null;
  isVip: boolean;
  itemId: string;
  basePrice: number;
}

// ==================== MEILENSTEIN 9: WÖCHENTLICHE GALAKTISCHE PRÜFUNG ====================
export type TrialBadge = 'gold' | 'silver' | 'bronze';

export type TrialOutcome = 'victory' | 'defeat' | 'abort';

export interface WeeklyTrialInfo {
  weekId: string;
  sector: 1 | 2 | 3 | 4;
  mutator: RiftMutatorId;
  endsAtUtc: number;
}

export interface WeeklyTrialRecord {
  weekId: string;
  sector: 1 | 2 | 3 | 4;
  attempts: number;
  completed: boolean;
  bestTimeSec: number | null;
  bestFloorReached: number;
  bestRoomsCleared: number;
  /** Niedriger = besser (siehe computeTrialScore). */
  bestScore: number;
  badge: TrialBadge | null;
  /** false → beim nächsten Login/Sync erneut hochladen. */
  uploaded: boolean;
}

export interface WeeklyTrialEntry {
  uid: string;
  captainName: string;
  weekId: string;
  sector: number;
  completed: boolean;
  timeSec: number;
  floorReached: number;
  roomsCleared: number;
  score: number;
  badge: TrialBadge | null;
  attempts: number;
  weapon: WeaponId;
  suitTheme: SuitThemeId;
  updatedAt: number;
}

export interface WeeklyTrialResultSummary {
  isNewBest: boolean;
  badge: TrialBadge | null;
  record: WeeklyTrialRecord;
}

export interface RunSummary {
  victory: boolean;
  reason: 'warp' | 'boss_victory' | 'defeat';
  sector?: SectorId;
  floorReached: number;
  runDurationSec?: number;
  isEndlessRift?: boolean;
  riftDepthReached?: number;
  riftLootMultiplier?: number;
  consumedAlchemyBuff?: AlchemyBuffId | null;
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
  // Milestone 9
  isWeeklyTrial?: boolean;
  trialOutcome?: TrialOutcome;
  trialResult?: WeeklyTrialResultSummary;
}

export interface SaveData {
  version: number;
  day: number;
  timeOfDay?: TimeOfDay;
  captainName?: string;
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
  records?: CaptainRecords;
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
  weaponInfusions?: Record<WeaponId, InfusionId>;
  unlockedInfusions?: Record<WeaponId, InfusionId[]>;
  // Milestone 8: Händler-Gilde, Verhandeln & Port-Solaris-Marktplatz
  patronProgress?: Record<PatronId, PatronProgress>;
  activeAlchemyBuff?: AlchemyBuffId | null;
  bankInvestments?: BankInvestment[];
  lastPedestalItems?: Record<number, string>;
  haggleWinsTotal?: number;
  // Milestone 10-A: Story (Save v11)
  story?: StoryProgress;
  /** Gesehene Story-, Intro-, Feier- & Gehilfin-Cutscenes (optional, rückwärtskompatibel zu Save v11) */
  seenCutscenes?: string[];
  /** Geöffnete Hub-Gebäude (Tech-Labor, Schwarzmarkt, Terrasse); fehlt in Altspielständen → alles offen */
  hubUnlocks?: string[];
  /** Befreite Crew-Begleiter (optional; Altspielstände leiten es aus Kapitel/Szenen ab) */
  rescuedCrew?: string[];
  /** M10-C: Preise einmalig auf SELL_PRICE_MULT skaliert (optional, Altspielstände → false) */
  priceScaleV2?: boolean;
  // Milestone 9: Galaktisches Netzwerk (Save v10)
  ghostGreeting?: string;
  weeklyTrial?: WeeklyTrialRecord;
  trialBadgeHistory?: Record<string, TrialBadge>;
  muted: boolean;
  musicMuted?: boolean;
}
