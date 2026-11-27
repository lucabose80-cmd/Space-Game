// M12 Phase B: prozeduraler Boden für Räume mit eigenen Grenzen (Arena), solange kein Arena-Sprite existiert
// (Phase C bringt `arena_*_bg.png` → SPRITE_QUEUE P1-03). Einmal pro Raum in ein Offscreen-Canvas
// (2× Auflösung wie der HD-Puffer) vorgezeichnet, danach nur noch ein drawImage pro Frame. Kein globaler Zufall.
import { getHDArt, type HDArtAssets } from '../assets/artLoader';
import { ARENAS, ARENA_TILE, arenaTileAt, type ArenaDef } from '../data/arenas';
import { mulberry32 } from '../systems/seededRng';
import { drawArenaVault } from './arenaVault';
import { drawLeviathanBodyStatic } from './bosses/leviathanArena';
import type { DungeonRoom } from '../world/dungeonGen';

/** Wandbreite außerhalb der Grenzen (logisch) — entspricht etwa den Rändern im Standard-Hintergrund. */
export const ARENA_WALL = 48;
const TILE = 16;
const SCALE = 2;

const PALETTES: Record<number, { base: string; tileA: string; tileB: string; seam: string; wall: string; wallHi: string; edge: string }> = {
  1: { base: '#0b1019', tileA: '#1a2232', tileB: '#1d2638', seam: '#121926', wall: '#262f40', wallHi: '#3a465c', edge: '#38e8d4' },
  2: { base: '#0f0a1d', tileA: '#1f1736', tileB: '#231a3d', seam: '#160f29', wall: '#2c2148', wallHi: '#45346b', edge: '#e879f9' },
  3: { base: '#170a06', tileA: '#2a1610', tileB: '#2f1912', seam: '#1d0e09', wall: '#3a1f15', wallHi: '#5a3222', edge: '#fb923c' },
  4: { base: '#081019', tileA: '#14202e', tileB: '#172534', seam: '#0d1621', wall: '#1d2c3d', wallHi: '#2f4560', edge: '#a5b4fc' },
};

