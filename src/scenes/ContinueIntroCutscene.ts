import { StationTraffic } from './stationTraffic';
import { getHDArt } from '../assets/artLoader';
import { sound } from '../engine/audio';
import { VIRTUAL_HEIGHT, VIRTUAL_WIDTH, type InputManager } from '../engine/input';
import { getDeviceSettings } from '../systems/deviceSettings';
import type { GameState } from '../systems/gameState';

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}

/**
 * Knackige Rückkehr-Startanimation beim „Weiterspielen“ einer bestehenden Welt:
 * Phase 1: Kurzer Anflug auf Port Solaris (spiegelt Tag/Nacht, Stations-Wachstum, Kapitänsname & Tag)
 * Phase 2: Weiche Licht-Blende direkt in den Laden (Astro-Barter) darunter.
 * Jederzeit per Klick/Taste überspringbar und respektiert `shortCutscenes`.
 */
export class ContinueIntroCutscene {
  private elapsed = 0;
  private readonly approachDur: number;
  private readonly fadeDur: number;
  private readonly totalDur: number;
  private skipped = false;
  private sparks: Spark[] = [];
  private sparkAccum = 0;
  private readonly traffic: StationTraffic;
  private onPointerDown: () => void;
  private onKeyDown: (e: KeyboardEvent) => void;

  private readonly captainName: string;
  private readonly day: number;
  private readonly isNight: boolean;
  private readonly credits: number;
  private readonly ngPlus: number;
  private readonly sectorsCleared: number;
  private readonly solarisTier: 0 | 1 | 2;
  private readonly shipTier: 1 | 2 | 3 | 4;

