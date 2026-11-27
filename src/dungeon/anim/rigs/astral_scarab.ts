// M11: Astral-Skarabäus (astral_scarab) — Obsidian-Gold-Skarabäus mit aufklappenden Kristall-Flügeln & 4 Beinen.
// Rein darstellend: keine Hitbox-/Schadensänderung, kein Zufall, Zeit nur über `time`.
import type { Pose } from '../../../engine/rig';
import type { Enemy } from '../../dungeonTypes';
import type { RigAnim } from '../rigAnim';

const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
const HIT_TIME = 0.14;

interface ScarabState {
  step: number;
  wind: number;
  atk: number;
  recover: number;
  wasCharge: boolean;
  hit: number;
  hitDir: number;
  wasFlash: boolean;
  time: number;
}
const states = new WeakMap<Enemy, ScarabState>();

function scarabPose(e: Enemy, time: number): Pose {
  let st = states.get(e);
  if (!st) {
    st = { step: e.id * 1.2, wind: 0, atk: 0, recover: 0, wasCharge: false, hit: 0, hitDir: 1, wasFlash: false, time };
    states.set(e, st);
  }
  const dt = clamp(time - st.time, 0, 0.1);
  st.time = time;

  const charging = e.chargeActive > 0;
  if (st.wasCharge && !charging) st.recover = 1;
  st.wasCharge = charging;
  st.recover = Math.max(0, st.recover - dt / 0.34);

  const flashing = e.flashTimer > 0;
  if (flashing && !st.wasFlash) {
    st.hit = 1;
    st.hitDir = -st.hitDir;
  }
  st.wasFlash = flashing;
  st.hit = Math.max(0, st.hit - dt / HIT_TIME);

  const toward = (v: number, t: number, rate: number): number =>
    v < t ? Math.min(t, v + rate * dt) : Math.max(t, v - rate * dt);
  const tele = e.telegraphTimer > 0;
  st.wind = toward(st.wind, tele ? 1 : 0, tele ? 9 : 6);
  st.atk = toward(st.atk, charging ? 1 : 0, charging ? 18 : 6);

  const spd = Math.hypot(e.vx, e.vy);
  st.step += spd * dt * 0.24;
  const moving = clamp(spd / 40, 0, 1);

  const w = st.wind;
  const a = st.atk;
  const rk = st.recover;
  const h = st.hit * (1 - Math.max(w, a) * 0.7);
  const calm = clamp(1 - w - a, 0, 1);

  const shake = tele ? Math.sin(time * 68 + e.id) * 0.45 : 0;
  const open = w > 0.25 || a > 0.2 ? 1 : 0;
  const flutter = open ? Math.sin(time * 62) * 0.16 : 0;
  const sA = Math.sin(st.step) * 0.45 * moving * calm;
  const sB = Math.sin(st.step + Math.PI) * 0.45 * moving * calm;

  return {
    body: {
      rot: 0.16 * h * st.hitDir + Math.sin(st.step) * 0.05 * moving * calm,
      dx: shake + 1.0 * h * st.hitDir,
      dy: -Math.abs(Math.cos(st.step)) * 0.8 * moving * calm + 1.5 * w - 1.8 * a + 0.5 * rk,
      sx: 1 + 0.09 * w - 0.06 * a + 0.05 * rk,
      sy: 1 - 0.09 * w + 0.12 * a - 0.05 * rk - 0.06 * h,
    },
    head: {
      rot: Math.sin(time * 4 + e.id) * 0.08 * calm - 0.16 * h * st.hitDir,
      dy: -0.6 * a + 0.4 * w,
    },
    wingL: {
      variant: open,
      rot: (open ? 0.25 : 0) + flutter,
      dx: open ? -1.5 : 0,
    },
    wingR: {
      variant: open,
      sx: -1,
      rot: (open ? -0.25 : 0) - flutter,
      dx: open ? 1.5 : 0,
    },
    legFL: { rot: sA - 0.28 * a },
    legBL: { rot: sB + 0.28 * a },
    legFR: { sx: -1, rot: -sB + 0.28 * a },
    legBR: { sx: -1, rot: -sA - 0.28 * a },
  };
}

export const anim: RigAnim = {
  rawPose: (e, time) => scarabPose(e, time),
  facing: () => 1,
  tau: 0.045,
};
