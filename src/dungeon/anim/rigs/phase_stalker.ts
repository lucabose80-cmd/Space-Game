// M11: Phasen-Jäger (phase_stalker) — humanoides Gegner-Rig. Rein darstellend: keine Hitbox-/Schadensänderung, kein Zufall.
// Zustände (aus enemyAi): Pirschen (Beine gehen, Klingen hängen), Phasen-Vorwarnung (`telegraphTimer` 0,54 s: duckt sich,
// Klingen nach hinten gezogen, Körper flackert), Sturz-Angriff (`chargeActive` > 0: vorgebeugt, Klingen schlagen nach vorn).
import type { Pose } from '../../../engine/rig';
import type { Enemy } from '../../dungeonTypes';
import type { RigAnim } from '../rigAnim';

const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
const PHASE_TELEGRAPH = 0.54;
const STRIKE_TIME = 0.24;

interface StalkerState {
  /** Schrittphase aus zurückgelegter Strecke (rad) */
  step: number;
  /** Nachwirkung nach dem Angriff (Rückfederung), 1 → 0 */
  recover: number;
  wasCharge: boolean;
  time: number;
}
const states = new WeakMap<Enemy, StalkerState>();

function facing(e: Enemy, playerX: number): number {
  return playerX < e.x - 2 ? -1 : 1;
}

function stalkerPose(e: Enemy, time: number, lookDx: number, lookDy: number): Pose {
  let st = states.get(e);
  if (!st) {
    st = { step: e.id * 1.7, recover: 0, wasCharge: false, time };
    states.set(e, st);
  }
  const dt = clamp(time - st.time, 0, 0.1);
  st.time = time;
  const charging = e.chargeActive > 0;
  if (st.wasCharge && !charging) st.recover = 1;
  st.wasCharge = charging;
  st.recover = Math.max(0, st.recover - dt / 0.3);
  const spd = Math.hypot(e.vx, e.vy);
  st.step += spd * dt * 0.16;
  const moving = clamp(spd / 40, 0, 1);
  const tele = e.telegraphTimer > 0;
  const p = tele ? clamp(1 - e.telegraphTimer / PHASE_TELEGRAPH, 0, 1) : 0; // 0 → 1 in der Vorwarnung
  const sw = Math.sin(st.step);
  const bob = Math.abs(Math.cos(st.step)) * 1.1 * moving;
  const breathe = Math.sin(time * 2.4 + e.id) * 0.3;
  const aim = clamp(Math.atan2(lookDy, Math.max(10, lookDx)), -0.5, 0.5);
  const rk = st.recover;
  const strike = charging ? clamp(e.chargeActive / STRIKE_TIME, 0, 1) : 0; // 1 → 0 während des Sturzes
  const lean = charging ? 0.32 : tele ? -0.1 * p : 0.05 * moving; // Rumpfneigung (+ = nach vorn)
  const crouch = tele ? 2.2 * p : 0;

  const legSwing = charging ? 0.9 : 0.55 * moving;
  return {
    torso: {
      rot: lean - 0.12 * rk,
      dy: -bob + breathe + crouch,
      dx: charging ? 1.6 : tele ? -1.2 * p : 0,
      sx: charging ? 1.06 : 1 - 0.04 * rk,
      sy: charging ? 0.95 : 1 + 0.03 * rk,
      alpha: tele ? 0.62 + 0.28 * Math.sin(time * 36) : 1,
    },
    head: {
      rot: -lean * 0.6 + aim * 0.35 + Math.sin(time * 1.8 + e.id) * 0.03,
      dy: tele ? 0.6 * p : 0,
      alpha: tele ? 0.62 + 0.28 * Math.sin(time * 36) : 1,
    },
    // vordere Klinge (R): hängt, bei der Vorwarnung nach hinten gezogen, beim Sturz nach vorn geschlagen
    armR: {
      rot: charging ? -1.9 + 0.7 * (1 - strike) : tele ? 0.9 * p : -0.25 * sw * moving + 0.08,
      dy: tele ? 0.5 * p : 0,
      alpha: tele ? 0.62 + 0.28 * Math.sin(time * 36) : 1,
    },
    // hintere Klinge (L): gegenläufig zur vorderen
    armL: {
      rot: charging ? -1.4 + 0.5 * (1 - strike) : tele ? 0.7 * p : 0.25 * sw * moving + 0.05,
      alpha: tele ? 0.62 + 0.28 * Math.sin(time * 36) : 1,
    },
    legR: {
      rot: legSwing * sw + (tele ? -0.4 * p : 0),
      dy: crouch * 0.4,
      alpha: tele ? 0.62 + 0.28 * Math.sin(time * 36) : 1,
    },
    legL: {
      rot: -legSwing * sw + (tele ? 0.4 * p : 0),
      dy: crouch * 0.4,
      alpha: tele ? 0.62 + 0.28 * Math.sin(time * 36) : 1,
    },
  };
}

export const anim: RigAnim = {
  rawPose: (e, time, lookDx, lookDy) => stalkerPose(e, time, lookDx, lookDy),
  facing,
  tau: 0.04,
};
