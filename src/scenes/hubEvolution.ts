/**
 * Meilenstein 10-A — Lebendige Raumstation: Stations-Entwicklung der Promenade je Kapitel & Entscheidung.
 *
 * Entscheidungsregel: Linien/Partikel (Kabel, Wimpel, Feuerwerk, Licht) werden prozedural gezeichnet.
 * Objekte mit Volumen nutzen das optionale Sprite (src/assets/artLoader.ts → M10_OPTIONAL_SPRITES);
 * fehlt die PNG-Datei, zeichnet dieser Renderer einen prozeduralen Fallback im selben Pixel-Look.
 * Keine neuen Hub-Hintergründe: Kollisionen & Prompts hängen an hub_bg.png.
 */
import { getHDArt, type M10SpriteKey } from '../assets/artLoader';
import { drawGlow, drawPixelShadow } from '../assets/pixelArt';
import { SUIT_THEMES } from '../data/companions';
import type { GameState } from '../systems/gameState';
import type { StoryFlagId } from '../types';

export interface HubDrawable {
  y: number;
  draw: () => void;
}

export interface HubAnchors {
  forge: { x: number; y: number };
  medbay: { x: number; y: number };
  nyxNpc: { x: number; y: number };
  techNpc: { x: number; y: number };
  guild: { x: number; y: number };
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
}

const OUTLINE = '#0b1020';

function rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string, stroke?: string): void {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 0.8;
    ctx.strokeRect(x + 0.4, y + 0.4, w - 0.8, h - 0.8);
  }
}

function poly(ctx: CanvasRenderingContext2D, pts: Array<[number, number]>, fill: string, stroke?: string): void {
  ctx.beginPath();
  pts.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }
}

/** Zeichnet ein Sprite mit Fuß-Mitte bei (x, footY). */
function drawSpriteFoot(ctx: CanvasRenderingContext2D, spr: HTMLCanvasElement, x: number, footY: number, w: number, h: number): void {
  ctx.drawImage(spr, Math.round(x - w / 2), Math.round(footY - h), w, h);
}

export class HubEvolutionRenderer {
  private state: GameState;
  private anchors: HubAnchors;
  private sparks: Spark[] = [];
  private flashes: Array<{ x: number; y: number; life: number; color: string }> = [];
  private fireworkTimer = 1.2;
  /** Nur für Tests: false erzwingt überall den prozeduralen Fallback. */
  public spritesEnabled = true;

  constructor(state: GameState, anchors: HubAnchors) {
    this.state = state;
    this.anchors = anchors;
  }

  // ---------- Zustand ----------
  private get chapter(): number {
    return this.state.story.chapter;
  }

  private flag(f: StoryFlagId): boolean {
    return this.state.story.flags.includes(f);
  }

  private sprite(key: M10SpriteKey): HTMLCanvasElement | null {
    return this.spritesEnabled ? getHDArt()[key] : null;
  }

  /** Test-Hook: IDs aller aktuell sichtbaren Elemente. */
  public getActiveElementIds(): string[] {
    const ids: string[] = [];
    if (this.chapter >= 1) ids.push('lights');
    if (this.chapter >= 2) ids.push('crystal_lanterns');
    if (this.chapter >= 3) ids.push('pennants');
    if (this.chapter >= 4) ids.push('obelisk');
    if (this.chapter >= 5) ids.push('banners', 'fireworks');
    if (this.chapter >= 6) ids.push('cycle_holo');
    if (this.flag('kael_memorial')) ids.push('kael_memorial');
    if (this.flag('kael_forward')) ids.push('forge_glow');
    if (this.flag('lyra_clinic')) ids.push('echo_sign');
    if (this.flag('nyx_redeemed')) ids.push('free_lantern');
    if (this.flag('vex_spiral')) ids.push('vex_beacon');
    if (this.flag('vex_stays')) ids.push('vex_classboard');
    return ids;
  }

  /** Test-Hook: Anzahl aktiver Feuerwerks-Funken. */
  public getSparkCount(): number {
    return this.sparks.length;
  }

