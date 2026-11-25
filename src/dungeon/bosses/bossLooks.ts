// M10-C (G3): Boss-Optik. Optionales Sprite (BOSS_OPTIONAL_SPRITES) hat Vorrang; fehlt es, wird das
// bisherige Sprite eingefärbt und bekommt prozedurale Erkennungsmerkmale — nie nur ein Recolor.
import type { HDArtAssets } from '../../assets/artLoader';
import { drawGlow } from '../../assets/pixelArt';
import type { Enemy } from '../dungeonTypes';

type Look = {
  key?: 'bossScrapCollector' | 'bossSlagColossus' | 'bossForgeMistress' | 'bossChronoWarden' | 'bossMonolithColossus';
  tint?: string;
  alpha?: number;
};

const LOOKS: Partial<Record<Enemy['kind'], Look>> = {
  boss_breacher: { key: 'bossScrapCollector', tint: '#64748b', alpha: 0.5 },
  boss_slag_overlord: { key: 'bossSlagColossus', tint: '#7c2d12', alpha: 0.5 },
  boss_forge_warden: { key: 'bossForgeMistress', tint: '#92400e', alpha: 0.42 },
  boss_chrono_sentinel: { key: 'bossChronoWarden', tint: '#0e7490', alpha: 0.38 },
  boss_monolith_colossus: { key: 'bossMonolithColossus', tint: '#57534e', alpha: 0.4 },
  boss_vulkan_titan: {},
  boss_star_archon: {},
};

const tintCache = new WeakMap<HTMLCanvasElement, Map<string, HTMLCanvasElement>>();

function tinted(src: HTMLCanvasElement, color: string, alpha: number): HTMLCanvasElement {
  let m = tintCache.get(src);
  if (!m) {
    m = new Map();
    tintCache.set(src, m);
  }
  const k = `${color}:${alpha}`;
  const hit = m.get(k);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const g = c.getContext('2d')!;
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  g.globalAlpha = alpha;
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  m.set(k, c);
  return c;
}

export function hasBossLook(kind: Enemy['kind']): boolean {
  return LOOKS[kind] !== undefined;
}

/** Zeichnet den Boss-Körper (x,y = linke obere Ecke der Sprite-Fläche, w×h) samt Merkmalen. */
export function drawBossLook(
  ctx: CanvasRenderingContext2D,
  art: HDArtAssets,
  e: Enemy,
  time: number,
  base: HTMLCanvasElement | null,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const look = LOOKS[e.kind];
  const flash = e.flashTimer > 0;
  const own = look?.key ? (flash ? art[`${look.key}Flash`] : art[look.key]) : null;
  if (own) {
    ctx.drawImage(own, x, y, w, h);
    return;
  }
  if (base) {
    const spr = !flash && look?.tint ? tinted(base, look.tint, look.alpha ?? 0.4) : base;
    ctx.drawImage(spr, x, y, w, h);
  }
  if (!look || flash) return;
  drawExtras(ctx, e, time, x + w / 2, y + h / 2, w, h);
}

