/**
 * Meilenstein 10-A — Rendering der Sektor-Raum-Mechaniken.
 *  - renderMechanicsGround(): Boden-Layer (Düsen-Schienen, Magnetplatten, Teleporter-Pads) — direkt nach den Vents.
 *  - getMechanicsDrawables(): y-sortierte Objekte (solide Kristall-Prismen) für die Drawables-Liste.
 * Rein prozedural im bestehenden Pixel-Look (dunkle Outline, Glow, Schatten); keine neuen Sprites nötig.
 */
import { drawGlow, drawPixelShadow } from '../assets/pixelArt';
import type { DungeonScene } from '../scenes/DungeonScene';
import { jetEnds, PAD_COLORS, PAD_RADIUS, PLATE_PERIOD, PLATE_REACH } from './roomMechanics';

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

function drawEmitter(ctx: CanvasRenderingContext2D, x: number, y: number, lit: boolean, hot: boolean): void {
  ctx.fillStyle = '#292524';
  ctx.strokeStyle = '#0c0a09';
  ctx.lineWidth = 1;
  ctx.fillRect(x - 4, y - 4, 8, 8);
  ctx.strokeRect(x - 3.5, y - 3.5, 7, 7);
  ctx.fillStyle = hot ? '#fde047' : lit ? '#fb923c' : '#57534e';
  ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
  if (lit) drawGlow(ctx, x, y, 12, '#fb923c', hot ? 0.55 : 0.3);
}

function renderJets(ctx: CanvasRenderingContext2D, scene: DungeonScene): void {
  const jets = scene.currentRoom.flameJets;
  if (!jets) return;
  for (const j of jets) {
    const e = jetEnds(j);
    const st = scene.mechanics.getJetState(j);
    // Schiene (immer sichtbar → Gefahr ist lesbar)
    ctx.save();
    ctx.lineCap = 'butt';
    ctx.strokeStyle = 'rgba(41, 37, 36, 0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(e.x1, e.y1);
    ctx.lineTo(e.x2, e.y2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(120, 53, 15, 0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();
    if (st === 'warn') {
      const pulse = 0.5 + 0.5 * Math.sin(scene.time * 26);
      ctx.strokeStyle = `rgba(251, 146, 60, ${0.35 + pulse * 0.5})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(e.x1, e.y1);
      ctx.lineTo(e.x2, e.y2);
      ctx.stroke();
    } else if (st === 'active') {
      const flick = 0.85 + 0.15 * Math.sin(scene.time * 40 + j.x);
      const line = (w: number, color: string): void => {
        ctx.strokeStyle = color;
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(e.x1, e.y1);
        ctx.lineTo(e.x2, e.y2);
        ctx.stroke();
      };
      line(10 * flick, 'rgba(249, 115, 22, 0.45)');
      line(6 * flick, '#fb923c');
      line(2.6, '#fde047');
      const n = Math.max(2, Math.floor(j.length / 30));
      for (let i = 0; i <= n; i++) drawGlow(ctx, e.x1 + ((e.x2 - e.x1) * i) / n, e.y1 + ((e.y2 - e.y1) * i) / n, 14, '#f97316', 0.3 * flick);
    }
    ctx.restore();
    drawEmitter(ctx, e.x1, e.y1, st !== 'safe', st === 'active');
    drawEmitter(ctx, e.x2, e.y2, st !== 'safe', st === 'active');
  }
}

function renderPlates(ctx: CanvasRenderingContext2D, scene: DungeonScene): void {
  const plates = scene.currentRoom.magnetPlates;
  if (!plates) return;
  for (const m of plates) {
    const active = scene.mechanics.isPlateActive(m);
    const pull = m.polarity === 'pull';
    const color = pull ? '#38bdf8' : '#fb7185';
    ctx.save();
    // Sockel
    ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = active ? color : '#475569';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.9)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.r * 0.58, 0, Math.PI * 2);
    ctx.stroke();
    // vier Pfeile (nach innen bei pull, nach außen bei push)
    ctx.fillStyle = active ? color : '#64748b';
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2 + Math.PI / 4;
      const rr = m.r * 0.78;
      const dir = pull ? -1 : 1;
      const tx = m.x + Math.cos(a) * rr;
      const ty = m.y + Math.sin(a) * rr;
      ctx.beginPath();
      ctx.moveTo(tx + Math.cos(a) * 4 * dir, ty + Math.sin(a) * 4 * dir);
      ctx.lineTo(tx + Math.cos(a + 2.4) * 3.4, ty + Math.sin(a + 2.4) * 3.4);
      ctx.lineTo(tx + Math.cos(a - 2.4) * 3.4, ty + Math.sin(a - 2.4) * 3.4);
      ctx.closePath();
      ctx.fill();
    }
    // Kern
    ctx.fillStyle = active ? color : '#334155';
    ctx.beginPath();
    ctx.arc(m.x, m.y, 3, 0, Math.PI * 2);
    ctx.fill();
    if (active) {
      // animierte Ringe: bei pull nach innen laufend, bei push nach außen
      for (let k = 0; k < 3; k++) {
        const t = (scene.time * 1.6 + k / 3) % 1;
        const rad = pull ? (m.r + PLATE_REACH) * (1 - t) + 4 : m.r * 0.4 + (m.r + PLATE_REACH - m.r * 0.4) * t;
        ctx.strokeStyle = pull ? `rgba(56, 189, 248, ${(1 - t) * 0.55})` : `rgba(251, 113, 133, ${(1 - t) * 0.55})`;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(m.x, m.y, rad, 0, Math.PI * 2);
        ctx.stroke();
      }
      drawGlow(ctx, m.x, m.y, m.r * 1.5, color, 0.22);
    } else {
      // Ruhephase: schwaches Glimmen; kurz vor der Aktivierung (letzte 0,6 s) pulsiert der Rand
      const c = (((scene.mechanicsClock + m.phase) % PLATE_PERIOD) + PLATE_PERIOD) % PLATE_PERIOD;
      const untilActive = PLATE_PERIOD - c;
      if (untilActive < 0.6) {
        const pulse = 0.5 + 0.5 * Math.sin(scene.time * 24);
        ctx.strokeStyle = `rgba(${pull ? '56,189,248' : '251,113,133'}, ${0.3 + pulse * 0.5})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r + 2, 0, Math.PI * 2);
        ctx.stroke();
      }
      drawGlow(ctx, m.x, m.y, m.r * 1.1, color, 0.06);
    }
    ctx.restore();
  }
}

