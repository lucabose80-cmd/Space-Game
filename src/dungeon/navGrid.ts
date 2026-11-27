// Navigations-Raster pro Raum (M10-C, B1): BFS-Fluss-Feld vom Spieler aus.
// Reine Logik, kein Zufall, keine Abhängigkeit von Szene/Zeit (Zeit kommt als dt-Parameter).
import { DEFAULT_ROOM_BOUNDS, type RoomBoundsDef } from '../world/dungeonGen';

export type BlockedFn = (x: number, y: number, r: number) => boolean;

const CELL = 8;
const NEIGHBORS: Array<[number, number]> = [
  [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1],
];

export class NavGrid {
  public static readonly CELL = CELL;
  // M12 (Phase A): Rastergröße je Raum aus seinen Grenzen (Standard = this.left…ROOM_BOTTOM, wie bisher)
  public readonly cols: number;
  public readonly rows: number;
  private readonly left: number;
  private readonly top: number;
  private readonly free: Uint8Array;
  private readonly dist: Int16Array;
  private readonly queue: Int32Array;
  private targetCell = -1;
  private age = 0;

  constructor(blocked: BlockedFn, inflate: number, bounds: RoomBoundsDef = DEFAULT_ROOM_BOUNDS) {
    this.left = bounds.l;
    this.top = bounds.t;
    this.cols = Math.ceil((bounds.r - bounds.l) / CELL);
    this.rows = Math.ceil((bounds.b - bounds.t) / CELL);
    const COLS = this.cols;
    const ROWS = this.rows;
    this.free = new Uint8Array(COLS * ROWS);
    this.dist = new Int16Array(COLS * ROWS);
    this.queue = new Int32Array(COLS * ROWS);
    for (let cy = 0; cy < ROWS; cy++) {
      for (let cx = 0; cx < COLS; cx++) {
        const x = this.left + cx * CELL + CELL / 2;
        const y = this.top + cy * CELL + CELL / 2;
        this.free[cy * COLS + cx] = blocked(x, y, inflate) ? 0 : 1;
      }
    }
    this.dist.fill(-1);
  }

  private cellOf(x: number, y: number): number {
    const COLS = this.cols;
    const ROWS = this.rows;
    const cx = Math.max(0, Math.min(COLS - 1, Math.floor((x - this.left) / CELL)));
    const cy = Math.max(0, Math.min(ROWS - 1, Math.floor((y - this.top) / CELL)));
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
    const COLS = this.cols;
    const ROWS = this.rows;
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
    const COLS = this.cols;
    const ROWS = this.rows;
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
    const tx = this.left + bx * CELL + CELL / 2;
    const ty = this.top + by * CELL + CELL / 2;
    const len = Math.hypot(tx - x, ty - y);
    if (len < 0.001) return null;
    return { x: (tx - x) / len, y: (ty - y) / len };
  }
}
