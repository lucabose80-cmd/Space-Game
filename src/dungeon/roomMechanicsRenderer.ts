/**
 * Meilenstein 10-A — Rendering der Sektor-Raum-Mechaniken.
 *  - renderMechanicsGround(): Boden-Layer (Düsen-Schienen, Magnetplatten, Teleporter-Pads) — direkt nach den Vents.
 *  - getMechanicsDrawables(): y-sortierte Objekte (solide Kristall-Prismen) für die Drawables-Liste.
 * Rein prozedural im bestehenden Pixel-Look (dunkle Outline, Glow, Schatten); keine neuen Sprites nötig.
 */
import { drawGlow, drawPixelShadow } from '../assets/pixelArt';
import type { DungeonScene } from '../scenes/DungeonScene';

export interface MechanicsDrawable {
  y: number;
  draw: () => void;
}

const OUTLINE = '#1a0b2e';

function drawPrism(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, time: number, flash: number): void {
  const pulse = 0.5 + 0.5 * Math.sin(time * 2.4 + x * 0.1);
  drawPixelShadow(ctx, x, y + r + 2, r + 2, 3, 0.45);
  const h = r * 2.6;
  // hintere Spitze (zweite, kleinere Raute) für den „Säulen“-Eindruck
  ctx.fillStyle = '#5b21b6';
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - r * 0.55, y - h * 0.15);
  ctx.lineTo(x - r * 0.2, y - h * 0.95);
  ctx.lineTo(x + r * 0.15, y - h * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Hauptkristall
  ctx.beginPath();
  ctx.moveTo(x, y - h);
  ctx.lineTo(x + r * 1.05, y - h * 0.35);
  ctx.lineTo(x + r * 0.7, y + r * 0.55);
  ctx.lineTo(x - r * 0.7, y + r * 0.55);
  ctx.lineTo(x - r * 1.05, y - h * 0.35);
  ctx.closePath();
  ctx.fillStyle = '#7c3aed';
  ctx.fill();
  ctx.stroke();
  // Facetten
  ctx.fillStyle = '#a78bfa';
  ctx.beginPath();
  ctx.moveTo(x, y - h);
  ctx.lineTo(x + r * 1.05, y - h * 0.35);
  ctx.lineTo(x, y - h * 0.25);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#4c1d95';
  ctx.beginPath();
  ctx.moveTo(x, y - h * 0.25);
  ctx.lineTo(x + r * 1.05, y - h * 0.35);
  ctx.lineTo(x + r * 0.7, y + r * 0.55);
  ctx.lineTo(x, y + r * 0.55);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#f0abfc';
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(x, y - h);
  ctx.lineTo(x - r * 1.05, y - h * 0.35);
  ctx.stroke();
  // Glanzpunkt
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(Math.round(x - r * 0.35), Math.round(y - h * 0.62), 1.6, 1.6);
  drawGlow(ctx, x, y - h * 0.45, r * 3.4, '#c084fc', 0.22 + pulse * 0.1 + flash * 0.5);
  if (flash > 0) {
    ctx.save();
    ctx.strokeStyle = `rgba(240, 171, 252, ${Math.min(0.9, flash * 3)})`;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.arc(x, y - h * 0.35, r * 1.6 + (1 - flash / 0.28) * 7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

/** Y-sortierte Objekte der Mechaniken (solide Prismen). */
export function getMechanicsDrawables(ctx: CanvasRenderingContext2D, scene: DungeonScene): MechanicsDrawable[] {
  const out: MechanicsDrawable[] = [];
  for (const pr of scene.currentRoom?.prisms ?? []) {
    out.push({
      y: pr.y + pr.r,
      draw: () => drawPrism(ctx, pr.x, pr.y, pr.r, scene.time, scene.mechanics.prismFlash.get(pr.id) ?? 0),
    });
  }
  return out;
}

/** Boden-Layer: wird direkt nach dem Vent-Block gezeichnet (kommt mit 5b/5c). */
export function renderMechanicsGround(_ctx: CanvasRenderingContext2D, _scene: DungeonScene): void {
  // Düsen, Magnetplatten und Teleporter-Pads werden in den folgenden Commits ergänzt.
}
