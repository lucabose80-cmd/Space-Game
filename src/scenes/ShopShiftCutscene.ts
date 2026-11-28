import { sound } from '../engine/audio';
import { VIRTUAL_HEIGHT, VIRTUAL_WIDTH, type InputManager } from '../engine/input';
import { getDeviceSettings } from '../systems/deviceSettings';

export interface ShopShiftConfig {
  mode: 'open' | 'close';
  /** Nur beim Schließen: Schicht-Bilanz für die Schlusskarte */
  itemsSold?: number;
  credits?: number;
  /** Nächster Zeitabschnitt nach Ladenschluss (Text der Schlusskarte) */
  nextLabel?: string;
}

const SKIP_LOCK_SEC = 0.3;
const OPEN_DUR = 1.45;
const CLOSE_DUR = 1.95;

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}
function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/**
 * Kurze „Rolltor“-Cutscene beim Öffnen & Schließen von Astro-Barter (≈ 1,5–2 s, überspringbar):
 * - ÖFFNEN: das Rolltor fährt hoch, warmes Licht flutet den Laden, das Neonschild „OFFEN“ flackert an.
 * - SCHLIESSEN: das Rolltor rattert herunter, Licht gedimmt, Schild „GESCHLOSSEN“ + Schicht-Bilanz.
 * Rein optisch — der Spielzustand (Öffnen/Schicht/Zeitwechsel) ist beim Start bereits umgestellt (Learning #5 in `handoff/cutscenes.md`).
 */
export class ShopShiftCutscene {
  private t = 0;
  private skipped = false;
  private playedBell = false;
  private playedChime = false;
  private readonly dur: number;
  private readonly cfg: ShopShiftConfig;

  constructor(cfg: ShopShiftConfig) {
    this.cfg = cfg;
    const base = cfg.mode === 'open' ? OPEN_DUR : CLOSE_DUR;
    this.dur = getDeviceSettings().shortCutscenes ? base * 0.65 : base;
  }

  public get mode(): 'open' | 'close' {
    return this.cfg.mode;
  }

  public seek(sec: number): void {
    this.t = Math.max(0, Math.min(this.dur, sec));
  }

  public dispose(): void {
    /* keine globalen Listener */
  }

  /** true = fertig */
  public update(dt: number, input: InputManager): boolean {
    this.t += Math.min(dt, 0.05);
    const isOpen = this.cfg.mode === 'open';
    const moveEnd = isOpen ? 0.95 : 1.0;
    if (!this.playedBell && this.t >= (isOpen ? 0.05 : moveEnd * 0.85)) {
      this.playedBell = true;
      sound.playShopBell();
    }
    if (!this.playedChime && this.t >= (isOpen ? moveEnd : moveEnd + 0.15)) {
      this.playedChime = true;
      sound.playStoryChime();
    }
    if (this.t >= SKIP_LOCK_SEC) {
      if (
        input.wasPressed('Space', true) ||
        input.wasPressed('Enter', true) ||
        input.wasPressed('Escape', true) ||
        input.wasPressed('KeyE', true) ||
        input.primaryPressed()
      ) {
        this.skipped = true;
      }
    }
    return this.skipped || this.t >= this.dur;
  }

