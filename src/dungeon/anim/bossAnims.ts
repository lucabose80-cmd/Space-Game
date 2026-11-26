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
/** S6 (Phase 2): Angriffsposen ohne Faust — 13 Ausholen · 14 Stoß/Energie-Stumpf · 15 seitlich/Laser · 16 Block · 17 Stampfer · 18 halb ausgeholt (die Fäuste kreisen/fliegen separat). */
const NOFIST_OF: Record<number, number> = { 1: 13, 2: 14, 3: 15, 4: 16, 5: 17, 6: 18, 7: 14, 8: 18, 9: 15, 10: 16, 11: 12 };
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
      if (p2 && e.subBurst === 3) fx.torso = { dy: -1.5 * clamp01(e.burstDelay / 0.24) }; // Abschuss-Ruck nach dem Faust-Wurf
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
      const ph = stridePhase(e, time, speed) * CW_STRIDE_K; // Schritte aus zurückgelegter Strecke (steht der Boss, stehen die Schritte)
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
  if (p2 && NOFIST_OF[arms] !== undefined) arms = NOFIST_OF[arms]; // S6: in Phase 2 immer die Faust-losen Posen
  return { arms, head, torso, fx };
}

/**
 * Krall-Pose-Sets (ART_BRIEF_M11 §4.1) — Reihenfolge = `variants` in rigs.json.
 * Arme (clawR Greifzange / clawL Schrott-Haken, je Seite gleiche Posen): 0 hängend · 1 ausholend · 2 Stoß zur Kamera · 3 seitlich · 4 Block · 5 Boden-Stampfer.
 * Rumpf: 0 normal · 1 geduckt · 2 aufgerichtet (Kern hell, Magnet-Zug) · 3 nach vorn gebeugt (Stoß) · 4 Phase 2 (Rückenpanzer ab, Rahmen/Kern offen) · 5 beschädigt (Funken, Dellen).
 */
/** Kern-Wächter: Umrechnung Strecken-Phase → Schritt-Takt (≈ alte Frequenz bei ~40 px/s). */
const CW_STRIDE_K = 0.72;

const KARM = { hang: 0, windup: 1, punch: 2, side: 3, block: 4, stomp: 5 } as const;
const KTORSO = { normal: 0, duck: 1, upright: 2, fwd: 3, p2: 4, damaged: 5 } as const;
/** Erholungszeit je Zug (defs.ts) — die Engine setzt `bossStateMax` nur für die Vorwarnung, `bossStateTimer` läuft in der Erholung von diesem Wert ab. */
const KRALL_RECOVER: Record<string, number> = { 'MAGNET-ZUG': 1.3, 'SCHROTT-WURF': 0.9, 'GREIFARM-STOSS': 0.9, 'SCHROTT-HAGEL': 1.1 };
/** Rumpf-Haltung (Variante in Phase 1, `fx` in Phase 2 — dort gibt es nur den Skelett-Rahmen). */
type KPosture = 'normal' | 'duck' | 'upright' | 'fwd';

interface KrallSet {
  clawR: number;
  clawL: number;
  torso: number;
  fx: { torso: PartPose; clawR: PartPose; clawL: PartPose; magnet: PartPose };
}

