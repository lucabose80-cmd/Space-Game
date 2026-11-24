import type { UpgradeLevels, UpgradeTrack, WeaponId } from '../types';

export const WEAPON_META: Record<
  WeaponId,
  {
    name: string;
    shortName: string;
    primaryLabel: string;
    secondaryLabel: string;
    iconUrl: string;
    accentColor: string;
  }
> = {
  blade: {
    name: 'Plasma-Klinge',
    shortName: 'KLINGE',
    primaryLabel: '3er-Plasma-Kombo',
    secondaryLabel: 'Kinetik-Schild (Blocken)',
    iconUrl: '/art/sprites/weapon_blade.png',
    accentColor: '#38e8d4',
  },
  blaster: {
    name: 'Puls-Blaster',
    shortName: 'BLASTER',
    primaryLabel: 'Schnelle Plasma-Salve',
    secondaryLabel: 'Durchschuss-Laserstrahl',
    iconUrl: '/art/sprites/weapon_blaster.png',
    accentColor: '#38bdf8',
  },
  hammer: {
    name: 'Grav-Hammer',
    shortName: 'HAMMER',
    primaryLabel: 'Schwerer 2er-Schwung',
    secondaryLabel: 'Grav-Schockwelle (360°)',
    iconUrl: '/art/sprites/weapon_hammer.png',
    accentColor: '#fb923c',
  },
};

