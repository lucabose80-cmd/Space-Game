// M11: Kristall-Krabbler (crystal_crawler) — sechsbeiniges Gegner-Rig (Panzer, Kopf, 3 Beinpaare, Rücken-Kristall).
// Rein darstellend: keine Hitbox-/Schadensänderung, kein Zufall, Zeit nur über `time`.
// Zustände (aus enemyAi): Krabbeln (Beine im Dreifuß-Takt aus zurückgelegter Strecke, im Stand ruhig), Vorwarnung
// (`telegraphTimer` 0,38 s: duckt sich, Beine spreizen, Kristall wächst/glüht), Vorschnellen (`chargeActive` > 0: Körper schießt
// gestreckt nach vorn, Beine angelegt), Erholung (Rückfederung), Treffer-Zucken (Flanke `flashTimer`).
import type { Pose } from '../../../engine/rig';
import type { Enemy } from '../../dungeonTypes';
import type { RigAnim } from '../rigAnim';

const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
const HIT_TIME = 0.14;

interface CrawlerState {
  /** Schrittphase aus zurückgelegter Strecke (rad) */
  step: number;
  /** Rückfederung nach dem Vorschnellen, 1 → 0 */
  recover: number;
  wasCharge: boolean;
  /** weich überblendete Zustände 0…1: Ducken/Glühen (Vorwarnung), Vorschnellen */
  wind: number;
  atk: number;
  /** Treffer-Zucken 1 → 0 (≤ 0,15 s), Richtung wechselt je Treffer */
  hit: number;
  hitDir: number;
  wasFlash: boolean;
  time: number;
}
const states = new WeakMap<Enemy, CrawlerState>();

function facing(e: Enemy, playerX: number): number {
  return playerX < e.x - 2 ? -1 : 1;
}

/** Dreifuß-Takt: Beinpaare A/C (nahe Seite) und B (ferne Seite) gleichzeitig, der Rest gegenläufig. */
const GAIT: Record<string, number> = { legA1: 0, legB1: Math.PI, legC1: 0, legA2: Math.PI, legB2: 0, legC2: Math.PI };
/** Grundstellung (rad) je Bein: vorderes Bein vor, hinteres zurück gespreizt */
const SPLAY: Record<string, number> = { legA1: -0.12, legB1: 0.0, legC1: 0.14, legA2: -0.2, legB2: -0.05, legC2: 0.22 };

function crawlerPose(e: Enemy, time: number): Pose {
  let st = states.get(e);
  if (!st) {
    st = { step: e.id * 1.3, recover: 0, wasCharge: false, wind: 0, atk: 0, hit: 0, hitDir: 1, wasFlash: false, time };
    states.set(e, st);
  }
  const dt = clamp(time - st.time, 0, 0.1);
  st.time = time;
  const charging = e.chargeActive > 0;
  if (st.wasCharge && !charging) st.recover = 1;
  st.wasCharge = charging;
  st.recover = Math.max(0, st.recover - dt / 0.35);
  const flashing = e.flashTimer > 0;
  if (flashing && !st.wasFlash) {
    st.hit = 1;
    st.hitDir = -st.hitDir;
  }
  st.wasFlash = flashing;
  st.hit = Math.max(0, st.hit - dt / HIT_TIME);
  const toward = (v: number, t: number, rate: number): number => (v < t ? Math.min(t, v + rate * dt) : Math.max(t, v - rate * dt));
  const tele = e.telegraphTimer > 0;
  st.wind = toward(st.wind, tele ? 1 : 0, tele ? 8 : 5);
  st.atk = toward(st.atk, charging ? 1 : 0, charging ? 18 : 5);
  const spd = Math.hypot(e.vx, e.vy);
  st.step += spd * dt * 0.2;
  const moving = clamp(spd / 40, 0, 1);
  const w = st.wind;
  const a = st.atk;
  const rk = st.recover;
  // Treffer-Zucken stört keine Angriffspose: nur anteilig, wenn Vorwarnung/Vorschnellen nicht dominieren
  const h = st.hit * (1 - Math.max(w, a) * 0.7);
  const calm = clamp(1 - w - a, 0, 1);
  const bob = Math.abs(Math.cos(st.step)) * 0.9 * moving * calm;
  const breathe = Math.sin(time * 2.2 + e.id) * 0.25 * (1 - moving);
  const shake = tele ? Math.sin(time * 60 + e.id) * 0.35 : 0;
  const pulse = 0.5 + 0.5 * Math.sin(time * 28);
  const pose: Pose = {
    torso: {
      rot: -0.04 * moving + 0.3 * a - 0.14 * w - 0.16 * rk + 0.16 * h * st.hitDir,
      dx: 2.2 * a - 1.0 * w + shake + 1.1 * h * st.hitDir,
      dy: -bob + breathe + 2.4 * w + 0.4 * a + 0.5 * rk,
      sx: 1 + 0.1 * w + 0.07 * a + 0.05 * rk,
      sy: 1 - 0.14 * w - 0.07 * a - 0.05 * rk - 0.06 * h,
    },
    head: { rot: 0.1 * w - 0.28 * a + 0.05 * Math.sin(time * 3 + e.id) * calm - 0.18 * h * st.hitDir, dy: 0.6 * w },
    crystal: {
      rot: Math.sin(time * 2 + e.id) * 0.04 + 0.2 * a + 0.1 * h * st.hitDir,
      sx: 1 + 0.3 * w,
      sy: 1 + (0.55 + 0.15 * pulse) * w - 0.15 * a,
      dy: -0.4 * w,
    },
  };
  for (const id of Object.keys(GAIT)) {
    const swing = Math.sin(st.step + GAIT[id]);
    const lift = Math.max(0, Math.cos(st.step + GAIT[id])); // Fuß hebt in der Vorschwung-Hälfte
    const far = id.endsWith('2') ? 0.85 : 1;
    pose[id] = {
      rot:
        SPLAY[id] +
        calm * 0.55 * swing * moving * far +
        w * (SPLAY[id] * 1.8 + (id.endsWith('2') ? -0.12 : 0.1)) + // Vorwarnung: Beine spreizen sich zum Absprung
        a * (0.55 + 0.2 * Math.sin(st.step * 3 + GAIT[id]) - SPLAY[id]) + // Vorschnellen: Beine nach hinten angelegt, huschen
        0.35 * rk * Math.sin(GAIT[id] + 1) +
        0.2 * h * st.hitDir,
      dy: -1.1 * lift * moving * calm + 1.9 * w + 0.4 * a,
    };
  }
  return pose;
}

export const anim: RigAnim = {
  rawPose: (e, time) => crawlerPose(e, time),
  facing,
  tau: 0.045,
};
