// M11: Prisma-Drohne (prism_drone) — schwebender Kristall-Oktaeder (Obere/Untere Hälfte, Augenband, 2 Orbit-Splitter, offener Kern).
// Rein darstellend: keine Hitbox-/Schadensänderung, kein Zufall, Zeit nur über `time`.
// Zustände (aus enemyAi): Schweben + kreisende Orbit-Splitter → Vorwarnung (`telegraphTimer` 0,46 s: Hälften fahren auseinander,
// offener Kern blüht strahlend auf, Splitter weiten sich) → Schuss-Impuls (0,18 s: Hälften schnappen zusammen, Kern blitzt)
// → Erholung (0,24 s) → Treffer-Zucken (Flanke `flashTimer`).
import type { Pose } from '../../../engine/rig';
import type { Enemy } from '../../dungeonTypes';
import type { RigAnim } from '../rigAnim';

const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
const HIT_TIME = 0.14;
const FIRE_TIME = 0.18;
const RECOVER_TIME = 0.24;

interface PrismState {
  wind: number;
  fire: number;
  recover: number;
  wasTele: boolean;
  hit: number;
  hitDir: number;
  wasFlash: boolean;
  time: number;
}
const states = new WeakMap<Enemy, PrismState>();

function prismPose(e: Enemy, time: number): Pose {
  let st = states.get(e);
  if (!st) {
    st = { wind: 0, fire: 0, recover: 0, wasTele: false, hit: 0, hitDir: 1, wasFlash: false, time };
    states.set(e, st);
  }
  const dt = clamp(time - st.time, 0, 0.1);
  st.time = time;

  const tele = e.telegraphTimer > 0;
  if (st.wasTele && !tele) {
    st.fire = 1;
    st.recover = 1;
  }
  st.wasTele = tele;
  st.fire = Math.max(0, st.fire - dt / FIRE_TIME);
  if (st.fire <= 0) st.recover = Math.max(0, st.recover - dt / RECOVER_TIME);

  const flashing = e.flashTimer > 0;
  if (flashing && !st.wasFlash) {
    st.hit = 1;
    st.hitDir = -st.hitDir;
  }
  st.wasFlash = flashing;
  st.hit = Math.max(0, st.hit - dt / HIT_TIME);

  const toward = (v: number, t: number, rate: number): number =>
    v < t ? Math.min(t, v + rate * dt) : Math.max(t, v - rate * dt);
  st.wind = toward(st.wind, tele ? 1 : 0, tele ? 9 : 7);

  const w = st.wind;
  const f = st.fire;
  const rk = st.fire > 0 ? 0 : st.recover;
  const h = st.hit * (1 - w * 0.6);

  const hover = Math.sin(time * 5.2 + e.id * 1.5) * (2.4 - 1.2 * w);
  const lean = clamp(e.vx / 110, -0.16, 0.16);
  const openGap = 4.6 * w + 1.8 * f - 1.2 * rk;
  const shake = tele ? Math.sin(time * 62 + e.id) * 0.45 : 0;

  // Orbit-Splitter kreisen um das Prisma (Radius weitet sich beim Laden/Feuern)
  const ang = time * (2.6 + 2.8 * w + 3.5 * f) + e.id * 1.1;
  const rx = 14 + 5 * w + 7 * f;
  const ry = 4.5 + 1.5 * w;
  const coreScale = Math.max(0.02, 0.12 + 0.85 * w + 0.45 * f);

  return {
    band: {
      rot: lean + 0.2 * h * st.hitDir,
      dx: shake + 1.2 * h * st.hitDir,
      dy: hover - 1.0 * w + 0.8 * f,
      sx: 1 + 0.08 * f - 0.05 * w,
      sy: 1 - 0.08 * f + 0.05 * w - 0.06 * h,
    },
    top: {
      dy: -openGap - Math.sin(time * 5.2 + e.id) * 0.5,
      rot: 0.08 * w * Math.sin(time * 24) - 0.12 * h * st.hitDir,
    },
    bot: {
      dy: openGap + Math.sin(time * 5.2 + e.id) * 0.5,
      rot: -0.08 * w * Math.sin(time * 24) + 0.12 * h * st.hitDir,
    },
    core: {
      rot: time * (4 + 6 * w),
      sx: coreScale,
      sy: coreScale,
    },
    shardA: {
      dx: Math.cos(ang) * rx,
      dy: Math.sin(ang) * ry - 1.5,
      rot: Math.sin(ang) * 0.35 + 0.4 * f,
    },
    shardB: {
      dx: Math.cos(ang + Math.PI) * (rx * 0.9),
      dy: Math.sin(ang + Math.PI) * ry + 1.5,
      rot: -Math.sin(ang) * 0.4 - 0.4 * f,
    },
  };
}

export const anim: RigAnim = {
  rawPose: (e, time) => prismPose(e, time),
  facing: () => 1,
  tau: 0.04,
};
