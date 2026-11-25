import { getItemDef, ITEMS } from '../data/items';
import { getMarketTrendMultiplier } from '../data/marketTrends';
import type { CodexEntry, DemandLevel, PriceReaction } from '../types';

export function createInitialCodex(): Record<string, CodexEntry> {
  const codex: Record<string, CodexEntry> = {};
  for (const item of ITEMS) {
    codex[item.id] = {
      itemId: item.id,
      discovered: false,
      timesSold: 0,
      demandScore: 0,
      maxCheapPrice: null,
      minFairPrice: null,
      maxFairPrice: null,
      minExpensivePrice: null,
      minOutrageousPrice: null,
      lastSetPrice: null,
    };
  }
  return codex;
}

export function getDemandLevel(entry: CodexEntry): DemandLevel {
  if (entry.demandScore >= 2) return 'high';
  if (entry.demandScore <= -2) return 'low';
  return 'normal';
}

export function getDemandMultiplier(level: DemandLevel): number {
  if (level === 'high') return 1.15;
  if (level === 'low') return 0.85;
  return 1.0;
}

export function getDemandLabel(level: DemandLevel): { text: string; color: string; arrow: string } {
  if (level === 'high') return { text: 'Hohe Nachfrage (+15 %)', color: '#34d399', arrow: '▲' };
  if (level === 'low') return { text: 'Gesättigt (-15 %)', color: '#fb923c', arrow: '▼' };
  return { text: 'Normale Nachfrage', color: '#94a3b8', arrow: '●' };
}

/**
 * Computes the effective market value for an item right now, factoring in
 * current demand and the 'smuggler' (+15%) relic modifier.
 */
export function getEffectiveFairPrice(itemId: string, entry: CodexEntry): number {
  const def = getItemDef(itemId);
  const demandMult = getDemandMultiplier(getDemandLevel(entry));
  const smugglerMult = def.modifier === 'smuggler' ? 1.15 : 1.0;
  // Milestone 9: Globale Markt-Konjunktur (weltweiter Tages-Trend, offline-deterministisch)
  const trendMult = getMarketTrendMultiplier(itemId);
  return Math.round(def.baseValue * demandMult * smugglerMult * trendMult);
}

/**
 * Evaluates a customer's Moonlighter-style reaction to an asking price.
 * Returns reaction + whether the customer wants to buy the item.
 */
export function evaluatePrice(
  itemId: string,
  askingPrice: number,
  entry: CodexEntry,
): { reaction: PriceReaction; willBuy: boolean; fairPrice: number } {
  const fairPrice = getEffectiveFairPrice(itemId, entry);
  const ratio = askingPrice / Math.max(1, fairPrice);

  if (ratio <= 0.78) {
    return { reaction: 'cheap', willBuy: true, fairPrice };
  }
  if (ratio <= 1.12) {
    return { reaction: 'fair', willBuy: true, fairPrice };
  }
  if (ratio <= 1.38) {
    return { reaction: 'expensive', willBuy: false, fairPrice };
  }
  return { reaction: 'outrageous', willBuy: false, fairPrice };
}

/**
 * Records a customer's reaction into the Scan-Codex and updates demand.
 */
export function recordPriceReaction(
  entry: CodexEntry,
  price: number,
  reaction: PriceReaction,
  sold: boolean,
): void {
  entry.discovered = true;
  if (reaction === 'cheap') {
    entry.maxCheapPrice =
      entry.maxCheapPrice === null ? price : Math.max(entry.maxCheapPrice, price);
    entry.demandScore = Math.min(3, entry.demandScore + 1);
  } else if (reaction === 'fair') {
    entry.minFairPrice =
      entry.minFairPrice === null ? price : Math.min(entry.minFairPrice, price);
    entry.maxFairPrice =
      entry.maxFairPrice === null ? price : Math.max(entry.maxFairPrice, price);
  } else if (reaction === 'expensive') {
    entry.minExpensivePrice =
      entry.minExpensivePrice === null ? price : Math.min(entry.minExpensivePrice, price);
    entry.demandScore = Math.max(-3, entry.demandScore - 1);
  } else {
    entry.minOutrageousPrice =
      entry.minOutrageousPrice === null ? price : Math.min(entry.minOutrageousPrice, price);
    entry.demandScore = Math.max(-3, entry.demandScore - 1);
  }

  if (sold) {
    entry.timesSold += 1;
    // Selling lots of an item gradually cools demand toward oversupply
    if (entry.timesSold % 3 === 0) {
      entry.demandScore = Math.max(-3, entry.demandScore - 1);
    }
  }
}

/**
 * Recover demand slightly at the start of each new day (fresh station visitors!).
 */
export function decayDemandForNewDay(codex: Record<string, CodexEntry>): void {
  for (const entry of Object.values(codex)) {
    if (entry.demandScore < 0) entry.demandScore += 1;
    else if (entry.demandScore > 1) entry.demandScore -= 1;
  }
}

export function getSuggestedStartPrice(itemId: string, entry?: CodexEntry): number {
  if (entry?.lastSetPrice !== null && entry?.lastSetPrice !== undefined) return entry.lastSetPrice;
  if (entry?.maxFairPrice !== null && entry?.maxFairPrice !== undefined) return entry.maxFairPrice;
  if (entry?.minFairPrice !== null && entry?.minFairPrice !== undefined) return entry.minFairPrice;
  // Slightly rounded guess so player still gets the fun of discovering exact sweet spot
  const def = getItemDef(itemId);
  return Math.max(10, Math.round((def.baseValue * 0.9 * getMarketTrendMultiplier(itemId)) / 5) * 5);
}

/**
 * Returns the best known Scan-Codex price for [F] Quick-Refill on pedestals:
 * prefers maxFairPrice, then lastSetPrice, then minFairPrice, else suggested price.
 */
export function getOptimalCodexPrice(itemId: string, entry?: CodexEntry): number {
  if (entry?.maxFairPrice !== null && entry?.maxFairPrice !== undefined) return entry.maxFairPrice;
  if (entry?.lastSetPrice !== null && entry?.lastSetPrice !== undefined) return entry.lastSetPrice;
  if (entry?.minFairPrice !== null && entry?.minFairPrice !== undefined) return entry.minFairPrice;
  return getSuggestedStartPrice(itemId, entry);
}

export function getReactionMeta(reaction: PriceReaction): {
  label: string;
  symbol: string;
  color: string;
} {
  switch (reaction) {
    case 'cheap':
      return { label: 'Spottbillig', symbol: '★', color: '#38e8d4' };
    case 'fair':
      return { label: 'Perfekt!', symbol: '✓', color: '#4ade80' };
    case 'expensive':
      return { label: 'Zu teuer', symbol: '?', color: '#fb923c' };
    case 'outrageous':
      return { label: 'Wucher!', symbol: '!', color: '#f87171' };
  }
}
