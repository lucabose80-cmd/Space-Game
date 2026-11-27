// M11: Bogen-Drohne (drone_arc) — Gold-Kugelrumpf, Visier, 2 Tesla-Spulen, 2 Düsen-Gondeln, Funken klein/groß.
// Rein darstellend — keine Hitbox-/Schadensänderung, kein Zufall. Entladung = Übergang telegraphTimer > 0 → 0 (enemyAi feuert dann den 3er-Bogenfächer).
import type { Pose } from '../../../engine/rig';
import type { Enemy } from '../../dungeonTypes';
import type { RigAnim } from '../rigAnim';

const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));

/** Länge der Vorwarnung (enemyAi: `telegraphTimer = 0.48`), Rückstoß der Entladung, Treffer-Zucken (s). */
const ARC_TELEGRAPH = 0.48;
const ARC_KICK = 0.3;
const ARC_HIT = 0.14;

interface ArcState {
  facing: number;
  wasTele: boolean;
  kick: number;
  hit: number;
  time: number;
}
const states = new WeakMap<Enemy, ArcState>();
const stateOf = (e: Enemy, time: number): ArcState => {
  let st = states.get(e);
  if (!st) {
    st = { facing: 1, wasTele: false, kick: 0, hit: 0, time };
    states.set(e, st);
  }
  return st;
};

/** Blickrichtung: zum Spieler, mit Totzone (sonst flackert das Spiegeln beim Umkreisen). */
function arcFacing(e: Enemy, playerX: number): number {
  const st = stateOf(e, 0);
  const dx = playerX - e.x;
  if (dx < -6) st.facing = -1;
  else if (dx > 6) st.facing = 1;
  return st.facing;
}

/**
 * Schweben mit Wippen, Neigen in Flugrichtung (Gondeln kippen mit). Vorwarnung: Spulen neigen sich zueinander und zittern,
 * kleine Funken knistern, der Bogen wird größer, Rumpf weicht zurück. Entladung: großer Blitz + Rückstoß, Spulen schnellen zurück.
 * Erholung: Funken klingen ab, Spulen pendeln aus. Treffer: kurzes Zucken.
 */
