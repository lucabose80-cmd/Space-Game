// M11: Magma-Mörser (magma_mortar) — vierbeinige Artillerie-Spinne (Kessel, Mörserrohr, 4 Beine, Kappe, glühendes Glutauge).
// Rein darstellend: keine Hitbox-/Schadensänderung, kein Zufall, Zeit nur über `time`.
import type { Pose } from '../../../engine/rig';
import type { Enemy } from '../../dungeonTypes';
import type { RigAnim } from '../rigAnim';

const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
const HIT_TIME = 0.14;
const FIRE_TIME = 0.22;
const RECOVER_TIME = 0.28;

interface MortarState {
  step: number;
  wind: number;
  fire: number;
  recover: number;
  wasTele: boolean;
  hit: number;
  hitDir: number;
  wasFlash: boolean;
  time: number;
}
const states = new WeakMap<Enemy, MortarState>();

function facing(e: Enemy, playerX: number): number {
  return playerX < e.x - 2 ? -1 : 1;
}

function mortarPose(e: Enemy, time: number): Pose {
  let st = states.get(e);
  if (!st) {
    st = { step: e.id * 1.1, wind: 0, fire: 0, recover: 0, wasTele: false, hit: 0, hitDir: 1, wasFlash: false, time };
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
  st.wind = toward(st.wind, tele ? 1 : 0, tele ? 7 : 6);

  const spd = Math.hypot(e.vx, e.vy);
  st.step += spd * dt * 0.18;
  const moving = clamp(spd / 38, 0, 1);

  const w = st.wind;
  const f = st.fire;
  const rk = st.fire > 0 ? 0 : st.recover;
  const h = st.hit * (1 - w * 0.65);
  const calm = clamp(1 - w - f, 0, 1);

  const bob = Math.abs(Math.sin(st.step)) * 1.1 * moving * calm;
  const shake = tele ? Math.sin(time * 60 + e.id) * 0.45 : 0;
  const sA = Math.sin(st.step) * 0.35 * moving * calm;
  const sB = Math.sin(st.step + Math.PI) * 0.35 * moving * calm;
  const orbSc = Math.max(0.02, 0.1 + 0.95 * w + 0.35 * f);

  return {
    torso: {
      rot: -0.05 * w - 0.14 * f + 0.06 * rk + 0.15 * h * st.hitDir,
      dx: shake + 1.0 * h * st.hitDir,
      dy: -bob + 2.2 * w + 3.2 * f + 0.6 * rk,
      sx: 1 + 0.08 * w + 0.14 * f - 0.04 * rk,
      sy: 1 - 0.1 * w - 0.18 * f + 0.04 * rk - 0.05 * h,
    },
    barrel: {
      rot: -0.22 * w - 0.32 * f + 0.1 * rk + 0.1 * h * st.hitDir,
      dx: -1.4 * f,
      dy: -0.8 * w + 2.4 * f,
      sx: 1 + 0.12 * w + 0.16 * f,
      sy: 1 - 0.16 * f,
    },
    orb: {
      sx: orbSc,
      sy: orbSc,
      rot: time * 5,
    },
    cap: {
      dy: -0.4 * w + 0.6 * f,
    },
    legFL: { rot: sA - 0.25 * w - 0.3 * f, dy: -Math.max(0, Math.cos(st.step)) * 1.2 * moving * calm },
    legBL: { rot: sB - 0.15 * w - 0.2 * f, dy: -Math.max(0, Math.cos(st.step + Math.PI)) * 1.2 * moving * calm },
    legFR: { sx: -1, rot: -sB + 0.25 * w + 0.3 * f, dy: -Math.max(0, Math.cos(st.step + Math.PI)) * 1.2 * moving * calm },
    legBR: { sx: -1, rot: -sA + 0.15 * w + 0.2 * f, dy: -Math.max(0, Math.cos(st.step)) * 1.2 * moving * calm },
  };
}

export const anim: RigAnim = {
  rawPose: (e, time) => mortarPose(e, time),
  facing,
  tau: 0.045,
};
