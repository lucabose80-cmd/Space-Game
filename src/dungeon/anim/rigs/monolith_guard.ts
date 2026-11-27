// M11: Monolith-Wächter (monolith_guard) — schwerer Obsidian-Gold-Templer (Rumpf, Helm, Morgenstern-Arm, Turmschild-Arm, 2 Beine).
// Rein darstellend: keine Hitbox-/Schadensänderung, kein Zufall, Zeit nur über `time`.
import type { Pose } from '../../../engine/rig';
import type { Enemy } from '../../dungeonTypes';
import type { RigAnim } from '../rigAnim';

const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
const HIT_TIME = 0.14;
const SLAM_TIME = 0.24;
const RECOVER_TIME = 0.32;

interface MonolithState {
  step: number;
  wind: number;
  slam: number;
  recover: number;
  wasTele: boolean;
  hit: number;
  hitDir: number;
  wasFlash: boolean;
  time: number;
}
const states = new WeakMap<Enemy, MonolithState>();

function facing(e: Enemy, playerX: number): number {
  return playerX < e.x - 2 ? -1 : 1;
}

function monolithPose(e: Enemy, time: number): Pose {
  let st = states.get(e);
  if (!st) {
    st = { step: e.id * 0.9, wind: 0, slam: 0, recover: 0, wasTele: false, hit: 0, hitDir: 1, wasFlash: false, time };
    states.set(e, st);
  }
  const dt = clamp(time - st.time, 0, 0.1);
  st.time = time;

  const tele = e.telegraphTimer > 0;
  if (st.wasTele && !tele) {
    st.slam = 1;
    st.recover = 1;
  }
  st.wasTele = tele;
  st.slam = Math.max(0, st.slam - dt / SLAM_TIME);
  if (st.slam <= 0) st.recover = Math.max(0, st.recover - dt / RECOVER_TIME);

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
  st.step += spd * dt * 0.14;
  const moving = clamp(spd / 32, 0, 1);

  const w = st.wind;
  const s = st.slam;
  const rk = st.slam > 0 ? 0 : st.recover;
  const h = st.hit * (1 - Math.max(w, s) * 0.7);
  const calm = clamp(1 - w - s, 0, 1);

  const stride = Math.sin(st.step) * 0.4 * moving * calm;
  const stomp = Math.abs(Math.cos(st.step)) * 1.2 * moving * calm;
  const shake = tele ? Math.sin(time * 54 + e.id) * 0.4 : 0;

  return {
    torso: {
      rot: Math.sin(st.step) * 0.05 * moving * calm - 0.15 * w + 0.22 * s - 0.08 * rk + 0.14 * h * st.hitDir,
      dx: shake + 1.0 * h * st.hitDir,
      dy: -stomp - 1.0 * w + 2.2 * s + 0.5 * rk,
      sx: 1 + 0.05 * w + 0.08 * s,
      sy: 1 + 0.05 * w - 0.1 * s - 0.04 * h,
    },
    head: {
      rot: -0.08 * w + 0.12 * s - 0.14 * h * st.hitDir,
    },
    armMace: {
      rot: -stride * 0.6 - 0.95 * w + 0.85 * s + 0.18 * rk + 0.16 * h * st.hitDir,
      dy: -2.0 * w + 1.8 * s,
    },
    armShield: {
      rot: stride * 0.4 - 0.25 * w + 0.28 * s + 0.1 * h * st.hitDir,
      dx: -1.2 * w + 1.8 * s,
      dy: -1.0 * w,
    },
    legR: {
      rot: stride - 0.16 * w + 0.18 * s,
      dy: -Math.max(0, Math.cos(st.step)) * 1.1 * moving * calm,
    },
    legL: {
      rot: -stride + 0.16 * w - 0.14 * s,
      dy: -Math.max(0, -Math.cos(st.step)) * 1.1 * moving * calm,
    },
  };
}

export const anim: RigAnim = {
  rawPose: (e, time) => monolithPose(e, time),
  facing,
  tau: 0.05,
};
