// M11: Solar-Drohne (solar_drone) — schwebender Sonnenkern mit gegenläufigen Kardanringen, Solarpaneelen & Sonnen-Fackel.
// Rein darstellend: keine Hitbox-/Schadensänderung, kein Zufall, Zeit nur über `time`.
import type { Pose } from '../../../engine/rig';
import type { Enemy } from '../../dungeonTypes';
import type { RigAnim } from '../rigAnim';

const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
const HIT_TIME = 0.14;
const FIRE_TIME = 0.2;
const RECOVER_TIME = 0.24;

interface SolarState {
  wind: number;
  fire: number;
  recover: number;
  wasTele: boolean;
  hit: number;
  hitDir: number;
  wasFlash: boolean;
  ringA: number;
  time: number;
}
const states = new WeakMap<Enemy, SolarState>();

function facing(e: Enemy, playerX: number): number {
  return playerX < e.x - 2 ? -1 : 1;
}

function solarPose(e: Enemy, time: number): Pose {
  let st = states.get(e);
  if (!st) {
    st = { wind: 0, fire: 0, recover: 0, wasTele: false, hit: 0, hitDir: 1, wasFlash: false, ringA: e.id * 1.3, time };
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

  st.ringA += dt * (1.8 + 4.5 * w + 6.0 * f);
  const hover = Math.sin(time * 5.0 + e.id * 1.4) * (2.4 - 1.0 * w);
  const lean = clamp(e.vx / 110, -0.15, 0.15);
  const shake = tele ? Math.sin(time * 64 + e.id) * 0.45 : 0;
  const flareSc = Math.max(0.01, 0.35 * w + 1.25 * f);

  return {
    core: {
      variant: w > 0.25 || f > 0.15 ? 1 : 0,
      rot: lean + 0.18 * h * st.hitDir,
      dx: shake - 1.5 * f + 1.1 * h * st.hitDir,
      dy: hover - 0.8 * w + 0.6 * rk,
      sx: 1 + 0.14 * w + 0.22 * f - 0.05 * rk,
      sy: 1 + 0.14 * w + 0.22 * f - 0.05 * rk - 0.06 * h,
    },
    ringOut: {
      rot: st.ringA,
      sx: 1 + 0.08 * w + 0.12 * f,
      sy: 1 + 0.08 * w + 0.12 * f,
    },
    ringIn: {
      rot: -st.ringA * 1.4,
      sx: 1 - 0.06 * w + 0.14 * f,
      sy: 1 - 0.06 * w + 0.14 * f,
    },
    panelL: {
      rot: 0.14 * Math.sin(time * 4.5 + e.id) - 0.28 * w - 0.35 * f,
      dx: -1.5 * w,
    },
    panelR: {
      sx: -1,
      rot: -0.14 * Math.sin(time * 4.5 + e.id) + 0.28 * w + 0.35 * f,
      dx: 1.5 * w,
    },
    flare: {
      sx: flareSc,
      sy: flareSc,
      rot: Math.sin(time * 40) * 0.12,
    },
  };
}

export const anim: RigAnim = {
  rawPose: (e, time) => solarPose(e, time),
  facing,
  tau: 0.04,
};
