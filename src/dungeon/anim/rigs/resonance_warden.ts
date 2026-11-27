// M11: Resonanz-Wächter (resonance_warden) — schwebender Gold-Amethyst-Monolith (Kernkörper, Auge normal/geladen, 2 Orbit-Kristalle, Schildplatte).
// Rein darstellend: keine Hitbox-/Schadensänderung, kein Zufall, Zeit nur über `time`.
// Zustände (aus enemyAi): Majestätisches Schweben + kreisende Orbit-Kristalle, Schildplatte schützt vorn (klappt bei
// `shieldDownTimer > 0` oder Angriff zur Seite weg) → Vorwarnung (`telegraphTimer` 0,52 s: Auge wechselt auf geladene Linse,
// Kristalle ziehen sich vibrierend zusammen) → 6-Wege-Schockpuls (0,22 s: Kristalle schnellen nach außen, Rumpf streckt sich)
// → Erholung (0,28 s) → Treffer-Zucken (Flanke `flashTimer`).
import type { Pose } from '../../../engine/rig';
import type { Enemy } from '../../dungeonTypes';
import type { RigAnim } from '../rigAnim';

const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
const HIT_TIME = 0.14;
const PULSE_TIME = 0.22;
const RECOVER_TIME = 0.28;

interface WardenState {
  wind: number;
  pulse: number;
  recover: number;
  shieldOpen: number;
  wasTele: boolean;
  hit: number;
  hitDir: number;
  wasFlash: boolean;
  time: number;
}
const states = new WeakMap<Enemy, WardenState>();

function facing(e: Enemy, playerX: number): number {
  return playerX < e.x - 2 ? -1 : 1;
}

function wardenPose(e: Enemy, time: number): Pose {
  let st = states.get(e);
  if (!st) {
    st = { wind: 0, pulse: 0, recover: 0, shieldOpen: 0, wasTele: false, hit: 0, hitDir: 1, wasFlash: false, time };
    states.set(e, st);
  }
  const dt = clamp(time - st.time, 0, 0.1);
  st.time = time;

  const tele = e.telegraphTimer > 0;
  if (st.wasTele && !tele) {
    st.pulse = 1;
    st.recover = 1;
  }
  st.wasTele = tele;
  st.pulse = Math.max(0, st.pulse - dt / PULSE_TIME);
  if (st.pulse <= 0) st.recover = Math.max(0, st.recover - dt / RECOVER_TIME);

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
  const openTarget = tele || (e.shieldDownTimer ?? 0) > 0 ? 1 : 0;
  st.shieldOpen = toward(st.shieldOpen, openTarget, 7);

  const w = st.wind;
  const p = st.pulse;
  const rk = st.pulse > 0 ? 0 : st.recover;
  const sh = st.shieldOpen;
  const h = st.hit * (1 - w * 0.65);

  const hover = Math.sin(time * 4.2 + e.id * 1.3) * (2.2 - 1.1 * w);
  const lean = clamp(e.vx / 95, -0.14, 0.14);
  const shake = tele ? Math.sin(time * 58 + e.id) * 0.45 : 0;

  // Orbit-Kristalle kreisen um den Monolithen; beim Laden ziehen sie sich eng an, beim Puls schnellen sie hinaus
  const ang = time * (2.2 + 3.2 * w + 4.0 * p) + e.id;
  const rx = 15 - 4.5 * w + 9 * p;
  const ry = 5.5 - 1.5 * w + 2.5 * p;

  return {
    torso: {
      rot: lean + 0.16 * h * st.hitDir,
      dx: shake + 1.1 * h * st.hitDir,
      dy: hover - 1.4 * w - 1.2 * p + 0.6 * rk,
      sx: 1 - 0.06 * w + 0.12 * p - 0.04 * rk,
      sy: 1 + 0.07 * w - 0.1 * p + 0.04 * rk - 0.05 * h,
    },
    eye: {
      variant: w > 0.25 || p > 0.2 ? 1 : 0,
      sx: 1 + 0.15 * w + 0.22 * p,
      sy: 1 + 0.15 * w + 0.22 * p,
    },
    shield: {
      dx: -3 - 8 * sh,
      dy: Math.sin(time * 4.2 + e.id + 0.8) * 0.8 - 2.5 * sh,
      rot: -0.55 * sh + 0.15 * h * st.hitDir,
      sx: 1 - 0.25 * sh,
      sy: 1 - 0.15 * sh,
    },
    crysL: {
      dx: Math.cos(ang) * rx,
      dy: Math.sin(ang) * ry - 2,
      rot: Math.sin(ang) * 0.25 + 0.35 * p,
    },
    crysS: {
      dx: Math.cos(ang + Math.PI) * (rx * 0.88),
      dy: Math.sin(ang + Math.PI) * ry + 2,
      rot: -Math.sin(ang) * 0.3 - 0.35 * p,
    },
  };
}

export const anim: RigAnim = {
  rawPose: (e, time) => wardenPose(e, time),
  facing,
  tau: 0.045,
};
