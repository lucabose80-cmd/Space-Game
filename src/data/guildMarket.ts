import type {
  AlchemyBuffId,
  BigOrderContract,
  ItemDef,
  PatronId,
  PatronProgress,
  TradeRouteId,
} from '../types';

export interface PatronDef {
  id: PatronId;
  name: string;
  shortTag: string;
  role: string;
  accentColor: string;
  auraColor: string;
  speciesIndex: number;
  favoriteLabel: string;
  isFavoriteItem: (def: ItemDef) => boolean;
  decoName: string;
  decoBonusText: string;
  decoPos: { x: number; y: number };
  tier3PerkText: string;
  greetings: [string, string, string, string]; // Tier 0, 1, 2, 3
  bigOrder: BigOrderContract;
}

export const PATRON_XP_THRESHOLDS = [0, 40, 120, 240] as const;

export function getPatronTier(xp: number): 0 | 1 | 2 | 3 {
  if (xp >= PATRON_XP_THRESHOLDS[3]) return 3;
  if (xp >= PATRON_XP_THRESHOLDS[2]) return 2;
  if (xp >= PATRON_XP_THRESHOLDS[1]) return 1;
  return 0;
}

export function getPatronTierLabel(tier: 0 | 1 | 2 | 3): string {
  switch (tier) {
    case 0:
      return 'Neugierig';
    case 1:
      return 'Bekannt (+10 % Tipp)';
    case 2:
      return 'Vertraut (Shop-Deko)';
    case 3:
      return 'Ehrengast (Großauftrag)';
  }
}

export function createInitialPatronProgress(): Record<PatronId, PatronProgress> {
  return {
    vance: { xp: 0, tier: 0, visits: 0, bigOrderCompleted: false, decoUnlocked: false },
    zora: { xp: 0, tier: 0, visits: 0, bigOrderCompleted: false, decoUnlocked: false },
    rix: { xp: 0, tier: 0, visits: 0, bigOrderCompleted: false, decoUnlocked: false },
    tala: { xp: 0, tier: 0, visits: 0, bigOrderCompleted: false, decoUnlocked: false },
  };
}

export const PATRON_ORDER: PatronId[] = ['vance', 'zora', 'rix', 'tala'];

