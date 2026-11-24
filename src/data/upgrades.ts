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
  spear: {
    name: 'Ionen-Speer',
    shortName: 'SPEER',
    primaryLabel: '3er-Plasma-Stoß (Reichweite)',
    secondaryLabel: 'Lanzen-Vorstoß (34 EN)',
    iconUrl: '/art/sprites/weapon_spear.png',
    accentColor: '#fde047',
  },
};

export const UPGRADE_TRACKS: UpgradeTrack[] = [
  // ==================== KAEL'S EXO-SCHMIEDE (WAFFEN & ANZUG, BIS TIER IV!) ====================
  {
    key: 'blade',
    shop: 'forge',
    weaponId: 'blade',
    title: 'Plasma-Klinge',
    subtitle: 'Ausgewogene Nahkampf-Klinge + Kinetik-Schild',
    primaryDesc: '3er-Kombo mit Wirbel-Finisher',
    secondaryDesc: 'Hex-Aegis Schild (Perfekt-Parade reflektiert Laser)',
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
      {
        level: 4,
        name: 'MK-V Omega-Klinge',
        description: 'Mit A.E.G.I.S.-Technologie geschmiedete Legenden-Klinge für tiefe Sektoren!',
        creditCost: 2400,
        materials: [
          { itemId: 'aegis_plate', qty: 2 },
          { itemId: 'leviathan_core', qty: 1 },
        ],
        statLabel: 'Schaden: 52 → 70',
      },
    ],
  },
  {
    key: 'spear',
    shop: 'forge',
    weaponId: 'spear',
    title: 'Ionen-Speer',
    subtitle: 'Präzise Durchstoß-Lanze mit extremer Reichweite',
    primaryDesc: 'Schneller 3er-Durchstoß trifft mehrere Gegner in Linie',
    secondaryDesc: 'Lanzen-Vorstoß mit Unverwundbarkeit (34 EN)',
    iconUrl: '/art/sprites/weapon_spear.png',
    craftCost: {
      creditCost: 210,
      materials: [
        { itemId: 'alien_prism', qty: 2 },
        { itemId: 'scrap_coil', qty: 2 },
      ],
      statLabel: 'Schmieden: 22 Schaden · Lange Durchstoß-Reichweite',
    },
    tiers: [
      {
        level: 1,
        name: 'Vektor-Spitze MK-II',
        description: 'Verlängert den Plasma-Stoß und erhöht die Durchschlagskraft.',
        creditCost: 420,
        materials: [{ itemId: 'reactor_shard', qty: 2 }],
        statLabel: 'Schaden: 22 → 31',
      },
      {
        level: 2,
        name: 'Kometen-Lanze MK-III',
        description: 'Durchbricht Schild-Drohnen mühelos mit konzentriertem Ionen-Stoß.',
        creditCost: 880,
        materials: [
          { itemId: 'aegis_plate', qty: 1 },
          { itemId: 'drone_core', qty: 2 },
        ],
        statLabel: 'Schaden: 31 → 42',
      },
      {
        level: 3,
        name: 'Hyperion-Speer MK-IV',
        description: 'Hochleistungs-Lanze mit gewaltigem Lanzen-Vorstoß.',
        creditCost: 1550,
        materials: [
          { itemId: 'quantum_gyro', qty: 1 },
          { itemId: 'mk4_heart', qty: 1 },
        ],
        statLabel: 'Schaden: 42 → 56',
      },
      {
        level: 4,
        name: 'Solaris-Sternenlanze MK-V',
        description: 'Die perfekte Waffe für Ebene III & kommende Sektor-2-Expeditionen!',
        creditCost: 2650,
        materials: [
          { itemId: 'aegis_plate', qty: 2 },
          { itemId: 'leviathan_core', qty: 1 },
        ],
        statLabel: 'Schaden: 56 → 74',
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
      {
        level: 4,
        name: 'Omega-Railkanone MK-V',
        description: 'Maximale Feuerkadenz und vernichtender Durchschuss-Laser!',
        creditCost: 2450,
        materials: [
          { itemId: 'reactor_shard', qty: 2 },
          { itemId: 'leviathan_core', qty: 1 },
        ],
        statLabel: 'Schaden: 42 → 56',
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
      {
        level: 4,
        name: 'Leviathan-Brecher MK-V',
        description: 'Geschmiedet aus dem Omega-Kern — erschüttert ganze Decks!',
        creditCost: 2750,
        materials: [
          { itemId: 'aegis_plate', qty: 2 },
          { itemId: 'leviathan_core', qty: 1 },
        ],
        statLabel: 'Schaden: 82 → 108',
      },
    ],
  },
  {
    key: 'suit',
    shop: 'forge',
    title: 'Exo-Anzug',
    subtitle: 'Maximale Lebenspunkte & Panzerung',
    iconUrl: '/art/sprites/item_aegis_plate.png',
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
        description: 'Hohe Überlebensfähigkeit gegen Ebene-II-Gegner & Bosse.',
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
        description: 'Schwerer Frontier-Anzug für die Tiefen von Ebene III.',
        creditCost: 1450,
        materials: [
          { itemId: 'aegis_plate', qty: 2 },
          { itemId: 'mk4_heart', qty: 1 },
        ],
        statLabel: 'Max HP: 185 → 245',
      },
      {
        level: 4,
        name: 'Omega-Vanguard-Rüstung',
        description: 'Ultimativer Sektor-Meisteranzug aus dem Leviathan-Kern!',
        creditCost: 2500,
        materials: [
          { itemId: 'aegis_plate', qty: 2 },
          { itemId: 'leviathan_core', qty: 1 },
        ],
        statLabel: 'Max HP: 245 → 320',
      },
    ],
  },

  // ==================== VEX' TECH-LABOR (PASSIVE KAMPF- & SCANNER-MODULE!) ====================
  {
    key: 'modCrit',
    shop: 'techlab',
    title: 'Ionen-Kette (Krit-Modul)',
    subtitle: 'Waffen-Verzauberung: Kritische Blitz-Treffer (1,65× Schaden)',
    iconUrl: '/art/sprites/item_reactor_shard.png',
    tiers: [
      {
        level: 1,
        name: 'Funken-Spule MK-I',
        description: 'Jeder Waffen-Treffer hat 14 % Chance auf einen kritischen Ionen-Schlag!',
        creditCost: 320,
        materials: [
          { itemId: 'plasma_cell', qty: 2 },
          { itemId: 'scrap_coil', qty: 2 },
        ],
        statLabel: '14 % Krit-Chance (1,65×)',
      },
      {
        level: 2,
        name: 'Lichtbogen-Kern MK-II',
        description: 'Deutlich häufigere kritische Entladungen gegen Bosse & Elite-Drohnen.',
        creditCost: 780,
        materials: [
          { itemId: 'reactor_shard', qty: 2 },
          { itemId: 'drone_core', qty: 2 },
        ],
        statLabel: '24 % Krit-Chance (1,65×)',
      },
      {
        level: 3,
        name: 'Supernova-Induktor MK-III',
        description: 'Meisterhafte Tech-Verzauberung: jeder dritte Schlag zündet Ionen-Krit!',
        creditCost: 1550,
        materials: [
          { itemId: 'nova_core', qty: 1 },
          { itemId: 'aegis_plate', qty: 1 },
        ],
        statLabel: '36 % Krit-Chance (1,65×)',
      },
    ],
  },
  {
    key: 'modThruster',
    shop: 'techlab',
    title: 'Schub-Kondensator',
    subtitle: 'Höheres Lauftempo & kürzerer Jetpack-Dash-Cooldown',
    iconUrl: '/art/sprites/item_quantum_gyro.png',
    tiers: [
      {
        level: 1,
        name: 'Aero-Düsen MK-I',
        description: 'Schnelleres Ausweichen in engen Kampf- und Boss-Arenen.',
        creditCost: 280,
        materials: [{ itemId: 'nav_chip', qty: 2 }],
        statLabel: '+10 % Tempo · -14 % Dash-CD',
      },
      {
        level: 2,
        name: 'Vektor-Triebwerk MK-II',
        description: 'Geschmeidige Hochgeschwindigkeits-Manöver gegen Laser & Fäuste.',
        creditCost: 680,
        materials: [
          { itemId: 'reactor_shard', qty: 2 },
          { itemId: 'star_compass', qty: 1 },
        ],
        statLabel: '+18 % Tempo · -26 % Dash-CD',
      },
      {
        level: 3,
        name: 'Quanten-Jetpack MK-III',
        description: 'Ultra-agiler Jetpack mit blitzschneller Nachladezeit!',
        creditCost: 1380,
        materials: [
          { itemId: 'quantum_gyro', qty: 1 },
          { itemId: 'chrono_lens', qty: 1 },
        ],
        statLabel: '+26 % Tempo · -36 % Dash-CD',
      },
    ],
  },
  {
    key: 'modLuck',
    shop: 'techlab',
    title: 'Relikt-Scanner (Beute-Glück)',
    subtitle: 'Erhöht dauerhaft die Fundchance auf seltene & epische Relikte',
    iconUrl: '/art/sprites/item_star_compass.png',
    tiers: [
      {
        level: 1,
        name: 'Spektral-Linse MK-I',
        description: 'Stapelt sich mit Nacht-Expeditionen für deutlich bessere Drops!',
        creditCost: 340,
        materials: [{ itemId: 'alien_prism', qty: 2 }],
        statLabel: '+18 % Rar-/Episch-Glück',
      },
      {
        level: 2,
        name: 'Tiefen-Sonarmatrix MK-II',
        description: 'Findet verlässlicher wertvolle Ebene-II/III-Artefakte & Platten.',
        creditCost: 820,
        materials: [
          { itemId: 'star_compass', qty: 1 },
          { itemId: 'mimic_cube', qty: 1 },
        ],
        statLabel: '+36 % Rar-/Episch-Glück',
      },
      {
        level: 3,
        name: 'Astral-Schatzsucher MK-III',
        description: 'Maximale Drop-Qualität in jedem Raum und jeder Truhe!',
        creditCost: 1620,
        materials: [
          { itemId: 'chrono_lens', qty: 1 },
          { itemId: 'aegis_plate', qty: 2 },
        ],
        statLabel: '+56 % Rar-/Episch-Glück',
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
        description: 'Maximale Ausdauer selbst in den härtesten Boss-Kämpfen.',
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
        description: 'Starke Regeneration nach Kämpfen für längere 3-Ebenen-Expeditionen.',
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
    key: 'shopTier',
    shop: 'shop_terminal',
    title: 'Shop-Vergrößerung (Raum & Podeste)',
    subtitle: 'Mehr Holo-Podeste, Sonderangebots-Kiste & mehr Truhen im Hinterzimmer',
    iconUrl: '/art/sprites/prop_salebox.png',
    tiers: [
      {
        level: 1,
        name: 'Stufe II · Astro-Barter Galerie',
        description:
          'Erweitert Astro-Barter auf 6 Holo-Podeste, schaltet die Sonderangebots-Kiste (Sale-Box) frei & 2. Lagertruhe (36 Slots)!',
        creditCost: 580,
        materials: [
          { itemId: 'alien_prism', qty: 2 },
          { itemId: 'scrap_coil', qty: 3 },
        ],
        statLabel: '4 → 6 Podeste · Sale-Box · 36 Truhe',
      },
      {
        level: 2,
        name: 'Stufe III · Solaris Flaggschiff-Basar',
        description:
          'Verwandelt deinen Laden in den goldenen Flaggschiff-Basar mit 8 Holo-Podesten, 3. Lagertruhe (48 Slots) & mehr VIP-Kunden!',
        creditCost: 1450,
        materials: [
          { itemId: 'star_compass', qty: 2 },
          { itemId: 'void_relic', qty: 1 },
        ],
        statLabel: '6 → 8 Podeste · 48 Truhe · Flaggschiff',
      },
    ],
  },
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
  const bladeDamages = [20, 28, 38, 52, 70];
  const bladeRanges = [31, 35, 39, 43, 47];
  const spearDamages = [22, 31, 42, 56, 74];
  const spearRanges = [46, 50, 54, 58, 62];
  const blasterDamages = [15, 22, 30, 42, 56];
  const blasterCooldowns = [0.29, 0.25, 0.21, 0.17, 0.145];
  const hammerDamages = [34, 46, 62, 82, 108];
  const hammerRanges = [36, 40, 44, 48, 52];
  const maxHps = [100, 140, 185, 245, 320];
  const stimCharges = [2, 3, 4, 5];
  const stimHeals = [40, 55, 75, 100];
  const roomClearHeals = [0, 12, 24, 38];
  const energyRegenMults = [1.0, 1.25, 1.5, 1.8];
  const tipBonuses = [0, 0.1, 0.2];
  const scannerBonuses = [0, 0.08, 0.16];
  const pedestalCounts = [4, 6, 8];
  const chestCaps = [28, 36, 48];
  const critChances = [0, 0.14, 0.24, 0.36];
  const moveMults = [1.0, 1.1, 1.18, 1.26];
  const dashCdMults = [1.0, 0.86, 0.74, 0.64];
  const luckBonuses = [0, 0.18, 0.36, 0.56];

  const tier = upgrades.shopTier ?? 0;
  const aura = upgrades.shopAura ?? 0;
  const scanner = upgrades.shopScanner ?? 0;
  const bio = upgrades.bioRegen ?? 0;
  const crit = upgrades.modCrit ?? 0;
  const thrust = upgrades.modThruster ?? 0;
  const luck = upgrades.modLuck ?? 0;

  return {
    bladeDamage: bladeDamages[upgrades.blade] ?? 20,
    bladeRange: bladeRanges[upgrades.blade] ?? 31,
    spearDamage: spearDamages[upgrades.spear ?? 0] ?? 22,
    spearRange: spearRanges[upgrades.spear ?? 0] ?? 46,
    blasterDamage: blasterDamages[upgrades.blaster] ?? 15,
    blasterCooldown: blasterCooldowns[upgrades.blaster] ?? 0.29,
    hammerDamage: hammerDamages[upgrades.hammer] ?? 34,
    hammerRange: hammerRanges[upgrades.hammer] ?? 36,
    maxHp: maxHps[upgrades.suit] ?? 100,
    maxStimCharges: stimCharges[upgrades.stimpack] ?? 2,
    stimHeal: stimHeals[upgrades.stimpack] ?? 40,
    roomClearHeal: roomClearHeals[bio] ?? 0,
    energyRegenMult: energyRegenMults[bio] ?? 1.0,
    critChance: critChances[crit] ?? 0,
    moveSpeedMult: moveMults[thrust] ?? 1.0,
    dashCooldownMult: dashCdMults[thrust] ?? 1.0,
    lootLuckBonus: luckBonuses[luck] ?? 0,
    shopTipBonus: (tipBonuses[aura] ?? 0) + (scannerBonuses[scanner] ?? 0),
    customerPatienceBonus: 1 + aura * 0.25 + scanner * 0.2,
    pedestalCount: pedestalCounts[tier] ?? 4,
    chestCapacity: chestCaps[tier] ?? 28,
    hasSaleBox: tier >= 1,
    maxCustomers: 3 + tier * 2 + aura,
  };
}
