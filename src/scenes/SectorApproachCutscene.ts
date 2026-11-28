import { getHDArt } from '../assets/artLoader';
import { sound } from '../engine/audio';
import { InputManager, VIRTUAL_HEIGHT, VIRTUAL_WIDTH } from '../engine/input';
import type { SectorId } from '../types';

export interface SectorApproachConfig {
  sector: SectorId;
  endlessRift: boolean;
  isNightRun: boolean;
}

interface SectorTheme {
  eyebrow: string;
  title: string;
  subtitle: string;
  bgTop: string;
  bgBottom: string;
  nebulaA: string;
  nebulaB: string;
  accent: string;
  accentSoft: string;
  beamCore: string;
  thruster: string;
  shipKey: 'shipCorvette' | 'shipCrystal' | 'shipSolar' | 'shipMonolith';
  bgKey: 'cutsceneBgS1' | 'cutsceneBgS2' | 'cutsceneBgS3' | 'cutsceneBgS4' | 'cutsceneBgS5';
}

interface Star {
  x: number;
  y: number;
  layer: number; // 0 = fern, 1 = mittel, 2 = nah
  size: number;
  twinkleOffset: number;
  tint: string;
}

interface ExhaustParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

const TOTAL_DURATION = 4.55;
const SKIP_LOCK_SEC = 0.28;

