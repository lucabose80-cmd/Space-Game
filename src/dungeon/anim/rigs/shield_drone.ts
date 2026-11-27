// M11 Phase 7: Schild-Drohne (shield_drone) — Gegner-Rig. Rein darstellend: keine Hitbox-/Schadensänderung, kein Zufall.
// Der Schildbogen (`arc`) sitzt exakt dort, wo die Spiellogik blockt (`e.aimAngle`, Bogen ±1,08 rad, `shieldDownTimer`):
//  · intakt = cyan Bogen vor dem Rumpf · Angriff (Vorwarnung + Nachwirkung) = Bogen klappt zum Rumpf ein (Konter-Fenster)
//  · Hitze ≥ 70 % = Bogen glüht orange · Überhitzt = orange, rissiger Bogen flackert und sackt ab (Konter-Fenster)
import type { Pose } from '../../../engine/rig';
import type { Enemy } from '../../dungeonTypes';
import type { RigAnim } from '../rigAnim';
import { ENEMY_SHIELDS } from '../../../data/balance';

const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));

/** Länge der Schuss-Vorwarnung (enemyAi: `telegraphTimer = 0.48`). */
const TELEGRAPH = 0.48;
/** Rückstoß-Dauer nach der 3er-Salve (s). */
const RECOIL = 0.22;
/** Abstand des Bogens vom Rumpfmittelpunkt über den Bogenradius hinaus (px) und Lage des Kreismittelpunkts im Bogenbild (px unterhalb der Bildmitte → Bogen-Kreis mitten im Rumpf). */
const ARC_PUSH = 4.5;
const ARC_CENTER_DROP = 3.3;
/** Das Bogenbild ist nicht symmetrisch (rechtes Ende höher): Bogenmitte liegt bei ≈ 62° (statt 90° = „genau nach unten“). */
const ARC_MID_ANGLE = 1.09;
/** Bogen-Grundgröße (Bild ist etwas größer als der Block-Radius 14). */
const ARC_BASE = 0.95;

interface DroneState {
  time: number;
  facing: number;
  /** 1 = Schild voll ausgefahren … 0 = eingeklappt */
  arcK: number;
  down: 'none' | 'attack' | 'overheat';
  wasTele: boolean;
  recoil: number;
}
const states = new WeakMap<Enemy, DroneState>();
function stateOf(e: Enemy, time = -1): DroneState {
  let st = states.get(e);
  if (!st) {
    st = { time, facing: Math.cos(e.aimAngle) < 0 ? -1 : 1, arcK: 1, down: 'none', wasTele: false, recoil: 0 };
    states.set(e, st);
  }
  return st;
}

/** Blickrichtung des Rigs folgt dem Zielwinkel (Hysterese gegen Flackern bei senkrechtem Zielen); −1 = Rig spiegeln. */
function facingOf(e: Enemy): number {
  const st = stateOf(e);
  const c = Math.cos(e.aimAngle);
  if (st.facing > 0 && c < -0.25) st.facing = -1;
  else if (st.facing < 0 && c > 0.25) st.facing = 1;
  return st.facing;
}