export const PATRON_DEFS: Record<PatronId, PatronDef> = {
  vance: {
    id: 'vance',
    name: 'Admiral Vance',
    shortTag: '★ VANCE',
    role: 'Flotten-Veteran',
    accentColor: '#fbbf24',
    auraColor: '#38bdf8',
    speciesIndex: 0,
    favoriteLabel: 'Sektor 1 & 3 (Reaktor- & Militär-Relikte)',
    isFavoriteItem: (def) => (def.sector ?? 1) === 1 || def.sector === 3,
    decoName: 'Flotten-Standarte',
    decoBonusText: '+10 % Dieb-Kopfgeld & +5 % Trinkgeld im Shop',
    decoPos: { x: 132, y: 66 },
    tier3PerkText: 'Permanenter +5 % Verkaufspreis auf Sektor 1 & 3 Relikte',
    greetings: [
      '„Solider Laden, Kapitän. Zeig mir, was die Wracks hergeben.“',
      '„Gute Ware wie immer! Die Flotte schätzt verlässliche Bergung.“',
      '„Meine Standarte hängt gut hier — deine Kunden spüren Disziplin!“',
      '„Ehrengast in Astro-Barter! Für dich öffnet die Flotte jede Schatzkammer.“',
    ],
    bigOrder: {
      patronId: 'vance',
      title: 'Flotten-Reaktor-Inspektion',
      items: [
        { itemId: 'aegis_plate', qty: 2 },
        { itemId: 'leviathan_core', qty: 1 },
      ],
      rewardCredits: 1800,
      rewardXp: 60,
      completed: false,
    },
  },
  zora: {
    id: 'zora',
    name: 'Kuratorin Zora',
    shortTag: '★ ZORA',
    role: 'Xenologie-Museum',
    accentColor: '#c084fc',
    auraColor: '#38e8d4',
    speciesIndex: 1,
    favoriteLabel: 'Sektor 2 & 4 (Kristall- & Astral-Relikte)',
    isFavoriteItem: (def) => def.sector === 2 || def.sector === 4,
    decoName: 'Kristall-Vitrine',
    decoBonusText: '+15 % Kunden-Geduld an der Kasse',
    decoPos: { x: 348, y: 66 },
    tier3PerkText: 'Permanenter +5 % Verkaufspreis auf Sektor 2 & 4 Relikte',
    greetings: [
      '„Faszinierend… sind diese Relikte wirklich aus dem äußeren Nebel?“',
      '„Ah, mein Lieblings-Archiv! Hast du heute Kristall-Funde für mich?“',
      '„Die Kristall-Vitrine beruhigt den gesamten Raum — wundervolle Akustik!“',
      '„Dein Laden gehört längst zu den Wundern von Port Solaris!“',
    ],
    bigOrder: {
      patronId: 'zora',
      title: 'Kristall-Sonderausstellung',
      items: [
        { itemId: 'crystal_capacitor', qty: 2 },
        { itemId: 'archon_heart', qty: 1 },
      ],
      rewardCredits: 2600,
      rewardXp: 60,
      completed: false,
    },
  },
  rix: {
    id: 'rix',
    name: 'Schmuggler Rix',
    shortTag: '★ RIX',
    role: 'Freihändler',
    accentColor: '#f472b6',
    auraColor: '#c084fc',
    speciesIndex: 2,
    favoriteLabel: 'Schmuggler- & Rift-Relikte',
    isFavoriteItem: (def) => def.modifier === 'smuggler' || def.sector === 5,
    decoName: 'Schmuggler-Laterne',
    decoBonusText: '+8 % Chance auf VIP- & Stammkunden-Besuche',
    decoPos: { x: 204, y: 224 },
    tier3PerkText: '15 % Dauer-Rabatt bei Nyx’ Schwarzmarkt',
    greetings: [
      '„Psst… hast du was unter der Theke? Keine Fragen, gute Credits.“',
      '„Du verstehst das Geschäft, Boss. Wir sprechen dieselbe Sprache.“',
      '„Mit meiner Laterne am Eingang finden die richtigen Leute sofort her!“',
      '„Nyx hat mir versprochen, dir ab sofort den Freundschaftspreis zu geben!“',
    ],
    bigOrder: {
      patronId: 'rix',
      title: 'Rift-Schmuggel-Lieferung',
      items: [
        { itemId: 'phase_geode', qty: 2 },
        { itemId: 'rift_catalyst', qty: 1 },
      ],
      rewardCredits: 2200,
      rewardXp: 60,
      completed: false,
    },
  },
  tala: {
    id: 'tala',
    name: 'Ingenieurin Tala',
    shortTag: '★ TALA',
    role: 'Solaris-Chefarchitektin',
    accentColor: '#fb923c',
    auraColor: '#38e8d4',
    speciesIndex: 0,
    favoriteLabel: 'Uncommon- & Rare-Tech-Relikte',
    isFavoriteItem: (def) => def.rarity === 'uncommon' || def.rarity === 'rare',
    decoName: 'Holo-Konjunktur-Globus',
    decoBonusText: '+6 % Erfolgschance beim Feilschen',
    decoPos: { x: 214, y: 124 },
    tier3PerkText: '+5 % Bonus-Rendite auf alle Solaris-Handelsrouten',
    greetings: [
      '„Saubere Holo-Podest-Kalibrierung! Mal sehen, welche Bauteile du hast.“',
      '„Deine Komponenten halten die halbe Promenade am Laufen, Kapitän!“',
      '„Der Holo-Globus zeigt dir jede Preis-Tendenz — nutze ihn beim Feilschen!“',
      '„Mit deiner Unterstützung floriert die gesamte Handelsbank von Solaris!“',
    ],
    bigOrder: {
      patronId: 'tala',
      title: 'Promenaden-Energie-Upgrade',
      items: [
        { itemId: 'drone_core', qty: 3 },
        { itemId: 'foundry_gear', qty: 2 },
      ],
      rewardCredits: 2400,
      rewardXp: 60,
      completed: false,
    },
  },
};

// ==================== MILO'S ALCHEMIE-BAR (RUN-BUFFS) ====================
export interface AlchemyBuffDef {
  id: AlchemyBuffId;
  name: string;
  shortName: string;
  icon: string;
  color: string;
  effectSummary: string;
  creditCost: number;
  materials: Array<{ itemId: string; qty: number }>;
}

export const ALCHEMY_BUFF_ORDER: AlchemyBuffId[] = [
  'solar_espresso',
  'aegis_tonic',
  'nebula_nectar',
  'chrono_fizz',
  'void_elixir',
];

