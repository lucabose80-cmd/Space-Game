// M11: Krall (`krall`, kind `boss_breacher`) — Posen je Zug/Abschnitt (Arme, Rumpf, Beine, Magnet), Phase 2, Beschädigung.
import type { PartPose } from '../../../engine/rig';
import type { Enemy } from '../../dungeonTypes';
import { clamp01, damped, stridePhase } from '../animCommon';
import type { RigAnim } from '../rigAnim';

/**
 * Krall-Pose-Sets (ART_BRIEF_M11 §4.1) — Reihenfolge = `variants` in rigs.json.
 * Arme (clawR Greifzange / clawL Schrott-Haken, je Seite gleiche Posen): 0 hängend · 1 ausholend · 2 Stoß zur Kamera · 3 seitlich · 4 Block · 5 Boden-Stampfer.
 * Rumpf: 0 normal · 1 geduckt · 2 aufgerichtet (Kern hell, Magnet-Zug) · 3 nach vorn gebeugt (Stoß) · 4 Phase 2 (Rückenpanzer ab, Rahmen/Kern offen) · 5 beschädigt (Funken, Dellen).
/** + P0-06/07: 6 Teleskop kurz · 7 mittel · 8 voll ausgefahren · 9 Zuschnappen · 10 Sog (Funken) · 11 Hagel/Wurf mit Schrott gepackt */
const KARM = { hang: 0, windup: 1, punch: 2, side: 3, block: 4, stomp: 5, telS: 6, telM: 7, telL: 8, snap: 9, sog: 10, hold: 11 } as const;
const KTORSO = { normal: 0, duck: 1, upright: 2, fwd: 3, p2: 4, damaged: 5 } as const;
/**
 * P0-09 (`krall_torsos2`, Variante 6–11): Phase-2-Rahmen je Haltung. P0-11 (`krall_torsos3`, 12–17): Beschädigungsstufen.
 * Rumpf-Beschädigung: P1 < 80 % leicht · < 65 % mittel · < 25 % schwer | P2 < 35 % leicht · < 25 % schwer · < 15 % kritisch.
 */
const KT2 = { duck: 6, upright: 7, fwd: 8, stomp: 9, side: 10, hot: 11 } as const;
const KT3 = { p1Light: 12, p1Mid: 13, p1Heavy: 14, p2Light: 15, p2Heavy: 16, p2Crit: 17 } as const;
/** Rahmen-Rümpfe (schmaler als der Panzer) → Hüften nach innen */
const isFrameTorso = (t: number): boolean => t === KTORSO.p2 || (t >= KT2.duck && t <= KT2.hot) || t >= KT3.p2Light;
/** P0-12 (`krall_arms_R3/L3`, Variante 12–17): verbogen (hängend · ausholend · Stoß) · abgebrochener Stumpf (dito) */
const KARM_BENT = 12;
const KARM_STUMP = 15;
/**
 * P0-15/16 (`krall_arms_R4/L4`, Variante 18–23 = verbogen) und P0-17/18 (`R5/L5`, 24–29 = Stumpf) in den übrigen Posen:
 * seitlich · Block · Stampfer · Sog · Halten · Teleskop voll.
 */
const KARM_OTHER_BENT = 18;
const KARM_OTHER_STUMP = 24;
const KARM_OTHER: readonly number[] = [KARM.side, KARM.block, KARM.stomp, KARM.sog, KARM.hold, KARM.telL];
/** Arm-Pose → beschädigte Variante je Seite und HP-Anteil (Zange R: verbogen < 65 %, Stumpf < 35 % · Haken L: < 50 % / < 20 %) */
function damagedArm(v: number, hp: number, right: boolean): number {
  const stump = hp < (right ? 0.35 : 0.2);
  const bent = hp < (right ? 0.65 : 0.5);
  if (!bent) return v;
  const other = KARM_OTHER.indexOf(v);
  if (other >= 0) return (stump ? KARM_OTHER_STUMP : KARM_OTHER_BENT) + other;
  const base = v === 0 || v === 1 || v === 2 ? v : v >= KARM.telS && v <= KARM.snap ? 2 : -1; // Teleskop/Schnappen zählen als Stoß
  if (base < 0) return v;
  return (stump ? KARM_STUMP : KARM_BENT) + base;
}
/** Erholungszeit je Zug (defs.ts) — die Engine setzt `bossStateMax` nur für die Vorwarnung, `bossStateTimer` läuft in der Erholung von diesem Wert ab. */
const KRALL_RECOVER: Record<string, number> = { 'MAGNET-ZUG': 1.3, 'SCHROTT-WURF': 0.9, 'GREIFARM-STOSS': 0.9, 'SCHROTT-HAGEL': 1.1 };
/** Rumpf-Haltung (Variante in Phase 1, `fx` in Phase 2 — dort gibt es nur den Skelett-Rahmen). */
type KPosture = 'normal' | 'duck' | 'upright' | 'fwd' | 'stomp' | 'side' | 'hot';

