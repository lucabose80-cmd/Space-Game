// M11: Phasen-Jäger (phase_stalker) — humanoides Gegner-Rig. Rein darstellend: keine Hitbox-/Schadensänderung, kein Zufall.
// Zustände (aus enemyAi): Pirschen (Beine gehen, Kampfhaltung), Phasen-Vorwarnung (`telegraphTimer` 0,54 s: duckt sich,
// vordere Klinge ausgeholt, Körper flackert, Phasen-Riss), Sturz-Angriff (`chargeActive` > 0: Ankunfts-Funkenring, Hieb nach
// vorn mit Schlagbogen), Erholung (Rückfeder), Treffer-Zucken (`flashTimer`) und Tod (`stalkerDeathPose`, vom Renderer gezeichnet).
// Vorderer Arm = Pose-Set `armR_0…5` (P1-09), Effekte = `phase_stalker_fx` (P1-08).
import type { Pose } from '../../../engine/rig';
import type { Enemy } from '../../dungeonTypes';
import type { RigAnim } from '../rigAnim';

const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
const STRIKE_TIME = 0.24;
const HIT_TIME = 0.14;
const ARRIVE_TIME = 0.3;
/** Dauer der Todes-Animation (s) — der Renderer zeichnet sie an der zuletzt gesehenen Position. */
export const STALKER_DEATH_TIME = 0.6;

interface StalkerState {
  /** Schrittphase aus zurückgelegter Strecke (rad) */
  step: number;
  /** Nachwirkung nach dem Angriff (Rückfederung), 1 → 0 */
  recover: number;
  wasCharge: boolean;
  /** weich überblendete Zustände 0…1: Lauern (Kampfhaltung), Ausholen, Sturz */
  ready: number;
  wind: number;
  atk: number;
  /** Ankunfts-Effekt (Funkenring) nach dem Phasen-Sprung, 1 → 0 */
  arrive: number;
  /** Treffer-Zucken 1 → 0, Richtung wechselt je Treffer */
  hit: number;
  hitDir: number;
  wasFlash: boolean;
  time: number;
}
const states = new WeakMap<Enemy, StalkerState>();

function facing(e: Enemy, playerX: number): number {
  return playerX < e.x - 2 ? -1 : 1;
}

