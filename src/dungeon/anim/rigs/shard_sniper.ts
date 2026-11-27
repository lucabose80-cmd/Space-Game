// M11: Splitter-Scharfschütze (shard_sniper) — schwebender Jetpack-Schütze (Rumpf+Kopf, Jetpack, Kristall-Lanzengewehr, Arm R/L, Beine).
// Rein darstellend: keine Hitbox-/Schadensänderung, kein Zufall, Zeit nur über `time`.
// Zustände (aus enemyAi): Schweben (Jetpack-Bobbing, Flugneigung aus vx, träge pendelnde Beine) → Vorwarnung
// (`telegraphTimer` 0,65 s: Gewehr zielt entlang aimAngle, Ziel-Lock < 0,26 s mit Lade-Zittern) → Schuss-Rückstoß (0,24 s)
// → Erholung (0,30 s) → Treffer-Zucken (Flanke `flashTimer`).
import type { Pose } from '../../../engine/rig';
import type { Enemy } from '../../dungeonTypes';
import type { RigAnim } from '../rigAnim';

const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
const HIT_TIME = 0.14;
const RECOIL_TIME = 0.24;
const RECOVER_TIME = 0.3;

interface SniperState {
  wind: number;
  recoil: number;
  recover: number;
  wasTele: boolean;
  hit: number;
  hitDir: number;
  wasFlash: boolean;
  time: number;
}
const states = new WeakMap<Enemy, SniperState>();

function facing(e: Enemy, playerX: number): number {
  if (e.telegraphTimer > 0 && Number.isFinite(e.aimAngle)) {
    const cx = Math.cos(e.aimAngle);
    if (Math.abs(cx) > 0.08) return cx < 0 ? -1 : 1;
  }
  return playerX < e.x - 2 ? -1 : 1;
}

function sniperPose(e: Enemy, time: number): Pose {
  let st = states.get(e);
  if (!st) {
    st = { wind: 0, recoil: 0, recover: 0, wasTele: false, hit: 0, hitDir: 1, wasFlash: false, time };
    states.set(e, st);
  }
  const dt = clamp(time - st.time, 0, 0.1);
  st.time = time;

  const tele = e.telegraphTimer > 0;
  const locked = tele && e.telegraphTimer <= 0.26;
  if (st.wasTele && !tele) {
    st.recoil = 1;
    st.recover = 1;
  }
  st.wasTele = tele;
  st.recoil = Math.max(0, st.recoil - dt / RECOIL_TIME);
  if (st.recoil <= 0) st.recover = Math.max(0, st.recover - dt / RECOVER_TIME);

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

  const w = st.wind;
  const rc = st.recoil;
  const rk = st.recoil > 0 ? 0 : st.recover;
  const h = st.hit * (1 - w * 0.65);
  const calm = clamp(1 - w - rc, 0, 1);

  const spd = Math.hypot(e.vx, e.vy);
  const moving = clamp(spd / 55, 0, 1);
  const hover = Math.sin(time * 4.2 + e.id * 1.7) * (1.8 - 1.1 * w);
  const lean = clamp(e.vx / 90, -0.18, 0.18) * calm;
  const shake = locked ? Math.sin(time * 68 + e.id) * 0.45 : 0;

  // Lokaler Zielwinkel entlang aimAngle (0 = geradeaus)
  const localAim = Number.isFinite(e.aimAngle)
    ? clamp(Math.atan2(Math.sin(e.aimAngle), Math.max(0.15, Math.abs(Math.cos(e.aimAngle)))), -0.75, 0.75)
    : 0;
  const aimRot = localAim * (0.35 + 0.65 * w);

  return {
    torso: {
      rot: lean - 0.1 * w - 0.22 * rc + 0.08 * rk + 0.18 * h * st.hitDir,
      dx: -1.2 * w - 2.4 * rc + 0.5 * rk + shake + 1.2 * h * st.hitDir,
      dy: hover - 0.6 * w - 0.8 * rc + 0.5 * rk,
      sx: 1 + 0.04 * rc,
      sy: 1 - 0.05 * rc - 0.05 * h,
    },
    jetpack: {
      rot: -0.06 - 0.12 * moving + 0.14 * rc + Math.sin(time * 8 + e.id) * 0.03,
      sx: 1 + 0.08 * moving + 0.16 * rc,
      sy: 1 + 0.1 * Math.sin(time * 16 + e.id) * (0.4 + 0.6 * moving) + 0.22 * rc,
    },
    legs: {
      rot: -0.18 * moving + Math.sin(time * 3.6 + e.id) * 0.09 + 0.22 * rc - 0.08 * w + 0.14 * h * st.hitDir,
      dy: 0.4 * Math.cos(time * 4.2 + e.id) * calm,
    },
    armR: {
      rot: aimRot * 0.75 - 0.28 * rc + 0.12 * rk + 0.15 * calm + 0.15 * h * st.hitDir,
      dx: -1.4 * rc + 0.5 * w,
      dy: -0.6 * w - 0.8 * rc,
    },
    armL: {
      rot: 0.05 + aimRot * 0.65 - 0.1 * w - 0.25 * rc + 0.12 * rk + 0.1 * h * st.hitDir,
      dx: 0.5 * w - 1.0 * rc,
      dy: 0.4 - 0.4 * w,
    },
    rifle: {
      rot: aimRot * 0.35 - 0.22 * rc + 0.08 * rk + (locked ? Math.sin(time * 75) * 0.03 : 0),
      dx: -1.8 * rc + 0.6 * w,
      dy: -0.4 * rc,
    },
  };
}

export const anim: RigAnim = {
  rawPose: (e, time) => sniperPose(e, time),
  facing,
  tau: 0.045,
};