  /** Test-Hook: löst sofort ein Feuerwerk aus. */
  public debugFirework(): void {
    this.spawnFirework();
  }

  /** Kollisionskreise (Obelisk, Leuchtfeuer, Lehrtafel) für Hub-Bewegung & Passanten. */
  public getColliders(): Array<{ x: number; y: number; r: number }> {
    const out: Array<{ x: number; y: number; r: number }> = [];
    if (this.chapter >= 4) out.push({ x: OBELISK.x, y: OBELISK.y - 2, r: 8 });
    if (this.flag('vex_spiral') || this.flag('vex_stays')) out.push({ x: VEX_DECO.x, y: VEX_DECO.y - 2, r: 6 });
    return out;
  }

  // ---------- Layer ----------
  /** VOR den y-sortierten Drawables: Kabel, Wimpel (Linien-Elemente) & Esse-Funken-Glow. */
  public renderBackLayer(ctx: CanvasRenderingContext2D, time: number, isNight: boolean): void {
    const night = isNight ? 1 : 0;
    if (this.chapter >= 1) this.renderLights(ctx, time, night);
    if (this.chapter >= 3) this.renderPennants(ctx, time);
    if (this.flag('kael_forward')) {
      const pulse = 0.5 + 0.5 * Math.sin(time * 5.5);
      drawGlow(ctx, this.anchors.forge.x - 12, this.anchors.forge.y - 44, 34, '#fb923c', 0.18 + pulse * 0.12);
      drawGlow(ctx, this.anchors.forge.x - 12, this.anchors.forge.y - 44, 16, '#fde047', 0.16 + pulse * 0.1);
    }
  }

