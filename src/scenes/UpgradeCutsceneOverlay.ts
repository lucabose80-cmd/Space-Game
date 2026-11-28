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

  constructor(config: UpgradeCutsceneConfig) {
    this.config = config;
    const short = getDeviceSettings().shortCutscenes;
    if (config.major) {
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

    if (config.kind === 'weapon' || config.kind === 'forge_step') {
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

  public update(dt: number, input: InputManager): boolean {
    const safeDt = Math.min(0.05, Math.max(0, dt));
    this.elapsed += safeDt;
    this.flashAlpha = Math.max(0, this.flashAlpha - safeDt * 1.4);

    const clicked = this.pointerClicked;
    this.pointerClicked = false;

    const progress = this.elapsed / this.duration;

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

  public render(ctx: CanvasRenderingContext2D): void {
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
