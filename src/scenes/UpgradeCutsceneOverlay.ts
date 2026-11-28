import { getHDArt } from '../assets/artLoader';
import { drawGlow } from '../assets/pixelArt';
import { sound } from '../engine/audio';
import { VIRTUAL_HEIGHT, VIRTUAL_WIDTH, type InputManager } from '../engine/input';
import { getDeviceSettings } from '../systems/deviceSettings';
import { drawMinaSprite } from './HubCutsceneOverlay';

export type UpgradeCutsceneKind = 'weapon' | 'shop' | 'quarters' | 'ship' | 'forge_step' | 'tech_step';

export interface UpgradeCutsceneConfig {
  kind: UpgradeCutsceneKind;
  title: string;
  subtitle: string;
  accent: string;
  major: boolean;
  minaPresent?: boolean;
  shipKey?: 'shipCorvette' | 'shipCrystal' | 'shipSolar' | 'shipMonolith';
  /** Hub-Gebäude: Kamera zoomt auf das Gebäude, es wird „gebaut“ und wechselt sichtbar auf die neue Stufe. */
  building?: 'forge' | 'med' | 'tech';
  /** Raum-Enthüllung: Lichtstreifen wischt vom alten zum neuen Raumbild (Laden-/Quartier-Ausbau). */
  room?: 'shop' | 'backroom';
  fromTier?: number;
  toTier?: number;
  /** Wird einmal im Enthüllungs-Moment gerufen (Hub: Stufen-Override aufheben). */
  onReveal?: () => void;
  /** Wird beim Beenden/Überspringen gerufen (Aufräumen). */
  onEnd?: () => void;
}

/** Bildausschnitt (logische Koordinaten) und Zoom je Hub-Gebäude. */
const BUILDING_FOCUS: Record<'forge' | 'med' | 'tech', { x: number; y: number; z: number; label: string }> = {
  forge: { x: 150, y: 66, z: 2.1, label: 'EXO-SCHMIEDE' },
  med: { x: 346, y: 66, z: 2.1, label: 'MED-BAY' },
  tech: { x: 366, y: 190, z: 1.85, label: 'TECH-LABOR' },
};

