// M12 Phase B (A7): Gefahr außerhalb des Bildschirms → Pfeil am Bildschirmrand in Zonenfarbe.
// Nur in Räumen mit Kamera relevant; im Standardraum liegt jede Zone im Bild (keine Pfeile).
import type { BossZone } from './bosses/bossFx';

export interface EdgeMarker {
  x: number;
  y: number;
  angle: number;
  color: string;
  /** true = Zone schon aktiv (nicht mehr nur Vorwarnung) */
  active: boolean;
}

const MARGIN = 10;

/** Ausdehnung einer Zone (Weltkoordinaten) als Rechteck. */
function zoneBox(z: BossZone): { l: number; r: number; t: number; b: number } {
  if (z.shape === 'rect') {
    const hw = (z.w ?? 0) / 2;
    const hh = (z.h ?? 0) / 2;
    return { l: z.x - hw, r: z.x + hw, t: z.y - hh, b: z.y + hh };
  }
  if (z.shape === 'line') {
    const hw = (z.width ?? 0) / 2;
    const x2 = z.x2 ?? z.x;
    const y2 = z.y2 ?? z.y;
    return { l: Math.min(z.x, x2) - hw, r: Math.max(z.x, x2) + hw, t: Math.min(z.y, y2) - hw, b: Math.max(z.y, y2) + hw };
  }
  const r = z.r ?? 0;
  return { l: z.x - r, r: z.x + r, t: z.y - r, b: z.y + r };
}

/** Rand-Pfeile für Zonen, die komplett außerhalb des sichtbaren Ausschnitts liegen (Bildschirmkoordinaten). */
export function offscreenMarkers(zones: readonly BossZone[], camX: number, camY: number, viewW: number, viewH: number): EdgeMarker[] {
  const out: EdgeMarker[] = [];
  const cx = viewW / 2;
  const cy = viewH / 2;
  for (const z of zones) {
    const bx = zoneBox(z);
    const visible = bx.r >= camX && bx.l <= camX + viewW && bx.b >= camY && bx.t <= camY + viewH;
    if (visible) continue;
    // Richtung von der Bildschirmmitte zum nächsten Punkt der Zone
    const px = Math.max(bx.l, Math.min(bx.r, camX + cx)) - camX;
    const py = Math.max(bx.t, Math.min(bx.b, camY + cy)) - camY;
    const dx = px - cx;
    const dy = py - cy;
    const k = Math.min((cx - MARGIN) / Math.max(1e-6, Math.abs(dx)), (cy - MARGIN) / Math.max(1e-6, Math.abs(dy)));
    out.push({ x: cx + dx * k, y: cy + dy * k, angle: Math.atan2(dy, dx), color: z.color, active: z.active === true });
  }
  return out;
}

export function drawEdgeMarkers(ctx: CanvasRenderingContext2D, markers: readonly EdgeMarker[], time: number): void {
  for (const m of markers) {
    const pulse = m.active ? 1 : 0.55 + 0.45 * Math.sin(time * 14);
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.rotate(m.angle);
    ctx.globalAlpha = 0.9 * pulse;
    ctx.fillStyle = '#0b1019';
    ctx.beginPath();
    ctx.moveTo(7, 0);
    ctx.lineTo(-5, -6);
    ctx.lineTo(-2, 0);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = m.color;
    ctx.beginPath();
    ctx.moveTo(5.5, 0);
    ctx.lineTo(-4, -4.6);
    ctx.lineTo(-1.6, 0);
    ctx.lineTo(-4, 4.6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