const SECTOR_THEMES: Record<SectorId, SectorTheme> = {
  1: {
    eyebrow: 'SEKTOR I · DOCK-ANFLUG',
    title: 'VERLASSENE KORVETTE',
    subtitle: 'Treibendes Wrack · Signal des Echos geortet',
    bgTop: '#070e1c',
    bgBottom: '#102033',
    nebulaA: 'rgba(56, 200, 212, 0.16)',
    nebulaB: 'rgba(245, 158, 11, 0.14)',
    accent: '#38e8d4',
    accentSoft: '#7dd3fc',
    beamCore: '#d8ffff',
    thruster: '#38e8d4',
    shipKey: 'shipCorvette',
    bgKey: 'cutsceneBgS1',
  },
  2: {
    eyebrow: 'SEKTOR II · KRISTALL-KURS',
    title: 'KRISTALL-NEBEL',
    subtitle: 'Singende Adern · Resonanzfeld stabil',
    bgTop: '#0d0820',
    bgBottom: '#1c1138',
    nebulaA: 'rgba(192, 132, 252, 0.20)',
    nebulaB: 'rgba(34, 211, 238, 0.15)',
    accent: '#c084fc',
    accentSoft: '#67e8f9',
    beamCore: '#f5d0fe',
    thruster: '#a855f7',
    shipKey: 'shipCrystal',
    bgKey: 'cutsceneBgS2',
  },
  3: {
    eyebrow: 'SEKTOR III · ORBITAL-ANFLUG',
    title: 'SOLAR-GIESSEREI',
    subtitle: 'Korona-Hitze · Schmelzschilde aktiv',
    bgTop: '#160908',
    bgBottom: '#2d120a',
    nebulaA: 'rgba(251, 146, 60, 0.22)',
    nebulaB: 'rgba(239, 68, 68, 0.16)',
    accent: '#fb923c',
    accentSoft: '#fde047',
    beamCore: '#fef08a',
    thruster: '#f97316',
    shipKey: 'shipSolar',
    bgKey: 'cutsceneBgS3',
  },
  4: {
    eyebrow: 'SEKTOR IV · ASTRAL-SPRUNG',
    title: 'ÄLTESTEN-MONOLITH',
    subtitle: 'Obsidian-Kammern · Uralte Siegel erwachen',
    bgTop: '#050814',
    bgBottom: '#12182d',
    nebulaA: 'rgba(250, 204, 21, 0.14)',
    nebulaB: 'rgba(56, 189, 248, 0.16)',
    accent: '#facc15',
    accentSoft: '#7dd3fc',
    beamCore: '#fef9c3',
    thruster: '#38bdf8',
    shipKey: 'shipMonolith',
    bgKey: 'cutsceneBgS4',
  },
  5: {
    eyebrow: '5. TOR · TIEFENRAUM-RISS',
    title: 'OMEGA-ANOMALIE',
    subtitle: 'Jenseits der vier Siegel · Raumzeit instabil',
    bgTop: '#0b0518',
    bgBottom: '#220b34',
    nebulaA: 'rgba(232, 121, 249, 0.22)',
    nebulaB: 'rgba(250, 204, 21, 0.14)',
    accent: '#e879f9',
    accentSoft: '#fde047',
    beamCore: '#fae8ff',
    thruster: '#e879f9',
    shipKey: 'shipMonolith',
    bgKey: 'cutsceneBgS5',
  },
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

/** Deterministischer Mini-PRNG (kein globaler Zufall → reproduzierbar in Tests). */
function createRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * Sektor-Anflug-Cutscene (Hangar → Dungeon):
 * Phase 1 (0.0–1.7 s): Hyperraum-Einflug mit Parallax-Sternen, Warp-Streifen & echtem Sektor-Schiff.
 * Phase 2 (1.5–3.1 s): Abbremsen vor dem Sektor-Ziel + Kino-Titelkarte.
 * Phase 3 (3.0–4.55 s): Absetz-/Teleport-Strahl beamt den Spieler in den Sektor → Fade-Übergang.
 */
export class SectorApproachCutscene {
  public readonly config: SectorApproachConfig;
  public elapsed = 0;
  public finished = false;
  public skipped = false;

  private readonly theme: SectorTheme;
  private readonly stars: Star[] = [];
  private readonly particles: ExhaustParticle[] = [];
  private readonly rng: () => number;
  private playedWhoosh = false;
  private playedBeam = false;
  private spawnAcc = 0;

  constructor(config: SectorApproachConfig) {
    this.config = config;
    const base = SECTOR_THEMES[config.sector];
    this.theme = config.endlessRift
      ? {
          ...base,
          eyebrow: '5. TOR · ∞ ENDLOS-RIFT',
          title: 'UNENDLICHE SPIRALE',
          subtitle: 'Wechselnde Sektor-Echos · Instabile Mutatoren',
        }
      : base;

    this.rng = createRng(config.sector * 7919 + (config.endlessRift ? 1337 : 42));
    const tints = ['#ffffff', '#dbeafe', '#fef3c7', this.theme.accentSoft];
    for (let i = 0; i < 88; i++) {
      const layer = i < 42 ? 0 : i < 72 ? 1 : 2;
      this.stars.push({
        x: this.rng() * VIRTUAL_WIDTH,
        y: this.rng() * VIRTUAL_HEIGHT,
        layer,
        size: layer === 2 ? 2 : 1,
        twinkleOffset: this.rng() * Math.PI * 2,
        tint: tints[Math.floor(this.rng() * tints.length)]!,
      });
    }
  }

  /** Direkter Sprung zu einem Zeitpunkt (hilfreich für visuelle QA-Tests). */
  public seek(sec: number): void {
    this.elapsed = Math.max(0, Math.min(TOTAL_DURATION, sec));
  }

  public skip(): void {
    if (this.finished) return;
    this.skipped = true;
    this.finished = true;
    sound.playUiClick();
  }

  public update(dt: number, input: InputManager): boolean {
    if (this.finished) return true;

    if (!this.playedWhoosh) {
      this.playedWhoosh = true;
      sound.playApproachWhoosh();
    }

    // Überspringen nach kurzer Schutzzeit (verhindert versehentliches Skippen durch E im Hangar)
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

    if (!this.playedBeam && this.elapsed >= 3.05) {
      this.playedBeam = true;
      sound.playDropBeam();
    }

    // Sternen-Scroll: schnell im Warp (0..1.4 s), danach ruhiges Gleiten
    const warpFactor = 1 - easeOutCubic(this.elapsed / 1.65);
    const baseSpeed = 16 + warpFactor * 260;
    for (const s of this.stars) {
      const mult = s.layer === 0 ? 0.35 : s.layer === 1 ? 0.72 : 1.35;
      s.y += baseSpeed * mult * dt;
      if (s.y > VIRTUAL_HEIGHT + 10) {
        s.y = -10;
        s.x = this.rng() * VIRTUAL_WIDTH;
      }
    }

    // Triebwerks- & Beam-Partikel
    this.updateParticles(dt, warpFactor);

    if (this.elapsed >= TOTAL_DURATION) {
      this.finished = true;
      return true;
    }
    return false;
  }

  private getShipState(): { x: number; y: number; scale: number; tilt: number; thrust: number } {
    const t = this.elapsed;
    // Einflug von unten bis zur Anflug-Position unterhalb der Andock-Schleuse
    const approachT = easeOutCubic(t / 1.75);
    const hoverT = Math.max(0, t - 1.75);
    const wobbleX = Math.sin(hoverT * 2.4) * 2.0;
    const wobbleY = Math.cos(hoverT * 3.1) * 1.2;
    const x = VIRTUAL_WIDTH * 0.5 + (1 - approachT) * -26 + wobbleX;
    const y = 304 + (170 - 304) * approachT + wobbleY;
    const scale = 1.06 - 0.30 * approachT;
    const tilt = (1 - approachT) * 0.13 + Math.cos(hoverT * 2.4) * 0.016;
    const thrust = clamp01(1.15 - approachT * 0.78);
    return { x, y, scale, tilt, thrust };
  }

  private updateParticles(dt: number, warpFactor: number): void {
    const ship = this.getShipState();
    this.spawnAcc += dt * (28 + warpFactor * 65);
    while (this.spawnAcc >= 1) {
      this.spawnAcc -= 1;
      const side = this.rng() < 0.5 ? -8.5 : 8.5;
      const sx = ship.x + side * ship.scale + (this.rng() - 0.5) * 3;
      const sy = ship.y + 24 * ship.scale;
      this.particles.push({
        x: sx,
        y: sy,
        vx: (this.rng() - 0.5) * 12,
        vy: 55 + warpFactor * 165 + this.rng() * 40,
        life: 0,
        maxLife: 0.28 + this.rng() * 0.24,
        size: this.rng() < 0.4 ? 2 : 1.5,
        color: this.rng() < 0.35 ? '#ffffff' : this.theme.thruster,
      });
    }

    // Aufsteigende Lichtfunken während des Teleport-Beams (3.0..4.3 s)
    if (this.elapsed >= 3.0 && this.elapsed <= 4.35 && this.rng() < dt * 55) {
      this.particles.push({
        x: VIRTUAL_WIDTH * 0.5 + (this.rng() - 0.5) * 24,
        y: 86 + this.rng() * 68,
        vx: (this.rng() - 0.5) * 10,
        vy: -24 - this.rng() * 30,
        life: 0,
        maxLife: 0.45 + this.rng() * 0.3,
        size: this.rng() < 0.5 ? 2 : 1,
        color: this.rng() < 0.45 ? this.theme.beamCore : this.theme.accent,
      });
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
    const warpFactor = 1 - easeOutCubic(t / 1.65);
    const hd = getHDArt();

    ctx.save();

    // 1. Tiefraum-Hintergrund (optionales Pixel-Art-Vista oder prozedurales Weltall)
    const customBg = hd[this.theme.bgKey];
    if (customBg) {
      const zoom = 1 + easeInOutQuad(t / TOTAL_DURATION) * 0.08;
      const w = VIRTUAL_WIDTH * zoom;
      const h = VIRTUAL_HEIGHT * zoom;
      ctx.drawImage(customBg, (VIRTUAL_WIDTH - w) / 2, (VIRTUAL_HEIGHT - h) / 2, w, h);
      // Dezente Abdunklung am unteren Rand für Kontrast von Schiff & Titelkarte
      const veil = ctx.createLinearGradient(0, 0, 0, VIRTUAL_HEIGHT);
      veil.addColorStop(0, 'rgba(6, 10, 20, 0.14)');
      veil.addColorStop(0.65, 'rgba(6, 10, 20, 0.10)');
      veil.addColorStop(1, 'rgba(6, 10, 20, 0.48)');
      ctx.fillStyle = veil;
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    } else {
      const bgGrad = ctx.createLinearGradient(0, 0, 0, VIRTUAL_HEIGHT);
      bgGrad.addColorStop(0, this.theme.bgTop);
      bgGrad.addColorStop(1, this.theme.bgBottom);
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

      // Zwei weiche Nebelwolken
      this.drawNebula(ctx, 118, 72 + t * 4, 130, this.theme.nebulaA);
      this.drawNebula(ctx, 368, 128 + t * 3, 145, this.theme.nebulaB);
    }

    // 2. Parallax-Sterne & Warp-Streifen
    this.renderStars(ctx, warpFactor);

    // 3. Sektor-Zielobjekt im oberen Bildbereich (nur bei prozeduralem Hintergrund)
    if (!customBg) {
      const destAppear = easeOutCubic((t - 0.1) / 1.65);
      const destScale = 0.56 + 0.44 * destAppear;
      const destY = -28 + 102 * destAppear;
      this.renderSectorDestination(ctx, VIRTUAL_WIDTH * 0.5, destY, destScale, t);
    }

    // 4. Absetz-/Teleport-Strahl + Spieler-Sprite (Phase 3: 3.0..4.55 s)
    const ship = this.getShipState();
    this.renderDropBeam(ctx, ship.x, ship.y, t, customBg !== null);

    // 5. Triebwerks-Partikel
    for (const p of this.particles) {
      const alpha = 1 - p.life / p.maxLife;
      ctx.globalAlpha = alpha * 0.9;
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x - p.size / 2), Math.round(p.y - p.size / 2), p.size, p.size);
    }
    ctx.globalAlpha = 1;

    // 6. Echtes Sektor-Schiff-Sprite
    this.renderShip(ctx, ship);

    // 7. Kino-Balken (Letterbox)
    const barSlide = easeOutCubic(t / 0.45);
    const barH = Math.round(22 * barSlide);
    ctx.fillStyle = '#060a12';
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, barH);
    ctx.fillRect(0, VIRTUAL_HEIGHT - barH, VIRTUAL_WIDTH, barH);
    if (barH > 4) {
      ctx.fillStyle = this.theme.accent;
      ctx.globalAlpha = 0.35;
      ctx.fillRect(0, barH - 1, VIRTUAL_WIDTH, 1);
      ctx.fillRect(0, VIRTUAL_HEIGHT - barH, VIRTUAL_WIDTH, 1);
      ctx.globalAlpha = 1;
    }

    // 8. Sektor-Titelkarte (1.35..3.95 s)
    this.renderTitleCard(ctx, t);

    // 9. Skip-Hinweis im unteren Kino-Balken
    if (t >= SKIP_LOCK_SEC && barH >= 16) {
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

    // 10. Sanftes Einblenden am Anfang & leuchtender Übergang am Ende
    if (t < 0.25) {
      ctx.fillStyle = `rgba(10, 18, 30, ${1 - t / 0.25})`;
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    } else if (t > TOTAL_DURATION - 0.45) {
      const f = clamp01((t - (TOTAL_DURATION - 0.45)) / 0.45);
      ctx.fillStyle = `rgba(10, 18, 30, ${f})`;
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    }

    ctx.restore();
  }

  private drawNebula(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
    const g = ctx.createRadialGradient(x, y, 4, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  private renderStars(ctx: CanvasRenderingContext2D, warpFactor: number): void {
    const t = this.elapsed;
    for (const s of this.stars) {
      const twinkle = 0.55 + 0.45 * Math.sin(t * (2.5 + s.layer) + s.twinkleOffset);
      ctx.globalAlpha = (s.layer === 0 ? 0.45 : s.layer === 1 ? 0.72 : 0.95) * twinkle;
      ctx.fillStyle = s.tint;
      const sx = Math.round(s.x);
      const sy = Math.round(s.y);
      if (warpFactor > 0.08 && s.layer >= 1) {
        const streak = Math.max(2, Math.round(warpFactor * (s.layer === 2 ? 24 : 12)));
        ctx.fillRect(sx, sy - streak, s.size, streak + s.size);
      } else {
        ctx.fillRect(sx, sy, s.size, s.size);
      }
    }
    ctx.globalAlpha = 1;
  }

  private renderSectorDestination(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    scale: number,
    t: number,
  ): void {
    ctx.save();
    ctx.translate(Math.round(cx), Math.round(cy));
    ctx.scale(scale, scale);

    const s = this.config.sector;
    if (s === 1) {
      this.drawCorvetteWreck(ctx, t);
    } else if (s === 2) {
      this.drawCrystalNebula(ctx, t);
    } else if (s === 3) {
      this.drawSolarFoundry(ctx, t);
    } else if (s === 4) {
      this.drawElderMonolith(ctx, t);
    } else {
      this.drawOmegaRift(ctx, t);
    }

    ctx.restore();
  }

  /** Sektor 1: Riesiges gebrochenes Korvetten-Wrack mit beleuchteter Andock-Schleuse */
  private drawCorvetteWreck(ctx: CanvasRenderingContext2D, t: number): void {
    // Reaktor-Hintergrundschein
    this.drawNebula(ctx, 0, 8, 102, 'rgba(56, 232, 212, 0.18)');
    // Antennen & Aufbauten oben
    ctx.fillStyle = '#334155';
    ctx.fillRect(-44, -42, 2, 12);
    ctx.fillRect(36, -40, 2, 10);
    ctx.fillRect(-16, -39, 32, 7);

    // Haupt-Rumpf (dunkle Schatten-Silhouette)
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.moveTo(-124, -12);
    ctx.lineTo(-60, -35);
    ctx.lineTo(58, -35);
    ctx.lineTo(124, -8);
    ctx.lineTo(98, 18);
    ctx.lineTo(38, 25);
    ctx.lineTo(-38, 25);
    ctx.lineTo(-100, 16);
    ctx.closePath();
    ctx.fill();

    // Innerer Panzer-Rumpf + Oberkanten-Highlight
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(-118, -12);
    ctx.lineTo(-56, -32);
    ctx.lineTo(54, -32);
    ctx.lineTo(118, -9);
    ctx.lineTo(94, 15);
    ctx.lineTo(36, 22);
    ctx.lineTo(-36, 22);
    ctx.lineTo(-96, 13);
    ctx.closePath();
    ctx.fill();

    // Gestufte Panzerplatten & Fugen
    ctx.fillStyle = '#334155';
    ctx.fillRect(-76, -24, 152, 22);
    ctx.fillStyle = '#475569';
    ctx.fillRect(-54, -30, 108, 9);
    ctx.fillStyle = '#64748b';
    ctx.fillRect(-52, -30, 104, 2);
    // Vertikale Platten-Fugen
    ctx.fillStyle = '#0f172a';
    for (const fx of [-58, -32, 32, 58]) {
      ctx.fillRect(fx, -24, 1, 22);
    }

    // Warme Bronze-Zierleisten (passend zum Port-Solaris-/Korvetten-Stil)
    ctx.fillStyle = '#b45309';
    ctx.fillRect(-90, -8, 26, 6);
    ctx.fillRect(64, -8, 26, 6);
    ctx.fillRect(-44, -26, 88, 3);
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(-88, -8, 22, 1.5);
    ctx.fillRect(66, -8, 22, 1.5);

    // Kleine erloschene & warm glimmende Bullaugen
    for (const wx of [-68, -48, -38, 38, 48, 68]) {
      ctx.fillStyle = Math.abs(wx) === 48 ? '#fbbf24' : '#0f172a';
      ctx.fillRect(wx, -16, 4, 3);
    }

    // Riss im Rumpf mit pulsierendem Reaktor-Glühen
    const crackPulse = 0.65 + 0.35 * Math.sin(t * 8);
    ctx.strokeStyle = `rgba(56, 232, 212, ${crackPulse})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-26, -24);
    ctx.lineTo(-14, -10);
    ctx.lineTo(-22, 3);
    ctx.stroke();

    // Offene Andock-Schleuse unten mittig (Ziel des Absetz-Strahls)
    const bayGlow = 0.65 + 0.35 * Math.sin(t * 6);
    ctx.fillStyle = '#070d1a';
    ctx.fillRect(-22, 7, 44, 16);
    ctx.fillStyle = `rgba(56, 232, 212, ${0.28 + bayGlow * 0.28})`;
    ctx.fillRect(-17, 10, 34, 11);
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(-23, 9, 3, 11);
    ctx.fillRect(20, 9, 3, 11);

    // Blinkende Notlichter
    const blink = Math.sin(t * 7) > 0;
    ctx.fillStyle = blink ? '#f87171' : '#7f1d1d';
    ctx.fillRect(-110, -10, 4, 4);
    ctx.fillRect(106, -8, 4, 4);
    ctx.fillRect(-44, -43, 2, 2);

    // Treibende Trümmerteile
    ctx.fillStyle = '#475569';
    ctx.fillRect(-128 + Math.sin(t * 0.8) * 3, 10 + Math.cos(t) * 2, 10, 5);
    ctx.fillRect(116 + Math.cos(t * 0.9) * 3, 14 + Math.sin(t) * 2, 8, 4);
    ctx.fillStyle = '#b45309';
    ctx.fillRect(-126 + Math.sin(t * 0.8) * 3, 10 + Math.cos(t) * 2, 4, 2);
  }

  /** Sektor 2: Gigantische Kristall-Formation im Nebel */
  private drawCrystalNebula(ctx: CanvasRenderingContext2D, t: number): void {
    this.drawNebula(ctx, 0, 4, 102, 'rgba(192, 132, 252, 0.24)');
    // Asteroiden-Basis
    ctx.fillStyle = '#1e1b3a';
    ctx.beginPath();
    ctx.moveTo(-88, 6);
    ctx.lineTo(-64, -22);
    ctx.lineTo(0, -32);
    ctx.lineTo(68, -20);
    ctx.lineTo(88, 8);
    ctx.lineTo(44, 24);
    ctx.lineTo(-44, 24);
    ctx.closePath();
    ctx.fill();

    // Große leuchtende Kristall-Türme
    const spires: Array<[number, number, number, number, string]> = [
      [-62, -6, 16, 38, '#7e22ce'],
      [-30, -14, 20, 48, '#a855f7'],
      [0, -18, 22, 54, '#22d3ee'],
      [32, -12, 18, 44, '#c084fc'],
      [60, -4, 14, 34, '#6366f1'],
    ];
    for (const [x, y, w, h, col] of spires) {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(x - w / 2, y + 14);
      ctx.lineTo(x, y - h + 14);
      ctx.lineTo(x + w / 2, y + 14);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.moveTo(x - w / 6, y + 10);
      ctx.lineTo(x, y - h + 18);
      ctx.lineTo(x + 2, y + 10);
      ctx.closePath();
      ctx.fill();
    }

    // Kristall-Portal-Eingang
    const pulse = 0.6 + 0.4 * Math.sin(t * 5);
    ctx.fillStyle = '#0f0a24';
    ctx.fillRect(-16, 8, 32, 16);
    ctx.fillStyle = `rgba(103, 232, 249, ${0.35 + pulse * 0.3})`;
    ctx.fillRect(-12, 10, 24, 12);

    // Schwebende Splitter
    ctx.fillStyle = '#67e8f9';
    ctx.fillRect(-102, -4 + Math.sin(t * 2.1) * 4, 4, 8);
    ctx.fillRect(98, 2 + Math.cos(t * 2.4) * 4, 4, 7);
  }

  /** Sektor 3: Orbitale Solar-Gießerei vor glühender Sonne */
  private drawSolarFoundry(ctx: CanvasRenderingContext2D, t: number): void {
    // Glühende Sonnen-Korona im Hintergrund
    const sunGrad = ctx.createRadialGradient(0, -18, 12, 0, -18, 118);
    sunGrad.addColorStop(0, 'rgba(254, 240, 138, 0.72)');
    sunGrad.addColorStop(0.45, 'rgba(249, 115, 22, 0.36)');
    sunGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
    ctx.fillStyle = sunGrad;
    ctx.fillRect(-130, -120, 260, 180);

    // Industrielle Gießerei-Festung
    ctx.fillStyle = '#291512';
    ctx.fillRect(-92, -18, 184, 34);
    ctx.fillStyle = '#451a03';
    ctx.fillRect(-70, -28, 140, 14);
    ctx.fillStyle = '#b45309';
    ctx.fillRect(-86, -12, 172, 4);
    ctx.fillRect(-56, -24, 112, 3);

    // Glühende Lava-Kanäle
    const lavaPulse = 0.7 + 0.3 * Math.sin(t * 6.5);
    ctx.fillStyle = `rgba(251, 146, 60, ${lavaPulse})`;
    ctx.fillRect(-66, -4, 36, 4);
    ctx.fillRect(30, -4, 36, 4);
    ctx.fillStyle = '#fde047';
    ctx.fillRect(-58, -3, 20, 2);
    ctx.fillRect(38, -3, 20, 2);

    // Landebucht
    ctx.fillStyle = '#140806';
    ctx.fillRect(-18, 4, 36, 16);
    ctx.fillStyle = `rgba(253, 224, 71, ${0.35 + lavaPulse * 0.25})`;
    ctx.fillRect(-14, 7, 28, 11);
  }

  /** Sektor 4: Schwebender Obsidian-Monolith mit rotierenden Runen-Ringen */
  private drawElderMonolith(ctx: CanvasRenderingContext2D, t: number): void {
    this.drawNebula(ctx, 0, 0, 98, 'rgba(250, 204, 21, 0.16)');

    // Rotierender Astral-Ring hinter dem Monolithen
    ctx.save();
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 2, 86, 18, Math.sin(t * 0.7) * 0.08, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Obsidian-Obelisk
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.moveTo(0, -46);
    ctx.lineTo(44, -14);
    ctx.lineTo(36, 26);
    ctx.lineTo(-36, 26);
    ctx.lineTo(-44, -14);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#ca8a04';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Pulsierende goldene Runen
    const runeGlow = 0.55 + 0.45 * Math.sin(t * 4.5);
    ctx.fillStyle = `rgba(250, 204, 21, ${runeGlow})`;
    ctx.fillRect(-2, -32, 4, 14);
    ctx.fillRect(-10, -24, 20, 3);
    ctx.fillRect(-18, -8, 6, 3);
    ctx.fillRect(12, -8, 6, 3);

    // Portal-Bogen
    ctx.fillStyle = '#020617';
    ctx.fillRect(-14, 6, 28, 19);
    ctx.fillStyle = `rgba(56, 189, 248, ${0.4 + runeGlow * 0.3})`;
    ctx.fillRect(-10, 9, 20, 14);
  }

  /** Sektor 5: Omega-Anomalie / Unendliche Spirale */
  private drawOmegaRift(ctx: CanvasRenderingContext2D, t: number): void {
    this.drawNebula(ctx, 0, 2, 112, 'rgba(232, 121, 249, 0.28)');

    // Konzentrische Verzerrungs-Ringe
    for (let i = 3; i >= 1; i--) {
      const r = i * 22 + Math.sin(t * 4 + i) * 3;
      ctx.strokeStyle = i === 1 ? '#fae8ff' : i === 2 ? '#e879f9' : '#7e22ce';
      ctx.lineWidth = i === 1 ? 2.5 : 1.8;
      ctx.beginPath();
      ctx.ellipse(0, 4, r * 1.45, r * 0.62, t * (i % 2 === 0 ? 0.5 : -0.4), 0, Math.PI * 2);
      ctx.stroke();
    }

    // 4 kreisende goldene Siegel-Fragmente
    for (let i = 0; i < 4; i++) {
      const ang = t * 1.1 + (i * Math.PI) / 2;
      const sx = Math.cos(ang) * 62;
      const sy = 4 + Math.sin(ang) * 24;
      ctx.fillStyle = '#facc15';
      ctx.fillRect(Math.round(sx - 3), Math.round(sy - 3), 6, 6);
    }

    // Singularitäts-Kern
    const coreGrad = ctx.createRadialGradient(0, 4, 2, 0, 4, 22);
    coreGrad.addColorStop(0, '#ffffff');
    coreGrad.addColorStop(0.5, '#e879f9');
    coreGrad.addColorStop(1, 'rgba(126, 34, 206, 0)');
    ctx.fillStyle = coreGrad;
    ctx.fillRect(-24, -20, 48, 48);
  }

  private renderDropBeam(
    ctx: CanvasRenderingContext2D,
    shipX: number,
    shipY: number,
    t: number,
    hasCustomBg: boolean,
  ): void {
    if (t < 3.0) return;
    const beamT = clamp01((t - 3.0) / 0.35);
    const fadeOut = t > 4.15 ? 1 - clamp01((t - 4.15) / 0.35) : 1;
    const alpha = beamT * fadeOut;
    if (alpha <= 0.01) return;

    const topY = hasCustomBg ? 114 : 82;
    const bottomY = shipY - 19;
    const h = Math.max(20, bottomY - topY);
    const w = 15 * beamT;

    ctx.save();
    // Äußerer Lichtkegel
    ctx.globalAlpha = alpha * 0.30;
    ctx.fillStyle = this.theme.accent;
    ctx.fillRect(Math.round(shipX - w), topY, Math.round(w * 2), h);

    // Heller Kernstrahl
    ctx.globalAlpha = alpha * 0.68;
    ctx.fillStyle = this.theme.beamCore;
    ctx.fillRect(Math.round(shipX - w * 0.42), topY, Math.round(w * 0.84), h);

    // Horizontale Energie-Ringe im Strahl
    ctx.globalAlpha = alpha * 0.85;
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 3; i++) {
      const ry = bottomY - ((t * 75 + i * 24) % h);
      ctx.fillRect(Math.round(shipX - w * 0.72), Math.round(ry), Math.round(w * 1.44), 1.5);
    }

    // Spieler-Sprite materialisiert sich und beamt mit Blickrichtung zum Dock hinein
    const hd = getHDArt();
    const hero = hd.heroUp ?? hd.heroDown;
    const dropT = easeInOutQuad((t - 3.1) / 0.96);
    if (hero && t >= 3.1 && dropT < 1) {
      const hy = bottomY - 4 - dropT * (h - 6);
      const hs = 20 * (1 - dropT * 0.35);
      ctx.globalAlpha = (1 - Math.max(0, (dropT - 0.72) / 0.28)) * 0.96;
      ctx.drawImage(hero, Math.round(shipX - hs / 2), Math.round(hy - hs / 2), Math.round(hs), Math.round(hs));
    }

    // Leuchtender Aufschlag-Ring am Dock
    ctx.globalAlpha = alpha * 0.75;
    ctx.fillStyle = this.theme.beamCore;
    ctx.beginPath();
    ctx.ellipse(shipX, topY + 2, 15 * beamT, 4 * beamT, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private renderShip(
    ctx: CanvasRenderingContext2D,
    ship: { x: number; y: number; scale: number; tilt: number; thrust: number },
  ): void {
    const hd = getHDArt();
    const sprite = hd[this.theme.shipKey];

    ctx.save();
    ctx.translate(Math.round(ship.x), Math.round(ship.y));
    ctx.rotate(ship.tilt);
    ctx.scale(ship.scale, ship.scale);

    // Weicher Triebwerks-Glow hinter dem Heck
    const glowR = 22 + ship.thrust * 18 + Math.sin(this.elapsed * 32) * 3;
    const g = ctx.createRadialGradient(0, 24, 2, 0, 24, glowR);
    g.addColorStop(0, this.theme.thruster);
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.globalAlpha = 0.42 + ship.thrust * 0.35;
    ctx.fillStyle = g;
    ctx.fillRect(-glowR, 24 - glowR, glowR * 2, glowR * 2);

    // Subtile Boost-Verlängerung der Triebwerksflammen bei hohem Schub
    if (ship.thrust > 0.28) {
      const boost = (ship.thrust - 0.28) / 0.87;
      const flameH = 5 + boost * 14 + Math.sin(this.elapsed * 45) * 2;
      ctx.globalAlpha = 0.72 * boost;
      ctx.fillStyle = this.theme.thruster;
      ctx.fillRect(-10, 23, 4.5, flameH);
      ctx.fillRect(5.5, 23, 4.5, flameH);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-8.8, 23, 2, flameH * 0.5);
      ctx.fillRect(6.8, 23, 2, flameH * 0.5);
    }
    ctx.globalAlpha = 1;

    if (sprite) {
      const w = 52;
      const h = Math.round((sprite.height / Math.max(1, sprite.width)) * w);
      ctx.drawImage(sprite, Math.round(-w / 2), Math.round(-h / 2), w, h);
    } else {
      ctx.fillStyle = '#cbd5e1';
      ctx.beginPath();
      ctx.moveTo(0, -24);
      ctx.lineTo(18, 18);
      ctx.lineTo(0, 12);
      ctx.lineTo(-18, 18);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = this.theme.accent;
      ctx.fillRect(-4, -10, 8, 10);
    }

    ctx.restore();
  }

  private renderTitleCard(ctx: CanvasRenderingContext2D, t: number): void {
    if (t < 1.25 || t > 4.1) return;
    const fadeIn = easeOutCubic((t - 1.25) / 0.42);
    const fadeOut = t > 3.6 ? 1 - clamp01((t - 3.6) / 0.45) : 1;
    const alpha = fadeIn * fadeOut;
    if (alpha <= 0.01) return;

    const slideY = (1 - fadeIn) * 8;
    const y = Math.round(196 + slideY);

    ctx.save();
    ctx.globalAlpha = alpha;

    // Halbtransparente Kino-Plakette
    const boxW = 286;
    const boxH = this.config.isNightRun ? 48 : 38;
    const bx = Math.round((VIRTUAL_WIDTH - boxW) / 2);
    const by = y - 6;

    ctx.fillStyle = 'rgba(6, 11, 22, 0.76)';
    ctx.fillRect(bx, by, boxW, boxH);
    ctx.strokeStyle = this.theme.accent;
    ctx.lineWidth = 1;
    ctx.strokeRect(bx + 0.5, by + 0.5, boxW - 1, boxH - 1);

    // Eyebrow
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = 'bold 7px monospace';
    ctx.fillStyle = this.theme.accent;
    ctx.fillText(this.theme.eyebrow, VIRTUAL_WIDTH / 2, by + 5);

    // Haupttitel
    ctx.font = 'bold 12px monospace';
    ctx.fillStyle = '#f8fafc';
    ctx.fillText(this.theme.title, VIRTUAL_WIDTH / 2, by + 14);

    // Untertitel
    ctx.font = '7px monospace';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(this.theme.subtitle, VIRTUAL_WIDTH / 2, by + 28);

    // Optionales Nacht-Run-Badge
    if (this.config.isNightRun) {
      ctx.font = 'bold 7px monospace';
      ctx.fillStyle = '#fbbf24';
      ctx.fillText('🌙 NACHT-EXPEDITION · +35 % BEUTE', VIRTUAL_WIDTH / 2, by + 37);
    }

    ctx.restore();
  }
}