  public render(ctx: CanvasRenderingContext2D): void {
    const isOpen = this.cfg.mode === 'open';
    const moveEnd = isOpen ? 0.95 : 1.0;
    const p = easeInOut(clamp01(this.t / moveEnd));
    // Unterkante des Rolltors: Öffnen = fährt von unten nach oben weg, Schließen = von oben nach unten herunter
    const bottom = isOpen ? VIRTUAL_HEIGHT * (1 - p) : VIRTUAL_HEIGHT * p;
    const fadeOut = this.t > this.dur - 0.25 ? clamp01((this.dur - this.t) / 0.25) : 1;

    ctx.save();
    ctx.globalAlpha = fadeOut;

    // Beim Schließen: Laden wird nach und nach abgedunkelt (Schicht ist zu)
    if (!isOpen) {
      ctx.fillStyle = `rgba(6, 10, 22, ${(0.5 * p).toFixed(3)})`;
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    }

    // Warmes Licht strömt unter dem Rolltor hervor (nur Öffnen)
    if (isOpen && bottom < VIRTUAL_HEIGHT) {
      const g = ctx.createLinearGradient(0, bottom, 0, bottom + 70);
      g.addColorStop(0, 'rgba(253, 224, 71, 0.55)');
      g.addColorStop(1, 'rgba(251, 191, 36, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, bottom, VIRTUAL_WIDTH, 70);
    }

    // Rolltor aus Lamellen
    if (bottom > 0.5) {
      const slat = 9;
      for (let y = 0; y < bottom; y += slat) {
        const h = Math.min(slat, bottom - y);
        ctx.fillStyle = '#3a4252';
        ctx.fillRect(0, y, VIRTUAL_WIDTH, h);
        ctx.fillStyle = '#5b667a';
        ctx.fillRect(0, y, VIRTUAL_WIDTH, 1);
        ctx.fillStyle = '#1d2330';
        ctx.fillRect(0, y + h - 2, VIRTUAL_WIDTH, Math.min(2, h));
      }
      // Führungs-Nieten alle 60 px
      ctx.fillStyle = '#7b879b';
      for (let x = 18; x < VIRTUAL_WIDTH; x += 60) {
        for (let y = 4; y < bottom; y += slat * 3) ctx.fillRect(x, y, 2, 2);
      }
      // Beschriftung auf dem Tor (mit der Unterkante mitwandernd)
      const ty = Math.round(bottom - 46);
      if (ty > 20) {
        ctx.font = 'bold 14px "Silkscreen", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(251, 191, 36, 0.85)';
        ctx.fillText('ASTRO-BARTER', VIRTUAL_WIDTH / 2, ty);
        ctx.font = '7px "Silkscreen", monospace';
        ctx.fillStyle = 'rgba(148, 163, 184, 0.9)';
        ctx.fillText(isOpen ? 'GESCHLOSSEN' : 'LADENSCHLUSS', VIRTUAL_WIDTH / 2, ty + 14);
      }
      // Warn-Streifen-Kante (Gelb/Schwarz) mit Griff
      const barY = Math.round(bottom - 7);
      for (let x = -((this.t * 20) % 16); x < VIRTUAL_WIDTH; x += 16) {
        ctx.fillStyle = '#facc15';
        ctx.fillRect(x, barY, 8, 7);
        ctx.fillStyle = '#18181b';
        ctx.fillRect(x + 8, barY, 8, 7);
      }
      ctx.fillStyle = '#9ca3af';
      ctx.fillRect(VIRTUAL_WIDTH / 2 - 14, barY - 3, 28, 3);

      // Funken & Staub an der Unterkante, solange das Tor sich bewegt
      if (this.t < moveEnd) {
        for (let i = 0; i < 14; i++) {
          const ph = (this.t * 2.2 + i * 0.37) % 1;
          const sx = (i * 67 + 21) % VIRTUAL_WIDTH;
          const sy = bottom + ph * 16 * (isOpen ? 1 : -0.4);
          ctx.globalAlpha = fadeOut * (1 - ph) * 0.9;
          ctx.fillStyle = i % 3 === 0 ? '#fde047' : '#e5e7eb';
          ctx.fillRect(sx, Math.round(sy), 2, 2);
        }
        ctx.globalAlpha = fadeOut;
      }
    }

    // Neonschild
    const signStart = moveEnd - (isOpen ? 0.0 : 0.05);
    if (this.t >= signStart) {
      const st = this.t - signStart;
      // Flackern in den ersten 0,35 s
      const flicker = st < 0.35 ? (Math.sin(st * 70) > -0.2 ? 1 : 0.15) : 1;
      const col = isOpen ? '#4ade80' : '#f87171';
      const cy = isOpen ? 52 : 96;
      const label = isOpen ? '★  OFFEN  ★' : 'GESCHLOSSEN';
      ctx.save();
      ctx.globalAlpha = fadeOut * flicker;
      const w = 150;
      const h = 30;
      const x = (VIRTUAL_WIDTH - w) / 2;
      const y = cy - h / 2;
      const glow = ctx.createRadialGradient(VIRTUAL_WIDTH / 2, cy, 6, VIRTUAL_WIDTH / 2, cy, 110);
      glow.addColorStop(0, isOpen ? 'rgba(74, 222, 128, 0.35)' : 'rgba(248, 113, 113, 0.32)');
      glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, cy - 110, VIRTUAL_WIDTH, 220);
      ctx.fillStyle = 'rgba(8, 12, 22, 0.88)';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 14px "Silkscreen", monospace';
      ctx.fillStyle = col;
      ctx.fillText(label, VIRTUAL_WIDTH / 2, cy + 1);
      if (!isOpen) {
        ctx.font = 'bold 9px "Chakra Petch", sans-serif';
        ctx.fillStyle = '#e2e8f0';
        const sold = this.cfg.itemsSold ?? 0;
        const line =
          sold > 0 ? `${sold} Relikte verkauft · ${(this.cfg.credits ?? 0).toLocaleString('de-DE')} Cr` : 'Heute lief nichts über den Tresen';
        ctx.fillText(line, VIRTUAL_WIDTH / 2, cy + 28);
        if (this.cfg.nextLabel) {
          ctx.font = '7px "Silkscreen", monospace';
          ctx.fillStyle = '#94a3b8';
          ctx.fillText(this.cfg.nextLabel, VIRTUAL_WIDTH / 2, cy + 42);
        }
      }
      ctx.restore();
    }

    // Dezenter Skip-Hinweis
    ctx.globalAlpha = fadeOut * 0.7;
    ctx.font = '6px "Silkscreen", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('[KLICK / SPACE] ÜBERSPRINGEN', VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT - 6);
    ctx.restore();
  }
}
