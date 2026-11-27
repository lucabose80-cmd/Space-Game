// M11 Phase 9: Sporenspucker-Rig (Gegner-Rig Typ G). Rein darstellend — keine Hitbox-/Schadensänderung, kein globaler Zufall.
// Zustände aus enemyAi: Leerlauf (aiTimer) → Vorwarnung (`telegraphTimer`, 0,5 s) → Schuss → Umsetzen (`scurryTimer`, 0,72 s).
import type { Pose } from '../../../engine/rig';
import type { Enemy } from '../../dungeonTypes';
import type { RigAnim } from '../rigAnim';

const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));

/** Länge der Vorwarnung (enemyAi: `telegraphTimer = 0.5`). */
const SPIT_TELEGRAPH = 0.5;
/** Rückstoß/Erholung nach dem Ausstoß (s). */
const SPIT_RECOIL = 0.3;
/** Treffer-Zucken (s) — kurz genug, um keine Angriffspose zu stören (G6). */
const FLINCH_TIME = 0.15;
/** Länge der Todes-Animation (s). */
export const SPITTER_DEATH_TIME = 0.5;

interface SpitterState {
  wasTelegraph: boolean;
  recoil: number;
  flinch: number;
  flinchDir: number;
  wasFlash: boolean;
  /** Eingraben/Auftauchen: 0 = oben, 1 = eingegraben (Umsetzen) */
  burrow: number;
  /** kurzes Wegducken beim Einsetzen des Umsetzens */
  dip: number;
  wasScurry: boolean;
  time: number;
}
const states = new WeakMap<Enemy, SpitterState>();

/** Blickrichtung: −1 = Spieler links (Rig spiegeln), +1 = rechts. Totzone gegen Flackern. */
const lastFacing = new WeakMap<Enemy, number>();
function facing(e: Enemy, playerX: number): number {
  const d = playerX - e.x;
  const f = Math.abs(d) < 3 ? (lastFacing.get(e) ?? 1) : d < 0 ? -1 : 1;
  lastFacing.set(e, f);
  return f;
}

function pose(e: Enemy, time: number, lookDx: number, lookDy: number): Pose {
  let st = states.get(e);
  if (!st) {
    st = { wasTelegraph: false, recoil: 0, flinch: 0, flinchDir: 1, wasFlash: false, burrow: 0, dip: 0, wasScurry: false, time };
    states.set(e, st);
  }
  const dt = clamp(time - st.time, 0, 0.1);
  st.time = time;
  const tele = e.telegraphTimer > 0;
  if (st.wasTelegraph && !tele) st.recoil = SPIT_RECOIL; // Vorwarnung zu Ende = Ausstoß
  st.wasTelegraph = tele;
  st.recoil = Math.max(0, st.recoil - dt);
  const flash = e.flashTimer > 0;
  if (flash && !st.wasFlash) { st.flinch = 1; st.flinchDir = -st.flinchDir; }
  st.wasFlash = flash;
  st.flinch = Math.max(0, st.flinch - dt / FLINCH_TIME);
  const scurry = e.scurryTimer > 0;
  if (scurry && !st.wasScurry) st.dip = 1;
  st.wasScurry = scurry;
  st.dip = Math.max(0, st.dip - dt / 0.14);
  // Eingraben beim Umsetzen, danach wieder auftauchen (weich, nie schlagartig)
  st.burrow = clamp(st.burrow + (scurry ? dt / 0.12 : -dt / 0.2), 0, 1);

  const p = tele ? clamp(1 - e.telegraphTimer / SPIT_TELEGRAPH, 0, 1) : 0; // Aufblähen 0 → 1
  const rk = st.recoil / SPIT_RECOIL; // 1 → 0
  const ph = e.id * 1.37;
  const breathe = Math.sin(time * 2.6 + ph); // Leerlauf-Atmen
  const pulse = Math.sin(time * 7 + ph); // schneller Puls (wie das alte Sprite)
  const calm = !tele && rk <= 0 && st.burrow <= 0 ? 1 : 0;
  const fl = st.flinch, dig = st.burrow;
  const aim = clamp(lookDy / Math.max(12, Math.abs(lookDx)), -0.7, 0.7);

  // Körper: Atmen im Stand · Aufblähen in der Vorwarnung · Stauchen beim Ausstoß · flach beim Eingraben
  const swell = 0.2 * p * p;
  const sx = 1 + 0.025 * breathe * calm + 0.035 * pulse * p + swell * 0.7 + 0.12 * rk + 0.06 * dig + 0.1 * fl;
  const sy = 1 - 0.03 * breathe * calm - 0.035 * pulse * p + swell - 0.2 * rk - 0.08 * dig - 0.12 * fl - 0.1 * st.dip;
  const kick = -2.4 * rk + 1.2 * fl * st.flinchDir;

  // Kapseln öffnen sich nacheinander (links bei 30 %, rechts bei 60 % der Vorwarnung), schließen nach dem Ausstoß
  const openL = tele ? p >= 0.3 : rk > 0.45;
  const openR = tele ? p >= 0.6 : rk > 0.6;
  const sway = Math.sin(time * 3.1 + ph);
  const podGlow = 1 + 0.18 * Math.sin(time * 18 + ph) * p;
  // Spore: wächst in der linken Kapsel, wird nach dem Ausstoß zum Spieler hin ausgeworfen
  const sporeGrow = tele ? clamp((p - 0.45) / 0.55, 0, 1) : 0;
  const eject = 1 - rk; // 0 → 1 während der Erholung
  const sporeShown = sporeGrow > 0.02 || rk > 0.02;
  const sporeScale = tele ? 0.3 + 0.7 * sporeGrow : 1 + 0.4 * eject;
  const ejX = tele ? 0 : 16 * eject;
  const ejY = tele ? 0 : 16 * eject * aim;

  return {
    body: { variant: dig > 0.5 ? 1 : 0, sx, sy, dx: kick, dy: dig * 1.2 + 0.6 * st.dip - 0.6 * p, rot: 0.04 * fl * st.flinchDir + 0.03 * sway * dig },
    eye: {
      // schaut zum Spieler; kneift beim Aufblähen leicht zusammen, tief im Boden fast zu
      dx: clamp(lookDx * 0.06, -1.6, 1.6) + kick * 0.4,
      dy: clamp(lookDy * 0.05, -1.2, 1.2) + dig * 1.5,
      sx: 1 + 0.15 * p - 0.1 * dig,
      sy: 1 - 0.25 * p - 0.3 * dig - 0.2 * fl,
      alpha: dig > 0.5 ? 0.85 : 1,
    },
    podL: { variant: openL ? 1 : 0, rot: -0.1 * sway * calm - 0.25 * p - 0.15 * rk, dy: -0.6 * p - dig * 3, sx: podGlow, sy: podGlow, hidden: dig > 0.7 },
    podR: { variant: openR ? 1 : 0, rot: 0.1 * sway * calm + 0.25 * p + 0.15 * rk, dy: -0.6 * p - dig * 3, sx: podGlow, sy: podGlow, hidden: dig > 0.7 },
    spore: { hidden: !sporeShown, dx: -6 + ejX + kick, dy: -3 - 3 * sporeGrow + ejY, alpha: tele ? 0.4 + 0.6 * sporeGrow : clamp(rk * 1.6, 0, 1), sx: sporeScale, sy: sporeScale },
  };
}

