// M11: Chrono-Auge (chrono_eye) — schwebender Zeit-Augapfel mit Iris, 3 konzentrischen Uhr-Ringen & rotierendem Uhrzeiger.
// Rein darstellend: keine Hitbox-/Schadensänderung, kein Zufall, Zeit nur über `time`.
import type { Pose } from '../../../engine/rig';
import type { Enemy } from '../../dungeonTypes';
import type { RigAnim } from '../rigAnim';

const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
const HIT_TIME = 0.14;
const FIRE_TIME = 0.2;
const RECOVER_TIME = 0.24;

interface ChronoState {
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
const states = new WeakMap<Enemy, ChronoState>();

function chronoPose(e: Enemy, time: number): Pose {
  let st = states.get(e);
  if (!st) {
    st = { wind: 0, fire: 0, recover: 0, wasTele: false, hit: 0, hitDir: 1, wasFlash: false, ringA: e.id * 1.1, time };
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

  st.ringA += dt * (1.4 + 4.8 * w + 7.0 * f);
  const hover = Math.sin(time * 4.8 + e.id * 1.5) * (2.2 - 1.0 * w);
  const shake = tele ? Math.sin(time * 66 + e.id) * 0.4 : 0;
  const aim = Number.isFinite(e.aimAngle) ? e.aimAngle : 0;

  return {
    eyeball: {
      rot: 0.16 * h * st.hitDir,
      dx: shake + 1.0 * h * st.hitDir,
      dy: hover - 0.6 * w + 0.5 * rk,
      sx: 1 + 0.12 * w + 0.18 * f - 0.04 * rk,
      sy: 1 + 0.12 * w + 0.18 * f - 0.04 * rk - 0.06 * h,
    },
    iris: {
      dx: Math.cos(aim) * 1.8,
      dy: Math.sin(aim) * 1.5,
      sx: 1 + 0.22 * w + 0.15 * f,
      sy: 1 + 0.22 * w + 0.15 * f,
    },
    ringOut: {
      rot: st.ringA * 0.7,
      sx: 1 + 0.08 * w + 0.12 * f,
      sy: 1 + 0.08 * w + 0.12 * f,
    },
    ringMid: {
      rot: -st.ringA * 1.3,
      sx: 1 + 0.06 * f,
      sy: 1 + 0.06 * f,
    },
    ringIn: {
      rot: st.ringA * 2.1,
    },
    hand: {
      rot: Math.floor(time * 3) * 0.52 + st.ringA * (1.8 * w + 3.2 * f),
    },
  };
}

export const anim: RigAnim = {
  rawPose: (e, time) => chronoPose(e, time),
  facing: () => 1,
  tau: 0.04,
};
