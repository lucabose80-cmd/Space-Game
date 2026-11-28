// M11/M12: A.E.G.I.S. Leviathan — Schienen-Kran-Koloss Rig (fester Schlitten auf Nordwand-Schiene, Torso 4 Phasen, Kopf verfolgt Spieler, 2 massive Pose-Set-Arme).
// Rein darstellend: keine Hitbox-/Schadensänderung, kein Math.random, Zeit nur über `time`.
import type { PartPose, Pose } from '../../../engine/rig';
import type { Enemy } from '../../dungeonTypes';
import type { RigAnim } from '../rigAnim';

/** Ruhe-Spreizung der Arme (rad): bewegt die Fäuste weg von der Brustmitte */
const IDLE_SPREAD = 0.5;
const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));

interface LevRigState {
  hit: number;
  hitDir: number;
  wasFlash: boolean;
  time: number;
  /** je Arm: letzter Zustand + Sekunden seit dem Wechsel (für weiche Zwischenposen) */
  armState: [string, string];
  armSince: [number, number];
  armWasUp: [boolean, boolean];
  /** laufender Zug (L.moveIdx) + Sekunden seit Zugbeginn */
  moveIdx: number;
  moveSince: number;
  /** Sekunden seit Phasenwechsel-Beginn */
  transSince: number;
}
const states = new WeakMap<Enemy, LevRigState>();

