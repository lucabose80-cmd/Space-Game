import { getHDArt } from '../assets/artLoader';
import { VIRTUAL_HEIGHT, VIRTUAL_WIDTH } from '../engine/input';
import type { GameState } from '../systems/gameState';
import { StationTraffic, type TrafficTransform } from './stationTraffic';

interface TitleStar {
  x: number;
  y: number;
  size: number;
  phase: number;
  speed: number;
  tint: string;
}

interface ShootingStar {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}

interface ThrusterSpark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}

/**
 * Lebendiger 16:9-Pixel-Art-Hintergrund für den Startscreen.
 * Nutzt `art.titleBg` (sobald P3-55 geliefert ist) oder nahtlos `cutsceneBgSolaris*`
 * (passend zum Stations-Wachstum des Spielstands) + Sternenfeld, Sternschnuppen,
 * warme Stationslichter und das vorbeiziehende Expeditions-Schiff.
 */
export class TitleBackdrop {
  private t = 0;
  private stars: TitleStar[] = [];
  private shooting: ShootingStar[] = [];
  private sparks: ThrusterSpark[] = [];
  private nextShootIn = 1.6;
  private sparkAccum = 0;
  /** Hafenverkehr (Schiffe fliegen die Schleuse an/aus) — bei Key-Art mit eingemalten Schiffen etwas weniger */
  private traffic: StationTraffic | null = null;
  private trafficKey: 'art' | 'fallback' | null = null;