function drawExtras(ctx: CanvasRenderingContext2D, e: Enemy, time: number, cx: number, cy: number, w: number, h: number): void {
  ctx.save();
  switch (e.kind) {
    case 'boss_breacher': {
      // Spinnenbeine + Magnet: „Schrott-Sammler“
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 2;
      for (let k = 0; k < 4; k++) {
        const side = k < 2 ? -1 : 1;
        const row = k % 2;
        const bx = cx + side * 16;
        const by = cy + 6 + row * 7;
        const step = Math.sin(time * 6 + k) * 2;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + side * 12, by - 6 + step);
        ctx.lineTo(bx + side * 20, by + 10);
        ctx.stroke();
      }
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(cx, cy - h * 0.46, 6, Math.PI, 0);
      ctx.stroke();
      ctx.strokeStyle = '#60a5fa';
      ctx.beginPath();
      ctx.arc(cx, cy - h * 0.46, 6, 0.25, Math.PI * 0.75);
      ctx.stroke();
      break;
    }
    case 'boss_slag_overlord': {
      ctx.strokeStyle = '#f97316';
      ctx.lineWidth = 1.2;
      ctx.globalAlpha = 0.7 + 0.3 * Math.sin(time * 5);
      for (let k = -2; k <= 2; k++) {
        ctx.beginPath();
        ctx.moveTo(cx + k * 9, cy - 14);
        ctx.lineTo(cx + k * 9 + 3, cy - 2);
        ctx.lineTo(cx + k * 9 - 2, cy + 12);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#fb923c';
      for (let k = 0; k < 5; k++) {
        const ph = (time * 0.9 + k * 0.37) % 1;
        ctx.fillRect(cx - 22 + k * 11, cy + h * 0.28 + ph * 16, 2, 3);
      }
      drawGlow(ctx, cx, cy, 30, '#f97316', 0.2);
      break;
    }
    case 'boss_forge_warden': {
      // Riesiger Schmiedehammer an der Seite
      const swing = Math.sin(time * 2.4) * 0.18;
      ctx.translate(cx + w * 0.42, cy + 2);
      ctx.rotate(-0.5 + swing);
      ctx.fillStyle = '#78350f';
      ctx.fillRect(-1.5, -22, 3, 30);
      ctx.fillStyle = '#334155';
      ctx.fillRect(-7, -28, 14, 9);
      ctx.fillStyle = '#fb923c';
      ctx.fillRect(-7, -22, 14, 2);
      break;
    }
    case 'boss_chrono_sentinel': {
      // Uhr-Ring mit tickenden Zeigern
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(cx, cy, w * 0.44, 0, Math.PI * 2);
      ctx.stroke();
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        const r0 = w * 0.44;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
        ctx.lineTo(cx + Math.cos(a) * (r0 - 3), cy + Math.sin(a) * (r0 - 3));
        ctx.stroke();
      }
      const t = Math.floor(time * 2) / 2;
      ctx.strokeStyle = '#38e8d4';
      for (const [len, sp] of [[w * 0.3, 1.2], [w * 0.2, 0.2]] as const) {
        const a = t * sp * 2 - Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len);
        ctx.stroke();
      }
      break;
    }
    case 'boss_monolith_colossus': {
      // schwebende Steinplatten um den Koloss
      ctx.fillStyle = '#44403c';
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 1;
      for (let k = 0; k < 4; k++) {
        const a = time * 0.9 + (k * Math.PI) / 2;
        const px = cx + Math.cos(a) * (w * 0.55);
        const py = cy + Math.sin(a) * (h * 0.4) - 2;
        ctx.fillRect(px - 3, py - 6, 6, 12);
        ctx.strokeRect(px - 3, py - 6, 6, 12);
      }
      break;
    }
    case 'boss_vulkan_titan': {
      // Lavakrone
      for (let k = -2; k <= 2; k++) {
        const fl = 5 + Math.sin(time * 7 + k) * 2;
        ctx.fillStyle = k % 2 === 0 ? '#f97316' : '#fde047';
        ctx.beginPath();
        ctx.moveTo(cx + k * 7 - 3, cy - h * 0.42);
        ctx.lineTo(cx + k * 7, cy - h * 0.42 - 8 - fl);
        ctx.lineTo(cx + k * 7 + 3, cy - h * 0.42);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }
    case 'boss_star_archon': {
      // Sternbild-Ring
      const pts: Array<[number, number]> = [];
      for (let k = 0; k < 5; k++) {
        const a = time * 0.6 + (k * Math.PI * 2) / 5;
        pts.push([cx + Math.cos(a) * w * 0.5, cy + Math.sin(a) * h * 0.5]);
      }
      ctx.strokeStyle = 'rgba(165, 180, 252, 0.7)';
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      for (let k = 0; k < 5; k++) {
        const [px, py] = pts[(k * 2) % 5];
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = '#fde047';
      for (const [px, py] of pts) ctx.fillRect(px - 1.5, py - 1.5, 3, 3);
      break;
    }
    default:
      break;
  }
  ctx.restore();
}
