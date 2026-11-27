// M12 Phase B: Kamera für Räume, die größer als ein Bildschirm sind (Arena-Endbosse).
// Standardraum (keine `room.bounds`): Kamera steht immer exakt auf (0, 0) → Darstellung & Eingabe unverändert.
// Arena: folgt dem Spieler mit Totzone (40×24) und Glättung (τ ≈ 0,12 s), klemmt an den Raumgrenzen
// (dieselben Wand-Ränder wie im Standardraum sichtbar). `focus()` = kurze Kamerafahrt mit Eingabesperre.
// Reine Logik, kein Zufall, Zeit nur über dt.
import { VIRTUAL_HEIGHT, VIRTUAL_WIDTH } from '../engine/input';
import { ROOM_BOTTOM, ROOM_LEFT, ROOM_RIGHT, ROOM_TOP, type RoomBoundsDef } from '../world/dungeonGen';

export const CAMERA_DEADZONE_W = 40;
export const CAMERA_DEADZONE_H = 24;
export const CAMERA_TAU = 0.12;
/** Längste erlaubte Kamerafahrt (Eingabe gesperrt) */
export const CAMERA_FOCUS_MAX_SEC = 2.5;

export interface CameraTarget {
  playerX: number;
  playerY: number;
  /** eigene Raumgrenzen (Arena); fehlt = Standardraum */
  roomBounds: RoomBoundsDef | undefined;
}

export class DungeonCamera {
  public x = 0;
  public y = 0;
  private focusX = 0;
  private focusY = 0;
  private focusLeft = 0;

  /** Kamera-Bereich [min, max] je Achse: Arena-Rand liegt dort, wo im Standardraum die Wand liegt. */
  public static range(b: RoomBoundsDef): { minX: number; maxX: number; minY: number; maxY: number } {
    let minX = b.l - ROOM_LEFT;
    let maxX = b.r - ROOM_RIGHT;
    let minY = b.t - ROOM_TOP;
    let maxY = b.b - ROOM_BOTTOM;
    // Raum schmaler/niedriger als ein Bildschirm: mittig
    if (maxX < minX) minX = maxX = (minX + maxX) / 2;
    if (maxY < minY) minY = maxY = (minY + maxY) / 2;
    return { minX, maxX, minY, maxY };
  }

  /** true, solange eine Kamerafahrt läuft (Spieler-Eingabe gesperrt). */
  public get inputLocked(): boolean {
    return this.focusLeft > 0;
  }

  /** Kamerafahrt zu einem Weltpunkt (max. 2,5 s; nur in Arenen wirksam). */
  public focus(x: number, y: number, sec: number): void {
    this.focusX = x;
    this.focusY = y;
    this.focusLeft = Math.max(0, Math.min(CAMERA_FOCUS_MAX_SEC, sec));
  }

  public cancelFocus(): void {
    this.focusLeft = 0;
  }

  /** Sofort auf den Spieler setzen (Raumwechsel). */
  public snap(t: CameraTarget): void {
    this.focusLeft = 0;
    if (!t.roomBounds) {
      this.x = 0;
      this.y = 0;
      return;
    }
    const c = this.clamp(t.roomBounds, t.playerX - VIRTUAL_WIDTH / 2, t.playerY - VIRTUAL_HEIGHT / 2);
    this.x = c.x;
    this.y = c.y;
  }

  public update(dt: number, t: CameraTarget): void {
    if (!t.roomBounds) {
      this.x = 0;
      this.y = 0;
      this.focusLeft = 0;
      return;
    }
    let tx: number;
    let ty: number;
    if (this.focusLeft > 0) {
      this.focusLeft = Math.max(0, this.focusLeft - dt);
      tx = this.focusX - VIRTUAL_WIDTH / 2;
      ty = this.focusY - VIRTUAL_HEIGHT / 2;
    } else {
      // Totzone um die Bildschirmmitte
      const sx = t.playerX - (this.x + VIRTUAL_WIDTH / 2);
      const sy = t.playerY - (this.y + VIRTUAL_HEIGHT / 2);
      const hw = CAMERA_DEADZONE_W / 2;
      const hh = CAMERA_DEADZONE_H / 2;
      tx = this.x + (sx > hw ? sx - hw : sx < -hw ? sx + hw : 0);
      ty = this.y + (sy > hh ? sy - hh : sy < -hh ? sy + hh : 0);
    }
    const target = this.clamp(t.roomBounds, tx, ty);
    const k = dt > 0 ? 1 - Math.exp(-dt / CAMERA_TAU) : 0;
    this.x += (target.x - this.x) * k;
    this.y += (target.y - this.y) * k;
    const c = this.clamp(t.roomBounds, this.x, this.y);
    this.x = c.x;
    this.y = c.y;
  }

  private clamp(b: RoomBoundsDef, x: number, y: number): { x: number; y: number } {
    const r = DungeonCamera.range(b);
    return { x: Math.max(r.minX, Math.min(r.maxX, x)), y: Math.max(r.minY, Math.min(r.maxY, y)) };
  }

  /** Auf ganze Bildpunkte des HD-Puffers gerastert (RENDER_SCALE 2 → halbe logische Pixel), damit Pixel-Art scharf bleibt. */
  public renderX(): number {
    return Math.round(this.x * 2) / 2;
  }

  public renderY(): number {
    return Math.round(this.y * 2) / 2;
  }

  /** Bildschirm → Welt (Maus/Touch-Zielen). */
  public toWorld(sx: number, sy: number): { x: number; y: number } {
    return { x: sx + this.renderX(), y: sy + this.renderY() };
  }

  /** Welt → Bildschirm (Prompts, Rand-Pfeile). */
  public toScreen(wx: number, wy: number): { x: number; y: number } {
    return { x: wx - this.renderX(), y: wy - this.renderY() };
  }
}
