// M11 (Phase 1): Ruhe-/Lauf-Posen für Boss-Rigs. Die zugspezifischen Posen (Ausholen, Schlag, Verwandlung)
// kommen in den Boss-Phasen 3–6; die Spiellogik bleibt in bosses/defs.ts.
import { RIGS } from '../../data/rigs';
import type { PartPose, Pose } from '../../engine/rig';
import type { Enemy } from '../dungeonTypes';

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
/** Gedämpfte Schwingung (Nachfedern): t in s, freq in rad/s, decay in 1/s. */
const damped = (t: number, freq = 14, decay = 7): number => Math.exp(-decay * t) * Math.sin(freq * t);
/** Sekunden seit Beginn des aktuellen Boss-Zustands (nur für Zustände, in denen die KI `bossStateMax` setzt). */
const elapsed = (e: Enemy): number => Math.max(0, (e.bossStateMax ?? 0) - (e.bossStateTimer ?? 0));
/** Fortschritt 0…1 des aktuellen Zustands. */
const progress = (e: Enemy): number => (e.bossStateMax && e.bossStateMax > 0 ? clamp01(elapsed(e) / e.bossStateMax) : 0);

/**
 * Pose-Set-Indizes (ART_BRIEF_M11 §3.2/§3.3 + S2–S5) — Reihenfolge = `variants` in rigs.json.
 * Arme (je Seite): 0 hängend · 1 Ausholen · 2 Schlag zur Kamera · 3 seitlich (Laser) · 4 Block · 5 Boden-Stampfer
 *   · 6 halb ausgeholt · 7 Schlag kurz vor Treffer · 8 zurückfedernd · 9 Laser-Ladung · 10 Block-Treffer · 11 Phase 2 beschädigt · 12 ohne Faust (Fäuste kreisen).
 */
const ARM = { hang: 0, windup: 1, punch: 2, side: 3, block: 4, stomp: 5, halfWindup: 6, preImpact: 7, recoil: 8, laserCharge: 9, blockHit: 10, damagedP2: 11, noFist: 12 } as const;
/** Köpfe: 0 neutral · 1 brüllend · 2 zielend · 3 getroffen · 4 Phase 2 · 5 beschädigt · 6 Visier feuert · 7 Blick links · 8 Blick rechts · 9 brüllend Phase 2 · 10 stark beschädigt (< 15 % HP) · 11 Blinzeln. */
const HEAD = { neutral: 0, roar: 1, aim: 2, hit: 3, p2: 4, damaged: 5, visorFire: 6, lookL: 7, lookR: 8, roarP2: 9, wrecked: 10, blink: 11 } as const;
/** Rümpfe: 0 normal · 1 geduckt · 2 zurück · 3 vorgebeugt · 4 Phase 2 offen · 5 überhitzt · 6 Brust offen (Laser) · 7 halb offen · 8 Sprung gestreckt · 9 Landung gestaucht · 10 Phase 2 Laser · 11 Phase 2 beschädigt. */
const TORSO = { normal: 0, duck: 1, back: 2, fwd: 3, p2: 4, hot: 5, laserOpen: 6, laserHalf: 7, stretched: 8, landed: 9, p2Laser: 10, p2Damaged: 11 } as const;

/** Schulter-Feinjustierung je Rumpf-Variante (Spielpixel): [linker Arm dx, dy, rechter Arm dx, dy] — der Rumpf neigt sich je Pose, die Arm-Gelenke wandern mit. */
export const SHOULDER_ADJUST: Array<[number, number, number, number]> = [
  [0, 0, 0, 0], // 0 normal
  [0.5, 0.5, -3, 1], // 1 geduckt (Rumpf kippt nach links)
  [0, 1, -3, 0.5], // 2 zurückgelehnt
  [0, 0, 0, 0], // 3 vorgebeugt
  [0, 0, 0, 0], // 4 Phase 2
  [0, 0, 0, 0], // 5 überhitzt
  [0, 0, 0, 0], // 6 Brust offen (Laser)
  [0, 0, 0, 0], // 7 halb offen
  [0, 0, 0, 0], // 8 Sprung gestreckt
  [0, 0, 0, 0], // 9 Landung gestaucht
  [0, 0, 0, 0], // 10 Phase 2 Laser
  [0, 0, 0, 0], // 11 Phase 2 beschädigt
];