  constructor(state: GameState) {
    const short = getDeviceSettings().shortCutscenes;
    this.approachDur = short ? 1.15 : 2.15;
    this.fadeDur = short ? 0.55 : 0.85;
    this.totalDur = this.approachDur + this.fadeDur;

    this.captainName = (state.captainName || 'Sternen-Kapitän').slice(0, 22);
    this.day = state.day;
    this.isNight = state.timeOfDay === 'night';
    this.credits = state.credits;
    this.ngPlus = state.ngPlusLevel;
    this.sectorsCleared =
      (state.sector1Cleared ? 1 : 0) +
      (state.sector2Cleared ? 1 : 0) +
      (state.sector3Cleared ? 1 : 0) +
      (state.sector4Cleared ? 1 : 0);
    this.solarisTier =
      state.sector4Cleared || state.omegaCleared ? 2 : state.sector2Cleared ? 1 : 0;
    this.shipTier = state.sector3Cleared ? 4 : state.sector2Cleared ? 3 : state.sector1Cleared ? 2 : 1;
    // Hafenverkehr: je weiter der Ausbau, desto mehr los (das späte Bild hat schon viele Schiffe eingemalt → weniger Zusatz)
    this.traffic = new StationTraffic(this.solarisTier === 2 ? 3 : this.solarisTier === 1 ? 4 : 3, 31 + this.solarisTier);

    this.onPointerDown = () => {
      if (this.elapsed > 0.25) this.skip();
    };
    this.onKeyDown = (e: KeyboardEvent) => {
      if (this.elapsed > 0.25 && (e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape' || e.code === 'KeyE')) {
        e.preventDefault();
        this.skip();
      }
    };
    window.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('keydown', this.onKeyDown);
  }

  public skip(): void {
    if (this.skipped) return;
    this.skipped = true;
    sound.playUiClick();
  }

  public dispose(): void {
    window.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('keydown', this.onKeyDown);
  }

  /** Gibt true zurück, wenn die Szene darunter (ShopScene) bereits sichtbar durchblenden darf. */
  public isBlendingIntoShop(): boolean {
    return this.elapsed >= this.approachDur;
  }

  public update(dt: number, input: InputManager): boolean {
    const safeDt = Math.min(dt, 0.05);
    this.elapsed += safeDt;
    this.traffic.update(safeDt);

    if (
      this.elapsed > 0.25 &&
      (input.wasPressed('Space') || input.wasPressed('Enter') || input.wasPressed('Escape') || input.wasPressed('KeyE'))
    ) {
      this.skip();
    }

    if (this.elapsed < this.approachDur) {
      const p = Math.min(1, this.elapsed / this.approachDur);
      const ease = 1 - Math.pow(1 - p, 2.2);
      const shipX = 104 + ease * 144;
      const shipY = 212 - ease * 62;
      this.sparkAccum += safeDt;
      if (this.sparkAccum >= 0.035) {
        this.sparkAccum = 0;
        this.sparks.push({
          x: shipX - 12 * (1 - p * 0.45),
          y: shipY + 4,
          vx: -38,
          vy: 14,
          life: 0,
          maxLife: 0.38,
        });
      }
      for (let i = this.sparks.length - 1; i >= 0; i--) {
        const s = this.sparks[i];
        s.life += safeDt;
        s.x += s.vx * safeDt;
        s.y += s.vy * safeDt;
        if (s.life >= s.maxLife) this.sparks.splice(i, 1);
      }
    }

    if (this.skipped || this.elapsed >= this.totalDur) {
      this.dispose();
      return true;
    }
    return false;
  }

  public render(ctx: CanvasRenderingContext2D): void {
    const art = getHDArt();
    const bg =
      (this.solarisTier === 2 && art.cutsceneBgSolarisG2) ||
      (this.solarisTier === 1 && art.cutsceneBgSolarisG1) ||
      art.cutsceneBgSolaris ||
      art.cutsceneIntro2;

    const ship =
      (this.shipTier === 4 && art.shipMonolith) ||
      (this.shipTier === 3 && art.shipSolar) ||
      (this.shipTier === 2 && art.shipCrystal) ||
      art.shipCorvette;

    const pApproach = Math.min(1, this.elapsed / this.approachDur);
    const ease = 1 - Math.pow(1 - pApproach, 2.3);
    const pFade = this.elapsed > this.approachDur ? Math.min(1, (this.elapsed - this.approachDur) / this.fadeDur) : 0;
    const overlayAlpha = 1 - pFade * pFade;

    if (overlayAlpha <= 0.005) return;

    ctx.save();
    ctx.globalAlpha = overlayAlpha;

    // Hintergrund-Space + sanfter Zoom auf Port Solaris
    ctx.fillStyle = '#070c17';
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

    if (bg) {
      const zoom = 1.04 + ease * 0.28 + pFade * 0.14;
      const drawW = VIRTUAL_WIDTH * zoom;
      const drawH = VIRTUAL_HEIGHT * zoom;
      const dx = (VIRTUAL_WIDTH - drawW) / 2;
      const dy = (VIRTUAL_HEIGHT - drawH) / 2 + ease * 8;
      ctx.drawImage(bg, dx, dy, drawW, drawH);
      // Hafenverkehr mit demselben Zoom → bleibt an der Station; Helden-Schiff kommt von links unten (Verkehr meidet das)
      this.traffic.render(ctx, { zoom, panX: 0, panY: ease * 8 });
    }

    // Tag-/Nacht-Stimmung auf Port Solaris
    ctx.fillStyle = this.isNight ? 'rgba(15, 23, 54, 0.24)' : 'rgba(251, 191, 36, 0.07)';
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

    // Einfliegendes Schiff Richtung Dock
    for (const s of this.sparks) {
      const a = Math.max(0, 1 - s.life / s.maxLife) * overlayAlpha;
      ctx.fillStyle = a > 0.45 ? `rgba(253, 224, 71, ${a})` : `rgba(56, 232, 212, ${a * 0.8})`;
      ctx.fillRect(Math.round(s.x), Math.round(s.y), 2, 2);
    }

    if (ship && pApproach < 0.98) {
      const shipX = 104 + ease * 144;
      const shipY = 212 - ease * 62;
      const scale = Math.max(0.28, 1 - ease * 0.68);
      const shipAlpha = Math.max(0, 1 - Math.max(0, (pApproach - 0.72) / 0.28));
      ctx.save();
      ctx.globalAlpha = overlayAlpha * shipAlpha;
      ctx.translate(shipX, shipY);
      ctx.rotate(0.72);
      const sz = 44 * scale;
      ctx.drawImage(ship, -sz / 2, -sz / 2, sz, sz);
      ctx.restore();
    }

    // Kino-Balken oben & unten (öffnen sich weich in Phase 2)
    const barH = Math.round(22 * (1 - pFade));
    ctx.fillStyle = '#050811';
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, barH);
    ctx.fillRect(0, VIRTUAL_HEIGHT - barH, VIRTUAL_WIDTH, barH);

    // Warmes Willkommens-Banner im unteren Drittel
    const bannerAlpha =
      Math.min(1, this.elapsed / 0.35) * (1 - Math.min(1, pFade * 1.45));
    if (bannerAlpha > 0.02) {
      ctx.save();
      ctx.globalAlpha = bannerAlpha;
      const bw = 310;
      const bh = 46;
      const bx = (VIRTUAL_WIDTH - bw) / 2;
      const by = VIRTUAL_HEIGHT - 74;

      ctx.fillStyle = 'rgba(10, 16, 28, 0.84)';
      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeStyle = this.isNight ? 'rgba(129, 140, 248, 0.7)' : 'rgba(251, 191, 36, 0.75)';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const ngTag = this.ngPlus > 0 ? ` · NG+${this.ngPlus}` : '';
      const timeTag = this.isNight ? 'NACHTSCHICHT' : 'MORGEN AUF PORT SOLARIS';
      ctx.font = 'bold 7px "Silkscreen", monospace';
      ctx.fillStyle = this.isNight ? '#a5b4fc' : '#fbbf24';
      ctx.fillText(`TAG ${this.day} · ${timeTag}${ngTag}`, VIRTUAL_WIDTH / 2, by + 11);

      ctx.font = 'bold 11px "Chakra Petch", sans-serif';
      ctx.fillStyle = '#f8fafc';
      ctx.fillText(`Willkommen zurück, ${this.captainName}`, VIRTUAL_WIDTH / 2, by + 25);

      ctx.font = '7px "Chakra Petch", sans-serif';
      ctx.fillStyle = '#94a3b8';
      const secText = this.sectorsCleared > 0 ? `${this.sectorsCleared}/4 Sektoren befreit` : 'Astro-Barter bereit';
      ctx.fillText(`${secText}  ·  ${this.credits.toLocaleString('de-DE')} Cr`, VIRTUAL_WIDTH / 2, by + 37);

      // Dezenter Skip-Hinweis
      ctx.font = '6px "Silkscreen", monospace';
      ctx.fillStyle = 'rgba(148, 163, 184, 0.72)';
      ctx.fillText('[KLICK / SPACE] ÜBERSPRINGEN', VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT - 10);
      ctx.restore();
    }

    // Sanfter warmer Übergangs-Bloom kurz vor dem Laden-Eintritt
    if (pFade > 0.05 && pFade < 0.85) {
      const bloom = Math.sin(((pFade - 0.05) / 0.8) * Math.PI) * 0.22;
      ctx.fillStyle = this.isNight
        ? `rgba(129, 140, 248, ${bloom})`
        : `rgba(251, 191, 36, ${bloom})`;
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    }

    ctx.restore();
  }
}
