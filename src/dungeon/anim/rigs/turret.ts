// M11 Phase 7: Posen für Gegner-Rigs (normale Gegner, Teile-Sheets Typ G). Rein darstellend — keine Hitbox-/Schadensänderung, kein Zufall.
import type { Pose } from '../../../engine/rig';
import type { Enemy } from '../../dungeonTypes';
import type { RigAnim } from '../rigAnim';

const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));

/** Länge der Schuss-Vorwarnung des Geschützes (enemyAi: `telegraphTimer = 0.46`). */
const TURRET_TELEGRAPH = 0.46;
/** Ketten-Sprites (P0-14, Seitenansicht, 42×20 px): leicht verkleinert, damit sie unter dem 44-px-Sockel sitzen. */
const TREAD_SCALE = 0.8;
/** Rückstoß-Dauer nach dem Schuss (s). */
const TURRET_RECOIL = 0.22;

interface TurretState {
  /** Ketten-Rollphase (aus zurückgelegter Strecke) und Bremsfunken-Timer */
  tread: number;
  brake: number;
  wasMoving: boolean;
  wasTelegraph: boolean;
  recoil: number;
  /** Treffer-Zucken (1 → 0) und Vorzustand für die Flanke von `flashTimer` */
  flinch: number;
  flinchDir: number;
  wasFlash: boolean;
  /** Ducken vor dem Umsetzen (1 → 0) */
  crouch: number;
  wasScurry: boolean;
  time: number;
}
const turretStates = new WeakMap<Enemy, TurretState>();

/** Blickrichtung des Geschütz-Rigs: −1 = Spieler links (Rig spiegeln), +1 = rechts. */
function turretFacing(e: Enemy, playerX: number): number {
  return playerX < e.x - 2 ? -1 : 1;
}

/**
 * Geschütz: Gehäuse neigt sich zum Spieler (Spiegelung übernimmt der Renderer), Rohr fährt in der Vorwarnung aus,
 * Mündungsring + Lade-Kern glühen auf, nach dem Schuss Rückstoß; beim Umsetzen (Scurry) wippt der Körper.
 * `aimDy`/`aimDx` = Spieler minus Geschütz (für die Neigung).
 */
function turretPose(e: Enemy, time: number, aimDx: number, aimDy: number): Pose {
  let st = turretStates.get(e);
  if (!st) {
    st = { tread: e.id, brake: 0, wasMoving: false, wasTelegraph: false, recoil: 0, flinch: 0, flinchDir: 1, wasFlash: false, crouch: 0, wasScurry: false, time };
    turretStates.set(e, st);
  }
  const dt = Math.max(0, Math.min(0.1, time - st.time));
  st.time = time;
  const tele = e.telegraphTimer > 0;
  if (st.wasTelegraph && !tele) st.recoil = TURRET_RECOIL; // Vorwarnung zu Ende = Schuss
  st.wasTelegraph = tele;
  st.recoil = Math.max(0, st.recoil - dt);
  // Treffer: Flanke von flashTimer → kurzes Zucken (Richtung wechselt je Treffer, sonst wirkt es mechanisch)
  const flash = e.flashTimer > 0;
  if (flash && !st.wasFlash) { st.flinch = 1; st.flinchDir = -st.flinchDir; }
  st.wasFlash = flash;
  st.flinch = Math.max(0, st.flinch - dt / 0.22);
  // Umsetzen: kurzes Ducken, bevor die Ketten anziehen
  const scurry = e.scurryTimer > 0;
  if (scurry && !st.wasScurry) st.crouch = 1;
  st.wasScurry = scurry;
  st.crouch = Math.max(0, st.crouch - dt / 0.18);
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
  // Beschädigungsstufen: ab 66 % Wackeln, ab 33 % Absacken + flackernder Kern, kritisch < 15 % starkes Zittern
  const hpr = e.maxHp > 0 ? clamp(e.hp / e.maxHp, 0, 1) : 1;
  const dmg = hpr > 0.66 ? 0 : hpr > 0.33 ? 1 : hpr > 0.15 ? 2 : 3;
  const jitter = dmg >= 1 ? Math.sin(time * 41 + e.id * 3) * (dmg === 3 ? 0.05 : 0.02) : 0;
  const sag = dmg >= 2 ? (dmg === 3 ? 1.6 : 0.9) : 0;
  const flicker = dmg >= 2 && Math.sin(time * (dmg === 3 ? 31 : 17) + e.id) > 0.35 ? 1 : 0;
  // Leerlauf-Scan: Gehäuse schwenkt langsam, solange nichts passiert
  const idle = !tele && rk <= 0 && moving < 0.05;
  const scan = idle ? Math.sin(time * 0.9 + e.id * 1.7) * 0.07 : 0;
  const fl = st.flinch, cr = st.crouch;
  return {
    base: { dy: -bob * 0.5 + 1.0 * cr, rot: rock, sy: 1 - 0.07 * cr, sx: 1 + 0.04 * cr },
    treadL: { variant: treadVar, dy: bob * 0.3, sx: TREAD_SCALE, sy: TREAD_SCALE },
    treadR: { variant: (treadVar + 2) % 4, dy: bob * 0.3, sx: TREAD_SCALE, sy: TREAD_SCALE }, // gegenläufige Phase wirkt weniger „synchron“
    dust: { hidden: !rolling, alpha: 0.5 * moving * (0.6 + 0.4 * Math.sin(time * 18 + e.id)), dx: clamp(-e.vx * 0.12, -6, 6), dy: clamp(-e.vy * 0.05, -2, 2), sx: 0.7 + 0.3 * moving, sy: 0.7 + 0.3 * moving },
    brake: { hidden: st.brake <= 0, alpha: st.brake / 0.18, sx: 0.6 + 0.4 * (1 - st.brake / 0.18), sy: 0.6 + 0.4 * (1 - st.brake / 0.18) },
    housing: {
      rot: tilt * (tele ? 1 : 0.6) + rock - 0.05 * rk + scan + jitter + 0.12 * fl * st.flinchDir + (dmg >= 2 ? 0.04 * dmg : 0),
      dx: -2.2 * rk - 1.4 * fl * st.flinchDir,
      dy: -bob + breathe + (tele ? 0.5 * p : 0) + sag + 0.8 * cr,
      sx: 1 + 0.06 * rk,
      sy: 1 - 0.05 * rk,
    },
    barrel: { variant: tele || rk > 0.35 ? 1 : 0, dx: -1.6 * rk },
    muzzle: { alpha: tele ? 0.35 + 0.65 * p : 0.55 * rk, hidden: !tele && rk <= 0.02, sx: 0.8 + 0.4 * p + 0.3 * rk, sy: 0.8 + 0.4 * p + 0.3 * rk },
    core: { alpha: tele ? p : Math.max(0.4 * rk, flicker * 0.5), hidden: !tele && rk <= 0.02 && !flicker, sx: 0.5 + 0.7 * p, sy: 0.5 + 0.7 * p },
  };
}

export const anim: RigAnim = {
  rawPose: (e, time, lookDx, lookDy) => turretPose(e, time, lookDx, lookDy),
  facing: turretFacing,
};