/** Zusatzbewegung (K2–K4) zusätzlich zum Pose-Set, alles in Spielpixeln/rad. */
interface Fx {
  torso: PartPose;
  head: PartPose;
  armL: PartPose;
  armR: PartPose;
}

/** Kern-Wächter: Pose-Set je Boss-Zustand (Zustände aus enemyAi.ts) + Anlauf/Nachfedern/Laufen/Treffer. `lookDx` = Spieler-x minus Boss-x (Blickrichtung). */
function coreWardenSet(e: Enemy, time: number, lookDx: number): { arms: number; head: number; torso: number; fx: Fx } {
  const p2 = e.bossPhase2 === true;
  const hpPct = e.maxHp > 0 ? e.hp / e.maxHp : 1;
  const wrecked = hpPct < 0.15; // S5: stark beschädigt, Halo zerbrochen
  let arms: number = p2 ? ARM.noFist : ARM.hang; // Phase 2: die Fäuste kreisen → Arme hängen ohne Faust
  let head: number = wrecked ? HEAD.wrecked : p2 ? HEAD.p2 : HEAD.neutral;
  let torso: number = p2 ? (hpPct < 0.25 ? TORSO.p2Damaged : TORSO.p2) : TORSO.normal;
  const fx: Fx = { torso: {}, head: {}, armL: {}, armR: {} };
  const p = progress(e);
  const el = elapsed(e);
  const speed = Math.hypot(e.vx, e.vy);
  const hit = e.flashTimer > 0;
  switch (e.bossState) {
    case 'charge_windup': // K2: duckt sich, holt aus
      arms = ARM.windup; torso = TORSO.duck; head = HEAD.aim;
      fx.torso = { dy: 2 * p, sy: 1 - 0.06 * p };
      fx.armL = { rot: 0.25 * p };
      fx.armR = { rot: -0.25 * p };
      break;
    case 'charge_dash':
      arms = ARM.punch; torso = TORSO.fwd; head = HEAD.aim;
      fx.torso = { sx: 1.04, sy: 0.97 };
      break;
    case 'slam_jump': // Stauchen (Rumpf geduckt/zurück), ab 50 % gestreckt (S3)
      arms = ARM.windup;
      torso = p < 0.5 ? TORSO.back : TORSO.stretched;
      fx.torso = p < 0.4 ? { sy: 1 - 0.08 * (p / 0.4), dy: 1.2 * (p / 0.4) } : {};
      break;
    case 'slam_air':
      arms = ARM.windup; torso = TORSO.stretched;
      break;
    case 'slam_impact': { // S3: Landung gestaucht, danach vorgebeugt; Arme schwingen nach
      arms = ARM.stomp; head = HEAD.aim;
      torso = el < 0.14 ? TORSO.landed : TORSO.fwd;
      const k = Math.exp(-el / 0.08);
      fx.torso = { sy: 1 - 0.05 * k, dy: 1.2 * k };
      fx.armL = { rot: 0.2 * damped(el) };
      fx.armR = { rot: -0.2 * damped(el) };
      break;
    }
    case 'laser_windup': // S3: Brust klappt auf (halb → offen), Arme laden
      arms = ARM.laserCharge; head = HEAD.aim;
      torso = p2 ? TORSO.p2Laser : p < 0.5 ? TORSO.laserHalf : TORSO.laserOpen;
      break;
    case 'laser_sweep':
      arms = ARM.side; head = HEAD.visorFire; // S5: Laser aus dem Visier
      torso = p2 ? TORSO.p2Laser : TORSO.laserOpen;
      break;
    case 'pylon_barrage':
      arms = p2 ? ARM.noFist : hit ? ARM.blockHit : ARM.block; // S4: Phase 2 — die Fäuste kreisen
      head = p2 ? HEAD.roarP2 : HEAD.roar;
      if (p2 && e.subBurst > 0) fx.torso = { dy: -1.5 * clamp01(e.burstDelay / 0.24) }; // Abschuss-Ruck nach jeder Faust-Salve
      if (hit) fx.torso = { ...fx.torso, dx: Math.sin(time * 90) };
      break;
    case 'phase2_roar':
      arms = ARM.windup; torso = TORSO.p2; head = HEAD.roarP2;
      break;
    case 'stunned': // K2: Rückprall + Kopf schwingt nach
      arms = p2 ? ARM.noFist : ARM.hang;
      torso = p2 ? TORSO.p2Damaged : TORSO.hot;
      head = wrecked ? HEAD.wrecked : HEAD.damaged;
      fx.torso = { dx: -Math.sign(e.chargeDirX || 1) * 2 * Math.exp(-el / 0.15) };
      fx.head = { rot: 0.12 * damped(el, 16, 6) };
      break;
    default: {
      // K3: Gehen — Wippen, gegenläufiger Armschwung, Kopf schwingt nach, leichtes Lehnen
      const w = clamp01(speed / 70);
      const ph = time * (3 + speed / 25) + e.id;
      const s = Math.sin(ph);
      fx.torso = { dy: -Math.abs(s) * Math.min(1.5, speed / 40), rot: Math.max(-0.04, Math.min(0.04, e.vx * 0.0008)) };
      fx.armL = { rot: s * 0.12 * w };
      fx.armR = { rot: s * 0.12 * w };
      fx.head = { rot: -Math.sin(ph - 0.4) * 0.05 * w };
      // S5: Blick zum Spieler (links/rechts) und Blinzeln, deterministisch aus Zeit + id
      if (!wrecked && !p2) {
        if (lookDx < -40) head = HEAD.lookL;
        else if (lookDx > 40) head = HEAD.lookR;
      }
      if (!wrecked && (time + e.id * 1.7) % 4.3 < 0.12) head = HEAD.blink;
      if (hit) {
        // K4: Treffer — Kopf zuckt zurück, Rumpf zittert, Arme federn nach außen
        head = wrecked ? HEAD.wrecked : HEAD.hit;
        fx.torso = { ...fx.torso, dx: Math.sin(time * 90) };
        fx.armL = { rot: (fx.armL.rot ?? 0) + 0.08 };
        fx.armR = { rot: (fx.armR.rot ?? 0) - 0.08 };
      }
    }
  }
  return { arms, head, torso, fx };
}

