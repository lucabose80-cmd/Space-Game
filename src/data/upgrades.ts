import type { UpgradeLevels, UpgradeTrack } from '../types';

export const UPGRADE_TRACKS: UpgradeTrack[] = [
  {
    key: 'blade',
    title: 'Plasma-Klinge',
    subtitle: 'Nahkampf-Kombo (Linksklick / J)',
    iconItemId: 'plasma_cell',
    tiers: [
      {
        level: 1,
        name: 'MK-II Ionen-Schneide',
        description: 'Erhöht Klingen-Schaden und vergrößert den Plasma-Bogen.',
        creditCost: 220,
        materials: [{ itemId: 'scrap_coil', qty: 2 }],
        statLabel: 'Schaden: 18 → 26',
      },
      {
        level: 2,
        name: 'MK-III Äther-Klinge',
        description: 'Durchdringt schwere Panzerung und füllt Energie schneller auf.',
        creditCost: 580,
        materials: [
          { itemId: 'alien_prism', qty: 2 },
          { itemId: 'drone_core', qty: 1 },
        ],
        statLabel: 'Schaden: 26 → 36',
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
        statLabel: 'Schaden: 36 → 50',
      },
    ],
  },
  {
    key: 'blaster',
    title: 'Puls-Blaster',
    subtitle: 'Fernkampf-Salven (Rechtsklick / K)',
    iconItemId: 'drone_core',
    tiers: [
      {
        level: 1,
        name: 'Fokus-Kondensator',
        description: 'Stärkere Energiebolzen mit geringerem Energieverbrauch.',
        creditCost: 200,
        materials: [{ itemId: 'nav_chip', qty: 2 }],
        statLabel: 'Schaden: 12 → 18',
      },
      {
        level: 2,
        name: 'Zwillings-Impuls',
        description: 'Schnellere Feuerrate und hohe Projektilgeschwindigkeit.',
        creditCost: 540,
        materials: [
          { itemId: 'plasma_cell', qty: 2 },
          { itemId: 'drone_core', qty: 1 },
        ],
        statLabel: 'Schaden: 18 → 25',
      },
      {
        level: 3,
        name: 'Nova-Disruptor',
        description: 'Hochleistungs-Plasma-Strahler für tiefe Sektoren.',
        creditCost: 1200,
        materials: [
          { itemId: 'quantum_gyro', qty: 1 },
          { itemId: 'void_relic', qty: 1 },
        ],
        statLabel: 'Schaden: 25 → 35',
      },
    ],
  },
  {
    key: 'suit',
    title: 'Exo-Anzug',
    subtitle: 'Lebenspunkte & Jetpack-Schub',
    iconItemId: 'alien_prism',
    tiers: [
      {
        level: 1,
        name: 'Verstärkte Keramik-Platten',
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
  {
    key: 'stimpack',
    title: 'Med-Stimpacks',
    subtitle: 'Sofort-Heilung auf Expedition (Q)',
    iconItemId: 'bio_gel',
    tiers: [
      {
        level: 1,
        name: 'Doppel-Injektor',
        description: 'Mehr Ladungen pro Expedition und stärkere Heilwirkung.',
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
    key: 'shopAura',
    title: 'Shop-Atmosphäre',
    subtitle: 'Holo-Deko & Kunden-Trinkgeld',
    iconItemId: 'star_compass',
    tiers: [
      {
        level: 1,
        name: 'Warme Holo-Laternen',
        description: 'Gemütliches Licht lockt mehr Kunden und bringt +10 % Trinkgeld.',
        creditCost: 300,
        materials: [{ itemId: 'alien_prism', qty: 1 }],
        statLabel: 'Trinkgeld: +10 %',
      },
      {
        level: 2,
        name: 'VIP-Sternen-Lounge',
        description: 'Legendärer Ruf im Sektor: +20 % Trinkgeld & mehr Geduld.',
        creditCost: 820,
        materials: [
          { itemId: 'star_compass', qty: 1 },
          { itemId: 'void_relic', qty: 1 },
        ],
        statLabel: 'Trinkgeld: +20 %',
      },
    ],
  },
];

export function getPlayerCombatStats(upgrades: UpgradeLevels) {
  const bladeDamages = [18, 26, 36, 50];
  const bladeRanges = [28, 32, 36, 40];
  const blasterDamages = [12, 18, 25, 35];
  const blasterCooldowns = [0.34, 0.28, 0.22, 0.18];
  const blasterCosts = [18, 15, 13, 11];
  const maxHps = [100, 140, 185, 240];
  const stimCharges = [2, 3, 4, 5];
  const stimHeals = [40, 55, 75, 100];
  const tipBonuses = [0, 0.1, 0.2];

  return {
    bladeDamage: bladeDamages[upgrades.blade] ?? 18,
    bladeRange: bladeRanges[upgrades.blade] ?? 28,
    blasterDamage: blasterDamages[upgrades.blaster] ?? 12,
    blasterCooldown: blasterCooldowns[upgrades.blaster] ?? 0.34,
    blasterEnergyCost: blasterCosts[upgrades.blaster] ?? 18,
    maxHp: maxHps[upgrades.suit] ?? 100,
    maxStimCharges: stimCharges[upgrades.stimpack] ?? 2,
    stimHeal: stimHeals[upgrades.stimpack] ?? 40,
    shopTipBonus: tipBonuses[upgrades.shopAura] ?? 0,
    customerPatienceBonus: 1 + upgrades.shopAura * 0.25,
  };
}
