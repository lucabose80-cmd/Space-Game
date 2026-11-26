// M11 (Phase 1): prozedurale Bewegung für Gegner — Lehnen, Atmen, Ausholen, Treffer-Rückstoß.
// Rein darstellend (keine Hitbox-/Schadensänderung). Bosse und Schleimer haben eigene Animationen.
import type { Enemy } from '../dungeonTypes';

export interface Motion {
  dx: number;
  dy: number;
  sx: number;
  sy: number;
  rot: number;
}

const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));

/** Kinds, die bereits eigene Squash-/Hover-Animationen haben (oder Bosse). */
const SKIP = new Set<Enemy['kind']>(['slime', 'slime_magma']);

export function wantsMotion(e: Enemy): boolean {
  return !SKIP.has(e.kind) && !e.kind.startsWith('boss');
}

export function enemyMotion(e: Enemy, time: number): Motion {
  const speed = Math.hypot(e.vx, e.vy);
  const breathe = Math.sin(time * 2.6 + e.id * 1.7);
  let sx = 1 - breathe * 0.006;
  let sy = 1 + breathe * 0.012;
  let dx = 0;
  let dy = 0;
  const rot = clamp(e.vx * 0.0011, -0.1, 0.1);

  // Gehen/Schweben: kleines Wippen im Schritttakt
  if (speed > 6) dy -= Math.abs(Math.sin(e.anim * 1.15)) * Math.min(1.3, speed * 0.018);

  // Ausholen (Vorwarnung): zusammenziehen + leichtes Zittern
  if ((e.telegraphTimer ?? 0) > 0) {
    sx *= 1.08;
    sy *= 0.92;
    dx += Math.sin(time * 70 + e.id) * 0.35;
  }
  // Treffer: kurzes Zusammenzucken
  if (e.flashTimer > 0.05) {
    sx *= 0.94;
    sy *= 1.07;
  }
  return { dx, dy, sx, sy, rot };
}
