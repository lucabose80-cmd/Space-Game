// M11: Kern-Wächter (`core_warden`, kind `boss`) — Posen je Boss-Zustand, Beschädigungsstufen, Phase 2.
import type { PartPose } from '../../../engine/rig';
import type { Enemy } from '../../dungeonTypes';
import { clamp01, damped, elapsed, progress, stridePhase } from '../animCommon';
import type { RigAnim } from '../rigAnim';

/**
 * Pose-Set-Indizes (ART_BRIEF_M11 §3.2/§3.3 + S2–S5) — Reihenfolge = `variants` in rigs.json.
 * Arme (je Seite): 0 hängend · 1 Ausholen · 2 Schlag zur Kamera · 3 seitlich (Laser) · 4 Block · 5 Boden-Stampfer
 *   · 6 halb ausgeholt · 7 Schlag kurz vor Treffer · 8 zurückfedernd · 9 Laser-Ladung · 10 Block-Treffer · 11 Phase 2 beschädigt · 12 ohne Faust (Fäuste kreisen).
 */
const ARM = { hang: 0, windup: 1, punch: 2, side: 3, block: 4, stomp: 5, halfWindup: 6, preImpact: 7, recoil: 8, laserCharge: 9, blockHit: 10, damagedP2: 11, noFist: 12 } as const;
/** S6 (Phase 2): Angriffsposen ohne Faust — 13 Ausholen · 14 Stoß/Energie-Stumpf · 15 seitlich/Laser · 16 Block · 17 Stampfer · 18 halb ausgeholt (die Fäuste kreisen/fliegen separat). */
const NOFIST_OF: Record<number, number> = { 1: 13, 2: 14, 3: 15, 4: 16, 5: 17, 6: 18, 7: 14, 8: 18, 9: 15, 10: 16, 11: 12 };
/** P3-18/19 (Phase 1, HP < 65 %): beschädigte Arme 19–24 = Hauptposen 0–5 mit Rissen/Funken; Zwischenposen fallen auf die nächste Hauptpose. */
const DMG_ARM_BASE = 19;
const DMG_OF: Record<number, number> = { 0: 19, 1: 20, 2: 21, 3: 22, 4: 23, 5: 24, 6: 20, 7: 21, 8: 19, 9: 22, 10: 23 };
const unDmg = (v: number): number => (v >= DMG_ARM_BASE ? v - DMG_ARM_BASE : v);
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
  // D12 Beschädigungsstufen (HP-Anteil): P1 < 80 % Helm rissig · < 65 % Rumpf überhitzt/dampft · P2 < 35 % Arme zerfetzt · < 25 % Rumpf beschädigt · < 15 % Helm zerstört
  if (!p2 && hpPct < 0.8 && (head === HEAD.neutral || head === HEAD.lookL || head === HEAD.lookR || head === HEAD.blink)) head = HEAD.damaged;
  if (!p2 && hpPct < 0.65 && torso === TORSO.normal) torso = TORSO.hot;
  if (p2 && hpPct < 0.35 && arms === ARM.noFist) arms = ARM.damagedP2;
  return { arms, head, torso, fx };
}
/** Kern-Wächter: Umrechnung Strecken-Phase → Schritt-Takt (≈ alte Frequenz bei ~40 px/s). */
const CW_STRIDE_K = 0.72;

const normArm = (v: number): number => (v === ARM.damagedP2 ? ARM.hang : v);
/** S2: Zwischen-Posen der Arme — beim Wechsel `von>nach` (11 = beschädigt zählt wie hängend 0) kurz dieses Bild zeigen. */
const ARM_BETWEEN: Record<string, number> = { '0>1': ARM.halfWindup, '1>2': ARM.preImpact, '2>0': ARM.recoil };

export const anim: RigAnim = {
  noPulse: ['head'], // Blinzeln/Blickwechsel des Kopfes wären sonst unruhig
  between(id, prev, next) {
    if (!id.startsWith('arm')) return undefined;
    if (prev === ARM.damagedP2 && next === ARM.hang) return undefined;
    const r = ARM_BETWEEN[`${normArm(unDmg(prev))}>${normArm(unDmg(next))}`];
    return r !== undefined && prev >= DMG_ARM_BASE ? DMG_OF[r] : r;
  },
  rawPose(e, time, lookDx) {
    const sw = Math.sin(time * 1.8 + e.id);
    const breathe = Math.sin(time * 2.4 + e.id);
    const set = coreWardenSet(e, time, lookDx);
    const fx = set.fx;
    const walking = Math.hypot(e.vx, e.vy) > 8;
    const sway = (0.07 + sw * 0.05) * (walking ? 0.4 : 1);
    const sh = SHOULDER_ADJUST[set.torso] ?? SHOULDER_ADJUST[0];
    const damagedArms = !(e.bossPhase2 ?? false) && e.maxHp > 0 && e.hp / e.maxHp < 0.65 && DMG_OF[set.arms] !== undefined;
    const armVar = damagedArms ? DMG_OF[set.arms] : set.arms;
    const still = set.arms === ARM.hang || set.arms === ARM.noFist || set.arms === ARM.damagedP2; // nur im Ruhezustand pendeln, Angriffsposen stehen
    return {
      torso: { variant: set.torso, dx: fx.torso.dx, dy: fx.torso.dy, rot: fx.torso.rot, sx: fx.torso.sx, sy: (fx.torso.sy ?? 1) * (1 + breathe * 0.012) },
      head: { variant: set.head, rot: Math.sin(time * 1.3) * 0.04 + (fx.head.rot ?? 0), dy: Math.sin(time * 2.4 + 0.6) * 0.5 },
      armL: { variant: armVar, rot: (still ? sway : 0) + (fx.armL.rot ?? 0), dx: sh[0], dy: sh[1] },
      armR: { variant: armVar, rot: (still ? -sway : 0) + (fx.armR.rot ?? 0), dx: sh[2], dy: sh[3] },
      plateL: { hidden: true }, // Brustplatten: erst abgelöst (detached.ts) fliegen sie weg
      plateR: { hidden: true },
    };
  },
};
