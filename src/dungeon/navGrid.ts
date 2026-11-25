// Navigations-Raster pro Raum (M10-C, B1): BFS-Fluss-Feld vom Spieler aus.
// Reine Logik, kein Zufall, keine Abhängigkeit von Szene/Zeit (Zeit kommt als dt-Parameter).
import { ROOM_BOTTOM, ROOM_LEFT, ROOM_RIGHT, ROOM_TOP } from '../world/dungeonGen';

export type BlockedFn = (x: number, y: number, r: number) => boolean;

const CELL = 8;
const COLS = Math.ceil((ROOM_RIGHT - ROOM_LEFT) / CELL);
const ROWS = Math.ceil((ROOM_BOTTOM - ROOM_TOP) / CELL);
const NEIGHBORS: Array<[number, number]> = [
  [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1],
];

export class NavGrid {
  public static readonly CELL = CELL;
  private readonly free = new Uint8Array(COLS * ROWS);
  private readonly dist = new Int16Array(COLS * ROWS);
  private readonly queue = new Int32Array(COLS * ROWS);
  private targetCell = -1;
  private age = 0;

  constructor(blocked: BlockedFn, inflate: number) {
    for (let cy = 0; cy < ROWS; cy++) {
      for (let cx = 0; cx < COLS; cx++) {
        const x = ROOM_LEFT + cx * CELL + CELL / 2;
        const y = ROOM_TOP + cy * CELL + CELL / 2;
        this.free[cy * COLS + cx] = blocked(x, y, inflate) ? 0 : 1;
      }
    }
    this.dist.fill(-1);
  }

  private cellOf(x: number, y: number): number {
    const cx = Math.max(0, Math.min(COLS - 1, Math.floor((x - ROOM_LEFT) / CELL)));
    const cy = Math.max(0, Math.min(ROWS - 1, Math.floor((y - ROOM_TOP) / CELL)));
    return cy * COLS + cx;
  }

  public isFreeAt(x: number, y: number): boolean {
    return this.free[this.cellOf(x, y)] === 1;
  }

  /** Vom Spieler aus neu berechnen, wenn er die Zelle wechselt oder alle 0,3 s. */
  public tick(dt: number, px: number, py: number): void {
    this.age += dt;
    const cell = this.cellOf(px, py);
    if (cell !== this.targetCell || this.age >= 0.3) {
      this.age = 0;
      this.build(cell);
    }
  }

  private build(target: number): void {
    this.targetCell = target;
    this.dist.fill(-1);
    // Liegt das Ziel in einer blockierten Zelle: nächste freie Zelle (BFS durch alle Zellen) als Start
    let start = target;
    if (!this.free[start]) {
      const seen = new Uint8Array(COLS * ROWS);
      let qh = 0;
      let qt = 0;
      this.queue[qt++] = target;
      seen[target] = 1;
      start = -1;
      while (qh < qt) {
        const c = this.queue[qh++];
        if (this.free[c]) { start = c; break; }
        const cx = c % COLS;
        const cy = (c - cx) / COLS;
        for (const [ox, oy] of NEIGHBORS) {
          const nx = cx + ox;
          const ny = cy + oy;
          if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
          const n = ny * COLS + nx;
          if (!seen[n]) { seen[n] = 1; this.queue[qt++] = n; }
        }
      }
      if (start < 0) return;
    }
    let qh = 0;
    let qt = 0;
    this.queue[qt++] = start;
    this.dist[start] = 0;
    while (qh < qt) {
      const c = this.queue[qh++];
      const cx = c % COLS;
      const cy = (c - cx) / COLS;
      for (const [ox, oy] of NEIGHBORS) {
        const nx = cx + ox;
        const ny = cy + oy;
        if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
        const n = ny * COLS + nx;
        if (!this.free[n] || this.dist[n] >= 0) continue;
        // Keine Ecken-Abkürzung durch blockierte Zellen
        if (ox !== 0 && oy !== 0 && (!this.free[cy * COLS + nx] || !this.free[ny * COLS + cx])) continue;
        this.dist[n] = this.dist[c] + 1;
        this.queue[qt++] = n;
      }
    }
  }

  /** Normierte Richtung zur besten Nachbarzelle Richtung Ziel; null wenn unerreichbar oder schon am Ziel. */
  public flowDir(x: number, y: number): { x: number; y: number } | null {
    if (this.targetCell < 0) return null;
    const c = this.cellOf(x, y);
    const cx = c % COLS;
    const cy = (c - cx) / COLS;
    let best = -1;
    let bestD = this.dist[c] >= 0 ? this.dist[c] : 32767;
    for (const [ox, oy] of NEIGHBORS) {
      const nx = cx + ox;
      const ny = cy + oy;
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
      const n = ny * COLS + nx;
      const d = this.dist[n];
      if (d < 0 || d >= bestD) continue;
      if (ox !== 0 && oy !== 0 && (!this.free[cy * COLS + nx] || !this.free[ny * COLS + cx])) continue;
      bestD = d;
      best = n;
    }
    if (best < 0) return null;
    const bx = best % COLS;
    const by = (best - bx) / COLS;
    const tx = ROOM_LEFT + bx * CELL + CELL / 2;
    const ty = ROOM_TOP + by * CELL + CELL / 2;
    const len = Math.hypot(tx - x, ty - y);
    if (len < 0.001) return null;
    return { x: (tx - x) / len, y: (ty - y) / len };
  }
}
