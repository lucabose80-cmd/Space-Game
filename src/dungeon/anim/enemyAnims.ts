// M11 Phase 7: Posen für Gegner-Rigs (normale Gegner, Teile-Sheets Typ G). Rein darstellend — keine Hitbox-/Schadensänderung, kein Zufall.
import type { Enemy } from '../dungeonTypes';
import type { Pose } from '../../engine/rig';

const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));

/** Länge der Schuss-Vorwarnung des Geschützes (enemyAi: `telegraphTimer = 0.46`). */
const TURRET_TELEGRAPH = 0.46;
/** Rückstoß-Dauer nach dem Schuss (s). */
const TURRET_RECOIL = 0.22;

interface TurretState {
  /** Ketten-Rollphase (aus zurückgelegter Strecke) und Bremsfunken-Timer */
  tread: number;
  brake: number;
  wasMoving: boolean;
  wasTelegraph: boolean;
  recoil: number;
  time: number;
}
const turretStates = new WeakMap<Enemy, TurretState>();

/** Blickrichtung des Geschütz-Rigs: −1 = Spieler links (Rig spiegeln), +1 = rechts. */
export function turretFacing(e: Enemy, playerX: number): number {
  return playerX < e.x - 2 ? -1 : 1;
}

/**
 * Geschütz: Gehäuse neigt sich zum Spieler (Spiegelung übernimmt der Renderer), Rohr fährt in der Vorwarnung aus,
 * Mündungsring + Lade-Kern glühen auf, nach dem Schuss Rückstoß; beim Umsetzen (Scurry) wippt der Körper.
 * `aimDy`/`aimDx` = Spieler minus Geschütz (für die Neigung).
 */
export function turretPose(e: Enemy, time: number, aimDx: number, aimDy: number): Pose {
  let st = turretStates.get(e);
  if (!st) {
    st = { tread: e.id, brake: 0, wasMoving: false, wasTelegraph: false, recoil: 0, time };
    turretStates.set(e, st);
  }
  const dt = Math.max(0, Math.min(0.1, time - st.time));
  st.time = time;
  const tele = e.telegraphTimer > 0;
  if (st.wasTelegraph && !tele) st.recoil = TURRET_RECOIL; // Vorwarnung zu Ende = Schuss
  st.wasTelegraph = tele;
  st.recoil = Math.max(0, st.recoil - dt);
  const spd = Math.hypot(e.vx, e.vy);
  st.tread += spd * dt * 0.2; // Kettenphase aus Strecke: steht das Geschütz, steht die Kette
  const rolling = spd > 8;
  if (st.wasMoving && !rolling) st.brake = 0.18; // Anhalten: kurze Bremsfunken
  st.wasMoving = rolling;
  st.brake = Math.max(0, st.brake - dt);
  const treadVar = Math.floor(st.tread) % 4;
  const p = tele ? clamp(1 - e.telegraphTimer / TURRET_TELEGRAPH, 0, 1) : 0;
  const rk = st.recoil / TURRET_RECOIL; // 1 → 0
  const speed = Math.hypot(e.vx, e.vy);
  const moving = clamp(speed / 60, 0, 1);
  const tilt = clamp(Math.atan2(aimDy, Math.max(8, Math.abs(aimDx))), -0.5, 0.5);
  const bob = Math.abs(Math.sin(time * 22 + e.id)) * 1.4 * moving;
  const rock = Math.sin(time * 22 + e.id) * 0.06 * moving;
  const breathe = Math.sin(time * 2.2 + e.id) * 0.25;
  return {
    base: { dy: -bob * 0.5, rot: rock },
    treadL: { variant: treadVar, dy: bob * 0.3 },
    treadR: { variant: (treadVar + 2) % 4, dy: bob * 0.3 }, // gegenläufige Phase wirkt weniger „synchron“
    dust: { hidden: !rolling, alpha: 0.5 * moving * (0.6 + 0.4 * Math.sin(time * 18 + e.id)), dx: clamp(-e.vx * 0.12, -6, 6), dy: clamp(-e.vy * 0.05, -2, 2), sx: 0.7 + 0.3 * moving, sy: 0.7 + 0.3 * moving },
    brake: { hidden: st.brake <= 0, alpha: st.brake / 0.18, sx: 0.6 + 0.4 * (1 - st.brake / 0.18), sy: 0.6 + 0.4 * (1 - st.brake / 0.18) },
    housing: {
      rot: tilt * (tele ? 1 : 0.6) + rock - 0.05 * rk,
      dx: -2.2 * rk,
      dy: -bob + breathe + (tele ? 0.5 * p : 0),
      sx: 1 + 0.06 * rk,
      sy: 1 - 0.05 * rk,
    },
    barrel: { variant: tele || rk > 0.35 ? 1 : 0, dx: -1.6 * rk },
    muzzle: { alpha: tele ? 0.35 + 0.65 * p : 0.55 * rk, hidden: !tele && rk <= 0.02, sx: 0.8 + 0.4 * p + 0.3 * rk, sy: 0.8 + 0.4 * p + 0.3 * rk },
    core: { alpha: tele ? p : 0.4 * rk, hidden: !tele && rk <= 0.02, sx: 0.5 + 0.7 * p, sy: 0.5 + 0.7 * p },
  };
}
