// Zentrale Stellschrauben für Balancing (Meilenstein 10-C).
// Ökonomie ist iterativ: Werte hier ändern, nicht im Code verstreuen.

import type { WeaponId } from '../types';

/** Faktor auf den Basis-Verkaufswert aller Items (E7). */
export const SELL_PRICE_MULT = 0.65;
/** Faktor auf Kopfgeld-Belohnungen neu erzeugter Aufträge. */
export const BOUNTY_REWARD_MULT = 0.75;

/** E6a: Faktor auf die Stufe-0-Werte für die Waffen-Stufen 0–3 (Stufen 4–7 bleiben). */
export const EARLY_TIER_DAMAGE_STEPS = [1.0, 1.2, 1.4, 1.6] as const;
/** E6b: Faktor auf Material-Mengen der Waffen-Stufen 1–3. */
export const EARLY_UPGRADE_MATERIAL_MULT = 1.5;

/** Rift-Kammer-Skalierung (BA3). `floor`/`sector` sind 1-basiert. */
export const RIFT_SCALING = {
  hpFactor: (sector: number, floor: number): number => 1.6 + 0.25 * (floor - 1) + 0.35 * (sector - 1),
  damageFactor: (sector: number, floor: number): number => 1.3 + 0.1 * (floor - 1) + 0.15 * (sector - 1),
  waves: (floor: number): number => (floor >= 2 ? 3 : 2),
  eliteEveryWave: (floor: number): boolean => floor >= 3,
};

/** M10-C (G4): Gegner-Schilde mit Counterplay. Frontal 100 % Block — aber Angriff & Überhitzung öffnen ein Fenster. */
export const ENEMY_SHIELDS = {
  shield_drone: { arc: 1.08, maxHeat: 4, overheatSec: 2.6, attackOpenSec: 1.0 },
  resonance_warden: { arc: 0.95, maxHeat: 5, overheatSec: 2.4, attackOpenSec: 1.05 },
} as const;
/** Hitze fällt pro Sekunde um 1 / HEAT_DECAY_SEC. */
export const SHIELD_HEAT_DECAY_SEC = 1.5;

/** Basis-Verkaufswert eines Items nach dem Preisfaktor (E7). Material-Mengen & Nyx-Preise bleiben unverändert. */
export function scaledSellValue(baseValue: number): number {
  return Math.max(1, Math.round(baseValue * SELL_PRICE_MULT));
}

/**
 * E6c: Fortschritts-Sperren für Waffen-Stufen (Ziel-Stufe = `level` des Upgrade-Tiers).
 * `check` bekommt nur Fortschrittszahlen, damit balance.ts keine GameState-Abhängigkeit braucht.
 */
export interface WeaponGateProgress {
  deepestFloor: number;
  deepestFloorS2: number;
  sector1Cleared: boolean;
  sector2Cleared: boolean;
  sector3Cleared: boolean;
}

export const WEAPON_TIER_GATES: Record<number, { text: string; check: (p: WeaponGateProgress) => boolean }> = {
  3: { text: 'Sektor 1 · Ebene II erreicht', check: (p) => p.deepestFloor >= 2 || p.sector1Cleared },
  4: { text: 'Sektor 1 abgeschlossen', check: (p) => p.sector1Cleared },
  5: { text: 'Sektor 2 · Ebene II erreicht', check: (p) => p.deepestFloorS2 >= 2 || p.sector2Cleared },
  6: { text: 'Sektor 2 abgeschlossen', check: (p) => p.sector2Cleared },
  7: { text: 'Sektor 3 abgeschlossen', check: (p) => p.sector3Cleared },
};

/**
 * M12 (Phase E, §5.1): Waffen-Arten-Sperre. Eine Waffen-Art ist in der Schmiede gesperrt, bis der Sektor-Endboss besiegt ist.
 * Nicht eingetragene Arten (blade, blaster, fists) sind ab Start frei. Schon hergestellte Waffen bleiben (kein Entzug).
 */
export const WEAPON_TYPE_GATES: Partial<Record<WeaponId, { sector: 1 | 2 | 3; boss: string; check: (cleared: (sector: number) => boolean) => boolean }>> = {
  spear: { sector: 1, boss: 'A.E.G.I.S. Leviathan', check: (c) => c(1) },
  discus: { sector: 2, boss: 'Prisma-Archon', check: (c) => c(2) },
  hammer: { sector: 3, boss: 'Vulkan-Titan', check: (c) => c(3) },
};

/** Flacht die Schadens-Stufen 1–3 ab (Stufen 0 und 4+ bleiben): neu = round(Stufe0 × EARLY_TIER_DAMAGE_STEPS[i]). */
export function flattenEarlyDamage(arr: number[]): number[] {
  return arr.map((v, i) => (i >= 1 && i <= 3 ? Math.round(arr[0] * EARLY_TIER_DAMAGE_STEPS[i]) : v));
}

/**
 * Boss-Basis-HP (vor NG+/Boss-Zähler). Kalibriert über die Ziel-Kampfdauer (reine Schadenszeit):
 * Ebene I 20–30 s · Ebene II 30–45 s · Ebene III 45–65 s bei der erwarteten Ausrüstung
 * (Mittel aller Waffen auf der Stufe, die der Fortschritts-Sperren erlaubt). Messung: tests/m10cp8.cjs
 */
export const BOSS_HP = {
  boss_breacher: 2700, // S1 E1 (Krall)
  boss: 4700, // S1 E2 (Kern-Wächter)
  boss_leviathan: 6900, // S1 E3
  boss_quartz_golem: 7100, // S2 E1
  boss_prism_weaver: 10650, // S2 E2
  boss_prisma_archon: 21600, // S2 E3
  boss_slag_overlord: 13400, // S3 E1
  boss_forge_warden: 20100, // S3 E2
  boss_vulkan_titan: 29500, // S3 E3
  boss_chrono_sentinel: 18300, // S4 E1
  boss_monolith_colossus: 27500, // S4 E2
  boss_star_archon: 40300, // S4 E3
  boss_omega_archon: 47600, // Omega-Anomalie
} as const;

export type BalancedBossKind = keyof typeof BOSS_HP;

/** Erwartete Ausrüstungsstufe (Waffen-Level) je Boss und Ziel-Kampfdauer (s) — Grundlage für Test m10cp8. */
export const BOSS_EXPECTED: Record<BalancedBossKind, { level: number; band: [number, number] }> = {
  boss_breacher: { level: 2, band: [20, 30] },
  boss: { level: 3, band: [30, 45] },
  boss_leviathan: { level: 3, band: [45, 65] },
  boss_quartz_golem: { level: 4, band: [20, 30] },
  boss_prism_weaver: { level: 4, band: [30, 45] },
  boss_prisma_archon: { level: 5, band: [45, 65] },
  boss_slag_overlord: { level: 6, band: [20, 30] },
  boss_forge_warden: { level: 6, band: [30, 45] },
  boss_vulkan_titan: { level: 6, band: [45, 65] },
  boss_chrono_sentinel: { level: 7, band: [20, 30] },
  boss_monolith_colossus: { level: 7, band: [30, 45] },
  boss_star_archon: { level: 7, band: [45, 65] },
  boss_omega_archon: { level: 7, band: [55, 75] },
};

/** Grobe durchschnittliche Angriffsdauer (s) je Waffe für DPS-Schätzungen (Blaster: Cooldown aus den Stats). */
export const WEAPON_AVG_COOLDOWN = { blade: 0.25, spear: 0.22, fists: 0.17, discus: 0.34, hammer: 0.44 } as const;