/** Krall: Pose je Zug (bossStatusText aus defs.ts) und Abschnitt (bossSub), Anlauf/Nachfedern, Rumpf-Variante, Treffer. */
function krallSet(e: Enemy, time: number): KrallSet {
  const sub = e.bossSub ?? 'idle';
  const move = e.bossStatusText ?? '';
  const p2 = e.bossPhase2 === true;
  const hpPct = e.maxHp > 0 ? e.hp / e.maxHp : 1;
  const fx: KrallSet['fx'] = { torso: {}, clawR: {}, clawL: {}, magnet: {} };
  let r: number = KARM.hang;
  let l: number = KARM.hang;
  let posture: KPosture = 'normal';
  // Fortschritt: Vorwarnung 0…1; Erholung = vergangene Sekunden (`active` zählt als Beginn der Erholung)
  const wp = sub === 'windup' ? (e.bossStateMax && e.bossStateMax > 0 ? clamp01(1 - Math.max(0, e.bossStateTimer ?? 0) / e.bossStateMax) : 0) : 0;
  const rec = KRALL_RECOVER[move] ?? 1;
  const el = sub === 'recover' ? Math.max(0, rec - (e.bossStateTimer ?? rec)) : 0;
  const act = sub === 'active' || sub === 'recover';
  const k = Math.exp(-el / 0.08);
  if (sub === 'windup' || act) {
    switch (move) {
      case 'GREIFARM-STOSS':
        if (sub === 'windup') { r = KARM.windup; l = KARM.windup; posture = 'duck'; fx.torso = { dy: 1.5 * wp, sy: 1 - 0.05 * wp }; fx.clawR = { rot: -0.2 * wp }; fx.clawL = { rot: 0.2 * wp }; }
        else if (el < 0.55) { r = KARM.punch; l = KARM.side; posture = 'fwd'; fx.torso = { sx: 1 + 0.03 * k, dx: 1.2 * k }; fx.clawR = { rot: 0.12 * damped(el) }; }
        else { r = KARM.hang; l = KARM.hang; fx.clawR = { rot: 0.1 * damped(el - 0.55) }; }
        break;
      case 'MAGNET-ZUG': // Rumpf richtet sich auf, beide Arme öffnen seitlich — solange der Sog läuft
        if (sub === 'windup') { r = KARM.windup; l = KARM.windup; posture = 'upright'; fx.torso = { dy: -1.4 * wp }; fx.magnet = { dy: -1.2 * wp }; }
        else if (el < 1.1) { r = KARM.side; l = KARM.side; posture = 'upright'; fx.torso = { dy: -1.4, dx: Math.sin(time * 40) * 0.5 }; fx.magnet = { dy: -1.2 + Math.sin(time * 30) * 0.6, rot: Math.sin(time * 26) * 0.12 }; }
        else { fx.torso = { dy: -1.4 * Math.exp(-(el - 1.1) / 0.1) }; }
        break;
      case 'SCHROTT-WURF':
        if (sub === 'windup') { r = KARM.windup; l = KARM.windup; posture = 'duck'; fx.torso = { dy: 1.2 * wp, rot: -0.04 * wp }; fx.clawR = { rot: -0.2 * wp }; fx.clawL = { rot: 0.15 * wp }; }
        else if (el < 0.4) { r = KARM.side; l = KARM.hang; posture = 'fwd'; fx.torso = { dx: 1 * k }; fx.clawR = { rot: 0.15 * damped(el) }; }
        else { fx.clawR = { rot: 0.1 * damped(el - 0.4) }; }
        break;
      case 'SCHROTT-HAGEL': // Phase 2: hebt beide Arme, stampft sie in den Boden
        if (sub === 'windup') { r = KARM.windup; l = KARM.windup; posture = 'upright'; fx.torso = { dy: -1.5 * wp }; fx.clawR = { rot: -0.25 * wp }; fx.clawL = { rot: 0.25 * wp }; fx.magnet = { dy: -1.2 * wp }; }
        else { r = KARM.stomp; l = KARM.stomp; posture = el < 0.5 ? 'fwd' : 'normal'; fx.torso = { dy: 1.5 * k, sy: 1 - 0.06 * k }; fx.clawR = { rot: -0.15 * damped(el) }; fx.clawL = { rot: 0.15 * damped(el) }; }
        break;
    }
  }
  let torso: number = KTORSO[posture];
  if (p2) {
    // Phase 2: nur ein Skelett-Rahmen (beschädigt < 25 % HP) — Haltung über Verschiebung/Stauchung statt Bildwechsel
    torso = hpPct < 0.25 ? KTORSO.damaged : KTORSO.p2;
    const tf = fx.torso;
    if (posture === 'duck') fx.torso = { ...tf, dy: (tf.dy ?? 0) + 0.8, sy: (tf.sy ?? 1) * 0.96 };
    else if (posture === 'fwd') fx.torso = { ...tf, rot: (tf.rot ?? 0) + 0.04, sx: (tf.sx ?? 1) * 1.03 };
  } else if (hpPct < 0.25) torso = KTORSO.damaged;
  if (!act && sub !== 'windup') {
    // Ruhe/Gehen: Armschwung gegenläufig zu den Beinen, leichtes Lehnen
    const speed = Math.hypot(e.vx, e.vy);
    const w = clamp01(speed / 60);
    const s = Math.sin(time * (5 + w * 4) + e.id);
    fx.clawR = { rot: s * 0.14 * w };
    fx.clawL = { rot: s * 0.14 * w };
    fx.torso = { rot: Math.max(-0.05, Math.min(0.05, e.vx * 0.0008)) };
  }
  if (e.flashTimer > 0) {
    // Treffer-Reaktion: Rumpf zittert, Arme federn nach außen (nur in Ruhe/Vorwarnung, Angriffsposen bleiben)
    fx.torso = { ...fx.torso, dx: (fx.torso.dx ?? 0) + Math.sin(time * 90) };
    if (!act) {
      fx.clawR = { rot: (fx.clawR.rot ?? 0) - 0.08 };
      fx.clawL = { rot: (fx.clawL.rot ?? 0) + 0.08 };
    }
  }
  return { clawR: r, clawL: l, torso, fx };
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
/** Krall: schwere Maschine → trägere Annäherung als der Kern-Wächter. */
const KRALL_TAU = 0.1;
/** Krall-Zwischen-Posen der Arme (`von>nach`): Anlauf vor Stoß/Wurf/Stampfer, Ausschwingen nach dem Stoß. */
const CLAW_BETWEEN: Record<string, number> = { '0>2': KARM.windup, '0>3': KARM.windup, '0>5': KARM.windup, '2>0': KARM.side, '3>0': KARM.windup };
/** Bildwechsel dieses Teils erst nach x Sekunden — der linke Arm folgt dem rechten (wirkt weniger „synchron zappelnd“). */
const VARIANT_LAG: Record<string, number> = { clawL: 0.07 };

interface AnimState {
  cur: Record<string, Record<(typeof NUM_FIELDS)[number], number>>;
  variants: Record<string, number | undefined>;
  pulse: Record<string, number>;
  inter: Record<string, { v: number; until: number }>;
  lag: Record<string, { v: number; until: number }>;
  time: number;
}
const animStates = new WeakMap<Enemy, AnimState>();

/**
 * Glättet die Ziel-Pose über die Zeit: Drehung/Lage/Skalierung nähern sich exponentiell an (kein Springen),
 * Bildwechsel (`variant`) bleiben hart, bekommen aber einen kurzen Stauch-Impuls (sx 1.08 / sy 0.94, Rumpf zusätzlich dy +0.6),
 * damit das Auge den Schnitt nicht sieht. Zustand je Boss in einer WeakMap, Zeit nur über `time` (kein Date.now).
 */
function smoothPose(e: Enemy, target: Pose, time: number, tau = SMOOTH_TAU): Pose {
  let st = animStates.get(e);
  const first = !st;
  if (!st) {
    st = { cur: {}, variants: {}, pulse: {}, inter: {}, lag: {}, time };
    animStates.set(e, st);
  }
  const dt = first ? 0 : Math.max(0, Math.min(0.1, time - st.time));
  st.time = time;
  const k = first ? 1 : 1 - Math.exp(-dt / tau);
  const out: Pose = {};
  for (const [id, tgt] of Object.entries(target)) {
    const cur = (st.cur[id] ??= { rot: tgt.rot ?? 0, dx: tgt.dx ?? 0, dy: tgt.dy ?? 0, sx: tgt.sx ?? 1, sy: tgt.sy ?? 1 });
    for (const f of NUM_FIELDS) cur[f] = lerp(cur[f], tgt[f] ?? (f === 'sx' || f === 'sy' ? 1 : 0), k);
    const prev = st.variants[id];
    if (prev !== undefined && tgt.variant !== undefined && prev !== tgt.variant) {
      if (!NO_PULSE.has(id)) st.pulse[id] = PULSE_TIME;
      const mid = id.startsWith('arm') ? ARM_BETWEEN[`${normArm(prev)}>${normArm(tgt.variant)}`] : id.startsWith('claw') ? CLAW_BETWEEN[`${prev}>${tgt.variant}`] : undefined;
      if (VARIANT_LAG[id]) st.lag[id] = { v: prev, until: time + VARIANT_LAG[id] };
      if (mid !== undefined && !(prev === ARM.damagedP2 && tgt.variant === ARM.hang)) st.inter[id] = { v: mid, until: time + BETWEEN_TIME };
    }
    if (tgt.variant !== undefined) st.variants[id] = tgt.variant;
    const pulse = (st.pulse[id] = Math.max(0, (st.pulse[id] ?? 0) - dt)) / PULSE_TIME;
    const inter = st.inter[id];
    const lag = st.lag[id];
    const lagV = lag && time < lag.until ? lag.v : undefined;
    out[id] = {
      ...tgt,
      variant: lagV !== undefined ? lagV : inter && time < inter.until ? inter.v : tgt.variant,
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
  const pose = smoothPose(e, rawBossPose(rigId, e, time, lookDx), time, rigId === 'krall' ? KRALL_TAU : SMOOTH_TAU);
  if (e.bossPhase2) {
    for (const p of RIGS[rigId]?.parts ?? []) if (p.detach === 'phase2') pose[p.id] = { ...pose[p.id], hidden: true };
  }
  return pose;
}

interface Stride { phase: number; time: number }
const strides = new WeakMap<Enemy, Stride>();
/** Schrittphase aus zurückgelegter Strecke statt aus der Uhr: steht der Boss, stehen auch die Beine; schneller = größere Schritte. */
function stridePhase(e: Enemy, time: number, speed: number): number {
  const st = strides.get(e) ?? { phase: e.id, time };
  strides.set(e, st);
  const dt = Math.max(0, Math.min(0.1, time - st.time));
  st.time = time;
  st.phase += speed * dt * 0.16;
  return st.phase;
}

function rawBossPose(rigId: string, e: Enemy, time: number, lookDx: number): Pose {
  const speed = Math.hypot(e.vx, e.vy);
  const walk = Math.min(1, speed / 60);
  switch (rigId) {
    case 'krall': {
      const ph = stridePhase(e, time, speed);
      const amp = 0.03 + walk * 0.3;
      const s = Math.sin(ph);
      const c = Math.sin(ph + Math.PI);
      const breathe = Math.sin(time * 2.4 + e.id);
      const ks = krallSet(e, time);
      const kf = ks.fx;
      return {
        torso: { variant: ks.torso, dx: kf.torso.dx, rot: kf.torso.rot, sx: kf.torso.sx, dy: (kf.torso.dy ?? 0) - Math.abs(s) * walk * 1.2 + breathe * 0.4, sy: kf.torso.sy },
        legFL: { rot: s * amp },
        legBR: { rot: -s * amp * 0.9 },
        legFR: { rot: c * amp },
        legBL: { rot: -c * amp * 0.9 },
        clawR: { variant: ks.clawR, rot: Math.sin(time * 1.7 + 1) * 0.04 + (kf.clawR.rot ?? 0) },
        clawL: { variant: ks.clawL, rot: Math.sin(time * 1.7 + 2) * 0.04 + (kf.clawL.rot ?? 0) },
        magnet: { dy: Math.sin(time * 3.1) * 0.6 + (kf.magnet.dy ?? 0), rot: Math.sin(time * 2) * 0.06 + (kf.magnet.rot ?? 0) },
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