/** Krall: Greifzangen-Pose aus Zug-Name und Phase des Zugs (bossSub). */
function krallClaw(e: Enemy): number {
  const sub = e.bossSub ?? 'idle';
  if (sub === 'idle') return ARM.hang;
  const windup = sub === 'windup';
  switch (e.bossStatusText) {
    case 'GREIFARM-STOSS':
      return windup ? ARM.windup : sub === 'recover' && (e.bossStateTimer ?? 0) < 0.35 ? ARM.hang : ARM.punch;
    case 'MAGNET-ZUG':
      return windup ? ARM.block : ARM.hang;
    case 'SCHROTT-WURF':
      return windup ? ARM.windup : ARM.side;
    case 'SCHROTT-HAGEL':
      return ARM.stomp;
    default:
      return ARM.hang;
  }
}

// ---------- K1: weiche Übergänge ----------
/** Zeitkonstante der Annäherung an die Ziel-Pose (s). */
const SMOOTH_TAU = 0.05;
/** Dauer des Stauch-Impulses beim Bildwechsel (s). */
const PULSE_TIME = 0.09;
const NUM_FIELDS = ['rot', 'dx', 'dy', 'sx', 'sy'] as const;
/** S2: Zwischen-Posen der Arme — beim Wechsel `von>nach` (11 = beschädigt zählt wie hängend 0) kurz dieses Bild zeigen. */
const BETWEEN_TIME = 0.08;
const ARM_BETWEEN: Record<string, number> = { '0>1': ARM.halfWindup, '1>2': ARM.preImpact, '2>0': ARM.recoil };
const normArm = (v: number): number => (v === ARM.damagedP2 ? ARM.hang : v);
/** Teile, deren Bildwechsel keinen Stauch-Impuls bekommen (Blinzeln/Blickwechsel des Kopfes wären sonst unruhig). */
const NO_PULSE = new Set(['head']);

