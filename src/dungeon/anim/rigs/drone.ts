// M11: Drohne (drone) — Kugelrumpf, Visier, Düsen-Gondeln mit Flammen, Lade-Linse. Rein darstellend — keine Hitbox-/Schadensänderung, kein Zufall.
import type { Pose } from '../../../engine/rig';
import type { Enemy } from '../../dungeonTypes';
import type { RigAnim } from '../rigAnim';

const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));

/** Länge der Schuss-Vorwarnung (enemyAi: `telegraphTimer = 0.46`) und Rückstoß je Bolzen (s). */
const DRONE_TELEGRAPH = 0.46;
const DRONE_KICK = 0.16;

interface DroneState {
  facing: number;
  lastBurst: number;
  kick: number;
  time: number;
}
const droneStates = new WeakMap<Enemy, DroneState>();
const stateOf = (e: Enemy, time: number): DroneState => {
  let st = droneStates.get(e);
  if (!st) {
    st = { facing: 1, lastBurst: 0, kick: 0, time };
    droneStates.set(e, st);
  }
  return st;
};

/** Blickrichtung: zum Spieler, mit Totzone (sonst flackert das Spiegeln beim Umkreisen). */
function droneFacing(e: Enemy, playerX: number): number {
  const st = stateOf(e, 0);
  const dx = playerX - e.x;
  if (dx < -6) st.facing = -1;
  else if (dx > 6) st.facing = 1;
  return st.facing;
}

/**
 * Drohne: schwebt und neigt sich in Flugrichtung, Gondeln kippen mit, Flammen wachsen mit der Geschwindigkeit.
 * Vorwarnung: Visier kneift zusammen, Lade-Linse glüht auf, Rumpf weicht leicht zurück. Je Bolzen ein Rückstoß, danach Seiten-Dash.
 */
function dronePose(e: Enemy, time: number, lookDx: number, lookDy: number): Pose {
  const st = stateOf(e, time);
  const dt = Math.max(0, Math.min(0.1, time - st.time));
  st.time = time;
  if (e.subBurst < st.lastBurst) st.kick = DRONE_KICK; // ein Bolzen ist raus
  st.lastBurst = e.subBurst;
  st.kick = Math.max(0, st.kick - dt);
  const k = st.kick / DRONE_KICK; // 1 → 0
  const tele = e.telegraphTimer > 0;
  const p = tele ? clamp(1 - e.telegraphTimer / DRONE_TELEGRAPH, 0, 1) : 0;
  const bursting = e.subBurst > 0 || k > 0;
  const f = st.facing; // Rig ist gespiegelt: Weltgeschwindigkeit in Blickrichtung umrechnen
  const vx = e.vx * f;
  const speed = clamp(Math.hypot(e.vx, e.vy) / 90, 0, 1);
  const hover = Math.sin(time * 6.5 + e.id) * 2.6;
  const bank = clamp(vx * 0.0025, -0.22, 0.22);
  const aim = clamp(Math.atan2(lookDy, Math.max(10, Math.abs(lookDx))), -0.35, 0.35);
  const flick = 0.82 + 0.18 * Math.sin(time * 40 + e.id * 3);
  const flame = (side: number): { alpha: number; sx: number; sy: number; rot: number } => {
    const s = (0.85 + 0.8 * speed + 0.35 * p) * flick * (1 + 0.15 * Math.sin(time * 31 + side));
    return { alpha: 0.7 + 0.3 * speed, sx: s * 0.8, sy: s, rot: 0 };
  };
  const nacelle = (side: number): { rot: number; dy: number } => ({
    rot: -bank * 1.4 + side * 0.06 * Math.sin(time * 5 + e.id) + (tele ? -side * 0.18 * p : 0) + (bursting ? side * 0.1 * k : 0),
    dy: Math.sin(time * 6.5 + e.id + side) * 0.5,
  });
  const nL = nacelle(-1);
  const nR = nacelle(1);
  const fl = flame(1);
  const fr = flame(2);
  return {
    body: { rot: bank + aim * 0.5 * (tele ? 1 : 0.5), dx: -1.4 * p - 2.2 * k, dy: hover, sx: 1 + 0.04 * k, sy: 1 - 0.04 * k },
    nacelleL: { rot: nL.rot, dy: nL.dy },
    nacelleR: { rot: nR.rot, dy: nR.dy },
    flameL: fl,
    flameR: fr,
    visor: { variant: tele || k > 0.3 ? 1 : 0, dx: aim * 0.6 + 0.6 * p, dy: aim * 1.6 },
    lens: { hidden: !tele && k <= 0.02, alpha: tele ? 0.3 + 0.7 * p : k, sx: 0.4 + 0.6 * p + 0.3 * k, sy: 0.4 + 0.6 * p + 0.3 * k },
  };
}

export const anim: RigAnim = {
  rawPose: (e, time, lookDx, lookDy) => dronePose(e, time, lookDx, lookDy),
  facing: droneFacing,
  noPulse: ['flameL', 'flameR', 'lens'],
};
