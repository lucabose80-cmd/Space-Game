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
const EXTRACT_DURATION = 3.75;
const RESCUE_DURATION = 3.95;

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

/**
 * Rückkehr-Cutscene (Dungeon → Port Solaris):
 * - mode === 'extract': Erfolgreiche Extraktion — Abholung mit Fracht-Schimmer, Kurvenflug & Landung auf Port Solaris.
 * - mode === 'rescue' : Notfall-Bergung (0 HP) — Alarm-Glitch, Dr. Lyras Med-Evac-Drohne zieht verletzten Kapitän hoch & Notlandung auf Port Solaris.
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
    this.splitTime = config.mode === 'rescue' ? 1.85 : 1.65;
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
      else sound.playDropBeam();
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
      sound.playApproachWhoosh();
    }

    // Sterne
    const inPhase2 = this.elapsed >= this.splitTime;
    const speed = inPhase2 ? 24 + (1 - easeOutCubic((this.elapsed - this.splitTime) / 1.2)) * 160 : 18;
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

  private getCraftState(): { x: number; y: number; scale: number; heading: number; bank: number } {
    const t = this.elapsed;
    if (t < this.splitTime) {
      const p = t / this.splitTime;
      if (this.config.mode === 'rescue') {
        // Med-Evac-Drohne fegt von links-oben rein, bremst über dem Sektor und zieht nach rechts-unten ab
        if (p < 0.42) {
          const u = easeOutCubic(p / 0.42);
          const bx = cubicBezier(u, 76, 150, 210, VIRTUAL_WIDTH * 0.5);
          const by = cubicBezier(u, 226, 204, 178, 166);
          const h = Math.atan2(bx.dv, -Math.max(15, -by.dv)) * (1 - u * 0.8);
          return { x: bx.v, y: by.v, scale: 0.86, heading: h, bank: h * 1.8 };
        }
        if (p < 0.78) {
          const wobble = Math.sin(t * 9) * 1.8;
          return { x: VIRTUAL_WIDTH * 0.5 + wobble, y: 166 + Math.cos(t * 7) * 1.2, scale: 0.86, heading: 0, bank: 0 };
        }
        const u = easeInOutQuad((p - 0.78) / 0.22);
        return {
          x: VIRTUAL_WIDTH * 0.5 + u * 150,
          y: 166 + u * 95,
          scale: 0.86 + u * 0.2,
          heading: u * 0.72,
          bank: u * 0.85,
        };
      }
      // Extraktion: Schiff wartet kurz am Sektor, dann elegante Abfahrt-Kurve
      if (p < 0.64) {
        return {
          x: VIRTUAL_WIDTH * 0.5 + Math.sin(t * 3.5) * 2,
          y: 168 + Math.cos(t * 4) * 1.2,
          scale: 0.78,
          heading: 0,
          bank: 0,
        };
      }
      const u = easeInOutQuad((p - 0.64) / 0.36);
      const bx = cubicBezier(u, VIRTUAL_WIDTH * 0.5, 290, 360, 440);
      const by = cubicBezier(u, 168, 184, 224, 286);
      return { x: bx.v, y: by.v, scale: 0.78 + u * 0.24, heading: u * 0.8, bank: u * 0.9 };
    }

    // Phase 2: Rückflug in Kurve direkt in die leuchtende Hangarbucht von Port Solaris (240, 148)
    const u = easeOutCubic((t - this.splitTime) / (this.duration - this.splitTime - 0.25));
    const startX = this.config.mode === 'rescue' ? 388 : 98;
    const ctrl1X = this.config.mode === 'rescue' ? 140 : 346;
    const ctrl2X = this.config.mode === 'rescue' ? 210 : 275;
    const bx = cubicBezier(u, startX, ctrl1X, ctrl2X, VIRTUAL_WIDTH * 0.5);
    const by = cubicBezier(u, 294, 248, 188, 148);
    const rawH = Math.atan2(bx.dv, -Math.max(18, -by.dv));
    const heading = Math.max(-0.55, Math.min(0.55, rawH * (1 - u * 0.82)));
    const scale = 0.98 - 0.52 * u; // schrumpft beim Einfliegen in die riesige Raumstation!
    return { x: bx.v, y: by.v, scale, heading, bank: heading * 1.9 };
  }

  private updateParticles(dt: number): void {
    const craft = this.getCraftState();
    const isRescue = this.config.mode === 'rescue';
    this.spawnAcc += dt * (isRescue ? 42 : 30);
    while (this.spawnAcc >= 1) {
      this.spawnAcc -= 1;
      // Rauch & Funken bei Notfall-Bergung; gold-türkise Triebwerksfunken bei Extraktion
      if (isRescue) {
        const isSmoke = this.rng() < 0.55;
        this.particles.push({
          x: craft.x + (this.rng() - 0.5) * 10,
          y: craft.y + 14 * craft.scale,
          vx: (this.rng() - 0.5) * 18,
          vy: 28 + this.rng() * 34,
          life: 0,
          maxLife: isSmoke ? 0.55 : 0.3,
          size: isSmoke ? 3 : 1.8,
          color: isSmoke ? '#64748b' : this.rng() < 0.5 ? '#f87171' : '#fbbf24',
        });
      } else {
        this.particles.push({
          x: craft.x + (this.rng() < 0.5 ? -6 : 6) * craft.scale,
          y: craft.y + 18 * craft.scale,
          vx: (this.rng() - 0.5) * 14,
          vy: 42 + this.rng() * 48,
          life: 0,
          maxLife: 0.32,
          size: 1.8,
          color: this.rng() < 0.45 ? '#fde047' : '#38e8d4',
        });
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

    // 1. Hintergrund: Phase 1 = Sektor-Vista, Phase 2 = Port Solaris Raumstation!
    const bg = inPhase2 ? hd.cutsceneBgSolaris : hd[SECTOR_BG_KEYS[this.config.sector]];
    const panX = Math.sin(t * 0.8) * 4.5;
    const panY = Math.cos(t * 0.6) * 2.5;
    if (bg) {
      const phaseProgress = inPhase2
        ? clamp01((t - this.splitTime) / (this.duration - this.splitTime))
        : clamp01(t / this.splitTime);
      const zoom = inPhase2 ? 1.02 + phaseProgress * 0.1 : 1.08 - phaseProgress * 0.05;
      const w = VIRTUAL_WIDTH * zoom;
      const h = VIRTUAL_HEIGHT * zoom;
      ctx.drawImage(bg, (VIRTUAL_WIDTH - w) / 2 + panX, (VIRTUAL_HEIGHT - h) / 2 + panY, w, h);
    } else {
      ctx.fillStyle = isRescue ? '#1a090d' : '#081120';
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    }

    // 2. Lebendige Stations-Lichter auf Port Solaris (Phase 2)
    if (inPhase2) {
      const bayPulse = 0.35 + 0.35 * Math.sin(t * 7);
      this.drawGlowDot(
        ctx,
        240 + panX,
        148 + panY,
        34,
        isRescue ? '#ef4444' : '#38e8d4',
        bayPulse,
      );
      // Blinkende Positionslichter an den Sonnensegeln & Kuppeln
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

    // 4. Phase 1: Abhol-Strahl (Extraktion oder verletzte Bergung!)
    const craft = this.getCraftState();
    if (!inPhase2) {
      this.renderPickupBeam(ctx, craft.x, craft.y, panX, panY, t, isRescue);
    }

    // 5. Partikel (Funken / Rauch / Gold-Schimmer)
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, 1 - p.life / p.maxLife) * 0.88;
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x - p.size / 2), Math.round(p.y - p.size / 2), p.size, p.size);
    }
    ctx.globalAlpha = 1;

    // 6. Schiff bzw. Med-Evac-Drohne
    this.renderCraft(ctx, craft, isRescue, t);

    // 7. Notfall-Vignette & subtile Glitch-Scanlines bei 0 HP (Phase 1)
    if (isRescue && !inPhase2) {
      const alarm = 0.16 + 0.14 * Math.sin(t * 12);
      ctx.fillStyle = `rgba(220, 38, 38, ${alarm})`;
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
      if (Math.sin(t * 31) > 0.65) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
        const gy = Math.round(((t * 210) % (VIRTUAL_HEIGHT - 60)) + 30);
        ctx.fillRect(0, gy, VIRTUAL_WIDTH, 2);
      }
    }

    // 8. Warp-Übergangsblitz zwischen Phase 1 und Phase 2
    const splitDist = Math.abs(t - this.splitTime);
    if (splitDist < 0.24) {
      const flash = 1 - splitDist / 0.24;
      ctx.fillStyle = isRescue
        ? `rgba(254, 202, 202, ${flash * 0.85})`
        : `rgba(207, 250, 254, ${flash * 0.85})`;
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    }

    // 9. Kino-Balken
    const barH = 22;
    ctx.fillStyle = '#060a12';
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, barH);
    ctx.fillRect(0, VIRTUAL_HEIGHT - barH, VIRTUAL_WIDTH, barH);
    ctx.fillStyle = accent;
    ctx.globalAlpha = 0.42;
    ctx.fillRect(0, barH - 1, VIRTUAL_WIDTH, 1);
    ctx.fillRect(0, VIRTUAL_HEIGHT - barH, VIRTUAL_WIDTH, 1);
    ctx.globalAlpha = 1;

    // 10. Status-Banner (unten über Kino-Balken)
    this.renderBanner(ctx, t, inPhase2, isRescue, accent);

    // 11. Skip-Hinweis
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

    // 12. Sanftes Ein- & Ausblenden
    if (t < 0.2) {
      ctx.fillStyle = `rgba(10, 18, 30, ${1 - t / 0.2})`;
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    } else if (t > this.duration - 0.38) {
      const f = clamp01((t - (this.duration - 0.38)) / 0.38);
      ctx.fillStyle = `rgba(10, 18, 30, ${f})`;
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    }

    ctx.restore();
  }

  private renderPickupBeam(
    ctx: CanvasRenderingContext2D,
    craftX: number,
    craftY: number,
    ox: number,
    oy: number,
    t: number,
    isRescue: boolean,
  ): void {
    const startT = isRescue ? 0.48 : 0.12;
    const endT = isRescue ? 1.48 : 1.12;
    if (t < startT || t > endT) return;
    const p = clamp01((t - startT) / (endT - startT));
    const beamFade = Math.sin(p * Math.PI);
    const topY = 118 + oy;
    const bottomY = craftY - 14;
    const h = Math.max(18, bottomY - topY);
    const w = 13 * beamFade + 4;

    ctx.save();
    ctx.globalAlpha = beamFade * 0.34;
    ctx.fillStyle = isRescue ? '#ef4444' : '#38e8d4';
    ctx.fillRect(Math.round(craftX - w), topY, Math.round(w * 2), h);
    ctx.globalAlpha = beamFade * 0.65;
    ctx.fillStyle = isRescue ? '#fecaca' : '#fef08a';
    ctx.fillRect(Math.round(craftX - w * 0.4), topY, Math.round(w * 0.8), h);

    // Kapitän wird aus dem Sektor nach unten/ins Schiff bzw. die Med-Drohne gezogen
    const hero = getHDArt().heroDown;
    if (hero) {
      const hy = topY + 6 + p * (h - 10);
      const hx = craftX + ox * (1 - p) * 0.3;
      ctx.save();
      ctx.translate(Math.round(hx), Math.round(hy));
      if (isRescue) {
        // Verletzter Kapitän leicht schräg & mit rotem Warn-Ring
        ctx.rotate(0.28 + Math.sin(t * 14) * 0.08);
        ctx.strokeStyle = '#ef4444';
        ctx.globalAlpha = 0.8;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(0, 0, 11, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        // Erfolgreiche Extraktion: goldener Beute-Schimmer neben dem Kapitän
        this.drawGlowDot(ctx, 8, 2, 7, '#fbbf24', 0.85);
      }
      ctx.globalAlpha = Math.min(1, beamFade * 1.4);
      ctx.drawImage(hero, -10, -10, 20, 20);
      ctx.restore();
    }

    ctx.restore();
  }

  private renderCraft(
    ctx: CanvasRenderingContext2D,
    craft: { x: number; y: number; scale: number; heading: number; bank: number },
    isRescue: boolean,
    t: number,
  ): void {
    const hd = getHDArt();
    const useBank = !isRescue && Math.abs(craft.bank) > 0.22 && !!hd[SECTOR_SHIP_BANK_KEYS[this.config.sector]];
    const sprite = isRescue
      ? hd.cutsceneMedDrone
      : useBank
        ? hd[SECTOR_SHIP_BANK_KEYS[this.config.sector]]
        : hd[SECTOR_SHIP_KEYS[this.config.sector]];

    ctx.save();
    ctx.translate(Math.round(craft.x), Math.round(craft.y));
    if (useBank) {
      // Echtes 3/4-Schräglagen-Sprite (gespiegelt bei Linkskurve, ohne flaches rotate!)
      ctx.scale(craft.bank < 0 ? -craft.scale : craft.scale, craft.scale);
    } else {
      const bankScaleX = 1 - Math.abs(craft.bank) * 0.18;
      ctx.rotate(craft.heading);
      ctx.scale(craft.scale * bankScaleX, craft.scale);
    }

    if (isRescue) {
      const sirenRed = Math.sin(t * 18) > 0;
      this.drawGlowDot(ctx, 0, -4, 24, sirenRed ? '#ef4444' : '#38bdf8', 0.65);
    } else {
      this.drawGlowDot(ctx, 0, 20, 24, '#38e8d4', 0.5);
    }

    if (sprite) {
      const w = isRescue ? 50 : useBank ? 60 : 52;
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
    const alpha = clamp01(t / 0.35) * (t > this.duration - 0.45 ? 1 - clamp01((t - (this.duration - 0.45)) / 0.45) : 1);
    if (alpha <= 0.01) return;

    const boxW = 296;
    const boxH = 36;
    const bx = Math.round((VIRTUAL_WIDTH - boxW) / 2);
    const by = 196;

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
        : '⚠ NOT-EVAKUIERUNG · SCHILDE VERSAGT'
      : inPhase2
        ? '✓ EXTRAKTION ERFOLGREICH · ANFLUG'
        : '✦ TELEPORT-EXTRAKTION AKTIV';
    ctx.fillText(eyebrow, VIRTUAL_WIDTH / 2, by + 5);

    ctx.font = 'bold 11px monospace';
    ctx.fillStyle = '#f8fafc';
    const headline = inPhase2
      ? 'PORT SOLARIS'
      : isRescue
        ? 'KAPITÄN GEBORGEN'
        : 'BEUTE GESICHERT';
    ctx.fillText(headline, VIRTUAL_WIDTH / 2, by + 14);

    ctx.font = '7px monospace';
    ctx.fillStyle = '#cbd5e1';
    const sub = isRescue
      ? this.config.itemsLost > 0
        ? `Verletzt geborgen · ${this.config.itemsLost} Fracht-Slot(s) verloren`
        : 'Verletzt geborgen · Notfall-Rückkehr zur Med-Bay'
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
