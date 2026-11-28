import { getHDArt } from '../assets/artLoader';
import { VIRTUAL_HEIGHT, VIRTUAL_WIDTH } from '../engine/input';

/**
 * Lebendiger Hafenverkehr an Port Solaris (Außenansichten: Startscreen, Intro-Panel, Rückflug, „Weiterspielen“-Anflug).
 * Kleine Pendler, Frachter, Jäger, Taxis & Drohnen fliegen die Hangar-Schleuse an, verschwinden im Cyan-Licht,
 * kommen wieder heraus oder ziehen ruhig im Hintergrund vorbei. Rein optisch, deterministisch (eigener LCG, kein Math.random).
 *
 * Koordinaten = 480×270 virtuell, passend zu den 960×540-Hintergründen `cutscene_bg_solaris*` / `title_bg` / `cutscene_intro_2`
 * (Schleuse ≈ (242, 155)). Bahnen laufen bewusst oben/rechts und aus der Schleuse nach links-oben — der linke untere Bereich
 * bleibt frei für das Helden-Schiff der Anflug-Cutscenes (dort fliegt es von links unten in die Schleuse).
 */
export const BAY_POS = { x: 242, y: 156 };

export interface TrafficTransform {
  zoom: number;
  panX: number;
  panY: number;
}

export type TrafficLane = 'inbound' | 'outbound' | 'pass_top' | 'pass_low';

interface Vessel {
  lane: TrafficLane;
  kind: number; // 0..5 → trafficShip1..6
  t: number; // 0..1 Fortschritt
  speed: number; // 1/s
  x0: number;
  y0: number;
  cx: number;
  cy: number;
  x1: number;
  y1: number;
  size: number; // Basis-Breite in px
  alpha: number;
}

const SPRITE_KEYS = ['trafficShip1', 'trafficShip2', 'trafficShip3', 'trafficShip4', 'trafficShip5', 'trafficShip6'] as const;
const SIZE_BY_KIND = [24, 30, 24, 22, 28, 15];

export class StationTraffic {
  private vessels: Vessel[] = [];
  private seed: number;
  private target: number;
  private spawnIn = 0;
  private bayFlash = 0;
  private time = 0;
  private readonly lanes: TrafficLane[];

  /** @param lanes erlaubte Bahnen (z. B. nur `pass_top`, wenn ein Helden-Schiff die unteren Bahnen braucht)
   *  @param count gewünschte Zahl gleichzeitiger Schiffe (Standard 4; Hintergründe mit vielen eingemalten Schiffen: 2–3) */
  constructor(count = 4, seed = 4242, lanes: TrafficLane[] = ['inbound', 'outbound', 'pass_top', 'pass_low']) {
    this.lanes = lanes.length ? lanes : ['pass_top'];
    this.seed = seed >>> 0;
    this.target = count;
    for (let i = 0; i < count; i++) {
      const v = this.makeVessel(i);
      v.t = (i + 0.35) / (count + 0.4); // sofort verteilt statt alle am Rand
      this.vessels.push(v);
    }
  }

