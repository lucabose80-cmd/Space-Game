/**
 * Meilenstein 9 — Deterministisches Fundament (Seeds, Wochen-/Tages-IDs).
 * Keine Projekt-Imports: rein, synchron und in jeder Umgebung testbar.
 */

/** FNV-1a 32-bit — stabiler String-Hash für Seeds. */
export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Mulberry32 PRNG → Werte in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Führt fn mit deterministischem Math.random aus. Das Original wird IMMER
 * wiederhergestellt (try/finally) — fn muss synchron sein!
 */
export function withSeededRandom<T>(seed: string, fn: () => T): T {
  const original = Math.random;
  Math.random = mulberry32(hashString(seed));
  try {
    return fn();
  } finally {
    Math.random = original;
  }
}

/** UTC-Kalendertag, z. B. "2026-11-25". */
export function getUtcDayId(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** ISO-8601-Woche in UTC (Donnerstags-Regel, Woche beginnt Montag), z. B. "2026-W48". */
export function getIsoWeekId(now: Date = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dayNum = d.getUTCDay() || 7; // Mo=1 … So=7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum); // Donnerstag derselben Woche
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Montag 00:00 UTC der Folgewoche (ms-Timestamp) — für „Endet in x Tg. y Std.“. */
export function getWeekEndUtc(now: Date = new Date()): number {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + (8 - dayNum));
  return d.getTime();
}