export const anim: RigAnim = {
  rawPose: (e, time, lookDx, lookDy) => pose(e, time, lookDx, lookDy),
  tau: 0.04,
  noPulse: ['eye', 'spore'],
  facing: (e, playerX) => facing(e, playerX),
};

// ---- Tod: Der Gegner verschwindet nicht abrupt — Körper sackt zusammen, Kapseln/Auge/Spore platzen weg ----
export interface SpitterGhost {
  x: number;
  y: number;
  t0: number;
  facing: number;
  /** Seitenrichtung, in die die Kapseln fliegen */
  dir: number;
}
const tracked = new Map<number, Enemy>();
let ghosts: SpitterGhost[] = [];

/** Pro Bild aufrufen: erkennt Sporenspucker, die mit hp ≤ 0 aus der Liste verschwunden sind, und legt eine Todes-Animation an. */
export function updateSpitterGhosts(enemies: readonly Enemy[], time: number, playerX: number): readonly SpitterGhost[] {
  const present = new Set<number>();
  for (const e of enemies) {
    if (e.kind !== 'spore_spitter') continue;
    present.add(e.id);
    tracked.set(e.id, e);
  }
  for (const [id, e] of tracked) {
    if (present.has(id)) continue;
    tracked.delete(id);
    if (e.hp <= 0) ghosts.push({ x: e.x, y: e.y, t0: time, facing: facing(e, playerX), dir: e.id % 2 === 0 ? 1 : -1 });
  }
  if (ghosts.length) ghosts = ghosts.filter((g) => time - g.t0 < SPITTER_DEATH_TIME && time >= g.t0);
  return ghosts;
}

/** Zurücksetzen (Raumwechsel/Neustart/Tests). */
export function clearSpitterGhosts(): void {
  tracked.clear();
  ghosts = [];
}

/** Pose der Todes-Animation bei `age` Sekunden (0 … `SPITTER_DEATH_TIME`). */
export function spitterDeathPose(g: SpitterGhost, age: number): Pose {
  const u = clamp(age / SPITTER_DEATH_TIME, 0, 1);
  const burst = clamp(age / 0.18, 0, 1); // Platzen in den ersten 0,18 s
  const fall = u * u; // Teile fallen beschleunigt
  const d = g.dir;
  return {
    body: { variant: u > 0.35 ? 1 : 0, sx: 1 + 0.35 * burst, sy: 1 - 0.55 * burst, dy: 1.5 * burst, alpha: 1 - clamp((u - 0.6) / 0.4, 0, 1) },
    eye: { dx: 2 * d * burst, dy: -9 * Math.sin(Math.min(1, u * 1.4) * Math.PI) + 12 * fall, rot: 3 * u * d, alpha: 1 - clamp((u - 0.5) / 0.5, 0, 1) },
    podL: { variant: 1, dx: -14 * burst - 4 * u, dy: -10 * Math.sin(Math.min(1, u * 1.3) * Math.PI) + 14 * fall, rot: -2.4 * u, alpha: 1 - clamp((u - 0.55) / 0.45, 0, 1) },
    podR: { variant: 1, dx: 14 * burst + 4 * u, dy: -10 * Math.sin(Math.min(1, u * 1.3) * Math.PI) + 14 * fall, rot: 2.4 * u, alpha: 1 - clamp((u - 0.55) / 0.45, 0, 1) },
    spore: { dy: -6 - 4 * u, sx: 1 + 1.6 * u, sy: 1 + 1.6 * u, alpha: 1 - u },
  };
}