interface AnimState {
  cur: Record<string, Record<(typeof NUM_FIELDS)[number], number>>;
  variants: Record<string, number | undefined>;
  pulse: Record<string, number>;
  inter: Record<string, { v: number; until: number }>;
  time: number;
}
const animStates = new WeakMap<Enemy, AnimState>();

/**
 * Glättet die Ziel-Pose über die Zeit: Drehung/Lage/Skalierung nähern sich exponentiell an (kein Springen),
 * Bildwechsel (`variant`) bleiben hart, bekommen aber einen kurzen Stauch-Impuls (sx 1.08 / sy 0.94, Rumpf zusätzlich dy +0.6),
 * damit das Auge den Schnitt nicht sieht. Zustand je Boss in einer WeakMap, Zeit nur über `time` (kein Date.now).
 */
function smoothPose(e: Enemy, target: Pose, time: number): Pose {
  let st = animStates.get(e);
  const first = !st;
  if (!st) {
    st = { cur: {}, variants: {}, pulse: {}, inter: {}, time };
    animStates.set(e, st);
  }
  const dt = first ? 0 : Math.max(0, Math.min(0.1, time - st.time));
  st.time = time;
  const k = first ? 1 : 1 - Math.exp(-dt / SMOOTH_TAU);
  const out: Pose = {};
  for (const [id, tgt] of Object.entries(target)) {
    const cur = (st.cur[id] ??= { rot: tgt.rot ?? 0, dx: tgt.dx ?? 0, dy: tgt.dy ?? 0, sx: tgt.sx ?? 1, sy: tgt.sy ?? 1 });
    for (const f of NUM_FIELDS) cur[f] = lerp(cur[f], tgt[f] ?? (f === 'sx' || f === 'sy' ? 1 : 0), k);
    const prev = st.variants[id];
    if (prev !== undefined && tgt.variant !== undefined && prev !== tgt.variant) {
      if (!NO_PULSE.has(id)) st.pulse[id] = PULSE_TIME;
      const mid = id.startsWith('arm') ? ARM_BETWEEN[`${normArm(prev)}>${normArm(tgt.variant)}`] : undefined;
      if (mid !== undefined && !(prev === ARM.damagedP2 && tgt.variant === ARM.hang)) st.inter[id] = { v: mid, until: time + BETWEEN_TIME };
    }
    if (tgt.variant !== undefined) st.variants[id] = tgt.variant;
    const pulse = (st.pulse[id] = Math.max(0, (st.pulse[id] ?? 0) - dt)) / PULSE_TIME;
    const inter = st.inter[id];
    out[id] = {
      ...tgt,
      variant: inter && time < inter.until ? inter.v : tgt.variant,
      rot: cur.rot,
      dx: cur.dx,
      dy: cur.dy + (id === 'torso' ? 0.6 * pulse : 0),
      sx: cur.sx * (1 + 0.08 * pulse),
      sy: cur.sy * (1 - 0.06 * pulse),
    };
  }
  return out;
}

interface BodyState {
  sx: number;
  sy: number;
  tilt: number;
  time: number;
}
const bodyStates = new WeakMap<Enemy, BodyState>();

/**
 * K1: Ganzkörper-Stauchen/Neigung des Renderers (zustandsabhängig, stufenweise) weich nachführen — und mit einem Rig abmildern,
 * weil die Teile ihr Stauchen/Strecken schon selbst zeigen (K2). `strength` 0…1 skaliert die Abweichung von 1.
 */
