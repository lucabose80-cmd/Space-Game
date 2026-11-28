import { getHDArt } from '../assets/artLoader';
import { sound } from '../engine/audio';
import { InputManager, VIRTUAL_HEIGHT, VIRTUAL_WIDTH } from '../engine/input';
import type { SectorId } from '../types';

export type ReturnCutsceneMode = 'extract' | 'rescue';

export interface SectorReturnConfig {
  mode: ReturnCutsceneMode;
  sector: SectorId;
  itemsSaved: number;
  itemsLost: number;
}

interface Star {
  x: number;
  y: number;
  layer: number;
  size: number;
  twinkleOffset: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

const SKIP_LOCK_SEC = 0.28;
const EXTRACT_DURATION = 3.35;
const RESCUE_DURATION = 3.55;

const SECTOR_BG_KEYS: Record<
  SectorId,
  'cutsceneBgS1' | 'cutsceneBgS2' | 'cutsceneBgS3' | 'cutsceneBgS4' | 'cutsceneBgS5'
> = {
  1: 'cutsceneBgS1',
  2: 'cutsceneBgS2',
  3: 'cutsceneBgS3',
  4: 'cutsceneBgS4',
  5: 'cutsceneBgS5',
};

const SECTOR_SHIP_KEYS: Record<
  SectorId,
  'shipCorvette' | 'shipCrystal' | 'shipSolar' | 'shipMonolith'
> = {
  1: 'shipCorvette',
  2: 'shipCrystal',
  3: 'shipSolar',
  4: 'shipMonolith',
  5: 'shipMonolith',
};

const SECTOR_SHIP_BANK_KEYS: Record<
  SectorId,
  'shipCorvetteBank' | 'shipCrystalBank' | 'shipSolarBank' | 'shipMonolithBank'
> = {
  1: 'shipCorvetteBank',
  2: 'shipCrystalBank',
  3: 'shipSolarBank',
  4: 'shipMonolithBank',
  5: 'shipMonolithBank',
};

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function easeOutCubic(t: number): number {
  const x = clamp01(t);
  return 1 - (1 - x) * (1 - x) * (1 - x);
}

function easeInOutQuad(t: number): number {
  const x = clamp01(t);
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}

function cubicBezier(
  t: number,
  p0: number,
  p1: number,
  p2: number,
  p3: number,
): { v: number; dv: number } {
  const u = 1 - t;
  const v = u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
  const dv = 3 * u * u * (p1 - p0) + 6 * u * t * (p2 - p1) + 3 * t * t * (p3 - p2);
  return { v, dv };
}

function createRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

interface CraftPose {
  x: number;
  y: number;
  scale: number;
  alpha: number;
  /** Für Med-Evac-Drohne: exakter Flugwinkel in Radiant (0 = nach oben). */
  heading: number;
  /** Für Schiffe: 'bank_right' = 3/4-Schräglage nach rechts-oben, 'straight' = gerade in die Bucht. */
  shipPose: 'bank_right' | 'straight';
}

/**
 * Rückkehr-Cutscene (Dungeon → Port Solaris) — Kapitän ist nach der In-Map-Sequenz bereits an Bord!
 * - mode === 'extract': Phase 1 = Schiff startet aus der Sektor-Schleuse in den Warp · Phase 2 = Anflug in die Hangarbucht von Port Solaris.
 * - mode === 'rescue' : Phase 1 = Dr. Lyras Med-Evac-Drohne bricht mit Sirene & Funken aus dem Sektor aus · Phase 2 = Notlandung in Port Solaris.
 */
export class SectorReturnCutscene {
  public readonly config: SectorReturnConfig;
  public elapsed = 0;
  public finished = false;
  public skipped = false;

  private readonly duration: number;
  private readonly splitTime: number;
  private readonly stars: Star[] = [];
  private readonly particles: Particle[] = [];
  private readonly rng: () => number;
  private playedStartSfx = false;
  private playedWarpSfx = false;
  private spawnAcc = 0;

  constructor(config: SectorReturnConfig) {
    this.config = config;
    this.duration = config.mode === 'rescue' ? RESCUE_DURATION : EXTRACT_DURATION;
    this.splitTime = config.mode === 'rescue' ? 1.5 : 1.4;
    this.rng = createRng(config.sector * 3571 + (config.mode === 'rescue' ? 911 : 202));

    for (let i = 0; i < 78; i++) {
      const layer = i < 38 ? 0 : i < 64 ? 1 : 2;
      this.stars.push({
        x: this.rng() * VIRTUAL_WIDTH,
        y: this.rng() * VIRTUAL_HEIGHT,
        layer,
        size: layer === 2 ? 2 : 1,
        twinkleOffset: this.rng() * Math.PI * 2,
      });
    }
  }