  private rand(): number {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  private makeVessel(index: number): Vessel {
    const r = this.rand();
    // Rotation der Bahnen: 2 Anflüge, 1–2 Abflüge, Rest Vorbeiflug
    const laneRoll = (index + Math.floor(r * 3)) % 5;
    let lane: TrafficLane = laneRoll < 2 ? 'inbound' : laneRoll === 2 ? 'outbound' : laneRoll === 3 ? 'pass_top' : 'pass_low';
    if (!this.lanes.includes(lane)) lane = this.lanes[(index + laneRoll) % this.lanes.length];
    const kind = Math.floor(this.rand() * 6);
    const size = SIZE_BY_KIND[kind];
    const v: Vessel = {
      lane,
      kind,
      t: 0,
      speed: 0.1 + this.rand() * 0.05,
      x0: 0,
      y0: 0,
      cx: 0,
      cy: 0,
      x1: 0,
      y1: 0,
      size,
      alpha: 1,
    };
    if (lane === 'inbound') {
      // von rechts-oben/rechts in sanftem Bogen zur Schleuse
      v.x0 = 500;
      v.y0 = 40 + this.rand() * 110;
      v.cx = 360 + this.rand() * 30;
      v.cy = 215 + this.rand() * 25;
      v.x1 = BAY_POS.x + 4;
      v.y1 = BAY_POS.y + 2;
      v.speed = 0.085 + this.rand() * 0.04;
    } else if (lane === 'outbound') {
      // aus der Schleuse zunächst nach unten, dann Bogen nach rechts-unten weg (kreuzt nie den Helden-Anflug von links)
      v.x0 = BAY_POS.x - 2;
      v.y0 = BAY_POS.y + 4;
      v.cx = 300 + this.rand() * 40;
      v.cy = 262;
      v.x1 = 505;
      v.y1 = 215 + this.rand() * 45;
      v.speed = 0.085 + this.rand() * 0.035;
    } else if (lane === 'pass_top') {
      const dirRight = this.rand() > 0.5;
      v.x0 = dirRight ? -30 : 510;
      v.x1 = dirRight ? 510 : -30;
      v.y0 = 18 + this.rand() * 40;
      v.y1 = v.y0 + (this.rand() - 0.4) * 24;
      v.cx = 240;
      v.cy = Math.min(v.y0, v.y1) - 8;
      v.size *= 0.62;
      v.alpha = 0.82;
      v.speed = 0.055 + this.rand() * 0.03;
    } else {
      // tief rechts unten von rechts nach links bis zur Bildmitte-Rechts, dann wieder ab (weit weg, klein)
      const dirRight = this.rand() > 0.55;
      v.x0 = dirRight ? 250 : 510;
      v.x1 = dirRight ? 510 : 250;
      v.y0 = 215 + this.rand() * 40;
      v.y1 = v.y0 + (this.rand() - 0.5) * 30;
      v.cx = 380;
      v.cy = v.y0 + 10;
      v.size *= 0.55;
      v.alpha = 0.7;
      v.speed = 0.06 + this.rand() * 0.03;
    }
    return v;
  }

  public update(dt: number): void {
    const d = Math.min(dt, 0.05);
    this.time += d;
    this.bayFlash = Math.max(0, this.bayFlash - d * 2.2);
    for (let i = this.vessels.length - 1; i >= 0; i--) {
      const v = this.vessels[i];
      const before = v.t;
      v.t += v.speed * d;
      // Verschwinden in der Schleuse → kurzes Aufleuchten
      if (v.lane === 'inbound' && before < 0.92 && v.t >= 0.92) this.bayFlash = 1;
      if (v.t >= 1) this.vessels.splice(i, 1);
    }
    this.spawnIn -= d;
    if (this.vessels.length < this.target && this.spawnIn <= 0) {
      this.vessels.push(this.makeVessel(Math.floor(this.rand() * 5)));
      this.spawnIn = 1.1 + this.rand() * 1.4;
    }
  }

  private pos(v: Vessel): { x: number; y: number; ang: number } {
    const t = v.t;
    const u = 1 - t;
    const x = u * u * v.x0 + 2 * u * t * v.cx + t * t * v.x1;
    const y = u * u * v.y0 + 2 * u * t * v.cy + t * t * v.y1;
    const dx = 2 * u * (v.cx - v.x0) + 2 * t * (v.x1 - v.cx);
    const dy = 2 * u * (v.cy - v.y0) + 2 * t * (v.y1 - v.cy);
    return { x, y, ang: Math.atan2(dy, Math.max(0.001, Math.abs(dx))) };
  }

  /** Zeichnet den Verkehr. `tf` = dieselbe Zoom/Pan-Transformation wie das Hintergrundbild (Schiffe bleiben an der Station „kleben“). */
  public render(ctx: CanvasRenderingContext2D, tf?: TrafficTransform, globalAlpha = 1): void {
    const art = getHDArt();
    ctx.save();
    if (tf) {
      ctx.translate(VIRTUAL_WIDTH / 2 + tf.panX, VIRTUAL_HEIGHT / 2 + tf.panY);
      ctx.scale(tf.zoom, tf.zoom);
      ctx.translate(-VIRTUAL_WIDTH / 2, -VIRTUAL_HEIGHT / 2);
    }

    // Schleusen-Aufleuchten, wenn ein Schiff hineinfliegt
    if (this.bayFlash > 0.01) {
      const g = ctx.createRadialGradient(BAY_POS.x, BAY_POS.y, 2, BAY_POS.x, BAY_POS.y, 30);
      g.addColorStop(0, `rgba(165, 243, 252, ${(0.34 * this.bayFlash * globalAlpha).toFixed(3)})`);
      g.addColorStop(1, 'rgba(56, 232, 212, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(BAY_POS.x - 32, BAY_POS.y - 32, 64, 64);
    }

    for (const v of this.vessels) {
      const p = this.pos(v);
      const dx = this.dirX(v);
      // Tiefe: Anflug schrumpft zur Schleuse, Abflug wächst heraus
      let scale = 1;
      let fade = 1;
      if (v.lane === 'inbound') {
        scale = 1 - Math.max(0, v.t - 0.45) * 1.15;
        fade = v.t > 0.82 ? Math.max(0, 1 - (v.t - 0.82) / 0.16) : 1;
      } else if (v.lane === 'outbound') {
        scale = 0.38 + Math.min(1, v.t / 0.45) * 0.62;
        fade = v.t < 0.1 ? v.t / 0.1 : v.t > 0.88 ? Math.max(0, 1 - (v.t - 0.88) / 0.12) : 1;
      } else {
        fade = v.t < 0.1 ? v.t / 0.1 : v.t > 0.9 ? (1 - v.t) / 0.1 : 1;
      }
      const alpha = Math.max(0, Math.min(1, fade)) * v.alpha * globalAlpha;
      if (alpha < 0.02) continue;
      const w = Math.max(5, v.size * scale);
      this.drawShip(ctx, art, v.kind, p.x, p.y, w, p.ang, dx < 0, alpha);
    }
    ctx.restore();
  }

  private dirX(v: Vessel): number {
    const t = v.t;
    const u = 1 - t;
    return 2 * u * (v.cx - v.x0) + 2 * t * (v.x1 - v.cx);
  }

  private drawShip(
    ctx: CanvasRenderingContext2D,
    art: ReturnType<typeof getHDArt>,
    kind: number,
    x: number,
    y: number,
    w: number,
    ang: number,
    facingLeft: boolean,
    alpha: number,
  ): void {
    const img = art[SPRITE_KEYS[kind]];
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(Math.round(x), Math.round(y + Math.sin(this.time * 2.1 + kind) * 0.6));
    if (facingLeft) ctx.scale(-1, 1);
    ctx.rotate(ang);
    // Triebwerksschein (Sprite hat Flamme links; zusätzlich weicher Glow)
    const gl = ctx.createRadialGradient(-w * 0.5, 0, 0.5, -w * 0.5, 0, w * 0.35);
    gl.addColorStop(0, 'rgba(251, 191, 36, 0.45)');
    gl.addColorStop(1, 'rgba(251, 146, 60, 0)');
    ctx.fillStyle = gl;
    ctx.fillRect(-w * 0.9, -w * 0.4, w * 0.8, w * 0.8);
    if (img) {
      const h = (w * 40) / 64;
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
    } else {
      // prozeduraler Rückfall: kleiner Rumpf mit Cockpit & Flamme
      const hw = w * 0.5;
      const hh = Math.max(2, w * 0.17);
      ctx.fillStyle = '#475569';
      ctx.fillRect(-hw * 0.7, -hh, hw * 1.7, hh * 2);
      ctx.fillStyle = '#b45309';
      ctx.fillRect(-hw * 0.7, hh - 1, hw * 1.7, 1);
      ctx.fillStyle = '#67e8f9';
      ctx.fillRect(hw * 0.5, -hh + 1, Math.max(2, w * 0.14), Math.max(1, hh * 0.7));
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(-hw * 0.7 - 3, -1, 3, 2);
    }
    ctx.restore();
  }
}
