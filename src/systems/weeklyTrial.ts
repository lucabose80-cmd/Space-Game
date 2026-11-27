import { BOSS_EXPECTED, ENDBOSS_ARENA_LIVE, WEAPON_AVG_COOLDOWN } from '../data/balance';
import { getPlayerCombatStats } from '../data/upgrades';
/**
 * Meilenstein 9 — Wöchentliche „Galaktische Prüfung“ (reine Logik, keine UI/DOM).
 * Rotation, normierte Ausrüstung, Wertung & Abzeichen. Niedriger Score = besser.
 */
import { RIFT_MUTATOR_LIST } from '../data/infusions';
import type {
  TrialBadge,
  UpgradeLevels,
  WeeklyTrialInfo,
  WeeklyTrialRecord,
} from '../types';
import { getIsoWeekId, getWeekEndUtc, hashString } from './seededRng';

export type { WeeklyTrialInfo } from '../types';

/** Normierte Kampf-Stufen (MK-V = Index 4). Shop-/Aura-Upgrades bleiben unberührt. */
export const TRIAL_COMBAT_LEVELS: Pick<
  UpgradeLevels,
  | 'blade'
  | 'blaster'
  | 'hammer'
  | 'spear'
  | 'fists'
  | 'discus'
  | 'suit'
  | 'stimpack'
  | 'bioRegen'
  | 'modCrit'
  | 'modThruster'
  | 'modLuck'
> = {
  blade: 4,
  blaster: 4,
  hammer: 4,
  spear: 4,
  fists: 4,
  discus: 4,
  suit: 4,
  stimpack: 2,
  bioRegen: 1,
  modCrit: 1,
  modThruster: 1,
  modLuck: 0,
};

/**
 * M10-C: neu kalibriert. Die Prüfung normiert Waffen auf Stufe 4; die Boss-HP werden dafür auf dieselbe
 * Kampfdauer-Zielwerte wie im Normalspiel skaliert (siehe `trialBossHpFactor`). Boss-Zeit ≈ +180 s je Sektor
 * gegenüber M9 (vorher 5–16 s Schadenszeit), daher +180 s auf alle Par-Zeiten.
 */
export const TRIAL_PAR_TIMES: Record<1 | 2 | 3 | 4, { gold: number; silver: number }> = {
  1: { gold: 600, silver: 840 },
  2: { gold: 660, silver: 900 },
  3: { gold: 720, silver: 960 },
  4: { gold: 780, silver: 1020 },
};

export const TRIAL_BADGE_META: Record<TrialBadge, { icon: string; label: string; color: string }> = {
  gold: { icon: '🥇', label: 'Gold', color: '#fde047' },
  silver: { icon: '🥈', label: 'Silber', color: '#e2e8f0' },
  bronze: { icon: '🥉', label: 'Bronze', color: '#fb923c' },
};

export const TRIAL_SECTOR_NAMES: Record<1 | 2 | 3 | 4, string> = {
  1: 'Verlassene Korvette',
  2: 'Kristall-Nebel',
  3: 'Solar-Gießerei',
  4: 'Ältesten-Monolith',
};

export const TRIAL_FLOORS = 3;

/**
 * Meilenstein 10-A: Sektor-Raum-Mechaniken erscheinen in der Wochen-Prüfung erst AB dieser ISO-Woche,
 * damit sich eine laufende Wertungswoche nicht mitten in der Woche ändert (= die Woche NACH dem Merge).
 * Als String-Literal fest eingetragen (Format YYYY-Www, lexikografisch vergleichbar).
 */
export const TRIAL_MECHANICS_FROM_WEEK = '2026-W49';

export function trialHasMechanics(weekId: string): boolean {
  return weekId >= TRIAL_MECHANICS_FROM_WEEK;
}

/**
 * M12 Phase D: Endboss-Arenen in der Wochen-Prüfung erst AB dieser ISO-Woche (= Woche nach dem Live-Schalten),
 * damit eine laufende Wertungswoche nicht kippt. Beim Setzen von `ENDBOSS_ARENA_LIVE = true` auf die Folgewoche
 * des Deploys anpassen. Zusätzlich muss die Arena live sein (`ENDBOSS_ARENA_LIVE`).
 */
export const TRIAL_ARENA_FROM_WEEK = '2026-W49';

export function trialHasArena(weekId: string): boolean {
  return ENDBOSS_ARENA_LIVE && weekId >= TRIAL_ARENA_FROM_WEEK;
}
export const TRIAL_MAX_TIME_SEC = 10800;
const BADGE_HISTORY_MAX = 52;
const BADGE_RANK: Record<TrialBadge, number> = { bronze: 1, silver: 2, gold: 3 };

export function getCurrentWeeklyTrial(now: Date = new Date()): WeeklyTrialInfo {
  const weekId = getIsoWeekId(now);
  const sector = ((hashString('trial-sector:' + weekId) % 4) + 1) as 1 | 2 | 3 | 4;
  const mutator = RIFT_MUTATOR_LIST[hashString('trial-mut:' + weekId) % RIFT_MUTATOR_LIST.length];
  return { weekId, sector, mutator, endsAtUtc: getWeekEndUtc(now) };
}

export function getTrialFloorSeed(weekId: string, floor: number): string {
  return `starlighter-trial:${weekId}:F${floor}`;
}

/** Kurzform „KW 48“ aus „2026-W48“. */
export function formatWeekLabel(weekId: string): string {
  const m = /W(\d{2})$/.exec(weekId);
  return m ? `KW ${Number(m[1])}` : weekId;
}

