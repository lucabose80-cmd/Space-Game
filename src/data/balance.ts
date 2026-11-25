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

/** M10-C (G4): Gegner-Schilde mit Counterplay. Frontal 100 % Block — aber Angriff & Überhitzung öffnen ein Fenster. */
export const ENEMY_SHIELDS = {
  shield_drone: { arc: 1.08, maxHeat: 4, overheatSec: 2.6, attackOpenSec: 1.0 },
  resonance_warden: { arc: 0.95, maxHeat: 5, overheatSec: 2.4, attackOpenSec: 1.05 },
} as const;
/** Hitze fällt pro Sekunde um 1 / HEAT_DECAY_SEC. */
export const SHIELD_HEAT_DECAY_SEC = 1.5;
