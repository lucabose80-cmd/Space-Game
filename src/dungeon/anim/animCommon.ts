// M11: gemeinsame Hilfen der Rig-Animationen (Boss- und Gegner-Rigs). Rein darstellend, deterministisch.
import type { Enemy } from '../dungeonTypes';

export const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
/** Gedämpfte Schwingung (Nachfedern): t in s, freq in rad/s, decay in 1/s. */
export const damped = (t: number, freq = 14, decay = 7): number => Math.exp(-decay * t) * Math.sin(freq * t);
/** Sekunden seit Beginn des aktuellen Boss-Zustands (nur für Zustände, in denen die KI `bossStateMax` setzt). */
export const elapsed = (e: Enemy): number => Math.max(0, (e.bossStateMax ?? 0) - (e.bossStateTimer ?? 0));
/** Fortschritt 0…1 des aktuellen Zustands. */
export const progress = (e: Enemy): number => (e.bossStateMax && e.bossStateMax > 0 ? clamp01(elapsed(e) / e.bossStateMax) : 0);

interface Stride { phase: number; time: number }
const strides = new WeakMap<Enemy, Stride>();
/** Schrittphase aus zurückgelegter Strecke statt aus der Uhr: steht der Boss, stehen auch die Beine; schneller = größere Schritte. */
export function stridePhase(e: Enemy, time: number, speed: number): number {
  const st = strides.get(e) ?? { phase: e.id, time };
  strides.set(e, st);
  const dt = Math.max(0, Math.min(0.1, time - st.time));
  st.time = time;
  st.phase += speed * dt * 0.16;
  return st.phase;
}