function arcPose(e: Enemy, time: number, lookDx: number, lookDy: number): Pose {
  const st = stateOf(e, time);
  const dt = Math.max(0, Math.min(0.1, time - st.time));
  st.time = time;
  const tele = e.telegraphTimer > 0;
  if (st.wasTele && !tele) st.kick = ARC_KICK; // Entladung
  st.wasTele = tele;
  if (e.flashTimer > 0.04 && st.hit <= 0) st.hit = ARC_HIT;
  st.kick = Math.max(0, st.kick - dt);
  st.hit = Math.max(0, st.hit - dt);
  const k = st.kick / ARC_KICK; // 1 → 0
  const h = st.hit / ARC_HIT;
  const p = tele ? clamp(1 - e.telegraphTimer / ARC_TELEGRAPH, 0, 1) : 0;
  const f = st.facing;
  const vx = e.vx * f;
  const speed = clamp(Math.hypot(e.vx, e.vy) / 80, 0, 1);
  const hover = Math.sin(time * 7.2 + e.id) * 2.8;
  const bank = clamp(vx * 0.0028, -0.24, 0.24);
  const aim = clamp(Math.atan2(lookDy, Math.max(10, Math.abs(lookDx))), -0.35, 0.35);
  const twitch = h * Math.sin(time * 90) * 0.5;
  const coil = (side: number): { rot: number; dx: number; dy: number } => ({
    // + = Spitze nach innen (Rig-Raum: linke Spule rot > 0, rechte Spule gespiegelt rot < 0)
    rot: side * (0.05 * Math.sin(time * 4.6 + e.id + side) + 0.34 * p + 0.04 * p * Math.sin(time * 55 + side * 3) - 0.28 * k * (1 - 0.3 * k)),
    dx: 0,
    dy: -0.6 * p * Math.abs(Math.sin(time * 40 + side)),
  });
  const cl = coil(1);
  const cr = coil(-1);
  const nacelle = (side: number): { rot: number; dy: number } => ({
    rot: side * (0.05 * Math.sin(time * 5.2 + e.id) + 0.1 * speed) + (tele ? -side * 0.07 * p : 0) + side * 0.1 * k,
    dy: Math.sin(time * 7.2 + e.id + side) * 0.45,
  });
  const nl = nacelle(-1);
  const nr = nacelle(1);
  const sparkOn = tele && Math.sin(time * 34 + e.id) > -0.3 + 0.9 * (1 - p); // knistert, je näher die Entladung desto dichter
  const sparkS = (): { hidden: boolean; alpha: number; sx: number; sy: number; rot: number } => ({
    hidden: !sparkOn && k < 0.05,
    alpha: tele ? 0.4 + 0.6 * p : k,
    sx: 0.7 + 0.5 * p,
    sy: 0.7 + 0.5 * p,
    rot: Math.sin(time * 28 + e.id) * 0.7,
  });
  const big = tele ? Math.max(0, p - 0.55) * 1.4 : 0; // Bogen wird kurz vor der Entladung groß
  return {
    body: {
      rot: bank + aim * 0.5 * (tele ? 1 : 0.5) + twitch * 0.4,
      dx: -2 * p - 3.2 * k - 1.2 * h,
      dy: hover + 1.2 * k + (tele ? -0.8 * p : 0),
      sx: 1 + 0.05 * k - 0.03 * p,
      sy: 1 - 0.05 * k + 0.03 * p,
    },
    coilL: { rot: cl.rot, dy: cl.dy },
    coilR: { rot: cr.rot, dy: cr.dy },
    nacelleL: { rot: nl.rot, dy: nl.dy },
    nacelleR: { rot: nr.rot, dy: nr.dy },
    visor: { dx: aim * 0.6 + 0.6 * p, dy: aim * 1.6, sy: tele ? 1 - 0.3 * p : 1 - 0.25 * h },
    sparkS: sparkS(),
    sparkL: {
      hidden: !(big > 0.05 || k > 0.05),
      alpha: k > 0 ? k : clamp(big * 1.6, 0, 1),
      sx: k > 0 ? 1.15 + 0.5 * (1 - k) : 0.5 + big,
      sy: k > 0 ? 1.15 + 0.5 * (1 - k) : 0.5 + big,
      rot: Math.sin(time * 44) * 0.25,
    },
  };
}

/** Wrack-Pose beim Tod (t = Sekunden seit dem Abschuss, 0…0,5): Spulen/Gondeln fliegen ab, Rumpf kippt, großer Blitz, Ausblenden. */
export const ARC_DEATH_TIME = 0.5;
export function arcDeathPose(t: number, id: number): Pose {
  const u = clamp(t / ARC_DEATH_TIME, 0, 1);
  const fall = u * u * 18;
  const a = clamp(1 - u * u, 0, 1);
  const spin = 1 + (id % 3) * 0.4;
  return {
    body: { rot: u * 0.9 * spin, dy: fall * 0.5, alpha: a, sx: 1 - 0.15 * u, sy: 1 - 0.15 * u },
    coilL: { rot: -u * 3.2, dx: -u * 14, dy: -u * 8 + fall, alpha: a },
    coilR: { rot: u * 3.6, dx: u * 14, dy: -u * 9 + fall, alpha: a },
    nacelleL: { rot: -u * 2.4, dx: -u * 12, dy: fall * 1.2, alpha: a },
    nacelleR: { rot: u * 2.6, dx: u * 12, dy: fall * 1.1, alpha: a },
    visor: { alpha: clamp(1 - u * 2.2, 0, 1), sy: 1 - u * 0.8 },
    sparkS: { hidden: u > 0.6, alpha: 1 - u, rot: u * 6, sx: 1 + u, sy: 1 + u },
    sparkL: { hidden: u > 0.7, alpha: clamp(1.2 - u * 1.4, 0, 1), sx: 1.2 + u * 0.8, sy: 1.2 + u * 0.8, rot: u * 2 },
  };
}

export const anim: RigAnim = {
  rawPose: (e, time, lookDx, lookDy) => arcPose(e, time, lookDx, lookDy),
  facing: arcFacing,
  noPulse: ['sparkS', 'sparkL', 'coilL', 'coilR'],
};