function stalkerPose(e: Enemy, time: number, lookDx: number, lookDy: number): Pose {
  let st = states.get(e);
  if (!st) {
    st = { step: e.id * 1.7, recover: 0, wasCharge: false, ready: 0, wind: 0, atk: 0, arrive: 0, hit: 0, hitDir: 1, wasFlash: false, time };
    states.set(e, st);
  }
  const dt = clamp(time - st.time, 0, 0.1);
  st.time = time;
  const charging = e.chargeActive > 0;
  if (st.wasCharge && !charging) st.recover = 1;
  if (!st.wasCharge && charging) st.arrive = 1; // Phasen-Sprung abgeschlossen → Ankunfts-Funkenring
  st.wasCharge = charging;
  st.recover = Math.max(0, st.recover - dt / 0.3);
  st.arrive = Math.max(0, st.arrive - dt / ARRIVE_TIME);
  const flashing = e.flashTimer > 0;
  if (flashing && !st.wasFlash) {
    st.hit = 1;
    st.hitDir = -st.hitDir;
  }
  st.wasFlash = flashing;
  st.hit = Math.max(0, st.hit - dt / HIT_TIME);
  const toward = (v: number, t: number, rate: number): number => (v < t ? Math.min(t, v + rate * dt) : Math.max(t, v - rate * dt));
  const tele = e.telegraphTimer > 0;
  st.ready = toward(st.ready, 1, 3); // Kampfhaltung baut sich nach dem Spawn/Rückfeder auf
  st.wind = toward(st.wind, tele ? 1 : 0, tele ? 7 : 5); // Ausholen: schnell hinein, weich hinaus
  st.atk = toward(st.atk, charging ? 1 : 0, charging ? 16 : 4); // Sturz: kurzer Anlauf, langsames Ausklingen
  const spd = Math.hypot(e.vx, e.vy);
  st.step += spd * dt * 0.16;
  const moving = clamp(spd / 40, 0, 1);
  const p = tele ? clamp(1 - e.telegraphTimer / 0.54, 0, 1) : 0; // 0 → 1 in der Vorwarnung
  const w = st.wind;
  const a = st.atk;
  const calm = clamp(1 - w - a, 0, 1); // Anteil „Pirschen“
  const sw = Math.sin(st.step);
  const bob = Math.abs(Math.cos(st.step)) * 1.2 * moving;
  const breathe = Math.sin(time * 2.4 + e.id) * 0.3;
  const aim = clamp(Math.atan2(lookDy, Math.max(10, lookDx)), -0.5, 0.5);
  const rk = st.recover;
  const strike = charging ? clamp(e.chargeActive / STRIKE_TIME, 0, 1) : 0; // 1 → 0 während des Sturzes
  const h = st.hit * (1 - Math.max(w, a) * 0.7); // Treffer-Zucken, in Angriffsposen gedämpft
  const flick = tele ? 0.62 + 0.28 * Math.sin(time * 36) : 1;
  const lean = 0.1 * st.ready * calm + 0.05 * moving - 0.12 * w + 0.34 * a;
  const crouch = 2.0 * w + 0.8 * a;
  const legAmp = 0.7 * moving * calm + 0.95 * a;

  // Vorderer Arm (Pose-Set): 0 hängend/Pirschen · 1 ausholen · 2 Schlag vorn · 3 Schlag diagonal · 4 Block (Treffer) · 5 Rückzug
  let armVar = 0;
  if (a > 0.3) armVar = strike > 0.45 ? 2 : 3;
  else if (w > 0.35) armVar = 1;
  else if (rk > 0.35) armVar = 5;
  else if (h > 0.2) armVar = 4;
  const armRot = armVar === 0 ? 0.2 * sw * moving : 0;
  const armL = calm * (-0.2 * st.ready + 0.22 * sw * moving) + w * 0.7 + a * (-1.45 + 0.5 * (1 - strike));
  const slashBig = charging && strike > 0.45 ? clamp((strike - 0.45) * 5, 0, 1) : 0;
  const slashSmall = charging && strike <= 0.45 ? clamp(strike * 4, 0, 1) : 0;
  const riftA = tele ? clamp((p - 0.55) / 0.45, 0, 1) * 0.9 : st.arrive * 0.7;

  return {
    torso: {
      rot: lean - 0.12 * rk + 0.16 * h * st.hitDir,
      dy: -bob + breathe * calm + crouch,
      dx: 1.6 * a - 1.2 * w + 1.1 * h * st.hitDir,
      sx: 1 + 0.06 * a - 0.04 * rk,
      sy: 1 - 0.05 * a - 0.03 * w + 0.03 * rk,
      alpha: flick,
    },
    head: { rot: -lean * 0.6 + aim * 0.35 + Math.sin(time * 1.8 + e.id) * 0.03 - 0.2 * h * st.hitDir, dy: 0.6 * w, alpha: flick },
    armR: { variant: armVar, rot: armRot, dy: 0.5 * w, alpha: flick },
    armL: { rot: armL, alpha: flick },
    legR: { rot: legAmp * sw - 0.4 * w * (1 - a) + 0.25 * a, dy: crouch * 0.4, alpha: flick },
    legL: { rot: -legAmp * sw + 0.4 * w * (1 - a) - 0.25 * a, dy: crouch * 0.4, alpha: flick },
    slashL: { hidden: slashBig <= 0, alpha: slashBig, sx: 0.7, sy: 0.7, rot: -0.15 },
    slashS: { hidden: slashSmall <= 0, alpha: slashSmall, sx: 0.65, sy: 0.65, rot: 0.2 },
    rift: { hidden: riftA <= 0.02, alpha: riftA, sy: 0.7 + 0.3 * (tele ? p : 1 - st.arrive), sx: 0.8 },
    arrive: { hidden: st.arrive <= 0.02, alpha: st.arrive, sx: 0.5 + 0.7 * (1 - st.arrive), sy: 0.3 + 0.4 * (1 - st.arrive) },
    ghost: { hidden: true },
    shards: { hidden: true },
  };
}

/** Todespose (t = Sekunden seit dem Tod): Kopf und Arme fliegen ab, Beine knicken ein, Rumpf kippt nach hinten, Energiesplitter + Riss. */
export function stalkerDeathPose(t: number, id: number): Pose {
  const u = clamp(t / STALKER_DEATH_TIME, 0, 1);
  const fall = Math.min(u * u * 15, 12);
  const fade = clamp(1.25 - u, 0, 1);
  const s = id % 2 === 0 ? 1 : -1;
  return {
    torso: { rot: -0.55 * u * s, dy: fall * 0.7, dx: -5 * u * s, alpha: fade, sy: 1 - 0.1 * u },
    head: { rot: 5 * u * s, dx: 15 * u * s, dy: -16 * u + fall * 1.6, alpha: fade },
    armR: { variant: 5, rot: 3.2 * u * s, dx: 18 * u, dy: -9 * u + fall * 1.4, alpha: fade },
    armL: { rot: -3 * u, dx: -15 * u, dy: -6 * u + fall * 1.3, alpha: fade },
    legR: { rot: 0.9 * u, dx: 3 * u, dy: fall * 0.5, alpha: fade },
    legL: { rot: -1.0 * u, dx: -3 * u, dy: fall * 0.5, alpha: fade },
    slashL: { hidden: true },
    slashS: { hidden: true },
    rift: { hidden: u > 0.55, alpha: clamp(1 - u * 1.8, 0, 1), sx: 0.9 + u, sy: 1 + u * 0.6 },
    arrive: { hidden: true },
    ghost: { hidden: true },
    shards: { hidden: u > 0.85, alpha: clamp(1.2 - u * 1.3, 0, 1), sx: 0.6 + u * 1.4, sy: 0.6 + u * 1.4, rot: u * 2.5, dy: -8 - 10 * u },
  };
}

export const anim: RigAnim = {
  rawPose: (e, time, lookDx, lookDy) => stalkerPose(e, time, lookDx, lookDy),
  facing,
  tau: 0.05,
  noPulse: ['slashL', 'slashS', 'rift', 'arrive', 'shards'],
};
