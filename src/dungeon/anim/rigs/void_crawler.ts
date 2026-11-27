// M11: Leere-Krabbler (void_crawler) — sechsbeiniger Elite-Krabbler mit Doppelhörnern & elektrischer Energie-Ranke.
// Rein darstellend: keine Hitbox-/Schadensänderung, kein Zufall, Zeit nur über `time`.
// Zustände (aus enemyAi): Krabbeln im Dreifuß-Takt (aus Strecke, im Stand ruhig) → Vorwarnung (`telegraphTimer` 0,36 s:
// duckt sich tief, Beine spreizen, Energie-Ranke bäumt sich pulsierend auf) → Leere-Dash (`chargeActive` > 0: gestreckt
// nach vorn, Ranke peitscht zurück) → Erholung (Rückfederung nach 4-Wege-Salve) → Treffer-Zucken (`flashTimer`).
import type { Pose } from '../../../engine/rig';
import type { Enemy } from '../../dungeonTypes';
import type { RigAnim } from '../rigAnim';

const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
const HIT_TIME = 0.14;

interface VoidCrawlerState {
  step: number;
  recover: number;
  wasCharge: boolean;
  wind: number;
  atk: number;
  hit: number;
  hitDir: number;
  wasFlash: boolean;
  time: number;
}
const states = new WeakMap<Enemy, VoidCrawlerState>();

function facing(e: Enemy, playerX: number): number {
  if (e.chargeActive > 0 && Math.abs(e.chargeDirX) > 0.1) return e.chargeDirX < 0 ? -1 : 1;
  return playerX < e.x - 2 ? -1 : 1;
}

const GAIT: Record<string, number> = { legA1: 0, legB1: Math.PI, legC1: 0, legA2: Math.PI, legB2: 0, legC2: Math.PI };
const SPLAY: Record<string, number> = { legA1: -0.14, legB1: 0.0, legC1: 0.16, legA2: -0.22, legB2: -0.04, legC2: 0.24 };

function voidCrawlerPose(e: Enemy, time: number): Pose {
  let st = states.get(e);
  if (!st) {
    st = { step: e.id * 1.5, recover: 0, wasCharge: false, wind: 0, atk: 0, hit: 0, hitDir: 1, wasFlash: false, time };
    states.set(e, st);
  }
  const dt = clamp(time - st.time, 0, 0.1);
  st.time = time;

  const charging = e.chargeActive > 0;
  if (st.wasCharge && !charging) st.recover = 1;
  st.wasCharge = charging;
  st.recover = Math.max(0, st.recover - dt / 0.36);

  const flashing = e.flashTimer > 0;
  if (flashing && !st.wasFlash) {
    st.hit = 1;
    st.hitDir = -st.hitDir;
  }
  st.wasFlash = flashing;
  st.hit = Math.max(0, st.hit - dt / HIT_TIME);

  const toward = (v: number, t: number, rate: number): number =>
    v < t ? Math.min(t, v + rate * dt) : Math.max(t, v - rate * dt);
  const tele = e.telegraphTimer > 0;
  st.wind = toward(st.wind, tele ? 1 : 0, tele ? 9 : 6);
  st.atk = toward(st.atk, charging ? 1 : 0, charging ? 20 : 6);

  const spd = Math.hypot(e.vx, e.vy);
  st.step += spd * dt * 0.22;
  const moving = clamp(spd / 42, 0, 1);

  const w = st.wind;
  const a = st.atk;
  const rk = st.recover;
  const h = st.hit * (1 - Math.max(w, a) * 0.7);
  const calm = clamp(1 - w - a, 0, 1);

  const bob = Math.abs(Math.cos(st.step)) * 1.0 * moving * calm;
  const breathe = Math.sin(time * 2.6 + e.id) * 0.28 * (1 - moving);
  const shake = tele ? Math.sin(time * 66 + e.id) * 0.4 : 0;
  const pulse = 0.5 + 0.5 * Math.sin(time * 32);

  const pose: Pose = {
    torso: {
      rot: -0.04 * moving + 0.32 * a - 0.16 * w - 0.18 * rk + 0.16 * h * st.hitDir,
      dx: 2.5 * a - 1.1 * w + shake + 1.1 * h * st.hitDir,
      dy: -bob + breathe + 2.5 * w + 0.3 * a + 0.6 * rk,
      sx: 1 + 0.11 * w + 0.08 * a + 0.06 * rk,
      sy: 1 - 0.15 * w - 0.08 * a - 0.06 * rk - 0.06 * h,
    },
    head: {
      rot: 0.12 * w - 0.3 * a + 0.06 * Math.sin(time * 3.4 + e.id) * calm - 0.18 * h * st.hitDir,
      dy: 0.6 * w,
    },
    tendril: {
      rot: Math.sin(time * 6.5 + e.id) * 0.24 * calm - 0.55 * w + 0.65 * a + 0.3 * rk + 0.2 * h * st.hitDir,
      sx: 1 + (0.22 + 0.12 * pulse) * w + 0.15 * a,
      sy: 1 + (0.28 + 0.15 * pulse) * w,
      dy: -0.5 * w,
    },
  };
  for (const id of Object.keys(GAIT)) {
    const swing = Math.sin(st.step + GAIT[id]);
    const lift = Math.max(0, Math.cos(st.step + GAIT[id]));
    const far = id.endsWith('2') ? 0.85 : 1;
    pose[id] = {
      rot:
        SPLAY[id] +
        calm * 0.58 * swing * moving * far +
        w * (SPLAY[id] * 1.8 + (id.endsWith('2') ? -0.12 : 0.1)) +
        a * (0.58 + 0.22 * Math.sin(st.step * 3 + GAIT[id]) - SPLAY[id]) +
        0.35 * rk * Math.sin(GAIT[id] + 1) +
        0.2 * h * st.hitDir,
      dy: -1.1 * lift * moving * calm + 1.9 * w + 0.4 * a,
    };
  }
  return pose;
}

export const anim: RigAnim = {
  rawPose: (e, time) => voidCrawlerPose(e, time),
  facing,
  tau: 0.045,
};
