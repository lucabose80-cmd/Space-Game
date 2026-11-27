// M11: Sternen-Lanzer (star_lancer) — goldener Lanzen-Krieger (Rumpf, Helm, 2 Arme, Beinpaar, Sternenspeer).
// Rein darstellend: keine Hitbox-/Schadensänderung, kein Zufall, Zeit nur über `time`.
import type { Pose } from '../../../engine/rig';
import type { Enemy } from '../../dungeonTypes';
import type { RigAnim } from '../rigAnim';

const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
const HIT_TIME = 0.14;
const THRUST_TIME = 0.24;
const RECOVER_TIME = 0.28;

interface LancerState {
  step: number;
  wind: number;
  thrust: number;
  recover: number;
  wasTele: boolean;
  hit: number;
  hitDir: number;
  wasFlash: boolean;
  time: number;
}
const states = new WeakMap<Enemy, LancerState>();

function facing(e: Enemy, playerX: number): number {
  if (e.telegraphTimer > 0 && Number.isFinite(e.aimAngle)) {
    const cx = Math.cos(e.aimAngle);
    if (Math.abs(cx) > 0.08) return cx < 0 ? -1 : 1;
  }
  return playerX < e.x - 2 ? -1 : 1;
}

function lancerPose(e: Enemy, time: number): Pose {
  let st = states.get(e);
  if (!st) {
    st = { step: e.id * 1.1, wind: 0, thrust: 0, recover: 0, wasTele: false, hit: 0, hitDir: 1, wasFlash: false, time };
    states.set(e, st);
  }
  const dt = clamp(time - st.time, 0, 0.1);
  st.time = time;

  const tele = e.telegraphTimer > 0;
  if (st.wasTele && !tele) {
    st.thrust = 1;
    st.recover = 1;
  }
  st.wasTele = tele;
  st.thrust = Math.max(0, st.thrust - dt / THRUST_TIME);
  if (st.thrust <= 0) st.recover = Math.max(0, st.recover - dt / RECOVER_TIME);

  const flashing = e.flashTimer > 0;
  if (flashing && !st.wasFlash) {
    st.hit = 1;
    st.hitDir = -st.hitDir;
  }
  st.wasFlash = flashing;
  st.hit = Math.max(0, st.hit - dt / HIT_TIME);

  const toward = (v: number, t: number, rate: number): number =>
    v < t ? Math.min(t, v + rate * dt) : Math.max(t, v - rate * dt);
  st.wind = toward(st.wind, tele ? 1 : 0, tele ? 8 : 6);

  const spd = Math.hypot(e.vx, e.vy);
  st.step += spd * dt * 0.2;
  const moving = clamp(spd / 42, 0, 1);

  const w = st.wind;
  const tr = st.thrust;
  const rk = st.thrust > 0 ? 0 : st.recover;
  const h = st.hit * (1 - Math.max(w, tr) * 0.65);
  const calm = clamp(1 - w - tr, 0, 1);

  const bob = Math.abs(Math.cos(st.step)) * 1.3 * moving * calm;
  const shake = tele ? Math.sin(time * 68 + e.id) * 0.4 : 0;

  return {
    torso: {
      rot: 0.08 * moving * calm - 0.18 * w + 0.24 * tr - 0.08 * rk + 0.16 * h * st.hitDir,
      dx: -1.5 * w + 2.5 * tr + shake + 1.1 * h * st.hitDir,
      dy: -bob + 1.4 * w + 0.5 * tr + 0.4 * rk,
      sx: 1 + 0.06 * tr,
      sy: 1 - 0.06 * tr - 0.05 * h,
    },
    head: {
      rot: 0.1 * w - 0.15 * tr - 0.15 * h * st.hitDir,
    },
    legs: {
      rot: Math.sin(st.step) * 0.24 * moving * calm - 0.08 * w + 0.1 * tr,
      dy: bob * 0.5,
    },
    armR: {
      rot: -0.25 - 0.55 * w + 0.45 * tr + 0.12 * rk + 0.15 * h * st.hitDir,
      dx: -1.6 * w + 2.4 * tr,
      dy: -1.0 * w,
    },
    armL: {
      rot: 0.25 + 0.35 * w - 0.3 * tr + 0.1 * h * st.hitDir,
      dx: 1.0 * w - 0.6 * tr,
    },
    spear: {
      // Im Ruhezustand schräg aufrecht, beim Zielen/Stoßen waagerecht nach vorn!
      rot: 0.55 + 1.0 * w + 0.65 * tr,
      dx: -1.4 * w + 3.2 * tr,
      dy: -0.8 * w,
    },
  };
}

export const anim: RigAnim = {
  rawPose: (e, time) => lancerPose(e, time),
  facing,
  tau: 0.045,
};
