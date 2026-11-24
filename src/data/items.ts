import type { ItemDef, Rarity } from '../types';

export const RARITY_META: Record<
  Rarity,
  { label: string; color: string; bg: string; border: string }
> = {
  common: {
    label: 'Gewöhnlich',
    color: '#cbd5e1',
    bg: 'rgba(148, 163, 184, 0.14)',
    border: '#64748b',
  },
  uncommon: {
    label: 'Ungewöhnlich',
    color: '#34d399',
    bg: 'rgba(52, 211, 153, 0.14)',
    border: '#10b981',
  },
  rare: {
    label: 'Selten',
    color: '#38bdf8',
    bg: 'rgba(56, 189, 248, 0.15)',
    border: '#0284c7',
  },
  epic: {
    label: 'Episch',
    color: '#fbbf24',
    bg: 'rgba(251, 191, 36, 0.16)',
    border: '#d97706',
  },
};

export const ITEMS: ItemDef[] = [
  {
    id: 'scrap_coil',
    name: 'Kupfer-Spule',
    rarity: 'common',
    baseValue: 30,
    maxStack: 5,
    modifier: 'none',
    description: 'Sauber gewickelte Induktionsspule aus den Hilfsaggregaten einer Korvette.',
    glowColor: '#f59e0b',
    dropWeight: 26,
    minDepth: 0,
  },
  {
    id: 'bio_gel',
    name: 'Biolum-Gel',
    rarity: 'common',
    baseValue: 45,
    maxStack: 5,
    modifier: 'none',
    description: 'Leuchtende organische Essenz von Void-Slimes. Beliebt bei Stations-Botanikern.',
    glowColor: '#2dd4bf',
    dropWeight: 24,
    minDepth: 0,
  },
  {
    id: 'nav_chip',
    name: 'Alter Nav-Chip',
    rarity: 'common',
    baseValue: 65,
    maxStack: 5,
    modifier: 'none',
    description: 'Enthält verschlüsselte Sternenkarten längst vergessener Handelsrouten.',
    glowColor: '#38bdf8',
    dropWeight: 20,
    minDepth: 0,
  },
  {
    id: 'plasma_cell',
    name: 'Plasma-Zelle',
    rarity: 'uncommon',
    baseValue: 110,
    maxStack: 5,
    modifier: 'none',
    description: 'Kompakte Energiekapsel mit warm glühendem Plasma-Kern.',
    glowColor: '#22d3ee',
    dropWeight: 16,
    minDepth: 0,
  },
  {
    id: 'alien_prism',
    name: 'Äther-Kristall',
    rarity: 'uncommon',
    baseValue: 145,
    maxStack: 5,
    modifier: 'none',
    description: 'Bricht das Licht in warmen Türkis-Tönen. Sammler zahlen gerne dafür.',
    glowColor: '#38e8d4',
    dropWeight: 14,
    minDepth: 1,
  },
  {
    id: 'drone_core',
    name: 'Drohnen-Kern',
    rarity: 'uncommon',
    baseValue: 180,
    maxStack: 5,
    modifier: 'none',
    description: 'Intakte KI-Steuereinheit einer Sicherheitsdrohne. Ideal für Waffen-Upgrades.',
    glowColor: '#60a5fa',
    dropWeight: 13,
    minDepth: 1,
  },
  {
    id: 'star_compass',
    name: 'Sternen-Kompass',
    rarity: 'rare',
    baseValue: 260,
    maxStack: 5,
    modifier: 'none',
    description: 'Antikes Messing-Holoinstrument, das stets Richtung nächster Raum-Anomalie zeigt.',
    glowColor: '#fbbf24',
    dropWeight: 8,
    minDepth: 1,
  },
  {
    id: 'cryo_amber',
    name: 'Kryo-Bernstein',
    rarity: 'rare',
    baseValue: 330,
    maxStack: 5,
    modifier: 'fragile',
    modifierLabel: 'Zerbrechlich: Hoher Wert, zerbricht jedoch bei Tod im Wrack!',
    description: 'Tiefgefrorenes Sternenharz von enormem Wert, doch extrem stoßempfindlich.',
    glowColor: '#fb923c',
    dropWeight: 7,
    minDepth: 1,
  },
  {
    id: 'quantum_gyro',
    name: 'Quanten-Gyroskop',
    rarity: 'rare',
    baseValue: 390,
    maxStack: 5,
    modifier: 'warp_anchor',
    modifierLabel: 'Warp-Anker (→): Rettet den RECHTEN Nachbar-Slot sogar bei Tod in die Truhe!',
    description: 'Schwebende Ringe stabilisieren ein Miniatur-Wurmloch im Frachtraum.',
    glowColor: '#34d399',
    dropWeight: 7,
    minDepth: 1,
  },
  {
    id: 'mimic_cube',
    name: 'Klon-Würfel',
    rarity: 'rare',
    baseValue: 225,
    maxStack: 5,
    modifier: 'mirror_clone',
    modifierLabel: 'Klon-Matrix (↑): Dupliziert bei Extraktion +1 Stück des Relikts ÜBER sich!',
    description: 'Holografischer Materie-Duplikator — im richtigen Slot ein echter Goldesel.',
    glowColor: '#38e8d4',
    dropWeight: 7,
    minDepth: 1,
  },
  {
    id: 'phase_shard',
    name: 'Phasen-Splitter',
    rarity: 'rare',
    baseValue: 275,
    maxStack: 5,
    modifier: 'row_curse',
    modifierLabel: 'Phasen-Fluch (▲): Nur in der OBERSTEN Rucksack-Reihe stabil — sonst Verlust!',
    description: 'Instabiler Dimensionskristall, der im unteren Frachtraum zerfällt.',
    glowColor: '#c084fc',
    dropWeight: 7,
    minDepth: 1,
  },
  {
    id: 'nova_core',
    name: 'Nova-Kondensator',
    rarity: 'epic',
    baseValue: 410,
    maxStack: 5,
    modifier: 'volatile_boost',
    modifierLabel: 'Resonanz (←): Opfert bei Extraktion 1 Item LINKS daneben für +180 Cr Bonus!',
    description: 'Eingekapselte Miniatur-Sonne, die benachbarten Schrott in reine Energie wandelt.',
    glowColor: '#fbbf24',
    dropWeight: 5,
    minDepth: 2,
  },
  {
    id: 'void_relic',
    name: 'Void-Relikt',
    rarity: 'epic',
    baseValue: 560,
    maxStack: 5,
    modifier: 'none',
    description: 'Uraltes Artefakt einer unbekannten Raumfahrer-Zivilisation.',
    glowColor: '#f472b6',
    dropWeight: 4,
    minDepth: 2,
  },
  {
    id: 'chrono_lens',
    name: 'Chrono-Linse',
    rarity: 'epic',
    baseValue: 680,
    maxStack: 5,
    modifier: 'smuggler',
    modifierLabel: 'Schmuggler-Bonus: +15 % höherer Marktwert im Shop!',
    description: 'Schimmernde Linse, in der sich Sekundenbruchteile der Vergangenheit spiegeln.',
    glowColor: '#fde047',
    dropWeight: 3,
    minDepth: 2,
  },
  {
    id: 'mk4_heart',
    name: 'MK-IV Reaktor-Kern',
    rarity: 'epic',
    baseValue: 960,
    maxStack: 5,
    modifier: 'none',
    description: 'Das pulsierende Herz des Core-Wächters MK-IV. Das Kronjuwel jedes Händlers.',
    glowColor: '#fb923c',
    dropWeight: 0,
    minDepth: 3,
  },
];

export const ITEMS_BY_ID: Record<string, ItemDef> = Object.fromEntries(
  ITEMS.map((item) => [item.id, item]),
);

export function getItemDef(itemId: string): ItemDef {
  const def = ITEMS_BY_ID[itemId];
  if (!def) {
    throw new Error(`Unknown itemId: ${itemId}`);
  }
  return def;
}

export function rollLootItem(depth: number, guaranteedRare = false, nightBoost = false): string {
  const pool = ITEMS.filter((item) => {
    if (item.dropWeight <= 0) return false;
    if (guaranteedRare) return item.rarity === 'rare' || item.rarity === 'epic';
    return item.minDepth <= depth;
  });
  const getW = (item: ItemDef) => {
    if (!nightBoost) return item.dropWeight;
    return item.rarity === 'rare' || item.rarity === 'epic'
      ? item.dropWeight * 1.35
      : item.dropWeight;
  };
  const totalWeight = pool.reduce((sum, item) => sum + getW(item), 0);
  let r = Math.random() * totalWeight;
  for (const item of pool) {
    r -= getW(item);
    if (r <= 0) return item.id;
  }
  return pool[0]?.id ?? 'scrap_coil';
}