  public seek(sec: number): void {
    this.elapsed = Math.max(0, Math.min(this.duration, sec));
  }

  public skip(): void {
    if (this.finished) return;
    this.skipped = true;
    this.finished = true;
    sound.playUiClick();
  }

  public update(dt: number, input: InputManager): boolean {
    if (this.finished) return true;

    if (!this.playedStartSfx) {
      this.playedStartSfx = true;
      if (this.config.mode === 'rescue') sound.playEmergencySiren();
      else sound.playApproachWhoosh();
    }

    if (this.elapsed >= SKIP_LOCK_SEC) {
      if (
        input.wasPressed('Space', true) ||
        input.wasPressed('Enter', true) ||
        input.wasPressed('Escape', true) ||
        input.wasPressed('KeyE', true) ||
        input.primaryPressed()
      ) {
        this.skip();
        return true;
      }
    }

    this.elapsed += dt;

    if (!this.playedWarpSfx && this.elapsed >= this.splitTime - 0.12) {
      this.playedWarpSfx = true;
      this.particles.length = 0;
      sound.playWarp();
    }

    // Sterne
    const inPhase2 = this.elapsed >= this.splitTime;
    const speed = inPhase2 ? 24 + (1 - easeOutCubic((this.elapsed - this.splitTime) / 1.1)) * 150 : 28;
    for (const s of this.stars) {
      const mult = s.layer === 0 ? 0.35 : s.layer === 1 ? 0.72 : 1.3;
      s.y += speed * mult * dt;
      if (s.y > VIRTUAL_HEIGHT + 8) {
        s.y = -8;
        s.x = this.rng() * VIRTUAL_WIDTH;
      }
    }

    this.updateParticles(dt);

    if (this.elapsed >= this.duration) {
      this.finished = true;
      return true;
    }
    return false;
  }

  private getCraftState(): CraftPose {
    const t = this.elapsed;
    if (t < this.splitTime) {
      const u = easeInOutQuad(t / this.splitTime);
      const alpha = clamp01(u / 0.16);
      if (this.config.mode === 'rescue') {
        // Med-Evac-Drohne (Kapitän bereits an Bord!) bricht aus der Sektor-Schleuse (240, 122) nach rechts-unten aus
        const bx = cubicBezier(u, 240, 276, 362, 468);
        const by = cubicBezier(u, 122, 152, 198, 252);
        const heading = Math.atan2(bx.dv, -by.dv);
        return {
          x: bx.v,
          y: by.v,
          scale: 0.36 + u * 0.72,
          alpha,
          heading,
          shipPose: 'bank_right',
        };
      }
      // Extraktion: Schiff (Kapitän & Beute bereits an Bord!) startet aus der Schleuse & zieht im 3/4-Flug nach rechts-oben weg
      const bx = cubicBezier(u, 240, 306, 388, 474);
      const by = cubicBezier(u, 124, 130, 92, 42);
      return {
        x: bx.v,
        y: by.v,
        scale: 0.34 + u * 0.74,
        alpha,
        heading: Math.atan2(bx.dv, -by.dv),
        shipPose: 'bank_right',
      };
    }

    // Phase 2: Sauberer Ein-Kurven-Anflug direkt in die leuchtende Hangarbucht von Port Solaris (240, 148)
    const u = easeOutCubic((t - this.splitTime) / (this.duration - this.splitTime - 0.2));
    const alpha = u > 0.84 ? 1 - clamp01((u - 0.84) / 0.16) : 1;
    if (this.config.mode === 'rescue') {
      // Med-Evac-Drohne fegt von rechts-unten in einer glatten Kurve in die blinkende Med-Bay-Bucht
      const bx = cubicBezier(u, 422, 352, 286, VIRTUAL_WIDTH * 0.5);
      const by = cubicBezier(u, 254, 206, 172, 148);
      const heading = Math.atan2(bx.dv, -by.dv);
      return {
        x: bx.v,
        y: by.v,
        scale: 1.0 - 0.66 * u,
        alpha,
        heading,
        shipPose: 'straight',
      };
    }
    // Extraktion: Schiff kommt von links-unten im echten 3/4-Schräglagen-Sprite nach rechts-oben in die Hangarbucht (kein Kippen/Spiegeln!)
    const bx = cubicBezier(u, 56, 126, 192, VIRTUAL_WIDTH * 0.5);
    const by = cubicBezier(u, 256, 212, 174, 148);
    const shipPose: 'bank_right' | 'straight' = u < 0.72 ? 'bank_right' : 'straight';
    return {
      x: bx.v,
      y: by.v,
      scale: 1.04 - 0.72 * u,
      alpha,
      heading: 0,
      shipPose,
    };
  }

