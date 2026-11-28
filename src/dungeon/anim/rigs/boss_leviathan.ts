// M11/M12: A.E.G.I.S. Leviathan — Schienen-Kran-Koloss Rig (fester Schlitten auf Nordwand-Schiene, Torso 4 Phasen, Kopf verfolgt Spieler, 2 massive Pose-Set-Arme).
// Rein darstellend: keine Hitbox-/Schadensänderung, kein Math.random, Zeit nur über `time`.
import type { PartPose, Pose } from '../../../engine/rig';
import type { Enemy } from '../../dungeonTypes';
import type { RigAnim } from '../rigAnim';

const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));

interface LevRigState {
  hit: number;
  hitDir: number;
  wasFlash: boolean;
  time: number;
}
const states = new WeakMap<Enemy, LevRigState>();

function levPose(e: Enemy, time: number, playerX: number): Pose {
  let st = states.get(e);
  if (!st) {
    st = { hit: 0, hitDir: 1, wasFlash: false, time };
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

  const makeArmPose = (idx: 0 | 1): PartPose => {
    const arm = arms[idx];
    if (!arm || arm.dead) return { hidden: true };
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
      return {
        rot: side * -0.06 + shake,
        dx: side * 2,
        dy: -3 + Math.sin(time * 9) * 0.8,
        variant: 1, // armRaise
      };
    }
    if (arm.state === 'slamming' || arm.state === 'grounded') {
      torsoLean += side * 0.05;
      torsoDrop += 3;
      return {
        rot: 0,
        dx: 0,
        dy: arm.state === 'slamming' ? 2 : 3,
        // Im Boden: beschädigt/kritisch sichtbar, sonst armSlam!
        variant: frac < 0.35 ? 4 : frac < 0.7 ? 3 : 2,
      };
    }
    if (arm.state === 'whip') {
      // Schockwelle: Faust fährt hoch (Anlauf) und schlägt auf den Boden, genau dort startet die Welle
      const striking = arm.timer <= 0.55;
      if (striking) {
        torsoDrop += 2;
        return { rot: 0, dx: 0, dy: arm.timer > 0.4 ? 0 : 3, variant: frac < 0.35 ? 4 : frac < 0.7 ? 3 : 2 };
      }
      return { rot: side * -0.06, dx: side * 2, dy: -3, variant: 1 };
    }
    if (arm.state === 'beam' || beamFiring) {
      // Arme werden beim Omega-Reaktor-Strahl hochgerissen — die Brust-Linse liegt frei, der Strahl kommt sichtbar von dort
      return {
        rot: side * -0.1 + Math.sin(time * 20 + idx) * 0.015,
        dx: side * 22,
        dy: -2,
        variant: 1,
      };
    }
    // Ruhe / Schienenfahrt: kräftiges hydraulisches Schwingen
    const sway = Math.sin(time * breathRate + idx * 1.1) * 0.05;
    const moveLag = clamp(-e.vx / 140, -0.12, 0.12);
    return {
      rot: sway + moveLag,
      dy: Math.sin(time * breathRate + idx * 0.8) * 2.2,
      variant: dmgVar,
    };
  };

  const armL = makeArmPose(0);
  const armR = makeArmPose(1);

  const torsoVariant = dead ? 3 : phase === 3 ? 2 : phase === 2 ? 1 : 0;
  const headVariant = dead ? 2 : phase >= 2 ? 1 : 0;

  return {
    // Schlitten bleibt 100 % starr auf der Nordwand-Laufschiene (kein vertikales Wackeln!)
    carriage: {
      dx: 0,
      dy: 0,
      rot: 0,
    },
    torso: {
      dx: vibX + st.hit * 2.5 * st.hitDir,
      dy: breath + torsoDrop + (beamFiring ? -3 : 0),
      rot: torsoLean + st.hit * 0.05 * st.hitDir,
      variant: torsoVariant,
    },
    head: {
      dx: lookFrac * 4,
      dy: dead ? 4 : -breath * 0.35,
      rot: dead ? 0.12 : lookFrac * 0.16 - st.hit * 0.08 * st.hitDir,
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