/** „3 Tg. 4 Std.“ bis zum Wochenende (UTC). */
export function formatTrialRemaining(endsAtUtc: number, now: number = Date.now()): string {
  const ms = Math.max(0, endsAtUtc - now);
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  if (days > 0) return `${days} Tg. ${hours} Std.`;
  const mins = Math.floor((ms % 3600000) / 60000);
  return `${hours} Std. ${mins} Min.`;
}

/** Niedriger = besser. Abgeschlossene Läufe liegen immer vor unvollständigen. */
export function computeTrialScore(r: {
  completed: boolean;
  timeSec: number;
  floorReached: number;
  roomsCleared: number;
}): number {
  return r.completed
    ? Math.max(1, Math.round(r.timeSec))
    : 1_000_000 - (Math.max(0, r.floorReached) * 1000 + Math.min(999, Math.max(0, r.roomsCleared)));
}

export function getTrialBadge(
  sector: 1 | 2 | 3 | 4,
  completed: boolean,
  timeSec: number,
): TrialBadge | null {
  if (!completed) return null;
  const par = TRIAL_PAR_TIMES[sector] ?? TRIAL_PAR_TIMES[1];
  if (timeSec < par.gold) return 'gold';
  if (timeSec < par.silver) return 'silver';
  return 'bronze';
}

export function isBetterBadge(a: TrialBadge | null, b: TrialBadge | null): boolean {
  return (a ? BADGE_RANK[a] : 0) > (b ? BADGE_RANK[b] : 0);
}

export function isTrialBadge(v: unknown): v is TrialBadge {
  return v === 'gold' || v === 'silver' || v === 'bronze';
}

export function sanitizeTrialRecord(raw: unknown): WeeklyTrialRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<WeeklyTrialRecord>;
  if (typeof r.weekId !== 'string' || !/^\d{4}-W\d{2}$/.test(r.weekId)) return null;
  const sector = Number(r.sector);
  if (![1, 2, 3, 4].includes(sector)) return null;
  const completed = Boolean(r.completed);
  const bestTime =
    typeof r.bestTimeSec === 'number' && Number.isFinite(r.bestTimeSec) && r.bestTimeSec > 0
      ? Math.min(TRIAL_MAX_TIME_SEC, Math.round(r.bestTimeSec))
      : null;
  const floor = Math.max(0, Math.min(TRIAL_FLOORS, Math.floor(Number(r.bestFloorReached) || 0)));
  const rooms = Math.max(0, Math.min(999, Math.floor(Number(r.bestRoomsCleared) || 0)));
  const score =
    typeof r.bestScore === 'number' && Number.isFinite(r.bestScore)
      ? r.bestScore
      : computeTrialScore({ completed, timeSec: bestTime ?? TRIAL_MAX_TIME_SEC, floorReached: floor, roomsCleared: rooms });
  return {
    weekId: r.weekId,
    sector: sector as 1 | 2 | 3 | 4,
    attempts: Math.max(0, Math.floor(Number(r.attempts) || 0)),
    completed,
    bestTimeSec: bestTime,
    bestFloorReached: floor,
    bestRoomsCleared: rooms,
    bestScore: score,
    badge: isTrialBadge(r.badge) ? r.badge : null,
    uploaded: Boolean(r.uploaded),
  };
}

export function sanitizeBadgeHistory(raw: unknown): Record<string, TrialBadge> {
  const out: Record<string, TrialBadge> = {};
  if (!raw || typeof raw !== 'object') return out;
  const keys = Object.keys(raw as Record<string, unknown>)
    .filter((k) => /^\d{4}-W\d{2}$/.test(k))
    .sort();
  for (const k of keys.slice(-BADGE_HISTORY_MAX)) {
    const v = (raw as Record<string, unknown>)[k];
    if (isTrialBadge(v)) out[k] = v;
  }
  return out;
}

export function trimBadgeHistory(h: Record<string, TrialBadge>): Record<string, TrialBadge> {
  return sanitizeBadgeHistory(h);
}

export function countBadges(h: Record<string, TrialBadge>): { gold: number; silver: number; bronze: number } {
  const c = { gold: 0, silver: 0, bronze: 0 };
  for (const b of Object.values(h)) if (isTrialBadge(b)) c[b] += 1;
  return c;
}


// ---------------- M10-C: Boss-HP in der Prüfung ----------------
const TRIAL_ALL_WEAPONS = ['blade', 'spear', 'fists', 'discus', 'blaster', 'hammer'] as const;

/** Durchschnittliche Schadens-pro-Sekunde-Schätzung aller Waffen auf einer Stufe (Basis der Boss-Kalibrierung). */
export function averageWeaponDps(level: number): number {
  const zero = { blade: 0, spear: 0, fists: 0, discus: 0, blaster: 0, hammer: 0, suit: 0, stimpack: 0, bioRegen: 0, shopTier: 0, shopAura: 0, shopScanner: 0, shopAssistant: 0, modCrit: 0, modThruster: 0, modLuck: 0 };
  let sum = 0;
  for (const w of TRIAL_ALL_WEAPONS) {
    const stats = getPlayerCombatStats({ ...zero, [w]: level });
    const dmg = stats[`${w}Damage` as keyof typeof stats] as number;
    sum += dmg / (w === 'blaster' ? stats.blasterCooldown : WEAPON_AVG_COOLDOWN[w]);
  }
  return sum / TRIAL_ALL_WEAPONS.length;
}

/** Faktor auf die Boss-HP in der Prüfung: gleiche Kampfdauer wie im Normalspiel trotz normierter Stufe-4-Ausrüstung. */
export function trialBossHpFactor(kind: string): number {
  const ex = (BOSS_EXPECTED as Record<string, { level: number } | undefined>)[kind];
  if (!ex) return 1;
  return averageWeaponDps(TRIAL_COMBAT_LEVELS.blade) / averageWeaponDps(ex.level);
}
