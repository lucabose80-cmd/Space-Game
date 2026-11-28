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
  const vibX = beamFiring || pulseOrGlow ? Math.sin(time * 44) * 1.4 : critical && !dead ? Math.sin(time * 32) * 0.9 : 0;

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
    const dmgVar = frac < 0.35 ? 4 : frac < 0.7 ? 3 : 0;

    if (dead) {
      return { rot: side * 0.12, dy: 8, variant: dmgVar };
    }
    if (arm.state === 'tracking') {
      torsoLean += -side * 0.08;
      torsoDrop -= 3;
      const shake = Math.sin(time * 36 + idx) * 0.04;
      return {
        rot: side * -0.18 + shake,
        dx: side * 4,
        dy: -16 + Math.sin(time * 18) * 2,
        variant: 1, // armRaise
      };
    }
    if (arm.state === 'slamming' || arm.state === 'grounded') {
      torsoLean += side * 0.07;
      torsoDrop += 5;
      const slamDrop = arm.state === 'slamming' ? 24 : 26;
      return {
        rot: side * 0.06,
        dx: side * 2,
        dy: slamDrop,
        // Im Boden: beschädigt/kritisch sichtbar, sonst armSlam!
        variant: frac < 0.35 ? 4 : frac < 0.7 ? 3 : 2,
      };
    }
    if (arm.state === 'beam' || beamFiring) {
      // Arme reißen beim Omega-Reaktor-Strahl seitlich auf
      return {
        rot: side * -0.22 + Math.sin(time * 28 + idx) * 0.03,
        dx: side * 10,
        dy: -6,
        variant: dmgVar,
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
  const headVariant = phase >= 2 && !dead ? 1 : 0;

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
  tau: 0.055,
};