function easeInOut(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

const SKIP_LOCK_SEC = 0.2;

export class UpgradeCutsceneOverlay {
  public readonly config: UpgradeCutsceneConfig;
  public skipped = false;

  private elapsed = 0;
  private duration: number;
  private strikesPlayed = 0;
  private revealPlayed = false;
  private sparks: Spark[] = [];
  private flashAlpha = 0;
  private pointerClicked = false;
  private onPointerDown: () => void;
  private disposed = false;
  private strikeTimer = 0;
  private shake = 0;
  private ringT = -1;

  constructor(config: UpgradeCutsceneConfig) {
    this.config = config;
    const short = getDeviceSettings().shortCutscenes;
    if (config.building || config.room) {
      this.duration = config.major ? (short ? 1.5 : 3.0) : short ? 1.0 : 1.9;
    } else if (config.major) {
      this.duration = short ? 1.15 : 2.15;
    } else {
      this.duration = short ? 0.65 : 1.15;
    }

    this.onPointerDown = () => {
      this.pointerClicked = true;
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('pointerdown', this.onPointerDown);
    }

    if (config.building || config.room) {
      // Die Zeitleiste (update) steuert Hämmern & Enthüllung
    } else if (config.kind === 'weapon' || config.kind === 'forge_step') {
      sound.playForgeHammer();
      this.strikesPlayed = 1;
      this.spawnSparks(VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2 - 4, config.major ? 26 : 18, config.accent);
      this.flashAlpha = 0.26;
    } else {
      sound.playUpgradeReveal();
      this.revealPlayed = true;
      this.spawnSparks(VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2 - 4, config.major ? 28 : 16, config.accent);
      this.flashAlpha = 0.22;
    }
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.config.onEnd?.();
    if (typeof window !== 'undefined') {
      window.removeEventListener('pointerdown', this.onPointerDown);
    }
  }

  /** Test-Hook: springt zu einem bestimmten Zeitpunkt. */
  public seek(sec: number): void {
    this.elapsed = Math.max(0, Math.min(this.duration, sec));
    this.spawnSparks(VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2 - 4, 22, this.config.accent);
  }

  private spawnSparks(cx: number, cy: number, count: number, accent: string): void {
    const colors = [accent, '#fde047', '#ffffff', '#fb923c'];
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 24 + Math.random() * 68;
      this.sparks.push({
        x: cx + (Math.random() - 0.5) * 14,
        y: cy + (Math.random() - 0.5) * 10,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 16,
        color: colors[i % colors.length],
        size: Math.random() > 0.45 ? 2 : 1,
        life: 0.45 + Math.random() * 0.55,
        maxLife: 1.0,
      });
    }
  }

  /** Zeitleiste der Gebäude-/Raum-Animation: Bau-Phase (Hämmern, Staub) → Enthüllung → Halten. */
  private updateTimeline(progress: number, dt: number): void {
    const revealAt = this.config.building ? 0.4 : 0.3;
    const buildFrom = 0.16;
    if (this.config.building && progress >= buildFrom && progress < revealAt) {
      this.strikeTimer -= dt;
      if (this.strikeTimer <= 0) {
        this.strikeTimer = 0.2;
        sound.playForgeHammer();
        this.spawnSparks(VIRTUAL_WIDTH / 2 + (Math.random() - 0.5) * 70, VIRTUAL_HEIGHT / 2 + (Math.random() - 0.5) * 40, 7, '#fb923c');
        this.shake = 1.6;
      }
    }
    this.shake = Math.max(0, this.shake - dt * 9);
    if (!this.revealPlayed && progress >= revealAt) {
      this.revealPlayed = true;
      sound.playUpgradeReveal();
      this.config.onReveal?.();
      this.spawnSparks(VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2, this.config.major ? 44 : 26, this.config.accent);
      this.flashAlpha = 0.34;
      this.ringT = 0;
    }
    if (this.revealPlayed) this.ringT += dt;
  }

  public update(dt: number, input: InputManager): boolean {
    const safeDt = Math.min(0.05, Math.max(0, dt));
    this.elapsed += safeDt;
    this.flashAlpha = Math.max(0, this.flashAlpha - safeDt * 1.4);

    const clicked = this.pointerClicked;
    this.pointerClicked = false;

    const progress = this.elapsed / this.duration;

    if (this.config.building || this.config.room) {
      this.updateTimeline(progress, safeDt);
    } else
    // 2. Hammerschlag + Enthüllung bei großen Waffen-Schmiede-Meilensteinen
    if (this.config.kind === 'weapon' && this.config.major) {
      if (progress >= 0.26 && this.strikesPlayed < 2) {
        this.strikesPlayed = 2;
        sound.playForgeHammer();
        this.spawnSparks(VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2 - 6, 28, '#fb923c');
        this.flashAlpha = 0.16;
      }
      if (progress >= 0.52 && !this.revealPlayed) {
        this.revealPlayed = true;
        sound.playUpgradeReveal();
        this.spawnSparks(VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2 - 6, 38, this.config.accent);
        this.flashAlpha = 0.18;
      }
    } else if (!this.revealPlayed && progress >= 0.45) {
      this.revealPlayed = true;
      sound.playUpgradeReveal();
      this.spawnSparks(VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2 - 6, 20, this.config.accent);
    }

    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.x += s.vx * safeDt;
      s.y += s.vy * safeDt;
      s.vy += 65 * safeDt;
      s.life -= safeDt;
      if (s.life <= 0) this.sparks.splice(i, 1);
    }

    if (this.elapsed >= SKIP_LOCK_SEC) {
      if (
        clicked ||
        input.wasPressed('Escape') ||
        input.wasPressed('Space') ||
        input.wasPressed('KeyE') ||
        input.wasPressed('Enter')
      ) {
        this.skipped = true;
        this.dispose();
        return true;
      }
    }

    if (this.elapsed >= this.duration) {
      this.dispose();
      return true;
    }

    return false;
  }

  /** Titel-Band unten (statt Karte): Kicker, Titel, Untertitel. */
  private renderBanner(ctx: CanvasRenderingContext2D, alpha: number, building: boolean): void {
    if (alpha <= 0.01) return;
    const { title, subtitle, accent } = this.config;
    const bh = 50;
    const by = VIRTUAL_HEIGHT - 18 - bh - 4;
    ctx.save();
    ctx.globalAlpha = alpha;
    const grad = ctx.createLinearGradient(0, by - 6, 0, by + bh);
    grad.addColorStop(0, 'rgba(6, 10, 22, 0)');
    grad.addColorStop(0.25, 'rgba(6, 10, 22, 0.86)');
    grad.addColorStop(1, 'rgba(6, 10, 22, 0.92)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, by - 6, VIRTUAL_WIDTH, bh + 6);
    ctx.fillStyle = accent;
    ctx.fillRect(0, by + 6, VIRTUAL_WIDTH, 1);
    ctx.textAlign = 'center';
    ctx.font = 'bold 6.5px monospace';
    ctx.fillStyle = accent;
    const kicker = building && this.config.building ? `PORT SOLARIS · ${BUILDING_FOCUS[this.config.building].label}` : 'PORT SOLARIS · AUSBAU';
    ctx.fillText(kicker, VIRTUAL_WIDTH / 2, by + 17);
    ctx.font = 'bold 11px monospace';
    ctx.fillStyle = '#f8fafc';
    ctx.fillText(title, VIRTUAL_WIDTH / 2, by + 31);
    ctx.font = '7.5px monospace';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(subtitle, VIRTUAL_WIDTH / 2, by + 43);
    ctx.restore();
  }

  private drawSparksAndFlash(ctx: CanvasRenderingContext2D, alpha: number): void {
    for (const s of this.sparks) {
      ctx.globalAlpha = alpha * Math.max(0, Math.min(1, s.life / s.maxLife));
      ctx.fillStyle = s.color;
      ctx.fillRect(Math.round(s.x), Math.round(s.y), s.size, s.size);
    }
    ctx.globalAlpha = 1;
    if (this.flashAlpha > 0.01) {
      ctx.globalAlpha = this.flashAlpha * alpha;
      ctx.fillStyle = '#fef9c3';
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
      ctx.globalAlpha = 1;
    }
    if (this.ringT >= 0 && this.ringT < 0.9) {
      const r = 10 + this.ringT * 150;
      ctx.save();
      ctx.globalAlpha = (1 - this.ringT / 0.9) * 0.8 * alpha;
      ctx.strokeStyle = this.config.accent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2, r, r * 0.62, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  /** Live-Zoom auf das Hub-Gebäude: die darunterliegende Szene wird vergrößert (Selbst-Kopie des Canvas). */
  private renderZoom(ctx: CanvasRenderingContext2D): void {
    const b = this.config.building as 'forge' | 'med' | 'tech';
    const f = BUILDING_FOCUS[b];
    const t = Math.min(1, this.elapsed / this.duration);
    const zin = easeInOut(t / 0.15);
    const zout = easeInOut((1 - t) / 0.12);
    const z = 1 + (f.z - 1) * Math.min(zin, zout);
    const w = VIRTUAL_WIDTH / z;
    const h = VIRTUAL_HEIGHT / z;
    const sh = this.shake > 0 ? (Math.random() - 0.5) * this.shake : 0;
    const x = Math.max(0, Math.min(VIRTUAL_WIDTH - w, f.x - w / 2 + sh));
    const y = Math.max(0, Math.min(VIRTUAL_HEIGHT - h, f.y - h / 2 + sh * 0.6));
    const cv = ctx.canvas;
    const k = cv.width / VIRTUAL_WIDTH;
    if (z > 1.001) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(cv, x * k, y * k, w * k, h * k, 0, 0, cv.width, cv.height);
      ctx.restore();
    }
    const alpha = Math.min(1, zin, zout * 1.5);

    // Vignette + Kino-Balken
    const vg = ctx.createRadialGradient(VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2, 70, VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2, 290);
    vg.addColorStop(0, 'rgba(4, 8, 18, 0)');
    vg.addColorStop(1, 'rgba(4, 8, 18, 0.62)');
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    ctx.fillStyle = '#040710';
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, 14 * alpha);
    ctx.fillRect(0, VIRTUAL_HEIGHT - 14 * alpha, VIRTUAL_WIDTH, 14 * alpha);
    ctx.restore();

    // Bau-Phase: Arbeitslicht, Staub
    const revealAt = 0.4;
    if (t >= 0.14 && t < revealAt + 0.04) {
      drawGlow(ctx, VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2 - 8, 70, '#fbbf24', 0.1 + Math.abs(Math.sin(this.elapsed * 18)) * 0.12);
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = '#d6c7a3';
      for (let i = 0; i < 14; i++) {
        const ph = (this.elapsed * 0.9 + i * 0.37) % 1;
        const dx = VIRTUAL_WIDTH / 2 + Math.sin(i * 4.1 + this.elapsed * 3) * 80;
        const dy = VIRTUAL_HEIGHT / 2 + 30 - ph * 80;
        ctx.fillRect(Math.round(dx), Math.round(dy), 2, 2);
      }
      ctx.restore();
    }

    this.drawSparksAndFlash(ctx, alpha);

    if (t < revealAt) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, (t - 0.1) / 0.06) * alpha;
      ctx.textAlign = 'center';
      ctx.font = 'bold 8px monospace';
      ctx.fillStyle = '#fde047';
      ctx.fillText(`AUSBAU LÄUFT${'.'.repeat(1 + (Math.floor(this.elapsed * 4) % 3))}`, VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT - 30);
      ctx.restore();
    } else {
      this.renderBanner(ctx, easeInOut((t - revealAt) / 0.12) * Math.min(1, zout * 1.6), true);
    }
    if (this.config.major && t > revealAt + 0.15 && t < 0.9) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.font = '6px monospace';
      ctx.fillStyle = 'rgba(148, 163, 184, 0.8)';
      ctx.fillText('[KLICK / TASTE] WEITER', VIRTUAL_WIDTH / 2, 10);
      ctx.restore();
    }
  }

  /** Raum-Enthüllung: ein Lichtstreifen wischt vom alten zum neuen Raumbild. */
  private renderRoom(ctx: CanvasRenderingContext2D): void {
    const art = getHDArt();
    const room = this.config.room as 'shop' | 'backroom';
    const pick = (tier: number): HTMLImageElement | null =>
      room === 'shop'
        ? tier >= 2
          ? (art.shopBgT3 ?? art.shopBgT2 ?? art.shopBg)
          : tier === 1
            ? (art.shopBgT2 ?? art.shopBg)
            : art.shopBg
        : tier >= 2
          ? (art.backroomBgT3 ?? art.backroomBg)
          : tier === 1
            ? art.backroomBg
            : (art.backroomBgT1 ?? art.backroomBg);
    const from = pick(this.config.fromTier ?? 0);
    const to = pick(this.config.toTier ?? 1);
    const t = Math.min(1, this.elapsed / this.duration);
    const fadeIn = easeInOut(t / 0.1);
    const fadeOut = easeInOut((1 - t) / 0.1);
    const alpha = Math.min(fadeIn, fadeOut);
    const wipeT = easeInOut((t - 0.22) / 0.4);
    const wx = wipeT * (VIRTUAL_WIDTH + 40) - 20;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#05070f';
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    if (to) ctx.drawImage(to, 0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    if (from && wipeT < 1) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(Math.max(0, wx), 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
      ctx.clip();
      ctx.drawImage(from, 0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
      // alter Raum leicht abgedunkelt = „Baustelle“
      ctx.fillStyle = 'rgba(8, 10, 24, 0.28)';
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
      ctx.restore();
    }
    if (wipeT > 0 && wipeT < 1) {
      // Lichtkante + Funken entlang der Wischlinie
      const g = ctx.createLinearGradient(wx - 16, 0, wx + 6, 0);
      g.addColorStop(0, 'rgba(255, 240, 180, 0)');
      g.addColorStop(0.85, 'rgba(255, 245, 200, 0.55)');
      g.addColorStop(1, 'rgba(255, 255, 255, 0.95)');
      ctx.fillStyle = g;
      ctx.fillRect(wx - 16, 0, 22, VIRTUAL_HEIGHT);
      drawGlow(ctx, wx, VIRTUAL_HEIGHT / 2, 60, this.config.accent, 0.25);
      if (Math.random() < 0.9) this.spawnSparks(wx, 20 + Math.random() * (VIRTUAL_HEIGHT - 40), 1, this.config.accent);
    }
    ctx.fillStyle = '#040710';
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, 14);
    ctx.fillRect(0, VIRTUAL_HEIGHT - 14, VIRTUAL_WIDTH, 14);
    this.drawSparksAndFlash(ctx, 1);
    ctx.restore();
    this.renderBanner(ctx, easeInOut((t - 0.5) / 0.12) * fadeOut, false);
    if (this.config.major && t > 0.6 && t < 0.92) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.font = '6px monospace';
      ctx.fillStyle = 'rgba(148, 163, 184, 0.8)';
      ctx.fillText('[KLICK / TASTE] WEITER', VIRTUAL_WIDTH / 2, 10);
      ctx.restore();
    }
  }

  public render(ctx: CanvasRenderingContext2D): void {
    if (this.config.building) {
      this.renderZoom(ctx);
      return;
    }
    if (this.config.room) {
      this.renderRoom(ctx);
      return;
    }
    const art = getHDArt();
    const t = Math.min(1, this.elapsed / this.duration);
    const cx = VIRTUAL_WIDTH / 2;
    const cy = VIRTUAL_HEIGHT / 2;
    const { kind, title, subtitle, accent, major, minaPresent, shipKey } = this.config;

    // Sanfter Ein-/Ausblendfaktor
    const fadeIn = Math.min(1, this.elapsed / 0.14);
    const fadeOut = Math.min(1, (this.duration - this.elapsed) / 0.22);
    const alpha = Math.max(0, Math.min(1, Math.min(fadeIn, fadeOut)));

    ctx.save();
    ctx.globalAlpha = alpha;

    // Abdunklung über der Szene (bei großen Meilensteinen etwas kinematischer)
    ctx.fillStyle = major ? 'rgba(4, 8, 18, 0.72)' : 'rgba(4, 8, 18, 0.46)';
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

    if (major) {
      ctx.fillStyle = '#040710';
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, 18);
      ctx.fillRect(0, VIRTUAL_HEIGHT - 18, VIRTUAL_WIDTH, 18);
    }

    // Zentrale Karte
    const cardW = major ? 284 : 230;
    const cardH = major ? 124 : 74;
    const cardX = Math.round(cx - cardW / 2);
    const cardY = Math.round(cy - cardH / 2);

    ctx.fillStyle = 'rgba(10, 17, 34, 0.94)';
    ctx.fillRect(cardX, cardY, cardW, cardH);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(cardX + 0.75, cardY + 0.75, cardW - 1.5, cardH - 1.5);

    // Glow hinter dem Motiv
    drawGlow(ctx, cx, cardY + (major ? 46 : 26), major ? 54 : 34, accent, 0.26 + Math.sin(this.elapsed * 9) * 0.06);

    // Motiv je Upgrade-Typ
    if (major && kind === 'weapon') {
      const stageY = cardY + 52;
      // Amboss in der Mitte
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(cx - 18, stageY + 6, 36, 10);
      ctx.fillStyle = '#475569';
      ctx.fillRect(cx - 22, stageY + 2, 44, 5);
      // Kael links vom Amboss
      const strikeBob = t < 0.52 ? -Math.abs(Math.sin(this.elapsed * 16)) * 5 : 0;
      if (art.npcKael) {
        ctx.drawImage(art.npcKael, Math.round(cx - 56), Math.round(stageY - 22 + strikeBob), 26, 29);
      }
      // Mina rechts vom Amboss, sobald sie dazugekommen ist!
      if (minaPresent) {
        drawMinaSprite(ctx, cx + 42, stageY + 4 + strikeBob * 0.7, this.elapsed * 2, true);
      }
      // Glühender Rohling → fertiges Waffen-Glänzen ab t >= 0.5
      if (t < 0.5) {
        ctx.fillStyle = '#fb923c';
        ctx.fillRect(cx - 12, stageY - 1, 24, 3);
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(cx - 7, stageY - 1, 14, 2);
      } else {
        const pulse = 1 + Math.sin((t - 0.5) * 14) * 0.12;
        ctx.save();
        ctx.strokeStyle = accent;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, stageY - 10, 15 * pulse, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#fef08a';
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('⚔', cx, stageY - 5);
        ctx.restore();
      }
    } else if (major && kind === 'ship') {
      const spr = (shipKey ? art[shipKey] : null) ?? art.shipCorvette;
      if (spr) {
        ctx.drawImage(spr, Math.round(cx - 26), Math.round(cardY + 14), 52, 52);
      }
      // Blueprint-Scan-Linie
      const scanY = cardY + 14 + ((this.elapsed * 58) % 52);
      ctx.fillStyle = accent;
      ctx.globalAlpha = alpha * 0.7;
      ctx.fillRect(cx - 42, Math.round(scanY), 84, 2);
      ctx.globalAlpha = alpha;
    } else if (major && (kind === 'shop' || kind === 'quarters')) {
      // Goldene Vitrinen-Ikone
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(cx - 24, cardY + 38, 48, 6);
      ctx.fillStyle = '#38e8d4';
      ctx.fillRect(cx - 16, cardY + 24, 32, 14);
      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('★', cx, cardY + 35);
    }

    // Text
    ctx.textAlign = 'center';
    ctx.font = 'bold 6.5px monospace';
    ctx.fillStyle = accent;
    const kicker =
      kind === 'weapon'
        ? minaPresent
          ? 'EXO-SCHMIEDE · KAEL & MINA'
          : 'EXO-SCHMIEDE · NEUE WAFFE'
        : kind === 'quarters'
          ? 'KAPITÄNS-QUARTIER · AUSBAU'
          : kind === 'shop'
          ? 'ASTRO-BARTER · LADEN-AUSBAU'
          : kind === 'ship'
            ? 'RAUMHAFEN · NEUES SCHIFF'
            : kind === 'forge_step'
              ? 'SCHMIEDE-AUFWERTUNG'
              : 'UPGRADE ABGESCHLOSSEN';
    ctx.fillText(kicker, cx, cardY + (major ? 84 : 20));

    ctx.font = major ? 'bold 10px monospace' : 'bold 9px monospace';
    ctx.fillStyle = '#f8fafc';
    ctx.fillText(title, cx, cardY + (major ? 98 : 37));

    ctx.font = '7.5px monospace';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(subtitle, cx, cardY + (major ? 111 : 52));

    if (major) {
      ctx.font = '6px monospace';
      ctx.fillStyle = 'rgba(148, 163, 184, 0.8)';
      ctx.fillText('[KLICK / TASTE] WEITER', cx, VIRTUAL_HEIGHT - 6);
    }

    // Funken
    for (const s of this.sparks) {
      ctx.globalAlpha = alpha * Math.max(0, Math.min(1, s.life / s.maxLife));
      ctx.fillStyle = s.color;
      ctx.fillRect(Math.round(s.x), Math.round(s.y), s.size, s.size);
    }

    // Kurzer Schmiede-Blitz
    if (this.flashAlpha > 0.01) {
      ctx.globalAlpha = this.flashAlpha * alpha;
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    }

    ctx.restore();
  }
}
