// M11: Rig-Animations-Engine — Glättung, Stauch-Impuls, Zwischen-Posen. Die Posen je Rig liegen in `anim/rigs/<rig-id>.ts`
// (automatisch registriert über `import.meta.glob`; Schnittstelle `rigAnim.ts`, Hilfen `animCommon.ts`). Spiellogik bleibt in bosses/defs.ts.
import { RIGS } from '../../data/rigs';
import type { Pose } from '../../engine/rig';
import type { Enemy } from '../dungeonTypes';
import { lerp } from './animCommon';
import type { RigAnim } from './rigAnim';

const modules = import.meta.glob<{ anim: RigAnim }>('./rigs/*.ts', { eager: true });
/** Rig-Id (Dateiname) → Animationsmodul. */
const ANIMS: Record<string, RigAnim> = Object.fromEntries(Object.entries(modules).map(([path, m]) => [path.replace(/^.*\/(.+)\.ts$/, '$1'), m.anim]));

// ---------- K1: weiche Übergänge ----------
/** Zeitkonstante der Annäherung an die Ziel-Pose (s). */
const SMOOTH_TAU = 0.05;
/** Dauer des Stauch-Impulses beim Bildwechsel (s). */
const PULSE_TIME = 0.09;
const NUM_FIELDS = ['rot', 'dx', 'dy', 'sx', 'sy'] as const;
/** Dauer einer Zwischen-Pose beim Bildwechsel (s). */
const BETWEEN_TIME = 0.08;

interface AnimState {
  cur: Record<string, Record<(typeof NUM_FIELDS)[number], number>>;
  variants: Record<string, number | undefined>;
  pulse: Record<string, number>;
  inter: Record<string, { v: number; until: number }>;
  lag: Record<string, { v: number; until: number }>;
  time: number;
}
const animStates = new WeakMap<Enemy, AnimState>();

/**
 * Glättet die Ziel-Pose über die Zeit: Drehung/Lage/Skalierung nähern sich exponentiell an (kein Springen),
 * Bildwechsel (`variant`) bleiben hart, bekommen aber einen kurzen Stauch-Impuls (sx 1.08 / sy 0.94, Rumpf zusätzlich dy +0.6),
 * damit das Auge den Schnitt nicht sieht. Zustand je Boss in einer WeakMap, Zeit nur über `time` (kein Date.now).
 */
function smoothPose(e: Enemy, target: Pose, time: number, anim: RigAnim): Pose {
  const tau = anim.tau ?? SMOOTH_TAU;
  const noPulse = anim.noPulse ?? [];
  let st = animStates.get(e);
  const first = !st;
  if (!st) {
    st = { cur: {}, variants: {}, pulse: {}, inter: {}, lag: {}, time };
    animStates.set(e, st);
  }
  const dt = first ? 0 : Math.max(0, Math.min(0.1, time - st.time));
  st.time = time;
  const k = first ? 1 : 1 - Math.exp(-dt / tau);
  const out: Pose = {};
  for (const [id, tgt] of Object.entries(target)) {
    const cur = (st.cur[id] ??= { rot: tgt.rot ?? 0, dx: tgt.dx ?? 0, dy: tgt.dy ?? 0, sx: tgt.sx ?? 1, sy: tgt.sy ?? 1 });
    for (const f of NUM_FIELDS) cur[f] = lerp(cur[f], tgt[f] ?? (f === 'sx' || f === 'sy' ? 1 : 0), k);
    const prev = st.variants[id];
    if (prev !== undefined && tgt.variant !== undefined && prev !== tgt.variant) {
      if (!noPulse.includes(id)) st.pulse[id] = PULSE_TIME;
      const mid = anim.between?.(id, prev, tgt.variant);
      const lagT = anim.lag?.[id];
      if (lagT) st.lag[id] = { v: prev, until: time + lagT };
      if (mid !== undefined) st.inter[id] = { v: mid, until: time + BETWEEN_TIME };
    }
    if (tgt.variant !== undefined) st.variants[id] = tgt.variant;
    const pulse = (st.pulse[id] = Math.max(0, (st.pulse[id] ?? 0) - dt)) / PULSE_TIME;
    const inter = st.inter[id];
    const lag = st.lag[id];
    const lagV = lag && time < lag.until ? lag.v : undefined;
    out[id] = {
      ...tgt,
      variant: lagV !== undefined ? lagV : inter && time < inter.until ? inter.v : tgt.variant,
      rot: cur.rot,
      dx: cur.dx,
      dy: cur.dy + (id === 'torso' ? 0.6 * pulse : 0),
      sx: cur.sx * (1 + 0.08 * pulse),
      sy: cur.sy * (1 - 0.06 * pulse),
    };
  }
  return out;
}

interface BodyState {
  sx: number;
  sy: number;
  tilt: number;
  time: number;
}
const bodyStates = new WeakMap<Enemy, BodyState>();

/**
 * K1: Ganzkörper-Stauchen/Neigung des Renderers (zustandsabhängig, stufenweise) weich nachführen — und mit einem Rig abmildern,
 * weil die Teile ihr Stauchen/Strecken schon selbst zeigen (K2). `strength` 0…1 skaliert die Abweichung von 1.
 */
export function smoothBossBody(e: Enemy, sx: number, sy: number, tilt: number, time: number, strength: number): { sx: number; sy: number; tilt: number } {
  const tsx = 1 + (sx - 1) * strength;
  const tsy = 1 + (sy - 1) * strength;
  let st = bodyStates.get(e);
  if (!st) {
    st = { sx: tsx, sy: tsy, tilt, time };
    bodyStates.set(e, st);
  }
  const k = 1 - Math.exp(-Math.max(0, Math.min(0.1, time - st.time)) / 0.06);
  st.time = time;
  st.sx = lerp(st.sx, tsx, k);
  st.sy = lerp(st.sy, tsy, k);
  st.tilt = lerp(st.tilt, tilt, k);
  return { sx: st.sx, sy: st.sy, tilt: st.tilt };
}


/** Pose des Rigs (geglättet). Teile mit `detach: 'phase2'` sind ab Phase 2 unsichtbar (sie fliegen als abgelöste Teile). Rigs ohne Animationsmodul: leere Pose. */
export function getBossPose(rigId: string, e: Enemy, time: number, lookDx = 0, lookDy = 0): Pose {
  const anim = ANIMS[rigId];
  if (!anim) return {};
  const pose = smoothPose(e, anim.rawPose(e, time, lookDx, lookDy), time, anim);
  if (e.bossPhase2) {
    for (const p of RIGS[rigId]?.parts ?? []) if (p.detach === 'phase2') pose[p.id] = { ...pose[p.id], hidden: true };
  }
  return pose;
}

/** Blickrichtung (−1/+1) für Rigs, die der Renderer spiegeln soll (z. B. Geschütz); sonst +1. */
export function getRigFacing(rigId: string, e: Enemy, playerX: number): number {
  return ANIMS[rigId]?.facing?.(e, playerX) ?? 1;
}