export const UPGRADE_TRACKS: UpgradeTrack[] = [
  // ==================== KAEL'S EXO-SCHMIEDE (WAFFEN & ANZUG) ====================
  {
    key: 'blade',
    shop: 'forge',
    weaponId: 'blade',
    title: 'Plasma-Klinge',
    subtitle: 'Ausgewogene Nahkampf-Klinge + Kinetik-Schild',
    primaryDesc: '3er-Kombo mit Wirbel-Finisher',
    secondaryDesc: 'Kinetik-Schild blockt Laser & 75 % Schaden',
    iconUrl: '/art/sprites/weapon_blade.png',
    tiers: [
      {
        level: 1,
        name: 'MK-II Ionen-Schneide',
        description: 'Erhöht Klingen-Schaden und vergrößert die Sichel-Reichweite.',
        creditCost: 220,
        materials: [{ itemId: 'scrap_coil', qty: 2 }],
        statLabel: 'Schaden: 20 → 28',
      },
      {
        level: 2,
        name: 'MK-III Äther-Klinge',
        description: 'Schärfere Plasma-Kante durchdringt schwere Panzerung.',
        creditCost: 580,
        materials: [
          { itemId: 'alien_prism', qty: 2 },
          { itemId: 'drone_core', qty: 1 },
        ],
        statLabel: 'Schaden: 28 → 38',
      },
      {
        level: 3,
        name: 'MK-IV Sternen-Säbel',
        description: 'Meisterhafte Plasma-Klinge mit gewaltiger Finisher-Druckwelle.',
        creditCost: 1350,
        materials: [
          { itemId: 'star_compass', qty: 2 },
          { itemId: 'mk4_heart', qty: 1 },
        ],
        statLabel: 'Schaden: 38 → 52',
      },
    ],
  },
  {
    key: 'blaster',
    shop: 'forge',
    weaponId: 'blaster',
    title: 'Puls-Blaster',
    subtitle: 'Flinke Fernkampf-Waffe + Durchschuss-Laser',
    primaryDesc: 'Schnelle Plasma-Bolzen aus der Distanz',
    secondaryDesc: 'Überladener Durchschuss-Strahl (38 EN)',
    iconUrl: '/art/sprites/weapon_blaster.png',
    craftCost: {
      creditCost: 150,
      materials: [
        { itemId: 'scrap_coil', qty: 2 },
        { itemId: 'nav_chip', qty: 1 },
      ],
      statLabel: 'Schmieden: 15 Schaden · Durchschuss-Laser',
    },
    tiers: [
      {
        level: 1,
        name: 'Fokus-Kondensator',
        description: 'Stärkere Energiebolzen & kräftigerer Laserstrahl.',
        creditCost: 340,
        materials: [{ itemId: 'plasma_cell', qty: 2 }],
        statLabel: 'Schaden: 15 → 22',
      },
      {
        level: 2,
        name: 'Zwillings-Impuls',
        description: 'Schnellere Feuerrate und hohe Projektilgeschwindigkeit.',
        creditCost: 720,
        materials: [
          { itemId: 'plasma_cell', qty: 2 },
          { itemId: 'drone_core', qty: 2 },
        ],
        statLabel: 'Schaden: 22 → 30',
      },
      {
        level: 3,
        name: 'Nova-Disruptor',
        description: 'Hochleistungs-Plasma-Strahler für tiefe Sektoren.',
        creditCost: 1400,
        materials: [
          { itemId: 'quantum_gyro', qty: 1 },
          { itemId: 'void_relic', qty: 1 },
        ],
        statLabel: 'Schaden: 30 → 42',
      },
    ],
  },
  {
    key: 'hammer',
    shop: 'forge',
    weaponId: 'hammer',
    title: 'Grav-Hammer',
    subtitle: 'Schwerer Kriegshammer + 360°-Schockwelle',
    primaryDesc: 'Wuchtige 2er-Schwünge mit massivem Knockback',
    secondaryDesc: 'Gravitations-Schockwelle rundum (42 EN)',
    iconUrl: '/art/sprites/weapon_hammer.png',
    craftCost: {
      creditCost: 260,
      materials: [
        { itemId: 'drone_core', qty: 2 },
        { itemId: 'plasma_cell', qty: 1 },
      ],
      statLabel: 'Schmieden: 34 Schaden · 360°-Schockwelle',
    },
    tiers: [
      {
        level: 1,
        name: 'Seismik-Kopf',
        description: 'Noch wuchtigere Schläge und größere Schockwelle.',
        creditCost: 520,
        materials: [{ itemId: 'alien_prism', qty: 2 }],
        statLabel: 'Schaden: 34 → 46',
      },
      {
        level: 2,
        name: 'Solar-Amboss',
        description: 'Glühender Gravitationskern zerschmettert jede Deckung.',
        creditCost: 980,
        materials: [
          { itemId: 'star_compass', qty: 1 },
          { itemId: 'cryo_amber', qty: 1 },
        ],
        statLabel: 'Schaden: 46 → 62',
      },
      {
        level: 3,
        name: 'Titan-Singularität',
        description: 'Legendärer Schwerhammer mit vernichtendem Einschlag.',
        creditCost: 1650,
        materials: [
          { itemId: 'void_relic', qty: 1 },
          { itemId: 'mk4_heart', qty: 1 },
        ],
        statLabel: 'Schaden: 62 → 82',
      },
    ],
  },
  {
    key: 'suit',
    shop: 'forge',
    title: 'Exo-Anzug',
    subtitle: 'Maximale Lebenspunkte & Panzerung',
    iconUrl: '/art/sprites/item_alien_prism.png',
    tiers: [
      {
        level: 1,
        name: 'Keramik-Verbundplatten',
        description: 'Erhöht maximale HP deutlich und stabilisiert den Jetpack.',
        creditCost: 240,
        materials: [{ itemId: 'bio_gel', qty: 2 }],
        statLabel: 'Max HP: 100 → 140',
      },
      {
        level: 2,
        name: 'Titan-Schildgewebe',
        description: 'Hohe Überlebensfähigkeit gegen Boss-Attacken.',
        creditCost: 620,
        materials: [
          { itemId: 'plasma_cell', qty: 2 },
          { itemId: 'alien_prism', qty: 2 },
        ],
        statLabel: 'Max HP: 140 → 185',
      },
      {
        level: 3,
        name: 'Aegis-Sternenpanzer',
        description: 'Legendärer Frontier-Anzug für furchtlose Relikt-Jäger.',
        creditCost: 1450,
        materials: [
          { itemId: 'cryo_amber', qty: 1 },
          { itemId: 'mk4_heart', qty: 1 },
        ],
        statLabel: 'Max HP: 185 → 240',
      },
    ],
  },

  // ==================== DR. LYRA'S MED-BAY (MEDIZIN & BIO-FORSCHUNG) ====================
  {
    key: 'stimpack',
    shop: 'medbay',
    title: 'Med-Stimpacks',
    subtitle: 'Sofort-Heilung auf Expedition (Q)',
    iconUrl: '/art/sprites/item_bio_gel.png',
    tiers: [
      {
        level: 1,
        name: 'Doppel-Injektor',
        description: 'Mehr Heil-Ladungen pro Expedition und stärkere Wirkung.',
        creditCost: 180,
        materials: [{ itemId: 'bio_gel', qty: 2 }],
        statLabel: '2× 40 HP → 3× 55 HP',
      },
      {
        level: 2,
        name: 'Nano-Regenerator',
        description: 'Schnelle Zellreparatur direkt im Gefecht.',
        creditCost: 480,
        materials: [
          { itemId: 'bio_gel', qty: 3 },
          { itemId: 'star_compass', qty: 1 },
        ],
        statLabel: '3× 55 HP → 4× 75 HP',
      },
      {
        level: 3,
        name: 'Quanten-Medkit',
        description: 'Maximale Ausdauer selbst in den härtesten Kämpfen.',
        creditCost: 1050,
        materials: [{ itemId: 'quantum_gyro', qty: 1 }],
        statLabel: '4× 75 HP → 5× 100 HP',
      },
    ],
  },
  {
    key: 'bioRegen',
    shop: 'medbay',
    title: 'Nano-Vitalserum',
    subtitle: 'Raum-Heilung & schnellere Energie-Regeneration',
    iconUrl: '/art/sprites/item_cryo_amber.png',
    tiers: [
      {
        level: 1,
        name: 'Zell-Booster MK-I',
        description: 'Heilt nach jedem gesäuberten Raum automatisch HP und beschleunigt Energie-Regen.',
        creditCost: 220,
        materials: [
          { itemId: 'bio_gel', qty: 2 },
          { itemId: 'scrap_coil', qty: 1 },
        ],
        statLabel: '+12 HP/Raum · +25 % EN-Regen',
      },
      {
        level: 2,
        name: 'Bio-Symbiont MK-II',
        description: 'Starke Regeneration nach Kämpfen für längere Tiefen-Expeditionen.',
        creditCost: 560,
        materials: [
          { itemId: 'bio_gel', qty: 3 },
          { itemId: 'plasma_cell', qty: 2 },
        ],
        statLabel: '+24 HP/Raum · +50 % EN-Regen',
      },
      {
        level: 3,
        name: 'Phönix-Serum MK-III',
        description: 'Meisterhafte Medizin von Dr. Lyra: massive Selbstheilung & Energie-Fluss.',
        creditCost: 1180,
        materials: [
          { itemId: 'cryo_amber', qty: 1 },
          { itemId: 'void_relic', qty: 1 },
        ],
        statLabel: '+38 HP/Raum · +80 % EN-Regen',
      },
    ],
  },

  // ==================== ASTRO-BARTER SHOP-TERMINAL (EIGENER LADENAUSBAU) ====================
  {
    key: 'shopAura',
    shop: 'shop_terminal',
    title: 'Shop-Atmosphäre & Deko',
    subtitle: 'Schwebende Holo-Laternen, mehr Kunden & Trinkgeld',
    iconUrl: '/art/sprites/item_star_compass.png',
    tiers: [
      {
        level: 1,
        name: 'Warme Holo-Laternen',
        description: 'Schmückt Astro-Barter mit schwebenden Laternen, lockt mehr Kunden & +10 % Trinkgeld.',
        creditCost: 260,
        materials: [{ itemId: 'alien_prism', qty: 1 }],
        statLabel: 'Deko +10 % Trinkgeld',
      },
      {
        level: 2,
        name: 'VIP-Sternen-Lounge',
        description: 'Edles Frontier-Ambiente: goldene Holo-Kristalle, +20 % Trinkgeld & viel mehr Geduld.',
        creditCost: 780,
        materials: [
          { itemId: 'star_compass', qty: 1 },
          { itemId: 'void_relic', qty: 1 },
        ],
        statLabel: 'VIP-Deko +20 % Trinkgeld',
      },
    ],
  },
  {
    key: 'shopScanner',
    shop: 'shop_terminal',
    title: 'Kassen- & Preis-Terminal',
    subtitle: 'Höherer Verkaufserlös & geduldigere Käufer',
    iconUrl: '/art/sprites/item_nav_chip.png',
    tiers: [
      {
        level: 1,
        name: 'Holo-Kassen-Assistent',
        description: 'Elegante Waren-Präsentation erhöht Verkaufspreis-Boni bei fairem Preis um +8 %.',
        creditCost: 210,
        materials: [{ itemId: 'nav_chip', qty: 2 }],
        statLabel: '+8 % Erlös · +20 % Geduld',
      },
      {
        level: 2,
        name: 'Galaktisches Handels-Netz',
        description: 'Wohlhabende Händler besuchen Astro-Barter: +16 % Bonus-Erlös an der Kasse.',
        creditCost: 640,
        materials: [
          { itemId: 'drone_core', qty: 2 },
          { itemId: 'star_compass', qty: 1 },
        ],
        statLabel: '+16 % Erlös · +40 % Geduld',
      },
    ],
  },
];

