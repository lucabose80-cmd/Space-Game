// M11 (Phase 1): Ruhe-/Lauf-Posen für Boss-Rigs. Die zugspezifischen Posen (Ausholen, Schlag, Verwandlung)
// kommen in den Boss-Phasen 3–6; die Spiellogik bleibt in bosses/defs.ts.
import type { Pose } from '../../engine/rig';
import type { Enemy } from '../dungeonTypes';

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
        claw: { rot: Math.sin(time * 1.7 + 1) * 0.07 - 0.18 },
        magnet: { dy: Math.sin(time * 3.1) * 0.6, rot: Math.sin(time * 2) * 0.06 },
        plate: { dy: breathe * 0.5 },
      };
    }
    case 'core_warden': {
      const sw = Math.sin(time * 1.8 + e.id);
      const breathe = Math.sin(time * 2.4 + e.id);
      return {
        torso: { sy: 1 + breathe * 0.012 },
        head: { rot: Math.sin(time * 1.3) * 0.04, dy: Math.sin(time * 2.4 + 0.6) * 0.5 },
        armL: { rot: 0.08 + sw * 0.07 },
        armR: { rot: -0.08 - sw * 0.07 },
        fistL: { rot: -sw * 0.08 },
        fistR: { rot: sw * 0.08 },
        plateL: { dy: -breathe * 0.4 },
        plateR: { dy: -breathe * 0.4 },
      };
    }
    default:
      return {};
  }
}
