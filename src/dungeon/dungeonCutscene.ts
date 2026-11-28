import { getHDArt } from '../assets/artLoader';
import { sound } from '../engine/audio';
import { InputManager, VIRTUAL_HEIGHT, VIRTUAL_WIDTH } from '../engine/input';

export type DungeonMapCutsceneMode = 'land' | 'extract' | 'rescue';

export interface DungeonMapCutsceneConfig {
  mode: DungeonMapCutsceneMode;
  /** Welt-Koordinaten auf der aktuellen Dungeon-Map (in der Regel playerX, playerY) */
  worldX: number;
  worldY: number;
  /** Aktueller Kamera-Versatz der DungeonScene */
  camX: number;
  camY: number;
  /** Optionaler Kamera-Shake-Callback (z. B. beim Aufsetzen der Drop-Pod-Kapsel) */
  onImpactShake?: (amount: number) => void;
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

const SKIP_LOCK_SEC = 0.25;

const DURATIONS: Record<DungeonMapCutsceneMode, number> = {
  land: 1.32,
  extract: 1.05,
  rescue: 1.5,
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

function createRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * In-Map-Cutscene direkt auf der echten Dungeon-Karte (unter realer Raum- & Kamera-Perspektive):
 * - 'land'   : Drop-Pod kracht von oben in den Startraum (Shake + Staubring), Luke öffnet sich, Spieler hüpft heraus!
 * - 'extract': Teleporter-Ringe laden am Standort des Spielers auf → Lichtstrahl zieht Spieler sichtbar nach oben raus.
 * - 'rescue' : Gefallener Spieler am Boden → Dr. Lyras Med-Evac-Drohne fliegt von oben rein & hebt ihn im Stasis-Strahl raus.
 */
export class DungeonMapCutscene {
  public readonly config: DungeonMapCutsceneConfig;
  public elapsed = 0;
  public finished = false;
  public skipped = false;

  private readonly duration: number;
  private readonly sparks: Spark[] = [];
  private readonly rng: () => number;
  private playedStart = false;
  private playedImpact = false;
  private spawnAcc = 0;

  constructor(config: DungeonMapCutsceneConfig) {
    this.config = config;
    this.duration = DURATIONS[config.mode];
    this.rng = createRng(Math.round(config.worldX * 17 + config.worldY * 31) + config.mode.length * 97);
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

    if (!this.playedStart) {
      this.playedStart = true;
      if (this.config.mode === 'land') sound.playPodLaunch();
      else if (this.config.mode === 'extract') sound.playDropBeam();
      else sound.playEmergencySiren();
    }

    if (this.elapsed >= SKIP_LOCK_SEC) {
      if (
        input.wasPressed('Space', true) ||
        input.wasPressed('Enter', true) ||
        input.wasPressed('Escape', true) ||
        input.primaryPressed()
      ) {
        this.skip();
        return true;
      }
    }

    this.elapsed += dt;

    // Landungs-Impuls der Absetzkapsel bei t = 0.44 s
    if (this.config.mode === 'land' && !this.playedImpact && this.elapsed >= 0.44) {
      this.playedImpact = true;
      sound.playBossSlam();
      this.config.onImpactShake?.(5.5);
      const sx = this.config.worldX - this.config.camX;
      const sy = this.config.worldY - 10 - this.config.camY;
      for (let i = 0; i < 20; i++) {
        const ang = (i / 20) * Math.PI * 2;
        const spd = 28 + this.rng() * 42;
        this.sparks.push({
          x: sx + Math.cos(ang) * 6,
          y: sy + 6 + Math.sin(ang) * 3,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd * 0.45 - 8,
          life: 0,
          maxLife: 0.35 + this.rng() * 0.25,
          size: i % 3 === 0 ? 2.6 : 1.8,
          color: i % 2 === 0 ? '#cbd5e1' : '#38e8d4',
        });
      }
    }

    // Laufende Partikel je Modus
    this.spawnAcc += dt * 42;
    while (this.spawnAcc >= 1) {
      this.spawnAcc -= 1;
      const sx = this.config.worldX - this.config.camX;
      const sy = this.config.worldY - this.config.camY;
      if (this.config.mode === 'extract') {
        this.sparks.push({
          x: sx + (this.rng() - 0.5) * 20,
          y: sy + 6 - this.rng() * 24,
          vx: (this.rng() - 0.5) * 10,
          vy: -55 - this.rng() * 60,
          life: 0,
          maxLife: 0.32,
          size: 1.8,
          color: this.rng() < 0.4 ? '#fde047' : '#38e8d4',
        });
      } else if (this.config.mode === 'rescue') {
        this.sparks.push({
          x: sx + (this.rng() - 0.5) * 18,
          y: sy + (this.rng() - 0.5) * 12,
          vx: (this.rng() - 0.5) * 18,
          vy: -35 - this.rng() * 45,
          life: 0,
          maxLife: 0.36,
          size: 1.8,
          color: this.rng() < 0.5 ? '#f87171' : '#fecaca',
        });
      }
    }

    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const p = this.sparks[i]!;
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.sparks.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }

    if (this.elapsed >= this.duration) {
      this.finished = true;
      return true;
    }
    return false;
  }

  public render(ctx: CanvasRenderingContext2D): void {
    const sx = Math.round(this.config.worldX - this.config.camX);
    const sy = Math.round(this.config.worldY - this.config.camY);
    const t = this.elapsed;

    ctx.save();

    if (this.config.mode === 'land') {
      this.renderPodLanding(ctx, sx, sy, t);
    } else if (this.config.mode === 'extract') {
      this.renderMapExtract(ctx, sx, sy, t);
    } else {
      this.renderMapRescue(ctx, sx, sy, t);
    }

    // Partikel
    for (const p of this.sparks) {
      ctx.globalAlpha = Math.max(0, 1 - p.life / p.maxLife) * 0.9;
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x - p.size / 2), Math.round(p.y - p.size / 2), p.size, p.size);
    }
    ctx.globalAlpha = 1;

