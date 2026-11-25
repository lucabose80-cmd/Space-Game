/**
 * Meilenstein 9 — Globale Markt-Konjunktur.
 * Deterministischer, weltweit identischer Tages-Trend (UTC-Kalendertag) — komplett offline.
 */
import { getUtcDayId, hashString } from '../systems/seededRng';
import type { ItemDef } from '../types';
import { getItemDef } from './items';

export type MarketTrendId =
  | 'calm'
  | 'corvette_nostalgia'
  | 'crystal_boom'
  | 'foundry_surge'
  | 'elder_fever'
  | 'rift_rush'
  | 'collector_season'
  | 'scrap_glut';

export interface MarketTrendDef {
  id: MarketTrendId;
  icon: string;
  name: string;
  description: string;
  accent: string;
  multiplierFor: (item: ItemDef) => number;
}

const sectorOf = (i: ItemDef): number => i.sector ?? 1;

export const MARKET_TRENDS: Record<MarketTrendId, MarketTrendDef> = {
  calm: {
    id: 'calm',
    icon: '🌙',
    name: 'Ruhiger Markt',
    description: 'Keine Ausschläge — alle Relikte zum Normalpreis.',
    accent: '#94a3b8',
    multiplierFor: () => 1,
  },
  corvette_nostalgia: {
    id: 'corvette_nostalgia',
    icon: '🛰',
    name: 'Korvetten-Nostalgie',
    description: 'Sektor-1-Relikte +25 %',
    accent: '#fde047',
    multiplierFor: (i) => (sectorOf(i) === 1 ? 1.25 : 1),
  },
  crystal_boom: {
    id: 'crystal_boom',
    icon: '💎',
    name: 'Kristall-Boom',
    description: 'Sektor-2-Relikte +25 %',
    accent: '#e879f9',
    multiplierFor: (i) => (sectorOf(i) === 2 ? 1.25 : 1),
  },
  foundry_surge: {
    id: 'foundry_surge',
    icon: '🔥',
    name: 'Gießerei-Hochkonjunktur',
    description: 'Sektor-3-Relikte +25 %',
    accent: '#fb923c',
    multiplierFor: (i) => (sectorOf(i) === 3 ? 1.25 : 1),
  },
  elder_fever: {
    id: 'elder_fever',
    icon: '👑',
    name: 'Ältesten-Fieber',
    description: 'Sektor-4-Relikte +25 %',
    accent: '#38e8d4',
    multiplierFor: (i) => (sectorOf(i) === 4 ? 1.25 : 1),
  },
  rift_rush: {
    id: 'rift_rush',
    icon: '🌀',
    name: 'Rift-Rausch',
    description: 'Rift- & Omega-Relikte +30 %',
    accent: '#c084fc',
    multiplierFor: (i) => (sectorOf(i) === 5 ? 1.3 : 1),
  },
  collector_season: {
    id: 'collector_season',
    icon: '★',
    name: 'Sammler-Saison',
    description: 'Epische Relikte +20 %',
    accent: '#fbbf24',
    multiplierFor: (i) => (i.rarity === 'epic' ? 1.2 : 1),
  },
  scrap_glut: {
    id: 'scrap_glut',
    icon: '⚙',
    name: 'Schrott-Schwemme',
    description: 'Gewöhnliche Relikte −15 %, seltene +10 %',
    accent: '#f87171',
    multiplierFor: (i) => (i.rarity === 'common' ? 0.85 : i.rarity === 'rare' ? 1.1 : 1),
  },
};

export const MARKET_TREND_ORDER: MarketTrendId[] = [
  'calm',
  'corvette_nostalgia',
  'crystal_boom',
  'foundry_surge',
  'elder_fever',
  'rift_rush',
  'collector_season',
  'scrap_glut',
];

const trendByDay = new Map<string, MarketTrendDef>();
let testOverride: MarketTrendId | null = null;

/** Nur für Tests: erzwingt einen Trend (null = aus). */
export function setMarketTrendOverrideForTest(id: MarketTrendId | null): void {
  testOverride = id;
}

export function getTrendForDay(dayId: string): MarketTrendDef {
  let t = trendByDay.get(dayId);
  if (!t) {
    t = MARKET_TRENDS[MARKET_TREND_ORDER[hashString('starlighter-trend:' + dayId) % MARKET_TREND_ORDER.length]];
    trendByDay.set(dayId, t);
  }
  return t;
}

export function getTodayMarketTrend(now: Date = new Date()): MarketTrendDef {
  if (testOverride) return MARKET_TRENDS[testOverride];
  return getTrendForDay(getUtcDayId(now));
}

/** Multiplikator (>1 Boom, <1 Flaute) für ein Item im heutigen Trend. */
export function getMarketTrendMultiplier(itemId: string, now: Date = new Date()): number {
  return getTodayMarketTrend(now).multiplierFor(getItemDef(itemId));
}

/** „+25 %“ / „−15 %“ oder null, wenn das Item nicht betroffen ist. */
export function getMarketTrendPctLabel(itemId: string, now: Date = new Date()): string | null {
  const m = getMarketTrendMultiplier(itemId, now);
  if (Math.abs(m - 1) < 0.001) return null;
  const pct = Math.round((m - 1) * 100);
  return pct > 0 ? `+${pct} %` : `−${Math.abs(pct)} %`;
}