/** Bein-Posen (krall_legs_R/L): 0 Schritt vor · 1 Schritt zurück · 2 Standbein · 3 angehoben · 4 geduckt · 5 Absprung. */
const KLEG = { fwd: 0, back: 1, stand: 2, lift: 3, crouch: 4, jump: 5 } as const;
/** P0-10 (`krall_legs_R2/L2`, Variante 6–11): Ausfall gestreckt · Bremsen · Stampfer-Landung gespreizt · Phase 2 humpelnd · Magnet-Stemmen · Ruhe-Zittern */
const KLEG2 = { lunge: 6, brake: 7, landing: 8, limp: 9, brace: 10, tremble: 11 } as const;
/** Bein-Variante aus Gangphase `s` (−1…1): Geduckt/Stampfen überschreibt, im Stand Standbein (Phase 2: Ruhe-Zittern), beim Gehen Vor → Anheben → Zurück (Phase 2 < 35 %: humpelnd). */
function legPose(ks: KrallSet, walk: number, s: number): number {
  if (ks.leg !== undefined) return ks.leg;
  if (walk < 0.12) return ks.p2 ? KLEG2.tremble : KLEG.stand;
  if (s > 0.45) return KLEG.fwd;
  if (s < -0.45) return ks.p2 && ks.hp < 0.35 ? KLEG2.limp : KLEG.back;
  return KLEG.lift;
}