    // Dezente Kino-Balken während der kurzen Map-Sequenz
    const barFade = t > this.duration - 0.22 ? 1 - clamp01((t - (this.duration - 0.22)) / 0.22) : clamp01(t / 0.16);
    const barH = Math.round(14 * barFade);
    if (barH > 0) {
      ctx.fillStyle = 'rgba(6, 10, 18, 0.88)';
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, barH);
      ctx.fillRect(0, VIRTUAL_HEIGHT - barH, VIRTUAL_WIDTH, barH);
    }

    ctx.restore();
  }

  private renderPodLanding(ctx: CanvasRenderingContext2D, sx: number, sy: number, t: number): void {
    const hd = getHDArt();
    const podY = sy - 10;

    // 1. Wachsender Zielschatten am Boden
    const fallP = clamp01(t / 0.44);
    const shadowScale = 0.25 + 0.75 * fallP;
    ctx.fillStyle = `rgba(4, 8, 16, ${0.22 + 0.36 * fallP})`;
    ctx.beginPath();
    ctx.ellipse(sx, podY + 12, 16 * shadowScale, 6 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. Fallende Kapsel (0..0.44 s) → gelandete geschlossene (0.44..0.68 s) → geöffnete Kapsel (ab 0.68 s)
    if (t < 0.44) {
      const y = podY - (1 - fallP * fallP) * 195;
      // Bremsdüsen-Flamme
      ctx.fillStyle = '#38e8d4';
      ctx.globalAlpha = 0.75;
      ctx.fillRect(sx - 5, Math.round(y + 10), 10, 14);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(sx - 2, Math.round(y + 10), 4, 8);
      ctx.globalAlpha = 1;
      if (hd.cutsceneDropPod) {
        ctx.drawImage(hd.cutsceneDropPod, Math.round(sx - 15), Math.round(y - 16), 30, 30);
      }
    } else {
      // Aufprall-Schockwelle (0.44..0.78 s)
      if (t < 0.78) {
        const rp = (t - 0.44) / 0.34;
        ctx.strokeStyle = '#38e8d4';
        ctx.globalAlpha = (1 - rp) * 0.85;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(sx, podY + 10, 10 + rp * 30, 4 + rp * 11, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      const isOpen = t >= 0.68;
      const spr = isOpen ? (hd.cutsceneDropPodOpen ?? hd.cutsceneDropPod) : hd.cutsceneDropPod;
      if (spr) {
        ctx.drawImage(spr, Math.round(sx - 15), Math.round(podY - 16), 30, 30);
      }
      // Warmes Innenlicht beim Öffnen der Luke
      if (isOpen && t < 0.98) {
        const gP = Math.sin(((t - 0.68) / 0.3) * Math.PI);
        this.drawGlow(ctx, sx, podY, 20, '#38e8d4', gP * 0.65);
      }
    }

    // 3. Spieler hüpft sichtbar aus der geöffneten Luke auf den Startpunkt (0.72..1.25 s)
    if (t >= 0.72 && hd.heroDown) {
      const hopP = easeOutCubic((t - 0.72) / 0.48);
      const hy = podY + 2 + (sy - (podY + 2)) * hopP - Math.sin(hopP * Math.PI) * 11;
      const hs = 20 + 4 * hopP;
      ctx.drawImage(hd.heroDown, Math.round(sx - hs / 2), Math.round(hy - hs / 2), Math.round(hs), Math.round(hs));
    }
  }

  private renderMapExtract(ctx: CanvasRenderingContext2D, sx: number, sy: number, t: number): void {
    const hd = getHDArt();
    const p = clamp01(t / this.duration);

    // 1. Leuchtender Teleporter-Ring am Boden unter dem Spieler
    const ringAlpha = Math.sin(clamp01(p * 1.2) * Math.PI);
    ctx.strokeStyle = '#38e8d4';
    ctx.globalAlpha = ringAlpha * 0.9;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(sx, sy + 8, 12 + p * 10, 5 + p * 4, 0, 0, Math.PI * 2);
    ctx.stroke();

    // 2. Vertikaler Teleport-Strahl bis zur Decke
    const beamIn = easeOutCubic(t / 0.25);
    const beamW = 14 * beamIn * (1 - Math.max(0, (p - 0.8) / 0.2));
    ctx.globalAlpha = 0.34 * beamIn;
    ctx.fillStyle = '#38e8d4';
    ctx.fillRect(Math.round(sx - beamW), 0, Math.round(beamW * 2), sy + 10);
    ctx.globalAlpha = 0.68 * beamIn;
    ctx.fillStyle = '#e0f2fe';
    ctx.fillRect(Math.round(sx - beamW * 0.42), 0, Math.round(beamW * 0.84), sy + 10);
    ctx.globalAlpha = 1;

    // 3. Spieler schwebt im Lichtstrahl nach oben aus dem Raum!
    if (hd.heroDown) {
      const liftP = easeInOutQuad(Math.max(0, (t - 0.22) / (this.duration - 0.25)));
      const hy = sy - liftP * (sy + 32);
      ctx.globalAlpha = 1 - Math.max(0, (liftP - 0.72) / 0.28);
      this.drawGlow(ctx, sx, hy, 18, '#fde047', 0.55);
      ctx.drawImage(hd.heroDown, Math.round(sx - 12), Math.round(hy - 12), 24, 24);
      ctx.globalAlpha = 1;
    }

    // 4. Helle Überblendung in den Weltraum-Rückflug
    if (t > this.duration - 0.24) {
      const f = clamp01((t - (this.duration - 0.24)) / 0.24);
      ctx.fillStyle = `rgba(216, 250, 255, ${f * 0.9})`;
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    }
  }

  private renderMapRescue(ctx: CanvasRenderingContext2D, sx: number, sy: number, t: number): void {
    const hd = getHDArt();

    // Rotes Notfall-Vignette-Pulsieren über der echten Dungeon-Map
    const alarm = 0.14 + 0.1 * Math.sin(t * 14);
    ctx.fillStyle = `rgba(220, 38, 38, ${alarm})`;
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

    // Drohne fliegt von oben ins Bild über den gefallenen Spieler (0..0.48 s),
    // greift ihn im Stasis-Strahl (0.48..0.85 s) und zieht ihn nach oben raus (0.85..1.50 s)!
    let droneY: number;
    let heroY = sy;
    let beamAlpha = 0;

    if (t < 0.48) {
      const u = easeOutCubic(t / 0.48);
      droneY = -36 + (sy - 46 - -36) * u;
    } else if (t < 0.86) {
      droneY = sy - 46 + Math.sin(t * 12) * 1.5;
      beamAlpha = easeOutCubic((t - 0.48) / 0.22);
      heroY = sy - Math.sin(((t - 0.48) / 0.38) * Math.PI * 0.5) * 6;
    } else {
      const liftP = easeInOutQuad((t - 0.86) / (this.duration - 0.86));
      droneY = sy - 46 - liftP * (sy + 50);
      heroY = sy - 6 - liftP * (sy + 50);
      beamAlpha = 1 - Math.max(0, (liftP - 0.75) / 0.25);
    }

    // Stasis-Bergungsstrahl zwischen Drohne und verletztem Spieler
    if (beamAlpha > 0.01) {
      const top = Math.round(droneY + 8);
      const h = Math.max(12, Math.round(heroY + 10 - top));
      ctx.globalAlpha = beamAlpha * 0.36;
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(sx - 12, top, 24, h);
      ctx.globalAlpha = beamAlpha * 0.65;
      ctx.fillStyle = '#fecaca';
      ctx.fillRect(sx - 5, top, 10, h);
      ctx.globalAlpha = 1;
    }

    // Verletzter Spieler (leicht gekippt + roter Warnring)
    if (hd.heroDown) {
      ctx.save();
      ctx.translate(sx, Math.round(heroY));
      ctx.rotate(t < 0.48 ? 0.45 : 0.24);
      ctx.strokeStyle = '#ef4444';
      ctx.globalAlpha = 0.78;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.drawImage(hd.heroDown, -12, -12, 24, 24);
      ctx.restore();
    }

    // Dr. Lyras Med-Evac-Drohne mit blinkender Sirene
    const sirenRed = Math.sin(t * 20) > 0;
    this.drawGlow(ctx, sx, droneY, 24, sirenRed ? '#ef4444' : '#38bdf8', 0.65);
    if (hd.cutsceneMedDrone) {
      ctx.drawImage(hd.cutsceneMedDrone, Math.round(sx - 20), Math.round(droneY - 20), 40, 40);
    }

    // Überblendung in den Not-Rückflug
    if (t > this.duration - 0.24) {
      const f = clamp01((t - (this.duration - 0.24)) / 0.24);
      ctx.fillStyle = `rgba(254, 202, 202, ${f * 0.88})`;
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    }
  }

  private drawGlow(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number,
    color: string,
    alpha: number,
  ): void {
    const g = ctx.createRadialGradient(x, y, 1, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.restore();
  }
}