export const ALCHEMY_BUFFS: Record<AlchemyBuffId, AlchemyBuffDef> = {
  solar_espresso: {
    id: 'solar_espresso',
    name: 'Solar-Espresso',
    shortName: 'ESPRESSO',
    icon: '☕',
    color: '#fb923c',
    effectSummary: '+20 % Waffenschaden (alle 6 Waffen) für deine nächste Expedition',
    creditCost: 45,
    materials: [
      { itemId: 'scrap_coil', qty: 2 },
      { itemId: 'plasma_cell', qty: 1 },
    ],
  },
  aegis_tonic: {
    id: 'aegis_tonic',
    name: 'Aegis-Tonic',
    shortName: 'AEGIS',
    icon: '🧪',
    color: '#34d399',
    effectSummary: '+25 % Max-HP & +1 Stimpack-Ladung für deine nächste Expedition',
    creditCost: 60,
    materials: [
      { itemId: 'bio_gel', qty: 2 },
      { itemId: 'aegis_plate', qty: 1 },
    ],
  },
  nebula_nectar: {
    id: 'nebula_nectar',
    name: 'Nebel-Nektar',
    shortName: 'NEKTAR',
    icon: '✨',
    color: '#c084fc',
    effectSummary: '+35 % Loot-Glück (seltenere Relikte) für deine nächste Expedition',
    creditCost: 80,
    materials: [
      { itemId: 'quartz_shard', qty: 2 },
      { itemId: 'prism_dust', qty: 1 },
    ],
  },
  chrono_fizz: {
    id: 'chrono_fizz',
    name: 'Chrono-Sprudel',
    shortName: 'CHRONO',
    icon: '⚡',
    color: '#38e8d4',
    effectSummary: '+18 % Lauftempo & -20 % Dash-Cooldown für deine nächste Expedition',
    creditCost: 95,
    materials: [
      { itemId: 'solar_slag', qty: 2 },
      { itemId: 'ember_coil', qty: 1 },
    ],
  },
  void_elixir: {
    id: 'void_elixir',
    name: 'Ältesten-Elixier',
    shortName: 'ELIXIER',
    icon: '🌌',
    color: '#fde047',
    effectSummary: '+15 % Krit-Chance & +25 % Energie-Regen für deine nächste Expedition',
    creditCost: 120,
    materials: [
      { itemId: 'astral_shard', qty: 2 },
      { itemId: 'chrono_sand', qty: 1 },
    ],
  },
};

// ==================== SOLARIS-HANDELSBANK (HANDELSROUTEN) ====================
export interface TradeRouteDef {
  id: TradeRouteId;
  name: string;
  icon: string;
  color: string;
  description: string;
  principal: number;
  cycles: number;
  minReturnMult: number;
  maxReturnMult: number;
  unlockRequirementText: string;
}

export const TRADE_ROUTE_ORDER: TradeRouteId[] = [
  'solaris_shuttle',
  'crystal_convoy',
  'foundry_freight',
  'elder_expedition',
];

export const TRADE_ROUTES: Record<TradeRouteId, TradeRouteDef> = {
  solaris_shuttle: {
    id: 'solaris_shuttle',
    name: 'Solaris-Pendelshuttle',
    icon: '🚀',
    color: '#38e8d4',
    description: 'Sichere Nahbereichs-Versorgung zwischen Port Solaris & den Außen-Docks.',
    principal: 150,
    cycles: 2,
    minReturnMult: 1.15,
    maxReturnMult: 1.25,
    unlockRequirementText: 'Ab Tag 1 verfügbar',
  },
  crystal_convoy: {
    id: 'crystal_convoy',
    name: 'Kristall-Konvoi',
    icon: '💎',
    color: '#c084fc',
    description: 'Eskortierter Relikt-Transport durch den Kristall-Nebel mit starker Marge.',
    principal: 400,
    cycles: 3,
    minReturnMult: 1.2,
    maxReturnMult: 1.38,
    unlockRequirementText: 'Sektor 1 abgeschlossen ODER Shop Stufe II',
  },
  foundry_freight: {
    id: 'foundry_freight',
    name: 'Gießerei-Frachter',
    icon: '🔥',
    color: '#fb923c',
    description: 'Schwerlast-Schmelzfrachter für hochpreisige Solar-Legierungen.',
    principal: 900,
    cycles: 3,
    minReturnMult: 1.22,
    maxReturnMult: 1.45,
    unlockRequirementText: 'Sektor 2 abgeschlossen',
  },
  elder_expedition: {
    id: 'elder_expedition',
    name: 'Ältesten-Fernroute',
    icon: '👑',
    color: '#fde047',
    description: 'Hochprofitable Tiefenraum-Karawane bis an den Rand des Ältesten-Monoliths.',
    principal: 1800,
    cycles: 4,
    minReturnMult: 1.25,
    maxReturnMult: 1.55,
    unlockRequirementText: 'Sektor 3 abgeschlossen',
  },
};

export const MAX_ACTIVE_BANK_INVESTMENTS = 2;