interface KrallSet {
  magnetOn: boolean;
  p2: boolean;
  hp: number;
  /** Erzwungene Bein-Pose (Angriff); `undefined` = Gehen/Stand */
  leg?: number;
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
  let leg: number | undefined;
  // Fortschritt: Vorwarnung 0…1; Erholung = vergangene Sekunden (`active` zählt als Beginn der Erholung)
  const wp = sub === 'windup' ? (e.bossStateMax && e.bossStateMax > 0 ? clamp01(1 - Math.max(0, e.bossStateTimer ?? 0) / e.bossStateMax) : 0) : 0;
  const rec = KRALL_RECOVER[move] ?? 1;
  const el = sub === 'recover' ? Math.max(0, rec - (e.bossStateTimer ?? rec)) : 0;
  const act = sub === 'active' || sub === 'recover';
  const k = Math.exp(-el / 0.08);
  if (sub === 'windup' || act) {
    switch (move) {
      case 'GREIFARM-STOSS':
        if (sub === 'windup') { leg = KLEG.crouch; r = KARM.windup; l = KARM.windup; posture = 'duck'; fx.torso = { dy: 1.5 * wp, sy: 1 - 0.05 * wp }; fx.clawR = { rot: -0.2 * wp }; fx.clawL = { rot: 0.2 * wp }; }
        else if (el < 0.55) {
          // Teleskop-Stoß (P0-06/07): der Arm zur Stoßseite fährt aus (kurz → mittel → voll), zeigt zum Ziel, schnappt am Ende zu
          const tel = el < 0.1 ? KARM.telS : el < 0.2 ? KARM.telM : el < 0.4 ? KARM.telL : KARM.snap;
          const dirX = e.chargeDirX ?? 1;
          const ang = Math.atan2(e.chargeDirY ?? 0, dirX);
          const aim = Math.max(-1.2, Math.min(1.2, dirX >= 0 ? ang : ang > 0 ? ang - Math.PI : ang + Math.PI));
          leg = el < 0.3 ? KLEG2.lunge : el < 0.55 ? KLEG2.brake : KLEG.fwd;
          if (dirX >= 0) { r = tel; l = KARM.side; } else { l = tel; r = KARM.side; }
          posture = 'fwd'; fx.torso = { sx: 1 + 0.03 * k, dx: 1.2 * k };
          const rdx2 = (e.chargeDirX ?? 0) * 4 * k; const rdy2 = (e.chargeDirY ?? 0) * 3 * k;
          if (dirX >= 0) { fx.clawR = { rot: aim, dx: rdx2, dy: rdy2 }; fx.clawL = { dx: rdx2 * 0.5, dy: rdy2 * 0.5 }; } else { fx.clawL = { rot: aim, dx: rdx2, dy: rdy2 }; fx.clawR = { dx: rdx2 * 0.5, dy: rdy2 * 0.5 }; }
        }
        else { r = KARM.hang; l = KARM.hang; fx.clawR = { rot: 0.1 * damped(el - 0.55) }; }
        break;
      case 'MAGNET-ZUG': // Rumpf richtet sich auf, beide Arme öffnen seitlich — solange der Sog läuft
        if (sub === 'windup') { leg = KLEG.stand; r = KARM.windup; l = KARM.windup; posture = 'upright'; fx.torso = { dy: -1.4 * wp }; fx.magnet = { dy: -1.2 * wp }; }
        else if (el < 1.1) { leg = KLEG2.brace; r = KARM.sog; l = KARM.sog; posture = 'upright'; fx.torso = { dy: -1.4, dx: Math.sin(time * 40) * 0.5 }; fx.magnet = { dy: -1.2 + Math.sin(time * 30) * 0.6, rot: Math.sin(time * 26) * 0.12 }; }
        else { fx.torso = { dy: -1.4 * Math.exp(-(el - 1.1) / 0.1) }; }
        break;
      case 'SCHROTT-WURF':
        if (sub === 'windup') { leg = KLEG.crouch; r = KARM.hold; l = KARM.windup; posture = 'duck'; fx.torso = { dy: 1.2 * wp, rot: -0.04 * wp }; fx.clawR = { rot: -0.2 * wp }; fx.clawL = { rot: 0.15 * wp }; }
        else if (el < 0.4) { leg = KLEG.fwd; r = KARM.side; l = KARM.hang; posture = 'side'; fx.torso = { dx: 1 * k }; fx.clawR = { rot: 0.15 * damped(el) }; }
        else { fx.clawR = { rot: 0.1 * damped(el - 0.4) }; }
        break;
      case 'SCHROTT-HAGEL': // Phase 2: hebt beide Arme, stampft sie in den Boden
        if (sub === 'windup') { leg = wp < 0.5 ? KLEG.lift : KLEG.jump; r = KARM.hold; l = KARM.hold; posture = wp > 0.7 ? 'hot' : 'upright'; fx.torso = { dy: -1.5 * wp }; fx.clawR = { rot: -0.25 * wp }; fx.clawL = { rot: 0.25 * wp }; fx.magnet = { dy: -1.2 * wp }; }
        else { leg = el < 0.5 ? KLEG2.landing : KLEG.stand; r = KARM.stomp; l = KARM.stomp; posture = el < 0.5 ? 'stomp' : 'normal'; fx.torso = { dy: 1.5 * k, sy: 1 - 0.06 * k }; fx.clawR = { rot: -0.15 * damped(el) }; fx.clawL = { rot: 0.15 * damped(el) }; }
        break;
    }
  }
  // Rumpf: Phase 1 Panzer-Haltung, Phase 2 Rahmen-Haltung (krall_torsos2) — ab Beschädigungsstufe das passende krall_torsos3-Bild (Haltung dann über fx)
  let torso: number;
  let dmg = -1;
  if (p2) dmg = hpPct < 0.15 ? KT3.p2Crit : hpPct < 0.25 ? KT3.p2Heavy : hpPct < 0.35 ? KT3.p2Light : -1;
  else dmg = hpPct < 0.25 ? KT3.p1Heavy : hpPct < 0.65 ? KT3.p1Mid : hpPct < 0.8 ? KT3.p1Light : -1;
  if (p2) torso = posture === 'duck' ? KT2.duck : posture === 'upright' ? KT2.upright : posture === 'fwd' ? KT2.fwd : posture === 'stomp' ? KT2.stomp : posture === 'side' ? KT2.side : posture === 'hot' ? KT2.hot : KT2.duck; // Rahmen in Ruhe = neutrale Pose aus krall_torsos2 (Panzer-Maßstab)
  else torso = KTORSO[posture === 'stomp' || posture === 'side' ? 'fwd' : posture === 'hot' ? 'upright' : posture];
  if (dmg >= 0) {
    // Beschädigung ersetzt das Haltungsbild — die Haltung zeigt dann Verschiebung/Stauchung
    const tf = fx.torso;
    if (posture === 'duck') fx.torso = { ...tf, dy: (tf.dy ?? 0) + 0.8, sy: (tf.sy ?? 1) * 0.96 };
    else if (posture === 'fwd' || posture === 'stomp' || posture === 'side') fx.torso = { ...tf, rot: (tf.rot ?? 0) + 0.04, sx: (tf.sx ?? 1) * 1.03 };
    torso = dmg;
  }
  r = damagedArm(r, hpPct, true);
  l = damagedArm(l, hpPct, false);
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
  if (leg === undefined && hpPct < 0.25 && Math.hypot(e.vx, e.vy) < 8) leg = KLEG.crouch; // schwer beschädigt: sackt im Stand in die Knie
  return { p2, hp: hpPct, clawR: r, clawL: l, torso, fx, magnetOn: move === 'MAGNET-ZUG' && act && el < 1.1, leg };
}

