// M11 (Phase 1): Ruhe-/Lauf-Posen für Boss-Rigs. Die zugspezifischen Posen (Ausholen, Schlag, Verwandlung)
// kommen in den Boss-Phasen 3–6; die Spiellogik bleibt in bosses/defs.ts.
import type { PartPose, Pose } from '../../engine/rig';
import type { Enemy } from '../dungeonTypes';

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

/** Pose-Set-Indizes (ART_BRIEF_M11 §3.2/§3.3) — Arme: 0 hängend · 1 Ausholen · 2 Schlag zur Kamera · 3 seitlich (Laser) · 4 Block · 5 Boden-Stampfer. */
const ARM = { hang: 0, windup: 1, punch: 2, side: 3, block: 4, stomp: 5 } as const;
/** Köpfe: 0 neutral · 1 brüllend · 2 zielend (nach unten) · 3 getroffen (zurückgeworfen) · 4 Phase 2 · 5 beschädigt. */
const HEAD = { neutral: 0, roar: 1, aim: 2, hit: 3, p2: 4, damaged: 5 } as const;
/** Rümpfe: 0 normal · 1 geduckt · 2 zurückgelehnt · 3 vorgebeugt · 4 Phase 2 offen · 5 überhitzt. */
const TORSO = { normal: 0, duck: 1, back: 2, fwd: 3, p2: 4, hot: 5 } as const;

/** Schulter-Feinjustierung je Rumpf-Variante (Spielpixel): [linker Arm dx, dy, rechter Arm dx, dy] — der Rumpf neigt sich je Pose, die Arm-Gelenke wandern mit. */
export const SHOULDER_ADJUST: Array<[number, number, number, number]> = [
  [0, 0, 0, 0], // 0 normal
  [0.5, 0.5, -3, 1], // 1 geduckt (Rumpf kippt nach links)
  [0, 1, -3, 0.5], // 2 zurückgelehnt
  [0, 0, 0, 0], // 3 vorgebeugt
  [0, 0, 0, 0], // 4 Phase 2
  [0, 0, 0, 0], // 5 überhitzt
];

/** Kern-Wächter: Pose-Set je Boss-Zustand (Zustände aus enemyAi.ts). `roar` ≥ 0 = Fortschritt der Phase-2-Verwandlung (Brustplatten fliegen weg). */
function coreWardenSet(e: Enemy): { arms: number; head: number; torso: number; roar: number } {
  const p2 = e.bossPhase2 === true;
  let arms: number = ARM.hang;
  let head: number = p2 ? HEAD.p2 : HEAD.neutral;
  let torso: number = p2 ? TORSO.p2 : TORSO.normal;
  let roar = -1;
  switch (e.bossState) {
    case 'charge_windup':
      arms = ARM.windup; torso = TORSO.duck; head = HEAD.aim;
      break;
    case 'charge_dash':
      arms = ARM.punch; torso = TORSO.fwd; head = HEAD.aim;
      break;
    case 'slam_jump':
    case 'slam_air':
      arms = ARM.windup; torso = TORSO.back;
      break;
    case 'slam_impact':
      arms = ARM.stomp; torso = TORSO.fwd; head = HEAD.aim;
      break;
    case 'laser_windup':
      arms = ARM.side; torso = TORSO.back; head = HEAD.aim;
      break;
    case 'laser_sweep':
      arms = ARM.side; head = HEAD.roar;
      break;
    case 'pylon_barrage':
      arms = ARM.block; head = HEAD.roar;
      break;
    case 'phase2_roar':
      arms = ARM.windup; torso = TORSO.p2; head = HEAD.roar;
      roar = clamp01(1 - Math.max(0, e.bossStateTimer ?? 0) / Math.max(0.01, e.bossStateMax ?? 1.1));
      break;
    case 'stunned':
      torso = TORSO.hot; head = HEAD.damaged;
      break;
    default:
      if (e.flashTimer > 0) head = HEAD.hit; // Treffer: Kopf zuckt zurück
  }
  return { arms, head, torso, roar };
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

export function getBossPose(rigId: string, e: Enemy, time: number): Pose {
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
      const set = coreWardenSet(e);
      const sway = 0.07 + sw * 0.05;
      const sh = SHOULDER_ADJUST[set.torso] ?? SHOULDER_ADJUST[0];
      const still = set.arms === ARM.hang; // nur im Ruhezustand pendeln, Angriffsposen stehen
      const r = set.roar;
      const plate = (dir: number): PartPose =>
        r >= 0 && r < 1
          ? { dx: dir * r * 38, dy: -r * 16 + r * r * 34, rot: dir * r * 3.4, alpha: 1 - clamp01((r - 0.55) / 0.45) }
          : { hidden: true };
      return {
        torso: { variant: set.torso, sy: 1 + breathe * 0.012 },
        head: { variant: set.head, rot: Math.sin(time * 1.3) * 0.04, dy: Math.sin(time * 2.4 + 0.6) * 0.5 },
        armL: { variant: set.arms, rot: still ? sway : 0, dx: sh[0], dy: sh[1] },
        armR: { variant: set.arms, rot: still ? -sway : 0, dx: sh[2], dy: sh[3] },
        plateL: plate(-1),
        plateR: plate(1),
      };
    }
    default:
      return {};
  }
}
