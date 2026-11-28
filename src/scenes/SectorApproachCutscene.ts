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

interface TrailPoint {
  lx: number;
  ly: number;
  rx: number;
  ry: number;
  age: number;
}

const TOTAL_DURATION = 4.7;
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

/** Kubische Bézier-Position + Ableitung für dynamischen Kurvenflug */
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
 * Phase 1 (0.0–2.1 s): Dynamischer S-Kurven-Anflug mit Banking, RCS-Steuerdüsen, gekrümmten
 *                      Triebwerksspuren & lebendig animiertem Sektor-Hintergrund.
 * Phase 2 (1.5–3.7 s): Ausrichten vor der Andock-Schleuse + Kino-Titelkarte.
 * Phase 3 (2.95–4.7 s): Absetzkapsel (Drop-Pod) wird abgefeuert, bremst in der Schleuse ab & landet → Dungeon.
 */
export class SectorApproachCutscene {
  public readonly config: SectorApproachConfig;
  public elapsed = 0;
  public finished = false;
  public skipped = false;

  private readonly theme: SectorTheme;
  private readonly stars: Star[] = [];
  private readonly particles: ExhaustParticle[] = [];
  private readonly trail: TrailPoint[] = [];
  private readonly rng: () => number;
  private playedWhoosh = false;
  private playedPodLaunch = false;
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
    for (let i = 0; i < 92; i++) {
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

    if (!this.playedPodLaunch && this.elapsed >= 2.95) {
      this.playedPodLaunch = true;
      sound.playPodLaunch();
    }

    // Parallax-Sterne: diagonal + abbremsend während des Kurvenflugs
    const warpFactor = 1 - easeOutCubic(this.elapsed / 1.9);
    const baseSpeed = 16 + warpFactor * 240;
    const ship = this.getShipState();
    const driftX = -ship.bank * 42 * warpFactor;
    for (const s of this.stars) {
      const mult = s.layer === 0 ? 0.35 : s.layer === 1 ? 0.72 : 1.35;
      s.y += baseSpeed * mult * dt;
      s.x += driftX * mult * dt;
      if (s.y > VIRTUAL_HEIGHT + 12) {
        s.y = -12;
        s.x = this.rng() * VIRTUAL_WIDTH;
      }
      if (s.x < -10) s.x += VIRTUAL_WIDTH + 20;
      if (s.x > VIRTUAL_WIDTH + 10) s.x -= VIRTUAL_WIDTH + 20;
    }

    // Triebwerks-Ribbon-Spur aufzeichnen
    this.recordTrail(dt, ship);
    this.updateParticles(dt, warpFactor, ship);

    if (this.elapsed >= TOTAL_DURATION) {
      this.finished = true;
      return true;
    }
    return false;
  }

  private getShipState(): {
    x: number;
    y: number;
    scale: number;
    heading: number;
    bank: number;
    thrust: number;
  } {
    const t = this.elapsed;
    if (t < 2.25) {
      // Dynamischer S-Kurven-Anflug: links-unten → weiter Schwung nach rechts → elegante Linkskurve vors Dock
      const u = easeOutCubic(t / 2.25);
      const bx = cubicBezier(u, 96, 375, 315, VIRTUAL_WIDTH * 0.5);
      const by = cubicBezier(u, 298, 255, 198, 174);
      // Tangenten-Winkel (0 = gerade nach oben)
      const rawHeading = Math.atan2(bx.dv, -Math.max(20, -by.dv));
      const heading = Math.max(-0.55, Math.min(0.55, rawHeading * (1 - u * 0.65)));
      const bank = Math.max(-1, Math.min(1, heading * 2.1));
      const scale = 1.08 - 0.32 * u;
      const thrust = clamp01(1.18 - u * 0.85);
      return { x: bx.v, y: by.v, scale, heading, bank, thrust };
    }

    // Ruhiges Ausrichten & leichtes Zurückweichen nach Kapsel-Abschuss
    const hoverT = t - 2.25;
    const recoil = t >= 2.95 ? Math.sin(clamp01((t - 2.95) / 0.35) * Math.PI) * 5.5 : 0;
    const x = VIRTUAL_WIDTH * 0.5 + Math.sin(hoverT * 2.2) * 2.4;
    const y = 174 + Math.cos(hoverT * 2.9) * 1.3 + recoil;
    const heading = Math.cos(hoverT * 2.2) * 0.03;
    return { x, y, scale: 0.76, heading, bank: heading * 2, thrust: 0.32 };
  }

