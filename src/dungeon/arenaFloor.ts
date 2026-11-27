// M12 Phase B: prozeduraler Boden für Räume mit eigenen Grenzen (Arena), solange kein Arena-Sprite existiert
// (Phase C bringt `arena_*_bg.png` → SPRITE_QUEUE P1-03). Einmal pro Raum in ein Offscreen-Canvas
// (2× Auflösung wie der HD-Puffer) vorgezeichnet, danach nur noch ein drawImage pro Frame. Kein globaler Zufall.
import { mulberry32 } from '../systems/seededRng';
import type { DungeonRoom } from '../world/dungeonGen';

/** Wandbreite außerhalb der Grenzen (logisch) — entspricht etwa den Rändern im Standard-Hintergrund. */
export const ARENA_WALL = 46;
const TILE = 16;
const SCALE = 2;

const PALETTES: Record<number, { base: string; tileA: string; tileB: string; seam: string; wall: string; wallHi: string; edge: string }> = {
  1: { base: '#0b1019', tileA: '#1a2232', tileB: '#1d2638', seam: '#121926', wall: '#262f40', wallHi: '#3a465c', edge: '#38e8d4' },
  2: { base: '#0f0a1d', tileA: '#1f1736', tileB: '#231a3d', seam: '#160f29', wall: '#2c2148', wallHi: '#45346b', edge: '#e879f9' },
  3: { base: '#170a06', tileA: '#2a1610', tileB: '#2f1912', seam: '#1d0e09', wall: '#3a1f15', wallHi: '#5a3222', edge: '#fb923c' },
  4: { base: '#081019', tileA: '#14202e', tileB: '#172534', seam: '#0d1621', wall: '#1d2c3d', wallHi: '#2f4560', edge: '#a5b4fc' },
};

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
  const b = room.bounds;
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
  // Boden-Platten
  c.fillStyle = pal.seam;
  c.fillRect(b.l, b.t, b.r - b.l, b.b - b.t);
  for (let ty = b.t; ty < b.b; ty += TILE) {
    for (let tx = b.l; tx < b.r; tx += TILE) {
      const v = rnd();
      c.fillStyle = v < 0.5 ? pal.tileA : pal.tileB;
      c.fillRect(tx + 0.5, ty + 0.5, Math.min(TILE, b.r - tx) - 1, Math.min(TILE, b.b - ty) - 1);
      if (v > 0.93) {
        c.fillStyle = pal.seam;
        c.fillRect(tx + 4, ty + 7, 8, 1); // Kratzer
      }
    }
  }
  // Leuchtende Kante an den Raumgrenzen
  c.strokeStyle = pal.edge;
  c.globalAlpha = 0.35;
  c.lineWidth = 1;
  c.strokeRect(b.l - 1.5, b.t - 1.5, b.r - b.l + 3, b.b - b.t + 3);
  c.globalAlpha = 1;
  return { key: `${room.key}|${b.l},${b.r},${b.t},${b.b}|${sector}`, canvas, x, y, w, h };
}

/** Zeichnet den Arena-Boden in Weltkoordinaten (Kamera-Translation liegt schon auf ctx). */
export function renderArenaFloor(ctx: CanvasRenderingContext2D, room: DungeonRoom, sector: number, viewX: number, viewY: number, viewW: number, viewH: number): void {
  const b = room.bounds;
  if (!b) return;
  const key = `${room.key}|${b.l},${b.r},${b.t},${b.b}|${sector}`;
  if (!cache || cache.key !== key) cache = build(room, sector);
  const pal = PALETTES[Math.max(1, Math.min(4, sector))] ?? PALETTES[1];
  ctx.fillStyle = pal.base;
  ctx.fillRect(viewX, viewY, viewW, viewH);
  if (cache) ctx.drawImage(cache.canvas, cache.x, cache.y, cache.w, cache.h);
}