/** Krall-Zwischen-Posen der Arme (`von>nach`): Anlauf vor Stoß/Wurf/Stampfer, Ausschwingen nach dem Stoß. */
const CLAW_BETWEEN: Record<string, number> = { '0>2': KARM.windup, '0>3': KARM.windup, '0>5': KARM.windup, '2>0': KARM.side, '3>0': KARM.windup };

/** D3: Übergang zwischen intaktem und beschädigtem Arm (Variante ≥ 12): kurz über die „ausholende“ Pose der Schadensklasse (verbogen 13 · Stumpf 16), damit kein harter Bildsprung entsteht */
function dmgClass(v: number): 0 | 1 | 2 {
  if ((v >= KARM_BENT && v < KARM_STUMP) || (v >= KARM_OTHER_BENT && v < KARM_OTHER_STUMP)) return 1;
  if ((v >= KARM_STUMP && v < KARM_OTHER_BENT) || v >= KARM_OTHER_STUMP) return 2;
  return 0;
}
function dmgBetween(prev: number, next: number): number | undefined {
  const cp = dmgClass(prev);
  const cn = dmgClass(next);
  if (cp === cn) return undefined;
  return (Math.max(cp, cn) === 2 ? KARM_STUMP : KARM_BENT) + 1; // ausholend
}

export const anim: RigAnim = {
  tau: 0.1, // schwere Maschine → trägere Annäherung als der Kern-Wächter
  noPulse: ['legFL', 'legFR', 'legBL', 'legBR', 'magnet'],
  lag: { clawL: 0.07 }, // der linke Arm folgt dem rechten (wirkt weniger „synchron zappelnd“)
  between: (id, prev, next) => (id.startsWith('claw') ? CLAW_BETWEEN[`${prev}>${next}`] ?? dmgBetween(prev, next) : undefined),
  rawPose(e, time) {
    const speed = Math.hypot(e.vx, e.vy);
    const walk = Math.min(1, speed / 60);
    const ph = stridePhase(e, time, speed);
    const amp = 0.03 + walk * 0.3;
    const s = Math.sin(ph);
    const c = Math.sin(ph + Math.PI);
    const breathe = Math.sin(time * 2.4 + e.id);
    const ks = krallSet(e, time);
    const kf = ks.fx;
    const legIn = isFrameTorso(ks.torso) ? 1 : 0;
    return {
      torso: { variant: ks.torso, dx: kf.torso.dx, rot: kf.torso.rot, sx: kf.torso.sx, dy: (kf.torso.dy ?? 0) - Math.abs(s) * walk * 1.2 + breathe * 0.4, sy: kf.torso.sy },
      // Phase-2-Rahmen ist schmaler als der Panzer-Rumpf: Hüften nach innen, damit die Beine am Körper sitzen
      legFL: { variant: legPose(ks, walk, s), rot: s * amp * 0.25, dx: legIn * 6.5 },
      legBR: { variant: legPose(ks, walk, -s), rot: -s * amp * 0.2, dx: -legIn * 7 },
      legFR: { variant: legPose(ks, walk, c), rot: c * amp * 0.25, dx: -legIn * 6.5 },
      legBL: { variant: legPose(ks, walk, -c), rot: -c * amp * 0.2, dx: legIn * 7 },
      clawR: { variant: ks.clawR, rot: Math.sin(time * 1.7 + 1) * 0.04 + (kf.clawR.rot ?? 0), dx: kf.clawR.dx, dy: kf.clawR.dy },
      clawL: { variant: ks.clawL, rot: Math.sin(time * 1.7 + 2) * 0.04 + (kf.clawL.rot ?? 0), dx: kf.clawL.dx, dy: kf.clawL.dy },
      magnet: { variant: ks.magnetOn ? 1 : 0, dy: Math.sin(time * 3.1) * 0.6 + (kf.magnet.dy ?? 0), rot: Math.sin(time * 2) * 0.06 + (kf.magnet.rot ?? 0) },
      plate: { dy: breathe * 0.5 },
    };
  },
};
