// M10-C (G3): gemeinsames Boss-Effektsystem — Telegraphie-Zonen mit Verzögerung, Strahlen und Platten.
// Eigene Klasse, damit DungeonScene schlank bleibt. Kein globaler Zufall.
import { ROOM_BOTTOM, ROOM_LEFT, ROOM_RIGHT, ROOM_TOP } from '../../world/dungeonGen';
import type { DungeonScene } from '../../scenes/DungeonScene';

export interface BossZone {
  shape: 'circle' | 'rect' | 'line' | 'ring';
  x: number;
  y: number;
  r?: number; // circle/ring: Außenradius
  r0?: number; // ring: Innenradius
  gapA?: number; // ring: Mitte der Lücke (rad)
  gapHalf?: number; // ring: halbe Lückenbreite (rad)
  w?: number; // rect (zentriert)
  h?: number;
  x2?: number; // line: Kapsel von (x,y) nach (x2,y2)
  y2?: number;
  width?: number;
  delay: number; // Vorwarnzeit (s)
  life: number; // aktive Zeit nach der Vorwarnung (s)
  burst?: number; // Einmal-Schaden bei Aktivierung
  dps?: number; // Schaden pro Sekunde, solange aktiv (Ticks 0,4 s)
  pull?: number; // px/s Richtung (x,y), solange aktiv & Spieler im Radius
  slow?: number; // Tempo-Faktor des Spielers im aktiven Feld
  color: string;
  onFire?: (scene: DungeonScene) => void;
  // Laufzeit
  active?: boolean;
  tick?: number;
  maxDelay?: number;
}

export interface BossBeam {
  x: number;
  y: number;
  angle: number;
  len: number;
  width: number;
  color: string;
  warn: boolean;
}

export interface BossPlate {
  x: number;
  y: number;
  r: number;
  color: string;
}

const PLAYER_R = 6;

function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / l2));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

/** Liegt der Spieler (Kreis) in der Zone? Exportiert für Tests. */
export function zoneContains(z: BossZone, px: number, py: number, pr = PLAYER_R): boolean {
  switch (z.shape) {
    case 'circle':
      return Math.hypot(px - z.x, py - z.y) <= (z.r ?? 0) + pr;
    case 'ring': {
      const d = Math.hypot(px - z.x, py - z.y);
      if (d > (z.r ?? 0) + pr || d < (z.r0 ?? 0) - pr) return false;
      if (z.gapA !== undefined && z.gapHalf !== undefined) {
        let diff = Math.atan2(py - z.y, px - z.x) - z.gapA;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        if (Math.abs(diff) <= z.gapHalf) return false;
      }
      return true;
    }
    case 'rect': {
      const w = (z.w ?? 0) / 2 + pr;
      const h = (z.h ?? 0) / 2 + pr;
      return Math.abs(px - z.x) <= w && Math.abs(py - z.y) <= h;
    }
    case 'line':
      return distToSegment(px, py, z.x, z.y, z.x2 ?? z.x, z.y2 ?? z.y) <= (z.width ?? 10) / 2 + pr;
  }
}

/** Strahl-Treffer (Kapsel) — Test & Boss-KI. */
export function beamHits(b: BossBeam, px: number, py: number, pr = PLAYER_R): boolean {
  return distToSegment(px, py, b.x, b.y, b.x + Math.cos(b.angle) * b.len, b.y + Math.sin(b.angle) * b.len) <= b.width / 2 + pr;
}

export class BossFx {
  public zones: BossZone[] = [];
  public beams: BossBeam[] = [];
  public plates: BossPlate[] = [];
  /** Tempo-Faktor des Spielers (kleinste aktive Verlangsamung, sonst 1) */
  public slowMult = 1;
  private beamTick = 0;

  public clear(): void {
    this.zones.length = 0;
    this.beams.length = 0;
    this.plates.length = 0;
    this.slowMult = 1;
  }

  public add(z: BossZone): void {
    z.maxDelay = z.delay;
    z.active = false;
    z.tick = 0;
    this.zones.push(z);
  }

  /** Vor der Boss-KI aufrufen: Strahlen/Platten des Vorframes verwerfen. */
  public beginFrame(): void {
    this.beams.length = 0;
    this.plates.length = 0;
  }

  private hurt(scene: DungeonScene, dmg: number, cx: number, cy: number): void {
    const dx = scene.playerX - cx;
    const dy = scene.playerY - cy;
    const l = Math.hypot(dx, dy) || 1;
    scene.damagePlayer(dmg, dx / l, dy / l);
  }

