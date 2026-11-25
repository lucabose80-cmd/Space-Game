/**
 * Meilenstein 9 — Galaktisches Netzwerk (Fassade über firebaseService).
 * - Geister-Kapitäne: gecachter Pool echter Spieler aus `leaderboard` (nur lesend, fire-and-forget).
 * - (Phase 4c) Wöchentliche Prüfung: Upload & Wochen-Rangliste.
 * Alles ist offline-/gast-sicher: ohne Firebase/Netz bleibt der Pool einfach leer.
 */
import { GHOST_GREETING_PRESETS, sanitizeGreeting } from '../data/ghostGreetings';
import type { LeaderboardEntry, SuitThemeId } from '../types';
import { firebaseService } from './firebaseService';

export interface GhostCaptain {
  uid: string;
  name: string;
  suitTheme: SuitThemeId;
  greeting: string;
  ngPlusLevel: number;
}

const GHOST_CACHE_MS = 10 * 60 * 1000;
const GHOST_MAX_AGE_MS = 30 * 24 * 3600 * 1000;
const VALID_SUITS: SuitThemeId[] = ['classic', 'crystal', 'solar', 'elder', 'omega'];

function cleanName(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw
    .replace(/[^\p{L}\p{N}\p{P}\p{Zs}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 22);
}

export function toGhostCaptain(e: LeaderboardEntry): GhostCaptain | null {
  const name = cleanName(e.captainName);
  if (!e.uid || !name) return null;
  const greeting =
    sanitizeGreeting(e.ghostGreeting) ||
    GHOST_GREETING_PRESETS[Math.floor(Math.random() * GHOST_GREETING_PRESETS.length)];
  return {
    uid: e.uid,
    name,
    suitTheme: VALID_SUITS.includes(e.suitTheme) ? e.suitTheme : 'classic',
    greeting,
    ngPlusLevel: Math.max(0, Math.floor(e.ngPlusLevel ?? 0)),
  };
}

class GalacticNetwork {
  private ghostPool: GhostCaptain[] = [];
  private ghostFetchedAt = 0;
  private ghostFetching = false;
  private testOverride: GhostCaptain[] | null = null;

  /** Lädt max. 30 Leaderboard-Einträge, höchstens alle 10 Min. Fire-and-forget, wirft nie. */
  public prefetchGhostCaptains(): void {
    if (this.testOverride || this.ghostFetching) return;
    if (!firebaseService.isConfigured()) return;
    if (Date.now() - this.ghostFetchedAt < GHOST_CACHE_MS) return;
    this.ghostFetching = true;
    this.ghostFetchedAt = Date.now();
    void firebaseService
      .fetchLeaderboard(30)
      .then((rows) => {
        const now = Date.now();
        const pool: GhostCaptain[] = [];
        for (const row of rows) {
          if (!row || typeof row.updatedAt !== 'number' || now - row.updatedAt > GHOST_MAX_AGE_MS) continue;
          const g = toGhostCaptain(row);
          if (g) pool.push(g);
        }
        this.ghostPool = pool;
      })
      .catch(() => {
        // Offline: Pool bleibt wie er ist
      })
      .finally(() => {
        this.ghostFetching = false;
      });
  }

  /** Synchron: zufälliger Geist (nicht man selbst, nicht schon heute da gewesen) oder null. */
  public pickGhostCaptain(ownUid: string | null, excludeUids: Set<string>): GhostCaptain | null {
    const pool = (this.testOverride ?? this.ghostPool).filter(
      (g) => g.uid !== ownUid && !excludeUids.has(g.uid),
    );
    if (pool.length === 0) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  public getGhostPoolSize(): number {
    return (this.testOverride ?? this.ghostPool).length;
  }

  /** Nur für Tests. */
  public setGhostPoolForTest(pool: GhostCaptain[] | null): void {
    this.testOverride = pool;
  }
}

export const galacticNetwork = new GalacticNetwork();