function dronePose(e: Enemy, time: number): Pose {
  const st = stateOf(e, time);
  const dt = st.time < 0 ? 0 : clamp(time - st.time, 0, 0.1);
  st.time = time;
  const facing = facingOf(e);

  const tele = e.telegraphTimer > 0;
  const p = tele ? clamp(1 - e.telegraphTimer / TELEGRAPH, 0, 1) : 0;
  if (st.wasTele && !tele) st.recoil = RECOIL; // Vorwarnung zu Ende = Salve
  st.wasTele = tele;
  st.recoil = Math.max(0, st.recoil - dt);
  const rk = st.recoil / RECOIL;

  // Schildzustand: Ursache des Wegklappens merken (Angriff vs. Überhitzen), damit das Auslaufen des Überhitzens nicht wie „Angriff“ aussieht
  const downT = e.shieldDownTimer ?? 0;
  if (downT <= 0) st.down = 'none';
  else if (st.down === 'none') st.down = tele ? 'attack' : 'overheat';
  const cfg = ENEMY_SHIELDS.shield_drone;
  const heat = clamp((e.shieldHeat ?? 0) / cfg.maxHeat, 0, 1);
  const target = st.down === 'none' ? 1 : st.down === 'overheat' ? 0.6 : 0;
  const rate = target > st.arcK ? 3.2 : 11;
  st.arcK += clamp(target - st.arcK, -rate * dt, rate * dt);

  // Bogenwinkel im (ggf. gespiegelten) Rig-Rahmen; das Bogenbild ist unten offen-konvex gezeichnet (Wölbung zeigt nach unten = +90°).
  const aLocal = facing < 0 ? Math.PI - e.aimAngle : e.aimAngle;
  const rot = aLocal - ARC_MID_ANGLE;
  const arcS = ARC_BASE * (0.55 + 0.45 * st.arcK);
  const push = ARC_PUSH * st.arcK - 3 * (1 - st.arcK);
  const hot = st.down === 'overheat' || heat >= 0.7;
  let arcAlpha = st.arcK;
  if (st.down === 'overheat') arcAlpha = 0.55 + 0.35 * Math.sin(time * 34 + e.id * 3) * Math.sin(time * 13); // sputtert
  else if (heat >= 0.7) arcAlpha = 0.85 + 0.15 * Math.sin(time * 20);
  else if (tele) arcAlpha = st.arcK;
  const sag = st.down === 'overheat' ? 2.2 : 0; // überhitzter Bogen hängt durch

  const hover = Math.sin(time * 5.2 + e.id) * 2.2;
  const speed = Math.hypot(e.vx, e.vy);
  const moving = clamp(speed / 50, 0, 1);
  const lean = clamp(e.vx * facing * 0.004, -0.2, 0.2);
  const kick = rk * 2.6; // Rückstoß entgegen der Zielrichtung
  const flare = clamp(0.2 + 0.8 * moving + 0.6 * p + 0.5 * rk, 0, 1.2); // 0 … ~1: Schubstärke
  const flick = 0.9 + 0.1 * Math.sin(time * 40 + e.id);

  return {
    hull: {
      dx: -Math.cos(aLocal) * kick - 0.8 * p,
      dy: -hover - Math.sin(aLocal) * kick,
      rot: lean + (tele ? -0.06 * p : 0) + 0.05 * rk,
      sx: 1 + 0.05 * rk - 0.03 * p,
      sy: 1 - 0.05 * rk + 0.03 * p,
    },
    // Lichtauge schaut zum Spieler und leuchtet in der Vorwarnung auf
    visor: { dx: Math.cos(aLocal) * 1.4, dy: Math.sin(aLocal) * 1.0, sx: 1 + 0.12 * p + 0.1 * rk, sy: 1 + 0.12 * p + 0.1 * rk },
    nacelleL: { rot: -lean * 0.6 + 0.04 * Math.sin(time * 9 + e.id), sy: (0.88 + 0.2 * flare) * flick, sx: 0.95 + 0.05 * flare, dy: 1.2 * flare },
    nacelleR: { rot: -lean * 0.6 - 0.04 * Math.sin(time * 9 + e.id + 1.3), sy: (0.88 + 0.2 * flare) * flick, sx: 0.95 + 0.05 * flare, dy: 1.2 * flare },
    emitter: {
      dy: hover * 0.35 + (st.down === 'overheat' ? 1.5 : 0),
      sx: 1 + 0.04 * Math.sin(time * 5.2 + e.id),
      sy: 1 - 0.05 * Math.sin(time * 5.2 + e.id),
      alpha: st.down === 'overheat' ? 0.7 + 0.3 * Math.sin(time * 26) : 1,
    },
    arc: {
      variant: hot ? 1 : 0,
      rot,
      dx: -Math.sin(rot) * ARC_CENTER_DROP * arcS + Math.cos(aLocal) * push + Math.cos(aLocal) * (tele ? -1.2 * p : 0),
      dy: Math.cos(rot) * ARC_CENTER_DROP * arcS + Math.sin(aLocal) * push + sag,
      sx: arcS,
      sy: arcS,
      alpha: arcAlpha,
      hidden: st.arcK < 0.03,
    },
  };
}

export const anim: RigAnim = {
  rawPose: (e, time) => dronePose(e, time),
  facing: (e) => facingOf(e),
};