  public update(scene: DungeonScene, dt: number): void {
    this.slowMult = 1;
    const px = scene.playerX;
    const py = scene.playerY;
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const z = this.zones[i];
      if (!z.active) {
        z.delay -= dt;
        if (z.delay > 0) continue;
        z.active = true;
        z.tick = 0;
        scene.spawnBurst(z.x, z.y, z.color, 8);
        z.onFire?.(scene);
        if (z.burst && zoneContains(z, px, py)) this.hurt(scene, z.burst, z.x, z.y);
      }
      z.life -= dt;
      if (zoneContains(z, px, py)) {
        if (z.dps) {
          z.tick = (z.tick ?? 0) - dt;
          if ((z.tick ?? 0) <= 0) {
            z.tick = 0.4;
            this.hurt(scene, Math.max(1, Math.round(z.dps * 0.4)), z.x, z.y);
          }
        }
        if (z.slow) this.slowMult = Math.min(this.slowMult, z.slow);
        if (z.pull && z.shape === 'circle') {
          const dx = z.x - px;
          const dy = z.y - py;
          const l = Math.hypot(dx, dy) || 1;
          const nx = px + (dx / l) * z.pull * dt;
          const ny = py + (dy / l) * z.pull * dt;
          if (!scene.collidesRoomObstacle(nx, ny, PLAYER_R)) {
            scene.playerX = Math.max(ROOM_LEFT + 8, Math.min(ROOM_RIGHT - 8, nx));
            scene.playerY = Math.max(ROOM_TOP + 8, Math.min(ROOM_BOTTOM - 8, ny));
          }
        }
      }
      if (z.life <= 0) this.zones.splice(i, 1);
    }
    // Strahlen (laufender Schaden, Ticks 0,3 s)
    this.beamTick -= dt;
    for (const b of this.beams) {
      if (!b.warn && this.beamTick <= 0 && beamHits(b, px, py)) {
        this.beamTick = 0.3;
        this.hurt(scene, 14, b.x, b.y);
      }
    }
    for (const pl of this.plates) {
      if (this.beamTick <= 0 && Math.hypot(px - pl.x, py - pl.y) <= pl.r + PLAYER_R) {
        this.beamTick = 0.4;
        this.hurt(scene, 14, pl.x, pl.y);
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D, time: number): void {
    ctx.save();
    for (const z of this.zones) {
      const warn = !z.active;
      const prog = warn ? 1 - Math.max(0, z.delay) / Math.max(0.01, z.maxDelay ?? 1) : 1;
      const pulse = 0.5 + 0.5 * Math.sin(time * 14);
      ctx.fillStyle = z.color;
      ctx.strokeStyle = z.color;
      ctx.lineWidth = warn ? 1.2 : 1.6;
      ctx.globalAlpha = warn ? 0.1 + 0.2 * prog : 0.38 + 0.12 * pulse;
      this.path(ctx, z);
      ctx.fill();
      ctx.globalAlpha = warn ? 0.4 + 0.4 * pulse : 0.85;
      this.path(ctx, z);
      ctx.stroke();
      // Polish Teil 2: letzte 0,15 s vor dem Auslösen weiß aufblitzen → man sieht, WANN es knallt (nur Optik)
      if (warn && z.delay > 0 && z.delay <= 0.15) {
        const k = 1 - z.delay / 0.15;
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#ffffff';
        ctx.globalAlpha = 0.18 + 0.32 * k;
        this.path(ctx, z);
        ctx.fill();
        ctx.globalAlpha = 0.9;
        ctx.lineWidth = 1.8;
        this.path(ctx, z);
        ctx.stroke();
      }
    }
    for (const b of this.beams) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = b.warn ? 0.28 : 0.85;
      ctx.strokeStyle = b.color;
      ctx.lineWidth = b.warn ? 1.2 : b.width;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x + Math.cos(b.angle) * b.len, b.y + Math.sin(b.angle) * b.len);
      ctx.stroke();
      if (!b.warn) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = Math.max(1, b.width * 0.35);
        ctx.stroke();
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    for (const pl of this.plates) {
      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = pl.color;
      ctx.lineWidth = 1.2;
      ctx.fillRect(pl.x - pl.r * 0.8, pl.y - pl.r, pl.r * 1.6, pl.r * 2);
      ctx.strokeRect(pl.x - pl.r * 0.8, pl.y - pl.r, pl.r * 1.6, pl.r * 2);
    }
    ctx.restore();
  }

  private path(ctx: CanvasRenderingContext2D, z: BossZone): void {
    ctx.beginPath();
    switch (z.shape) {
      case 'circle':
        ctx.arc(z.x, z.y, z.r ?? 10, 0, Math.PI * 2);
        break;
      case 'ring': {
        const r = z.r ?? 40;
        const r0 = z.r0 ?? 0;
        const a0 = z.gapA !== undefined && z.gapHalf !== undefined ? z.gapA + z.gapHalf : 0;
        const a1 = z.gapA !== undefined && z.gapHalf !== undefined ? z.gapA - z.gapHalf + Math.PI * 2 : Math.PI * 2;
        ctx.arc(z.x, z.y, r, a0, a1);
        ctx.arc(z.x, z.y, r0, a1, a0, true);
        ctx.closePath();
        break;
      }
      case 'rect':
        ctx.rect(z.x - (z.w ?? 0) / 2, z.y - (z.h ?? 0) / 2, z.w ?? 0, z.h ?? 0);
        break;
      case 'line': {
        const x2 = z.x2 ?? z.x;
        const y2 = z.y2 ?? z.y;
        const a = Math.atan2(y2 - z.y, x2 - z.x);
        const hw = (z.width ?? 10) / 2;
        const nx = -Math.sin(a) * hw;
        const ny = Math.cos(a) * hw;
        ctx.moveTo(z.x + nx, z.y + ny);
        ctx.lineTo(x2 + nx, y2 + ny);
        ctx.lineTo(x2 - nx, y2 - ny);
        ctx.lineTo(z.x - nx, z.y - ny);
        ctx.closePath();
        break;
      }
    }
  }
}
