import { getHDArt } from '../assets/artLoader';
import { drawContactShadow, drawFloorGlow, drawGlow, drawPixelShadow } from '../assets/pixelArt';
import { getAtlas } from '../assets/sprites';
import { ALCHEMY_BUFFS } from '../data/guildMarket';
import { sound } from '../engine/audio';
import { VIRTUAL_HEIGHT, VIRTUAL_WIDTH, type InputManager } from '../engine/input';
import type { GameState } from '../systems/gameState';
import type { Direction } from '../types';

export interface MarketTerraceCallbacks {
  onReturnToHub: () => void;
  onOpenAlchemyBar: () => void;
  onOpenPatrons: () => void;
  onOpenTradeBank: () => void;
  onToast: (msg: string, tone?: 'info' | 'good' | 'warn') => void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

const DECK_LEFT = 68;
const DECK_RIGHT = 412;
const DECK_TOP = 102;
const DECK_BOTTOM = 186; // Geländer des generierten Hintergrunds liegt bei y ≈ 196

const HUB_RETURN_POS = { x: 240, y: 106 };
const ALCHEMY_BAR_POS = { x: 132, y: 152 };
const GUILD_SHOWCASE_POS = { x: 240, y: 150 };
const TRADE_BANK_POS = { x: 348, y: 152 };

export class MarketTerraceScene {
  private state: GameState;
  private callbacks: MarketTerraceCallbacks;

  public playerX = 240;
  public playerY = 122;
  private facing: Direction = 'down';
  private walkAnim = 0;
  private dashTimer = 0;
  private dashCooldown = 0;
  private dashVx = 0;
  private dashVy = 0;
  private time = 0;
  private entryCooldown = 0;

  private stars: Array<{ x: number; y: number; phase: number }> = [];
  private particles: Particle[] = [];

  public activePrompt: { label: string; x: number; y: number } | null = null;

