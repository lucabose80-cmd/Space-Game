// M10-C (G3): gemeinsames Boss-Effektsystem — Telegraphie-Zonen mit Verzögerung, Strahlen und Platten.
// Eigene Klasse, damit DungeonScene schlank bleibt. Kein globaler Zufall.
import type { DungeonScene } from '../../scenes/DungeonScene';
import { getHDArt } from '../../assets/artLoader';

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
  /** M11-Optik (kein Einfluss auf Schaden): 'pull' Sog-Ringe + Schrott strömt nach innen · 'dash' Stoß-Streifen mit Pfeilen · 'blast' Druckwelle · 'drop' fallender Schrottklumpen mit Aufschlag */
  fx?: 'pull' | 'dash' | 'blast' | 'drop';
  /** fx 'drop': Schrottklumpen-Bild 0–2 (scrap_a/b/c) */
  variant?: number;
  // Laufzeit
  active?: boolean;
  tick?: number;
  maxDelay?: number;
  maxLife?: number;
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
    z.maxLife = z.life;
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

  /** D15: Biom des aktuellen Raums (1–5) für Boden-Effekte: Riss-Kammer → `riftSector`, Spirale → `floor.visualSector`, sonst `currentSector` */
  private biome = 1;
  public get groundBiome(): number {
    return this.biome;
  }

  public update(scene: DungeonScene, dt: number): void {
    const rs = scene.currentRoom?.riftSector;
    this.biome = rs ?? (scene.isEndlessRift ? scene.floor.visualSector : undefined) ?? scene.currentSector ?? 1;
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
            const rb = scene.bounds; // M12: Raumgrenzen
            scene.playerX = Math.max(rb.l + 8, Math.min(rb.r - 8, nx));
            scene.playerY = Math.max(rb.t + 8, Math.min(rb.b - 8, ny));
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
      if (z.fx) this.renderFx(ctx, z, time, warn, prog);
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

  /** M11: Sprite-/Partikel-Optik je Zone (rein darstellend, deterministisch aus `time`, kein Zufall). */
  private renderFx(ctx: CanvasRenderingContext2D, z: BossZone, time: number, warn: boolean, prog: number): void {
    const parts = getHDArt().rigs.krall?.parts;
    const spark = parts?.spark;
    const kAct = warn ? 0 : 1 - Math.max(0, z.life) / Math.max(0.01, z.maxLife ?? 1); // 0 → 1 über die aktive Zeit
    const hash = (n: number): number => {
      const s = Math.sin(n * 12.9898) * 43758.5453;
      return s - Math.floor(s);
    };
    /** D15: Boden-Effekt in der Variante des aktuellen Raum-Bioms (`gc_1…5` Krater, `gd_1…5` Druckring); fehlt sie → Heimat-Bild (`fx_*`) */
    const groundImg = (prefix: 'gc' | 'gd', fallback: HTMLCanvasElement | null | undefined): HTMLCanvasElement | null | undefined => parts?.[`${prefix}_${this.biome}`] ?? fallback;
    /** P0-08: Bild zentriert (Rotation optional), Größe = Breite in Spielpixeln */
    const sprite = (img: HTMLCanvasElement | HTMLImageElement | null | undefined, x: number, y: number, w: number, rot = 0, flatten = 1): void => {
      if (!img) return;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.scale(1, flatten);
      ctx.drawImage(img, -w / 2, -(w * img.height / img.width) / 2, w, w * img.height / img.width);
      ctx.restore();
    };
    const impact = (r: number, ring?: 'dust' | 'crater'): void => {
      if (ring === 'dust') { ctx.save(); ctx.globalAlpha = Math.max(0, 1 - kAct); sprite(groundImg('gd', parts?.fx_dust), z.x, z.y, r * (1.1 + 1.3 * kAct)); ctx.restore(); }
      if (ring === 'crater') {
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - kAct * kAct);
        sprite(groundImg('gc', parts?.fx_crater), z.x, z.y, r * 2.2);
        ctx.globalAlpha = Math.max(0, 0.8 - kAct);
        sprite(parts?.fx_rust, z.x, z.y - kAct * 8, r * (1.6 + kAct));
        ctx.restore();
      }
      // Aufschlag: Funkenstern wächst, Druckring weitet sich, beides blendet aus
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.max(0, 1 - kAct);
      if (spark) {
        const sz = r * (1.2 + 1.1 * kAct);
        ctx.drawImage(spark, z.x - sz / 2, z.y - sz / 2, sz, sz);
      }
      ctx.strokeStyle = '#fde68a';
      ctx.lineWidth = 1.6 * (1 - kAct) + 0.4;
      ctx.beginPath();
      ctx.arc(z.x, z.y, r * (0.5 + 0.9 * kAct), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    };
    ctx.save();
    if (z.fx === 'pull') {
      const R = z.r ?? 100;
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 3; i++) {
        const t = (time * 0.85 + i / 3) % 1; // Ringe wandern nach innen
        ctx.globalAlpha = (warn ? 0.18 + 0.3 * prog : 0.55) * Math.sin(t * Math.PI);
        ctx.strokeStyle = i % 2 ? '#60a5fa' : '#f87171'; // Magnet: blau/rot
        ctx.beginPath();
        ctx.arc(z.x, z.y, R * (1 - t * 0.9), 0, Math.PI * 2);
        ctx.stroke();
      }
      if (parts?.fx_field) {
        // P0-08: Magnet-Feldringe (rot/blau) pulsieren am Magneten, flach gedrückt (Boden-Perspektive)
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 2; i++) {
          const t = (time * 0.9 + i / 2) % 1;
          ctx.globalAlpha = (warn ? 0.25 + 0.3 * prog : 0.7) * Math.sin(t * Math.PI);
          sprite(parts.fx_field, z.x, z.y - 6, R * 1.9 * (1 - t * 0.75), 0, 0.85);
        }
        ctx.globalCompositeOperation = 'source-over';
      }
      const chunks = [parts?.scrap_a, parts?.scrap_b, parts?.scrap_c];
      for (let i = 0; i < 14; i++) {
        const t = (time * (0.6 + 0.35 * hash(i)) + hash(i + 40)) % 1;
        const ang = hash(i + 7) * Math.PI * 2 + t * 2.2; // Spirale zum Magneten
        const rad = R * (1 - t) + 4;
        const px = z.x + Math.cos(ang) * rad;
        const py = z.y - 14 + Math.sin(ang) * rad * 0.8;
        ctx.globalAlpha = (warn ? 0.4 * prog : 0.9) * Math.min(1, (1 - t) * 3) * Math.min(1, t * 6);
        const img = chunks[i % 3];
        if (img && i % 2 === 0) {
          const s = 6 + 3 * hash(i + 3);
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(time * 6 + i);
          ctx.drawImage(img, -s / 2, -s / 2, s, s * (img.height / img.width));
          ctx.restore();
        } else {
          ctx.fillStyle = i % 3 === 0 ? '#cbd5e1' : '#94a3b8';
          ctx.fillRect(px - 1, py - 1, 2, 2);
        }
      }
      if (!warn) {
        // Blitzbögen zwischen Magnet und Rand (alle 0,05 s neu gewürfelt, deterministisch) — plus Bogen-Sprite (P0-08)
        const step = Math.floor(time * 20);
        for (let b = 0; b < 2; b++) {
          ctx.globalAlpha = 0.55 + 0.35 * hash(step + b * 11);
          sprite(parts?.fx_arc, z.x, z.y - 14, R * 0.7, hash(step * 2 + b * 17) * Math.PI * 2);
        }
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = '#67e8f9';
        ctx.lineWidth = 1;
        for (let b = 0; b < 3; b++) {
          const ang = hash(step * 3 + b) * Math.PI * 2;
          ctx.globalAlpha = 0.5 + 0.4 * hash(step + b);
          ctx.beginPath();
          let x = z.x;
          let y = z.y - 28;
          ctx.moveTo(x, y);
          for (let s = 1; s <= 5; s++) {
            x = z.x + Math.cos(ang) * R * 0.18 * s + (hash(step + s + b * 9) - 0.5) * 8;
            y = z.y - 28 + Math.sin(ang) * R * 0.14 * s + (hash(step + s * 2 + b * 5) - 0.5) * 8;
            ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      }
    } else if (z.fx === 'blast') {
      const r = z.r ?? 30;
      if (warn) {
        ctx.globalAlpha = 0.3 + 0.5 * prog;
        ctx.strokeStyle = '#fca5a5';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(z.x, z.y, r * (1 + 1.6 * (1 - prog)), 0, Math.PI * 2); // zieht sich zusammen
        ctx.stroke();
      } else impact(r * 1.6, 'dust');
    } else if (z.fx === 'drop') {
      const r = z.r ?? 22;
      if (warn) {
        const total = z.maxDelay ?? 1;
        const fallT = 0.6;
        const fk = Math.max(0, Math.min(1, (prog * total - (total - fallT)) / fallT));
        // Schatten wächst, Klumpen fällt beschleunigt von oben
        ctx.globalAlpha = 0.15 + 0.35 * fk;
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.ellipse(z.x, z.y, r * (0.25 + 0.55 * fk), r * (0.12 + 0.28 * fk), 0, 0, Math.PI * 2);
        ctx.fill();
        const img = [parts?.scrap_a, parts?.scrap_b, parts?.scrap_c][(z.variant ?? 0) % 3];
        if (img && fk > 0 && fk < 1) {
          const h = 120 * (1 - fk) * (1 - fk);
          const s = 15;
          ctx.globalAlpha = 1;
          ctx.save();
          ctx.translate(z.x, z.y - h);
          ctx.rotate(time * 10 + (z.variant ?? 0));
          ctx.drawImage(img, -s / 2, -s / 2, s, s * (img.height / img.width));
          ctx.restore();
        }
      } else impact(r * 1.5, 'crater');
    } else if (z.fx === 'dash') {
      const x2 = z.x2 ?? z.x;
      const y2 = z.y2 ?? z.y;
      const len = Math.hypot(x2 - z.x, y2 - z.y) || 1;
      const ux = (x2 - z.x) / len;
      const uy = (y2 - z.y) / len;
      const w = (z.width ?? 12) / 2;
      if (warn) {
        // Pfeile laufen in Stoßrichtung — je näher der Zündung, desto dichter/heller
        const n = Math.max(3, Math.floor(len / 20));
        ctx.strokeStyle = '#fecaca';
        ctx.lineWidth = 1.4;
        for (let i = 0; i < n; i++) {
          const t = ((i + ((time * (2 + 3 * prog)) % 1)) / n) % 1;
          const cx = z.x + ux * len * t;
          const cy = z.y + uy * len * t;
          ctx.globalAlpha = (0.2 + 0.6 * prog) * Math.sin(t * Math.PI);
          ctx.beginPath();
          ctx.moveTo(cx - ux * 4 - uy * w * 0.7, cy - uy * 4 + ux * w * 0.7);
          ctx.lineTo(cx + ux * 3, cy + uy * 3);
          ctx.lineTo(cx - ux * 4 + uy * w * 0.7, cy - uy * 4 - ux * w * 0.7);
          ctx.stroke();
        }
      } else {
        // Stoß: heißer Streifen mit Tempolinien, Funkenstern am Ende
        const a = Math.max(0, 1 - kAct);
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createLinearGradient(z.x, z.y, x2, y2);
        g.addColorStop(0, 'rgba(254,202,202,0)');
        g.addColorStop(0.6, `rgba(252,165,165,${0.55 * a})`);
        g.addColorStop(1, `rgba(255,255,255,${0.9 * a})`);
        ctx.strokeStyle = g;
        ctx.lineWidth = w * 1.5;
        ctx.beginPath();
        ctx.moveTo(z.x, z.y);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.lineWidth = 1;
        for (let i = -1; i <= 1; i++) {
          const off = i * w * 0.7;
          const s0 = 0.15 + 0.5 * hash(i + 3 + Math.floor(time * 30));
          ctx.globalAlpha = 0.7 * a;
          ctx.strokeStyle = '#ffffff';
          ctx.beginPath();
          ctx.moveTo(z.x - uy * off + ux * len * s0, z.y + ux * off + uy * len * s0);
          ctx.lineTo(z.x - uy * off + ux * len, z.y + ux * off + uy * len);
          ctx.stroke();
        }
        // P0-08: Luftwelle läuft in Stoßrichtung die Strecke entlang
        ctx.globalAlpha = a;
        sprite(parts?.fx_wave, z.x + ux * len * (0.35 + 0.65 * kAct), z.y + uy * len * (0.35 + 0.65 * kAct), w * 3.2, Math.atan2(uy, ux));
        if (spark) {
          ctx.globalAlpha = a;
          const sz = 20 + 14 * kAct;
          ctx.drawImage(spark, x2 - sz / 2, y2 - sz / 2, sz, sz);
        }
      }
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