function levPose(e: Enemy, time: number, playerX: number): Pose {
  let st = states.get(e);
  if (!st) {
    st = { hit: 0, hitDir: 1, wasFlash: false, time, armState: ['', ''], armSince: [0, 0], armWasUp: [false, false], moveIdx: -1, moveSince: 0, transSince: 0 };
    states.set(e, st);
  }
  const dt = clamp(time - st.time, 0, 0.1);
  st.time = time;

  const flashing = e.flashTimer > 0;
  if (flashing && !st.wasFlash) {
    st.hit = 1;
    st.hitDir = -st.hitDir;
  }
  st.wasFlash = flashing;
  st.hit = Math.max(0, st.hit - dt / 0.14);

  const L = e.levArena;
  const dead = !L ? e.hp <= 0 : L.state === 'dead' || e.hp <= 0;
  const phase = L?.phase ?? (e.bossPhase2 ? 2 : 1);
  if (L && st.moveIdx !== L.moveIdx) {
    st.moveIdx = L.moveIdx;
    st.moveSince = 0;
  }
  st.moveSince += dt;
  const transition = !dead && L?.state === 'transition';
  st.transSince = transition ? st.transSince + dt : 0;
  const mv = !dead && L?.state === 'move' ? L.move : null;
  const critical = !!L?.critical;
  const beamFiring = !dead && L?.state === 'move' && L.move === 'beam';
  const pulseOrGlow = !dead && L?.state === 'move' && (L.move === 'pulse' || L.move === 'glow' || L.move === 'grab');

  const breathRate = critical ? 6.5 : phase === 3 ? 4.5 : 2.3;
  const breath = dead ? 0 : Math.sin(time * breathRate) * (critical ? 2.6 : 1.8);
  const vibX = beamFiring || pulseOrGlow ? Math.sin(time * 30) * 0.8 : critical && !dead ? Math.sin(time * 24) * 0.6 : 0;

  // Kopf folgt dem Spieler
  const lookFrac = clamp((playerX - e.x) / 220, -1, 1);

  // Arme analysieren (links = 0, rechts = 1)
  const arms = e.levArms ?? [];
  let torsoLean = 0;
  let torsoDrop = 0;

  // Varianten: 0 Ruhe · 1 Hochriss · 2 Schlag am Boden · 3/4 beschädigt/kritisch · 5 tot · 6 Anlauf (Ellbogen außen) · 7 Schwung nach unten
  const WIND = 6;
  const STRIKE = 7;
  const makeArmPose = (idx: 0 | 1): PartPose => {
    const arm = arms[idx];
    if (arm) {
      if (st.armState[idx] !== arm.state) {
        st.armWasUp[idx] = st.armState[idx] === 'tracking' || st.armState[idx] === 'whip' || st.armState[idx] === 'beam';
        st.armState[idx] = arm.state;
        st.armSince[idx] = 0;
      }
      st.armSince[idx] += dt;
    }
    const since = st.armSince[idx];
    // Zerstörter Arm: bleibt als funkender Schulterstumpf sichtbar (Wrack, A13)
    if (!arm || arm.dead) return arm ? { variant: 8, dy: 0 } : { hidden: true };
    const side = idx === 0 ? -1 : 1;
    const frac = L ? L.armHp[idx] / Math.max(1, L.armMax) : 1;
    // Phase II/III: Arme sind von Anfang an sichtbar ramponiert (Lava-Risse, später Kurzschluss-Glut)
    const phaseVar = phase >= 3 ? 4 : phase === 2 ? 3 : 0;
    const dmgVar = Math.max(phaseVar, frac < 0.35 ? 4 : frac < 0.7 ? 3 : 0);

    if (dead) {
      // Abgeschaltet: eigener, erloschener Arm (armDead), schlaff hängend
      return { rot: side * 0.08, dy: 10, variant: 5 };
    }
    if (arm.state === 'tracking') {
      torsoLean += -side * 0.06;
      torsoDrop -= 2;
      const shake = Math.sin(time * 22 + idx) * 0.012;
      // Ruhe → Anlauf (Ellbogen außen) → Hochriss → kurz vor dem Schlag wieder Anlauf-Pose
      const v = since < 0.16 ? WIND : arm.timer < 0.14 ? WIND : 1;
      return {
        rot: side * -0.06 + shake,
        dx: side * 2,
        dy: -3 + Math.sin(time * 9) * 0.8,
        variant: v,
      };
    }
    if (arm.state === 'slamming') {
      // Schwung nach unten: Zwischenpose, Ellbogen bleibt außen
      torsoLean += side * 0.05;
      torsoDrop += 2;
      return { rot: 0, dx: 0, dy: 1, variant: STRIKE };
    }
    if (arm.state === 'grounded') {
      torsoLean += side * 0.05;
      torsoDrop += 3;
      return {
        rot: 0,
        dx: 0,
        dy: 3,
        // Im Boden: beschädigt/kritisch sichtbar, sonst armSlam!
        variant: frac < 0.35 ? 4 : frac < 0.7 ? 3 : 2,
      };
    }
    if (arm.state === 'whip') {
      // Schockwelle: Faust fährt hoch (Anlauf) und schlägt auf den Boden, genau dort startet die Welle
      if (arm.timer <= 0.4) {
        torsoDrop += 2;
        return { rot: 0, dx: 0, dy: 3, variant: frac < 0.35 ? 4 : frac < 0.7 ? 3 : 2 };
      }
      if (arm.timer <= 0.55) {
        torsoDrop += 1;
        return { rot: 0, dx: 0, dy: 1, variant: STRIKE };
      }
      const v = since < 0.16 || arm.timer <= 0.7 ? WIND : 1;
      return { rot: side * -0.06, dx: side * 2, dy: -3, variant: v };
    }
    if (arm.state === 'beam' || beamFiring) {
      // Arme werden beim Omega-Reaktor-Strahl hochgerissen — die Brust-Linse liegt frei, der Strahl kommt sichtbar von dort
      return {
        rot: side * -0.1 + Math.sin(time * 20 + idx) * 0.015,
        dx: side * 22,
        dy: -2,
        variant: since < 0.16 ? WIND : 1,
      };
    }
    // Phasenwechsel (D7): beide Arme reißen auf, der Koloss brüllt und bebt — einmalig & lesbar
    if (transition) {
      torsoDrop -= 2;
      return {
        rot: side * -0.12 + Math.sin(time * 26 + idx) * 0.03,
        dx: side * 12,
        dy: -3,
        variant: st.transSince < 0.25 ? WIND : 1,
      };
    }
    // Zugspezifische Posen (D2/D4): Anlauf → Halten → Erholung je Attacke
    if (mv) {
      const ms = st.moveSince;
      const up = ms < 0.22 ? WIND : 1;
      if (mv === 'debris') {
        // Trümmerfall: beide Fäuste greifen zur Decke
        return { rot: side * -0.08, dx: side * 14, dy: -4 + Math.sin(time * 12 + idx) * 1.2, variant: up };
      }
      if (mv === 'pulse') {
        torsoDrop -= 1;
        return { rot: side * -0.1 + Math.sin(time * 24 + idx) * 0.02, dx: side * 18, dy: -2, variant: up };
      }
      if (mv === 'grab') {
        // Kabel-Griff: Arme ziehen zur Brust, Gravitation saugt
        torsoDrop += 1;
        return { rot: side * -0.05 + Math.sin(time * 9 + idx) * 0.03, dx: -side * 6, dy: 0, variant: WIND };
      }
      if (mv === 'steam') {
        // Überdruck: Arme pumpen hydraulisch auf und ab
        return { rot: side * -0.1 + Math.sin(time * 7 + idx * 2) * 0.12, dx: side * 8, dy: Math.sin(time * 7 + idx * 2) * 3, variant: WIND };
      }
      if (mv === 'glow') {
        // Glut-Welle: ausholen, dann beide Fäuste auf den Boden
        if (ms < 0.25) return { rot: side * -0.06, dx: side * 4, dy: -2, variant: WIND };
        if (ms < 0.85) return { rot: side * -0.06, dx: side * 4, dy: -3, variant: 1 };
        torsoDrop += 2;
        if (ms < 1.05) return { rot: 0, dx: 0, dy: 1, variant: STRIKE };
        return { rot: 0, dx: 0, dy: 3, variant: frac < 0.35 ? 4 : frac < 0.7 ? 3 : 2 };
      }
    }
    // Zurück aus Hochriss/Schlag: kurz Anlauf-Pose, damit der Ellbogen nicht umklappt
    if (st.armWasUp[idx] && since < 0.2) return { rot: side * -0.05, dx: side * 2, dy: -2, variant: WIND };
    // Ruhe / Schienenfahrt: kräftiges hydraulisches Schwingen
    const sway = Math.sin(time * breathRate + idx * 1.1) * 0.05;
    const moveLag = clamp(-e.vx / 140, -0.12, 0.12);
    // Arme hängen locker neben dem Körper — Fäuste NICHT in der Mitte gegeneinander gedrückt (Schwung nach außen)
    return {
      rot: -side * IDLE_SPREAD + sway + moveLag,
      dx: side * 6,
      dy: 4 + Math.sin(time * breathRate + idx * 0.8) * 2.2,
      variant: dmgVar,
    };
  };

  const armL = makeArmPose(0);
  const armR = makeArmPose(1);
  // Treffer-Reaktion (auch bei Panzer-Treffern): Arme federn zurück, getroffener Arm zuckt stärker
  const kick = Math.max(0, L?.hitKick ?? 0);
  const armK = L?.armKick ?? [0, 0];
  for (const [p, idx] of [[armL, 0], [armR, 1]] as const) {
    if (p.hidden) continue;
    const side = idx === 0 ? -1 : 1;
    const k = Math.max(kick * 0.5, armK[idx]);
    p.rot = (p.rot ?? 0) + side * 0.13 * k;
    p.dy = (p.dy ?? 0) + 3.2 * k;
    p.dx = (p.dx ?? 0) - side * 2 * k;
  }

  // Beschädigungsstufen (D12) nach Boss-HP: P1 intakt → <88 % → <76 % · P2 → <52 % → <40 % · P3 · kritisch (<15 %, Partikel + Flackern)
  const hpF = e.maxHp > 0 ? e.hp / e.maxHp : 1;
  const torsoVariant = dead ? 3 : phase === 3 ? 2 : phase === 2 ? (hpF < 0.4 ? 7 : hpF < 0.52 ? 6 : 1) : hpF < 0.76 ? 5 : hpF < 0.88 ? 4 : 0;
  const headVariant = dead ? 2 : phase >= 2 ? 1 : 0;
  const roar = transition ? Math.sin(time * 30) * 0.03 - 0.16 : 0;

  return {
    // Schlitten bleibt 100 % starr auf der Nordwand-Laufschiene (kein vertikales Wackeln!)
    carriage: {
      dx: 0,
      dy: 0,
      rot: 0,
    },
    torso: {
      dx: vibX + st.hit * 2.5 * st.hitDir + kick * 1.6 * st.hitDir,
      dy: breath + torsoDrop + (beamFiring ? -3 : 0) + kick * 2.4,
      rot: torsoLean + st.hit * 0.05 * st.hitDir + kick * 0.04 * st.hitDir,
      variant: torsoVariant,
    },
    head: {
      dx: lookFrac * 4 - kick * st.hitDir * 1.5,
      dy: dead ? 4 : -breath * 0.35,
      rot: dead ? 0.12 : lookFrac * 0.16 * (transition ? 0 : 1) + roar - st.hit * 0.08 * st.hitDir,
      variant: headVariant,
    },
    armL,
    armR,
  };
}

export const anim: RigAnim = {
  rawPose: (e, time, playerX) => levPose(e, time, playerX),
  facing: () => 1,
  tau: 0.085,
};
