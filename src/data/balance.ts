// Zentrale Stellschrauben für Balancing (Meilenstein 10-C).
// Ökonomie ist iterativ: Werte hier ändern, nicht im Code verstreuen.

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
