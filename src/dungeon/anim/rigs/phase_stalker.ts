// M11: Phasen-Jäger (phase_stalker) — humanoides Gegner-Rig. Rein darstellend: keine Hitbox-/Schadensänderung, kein Zufall.
// Zustände (aus enemyAi): Pirschen (Beine gehen, Klingen hängen), Phasen-Vorwarnung (`telegraphTimer` 0,54 s: duckt sich,
// Klingen nach hinten gezogen, Körper flackert), Sturz-Angriff (`chargeActive` > 0: vorgebeugt, Klingen schlagen nach vorn).
import type { Pose } from '../../../engine/rig';
import type { Enemy } from '../../dungeonTypes';
import type { RigAnim } from '../rigAnim';

const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
const STRIKE_TIME = 0.24;

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
  time: number;
}
const states = new WeakMap<Enemy, StalkerState>();

function facing(e: Enemy, playerX: number): number {
  return playerX < e.x - 2 ? -1 : 1;
}

function stalkerPose(e: Enemy, time: number, lookDx: number, lookDy: number): Pose {
  let st = states.get(e);
  if (!st) {
    st = { step: e.id * 1.7, recover: 0, wasCharge: false, ready: 0, wind: 0, atk: 0, time };
    states.set(e, st);
  }
  const dt = clamp(time - st.time, 0, 0.1);
  st.time = time;
  const charging = e.chargeActive > 0;
  if (st.wasCharge && !charging) st.recover = 1;
  st.wasCharge = charging;
  st.recover = Math.max(0, st.recover - dt / 0.3);
  const toward = (v: number, t: number, rate: number): number => (v < t ? Math.min(t, v + rate * dt) : Math.max(t, v - rate * dt));
  const tele0 = e.telegraphTimer > 0;
  st.ready = toward(st.ready, 1, 3); // Kampfhaltung (Klingen leicht angehoben) baut sich nach dem Spawn/Rückfeder auf
  st.wind = toward(st.wind, tele0 ? 1 : 0, tele0 ? 7 : 5); // Ausholen: schnell hinein, weich hinaus
  st.atk = toward(st.atk, charging ? 1 : 0, charging ? 16 : 4); // Sturz: kurzer Anlauf, langsames Ausklingen
  const spd = Math.hypot(e.vx, e.vy);
  st.step += spd * dt * 0.16;
  const moving = clamp(spd / 40, 0, 1);
  const tele = e.telegraphTimer > 0;
  const w = st.wind; // 0…1 Ausholen
  const a = st.atk; // 0…1 Sturz
  const calm = clamp(1 - w - a, 0, 1); // Anteil „Pirschen“
  const sw = Math.sin(st.step);
  const bob = Math.abs(Math.cos(st.step)) * 1.2 * moving;
  const breathe = Math.sin(time * 2.4 + e.id) * 0.3;
  const aim = clamp(Math.atan2(lookDy, Math.max(10, lookDx)), -0.5, 0.5);
  const rk = st.recover;
  const strike = charging ? clamp(e.chargeActive / STRIKE_TIME, 0, 1) : 0; // 1 → 0 während des Sturzes
  const flick = tele ? 0.62 + 0.28 * Math.sin(time * 36) : 1;
  // Kampfhaltung beim Pirschen: leicht vorgebeugt, Klingen angewinkelt statt schlaff hängend
  const stance = st.ready;
  const lean = 0.1 * stance * calm + 0.05 * moving - 0.12 * w + 0.34 * a;
  const crouch = 2.0 * w + 0.8 * a;
  const legAmp = 0.7 * moving * calm + 0.95 * a;
  // Klingen: Pirschen −0,45/−0,2 (angewinkelt, gegenläufig schwingend) → Ausholen +0,9/+0,7 (zurück) → Sturz −2,0/−1,5 (nach vorn)
  const armR = calm * (-0.45 * stance - 0.22 * sw * moving) + w * 0.9 + a * (-1.95 + 0.6 * (1 - strike));
  const armL = calm * (-0.2 * stance + 0.22 * sw * moving) + w * 0.7 + a * (-1.45 + 0.5 * (1 - strike));
  return {
    torso: {
      rot: lean - 0.12 * rk,
      dy: -bob + breathe * calm + crouch,
      dx: 1.6 * a - 1.2 * w,
      sx: 1 + 0.06 * a - 0.04 * rk,
      sy: 1 - 0.05 * a - 0.1 * w * 0.3 + 0.03 * rk,
      alpha: flick,
    },
    head: { rot: -lean * 0.6 + aim * 0.35 + Math.sin(time * 1.8 + e.id) * 0.03, dy: 0.6 * w, alpha: flick },
    armR: { rot: armR, dy: 0.5 * w, alpha: flick },
    armL: { rot: armL, alpha: flick },
    legR: { rot: legAmp * sw - 0.4 * w * (1 - a) + 0.25 * a, dy: crouch * 0.4, alpha: flick },
    legL: { rot: -legAmp * sw + 0.4 * w * (1 - a) - 0.25 * a, dy: crouch * 0.4, alpha: flick },
  };
}

export const anim: RigAnim = {
  rawPose: (e, time, lookDx, lookDy) => stalkerPose(e, time, lookDx, lookDy),
  facing,
  tau: 0.05,
};
