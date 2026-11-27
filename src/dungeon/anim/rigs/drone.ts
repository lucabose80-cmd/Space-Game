// M11: Drohne (drone) — Kugelrumpf, Visier, Düsen-Gondeln mit Flammen, Lade-Linse. Rein darstellend — keine Hitbox-/Schadensänderung, kein Zufall.
import type { Pose } from '../../../engine/rig';
import type { Enemy } from '../../dungeonTypes';
import type { RigAnim } from '../rigAnim';

const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));

/** Länge der Schuss-Vorwarnung (enemyAi: `telegraphTimer = 0.46`) und Rückstoß je Bolzen (s). */
const DRONE_TELEGRAPH = 0.46;
const DRONE_KICK = 0.16;
/** Erholung nach dem letzten Bolzen und Treffer-Zucken (s). */
const DRONE_RECOVER = 0.5;
const DRONE_HIT = 0.14;

interface DroneState {
  facing: number;
  lastBurst: number;
  kick: number;
  rec: number;
  hit: number;
  time: number;
}
const droneStates = new WeakMap<Enemy, DroneState>();
const stateOf = (e: Enemy, time: number): DroneState => {
  let st = droneStates.get(e);
  if (!st) {
    st = { facing: 1, lastBurst: 0, kick: 0, rec: 0, hit: 0, time };
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
  if (e.subBurst === 0 && st.lastBurst === 1) st.rec = DRONE_RECOVER; // letzter Bolzen → Erholung (Seiten-Dash)
  if (e.flashTimer > 0.04 && st.hit <= 0) st.hit = DRONE_HIT;
  st.lastBurst = e.subBurst;
  st.kick = Math.max(0, st.kick - dt);
  st.rec = Math.max(0, st.rec - dt);
  st.hit = Math.max(0, st.hit - dt);
  const k = st.kick / DRONE_KICK; // 1 → 0
  const tele = e.telegraphTimer > 0;
  const r = st.rec / DRONE_RECOVER; // 1 → 0
  const busy = tele || e.subBurst > 0 || k > 0;
  const h = (st.hit / DRONE_HIT) * (busy ? 0.3 : 1); // Treffer-Zucken, in Angriffsposen gedämpft
  const twitch = h * Math.sin(time * 90);
  const p = tele ? clamp(1 - e.telegraphTimer / DRONE_TELEGRAPH, 0, 1) : 0;
  const bursting = e.subBurst > 0 || k > 0;
  const f = st.facing; // Rig ist gespiegelt: Weltgeschwindigkeit in Blickrichtung umrechnen
  const vx = e.vx * f;
  const speed = clamp(Math.hypot(e.vx, e.vy) / 90, 0, 1);
  const hover = Math.sin(time * 6.5 + e.id) * 2.6;
  const bank = clamp(vx * 0.0025, -0.22, 0.22);
  const aim = clamp(Math.atan2(lookDy, Math.max(10, Math.abs(lookDx))), -0.35, 0.35);
  const flame = (side: number): { alpha: number; sx: number; sy: number; rot: number } => {
    const s = (0.5 + 0.55 * speed + 0.2 * p) * (0.88 + 0.12 * Math.sin(time * 38 + side * 2 + e.id));
    return { alpha: 0.75 + 0.25 * speed, sx: 0.55 + 0.25 * speed, sy: s, rot: 0 };
  };
  const nacelle = (side: number): { rot: number; dy: number } => ({
    rot: side * 0.04 * Math.sin(time * 5 + e.id) + (tele ? -side * 0.08 * p : 0) + (bursting ? side * 0.06 * k : 0) + side * 0.16 * r * Math.sin(time * 14),
    dy: Math.sin(time * 6.5 + e.id + side) * 0.4,
  });
  const nL = nacelle(-1);
  const nR = nacelle(1);
  const fl = flame(1);
  const fr = flame(2);
  return {
    body: { rot: bank + aim * 0.5 * (tele ? 1 : 0.5) + twitch * 0.12, dx: -1.4 * p - 2.2 * k - 1.4 * h, dy: hover + 1.1 * r, sx: 1 + 0.04 * k - 0.04 * h, sy: 1 - 0.04 * k + 0.04 * h },
    nacelleL: { rot: nL.rot, dy: nL.dy },
    nacelleR: { rot: nR.rot, dy: nR.dy },
    flameL: fl,
    flameR: fr,
    visor: { variant: tele || k > 0.3 || r > 0.5 ? 1 : 0, dx: aim * 0.6 + 0.6 * p, dy: aim * 1.6, sx: 0.68, sy: 0.68 },
    lens: { hidden: !tele && k <= 0.02 && r <= 0.05, alpha: tele ? 0.3 + 0.7 * p : Math.max(k, 0.5 * r), sx: 0.3 + 0.4 * p + 0.2 * k, sy: 0.3 + 0.4 * p + 0.2 * k },
  };
}

/** Wrack-Pose beim Tod (t = Sekunden seit dem Abschuss, 0…0,5): Gondeln reißen ab, Rumpf kippt und fällt, Linse blitzt, Ausblenden. */
export const DRONE_DEATH_TIME = 0.5;
export function droneDeathPose(t: number, id: number): Pose {
  const u = clamp(t / DRONE_DEATH_TIME, 0, 1);
  const fall = u * u * 18;
  const a = clamp(1 - u * u, 0, 1);
  const spin = 1 + (id % 3) * 0.4;
  return {
    body: { rot: u * 0.9 * spin, dy: fall * 0.5, alpha: a, sx: 1 - 0.15 * u, sy: 1 - 0.15 * u },
    nacelleL: { rot: -u * 2.6, dx: -u * 13, dy: -u * 6 + fall * 1.1, alpha: a },
    nacelleR: { rot: u * 2.8, dx: u * 13, dy: -u * 7 + fall, alpha: a },
    flameL: { hidden: u > 0.3, alpha: 1 - u * 2, sx: 0.55, sy: 0.55, rot: -u * 2.6 },
    flameR: { hidden: u > 0.3, alpha: 1 - u * 2, sx: 0.55, sy: 0.55, rot: u * 2.8 },
    visor: { variant: u > 0.15 ? 1 : 0, alpha: clamp(1 - u * 2.2, 0, 1), sx: 0.68, sy: 0.68 * (1 - u * 0.7) },
    lens: { hidden: u > 0.6, alpha: clamp(1.4 - u * 1.8, 0, 1), sx: 0.6 + u * 1.4, sy: 0.6 + u * 1.4 },
  };
}

export const anim: RigAnim = {
  rawPose: (e, time, lookDx, lookDy) => dronePose(e, time, lookDx, lookDy),
  facing: droneFacing,
  noPulse: ['flameL', 'flameR', 'lens'],
};
