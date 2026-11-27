// M11: Leere-Phantom (void_wraith) — schwebender Kapuzen-Geist (Robe, flatternder Saum, Kapuze, leuchtende Augen, 2 Energieklingen-Klauen).
// Rein darstellend: keine Hitbox-/Schadensänderung, kein Zufall, Zeit nur über `time`.
import type { Pose } from '../../../engine/rig';
import type { Enemy } from '../../dungeonTypes';
import type { RigAnim } from '../rigAnim';

const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
const HIT_TIME = 0.14;
const CAST_TIME = 0.24;
const RECOVER_TIME = 0.28;

interface WraithState {
  wind: number;
  cast: number;
  recover: number;
  wasTele: boolean;
  hit: number;
  hitDir: number;
  wasFlash: boolean;
  time: number;
}
const states = new WeakMap<Enemy, WraithState>();

function facing(e: Enemy, playerX: number): number {
  return playerX < e.x - 2 ? -1 : 1;
}

function wraithPose(e: Enemy, time: number): Pose {
  let st = states.get(e);
  if (!st) {
    st = { wind: 0, cast: 0, recover: 0, wasTele: false, hit: 0, hitDir: 1, wasFlash: false, time };
    states.set(e, st);
  }
  const dt = clamp(time - st.time, 0, 0.1);
  st.time = time;

  const tele = e.telegraphTimer > 0;
  if (st.wasTele && !tele) {
    st.cast = 1;
    st.recover = 1;
  }
  st.wasTele = tele;
  st.cast = Math.max(0, st.cast - dt / CAST_TIME);
  if (st.cast <= 0) st.recover = Math.max(0, st.recover - dt / RECOVER_TIME);

  const flashing = e.flashTimer > 0;
  if (flashing && !st.wasFlash) {
    st.hit = 1;
    st.hitDir = -st.hitDir;
  }
  st.wasFlash = flashing;
  st.hit = Math.max(0, st.hit - dt / HIT_TIME);

  const toward = (v: number, t: number, rate: number): number =>
    v < t ? Math.min(t, v + rate * dt) : Math.max(t, v - rate * dt);
  st.wind = toward(st.wind, tele ? 1 : 0, tele ? 9 : 6);

  const w = st.wind;
  const c = st.cast;
  const rk = st.cast > 0 ? 0 : st.recover;
  const h = st.hit * (1 - Math.max(w, c) * 0.65);

  const hover = Math.sin(time * 4.4 + e.id * 1.5) * 2.5;
  const lean = clamp(e.vx / 95, -0.18, 0.18);
  const sway = Math.sin(time * 5.2 + e.id) * 0.14;
  const shake = tele ? Math.sin(time * 66 + e.id) * 0.45 : 0;
  const eyeSc = 0.75 + 0.55 * w + 0.45 * c;

  return {
    robeTop: {
      rot: lean - 0.16 * w + 0.22 * c - 0.06 * rk + 0.18 * h * st.hitDir,
      dx: shake + 1.8 * c + 1.1 * h * st.hitDir,
      dy: hover - 1.5 * w - 0.8 * c + 0.5 * rk,
      sx: 1 - 0.08 * w + 0.1 * c,
      sy: 1 + 0.08 * w - 0.06 * c - 0.05 * h,
    },
    hem: {
      rot: sway - lean * 0.8 + 0.22 * w - 0.26 * c,
      sx: 1 + 0.08 * Math.sin(time * 6 + e.id) + 0.14 * c,
    },
    hood: {
      rot: -0.08 * w + 0.12 * c - 0.15 * h * st.hitDir,
      dy: -0.5 * w,
    },
    eyes: {
      sx: eyeSc,
      sy: eyeSc,
    },
    clawR: {
      rot: Math.sin(time * 3.8 + e.id) * 0.12 - 0.85 * w + 0.95 * c + 0.18 * rk + 0.16 * h * st.hitDir,
      dx: -1.0 * w + 2.4 * c,
      dy: -1.8 * w,
    },
    clawL: {
      rot: -Math.sin(time * 3.8 + e.id) * 0.12 + 0.75 * w - 0.85 * c - 0.15 * rk + 0.12 * h * st.hitDir,
      dx: 1.0 * w + 2.0 * c,
      dy: -1.4 * w,
    },
  };
}

export const anim: RigAnim = {
  rawPose: (e, time) => wraithPose(e, time),
  facing,
  tau: 0.045,
};