  /** Nach Sternen/Glows, vor Entities: Feuerwerk am Himmel über dem Aussichtsfenster. */
  public renderSkyLayer(ctx: CanvasRenderingContext2D, dt: number): void {
    if (this.chapter >= 5) {
      this.fireworkTimer -= dt;
      if (this.fireworkTimer <= 0) {
        this.fireworkTimer = 2.5 + Math.random() * 1.5;
        this.spawnFirework();
      }
    }
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i];
      f.life -= dt;
      if (f.life <= 0) {
        this.flashes.splice(i, 1);
        continue;
      }
      drawGlow(ctx, f.x, f.y, 20, f.color, Math.min(0.55, f.life * 2.2));
    }
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const p = this.sparks[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 22 * dt;
      p.life -= dt;
      if (p.life <= 0) {
        this.sparks.splice(i, 1);
        continue;
      }
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2);
    }
    ctx.globalAlpha = 1;
  }

  private spawnFirework(): void {
    const cx = 196 + Math.random() * 90;
    const cy = 16 + Math.random() * 28;
    const palette = [SUIT_THEMES.classic.accent, SUIT_THEMES.crystal.accent, SUIT_THEMES.solar.accent, SUIT_THEMES.elder.accent, '#fde047'];
    const base = palette[Math.floor(Math.random() * palette.length)];
    this.flashes.push({ x: cx, y: cy, life: 0.25, color: base });
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2 + Math.random() * 0.2;
      const sp = 16 + Math.random() * 24;
      this.sparks.push({
        x: cx,
        y: cy,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.9 + Math.random() * 0.5,
        maxLife: 1.4,
        color: Math.random() < 0.25 ? '#ffffff' : base,
      });
    }
  }

  /** y-sortierte Objekte (Sprite oder Fallback). */
  public getDrawables(ctx: CanvasRenderingContext2D, time: number): HubDrawable[] {
    const out: HubDrawable[] = [];
    const a = this.anchors;

    if (this.chapter >= 2) {
      for (const pos of [
        { x: a.forge.x - 22, y: a.forge.y + 8 },
        { x: a.medbay.x + 22, y: a.medbay.y + 8 },
      ]) {
        out.push({ y: pos.y, draw: () => this.drawCrystalLantern(ctx, pos.x, pos.y, time) });
      }
    }
    if (this.chapter >= 4) out.push({ y: OBELISK.y, draw: () => this.drawObelisk(ctx, OBELISK.x, OBELISK.y, time) });
    if (this.chapter >= 5) {
      for (const pos of BANNERS) out.push({ y: pos.y + 28, draw: () => this.drawStarBanner(ctx, pos.x, pos.y, time) });
    }
    if (this.chapter >= 6) {
      const pos = { x: a.guild.x + 32, y: a.guild.y - 6 };
      out.push({ y: pos.y, draw: () => this.drawCycleHolo(ctx, pos.x, pos.y, time) });
    }
    if (this.flag('kael_memorial')) {
      const pos = { x: a.forge.x - 30, y: a.forge.y + 10 };
      out.push({ y: pos.y, draw: () => this.drawMemorial(ctx, pos.x, pos.y, time) });
    }
    if (this.flag('lyra_clinic')) {
      const pos = { x: a.medbay.x - 28, y: a.medbay.y - 24 };
      out.push({ y: pos.y + 20, draw: () => this.drawEchoSign(ctx, pos.x, pos.y, time) });
    }
    if (this.flag('nyx_redeemed')) {
      const pos = { x: a.nyxNpc.x - 14, y: a.nyxNpc.y - 28 };
      out.push({ y: pos.y + 20, draw: () => this.drawFreeLantern(ctx, pos.x, pos.y, time) });
    }
    if (this.flag('vex_spiral')) out.push({ y: VEX_DECO.y, draw: () => this.drawBeacon(ctx, VEX_DECO.x, VEX_DECO.y, time) });
    if (this.flag('vex_stays')) out.push({ y: VEX_DECO.y, draw: () => this.drawClassboard(ctx, VEX_DECO.x, VEX_DECO.y, time) });
    return out;
  }

  // ---------- prozedurale Linien-Elemente ----------
  private renderLights(ctx: CanvasRenderingContext2D, time: number, night: number): void {
    for (const s of LIGHT_SWAGS) {
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(s.x1, s.y1);
      ctx.quadraticCurveTo((s.x1 + s.x2) / 2, Math.max(s.y1, s.y2) + s.sag * 2, s.x2, s.y2);
      ctx.stroke();
      const bulbs = 9;
      for (let i = 0; i < bulbs; i++) {
        const t = (i + 0.5) / bulbs;
        const bx = (1 - t) * (1 - t) * s.x1 + 2 * (1 - t) * t * ((s.x1 + s.x2) / 2) + t * t * s.x2;
        const by = (1 - t) * (1 - t) * s.y1 + 2 * (1 - t) * t * (Math.max(s.y1, s.y2) + s.sag * 2) + t * t * s.y2;
        const flicker = 0.7 + 0.3 * Math.sin(time * 3 + i * 1.7 + s.x1);
        const color = i % 2 === 0 ? '#fbbf24' : '#38e8d4';
        drawGlow(ctx, bx, by + 1, 5, color, (0.3 + night * 0.25) * flicker);
        ctx.fillStyle = color;
        ctx.fillRect(Math.round(bx - 1), Math.round(by), 2, 2);
      }
    }
  }

  private renderPennants(ctx: CanvasRenderingContext2D, time: number): void {
    const p = PENNANTS;
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(p.x1, p.y);
    ctx.quadraticCurveTo((p.x1 + p.x2) / 2, p.y + p.sag * 2, p.x2, p.y);
    ctx.stroke();
    const n = 7;
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const x = (1 - t) * (1 - t) * p.x1 + 2 * (1 - t) * t * ((p.x1 + p.x2) / 2) + t * t * p.x2;
      const y = (1 - t) * (1 - t) * p.y + 2 * (1 - t) * t * (p.y + p.sag * 2) + t * t * p.y;
      const wave = Math.sin(time * 2.2 + i) * 1.1;
      poly(
        ctx,
        [
          [x - 3.2, y],
          [x + 3.2, y],
          [x + wave, y + 8.5],
        ],
        i % 2 === 0 ? '#f97316' : '#fbbf24',
        OUTLINE,
      );
    }
  }

  // ---------- Objekte (Sprite oder Fallback) ----------
  private drawCrystalLantern(ctx: CanvasRenderingContext2D, x: number, y: number, time: number): void {
    const glow = 0.3 + 0.1 * Math.sin(time * 2.4 + x);
    drawPixelShadow(ctx, x, y, 6, 2.2, 0.42);
    const spr = this.sprite('propHubCrystalLantern');
    if (spr) {
      drawSpriteFoot(ctx, spr, x, y, 22, 30);
    } else {
      rect(ctx, x - 3, y - 3, 6, 3, '#78350f', OUTLINE);
      rect(ctx, x - 1, y - 17, 2, 14, '#b45309');
      rect(ctx, x - 1, y - 17, 1, 14, '#fbbf24');
      rect(ctx, x - 4, y - 19, 8, 2, '#92400e', OUTLINE);
      poly(ctx, [[x, y - 32], [x + 4.5, y - 25.5], [x, y - 19], [x - 4.5, y - 25.5]], '#c084fc', '#3b0764');
      poly(ctx, [[x, y - 32], [x + 4.5, y - 25.5], [x, y - 25.5]], '#e9d5ff');
    }
    drawGlow(ctx, x, y - 25, 15, '#e879f9', glow);
  }

  private drawObelisk(ctx: CanvasRenderingContext2D, x: number, y: number, time: number): void {
    drawPixelShadow(ctx, x, y + 1, 10, 3.2, 0.5);
    const spr = this.sprite('propHubElderObelisk');
    if (spr) {
      drawSpriteFoot(ctx, spr, x, y, 34, 44);
    } else {
      rect(ctx, x - 9, y - 5, 18, 5, '#1e293b', OUTLINE);
      poly(ctx, [[x - 6, y - 5], [x + 6, y - 5], [x + 4, y - 36], [x - 4, y - 36]], '#0f172a', '#38e8d4');
      poly(ctx, [[x + 1, y - 5], [x + 6, y - 5], [x + 4, y - 36], [x + 1, y - 36]], '#16223a');
      poly(ctx, [[x - 4, y - 36], [x + 4, y - 36], [x, y - 43]], '#0f172a', '#38e8d4');
      for (let i = 0; i < 4; i++) {
        const a = 0.45 + 0.5 * Math.sin(time * 2 + i * 1.3);
        ctx.globalAlpha = Math.max(0.15, a);
        rect(ctx, x - 1.5, y - 12 - i * 7, 3, 1, '#38e8d4');
      }
      ctx.globalAlpha = 1;
      // schwebender Holo-Ring der Ältesten
      ctx.save();
      ctx.strokeStyle = '#fde047';
      ctx.globalAlpha = 0.85;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 2]);
      ctx.lineDashOffset = -time * 8;
      ctx.beginPath();
      ctx.ellipse(x, y - 22, 12, 3.6, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    drawGlow(ctx, x, y - 22, 24, '#38e8d4', 0.18 + 0.06 * Math.sin(time * 2));
  }

  private drawStarBanner(ctx: CanvasRenderingContext2D, x: number, y: number, time: number): void {
    const sway = Math.sin(time * 1.4 + x) * 0.035;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(sway);
    const spr = this.sprite('propHubStarBanner');
    if (spr) {
      ctx.drawImage(spr, -12, 0, 24, 32);
    } else {
      rect(ctx, -10, 0, 20, 2, '#b45309', OUTLINE);
      rect(ctx, -8, 2, 16, 26, '#1e1b4b', '#fde047');
      const pts: Array<[number, number]> = [];
      for (let i = 0; i < 16; i++) {
        const r = i % 2 === 0 ? 6 : 2.6;
        const ang = (i / 16) * Math.PI * 2 - Math.PI / 2;
        pts.push([Math.cos(ang) * r, 14 + Math.sin(ang) * r]);
      }
      poly(ctx, pts, '#fde047', '#92400e');
      for (const tx of [-6, 0, 5]) rect(ctx, tx, 28, 1, 3, '#fde047');
    }
    ctx.restore();
    drawGlow(ctx, x, y + 14, 12, '#fde047', 0.12);
  }

  private drawCycleHolo(ctx: CanvasRenderingContext2D, x: number, y: number, time: number): void {
    drawPixelShadow(ctx, x, y, 6, 2, 0.35);
    const spr = this.sprite('propHubCycleHolo');
    if (spr) {
      drawSpriteFoot(ctx, spr, x, y, 26, 26);
    } else {
      rect(ctx, x - 1, y - 8, 2, 8, '#334155', OUTLINE);
      rect(ctx, x - 10, y - 26, 20, 14, 'rgba(8, 47, 73, 0.78)', '#38e8d4');
      ctx.fillStyle = 'rgba(56, 232, 212, 0.28)';
      for (let i = 0; i < 3; i++) ctx.fillRect(x - 9, y - 25 + ((time * 9 + i * 4.5) % 12), 18, 1);
    }
    ctx.save();
    ctx.font = 'bold 4.6px Silkscreen, monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#a5f3fc';
    ctx.fillText(`ZYKLUS ${Math.max(1, this.state.ngPlusLevel)}`, x, y - 17);
    ctx.restore();
    drawGlow(ctx, x, y - 19, 16, '#38e8d4', 0.2);
  }

  private drawMemorial(ctx: CanvasRenderingContext2D, x: number, y: number, time: number): void {
    drawPixelShadow(ctx, x, y, 9, 3, 0.45);
    const spr = this.sprite('propKaelMemorial');
    const flick = 0.85 + 0.15 * Math.sin(time * 9 + 1);
    if (spr) {
      drawSpriteFoot(ctx, spr, x, y, 26, 26);
    } else {
      rect(ctx, x - 8, y - 4, 16, 4, '#475569', OUTLINE);
      rect(ctx, x - 1, y - 3, 2, 1, '#fde047');
      rect(ctx, x - 6, y - 10, 12, 6, '#1e293b', OUTLINE);
      rect(ctx, x - 7, y - 12, 14, 2, '#64748b', OUTLINE);
      poly(ctx, [[x + 7, y - 12], [x + 12, y - 11], [x + 7, y - 9]], '#334155', OUTLINE);
      rect(ctx, x - 3, y - 14, 6, 2, '#b45309', OUTLINE);
      poly(ctx, [[x - 2, y - 14], [x + 2, y - 14], [x + 0.5, y - 20 - 2 * flick], [x - 0.5, y - 17]], '#fb923c');
      poly(ctx, [[x - 1, y - 14], [x + 1, y - 14], [x, y - 18 - flick]], '#fde047');
    }
    drawGlow(ctx, x, y - 17, 15, '#fb923c', 0.3 * flick);
  }

  private drawEchoSign(ctx: CanvasRenderingContext2D, x: number, y: number, time: number): void {
    const swing = Math.sin(time * 1.6) * 0.04;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(swing);
    const spr = this.sprite('propLyraEchoSign');
    if (spr) {
      ctx.drawImage(spr, -11, 0, 22, 22);
    } else {
      rect(ctx, -9, 0, 18, 2, '#b45309', OUTLINE);
      rect(ctx, -6, 2, 1, 3, '#92400e');
      rect(ctx, 5, 2, 1, 3, '#92400e');
      rect(ctx, -8, 5, 16, 12, '#0f172a', '#fbbf24');
      rect(ctx, -3.5, 7, 2, 8, '#38e8d4');
      rect(ctx, -6.5, 10, 8, 2, '#38e8d4');
      ctx.strokeStyle = '#7dd3fc';
      ctx.lineWidth = 0.8;
      for (const r of [2.6, 4.6]) {
        ctx.beginPath();
        ctx.arc(2, 11, r, -0.9, 0.9);
        ctx.stroke();
      }
    }
    ctx.restore();
    drawGlow(ctx, x, y + 11, 14, '#38e8d4', 0.22);
  }

  private drawFreeLantern(ctx: CanvasRenderingContext2D, x: number, y: number, time: number): void {
    const flick = 0.8 + 0.2 * Math.sin(time * 7 + 2);
    const spr = this.sprite('propNyxFreeLantern');
    if (spr) {
      ctx.drawImage(spr, Math.round(x - 10), Math.round(y), 20, 26);
    } else {
      rect(ctx, x - 0.5, y, 1, 4, '#475569');
      rect(ctx, x - 4, y + 4, 8, 2, '#92400e', OUTLINE);
      rect(ctx, x - 4, y + 6, 8, 11, '#f59e0b', '#78350f');
      ctx.globalAlpha = 0.6 + 0.4 * flick;
      rect(ctx, x - 2, y + 8, 4, 7, '#fde68a');
      ctx.globalAlpha = 1;
      rect(ctx, x - 4, y + 17, 8, 2, '#92400e', OUTLINE);
    }
    drawGlow(ctx, x, y + 12, 18, '#fbbf24', 0.38 * flick);
  }

  private drawBeacon(ctx: CanvasRenderingContext2D, x: number, y: number, time: number): void {
    drawPixelShadow(ctx, x, y + 1, 7, 2.6, 0.45);
    const spr = this.sprite('propVexBeacon');
    const blink = Math.sin(time * 4) > 0;
    if (spr) {
      drawSpriteFoot(ctx, spr, x, y, 30, 40);
    } else {
      rect(ctx, x - 5, y - 4, 10, 4, '#334155', OUTLINE);
      rect(ctx, x - 1, y - 28, 2, 24, '#94a3b8', OUTLINE);
      ctx.save();
      ctx.translate(x + 3, y - 25);
      ctx.rotate(-0.5);
      ctx.fillStyle = '#cbd5e1';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.ellipse(0, 0, 6, 2.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      rect(ctx, x - 3, y - 36, 6, 6, '#6d28d9', '#c4b5fd');
      rect(ctx, x - 1, y - 38, 2, 2, blink ? '#fb7185' : '#38e8d4');
    }
    // Lichtstrahl nach oben (Forschungs-Leuchtfeuer)
    const grad = ctx.createLinearGradient(0, y - 38, 0, y - 86);
    grad.addColorStop(0, 'rgba(196, 181, 253, 0.32)');
    grad.addColorStop(1, 'rgba(196, 181, 253, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(x - 2, y - 86, 4, 48);
    drawGlow(ctx, x, y - 33, 16, '#a78bfa', 0.3 + 0.1 * Math.sin(time * 3));
  }

  private drawClassboard(ctx: CanvasRenderingContext2D, x: number, y: number, time: number): void {
    drawPixelShadow(ctx, x, y + 1, 8, 2.6, 0.45);
    const spr = this.sprite('propVexClassboard');
    if (spr) {
      drawSpriteFoot(ctx, spr, x, y, 26, 24);
    } else {
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x - 7, y);
      ctx.lineTo(x - 2, y - 10);
      ctx.moveTo(x + 7, y);
      ctx.lineTo(x + 2, y - 10);
      ctx.moveTo(x, y);
      ctx.lineTo(x, y - 10);
      ctx.stroke();
      rect(ctx, x - 10, y - 24, 20, 14, '#0b1220', '#38e8d4');
      ctx.strokeStyle = '#7dd3fc';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.arc(x - 4, y - 18, 3, 0, Math.PI * 2);
      ctx.moveTo(x, y - 18);
      ctx.lineTo(x + 7, y - 18);
      ctx.moveTo(x - 7, y - 13);
      ctx.lineTo(x + 7, y - 13);
      ctx.stroke();
      ctx.fillStyle = 'rgba(56, 232, 212, 0.3)';
      ctx.fillRect(x - 9, y - 23 + ((time * 6) % 12), 18, 1);
    }
    drawGlow(ctx, x, y - 17, 14, '#38e8d4', 0.2);
  }
}

// ---------- Startpositionen (480×270 Logik-Koordinaten; per Screenshot justiert) ----------
const OBELISK = { x: 240, y: 170 };
const VEX_DECO = { x: 278, y: 194 };
const BANNERS = [
  { x: 176, y: 70 },
  { x: 304, y: 70 },
];
const LIGHT_SWAGS = [
  { x1: 150, y1: 96, x2: 232, y2: 96, sag: 8 },
  { x1: 248, y1: 96, x2: 330, y2: 96, sag: 8 },
];
const PENNANTS = { x1: 190, x2: 314, y: 26, sag: 5 };