  private recordTrail(
    dt: number,
    ship: { x: number; y: number; scale: number; heading: number; bank: number; thrust: number },
  ): void {
    const cos = Math.cos(ship.heading);
    const sin = Math.sin(ship.heading);
    const sx = 1 - Math.abs(ship.bank) * 0.22;
    const toWorld = (lx: number, ly: number) => ({
      x: ship.x + (lx * sx * cos - ly * sin) * ship.scale,
      y: ship.y + (lx * sx * sin + ly * cos) * ship.scale,
    });
    const left = toWorld(-8.5, 22);
    const right = toWorld(8.5, 22);
    this.trail.push({ lx: left.x, ly: left.y, rx: right.x, ry: right.y, age: 0 });
    for (let i = this.trail.length - 1; i >= 0; i--) {
      this.trail[i]!.age += dt;
      if (this.trail[i]!.age > 0.58) this.trail.splice(i, 1);
    }
  }

  private updateParticles(
    dt: number,
    warpFactor: number,
    ship: { x: number; y: number; scale: number; heading: number; bank: number; thrust: number },
  ): void {
    const cos = Math.cos(ship.heading);
    const sin = Math.sin(ship.heading);
    this.spawnAcc += dt * (24 + warpFactor * 60);
    while (this.spawnAcc >= 1) {
      this.spawnAcc -= 1;
      const side = this.rng() < 0.5 ? -8.5 : 8.5;
      const px = ship.x + (side * cos - 23 * sin) * ship.scale;
      const py = ship.y + (side * sin + 23 * cos) * ship.scale;
      const speed = 55 + warpFactor * 155 + this.rng() * 35;
      this.particles.push({
        x: px + (this.rng() - 0.5) * 2.5,
        y: py + (this.rng() - 0.5) * 2.5,
        vx: -sin * speed + (this.rng() - 0.5) * 14,
        vy: cos * speed + (this.rng() - 0.5) * 14,
        life: 0,
        maxLife: 0.26 + this.rng() * 0.24,
        size: this.rng() < 0.4 ? 2 : 1.5,
        color: this.rng() < 0.35 ? '#ffffff' : this.theme.thruster,
      });
    }

    // RCS-Steuerdüsen an den Flügelspitzen während starker Kurven
    if (Math.abs(ship.bank) > 0.26 && this.rng() < dt * 26) {
      const wingSide = ship.bank > 0 ? -20 : 20;
      const wx = ship.x + (wingSide * cos - 4 * sin) * ship.scale;
      const wy = ship.y + (wingSide * sin + 4 * cos) * ship.scale;
      this.particles.push({
        x: wx,
        y: wy,
        vx: wingSide * 1.4,
        vy: 14,
        life: 0,
        maxLife: 0.18,
        size: 1.5,
        color: '#e0f2fe',
      });
    }

    // Absetzkapsel-Funken & Bremsdüsen-Partikel (2.95..4.1 s)
    if (this.elapsed >= 2.95 && this.elapsed <= 4.15 && this.rng() < dt * 65) {
      const podT = easeInOutQuad((this.elapsed - 2.95) / 0.92);
      const podY = 160 + (116 - 160) * podT;
      this.particles.push({
        x: VIRTUAL_WIDTH * 0.5 + (this.rng() - 0.5) * 10,
        y: podY + 8,
        vx: (this.rng() - 0.5) * 26,
        vy: 28 + this.rng() * 44,
        life: 0,
        maxLife: 0.28 + this.rng() * 0.18,
        size: this.rng() < 0.5 ? 2 : 1.5,
        color: this.rng() < 0.4 ? '#ffffff' : this.theme.accent,
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
    const warpFactor = 1 - easeOutCubic(t / 1.9);
    const hd = getHDArt();

    ctx.save();

    // 1. Dynamischer, leicht driftender & heranzoomender Sektor-Hintergrund
    const customBg = hd[this.theme.bgKey];
    const camPanX = Math.sin(t * 0.72) * 5.5;
    const camPanY = Math.cos(t * 0.52) * 3.0;
    if (customBg) {
      const zoom = 1.03 + easeInOutQuad(t / TOTAL_DURATION) * 0.09;
      const w = VIRTUAL_WIDTH * zoom;
      const h = VIRTUAL_HEIGHT * zoom;
      ctx.drawImage(
        customBg,
        (VIRTUAL_WIDTH - w) / 2 + camPanX,
        (VIRTUAL_HEIGHT - h) / 2 + camPanY,
        w,
        h,
      );
      // Sektor-spezifische lebendige Animationen direkt auf dem Vista!
      this.renderLiveSectorOverlay(ctx, camPanX, camPanY, t);

      const veil = ctx.createLinearGradient(0, 0, 0, VIRTUAL_HEIGHT);
      veil.addColorStop(0, 'rgba(6, 10, 20, 0.12)');
      veil.addColorStop(0.65, 'rgba(6, 10, 20, 0.08)');
      veil.addColorStop(1, 'rgba(6, 10, 20, 0.48)');
      ctx.fillStyle = veil;
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    } else {
      const bgGrad = ctx.createLinearGradient(0, 0, 0, VIRTUAL_HEIGHT);
      bgGrad.addColorStop(0, this.theme.bgTop);
      bgGrad.addColorStop(1, this.theme.bgBottom);
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
      this.drawNebula(ctx, 118 + camPanX, 72 + t * 4, 130, this.theme.nebulaA);
      this.drawNebula(ctx, 368 + camPanX, 128 + t * 3, 145, this.theme.nebulaB);
    }

    // 2. Parallax-Sterne & Warp-Streifen
    this.renderStars(ctx, warpFactor);

    // 3. Gekrümmte Zwillings-Triebwerksspuren im Raum
    this.renderTrail(ctx);

    // 4. Triebwerks- & Kapsel-Partikel
    for (const p of this.particles) {
      const alpha = 1 - p.life / p.maxLife;
      ctx.globalAlpha = alpha * 0.9;
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x - p.size / 2), Math.round(p.y - p.size / 2), p.size, p.size);
    }
    ctx.globalAlpha = 1;

    // 5. Absetzkapsel (Drop-Pod) Abschuss, Flug & Landung in der Schleuse (Phase 3)
    const ship = this.getShipState();
    this.renderDropPodSequence(ctx, ship.x, ship.y, camPanX, camPanY, t);

    // 6. Echtes Sektor-Schiff mit Kurven-Neigung & Banking
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

    // 8. Sektor-Titelkarte (1.35..4.15 s)
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

    // 10. Sanftes Einblenden & Übergang in den Dungeon
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

  /** Sektor-spezifische lebendige Animationen (Lichter, Blitze, Splitter, Glut, Ringe) auf dem Vista */
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
      // Blinkende rote Positionslichter am Korvetten-Wrack
      const blink = Math.sin(t * 7.5) > 0;
      if (blink) {
        this.drawGlowDot(ctx, 124, 52, 9, '#ef4444', 0.85);
        this.drawGlowDot(ctx, 358, 52, 9, '#ef4444', 0.85);
        this.drawGlowDot(ctx, 203, 102, 7, '#f87171', 0.7);
      }
      // Flackernder Cyan-Reaktor-Lichtbogen am rechten Rumpfriss
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
      // Pulsierende warme Andock-Schleusen-Leitlichter
      const bayPulse = 0.35 + 0.35 * Math.sin(t * 6);
      this.drawGlowDot(ctx, 240, 122, 26, '#fbbf24', bayPulse);
      // Langsam vorbeiziehende Metall-Trümmer
      ctx.fillStyle = '#64748b';
      for (let i = 0; i < 4; i++) {
        const dx = ((i * 117 + t * (10 + i * 3)) % (VIRTUAL_WIDTH + 40)) - 20;
        const dy = 132 + Math.sin(t * 1.4 + i * 2) * 14 + (i % 2) * 18;
        ctx.fillRect(Math.round(dx), Math.round(dy), 3, 2);
      }
    } else if (s === 2) {
      // Schimmernde Kristall-Reflexe & kreisende Splitter
      const glints: Array<[number, number, string]> = [
        [240, 38, '#f0abfc'],
        [198, 62, '#67e8f9'],
        [284, 60, '#c084fc'],
        [168, 78, '#e879f9'],
        [312, 82, '#38bdf8'],
      ];
      for (let i = 0; i < glints.length; i++) {
        const [gx, gy, col] = glints[i]!;
        const a = 0.25 + 0.65 * Math.max(0, Math.sin(t * 4.5 + i * 1.4));
        this.drawGlowDot(ctx, gx, gy, 10, col, a);
      }
      // Pulsierendes Kristall-Portal
      this.drawGlowDot(ctx, 240, 122, 32, '#22d3ee', 0.28 + 0.22 * Math.sin(t * 5));
      // Kreisende kleine Kristallsplitter
      for (let i = 0; i < 5; i++) {
        const ang = t * 0.9 + (i * Math.PI * 2) / 5;
        const sx = 240 + Math.cos(ang) * 98;
        const sy = 104 + Math.sin(ang) * 34;
        ctx.fillStyle = i % 2 === 0 ? '#67e8f9' : '#e879f9';
        ctx.fillRect(Math.round(sx), Math.round(sy), 2.5, 4);
      }
    } else if (s === 3) {
      // Pulsierende Sonnen-Korona & aufsteigende Glut-Funken
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
      // Goldene Lichtpunkte kreisen auf den Astral-Ringen des Monolithen
      for (let i = 0; i < 6; i++) {
        const ang = t * 1.2 + (i * Math.PI) / 3;
        const rx = 240 + Math.cos(ang) * 108;
        const ry = 68 + Math.sin(ang) * 28;
        this.drawGlowDot(ctx, rx, ry, 7, '#facc15', 0.75);
      }
      // Wirbelndes Astral-Portal
      this.drawGlowDot(ctx, 240, 114, 28, '#38bdf8', 0.32 + 0.24 * Math.sin(t * 5.5));
    } else {
      // Omega / Spirale: pulsierender Singularitäts-Kern + zuckende Siegel-Blitze
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

  private renderStars(ctx: CanvasRenderingContext2D, warpFactor: number): void {
    const t = this.elapsed;
    for (const s of this.stars) {
      const twinkle = 0.55 + 0.45 * Math.sin(t * (2.5 + s.layer) + s.twinkleOffset);
      ctx.globalAlpha = (s.layer === 0 ? 0.4 : s.layer === 1 ? 0.68 : 0.92) * twinkle;
      ctx.fillStyle = s.tint;
      const sx = Math.round(s.x);
      const sy = Math.round(s.y);
      if (warpFactor > 0.08 && s.layer >= 1) {
        const streak = Math.max(2, Math.round(warpFactor * (s.layer === 2 ? 22 : 11)));
        ctx.fillRect(sx, sy - streak, s.size, streak + s.size);
      } else {
        ctx.fillRect(sx, sy, s.size, s.size);
      }
    }
    ctx.globalAlpha = 1;
  }

  /** Gekrümmte Zwillings-Triebwerksspuren entlang der echten Flugkurve */
  private renderTrail(ctx: CanvasRenderingContext2D): void {
    if (this.trail.length < 2) return;
    ctx.save();
    ctx.lineCap = 'round';
    for (let i = 1; i < this.trail.length; i++) {
      const prev = this.trail[i - 1]!;
      const cur = this.trail[i]!;
      const a = Math.max(0, 1 - cur.age / 0.58);
      ctx.strokeStyle = this.theme.thruster;
      ctx.globalAlpha = a * 0.45;
      ctx.lineWidth = Math.max(1, a * 3.4);
      ctx.beginPath();
      ctx.moveTo(prev.lx, prev.ly);
      ctx.lineTo(cur.lx, cur.ly);
      ctx.moveTo(prev.rx, prev.ry);
      ctx.lineTo(cur.rx, cur.ry);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** Phase 3: Absetzkapsel (Drop-Pod) löst sich vom Schiff, fliegt ins Dock & landet mit Blitz */
  private renderDropPodSequence(
    ctx: CanvasRenderingContext2D,
    shipX: number,
    shipY: number,
    ox: number,
    oy: number,
    t: number,
  ): void {
    if (t < 2.95) return;
    const localT = t - 2.95;
    const targetX = VIRTUAL_WIDTH * 0.5 + ox;
    const targetY = 120 + oy;
    const startY = shipY - 14;

    ctx.save();

    // Abschuss-Lichtblitz an der Schiffsnase (2.95..3.25 s)
    if (localT < 0.3) {
      const f = 1 - localT / 0.3;
      this.drawGlowDot(ctx, shipX, startY, 22 * f + 6, this.theme.beamCore, f * 0.85);
    }

    // Kapsel-Flug (0.0..0.95 s nach Abschuss)
    const flightT = easeInOutQuad(localT / 0.95);
    const podX = shipX + (targetX - shipX) * flightT;
    const podY = startY + (targetY - startY) * flightT;
    const podScale = 1.0 - 0.36 * flightT;

    // Energie-Leitringe hinter der Kapsel
    if (localT < 1.15) {
      for (let i = 0; i < 3; i++) {
        const ringT = clamp01((localT - i * 0.14) / 0.65);
        if (ringT <= 0 || ringT >= 1) continue;
        const ry = startY + (targetY - startY) * (ringT * 0.88);
        ctx.strokeStyle = this.theme.accent;
        ctx.globalAlpha = (1 - ringT) * 0.65;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(podX, ry, 7 + ringT * 10, 2.5 + ringT * 3, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // Drop-Pod Sprite (oder kompakter Fallback)
    if (localT < 1.2) {
      const fadeEnd = localT > 0.95 ? 1 - clamp01((localT - 0.95) / 0.25) : 1;
      const podSprite = getHDArt().cutsceneDropPod;
      ctx.save();
      ctx.translate(Math.round(podX), Math.round(podY));
      ctx.scale(podScale, podScale);
      ctx.globalAlpha = fadeEnd;

      // Brems-/Schubflamme unter der Kapsel
      const flameH = 6 + (1 - flightT) * 9 + Math.sin(t * 50) * 2;
      ctx.fillStyle = this.theme.accent;
      ctx.fillRect(-4, 7, 8, flameH);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-2, 7, 4, flameH * 0.55);

      if (podSprite) {
        ctx.drawImage(podSprite, -11, -11, 22, 22);
      } else {
        ctx.fillStyle = '#d97706';
        ctx.fillRect(-5, -7, 10, 14);
        ctx.fillStyle = '#38e8d4';
        ctx.fillRect(-3, -4, 6, 4);
      }
      ctx.restore();
    }

    // Landungs-Impuls & Schleusen-Aufleuchten bei Touchdown (ab localT = 0.85 s)
    if (localT >= 0.85) {
      const landT = clamp01((localT - 0.85) / 0.55);
      const flash = Math.sin(landT * Math.PI);
      this.drawGlowDot(ctx, targetX, targetY, 18 + landT * 26, this.theme.beamCore, flash * 0.9);
      ctx.strokeStyle = this.theme.accent;
      ctx.globalAlpha = (1 - landT) * 0.85;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(targetX, targetY, 8 + landT * 26, 4 + landT * 10, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  private renderShip(
    ctx: CanvasRenderingContext2D,
    ship: { x: number; y: number; scale: number; heading: number; bank: number; thrust: number },
  ): void {
    const hd = getHDArt();
    const sprite = hd[this.theme.shipKey];
    const bankScaleX = 1 - Math.abs(ship.bank) * 0.22;

    ctx.save();
    ctx.translate(Math.round(ship.x), Math.round(ship.y));
    ctx.rotate(ship.heading);
    ctx.scale(ship.scale * bankScaleX, ship.scale);

    // Weicher Triebwerks-Glow
    const glowR = 22 + ship.thrust * 18 + Math.sin(this.elapsed * 32) * 3;
    const g = ctx.createRadialGradient(0, 24, 2, 0, 24, glowR);
    g.addColorStop(0, this.theme.thruster);
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.globalAlpha = 0.42 + ship.thrust * 0.35;
    ctx.fillStyle = g;
    ctx.fillRect(-glowR, 24 - glowR, glowR * 2, glowR * 2);

    // Boost-Verlängerung bei starkem Schub
    if (ship.thrust > 0.28) {
      const boost = (ship.thrust - 0.28) / 0.87;
      const flameH = 5 + boost * 15 + Math.sin(this.elapsed * 45) * 2;
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
    if (t < 1.3 || t > 4.25) return;
    const fadeIn = easeOutCubic((t - 1.3) / 0.42);
    const fadeOut = t > 3.75 ? 1 - clamp01((t - 3.75) / 0.45) : 1;
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