export function getPlayerCombatStats(upgrades: UpgradeLevels) {
  const bladeDamages = [20, 28, 38, 52];
  const bladeRanges = [31, 35, 39, 43];
  const blasterDamages = [15, 22, 30, 42];
  const blasterCooldowns = [0.29, 0.25, 0.21, 0.17];
  const hammerDamages = [34, 46, 62, 82];
  const hammerRanges = [36, 40, 44, 48];
  const maxHps = [100, 140, 185, 240];
  const stimCharges = [2, 3, 4, 5];
  const stimHeals = [40, 55, 75, 100];
  const roomClearHeals = [0, 12, 24, 38];
  const energyRegenMults = [1.0, 1.25, 1.5, 1.8];
  const tipBonuses = [0, 0.1, 0.2];
  const scannerBonuses = [0, 0.08, 0.16];

  const aura = upgrades.shopAura ?? 0;
  const scanner = upgrades.shopScanner ?? 0;
  const bio = upgrades.bioRegen ?? 0;

  return {
    bladeDamage: bladeDamages[upgrades.blade] ?? 20,
    bladeRange: bladeRanges[upgrades.blade] ?? 31,
    blasterDamage: blasterDamages[upgrades.blaster] ?? 15,
    blasterCooldown: blasterCooldowns[upgrades.blaster] ?? 0.29,
    hammerDamage: hammerDamages[upgrades.hammer] ?? 34,
    hammerRange: hammerRanges[upgrades.hammer] ?? 36,
    maxHp: maxHps[upgrades.suit] ?? 100,
    maxStimCharges: stimCharges[upgrades.stimpack] ?? 2,
    stimHeal: stimHeals[upgrades.stimpack] ?? 40,
    roomClearHeal: roomClearHeals[bio] ?? 0,
    energyRegenMult: energyRegenMults[bio] ?? 1.0,
    shopTipBonus: (tipBonuses[aura] ?? 0) + (scannerBonuses[scanner] ?? 0),
    customerPatienceBonus: 1 + aura * 0.25 + scanner * 0.2,
  };
}
