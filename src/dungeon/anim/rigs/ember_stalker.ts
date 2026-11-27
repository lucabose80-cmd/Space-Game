// M11: Glut-Jäger (ember_stalker) — humanoider Feuerklingen-Assassine (Rumpf, Kopf, 2 Feuerklingen-Arme, 2 Beine).
// Rein darstellend: keine Hitbox-/Schadensänderung, kein Zufall, Zeit nur über `time`.
import type { Pose } from '../../../engine/rig';
import type { Enemy } from '../../dungeonTypes';
import type { RigAnim } from '../rigAnim';

const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
const HIT_TIME = 0.14;
const SLASH_TIME = 0.24;
const RECOVER_TIME = 0.28;

interface EmberState {
  step: number;
  wind: number;
  slash: number;
  recover: number;
  wasTele: boolean;
  hit: number;
  hitDir: number;
  wasFlash: boolean;
  time: number;
}
const states = new WeakMap<Enemy, EmberState>();

function facing(e: Enemy, playerX: number): number {
  return playerX < e.x - 2 ? -1 : 1;
}

function emberPose(e: Enemy, time: number): Pose {
  let st = states.get(e);
  if (!st) {
    st = { step: e.id * 1.4, wind: 0, slash: 0, recover: 0, wasTele: false, hit: 0, hitDir: 1, wasFlash: false, time };
    states.set(e, st);
  }
  const dt = clamp(time - st.time, 0, 0.1);
  st.time = time;

  const tele = e.telegraphTimer > 0;
  if (st.wasTele && !tele) {
    st.slash = 1;
    st.recover = 1;
  }
  st.wasTele = tele;
  st.slash = Math.max(0, st.slash - dt / SLASH_TIME);
  if (st.slash <= 0) st.recover = Math.max(0, st.recover - dt / RECOVER_TIME);

  const flashing = e.flashTimer > 0;
  if (flashing && !st.wasFlash) {
    st.hit = 1;
    st.hitDir = -st.hitDir;
  }
  st.wasFlash = flashing;
  st.hit = Math.max(0, st.hit - dt / HIT_TIME);

  const toward = (v: number, t: number, rate: number): number =>
    v < t ? Math.min(t, v + rate * dt) : Math.max(t, v - rate * dt);
  st.wind = toward(st.wind, tele ? 1 : 0, tele ? 10 : 7);

  const spd = Math.hypot(e.vx, e.vy);
  st.step += spd * dt * 0.22;
  const moving = clamp(spd / 45, 0, 1);

  const w = st.wind;
  const s = st.slash;
  const rk = st.slash > 0 ? 0 : st.recover;
  const h = st.hit * (1 - Math.max(w, s) * 0.7);
  const calm = clamp(1 - w - s, 0, 1);

  const stride = Math.sin(st.step) * 0.55 * moving * calm;
  const bob = Math.abs(Math.cos(st.step)) * 1.4 * moving * calm;
  const shake = tele ? Math.sin(time * 70 + e.id) * 0.5 : 0;

  return {
    torso: {
      rot: 0.14 * moving * calm - 0.26 * w + 0.34 * s - 0.08 * rk + 0.18 * h * st.hitDir,
      dx: -1.4 * w + 2.6 * s + shake + 1.2 * h * st.hitDir,
      dy: -bob + 2.6 * w + 0.6 * s + 0.5 * rk,
      sx: 1 + 0.08 * w + 0.06 * s,
      sy: 1 - 0.12 * w - 0.06 * s - 0.05 * h,
    },
    head: {
      rot: 0.15 * w - 0.2 * s - 0.16 * h * st.hitDir,
      dy: 0.5 * w,
    },
    armR: {
      rot: -stride * 0.6 - 0.95 * w + 1.05 * s + 0.2 * rk + 0.18 * h * st.hitDir,
      dx: -1.2 * w + 2.2 * s,
      dy: -1.4 * w,
    },
    armL: {
      rot: stride * 0.6 - 0.65 * w + 0.85 * s - 0.15 * rk + 0.12 * h * st.hitDir,
      dx: -0.8 * w + 1.6 * s,
      dy: -1.0 * w,
    },
    legR: {
      rot: stride - 0.35 * w + 0.3 * s,
      dy: -Math.max(0, Math.cos(st.step)) * 1.2 * moving * calm + 1.0 * w,
    },
    legL: {
      rot: -stride + 0.35 * w - 0.3 * s,
      dy: -Math.max(0, -Math.cos(st.step)) * 1.2 * moving * calm + 1.0 * w,
    },
  };
}

export const anim: RigAnim = {
  rawPose: (e, time) => emberPose(e, time),
  facing,
  tau: 0.04,
};