  constructor() {
    // Deterministische Sternen-Verteilung (keine Zufallssprünge bei Tests)
    const palette = ['#fff7d6', '#d8f3ff', '#a5f3fc', '#fde68a', '#e2e8f0'];
    let seed = 133742;
    const rand = (): number => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0xffffffff;
    };
    for (let i = 0; i < 68; i++) {
      this.stars.push({
        x: Math.floor(rand() * VIRTUAL_WIDTH),
        y: Math.floor(rand() * (VIRTUAL_HEIGHT * 0.85)),
        size: rand() > 0.84 ? 2 : 1,
        phase: rand() * Math.PI * 2,
        speed: 1.2 + rand() * 2.4,
        tint: palette[i % palette.length],
      });
    }
  }

  public update(dt: number, state: GameState): void {
    const safeDt = Math.min(dt, 0.05);
    this.t += safeDt;
    this.ensureTraffic();
    this.traffic?.update(safeDt);

    // Gelegentliche Sternschnuppen am oberen Himmel
    this.nextShootIn -= safeDt;
    if (this.nextShootIn <= 0) {
      const idx = Math.floor(this.t * 3.1) % 3;
      this.shooting.push({
        x: 70 + idx * 125,
        y: 16 + idx * 14,
        vx: 115 + idx * 18,
        vy: 34 + idx * 8,
        life: 0,
        maxLife: 0.72,
      });
      this.nextShootIn = 3.8 + (idx * 1.3);
    }

    for (let i = this.shooting.length - 1; i >= 0; i--) {
      const s = this.shooting[i];
      s.life += safeDt;
      s.x += s.vx * safeDt;
      s.y += s.vy * safeDt;
      if (s.life >= s.maxLife) this.shooting.splice(i, 1);
    }

    // Triebwerks-Funken für das sanft schwebende Expeditions-Schiff (im Fallback-Modus)
    const art = getHDArt();
    if (!art.titleBg) {
      const shipPos = this.getShipPos();
      this.sparkAccum += safeDt;
      if (this.sparkAccum >= 0.055) {
        this.sparkAccum = 0;
        const speedMul = state.sector3Cleared ? 1.15 : 1;
        this.sparks.push({
          x: shipPos.x - 10 + Math.sin(this.t * 17) * 2,
          y: shipPos.y + 15,
          vx: (-18 - (Math.sin(this.t * 9) + 1) * 8) * speedMul,
          vy: (24 + Math.cos(this.t * 13) * 4) * speedMul,
          life: 0,
          maxLife: 0.55,
        });
      }
      for (let i = this.sparks.length - 1; i >= 0; i--) {
        const p = this.sparks[i];
        p.life += safeDt;
        p.x += p.vx * safeDt;
        p.y += p.vy * safeDt;
        if (p.life >= p.maxLife) this.sparks.splice(i, 1);
      }
    }
  }

  private ensureTraffic(): void {
    const key = getHDArt().titleBg ? 'art' : 'fallback';
    if (this.trafficKey === key) return;
    this.trafficKey = key;
    this.traffic = new StationTraffic(key === 'art' ? 3 : 4, 777);
  }

  private getShipPos(): { x: number; y: number; tilt: number } {
    const bob = Math.sin(this.t * 1.15) * 4.5;
    const drift = Math.sin(this.t * 0.42) * 10;
    return {
      x: 132 + drift,
      y: 206 + bob,
      tilt: 0.54 + Math.cos(this.t * 1.15) * 0.035,
    };
  }

  private pickSolarisBg(state: GameState): HTMLCanvasElement | null {
    const art = getHDArt();
    if (art.titleBg) return art.titleBg;
    if (state.hasSave()) {
      if ((state.sector4Cleared || state.omegaCleared) && art.cutsceneBgSolarisG2) {
        return art.cutsceneBgSolarisG2;
      }
      if (state.sector2Cleared && art.cutsceneBgSolarisG1) {
        return art.cutsceneBgSolarisG1;
      }
    }
    return art.cutsceneBgSolaris ?? art.cutsceneIntro2 ?? null;
  }

  private pickHeroShip(state: GameState): HTMLCanvasElement | null {
    const art = getHDArt();
    if (state.hasSave()) {
      if (state.sector3Cleared && art.shipMonolith) return art.shipMonolith;
      if (state.sector2Cleared && art.shipSolar) return art.shipSolar;
      if (state.sector1Cleared && art.shipCrystal) return art.shipCrystal;
    }
    return art.shipCorvette;
  }

  public render(ctx: CanvasRenderingContext2D, state: GameState): void {
    const art = getHDArt();
    const bg = this.pickSolarisBg(state);

    // 1. Tiefer Nachthimmel als Grundschicht (kein weißes/schwarzes Flackern beim Laden)
    const skyGrad = ctx.createLinearGradient(0, 0, 0, VIRTUAL_HEIGHT);
    skyGrad.addColorStop(0, '#070c17');
    skyGrad.addColorStop(0.55, '#0c1829');
    skyGrad.addColorStop(1, '#09111f');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

    // 2. Haupt-Artwork mit ganz sanfter, lebendiger Kamera-Atmung (genug Zoom-Überstand gegen Rand-Nähte)
    let tf: TrafficTransform | undefined;
    if (bg) {
      const baseZoom = art.titleBg ? 1.04 : 1.16;
      const zoom = baseZoom + Math.sin(this.t * 0.25) * 0.014;
      const panX = art.titleBg ? Math.sin(this.t * 0.18) * 3 : 24 + Math.sin(this.t * 0.18) * 3;
      const panY = Math.cos(this.t * 0.22) * 2;
      const drawW = VIRTUAL_WIDTH * zoom;
      const drawH = VIRTUAL_HEIGHT * zoom;
      const dx = (VIRTUAL_WIDTH - drawW) / 2 + panX;
      const dy = (VIRTUAL_HEIGHT - drawH) / 2 + panY;
      ctx.drawImage(bg, dx, dy, drawW, drawH);
      tf = { zoom, panX, panY };
    }

    // 3. Funkelnde Sterne im Hintergrund / oberen Himmel
    for (const st of this.stars) {
      const pulse = 0.28 + 0.72 * (0.5 + 0.5 * Math.sin(this.t * st.speed + st.phase));
      ctx.globalAlpha = pulse * (bg ? 0.55 : 0.92);
      ctx.fillStyle = st.tint;
      ctx.fillRect(st.x, st.y, st.size, st.size);
    }
    ctx.globalAlpha = 1;

    // 4. Sternschnuppen
    for (const s of this.shooting) {
      const p = s.life / s.maxLife;
      const alpha = Math.sin(p * Math.PI) * 0.85;
      ctx.save();
      ctx.globalAlpha = alpha;
      const grad = ctx.createLinearGradient(s.x, s.y, s.x - s.vx * 0.16, s.y - s.vy * 0.16);
      grad.addColorStop(0, '#fffbeb');
      grad.addColorStop(0.4, '#67e8f9');
      grad.addColorStop(1, 'rgba(103, 232, 249, 0)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x - s.vx * 0.16, s.y - s.vy * 0.16);
      ctx.stroke();
      ctx.restore();
    }

    // 5. Warmes Pulsieren der Astro-Barter-Kuppel & Hangar-Schleuse auf Port Solaris
    const stationX = art.titleBg ? VIRTUAL_WIDTH * 0.68 : VIRTUAL_WIDTH * 0.56;
    const stationY = art.titleBg ? VIRTUAL_HEIGHT * 0.44 : VIRTUAL_HEIGHT * 0.36;
    const domePulse = 0.14 + Math.sin(this.t * 1.9) * 0.05;
    const warmGlow = ctx.createRadialGradient(stationX, stationY, 4, stationX, stationY, 76);
    warmGlow.addColorStop(0, `rgba(251, 191, 36, ${domePulse})`);
    warmGlow.addColorStop(0.5, `rgba(245, 158, 11, ${domePulse * 0.42})`);
    warmGlow.addColorStop(1, 'rgba(245, 158, 11, 0)');
    ctx.fillStyle = warmGlow;
    ctx.fillRect(stationX - 80, stationY - 80, 160, 160);

    const bayX = stationX - 4;
    const bayY = stationY + 52;
    const bayPulse = 0.15 + Math.sin(this.t * 2.5 + 1.2) * 0.05;
    const cyanGlow = ctx.createRadialGradient(bayX, bayY, 3, bayX, bayY, 54);
    cyanGlow.addColorStop(0, `rgba(56, 232, 212, ${bayPulse})`);
    cyanGlow.addColorStop(1, 'rgba(56, 232, 212, 0)');
    ctx.fillStyle = cyanGlow;
    ctx.fillRect(bayX - 56, bayY - 56, 112, 112);

    // 5b. Hafenverkehr: Pendler, Frachter & Taxis fliegen die Schleuse an und aus (hinter dem Helden-Schiff)
    this.traffic?.render(ctx, tf);

    // 6. Expeditions-Schiff im Vordergrund (nur wenn Fallback-Hintergrund ohne Schiff genutzt wird)
    if (!art.titleBg) {
      for (const p of this.sparks) {
        const a = Math.max(0, 1 - p.life / p.maxLife);
        ctx.fillStyle = a > 0.5 ? `rgba(253, 224, 71, ${a * 0.75})` : `rgba(56, 232, 212, ${a * 0.65})`;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2);
      }

      const ship = this.pickHeroShip(state);
      if (ship) {
        const pos = this.getShipPos();
        ctx.save();
        ctx.translate(pos.x, pos.y);
        ctx.rotate(pos.tilt);
        // Sanfter Triebwerksschein
        const glow = ctx.createRadialGradient(-16, 4, 1, -16, 4, 18);
        glow.addColorStop(0, 'rgba(251, 191, 36, 0.55)');
        glow.addColorStop(0.5, 'rgba(56, 232, 212, 0.25)');
        glow.addColorStop(1, 'rgba(56, 232, 212, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(-34, -14, 36, 36);

        const drawSize = 46;
        ctx.drawImage(ship, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
        ctx.restore();
      }
    }

    // 7. Dezente linke Lesbarkeits-Vignette, damit das UI links klar steht und Port Solaris rechts strahlt
    const leftWash = ctx.createLinearGradient(0, 0, VIRTUAL_WIDTH * 0.72, 0);
    leftWash.addColorStop(0, 'rgba(7, 11, 20, 0.78)');
    leftWash.addColorStop(0.52, 'rgba(8, 14, 26, 0.42)');
    leftWash.addColorStop(1, 'rgba(8, 14, 26, 0.04)');
    ctx.fillStyle = leftWash;
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

    // Sanfter unterer und oberer Kino-Rand-Verlauf
    const vGrad = ctx.createLinearGradient(0, 0, 0, VIRTUAL_HEIGHT);
    vGrad.addColorStop(0, 'rgba(6, 10, 18, 0.46)');
    vGrad.addColorStop(0.2, 'rgba(6, 10, 18, 0)');
    vGrad.addColorStop(0.82, 'rgba(6, 10, 18, 0)');
    vGrad.addColorStop(1, 'rgba(6, 10, 18, 0.55)');
    ctx.fillStyle = vGrad;
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
  }
}