  constructor(state: GameState, callbacks: MarketTerraceCallbacks) {
    this.state = state;
    this.callbacks = callbacks;

    for (let i = 0; i < 34; i++) {
      this.stars.push({
        x: 12 + Math.random() * (VIRTUAL_WIDTH - 24),
        y: i < 14 ? 8 + Math.random() * 54 : 230 + Math.random() * 34,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  public onEnter(): void {
    this.state.restoreFullVitals();
    this.playerX = 240;
    this.playerY = 122;
    this.facing = 'down';
    this.walkAnim = 0;
    this.dashTimer = 0;
    this.dashCooldown = 0;
    this.entryCooldown = 0.25;
    this.particles = [];
  }

  public update(dt: number, input: InputManager): void {
    this.time += dt;
    if (this.entryCooldown > 0) this.entryCooldown -= dt;

    // Bubbling alchemy motes at Milo's Bar
    if (Math.random() < dt * 5.5) {
      this.particles.push({
        x: ALCHEMY_BAR_POS.x + (Math.random() - 0.5) * 44,
        y: ALCHEMY_BAR_POS.y - 12 + (Math.random() - 0.5) * 10,
        vx: (Math.random() - 0.5) * 8,
        vy: -12 - Math.random() * 12,
        color: Math.random() > 0.45 ? '#34d399' : '#c084fc',
        size: 1.5,
        life: 0.5 + Math.random() * 0.4,
        maxLife: 0.9,
      });
    }

    // Golden ticker sparks at Solaris Trade Bank
    if (Math.random() < dt * 4.5) {
      this.particles.push({
        x: TRADE_BANK_POS.x + (Math.random() - 0.5) * 42,
        y: TRADE_BANK_POS.y - 10 + (Math.random() - 0.5) * 10,
        vx: (Math.random() - 0.5) * 9,
        vy: -10 - Math.random() * 10,
        color: Math.random() > 0.4 ? '#fde047' : '#38e8d4',
        size: 1.4,
        life: 0.45 + Math.random() * 0.35,
        maxLife: 0.8,
      });
    }

    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    const move = input.getMoveVector();

    if (input.dashPressed() && this.dashCooldown <= 0 && (move.x !== 0 || move.y !== 0)) {
      this.dashTimer = 0.16;
      this.dashCooldown = 0.46;
      this.dashVx = move.x * 230;
      this.dashVy = move.y * 230;
      sound.playDash();
    }

    let vx = move.x * 108;
    let vy = move.y * 108;
    if (this.dashTimer > 0) {
      this.dashTimer -= dt;
      vx = this.dashVx;
      vy = this.dashVy;
    }

    if (Math.abs(vx) > 1 || Math.abs(vy) > 1) {
      this.walkAnim += dt * 11;
      if (Math.abs(vx) > Math.abs(vy)) {
        this.facing = vx > 0 ? 'right' : 'left';
      } else {
        this.facing = vy > 0 ? 'down' : 'up';
      }
    } else {
      this.walkAnim = 0;
    }

    this.movePlayer(vx * dt, vy * dt);
    this.updateInteraction(input);

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
  }

  private movePlayer(dx: number, dy: number): void {
    const nx = this.playerX + dx;
    if (this.isWalkable(nx, this.playerY)) {
      this.playerX = nx;
    }
    const ny = this.playerY + dy;
    if (this.isWalkable(this.playerX, ny)) {
      this.playerY = ny;
    }
  }

  private isWalkable(x: number, y: number): boolean {
    if (x < DECK_LEFT || x > DECK_RIGHT || y < DECK_TOP || y > DECK_BOTTOM) return false;
    // Left Alchemy Bar counter
    if (x > 88 && x < 176 && y > 132 && y < 164) return false;
    // Center Guild Showcase kiosk
    if (x > 214 && x < 266 && y > 136 && y < 162) return false;
    // Right Trade Bank counter
    if (x > 304 && x < 392 && y > 132 && y < 164) return false;
    return true;
  }

  private updateInteraction(input: InputManager): void {
    this.activePrompt = null;

    // 1. Return north to Port Solaris Promenade
    if (
      this.entryCooldown <= 0 &&
      Math.hypot(this.playerX - HUB_RETURN_POS.x, this.playerY - HUB_RETURN_POS.y) < 32
    ) {
      this.activePrompt = {
        label: '[E] ↑ Zurück zur Port-Solaris-Promenade',
        x: HUB_RETURN_POS.x,
        y: HUB_RETURN_POS.y + 20,
      };
      if (input.interactPressed()) {
        sound.playUiClick();
        this.callbacks.onReturnToHub();
      }
      return;
    }

    // 2. Milo's Alchemie-Bar (Left)
    if (Math.hypot(this.playerX - ALCHEMY_BAR_POS.x, this.playerY - (ALCHEMY_BAR_POS.y + 18)) < 40) {
      const buff = this.state.activeAlchemyBuff ? ALCHEMY_BUFFS[this.state.activeAlchemyBuff] : null;
      this.activePrompt = {
        label: buff
          ? `[E] 🧪 Milo's Alchemie-Bar (Aktiv: ${buff.shortName})`
          : `[E] 🧪 Milo's Alchemie-Bar (Run-Elixiere)`,
        x: ALCHEMY_BAR_POS.x + 12,
        y: ALCHEMY_BAR_POS.y - 26,
      };
      if (input.interactPressed()) {
        sound.playUiClick();
        this.callbacks.onOpenAlchemyBar();
      }
      return;
    }

    // 3. Händler-Gilden-Schaukasten (Center)
    if (Math.hypot(this.playerX - GUILD_SHOWCASE_POS.x, this.playerY - (GUILD_SHOWCASE_POS.y + 18)) < 36) {
      this.activePrompt = {
        label: this.state.hasReadyBigOrder()
          ? '[E] ★ Händler-Gilde (Großauftrag bereit!)'
          : '[E] 🏛️ Händler-Gilde (Stammkunden & Ruf)',
        x: GUILD_SHOWCASE_POS.x,
        y: GUILD_SHOWCASE_POS.y - 26,
      };
      if (input.interactPressed()) {
        sound.playUiClick();
        this.callbacks.onOpenPatrons();
      }
      return;
    }

    // 4. Solaris-Handelsbank (Right)
    if (Math.hypot(this.playerX - TRADE_BANK_POS.x, this.playerY - (TRADE_BANK_POS.y + 18)) < 40) {
      this.activePrompt = {
        label: this.state.hasReadyBankPayout()
          ? '[E] ★ Solaris-Handelsbank (Auszahlung bereit!)'
          : '[E] 🏦 Solaris-Handelsbank (Handelsrouten)',
        x: TRADE_BANK_POS.x - 14,
        y: TRADE_BANK_POS.y - 26,
      };
      if (input.interactPressed()) {
        sound.playUiClick();
        this.callbacks.onOpenTradeBank();
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D): void {
    const art = getHDArt();
    const isNight = this.state.timeOfDay === 'night';
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 4.0);

    if (art.marketTerraceBg) {
      ctx.drawImage(art.marketTerraceBg, 0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    } else {
      this.renderProceduralTerraceBg(ctx, isNight, pulse);
    }

    if (isNight) {
      ctx.fillStyle = 'rgba(10, 16, 44, 0.28)';
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    } else {
      ctx.fillStyle = 'rgba(255, 224, 150, 0.045)';
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    }

    // Twinkling stars in upper & lower starfield vistas (nur beim prozeduralen Fallback — das Bild hat eigene Sterne)
    for (const s of art.marketTerraceBg ? [] : this.stars) {
      const a = 0.25 + 0.75 * Math.max(0, Math.sin(this.time * 2.5 + s.phase));
      ctx.fillStyle = `rgba(255, 250, 224, ${a * (isNight ? 1.0 : 0.78)})`;
      ctx.fillRect(s.x, s.y, isNight ? 1.8 : 1.4, isNight ? 1.8 : 1.4);
    }

    // Ambient station glows
    if (!art.marketTerraceBg) {
      drawGlow(ctx, ALCHEMY_BAR_POS.x, ALCHEMY_BAR_POS.y - 4, 42, '#34d399', 0.24 + pulse * 0.1);
      drawGlow(ctx, GUILD_SHOWCASE_POS.x, GUILD_SHOWCASE_POS.y - 4, 34, '#fbbf24', 0.22 + pulse * 0.08);
      drawGlow(ctx, TRADE_BANK_POS.x, TRADE_BANK_POS.y - 4, 42, '#fde047', 0.24 + pulse * 0.1);
      drawGlow(ctx, HUB_RETURN_POS.x, HUB_RETURN_POS.y - 8, 28, '#38e8d4', 0.22 + pulse * 0.08);
    }

    // Depth-sorted entities: NPCs, kiosks, player
    type Drawable = { y: number; draw: () => void };
    const drawables: Drawable[] = [];

    // Milo behind Alchemy Bar
    drawables.push({
      y: ALCHEMY_BAR_POS.y - 2,
      draw: () => this.renderAlchemyBar(ctx, pulse),
    });

    // Center Guild Showcase
    drawables.push({
      y: GUILD_SHOWCASE_POS.y,
      draw: () => this.renderGuildShowcase(ctx, pulse),
    });

    // Solaris Trade Bank Terminal & Droid
    drawables.push({
      y: TRADE_BANK_POS.y - 2,
      draw: () => this.renderTradeBank(ctx, pulse),
    });

    // Player
    drawables.push({
      y: this.playerY,
      draw: () => this.renderPlayer(ctx),
    });

    drawables.sort((a, b) => a.y - b.y);
    for (const d of drawables) d.draw();

    // Particles
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    this.renderSignPills(ctx, pulse);

    if (this.activePrompt) {
      this.renderPrompt(ctx, this.activePrompt.label, this.activePrompt.x, this.activePrompt.y);
    }
  }

  private renderProceduralTerraceBg(ctx: CanvasRenderingContext2D, isNight: boolean, pulse: number): void {
    // Deep space backdrop
    const sky = ctx.createLinearGradient(0, 0, 0, VIRTUAL_HEIGHT);
    sky.addColorStop(0, isNight ? '#090d1f' : '#131d36');
    sky.addColorStop(0.5, '#192238');
    sky.addColorStop(1, isNight ? '#070b18' : '#0f172a');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

    // Soft nebula clouds below the terrace railing
    drawGlow(ctx, 130, 250, 90, '#c084fc', 0.18);
    drawGlow(ctx, 340, 246, 95, '#38e8d4', 0.16);
    drawGlow(ctx, 240, 256, 75, '#fb923c', 0.14);

    // Upper stone bulkhead & arched corridor back to Promenade
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(48, 52, 384, 50);
    ctx.fillStyle = '#334155';
    ctx.fillRect(48, 52, 384, 5);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(210, 62, 60, 40);
    ctx.strokeStyle = '#38e8d4';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(212, 64, 56, 36);

    // Warm wooden terrace deck
    ctx.fillStyle = '#3b2820';
    ctx.fillRect(58, 100, 364, 132);
    ctx.fillStyle = '#4a3228';
    for (let y = 104; y < 230; y += 10) {
      ctx.fillRect(60, y, 360, 8);
    }
    // Deck metal trim border
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2;
    ctx.strokeRect(58, 100, 364, 132);

    // Central woven carpet runner leading from Promenade entrance
    ctx.fillStyle = '#1e3a5f';
    ctx.fillRect(216, 100, 48, 128);
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(218, 100, 2, 128);
    ctx.fillRect(260, 100, 2, 128);

    // Panoramic glass terrace railing along the bottom overlooking the nebula
    ctx.fillStyle = 'rgba(56, 232, 212, 0.18)';
    ctx.fillRect(60, 224, 360, 8);
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(58, 222, 364, 2.5);
    for (let rx = 74; rx <= 406; rx += 42) {
      ctx.fillStyle = '#475569';
      ctx.fillRect(rx - 2, 220, 4, 14);
      // Warm cozy string-light lantern post
      drawGlow(ctx, rx, 219, 12, '#fbbf24', 0.25 + pulse * 0.1);
      ctx.fillStyle = '#fde047';
      ctx.fillRect(rx - 1.5, 218, 3, 3);
    }
  }

  private renderAlchemyBar(ctx: CanvasRenderingContext2D, pulse: number): void {
    const art = getHDArt();
    const x = ALCHEMY_BAR_POS.x;
    const y = ALCHEMY_BAR_POS.y;
    const bob = Math.sin(this.time * 3.1) * 0.6;

    if (art.marketBar) {
      // Sprite: Regal (oberer Teil) → Milo → Thekenkörper (unterer Teil), Unterkante bei y + 12
      const bw = 88;
      const bh = Math.round((bw * art.marketBar.height) / art.marketBar.width);
      const bx = x - bw / 2;
      const by = y + 12 - bh;
      const split = 0.5;
      drawFloorGlow(ctx, x, y + 11, 44, '#34d399', 0.12 + pulse * 0.05);
      drawContactShadow(ctx, art.marketBar, bx, by, bw, bh, 0.75);
      ctx.drawImage(art.marketBar, 0, 0, art.marketBar.width, art.marketBar.height * split, bx, by, bw, bh * split);
      if (art.npcWanderer) ctx.drawImage(art.npcWanderer, x - 12, y - 30 + bob, 24, 28);
      ctx.drawImage(art.marketBar, 0, art.marketBar.height * split, art.marketBar.width, art.marketBar.height * (1 - split), bx, by + bh * split, bw, bh * (1 - split));
      return;
    }

    // Barkeeper Milo behind counter
    if (art.npcWanderer) {
      ctx.drawImage(art.npcWanderer, x - 12, y - 34 + bob, 24, 28);
    }

    // Wooden & emerald glass alchemy counter
    drawPixelShadow(ctx, x, y + 10, 40, 6, 0.45);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(x - 38, y - 10, 76, 20);
    ctx.fillStyle = '#5c3a21';
    ctx.fillRect(x - 40, y - 13, 80, 6);
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 38, y - 10, 76, 20);

    // Glowing potion flasks on bar top
    const flasks = [
      { ox: -24, col: '#fb923c' },
      { ox: -10, col: '#34d399' },
      { ox: 12, col: '#c084fc' },
      { ox: 25, col: '#38e8d4' },
    ];
    for (const f of flasks) {
      ctx.fillStyle = f.col;
      ctx.fillRect(x + f.ox - 2, y - 18, 4, 5);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + f.ox - 1, y - 19, 2, 1.5);
      drawGlow(ctx, x + f.ox, y - 15, 7, f.col, 0.25 + pulse * 0.12);
    }
  }

  private renderGuildShowcase(ctx: CanvasRenderingContext2D, pulse: number): void {
    const art = getHDArt();
    const x = GUILD_SHOWCASE_POS.x;
    const y = GUILD_SHOWCASE_POS.y;
    if (art.marketGuild) {
      const gw = 34;
      const gh = Math.round((gw * art.marketGuild.height) / art.marketGuild.width);
      drawFloorGlow(ctx, x, y + 11, 24, '#fbbf24', 0.12 + pulse * 0.05);
      drawContactShadow(ctx, art.marketGuild, x - gw / 2, y + 12 - gh, gw, gh, 0.75);
      ctx.drawImage(art.marketGuild, x - gw / 2, y + 12 - gh, gw, gh);
      drawGlow(ctx, x, y - 14, 12, '#fbbf24', 0.14 + pulse * 0.08);
      return;
    }
    drawPixelShadow(ctx, x, y + 10, 22, 5, 0.45);

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(x - 20, y - 12, 40, 22);
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 1.1;
    ctx.strokeRect(x - 20, y - 12, 40, 22);

    // Golden guild crest hologram floating above pedestal
    const hbob = Math.sin(this.time * 3.8) * 1.8;
    drawGlow(ctx, x, y - 20 + hbob, 16, '#fbbf24', 0.3 + pulse * 0.15);
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 8px Silkscreen, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('★', x, y - 17 + hbob);
  }

  private renderTradeBank(ctx: CanvasRenderingContext2D, pulse: number): void {
    const art = getHDArt();
    const x = TRADE_BANK_POS.x;
    const y = TRADE_BANK_POS.y;
    const bob = Math.sin(this.time * 3.6 + 1.2) * 1.4;

    if (art.marketBank) {
      const bw = 88;
      const bh = Math.round((bw * art.marketBank.height) / art.marketBank.width);
      const bx = x - bw / 2;
      const by = y + 12 - bh;
      const split = 0.45;
      drawFloorGlow(ctx, x, y + 11, 44, '#fde047', 0.1 + pulse * 0.05);
      drawContactShadow(ctx, art.marketBank, bx, by, bw, bh, 0.75);
      ctx.drawImage(art.marketBank, 0, 0, art.marketBank.width, art.marketBank.height * split, bx, by, bw, bh * split);
      if (art.botClerk) ctx.drawImage(art.botClerk, x - 11, y - 30 + bob, 22, 25);
      ctx.drawImage(art.marketBank, 0, art.marketBank.height * split, art.marketBank.width, art.marketBank.height * (1 - split), bx, by + bh * split, bw, bh * (1 - split));
      return;
    }

    // Bank droid hovering behind vault terminal
    if (art.botClerk) {
      ctx.drawImage(art.botClerk, x - 11, y - 34 + bob, 22, 25);
    }

    drawPixelShadow(ctx, x, y + 10, 40, 6, 0.45);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(x - 38, y - 10, 76, 20);
    ctx.fillStyle = '#1e3a5f';
    ctx.fillRect(x - 40, y - 13, 80, 6);
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 1.1;
    ctx.strokeRect(x - 38, y - 10, 76, 20);

    // Animated gold ticker bar on terminal front
    ctx.fillStyle = '#020617';
    ctx.fillRect(x - 30, y - 4, 60, 8);
    ctx.fillStyle = '#4ade80';
    ctx.font = 'bold 4.8px Silkscreen, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('SOLARIS +25%', x, y + 2);
    drawGlow(ctx, x, y - 1, 14, '#fde047', 0.16 + pulse * 0.1);
  }

  private renderSignPills(ctx: CanvasRenderingContext2D, pulse: number): void {
    ctx.font = 'bold 5px Silkscreen, monospace';
    ctx.textAlign = 'center';

    const pills = [
      { text: '↑ PROMENADE', x: HUB_RETURN_POS.x, y: 72, color: '#38e8d4' },
      { text: "MILO'S ALCHEMIE-BAR", x: ALCHEMY_BAR_POS.x, y: 112, color: '#34d399' },
      { text: 'HÄNDLER-GILDE', x: GUILD_SHOWCASE_POS.x, y: 118, color: '#fbbf24' },
      { text: 'SOLARIS-HANDELSBANK', x: TRADE_BANK_POS.x, y: 112, color: '#fde047' },
    ];

    for (const p of pills) {
      const w = Math.ceil(ctx.measureText(p.text).width) + 10;
      ctx.fillStyle = 'rgba(11, 16, 28, 0.9)';
      ctx.fillRect(p.x - w / 2, p.y - 5, w, 9);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 0.7;
      ctx.strokeRect(p.x - w / 2, p.y - 5, w, 9);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y + 1.5);
    }

    // Pulsing "!" badge when Trade Bank payout is ready
    if (this.state.hasReadyBankPayout()) {
      const bx = TRADE_BANK_POS.x + 36;
      const by = 104 + Math.sin(this.time * 6) * 2;
      drawGlow(ctx, bx, by, 12, '#4ade80', 0.45 + pulse * 0.25);
      ctx.fillStyle = '#4ade80';
      ctx.beginPath();
      ctx.arc(bx, by, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 6px Silkscreen, monospace';
      ctx.fillText('!', bx, by + 2);
    }

    // Pulsing "!" badge when a Patron Big Order is ready
    if (this.state.hasReadyBigOrder()) {
      const gx = GUILD_SHOWCASE_POS.x + 32;
      const gy = 110 + Math.sin(this.time * 6 + 1) * 2;
      drawGlow(ctx, gx, gy, 12, '#fbbf24', 0.45 + pulse * 0.25);
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(gx, gy, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 6px Silkscreen, monospace';
      ctx.fillText('!', gx, gy + 2);
    }
  }

  private renderPlayer(ctx: CanvasRenderingContext2D): void {
    const art = getHDArt();
    const atlas = getAtlas();
    const walking = this.walkAnim > 0;
    const bob = walking ? Math.abs(Math.sin(this.walkAnim)) * 2.2 : Math.sin(this.time * 3) * 0.4;
    const tilt = walking ? Math.sin(this.walkAnim) * 0.05 : 0;

    drawPixelShadow(ctx, this.playerX, this.playerY + 11, 8, 3.2, 0.5);

    const hdSpr =
      this.facing === 'up'
        ? art.heroUp
        : this.facing === 'right'
          ? art.heroRight
          : this.facing === 'left'
            ? art.heroLeft
            : art.heroDown;

    if (hdSpr) {
      ctx.save();
      ctx.translate(this.playerX, this.playerY + 10 - bob);
      ctx.rotate(tilt);
      ctx.drawImage(hdSpr, -12, -26, 24, 28);
      ctx.restore();
    } else {
      const frame = Math.floor(this.walkAnim) % 2;
      ctx.drawImage(atlas.heroDown[frame], Math.round(this.playerX - 8), Math.round(this.playerY - 10));
    }
  }

  private renderPrompt(ctx: CanvasRenderingContext2D, text: string, x: number, y: number): void {
    ctx.font = 'bold 5.5px Silkscreen, monospace';
    const w = Math.max(54, Math.ceil(ctx.measureText(text).width) + 14);
    const px = Math.max(8, Math.min(VIRTUAL_WIDTH - w - 8, x - w / 2));
    const py = Math.max(8, y - 8);

    ctx.fillStyle = 'rgba(11, 16, 28, 0.94)';
    ctx.fillRect(px, py, w, 12);
    ctx.strokeStyle = '#38e8d4';
    ctx.lineWidth = 0.8;
    ctx.strokeRect(px, py, w, 12);
    ctx.fillStyle = '#f8fafc';
    ctx.textAlign = 'center';
    ctx.fillText(text, px + w / 2, py + 8);
  }
}