/** Prozedurale Boss-Wand (bis P1-04 geliefert ist): Reaktorkopf über die ganze Nordseite, Linse mittig, Kabel. */
function drawWallFallback(
  c: CanvasRenderingContext2D,
  def: ArenaDef,
  b: { l: number; r: number; t: number; b: number },
  pal: { wall: string; wallHi: string; edge: string },
): void {
  const top = b.t + 48 - def.wallHeight;
  const h = def.wallHeight;
  const cx = (b.l + b.r) / 2;
  c.fillStyle = '#141b27';
  c.fillRect(b.l, top, b.r - b.l, h);
  // Panzerplatten
  for (let x = b.l; x < b.r; x += 32) {
    c.fillStyle = pal.wall;
    c.fillRect(x + 1, top + 6, 30, h - 14);
    c.fillStyle = pal.wallHi;
    c.fillRect(x + 1, top + 6, 30, 2);
    c.fillStyle = '#0b1019';
    c.fillRect(x + 4, top + h - 18, 24, 3);
  }
  // Kabelbündel
  c.strokeStyle = '#334155';
  c.lineWidth = 2;
  for (const off of [-150, -90, 90, 150]) {
    c.beginPath();
    c.moveTo(cx + off, top + 8);
    c.quadraticCurveTo(cx + off * 0.6, top + h * 0.6, cx + off * 0.3, top + h - 6);
    c.stroke();
  }
  // Kran-Schultern
  c.fillStyle = '#475569';
  c.fillRect(cx - 120, top + h - 30, 22, 26);
  c.fillRect(cx + 98, top + h - 30, 22, 26);
  // Kern-Linse
  c.fillStyle = '#1e293b';
  c.beginPath();
  c.arc(cx, top + h * 0.45, 24, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#fb923c';
  c.globalAlpha = 0.85;
  c.beginPath();
  c.arc(cx, top + h * 0.45, 13, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#fde68a';
  c.beginPath();
  c.arc(cx, top + h * 0.45, 5, 0, Math.PI * 2);
  c.fill();
  c.globalAlpha = 1;
  c.strokeStyle = pal.edge;
  c.globalAlpha = 0.4;
  c.strokeRect(b.l + 0.5, top + 0.5, b.r - b.l - 1, h - 1);
  c.globalAlpha = 1;
}

interface CacheEntry {
  key: string;
  canvas: HTMLCanvasElement;
  x: number;
  y: number;
  w: number;
  h: number;
}
let cache: CacheEntry | null = null;

function build(room: DungeonRoom, sector: number): CacheEntry | null {
  const b = arenaRect(room);
  if (!b || typeof document === 'undefined') return null;
  const pal = PALETTES[Math.max(1, Math.min(4, sector))] ?? PALETTES[1];
  const x = b.l - ARENA_WALL;
  const y = b.t - ARENA_WALL;
  const w = b.r - b.l + ARENA_WALL * 2;
  const h = b.b - b.t + ARENA_WALL * 2;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(w * SCALE);
  canvas.height = Math.ceil(h * SCALE);
  const c = canvas.getContext('2d');
  if (!c) return null;
  c.imageSmoothingEnabled = false;
  c.scale(SCALE, SCALE);
  c.translate(-x, -y);
  const rnd = mulberry32((room.tileSeed ^ 0x9e3779b9) >>> 0);
  // Wand
  c.fillStyle = pal.wall;
  c.fillRect(x, y, w, h);
  for (let wx = x; wx < x + w; wx += 24) {
    c.fillStyle = pal.wallHi;
    c.fillRect(wx, y + 4, 22, 3);
    c.fillRect(wx, b.b + 10, 22, 3);
  }
  // Boden-Platten (mit Kachelplan: `p` = Bodenplatte über dem Glut-Schacht, `W` = Boss-Sockel)
  const def = room.arenaKind ? ARENAS[room.arenaKind] : undefined;
  c.fillStyle = pal.seam;
  c.fillRect(b.l, b.t, b.r - b.l, b.b - b.t);
  for (let ty = b.t; ty < b.b; ty += TILE) {
    for (let tx = b.l; tx < b.r; tx += TILE) {
      const v = rnd();
      const ch = def ? arenaTileAt(def, Math.floor((tx - b.l) / ARENA_TILE), Math.floor((ty - b.t) / ARENA_TILE)) : '.';
      const tw = Math.min(TILE, b.r - tx) - 1;
      const th = Math.min(TILE, b.b - ty) - 1;
      if (ch === 'W') {
        c.fillStyle = pal.wall;
        c.fillRect(tx, ty, TILE, TILE);
        c.fillStyle = pal.wallHi;
        c.fillRect(tx + 1, ty + 1, TILE - 2, 2);
        continue;
      }
      if (ch === 'p') {
        // Platte mit Glut-Fugen (Hinweis: diese Fläche bricht später weg)
        c.fillStyle = '#3a1a10';
        c.fillRect(tx, ty, TILE, TILE);
        c.fillStyle = v < 0.5 ? pal.tileA : pal.tileB;
        c.fillRect(tx + 1, ty + 1, tw - 1, th - 1);
        c.fillStyle = 'rgba(251, 146, 60, 0.22)';
        c.fillRect(tx, ty + TILE - 1, TILE, 1);
        c.fillRect(tx + TILE - 1, ty, 1, TILE);
        continue;
      }
      c.fillStyle = v < 0.5 ? pal.tileA : pal.tileB;
      c.fillRect(tx + 0.5, ty + 0.5, tw, th);
      if (v > 0.93) {
        c.fillStyle = pal.seam;
        c.fillRect(tx + 4, ty + 7, 8, 1); // Kratzer
      }
    }
  }
  if (def) drawWallFallback(c, def, b, pal);
  // Leuchtende Kante an den Raumgrenzen
  c.strokeStyle = pal.edge;
  c.globalAlpha = 0.35;
  c.lineWidth = 1;
  c.strokeRect(b.l - 1.5, b.t - 1.5, b.r - b.l + 3, b.b - b.t + 3);
  c.globalAlpha = 1;
  return { key: `${room.key}|${b.l},${b.r},${b.t},${b.b}|${sector}`, canvas, x, y, w, h };
}

/** Spielfläche der Arena (oberer Rand = ursprünglicher Rand, auch wenn die Schatzkammer die Grenzen nach Norden erweitert hat). */
function arenaRect(room: DungeonRoom): { l: number; r: number; t: number; b: number } | undefined {
  const b = room.bounds;
  return b ? { l: b.l, r: b.r, t: room.arenaOriginT ?? b.t, b: b.b } : undefined;
}

let footTile: HTMLCanvasElement | null = null;
let footFrom: HTMLCanvasElement | null = null;

/**
 * Wandfuß: durchgehender Sockel (Ausschnitt aus dem Boss-Körper-Sprite, gekachelt) + Kontaktschatten auf dem Boden,
 * damit Wand und Boden sauber ineinander übergehen. Ohne Körper-Sprite: einfacher gezeichneter Sockel.
 */
function drawWallFoot(ctx: CanvasRenderingContext2D, art: HDArtAssets, l: number, r: number, footY: number): void {
  const body = art.arenaLeviathanBody;
  if (body && footFrom !== body && typeof document !== 'undefined') {
    // Sockel-Segment im Körper-Sprite (Bild-px 168…300 × 296…324)
    const c = document.createElement('canvas');
    c.width = 132;
    c.height = 28;
    c.getContext('2d')?.drawImage(body, 168, 296, 132, 28, 0, 0, 132, 28);
    footTile = c;
    footFrom = body;
  }
  // Kontaktschatten
  const sh = ctx.createLinearGradient(0, footY, 0, footY + 14);
  sh.addColorStop(0, 'rgba(0, 0, 0, 0.55)');
  sh.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = sh;
  ctx.fillRect(l, footY, r - l, 14);
  const h = 14;
  if (footTile) {
    for (let x = l; x < r; x += 66) ctx.drawImage(footTile, 0, 0, Math.min(132, (r - x) * 2), 28, x, footY - h + 2, Math.min(66, r - x), h);
  } else {
    ctx.fillStyle = '#3f3c3a';
    ctx.fillRect(l, footY - h + 2, r - l, h);
    ctx.fillStyle = '#6b6560';
    ctx.fillRect(l, footY - h + 2, r - l, 4);
  }
}

/** Zeichnet den Arena-Boden in Weltkoordinaten (Kamera-Translation liegt schon auf ctx). */
export function renderArenaFloor(ctx: CanvasRenderingContext2D, room: DungeonRoom, sector: number, viewX: number, viewY: number, viewW: number, viewH: number, time = 0): void {
  const b = arenaRect(room);
  if (!b) return;
  const key = `${room.key}|${b.l},${b.r},${b.t},${b.b}|${sector}`;
  if (!cache || cache.key !== key) cache = build(room, sector);
  const pal = PALETTES[Math.max(1, Math.min(4, sector))] ?? PALETTES[1];
  ctx.fillStyle = pal.base;
  ctx.fillRect(viewX, viewY, viewW, viewH);
  if (cache) ctx.drawImage(cache.canvas, cache.x, cache.y, cache.w, cache.h);
  // Optionale Arena-Sprites (P1-03 Boden = genau die Spielfläche, P1-04 Wand = oberer Rand + Sockel)
  const def = room.arenaKind ? ARENAS[room.arenaKind] : undefined;
  if (def) {
    const art = getHDArt();
    const bg = def.bgSprite ? art[def.bgSprite as keyof HDArtAssets] : null;
    if (bg instanceof HTMLCanvasElement) ctx.drawImage(bg, b.l, b.t, b.r - b.l, b.b - b.t);
    const wall = def.wallSprite ? art[def.wallSprite as keyof HDArtAssets] : null;
    if (wall instanceof HTMLCanvasElement) {
      // Dunkelheit über der Wand (Kamera darf in der Arena höher schauen)
      const top = b.t + 48 - def.wallHeight;
      const g = ctx.createLinearGradient(0, top - 70, 0, top + 6);
      g.addColorStop(0, '#05080d');
      g.addColorStop(1, 'rgba(5, 8, 13, 0)');
      ctx.fillStyle = '#05080d';
      ctx.fillRect(b.l - 60, viewY, b.r - b.l + 120, Math.max(0, top - 70 - viewY));
      ctx.drawImage(wall, b.l, top, b.r - b.l, def.wallHeight);
      ctx.fillStyle = g;
      ctx.fillRect(b.l - 60, top - 70, b.r - b.l + 120, 76);
      drawWallFoot(ctx, art, b.l, b.r, b.t + 48);
    }
    // nach dem Sieg (Boss-Gegner entfernt): erloschener Körper bleibt in der Wand
    if (room.cleared && room.arenaKind === 'boss_leviathan') drawLeviathanBodyStatic(ctx, room);
    drawArenaVault(ctx, room, time); // Schatzkammer-Tür/Gang/Kammer (nach dem Sieg)
  }
}
