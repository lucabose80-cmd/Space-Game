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
  shipBankKey: 'shipCorvetteBank' | 'shipCrystalBank' | 'shipSolarBank' | 'shipMonolithBank';
  bgKey: 'cutsceneBgS1' | 'cutsceneBgS2' | 'cutsceneBgS3' | 'cutsceneBgS4' | 'cutsceneBgS5';
}

interface Star {
  x: number;
  y: number;
  layer: number;
  size: number;
  twinkleOffset: number;
  tint: string;
}

interface Asteroid {
  x: number;
  y: number;
  size: number;
  speed: number;
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

const TOTAL_DURATION = 4.35;
const SCENE_SPLIT = 1.75; // 0..1.75 s = Tiefraum-Flug · 1.75..4.35 s = Sektor-Anflug & Einflug in die Schleuse
const SKIP_LOCK_SEC = 0.28;

const SECTOR_THEMES: Record<SectorId, SectorTheme> = {
  1: {
    eyebrow: 'SEKTOR I · DOCK-ANFLUG',
    title: 'VERLASSENE KORVETTE',
    subtitle: 'Treibendes Wrack · Signal des Echos geortet',
    bgTop: '#060c18',
    bgBottom: '#102033',
    nebulaA: 'rgba(56, 200, 212, 0.20)',
    nebulaB: 'rgba(245, 158, 11, 0.16)',
    accent: '#38e8d4',
    accentSoft: '#7dd3fc',
    beamCore: '#d8ffff',
    thruster: '#38e8d4',
    shipKey: 'shipCorvette',
    shipBankKey: 'shipCorvetteBank',
    bgKey: 'cutsceneBgS1',
  },
  2: {
    eyebrow: 'SEKTOR II · KRISTALL-KURS',
    title: 'KRISTALL-NEBEL',
    subtitle: 'Singende Adern · Resonanzfeld stabil',
    bgTop: '#0c0720',
    bgBottom: '#1c1138',
    nebulaA: 'rgba(192, 132, 252, 0.24)',
    nebulaB: 'rgba(34, 211, 238, 0.18)',
    accent: '#c084fc',
    accentSoft: '#67e8f9',
    beamCore: '#f5d0fe',
    thruster: '#a855f7',
    shipKey: 'shipCrystal',
    shipBankKey: 'shipCrystalBank',
    bgKey: 'cutsceneBgS2',
  },
  3: {
    eyebrow: 'SEKTOR III · ORBITAL-ANFLUG',
    title: 'SOLAR-GIESSEREI',
    subtitle: 'Korona-Hitze · Schmelzschilde aktiv',
    bgTop: '#160908',
    bgBottom: '#2d120a',
    nebulaA: 'rgba(251, 146, 60, 0.24)',
    nebulaB: 'rgba(239, 68, 68, 0.18)',
    accent: '#fb923c',
    accentSoft: '#fde047',
    beamCore: '#fef08a',
    thruster: '#f97316',
    shipKey: 'shipSolar',
    shipBankKey: 'shipSolarBank',
    bgKey: 'cutsceneBgS3',
  },
  4: {
    eyebrow: 'SEKTOR IV · ASTRAL-SPRUNG',
    title: 'ÄLTESTEN-MONOLITH',
    subtitle: 'Obsidian-Kammern · Uralte Siegel erwachen',
    bgTop: '#050814',
    bgBottom: '#12182d',
    nebulaA: 'rgba(250, 204, 21, 0.16)',
    nebulaB: 'rgba(56, 189, 248, 0.18)',
    accent: '#facc15',
    accentSoft: '#7dd3fc',
    beamCore: '#fef9c3',
    thruster: '#38bdf8',
    shipKey: 'shipMonolith',
    shipBankKey: 'shipMonolithBank',
    bgKey: 'cutsceneBgS4',
  },
  5: {
    eyebrow: '5. TOR · TIEFENRAUM-RISS',
    title: 'OMEGA-ANOMALIE',
    subtitle: 'Jenseits der vier Siegel · Raumzeit instabil',
    bgTop: '#0b0518',
    bgBottom: '#220b34',
    nebulaA: 'rgba(232, 121, 249, 0.24)',
    nebulaB: 'rgba(250, 204, 21, 0.16)',
    accent: '#e879f9',
    accentSoft: '#fde047',
    beamCore: '#fae8ff',
    thruster: '#e879f9',
    shipKey: 'shipMonolith',
    shipBankKey: 'shipMonolithBank',
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
 * 2-Szenen-Sektor-Anflug (Hangar → Dungeon):
 * Szene 1 (0.00–1.75 s): Freier Tiefraum-Flug — Schiff fliegt mit echtem 3/4-Schräglagen-Sprite
 *                        diagonal durch Nebel, Parallax-Sterne & Asteroiden.
 * Szene 2 (1.75–4.35 s): Schnitt auf den lebendigen Sektor — weite Annäherungskurve mit echtem
 *                        Schräglagen-Sprite → Einflug direkt in die leuchtende Schleuse →
 *                        Übergang in den Dungeon-Startraum (dort landet dann die Drop-Pod-Kapsel!).
 */
export class SectorApproachCutscene {
  public readonly config: SectorApproachConfig;
  public elapsed = 0;
  public finished = false;
  public skipped = false;

  private readonly theme: SectorTheme;
  private readonly stars: Star[] = [];
  private readonly asteroids: Asteroid[] = [];
  private readonly particles: ExhaustParticle[] = [];
  private readonly rng: () => number;
  private playedWhoosh = false;
  private playedArrival = false;
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
    for (let i = 0; i < 96; i++) {
      const layer = i < 44 ? 0 : i < 74 ? 1 : 2;
      this.stars.push({
        x: this.rng() * VIRTUAL_WIDTH,
        y: this.rng() * VIRTUAL_HEIGHT,
        layer,
        size: layer === 2 ? 2 : 1,
        twinkleOffset: this.rng() * Math.PI * 2,
        tint: tints[Math.floor(this.rng() * tints.length)]!,
      });
    }
    const rockColors = ['#334155', '#475569', '#1e293b'];
    for (let i = 0; i < 12; i++) {
      this.asteroids.push({
        x: this.rng() * VIRTUAL_WIDTH,
        y: 26 + this.rng() * (VIRTUAL_HEIGHT - 52),
        size: 3 + Math.floor(this.rng() * 5),
        speed: 35 + this.rng() * 75,
        tint: rockColors[i % rockColors.length]!,
      });
    }
  }

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

    if (!this.playedArrival && this.elapsed >= SCENE_SPLIT) {
      this.playedArrival = true;
      this.particles.length = 0; // frischer Szenenschnitt
      sound.playWarp();
    }

    // Sterne & Asteroiden je nach Szene
    const inDeepSpace = this.elapsed < SCENE_SPLIT;
    for (const s of this.stars) {
      const mult = s.layer === 0 ? 0.35 : s.layer === 1 ? 0.72 : 1.35;
      if (inDeepSpace) {
        // Schneller Diagonal-Flug von rechts-oben nach links-unten (entgegen der Flugrichtung!)
        s.x -= 210 * mult * dt;
        s.y += 110 * mult * dt;
      } else {
        s.y += 18 * mult * dt;
      }
      if (s.x < -14) s.x += VIRTUAL_WIDTH + 28;
      if (s.y > VIRTUAL_HEIGHT + 14) s.y -= VIRTUAL_HEIGHT + 28;
    }

    if (inDeepSpace) {
      for (const a of this.asteroids) {
        a.x -= a.speed * 1.45 * dt;
        a.y += a.speed * 0.75 * dt;
        if (a.x < -16) {
          a.x = VIRTUAL_WIDTH + 16;
          a.y = 24 + this.rng() * (VIRTUAL_HEIGHT - 48);
        }
        if (a.y > VIRTUAL_HEIGHT + 16) a.y = -16;
      }
    }

    this.updateParticles(dt, inDeepSpace);

    if (this.elapsed >= TOTAL_DURATION) {
      this.finished = true;
      return true;
    }
    return false;
  }

  private getDeepSpaceShip(): { x: number; y: number; scale: number } {
    const u = easeInOutQuad(this.elapsed / SCENE_SPLIT);
    // Weiter, dynamischer Diagonal-Bogen von links-unten nach rechts-oben
    const bx = cubicBezier(u, -24, 155, 310, VIRTUAL_WIDTH + 34);
    const by = cubicBezier(u, 232, 168, 128, 44);
    return { x: bx.v, y: by.v, scale: 1.02 + Math.sin(u * Math.PI) * 0.14 };
  }

  private getApproachShip(): {
    x: number;
    y: number;
    scale: number;
    pose: 'bank_left' | 'straight';
    alpha: number;
  } {
    const localT = Math.max(0, this.elapsed - SCENE_SPLIT);
    const dur = TOTAL_DURATION - SCENE_SPLIT - 0.2;
    const u = easeInOutQuad(localT / dur);
    // Schiff kommt groß aus der rechten-unteren Flanke, schwenkt in einer Linkskurve direkt in die Schleuse (240, 118)!
    const bx = cubicBezier(u, 428, 368, 255, VIRTUAL_WIDTH * 0.5);
    const by = cubicBezier(u, 254, 195, 162, 118);
    const scale = 1.18 - 0.88 * u; // echte Tiefen-Perspektive bis in die Schleuse hinein!
    const pose: 'bank_left' | 'straight' = u < 0.62 ? 'bank_left' : 'straight';
    const alpha = u > 0.84 ? 1 - clamp01((u - 0.84) / 0.16) : 1;
    return { x: bx.v, y: by.v, scale, pose, alpha };
  }

  private updateParticles(dt: number, inDeepSpace: boolean): void {
    this.spawnAcc += dt * (inDeepSpace ? 68 : 42);
    while (this.spawnAcc >= 1) {
      this.spawnAcc -= 1;
      if (inDeepSpace) {
        const s = this.getDeepSpaceShip();
        this.particles.push({
          x: s.x - 18 + (this.rng() - 0.5) * 6,
          y: s.y + 14 + (this.rng() - 0.5) * 6,
          vx: -115 - this.rng() * 65,
          vy: 62 + this.rng() * 45,
          life: 0,
          maxLife: 0.28 + this.rng() * 0.2,
          size: this.rng() < 0.45 ? 2.2 : 1.5,
          color: this.rng() < 0.35 ? '#ffffff' : this.theme.thruster,
        });
      } else {
        const s = this.getApproachShip();
        if (s.alpha > 0.1) {
          const tailDx = s.pose === 'bank_left' ? 14 * s.scale : (this.rng() < 0.5 ? -7 : 7) * s.scale;
          const tailDy = 14 * s.scale;
          this.particles.push({
            x: s.x + tailDx + (this.rng() - 0.5) * 3,
            y: s.y + tailDy + (this.rng() - 0.5) * 3,
            vx: s.pose === 'bank_left' ? 45 + this.rng() * 35 : (this.rng() - 0.5) * 14,
            vy: 42 + this.rng() * 38,
            life: 0,
            maxLife: 0.26 + this.rng() * 0.16,
            size: Math.max(1, 2 * s.scale),
            color: this.rng() < 0.35 ? '#ffffff' : this.theme.thruster,
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
    const inDeepSpace = t < SCENE_SPLIT;
    const hd = getHDArt();

    ctx.save();

    if (inDeepSpace) {
      // === SZENE 1: FREIER TIEFRAUM-FLUG ===
      const bgGrad = ctx.createLinearGradient(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
      bgGrad.addColorStop(0, this.theme.bgTop);
      bgGrad.addColorStop(1, this.theme.bgBottom);
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

      // Große vorbeiziehende Nebelwolken
      this.drawNebula(ctx, 380 - t * 65, 95 + t * 28, 165, this.theme.nebulaA);
      this.drawNebula(ctx, 160 - t * 40, 185 + t * 18, 145, this.theme.nebulaB);

      // Diagonale Warp-Sterne
      for (const s of this.stars) {
        ctx.globalAlpha = s.layer === 0 ? 0.45 : s.layer === 1 ? 0.78 : 0.95;
        ctx.fillStyle = s.tint;
        if (s.layer >= 1) {
          ctx.strokeStyle = s.tint;
          ctx.lineWidth = s.size;
          const len = s.layer === 2 ? 18 : 9;
          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(s.x + len, s.y - len * 0.52);
          ctx.stroke();
        } else {
          ctx.fillRect(Math.round(s.x), Math.round(s.y), 1, 1);
        }
      }
      ctx.globalAlpha = 1;

      // Vorbeiziehende Asteroiden / Wrackbrocken
      for (const a of this.asteroids) {
        ctx.fillStyle = a.tint;
        ctx.fillRect(Math.round(a.x), Math.round(a.y), a.size, Math.max(2, a.size - 1));
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.fillRect(Math.round(a.x), Math.round(a.y), Math.max(1, a.size - 2), 1);
      }

      // Triebwerks-Partikel
      this.renderParticles(ctx);

      // Echtes 3/4-Schräglagen-Sprite fliegt diagonal nach rechts-oben!
      const ds = this.getDeepSpaceShip();
      const bankSpr = hd[this.theme.shipBankKey] ?? hd[this.theme.shipKey];
      if (bankSpr) {
        this.drawGlowDot(ctx, ds.x - 16, ds.y + 14, 30, this.theme.thruster, 0.55);
        const w = Math.round(66 * ds.scale);
        const h = Math.round(66 * ds.scale);
        ctx.drawImage(bankSpr, Math.round(ds.x - w / 2), Math.round(ds.y - h / 2), w, h);
      }
    } else {
      // === SZENE 2: ANFLUG & EINFLUG IN DEN LEBENDIGEN SEKTOR ===
      const localT = t - SCENE_SPLIT;
      const customBg = hd[this.theme.bgKey];
      const camPanX = Math.sin(localT * 0.9) * 5.0;
      const camPanY = Math.cos(localT * 0.65) * 2.8;
      if (customBg) {
        const zoom = 1.03 + easeInOutQuad(localT / (TOTAL_DURATION - SCENE_SPLIT)) * 0.12;
        const w = VIRTUAL_WIDTH * zoom;
        const h = VIRTUAL_HEIGHT * zoom;
        ctx.drawImage(
          customBg,
          (VIRTUAL_WIDTH - w) / 2 + camPanX,
          (VIRTUAL_HEIGHT - h) / 2 + camPanY,
          w,
          h,
        );
        this.renderLiveSectorOverlay(ctx, camPanX, camPanY, t);
      } else {
        ctx.fillStyle = this.theme.bgTop;
        ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
      }

      // Sanfte Sterne
      for (const s of this.stars) {
        const tw = 0.55 + 0.45 * Math.sin(t * 3 + s.twinkleOffset);
        ctx.globalAlpha = (s.layer === 0 ? 0.35 : 0.72) * tw;
        ctx.fillStyle = s.tint;
        ctx.fillRect(Math.round(s.x), Math.round(s.y), s.size, s.size);
      }
      ctx.globalAlpha = 1;

      this.renderParticles(ctx);

      // Schiff schwenkt mit echtem Schräglagen-Sprite (gespiegelt nach links-oben) in die Schleuse hinein!
      const ap = this.getApproachShip();
      if (ap.alpha > 0.01) {
        ctx.save();
        ctx.globalAlpha = ap.alpha;
        ctx.translate(Math.round(ap.x), Math.round(ap.y));
        const useBank = ap.pose === 'bank_left' && hd[this.theme.shipBankKey];
        const spr = useBank ? hd[this.theme.shipBankKey] : hd[this.theme.shipKey];
        if (useBank) ctx.scale(-1, 1); // gespiegelt = elegante Linkskurve nach links-oben!
        if (spr) {
          const baseW = useBank ? 62 : 52;
          const w = Math.round(baseW * ap.scale);
          const h = Math.round((spr.height / Math.max(1, spr.width)) * w);
          ctx.drawImage(spr, Math.round(-w / 2), Math.round(-h / 2), w, h);
        }
        ctx.restore();
      }

      // Aufleuchten der Schleuse beim Einflug des Schiffs (letzte 0.65 s)
      if (t > TOTAL_DURATION - 0.75) {
        const p = clamp01((t - (TOTAL_DURATION - 0.75)) / 0.5);
        this.drawGlowDot(ctx, VIRTUAL_WIDTH * 0.5 + camPanX, 118 + camPanY, 22 + p * 30, this.theme.beamCore, Math.sin(p * Math.PI) * 0.9);
      }
    }

    // Szenenschnitt-Blitz zwischen Szene 1 und Szene 2
    const splitDist = Math.abs(t - SCENE_SPLIT);
    if (splitDist < 0.16) {
      const f = 1 - splitDist / 0.16;
      ctx.fillStyle = `rgba(216, 250, 255, ${f * 0.78})`;
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    }

    // Kino-Balken (Letterbox)
    const barSlide = easeOutCubic(t / 0.4);
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

    // Sektor-Titelkarte in Szene 2
    this.renderTitleCard(ctx, t);

    // Skip-Hinweis
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

    // Ein- & Ausblenden
    if (t < 0.22) {
      ctx.fillStyle = `rgba(10, 18, 30, ${1 - t / 0.22})`;
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    } else if (t > TOTAL_DURATION - 0.35) {
      const f = clamp01((t - (TOTAL_DURATION - 0.35)) / 0.35);
      ctx.fillStyle = `rgba(10, 18, 30, ${f})`;
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    }

    ctx.restore();
  }

  private renderParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, 1 - p.life / p.maxLife) * 0.9;
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x - p.size / 2), Math.round(p.y - p.size / 2), p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  private renderLiveSectorOverlay(
    ctx: CanvasRenderingContext2D,
    ox: number,
    oy: number,
    t: number,
  ): void {
    const s = this.config.sector;
    ctx.save();
    ctx.translate(ox, oy);

    if (s === 1) {
      if (Math.sin(t * 7.5) > 0) {
        this.drawGlowDot(ctx, 124, 52, 9, '#ef4444', 0.85);
        this.drawGlowDot(ctx, 358, 52, 9, '#ef4444', 0.85);
        this.drawGlowDot(ctx, 203, 102, 7, '#f87171', 0.7);
      }
      if (Math.sin(t * 19) > -0.2) {
        ctx.strokeStyle = 'rgba(103, 232, 249, 0.85)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(334, 56);
        ctx.lineTo(324 + Math.sin(t * 41) * 4, 82);
        ctx.lineTo(312 + Math.cos(t * 37) * 4, 108);
        ctx.stroke();
        this.drawGlowDot(ctx, 314, 106, 16, '#38e8d4', 0.45);
      }
      this.drawGlowDot(ctx, 240, 122, 26, '#fbbf24', 0.35 + 0.35 * Math.sin(t * 6));
    } else if (s === 2) {
      const glints: Array<[number, number, string]> = [
        [240, 38, '#f0abfc'],
        [198, 62, '#67e8f9'],
        [284, 60, '#c084fc'],
        [168, 78, '#e879f9'],
        [312, 82, '#38bdf8'],
      ];
      for (let i = 0; i < glints.length; i++) {
        const [gx, gy, col] = glints[i]!;
        this.drawGlowDot(ctx, gx, gy, 10, col, 0.25 + 0.65 * Math.max(0, Math.sin(t * 4.5 + i * 1.4)));
      }
      this.drawGlowDot(ctx, 240, 122, 32, '#22d3ee', 0.28 + 0.22 * Math.sin(t * 5));
    } else if (s === 3) {
      this.drawGlowDot(ctx, 240, 26, 90, '#fb923c', 0.22 + 0.14 * Math.sin(t * 4));
      this.drawGlowDot(ctx, 240, 134, 28, '#fde047', 0.25 + 0.2 * Math.sin(t * 7));
      for (let i = 0; i < 14; i++) {
        const ex = (i * 39 + Math.sin(t * 1.5 + i) * 18) % VIRTUAL_WIDTH;
        const ey = VIRTUAL_HEIGHT - ((t * (26 + (i % 4) * 9) + i * 29) % VIRTUAL_HEIGHT);
        ctx.fillStyle = i % 2 === 0 ? '#fde047' : '#fb923c';
        ctx.globalAlpha = 0.75;
        ctx.fillRect(Math.round(ex), Math.round(ey), 2, 2);
      }
      ctx.globalAlpha = 1;
    } else if (s === 4) {
      for (let i = 0; i < 6; i++) {
        const ang = t * 1.2 + (i * Math.PI) / 3;
        this.drawGlowDot(ctx, 240 + Math.cos(ang) * 108, 68 + Math.sin(ang) * 28, 7, '#facc15', 0.75);
      }
      this.drawGlowDot(ctx, 240, 114, 28, '#38bdf8', 0.32 + 0.24 * Math.sin(t * 5.5));
    } else {
      this.drawGlowDot(ctx, 240, 62, 42, '#e879f9', 0.35 + 0.25 * Math.sin(t * 6.5));
      if (Math.sin(t * 17) > 0) {
        ctx.strokeStyle = 'rgba(250, 232, 255, 0.75)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        const a0 = t * 1.6;
        ctx.moveTo(240 + Math.cos(a0) * 68, 64 + Math.sin(a0) * 28);
        ctx.lineTo(240 + Math.cos(a0 + 0.6) * 46, 64 + Math.sin(a0 + 0.6) * 22);
        ctx.lineTo(240 + Math.cos(a0 + 1.2) * 72, 64 + Math.sin(a0 + 1.2) * 30);
        ctx.stroke();
      }
    }

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

  private drawNebula(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
    const g = ctx.createRadialGradient(x, y, 4, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  private renderTitleCard(ctx: CanvasRenderingContext2D, t: number): void {
    if (t < SCENE_SPLIT + 0.15 || t > TOTAL_DURATION - 0.35) return;
    const fadeIn = easeOutCubic((t - (SCENE_SPLIT + 0.15)) / 0.35);
    const fadeOut = t > TOTAL_DURATION - 0.75 ? 1 - clamp01((t - (TOTAL_DURATION - 0.75)) / 0.38) : 1;
    const alpha = fadeIn * fadeOut;
    if (alpha <= 0.01) return;

    const slideY = (1 - fadeIn) * 8;
    const y = Math.round(196 + slideY);

    ctx.save();
    ctx.globalAlpha = alpha;

    const boxW = 286;
    const boxH = this.config.isNightRun ? 48 : 38;
    const bx = Math.round((VIRTUAL_WIDTH - boxW) / 2);
    const by = y - 6;

    ctx.fillStyle = 'rgba(6, 11, 22, 0.78)';
    ctx.fillRect(bx, by, boxW, boxH);
    ctx.strokeStyle = this.theme.accent;
    ctx.lineWidth = 1;
    ctx.strokeRect(bx + 0.5, by + 0.5, boxW - 1, boxH - 1);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = 'bold 7px monospace';
    ctx.fillStyle = this.theme.accent;
    ctx.fillText(this.theme.eyebrow, VIRTUAL_WIDTH / 2, by + 5);

    ctx.font = 'bold 12px monospace';
    ctx.fillStyle = '#f8fafc';
    ctx.fillText(this.theme.title, VIRTUAL_WIDTH / 2, by + 14);

    ctx.font = '7px monospace';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(this.theme.subtitle, VIRTUAL_WIDTH / 2, by + 28);

    if (this.config.isNightRun) {
      ctx.font = 'bold 7px monospace';
      ctx.fillStyle = '#fbbf24';
      ctx.fillText('🌙 NACHT-EXPEDITION · +35 % BEUTE', VIRTUAL_WIDTH / 2, by + 37);
    }

    ctx.restore();
  }
}