export function smoothBossBody(e: Enemy, sx: number, sy: number, tilt: number, time: number, strength: number): { sx: number; sy: number; tilt: number } {
  const tsx = 1 + (sx - 1) * strength;
  const tsy = 1 + (sy - 1) * strength;
  let st = bodyStates.get(e);
  if (!st) {
    st = { sx: tsx, sy: tsy, tilt, time };
    bodyStates.set(e, st);
  }
  const k = 1 - Math.exp(-Math.max(0, Math.min(0.1, time - st.time)) / 0.06);
  st.time = time;
  st.sx = lerp(st.sx, tsx, k);
  st.sy = lerp(st.sy, tsy, k);
  st.tilt = lerp(st.tilt, tilt, k);
  return { sx: st.sx, sy: st.sy, tilt: st.tilt };
}

/** Pose des Boss-Rigs (geglättet). Teile mit `detach: 'phase2'` sind ab Phase 2 unsichtbar (sie fliegen als abgelöste Teile). */
export function getBossPose(rigId: string, e: Enemy, time: number, lookDx = 0): Pose {
  const pose = smoothPose(e, rawBossPose(rigId, e, time, lookDx), time);
  if (e.bossPhase2) {
    for (const p of RIGS[rigId]?.parts ?? []) if (p.detach === 'phase2') pose[p.id] = { ...pose[p.id], hidden: true };
  }
  return pose;
}

function rawBossPose(rigId: string, e: Enemy, time: number, lookDx: number): Pose {
  const speed = Math.hypot(e.vx, e.vy);
  const walk = Math.min(1, speed / 60);
  switch (rigId) {
    case 'krall': {
      const ph = time * (5 + walk * 4) + e.id;
      const amp = 0.08 + walk * 0.32;
      const s = Math.sin(ph);
      const c = Math.sin(ph + Math.PI);
      const breathe = Math.sin(time * 2.4 + e.id);
      return {
        torso: { dy: -Math.abs(s) * walk * 1.2 + breathe * 0.4 },
        legFL: { rot: s * amp },
        legBR: { rot: -s * amp * 0.9 },
        legFR: { rot: c * amp },
        legBL: { rot: -c * amp * 0.9 },
        claw: { variant: krallClaw(e), rot: Math.sin(time * 1.7 + 1) * 0.04 },
        magnet: { dy: Math.sin(time * 3.1) * 0.6, rot: Math.sin(time * 2) * 0.06 },
        plate: { dy: breathe * 0.5 },
      };
    }
    case 'core_warden': {
      const sw = Math.sin(time * 1.8 + e.id);
      const breathe = Math.sin(time * 2.4 + e.id);
      const set = coreWardenSet(e, time, lookDx);
      const fx = set.fx;
      const walking = Math.hypot(e.vx, e.vy) > 8;
      const sway = (0.07 + sw * 0.05) * (walking ? 0.4 : 1);
      const sh = SHOULDER_ADJUST[set.torso] ?? SHOULDER_ADJUST[0];
      const still = set.arms === ARM.hang || set.arms === ARM.noFist; // nur im Ruhezustand pendeln, Angriffsposen stehen
      return {
        torso: { variant: set.torso, dx: fx.torso.dx, dy: fx.torso.dy, rot: fx.torso.rot, sx: fx.torso.sx, sy: (fx.torso.sy ?? 1) * (1 + breathe * 0.012) },
        head: { variant: set.head, rot: Math.sin(time * 1.3) * 0.04 + (fx.head.rot ?? 0), dy: Math.sin(time * 2.4 + 0.6) * 0.5 },
        armL: { variant: set.arms, rot: (still ? sway : 0) + (fx.armL.rot ?? 0), dx: sh[0], dy: sh[1] },
        armR: { variant: set.arms, rot: (still ? -sway : 0) + (fx.armR.rot ?? 0), dx: sh[2], dy: sh[3] },
        plateL: { hidden: true }, // Brustplatten: erst abgelöst (detached.ts) fliegen sie weg
        plateR: { hidden: true },
      };
    }
    default:
      return {};
  }
}
