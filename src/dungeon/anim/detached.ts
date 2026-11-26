// M11 (Phase 2): abgelöste Rig-Teile (Phase-2-Verwandlung: Brustplatten fliegen weg, Rückenpanzer fällt ab).
// Rein darstellend: Teile fliegen im Bogen (Höhe z über dem Boden), prallen einmal auf, blenden aus. Kein Schaden, kein Zufall.
import { layoutRig, type PartPose, type Pose, type RigDef, type RigImages } from '../../engine/rig';

export interface DetachedPart {
  img: HTMLCanvasElement;
  w: number;
  h: number;
  px: number;
  py: number;
  /** Boden-Position (Welt) und Höhe darüber */
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rot: number;
  vrot: number;
  life: number;
  maxLife: number;
  bounced: boolean;
}

const GRAVITY = 230;
const LIFE = 1.7;

/** Alle Teile des Rigs mit `detach: 'phase2'` ablösen. `(ox, oy)` = Rig-Ursprung im Zeichen-Kontext, `(wx, wy)` = Weltposition des Kontext-Ursprungs. Gibt die Anzahl zurück. */
export function spawnPhase2Parts(list: DetachedPart[], def: RigDef, images: RigImages, pose: Pose, ox: number, oy: number, wx: number, wy: number): number {
  const pl = layoutRig(def, images, pose);
  const root = pl.find((p) => !p.def.parent);
  const rootX = root ? wx + ox + root.world[4] : wx + ox;
  let n = 0;
  for (const p of pl) {
    if (p.def.detach !== 'phase2' || !p.img) continue;
    const gx = wx + ox + p.world[4];
    const gy = wy + oy + p.world[5];
    const side = Math.abs(gx - rootX) < 1 ? (n % 2 === 0 ? -1 : 1) : Math.sign(gx - rootX);
    list.push({
      img: p.img,
      w: p.w,
      h: p.h,
      px: p.px,
      py: p.py,
      x: gx,
      y: wy + oy, // landet auf Fußhöhe
      z: Math.max(0, wy + oy - gy),
      vx: side * (48 + 10 * (n % 3)),
      vy: 6 * side,
      vz: 95 + 12 * (n % 2),
      rot: Math.atan2(p.world[1], p.world[0]),
      vrot: side * (3.2 + 0.6 * (n % 2)),
      life: LIFE,
      maxLife: LIFE,
      bounced: false,
    });
    n++;
  }
  return n;
}

export function updateDetached(list: DetachedPart[], dt: number): void {
  for (let i = list.length - 1; i >= 0; i--) {
    const d = list[i];
    d.life -= dt;
    if (d.life <= 0) {
      list.splice(i, 1);
      continue;
    }
    d.vz -= GRAVITY * dt;
    d.z += d.vz * dt;
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    d.rot += d.vrot * dt;
    if (d.z <= 0) {
      d.z = 0;
      if (!d.bounced && d.vz < -20) {
        d.bounced = true;
        d.vz = -d.vz * 0.32;
        d.vx *= 0.5;
        d.vrot *= 0.4;
      } else {
        d.vz = 0;
        d.vx *= 0.82;
        d.vy *= 0.82;
        d.vrot *= 0.8;
      }
    }
  }
}

export function drawDetached(ctx: CanvasRenderingContext2D, d: DetachedPart): void {
  const fade = Math.min(1, d.life / 0.5);
  ctx.save();
  ctx.globalAlpha = 0.35 * fade;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  const s = Math.max(0.4, 1 - d.z / 60);
  ctx.ellipse(d.x, d.y + 1, (d.w * 0.32) * s, (d.h * 0.12) * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = fade;
  ctx.translate(d.x, d.y - d.z);
  ctx.rotate(d.rot);
  ctx.drawImage(d.img, -d.px, -d.py, d.w, d.h);
  ctx.restore();
}

/** Teil-Pose für Teile, die in Phase 2 abgefallen sind: unsichtbar. */
export const GONE: PartPose = { hidden: true };