  private updateParticles(dt: number): void {
    const craft = this.getCraftState();
    const isRescue = this.config.mode === 'rescue';
    if (craft.alpha > 0.15) {
      this.spawnAcc += dt * (isRescue ? 46 : 36);
      while (this.spawnAcc >= 1) {
        this.spawnAcc -= 1;
        if (isRescue) {
          // Ausstoß genau am Heck der gedrehten Med-Evac-Drohne
          const rearX = -Math.sin(craft.heading);
          const rearY = Math.cos(craft.heading);
          const isSmoke = this.rng() < 0.55;
          this.particles.push({
            x: craft.x + rearX * 15 * craft.scale + (this.rng() - 0.5) * 6,
            y: craft.y + rearY * 15 * craft.scale + (this.rng() - 0.5) * 6,
            vx: rearX * (32 + this.rng() * 32) + (this.rng() - 0.5) * 16,
            vy: rearY * (32 + this.rng() * 32) + (this.rng() - 0.5) * 16,
            life: 0,
            maxLife: isSmoke ? 0.52 : 0.28,
            size: isSmoke ? Math.max(1.5, 3 * craft.scale) : Math.max(1, 1.8 * craft.scale),
            color: isSmoke ? '#64748b' : this.rng() < 0.5 ? '#f87171' : '#fbbf24',
          });
        } else {
          const isBank = craft.shipPose === 'bank_right';
          const ox = isBank ? -14 * craft.scale : (this.rng() < 0.5 ? -6 : 6) * craft.scale;
          const oy = (isBank ? 12 : 16) * craft.scale;
          this.particles.push({
            x: craft.x + ox + (this.rng() - 0.5) * 3,
            y: craft.y + oy + (this.rng() - 0.5) * 3,
            vx: isBank ? -48 - this.rng() * 38 : (this.rng() - 0.5) * 14,
            vy: 38 + this.rng() * 40,
            life: 0,
            maxLife: 0.3,
            size: Math.max(1, 2 * craft.scale),
            color: this.rng() < 0.4 ? '#fde047' : '#38e8d4',
          });
        }
      }
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]!;
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  public render(ctx: CanvasRenderingContext2D): void {
    const t = this.elapsed;
    const isRescue = this.config.mode === 'rescue';
    const inPhase2 = t >= this.splitTime;
    const hd = getHDArt();
    const accent = isRescue ? '#f87171' : '#38e8d4';

    ctx.save();

    // 1. Hintergrund: Phase 1 = Sektor-Vista (Abflug), Phase 2 = Port Solaris Raumstation (Anflug)
    const bg = inPhase2 ? hd.cutsceneBgSolaris : hd[SECTOR_BG_KEYS[this.config.sector]];
    const panX = Math.sin(t * 0.8) * 4.5;
    const panY = Math.cos(t * 0.6) * 2.5;
    if (bg) {
      const phaseProgress = inPhase2
        ? clamp01((t - this.splitTime) / (this.duration - this.splitTime))
        : clamp01(t / this.splitTime);
      const zoom = inPhase2 ? 1.02 + phaseProgress * 0.1 : 1.09 - phaseProgress * 0.06;
      const w = VIRTUAL_WIDTH * zoom;
      const h = VIRTUAL_HEIGHT * zoom;
      ctx.drawImage(bg, (VIRTUAL_WIDTH - w) / 2 + panX, (VIRTUAL_HEIGHT - h) / 2 + panY, w, h);
    } else {
      ctx.fillStyle = isRescue ? '#1a090d' : '#081120';
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    }

    // 2. Lebendige Schleusen-/Stationslichter
    if (!inPhase2) {
      // Abflug-Blitz aus der Sektor-Schleuse (erste 0.55 s)
      if (t < 0.55) {
        const p = clamp01(t / 0.55);
        this.drawGlowDot(
          ctx,
          240 + panX,
          122 + panY,
          20 + p * 26,
          isRescue ? '#ef4444' : '#38e8d4',
          Math.sin(p * Math.PI) * 0.85,
        );
      }
    } else {
      const bayPulse = 0.35 + 0.35 * Math.sin(t * 7);
      this.drawGlowDot(
        ctx,
        240 + panX,
        148 + panY,
        34,
        isRescue ? '#ef4444' : '#38e8d4',
        bayPulse,
      );
      if (Math.sin(t * 6) > 0) {
        this.drawGlowDot(ctx, 184 + panX, 34 + panY, 6, '#fbbf24', 0.8);
        this.drawGlowDot(ctx, 314 + panX, 34 + panY, 6, '#fbbf24', 0.8);
      }
      if (isRescue && Math.sin(t * 14) > 0) {
        this.drawGlowDot(ctx, 240 + panX, 146 + panY, 22, '#f87171', 0.65);
      }
    }

    // 3. Sterne
    for (const s of this.stars) {
      const tw = 0.55 + 0.45 * Math.sin(t * 3 + s.twinkleOffset);
      ctx.globalAlpha = (s.layer === 0 ? 0.35 : 0.72) * tw;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.round(s.x), Math.round(s.y), s.size, s.size);
    }
    ctx.globalAlpha = 1;

    // 4. Partikel (Funken / Rauch / Triebwerksspur)
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, 1 - p.life / p.maxLife) * 0.88;
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x - p.size / 2), Math.round(p.y - p.size / 2), p.size, p.size);
    }
    ctx.globalAlpha = 1;

    // 5. Schiff bzw. Med-Evac-Drohne (Kapitän bereits an Bord — kein doppelter Abhol-Strahl!)
    const craft = this.getCraftState();
    this.renderCraft(ctx, craft, isRescue, t);

    // 6. Notfall-Vignette & subtile Glitch-Scanlines bei 0 HP (Phase 1)
    if (isRescue && !inPhase2) {
      const alarm = 0.14 + 0.12 * Math.sin(t * 12);
      ctx.fillStyle = `rgba(220, 38, 38, ${alarm})`;
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
      if (Math.sin(t * 31) > 0.65) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
        const gy = Math.round(((t * 210) % (VIRTUAL_HEIGHT - 60)) + 30);
        ctx.fillRect(0, gy, VIRTUAL_WIDTH, 2);
      }
    }

    // 7. Warp-Übergangsblitz zwischen Phase 1 und Phase 2
    const splitDist = Math.abs(t - this.splitTime);
    if (splitDist < 0.22) {
      const flash = 1 - splitDist / 0.22;
      ctx.fillStyle = isRescue
        ? `rgba(254, 202, 202, ${flash * 0.85})`
        : `rgba(207, 250, 254, ${flash * 0.85})`;
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    }

    // 8. Kino-Balken
    const barH = 22;
    ctx.fillStyle = '#060a12';
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, barH);
    ctx.fillRect(0, VIRTUAL_HEIGHT - barH, VIRTUAL_WIDTH, barH);
    ctx.fillStyle = accent;
    ctx.globalAlpha = 0.42;
    ctx.fillRect(0, barH - 1, VIRTUAL_WIDTH, 1);
    ctx.fillRect(0, VIRTUAL_HEIGHT - barH, VIRTUAL_WIDTH, 1);
    ctx.globalAlpha = 1;

    // 9. Status-Banner (unten über Kino-Balken)
    this.renderBanner(ctx, t, inPhase2, isRescue, accent);

    // 10. Skip-Hinweis
    if (t >= SKIP_LOCK_SEC) {
      const pulse = 0.55 + 0.35 * Math.sin(t * 5);
      ctx.save();
      ctx.globalAlpha = pulse;
      ctx.font = 'bold 7px monospace';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText('[LEERTASTE / KLICK] ÜBERSPRINGEN ▸', VIRTUAL_WIDTH - 12, VIRTUAL_HEIGHT - barH / 2);
      ctx.restore();
    }

    // 11. Sanftes Ein- & Ausblenden
    if (t < 0.2) {
      ctx.fillStyle = `rgba(10, 18, 30, ${1 - t / 0.2})`;
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    } else if (t > this.duration - 0.36) {
      const f = clamp01((t - (this.duration - 0.36)) / 0.36);
      ctx.fillStyle = `rgba(10, 18, 30, ${f})`;
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    }

    ctx.restore();
  }

  private renderCraft(
    ctx: CanvasRenderingContext2D,
    craft: CraftPose,
    isRescue: boolean,
    t: number,
  ): void {
    if (craft.alpha <= 0.01) return;
    const hd = getHDArt();
    const useBank = !isRescue && craft.shipPose === 'bank_right' && !!hd[SECTOR_SHIP_BANK_KEYS[this.config.sector]];
    const sprite = isRescue
      ? hd.cutsceneMedDrone
      : useBank
        ? hd[SECTOR_SHIP_BANK_KEYS[this.config.sector]]
        : hd[SECTOR_SHIP_KEYS[this.config.sector]];

    ctx.save();
    ctx.globalAlpha = craft.alpha;
    ctx.translate(Math.round(craft.x), Math.round(craft.y));
    if (isRescue) {
      ctx.rotate(craft.heading);
      ctx.scale(craft.scale, craft.scale);
    } else {
      ctx.scale(craft.scale, craft.scale);
    }

    if (isRescue) {
      const sirenRed = Math.sin(t * 18) > 0;
      this.drawGlowDot(ctx, 0, -4, 24, sirenRed ? '#ef4444' : '#38bdf8', 0.65);
    } else {
      this.drawGlowDot(ctx, useBank ? -14 : 0, useBank ? 14 : 20, 24, '#38e8d4', 0.5);
    }

    if (sprite) {
      const w = isRescue ? 50 : useBank ? 62 : 52;
      const h = Math.round((sprite.height / Math.max(1, sprite.width)) * w);
      ctx.drawImage(sprite, Math.round(-w / 2), Math.round(-h / 2), w, h);
    } else {
      ctx.fillStyle = isRescue ? '#ef4444' : '#cbd5e1';
      ctx.fillRect(-10, -14, 20, 28);
    }
    ctx.restore();
  }

  private renderBanner(
    ctx: CanvasRenderingContext2D,
    t: number,
    inPhase2: boolean,
    isRescue: boolean,
    accent: string,
  ): void {
    const alpha = clamp01(t / 0.32) * (t > this.duration - 0.42 ? 1 - clamp01((t - (this.duration - 0.42)) / 0.42) : 1);
    if (alpha <= 0.01) return;

    const boxW = 296;
    const boxH = 36;
    const bx = Math.round((VIRTUAL_WIDTH - boxW) / 2);
    const by = 200;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = isRescue ? 'rgba(28, 8, 12, 0.84)' : 'rgba(6, 12, 24, 0.82)';
    ctx.fillRect(bx, by, boxW, boxH);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1;
    ctx.strokeRect(bx + 0.5, by + 0.5, boxW - 1, boxH - 1);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = 'bold 7px monospace';
    ctx.fillStyle = accent;
    const eyebrow = isRescue
      ? inPhase2
        ? '🏥 DR. LYRAS MED-EVAC · NOTLANDUNG'
        : '⚠ NOT-EVAKUIERUNG · ABFLUG'
      : inPhase2
        ? '✓ EXTRAKTION ERFOLGREICH · ANFLUG'
        : '✦ SEKTOR VERLASSEN · RÜCKFLUG';
    ctx.fillText(eyebrow, VIRTUAL_WIDTH / 2, by + 5);

    ctx.font = 'bold 11px monospace';
    ctx.fillStyle = '#f8fafc';
    const headline = inPhase2
      ? 'PORT SOLARIS'
      : isRescue
        ? 'MED-EVAC UNTERWEGS'
        : 'BEUTE AN BORD';
    ctx.fillText(headline, VIRTUAL_WIDTH / 2, by + 14);

    ctx.font = '7px monospace';
    ctx.fillStyle = '#cbd5e1';
    const sub = isRescue
      ? this.config.itemsLost > 0
        ? `Kapitän an Bord · ${this.config.itemsLost} Fracht-Slot(s) verloren`
        : 'Kapitän stabilisiert · Notfall-Rückkehr zur Med-Bay'
      : this.config.itemsSaved > 0
        ? `${this.config.itemsSaved} Relikt(e) sicher an Bord · Rückkehr zum Hafen`
        : 'Sicher an Bord · Rückkehr zum Raumhafen';
    ctx.fillText(sub, VIRTUAL_WIDTH / 2, by + 26);

    ctx.restore();
  }

  private drawGlowDot(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number,
    color: string,
    alpha: number,
  ): void {
    const g = ctx.createRadialGradient(x, y, 0.5, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.restore();
  }
}