function renderPads(ctx: CanvasRenderingContext2D, scene: DungeonScene): void {
  const pads = scene.currentRoom.teleporters;
  if (!pads) return;
  for (const pad of pads) {
    const locked = scene.mechanics.isPadLocked(pad);
    const charge = scene.mechanics.getPadCharge(pad);
    const color = locked ? '#64748b' : PAD_COLORS[pad.colorIdx];
    const rx = PAD_RADIUS + 2;
    const ry = (PAD_RADIUS + 2) * 0.62; // 3/4-Draufsicht → Ellipse
    ctx.save();
    // Sockel
    ctx.fillStyle = 'rgba(8, 13, 24, 0.82)';
    ctx.beginPath();
    ctx.ellipse(pad.x, pad.y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = locked ? 1 : 1.6;
    ctx.stroke();
    // rotierender Runen-Ring
    ctx.setLineDash([2.2, 2.2]);
    ctx.lineDashOffset = -scene.time * (locked ? 2 : 9);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(pad.x, pad.y, rx * 0.72, ry * 0.72, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    // Paar-Symbol (auch ohne Farbsehen unterscheidbar): ○ ◇ △
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    const cx = pad.x;
    const cy = pad.y;
    if (pad.colorIdx === 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (pad.colorIdx === 1) {
      ctx.beginPath();
      ctx.moveTo(cx, cy - 2.6);
      ctx.lineTo(cx + 2.6, cy);
      ctx.lineTo(cx, cy + 2.6);
      ctx.lineTo(cx - 2.6, cy);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(cx, cy - 2.6);
      ctx.lineTo(cx + 2.4, cy + 1.8);
      ctx.lineTo(cx - 2.4, cy + 1.8);
      ctx.closePath();
      ctx.fill();
    }
    // Ladering (0 → 0,25 s)
    if (charge > 0) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx + 2, ry + 2, 0, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * charge);
      ctx.stroke();
    }
    ctx.restore();
    if (!locked) drawGlow(ctx, cx, cy - 2, rx * 1.9, color, 0.2 + charge * 0.35);
  }
}

/** Boden-Layer: wird direkt nach dem Vent-Block gezeichnet (Düsen-Schienen, Magnetplatten, Teleporter-Pads). */
export function renderMechanicsGround(ctx: CanvasRenderingContext2D, scene: DungeonScene): void {
  renderPads(ctx, scene);
  renderPlates(ctx, scene);
  renderJets(ctx, scene);
}
