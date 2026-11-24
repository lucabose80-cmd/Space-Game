import type { CompanionId, MarketEventId, MusicTrack } from '../types';

export interface CompanionDef {
  id: CompanionId;
  name: string;
  shortName: string;
  role: string;
  abilitySummary: string;
  unlockRequirement: string;
  accentColor: string;
  iconUrl: string;
}

export const COMPANION_ORDER: CompanionId[] = ['puck', 'spark', 'luma', 'halo'];

export const COMPANION_DEFS: Record<CompanionId, CompanionDef> = {
  puck: {
    id: 'puck',
    name: 'Sammel-Bot „Puck“',
    shortName: 'PUCK',
    role: 'Magnet-Sammler',
    abilitySummary: '2,6× Loot-Magnet-Reichweite im Sektor & +25 % Chance auf 1 Bonus-Relikt bei Gegnern & Truhen!',
    unlockRequirement: 'Verkaufe 15 Items im Shop ODER baue Astro-Barter auf Stufe II aus.',
    accentColor: '#fbbf24',
    iconUrl: '/art/sprites/bot_puck.png',
  },
  spark: {
    id: 'spark',
    name: 'Kampf-Bot „Spark“',
    shortName: 'SPARK',
    role: 'Plasma-Schütze',
    abilitySummary: 'Feuert alle 1,35 Sek. automatisch Plasma-Bolzen auf den nächsten Gegner im Raum!',
    unlockRequirement: 'Besiege den Breacher-MK-I (Ebene I Boss) & insgesamt 30 Gegner.',
    accentColor: '#fb7185',
    iconUrl: '/art/sprites/bot_spark.png',
  },
  luma: {
    id: 'luma',
    name: 'Heil-Bot „Luma“',
    shortName: 'LUMA',
    role: 'Bio-Unterstützung',
    abilitySummary: 'Heilt +10 HP nach jedem 2. gesäuberten Kampfraum & +15 % passive Energie-Regeneration!',
    unlockRequirement: 'Besiege den Kern-Wächter MK-IV (Ebene II Boss).',
    accentColor: '#34d399',
    iconUrl: '/art/sprites/bot_luma.png',
  },
  halo: {
    id: 'halo',
    name: 'Aegis-Bot „Halo“',
    shortName: 'HALO',
    role: 'Schild-Wächter',
    abilitySummary: 'Lädt alle 12 Sek. einen goldenen Orbital-Schild auf, der 1 Treffer komplett abfängt!',
    unlockRequirement: 'Besiege den A.E.G.I.S. Leviathan (Sektor 1 komplett abgeschlossen).',
    accentColor: '#38bdf8',
    iconUrl: '/art/sprites/bot_halo.png',
  },
};

export interface CompanionProgressSnapshot {
  totalSold: number;
  shopTier: number;
  totalEnemiesDefeated: number;
  bossDefeatedCount: number;
  breacherDefeated: boolean;
  coreWatcherDefeated: boolean;
  deepestFloor: number;
  sector1Cleared: boolean;
}

export function evaluateCompanionUnlock(
  id: CompanionId,
  snap: CompanionProgressSnapshot,
): { unlocked: boolean; progressText: string; ratio: number } {
  if (id === 'puck') {
    const unlocked = snap.totalSold >= 15 || snap.shopTier >= 1;
    const ratio = unlocked ? 1 : Math.min(1, snap.totalSold / 15);
    return {
      unlocked,
      progressText: unlocked
        ? 'Freigeschaltet!'
        : `Verkäufe: ${Math.min(15, snap.totalSold)} / 15 (oder Shop Stufe II)`,
      ratio,
    };
  }

  if (id === 'spark') {
    const bossOk = snap.breacherDefeated || snap.bossDefeatedCount >= 1;
    const killsOk = snap.totalEnemiesDefeated >= 30;
    const unlocked = bossOk && killsOk;
    const ratio = (bossOk ? 0.5 : 0) + Math.min(0.5, (snap.totalEnemiesDefeated / 30) * 0.5);
    return {
      unlocked,
      progressText: unlocked
        ? 'Freigeschaltet!'
        : `Breacher: ${bossOk ? '✓' : '✗'} · Gegner: ${Math.min(30, snap.totalEnemiesDefeated)} / 30`,
      ratio,
    };
  }

  if (id === 'luma') {
    const unlocked = snap.coreWatcherDefeated || snap.deepestFloor >= 3 || snap.bossDefeatedCount >= 2;
    return {
      unlocked,
      progressText: unlocked ? 'Freigeschaltet!' : 'Kern-Wächter MK-IV (Ebene II Boss): 0 / 1',
      ratio: unlocked ? 1 : 0,
    };
  }

  // halo
  const unlocked = snap.sector1Cleared;
  return {
    unlocked,
    progressText: unlocked ? 'Freigeschaltet!' : 'A.E.G.I.S. Leviathan (Ebene III Boss): 0 / 1',
    ratio: unlocked ? 1 : 0,
  };
}

export const MARKET_EVENT_META: Record<
  MarketEventId,
  {
    name: string;
    shortBadge: string;
    description: string;
    color: string;
  }
> = {
  normal: {
    name: 'Ruhiger Handelstag',
    shortBadge: '',
    description: 'Normaler Kundenbetrieb auf Port Solaris.',
    color: '#94a3b8',
  },
  trade_fair: {
    name: 'Solaris Handelsmesse',
    shortBadge: 'MESSE +10%',
    description: 'Schnellerer Kundenstrom & +10 % höhere Zahlungsbereitschaft an allen Podesten!',
    color: '#fbbf24',
  },
  collector_visit: {
    name: 'VIP-Sammler-Besuch',
    shortBadge: 'VIP-TAG +40%',
    description: 'Goldene VIP-Sammler besuchen Astro-Barter und zahlen +40 % Bonus für seltene & epische Relikte!',
    color: '#f59e0b',
  },
  night_rush: {
    name: 'Schmuggler-Ansturm',
    shortBadge: 'HOCHBETRIEB',
    description: 'Besonders reger Betrieb — aber achte auf flinke Space-Diebe!',
    color: '#c084fc',
  },
};

export const MUSIC_TRACK_META: Record<
  MusicTrack,
  {
    title: string;
    subtitle: string;
    accent: string;
  }
> = {
  shop_day: {
    title: 'Solaris Morgen-Basar',
    subtitle: 'Warme, gemütliche Laden-Melodie (Tag)',
    accent: '#fbbf24',
  },
  shop_night: {
    title: 'Sternenlicht-Laden',
    subtitle: 'Ruhige Lo-Fi Synth-Ballade (Nacht & Quartier)',
    accent: '#818cf8',
  },
  hub: {
    title: 'Promenade von Port Solaris',
    subtitle: 'Lebendige Frontier-Marktplatz-Arpeggios',
    accent: '#38e8d4',
  },
  dungeon: {
    title: 'Wrack-Sektor Echoes',
    subtitle: 'Atmosphärischer Retro-Sci-Fi Dungeon-Puls (Sektor 1)',
    accent: '#38bdf8',
  },
  dungeon_s2: {
    title: 'Kristall-Nebel Resonanz',
    subtitle: 'Schimmernde Äther-Arpeggios (Sektor 2)',
    accent: '#c084fc',
  },
  boss: {
    title: 'A.E.G.I.S. Alarmprotokoll',
    subtitle: 'Treibendes Boss-Battle Chiptune-Theme',
    accent: '#f43f5e',
  },
};
