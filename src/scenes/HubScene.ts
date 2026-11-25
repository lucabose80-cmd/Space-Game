import { getHDArt } from '../assets/artLoader';
import { drawGlow, drawPixelShadow } from '../assets/pixelArt';
import { getAtlas } from '../assets/sprites';
import { sound } from '../engine/audio';
import { VIRTUAL_HEIGHT, VIRTUAL_WIDTH, type InputManager } from '../engine/input';
import type { GameState } from '../systems/gameState';
import type { Direction } from '../types';

interface Stroller {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  waitTimer: number;
  walkAnim: number;
  kind: 'wanderer' | 'astro' | 'horned';
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

export interface HubCallbacks {
  onEnterShop: () => void;
  onOpenForge: () => void;
  onOpenMedBay: () => void;
  onOpenTechLab: () => void;
  onOpenBlackMarket: () => void;
  onOpenGuildBoard: () => void;
  onEnterDungeon: () => void;
  onToast: (msg: string, tone?: 'info' | 'good' | 'warn') => void;
}

// Walkable bounds matching public/art/hub_bg.png
const PLAZA_LEFT = 54;
const PLAZA_RIGHT = 426;
const PLAZA_TOP = 122;
const PLAZA_BOTTOM = 224;

// Interactive station hotspots matching architecturally integrated public/art/hub_bg.png
const SHOP_DOOR_POS = { x: 74, y: 132 };
const FORGE_POS = { x: 144, y: 126 };
const GUILD_BOARD_POS = { x: 240, y: 84 };
const MEDBAY_POS = { x: 348, y: 126 };
const NYX_NPC_POS = { x: 185, y: 178 };
const TECHLAB_NPC_POS = { x: 295, y: 178 };
const WARP_GATE_POS = { x: 414, y: 144 };

export class HubScene {
  private state: GameState;
  private callbacks: HubCallbacks;

  public playerX = 96;
  public playerY = 142;
  private facing: Direction = 'right';
  private walkAnim = 0;
  private dashTimer = 0;
  private dashCooldown = 0;
  private dashVx = 0;
  private dashVy = 0;

  private strollers: Stroller[] = [];
  private particles: Particle[] = [];
  private stars: Array<{ x: number; y: number; phase: number }> = [];
  private time = 0;

  public activePrompt: { label: string; x: number; y: number } | null = null;

  constructor(state: GameState, callbacks: HubCallbacks) {
    this.state = state;
    this.callbacks = callbacks;

    for (let i = 0; i < 20; i++) {
      this.stars.push({
        x: 170 + Math.random() * 145,
        y: 8 + Math.random() * 44,
        phase: Math.random() * Math.PI * 2,
      });
    }

    this.strollers = [
      {
        x: 222,
        y: 196,
        targetX: 266,
        targetY: 196,
        waitTimer: 1.5,
        walkAnim: 0,
        kind: 'wanderer',
      },
      {
        x: 256,
        y: 102,
        targetX: 224,
        targetY: 112,
        waitTimer: 2.0,
        walkAnim: 0,
        kind: 'astro',
      },
    ];
  }

  public onEnter(from: 'shop' | 'dungeon'): void {
    this.state.restoreFullVitals();
    this.dashTimer = 0;
    this.dashCooldown = 0;
    this.particles = [];
    if (from === 'dungeon') {
      this.playerX = 388;
      this.playerY = 136;
      this.facing = 'left';
      this.spawnBurst(414, 144, '#38e8d4', 18);
    } else {
      this.playerX = 96;
      this.playerY = 138;
      this.facing = 'right';
    }
  }

  public update(dt: number, input: InputManager): void {
    this.time += dt;

    // Flying sparks at Kael's Forge
    if (Math.random() < dt * 7) {
      this.particles.push({
        x: 132 + (Math.random() - 0.5) * 24,
        y: 94 + (Math.random() - 0.5) * 14,
        vx: (Math.random() - 0.5) * 18,
        vy: -14 - Math.random() * 18,
        color: Math.random() > 0.35 ? '#fbbf24' : '#fb923c',
        size: 1.5,
        life: 0.45 + Math.random() * 0.4,
        maxLife: 0.85,
      });
    }

    // Soft emerald bio-glints at Dr. Lyra's Med-Bay
    if (Math.random() < dt * 4) {
      this.particles.push({
        x: 348 + (Math.random() - 0.5) * 32,
        y: 108 + (Math.random() - 0.5) * 12,
        vx: (Math.random() - 0.5) * 8,
        vy: -10 - Math.random() * 10,
        color: '#34d399',
        size: 1.5,
        life: 0.55 + Math.random() * 0.35,
        maxLife: 0.9,
      });
    }

    // Swirling Warp-Gate motes on right
    if (Math.random() < dt * 8) {
      this.particles.push({
        x: 428 + (Math.random() - 0.5) * 12,
        y: 148 + (Math.random() - 0.5) * 34,
        vx: -14 - Math.random() * 12,
        vy: (Math.random() - 0.5) * 10,
        color: this.state.sector1Cleared && Math.random() < 0.4 ? '#fbbf24' : '#38e8d4',
        size: 1.5,
        life: 0.5 + Math.random() * 0.35,
        maxLife: 0.85,
      });
    }

    // Mysterious violet contraband motes drifting over integrated Nyx's Black Market stall
    if (Math.random() < dt * 4.5) {
      this.particles.push({
        x: 120 + (Math.random() - 0.5) * 62,
        y: 186 + (Math.random() - 0.5) * 14,
        vx: (Math.random() - 0.5) * 8,
        vy: -10 - Math.random() * 9,
        color: Math.random() > 0.35 ? '#c084fc' : '#f472b6',
        size: 1.4,
        life: 0.48 + Math.random() * 0.36,
        maxLife: 0.84,
      });
    }

    // Cyan holo-sparks over integrated Vex's Tech-Labor pavilion
    if (Math.random() < dt * 4.5) {
      this.particles.push({
        x: 358 + (Math.random() - 0.5) * 56,
        y: 174 + (Math.random() - 0.5) * 14,
        vx: (Math.random() - 0.5) * 9,
        vy: -11 - Math.random() * 10,
        color: Math.random() > 0.35 ? '#38e8d4' : '#fde047',
        size: 1.4,
        life: 0.45 + Math.random() * 0.35,
        maxLife: 0.8,
      });
    }

    // Player movement & cozy dash
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    const move = input.getMoveVector();

    if (input.dashPressed() && this.dashCooldown <= 0 && (move.x !== 0 || move.y !== 0)) {
      this.dashTimer = 0.16;
      this.dashCooldown = 0.48;
      this.dashVx = move.x * 235;
      this.dashVy = move.y * 235;
      sound.playDash();
      this.spawnBurst(this.playerX, this.playerY + 4, '#fb923c', 6);
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
    this.updateStrollers(dt);
    this.updateInteraction(input);
    this.updateParticles(dt);
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
    // Upper central nebula overlook bridge between Forge & Med-Bay (leave room for Guild Board kiosk at 240,84!)
    if (x >= 206 && x <= 274 && y >= 78 && y <= 130) {
      if (x >= 220 && x <= 260 && y <= 98) return false;
      return true;
    }
    if (x < PLAZA_LEFT || x > PLAZA_RIGHT || y < PLAZA_TOP || y > PLAZA_BOTTOM) {
      return false;
    }
    // Keep clear of architecturally built-in Nyx's Black Market storefront (lower-left)
    if (x > 58 && x < 178 && y > 148 && y < 238) return false;
    // Keep clear of architecturally built-in Vex's Tech-Labor pavilion (lower-right)
    if (x > 302 && x < 418 && y > 148 && y < 248) return false;
    return true;
  }

  private updateStrollers(dt: number): void {
    const speed = 28;
    const spots = [
      { x: 214, y: 174 },
      { x: 240, y: 164 },
      { x: 266, y: 174 },
      { x: 240, y: 112 },
      { x: 216, y: 204 },
      { x: 264, y: 204 },
    ];
    for (const s of this.strollers) {
      const dx = s.targetX - s.x;
      const dy = s.targetY - s.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 3) {
        s.x += (dx / dist) * speed * dt;
        s.y += (dy / dist) * speed * dt;
        s.walkAnim += dt * 7;
      } else {
        s.walkAnim = 0;
        s.waitTimer -= dt;
        if (s.waitTimer <= 0) {
          const pick = spots[Math.floor(Math.random() * spots.length)];
          s.targetX = pick.x;
          s.targetY = pick.y;
          s.waitTimer = 2.2 + Math.random() * 2.5;
        }
      }
    }
  }

  private updateInteraction(input: InputManager): void {
    this.activePrompt = null;

    // 0. Galaktische Kapitäns-Tafel (Online Scoreboard & Cloud-Save Terminal!)
    if (Math.hypot(this.playerX - GUILD_BOARD_POS.x, this.playerY - (GUILD_BOARD_POS.y + 18)) < 32) {
      this.activePrompt = {
        label: '[E] 🏆 Kapitäns-Tafel (Rangliste & Cloud)',
        x: GUILD_BOARD_POS.x,
        y: GUILD_BOARD_POS.y + 42,
      };
      if (input.interactPressed()) {
        sound.playUiClick();
        this.callbacks.onOpenGuildBoard();
      }
      return;
    }

    // 1. Astro-Barter (Your Shop)
    if (Math.hypot(this.playerX - SHOP_DOOR_POS.x, this.playerY - SHOP_DOOR_POS.y) < 30 && this.playerY <= 142) {
      this.activePrompt = {
        label: '[E] Astro-Barter betreten',
        x: SHOP_DOOR_POS.x + 18,
        y: SHOP_DOOR_POS.y - 24,
      };
      if (input.interactPressed()) {
        sound.playUiClick();
        this.callbacks.onEnterShop();
      }
      return;
    }

    // 2. Kael's Exo-Schmiede (Weapons & Suit)
    if (Math.hypot(this.playerX - FORGE_POS.x, this.playerY - FORGE_POS.y) < 30 && this.playerY <= 138) {
      this.activePrompt = {
        label: "[E] Kael's Exo-Schmiede (Waffen & MK-VIII)",
        x: FORGE_POS.x,
        y: FORGE_POS.y - 28,
      };
      if (input.interactPressed()) {
        sound.playUiClick();
        this.callbacks.onOpenForge();
      }
      return;
    }

    // 3. Dr. Lyra's Med-Bay (Stimpacks & Bio-Regen)
    if (Math.hypot(this.playerX - MEDBAY_POS.x, this.playerY - MEDBAY_POS.y) < 30 && this.playerY <= 138) {
      this.activePrompt = {
        label: "[E] Dr. Lyra's Med-Bay",
        x: MEDBAY_POS.x,
        y: MEDBAY_POS.y - 28,
      };
      if (input.interactPressed()) {
        sound.playUiClick();
        this.callbacks.onOpenMedBay();
      }
      return;
    }

    // 4. Nyx' Schwarzmarkt-Stand (accessible from beside Nyx OR right in front of the canopy!)
    const nearNyx =
      Math.hypot(this.playerX - NYX_NPC_POS.x, this.playerY - NYX_NPC_POS.y) < 34 ||
      (this.playerX >= 76 && this.playerX <= 184 && this.playerY >= 139 && this.playerY <= 156);
    if (nearNyx) {
      this.activePrompt = {
        label: "[E] Nyx' Schwarzmarkt (Seltene Teile)",
        x: 152,
        y: 148,
      };
      if (input.interactPressed()) {
        sound.playUiClick();
        this.callbacks.onOpenBlackMarket();
      }
      return;
    }

    // 5. Vex' Tech-Labor (accessible from beside Vex OR along the front counter!)
    const nearVex =
      Math.hypot(this.playerX - TECHLAB_NPC_POS.x, this.playerY - TECHLAB_NPC_POS.y) < 34 ||
      (this.playerX >= 298 && this.playerX <= 400 && this.playerY >= 139 && this.playerY <= 156);
    if (nearVex) {
      this.activePrompt = {
        label: "[E] Vex' Tech-Labor (Module & Sektor-Karte)",
        x: 332,
        y: 148,
      };
      if (input.interactPressed()) {
        sound.playUiClick();
        this.callbacks.onOpenTechLab();
      }
      return;
    }

    // 6. Gateway to Port Solaris Raumhafen & Sektor-Docks (Docks I–IV & 5. Tor!)
    if (Math.hypot(this.playerX - WARP_GATE_POS.x, this.playerY - WARP_GATE_POS.y) < 38) {
      this.activePrompt = {
        label: '[E] Raumhafen · Sektor-Docks I–IV & 5. Tor →',
        x: WARP_GATE_POS.x - 62,
        y: WARP_GATE_POS.y - 24,
      };
      if (input.interactPressed()) {
        sound.playUiClick();
        this.callbacks.onEnterDungeon();
      }
    }
  }

  private spawnBurst(x: number, y: number, color: string, count: number): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 20 + Math.random() * 55;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        color,
        size: 1.5 + Math.random() * 1.5,
        life: 0.35 + Math.random() * 0.3,
        maxLife: 0.65,
      });
    }
  }

  private updateParticles(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
  }

  public render(ctx: CanvasRenderingContext2D): void {
    const art = getHDArt();
    const isNight = this.state.timeOfDay === 'night';

    if (art.hubBg) {
      ctx.drawImage(art.hubBg, 0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    } else {
      ctx.fillStyle = '#182032';
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    }

    // Real Day / Night Atmospheric Lighting across Port Solaris Promenade
    if (isNight) {
      ctx.fillStyle = 'rgba(10, 16, 44, 0.32)';
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    } else {
      ctx.fillStyle = 'rgba(255, 224, 150, 0.05)';
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    }

    // Twinkling nebula stars at top overlook (extra luminous at night!)
    for (const s of this.stars) {
      const a = 0.25 + 0.75 * Math.max(0, Math.sin(this.time * 2.6 + s.phase));
      ctx.fillStyle = `rgba(255, 252, 224, ${a * (isNight ? 1.0 : 0.75)})`;
      ctx.fillRect(s.x, s.y, isNight ? 1.8 : 1.4, isNight ? 1.8 : 1.4);
    }

    // Ambient landmark glows matching integrated storefronts in hub_bg.png
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 4.2);
    const nightBoost = isNight ? 0.14 : 0;
    drawGlow(ctx, 132, 82, 38, '#fb923c', 0.24 + nightBoost + pulse * 0.1);
    drawGlow(ctx, GUILD_BOARD_POS.x, GUILD_BOARD_POS.y - 4, 34, '#38e8d4', 0.24 + nightBoost + pulse * 0.1);
    drawGlow(ctx, GUILD_BOARD_POS.x, GUILD_BOARD_POS.y - 16, 22, '#fbbf24', 0.18 + pulse * 0.08);
    drawGlow(ctx, 354, 72, 36, '#34d399', 0.22 + nightBoost + pulse * 0.08);
    drawGlow(ctx, 120, 194, 42, '#c084fc', 0.22 + nightBoost + pulse * 0.1);
    drawGlow(ctx, 362, 178, 42, '#38e8d4', 0.22 + nightBoost + pulse * 0.08);
    drawGlow(ctx, 240, 166, 38, '#38e8d4', 0.16 + nightBoost * 0.7 + pulse * 0.07);
    drawGlow(
      ctx,
      434,
      154,
      46 + pulse * 6,
      this.state.sector1Cleared ? '#fbbf24' : '#38e8d4',
      0.3 + nightBoost + pulse * 0.12,
    );
    if (isNight) {
      drawGlow(ctx, 196, 100, 26, '#fbbf24', 0.24);
      drawGlow(ctx, 288, 100, 26, '#fbbf24', 0.24);
      drawGlow(ctx, 186, 212, 26, '#fbbf24', 0.24);
      drawGlow(ctx, 294, 212, 26, '#fbbf24', 0.24);
    }

    // Subtle crisp building signage pills
    this.renderSignPills(ctx);

    // Depth-sorted entities: Guild Board Terminal, Kael, Dr. Lyra, Nyx, Vex, Strollers, Player
    type Drawable = { y: number; draw: () => void };
    const drawables: Drawable[] = [];

    // Integrated Galactic Guild Scoreboard Holo-Terminal on the scenic nebula overlook!
    drawables.push({
      y: GUILD_BOARD_POS.y + 8,
      draw: () => {
        drawPixelShadow(ctx, GUILD_BOARD_POS.x, GUILD_BOARD_POS.y + 11, 20, 5.5, 0.54);
        if (art.propScoreboard) {
          ctx.drawImage(art.propScoreboard, GUILD_BOARD_POS.x - 22, GUILD_BOARD_POS.y - 31, 44, 44);
        }
      },
    });

    // Schmied Kael standing right in front of Exo-Schmiede
    drawables.push({
      y: FORGE_POS.y - 6,
      draw: () => {
        const bob = Math.sin(this.time * 3.2) * 0.6;
        drawPixelShadow(ctx, FORGE_POS.x, FORGE_POS.y + 4, 9, 3.2, 0.48);
        if (art.npcKael) {
          ctx.drawImage(art.npcKael, FORGE_POS.x - 13, FORGE_POS.y - 24 + bob, 26, 29);
        }
      },
    });

    // Dr. Lyra standing warmly outside Med-Bay
    drawables.push({
      y: MEDBAY_POS.y - 6,
      draw: () => {
        const bob = Math.sin(this.time * 2.9 + 1.5) * 0.6;
        drawPixelShadow(ctx, MEDBAY_POS.x, MEDBAY_POS.y + 4, 8, 3.2, 0.48);
        if (art.npcLyra) {
          ctx.drawImage(art.npcLyra, MEDBAY_POS.x - 12, MEDBAY_POS.y - 23 + bob, 24, 28);
        }
      },
    });

    // Schwarzmarkt-Händlerin Nyx standing beside her integrated Black Market booth
    drawables.push({
      y: NYX_NPC_POS.y,
      draw: () => {
        const bob = Math.sin(this.time * 3.1 + 2.1) * 0.6;
        drawPixelShadow(ctx, NYX_NPC_POS.x, NYX_NPC_POS.y + 9, 8, 3, 0.48);
        if (art.npcNyx) {
          ctx.drawImage(art.npcNyx, NYX_NPC_POS.x - 12, NYX_NPC_POS.y - 19 + bob, 24, 28);
        }
      },
    });

    // Ingenieurin Vex standing beside her integrated Tech-Labor pavilion
    drawables.push({
      y: TECHLAB_NPC_POS.y,
      draw: () => {
        const bob = Math.sin(this.time * 3.5 + 0.8) * 0.6;
        drawPixelShadow(ctx, TECHLAB_NPC_POS.x, TECHLAB_NPC_POS.y + 9, 8, 3, 0.48);
        if (art.npcVex) {
          ctx.drawImage(art.npcVex, TECHLAB_NPC_POS.x - 12, TECHLAB_NPC_POS.y - 19 + bob, 24, 28);
        }
      },
    });

    // Strolling station residents
    for (const s of this.strollers) {
      drawables.push({
        y: s.y,
        draw: () => {
          const walking = s.walkAnim > 0;
          const bob = walking ? Math.abs(Math.sin(s.walkAnim)) * 2 : 0;
          const spr =
            s.kind === 'wanderer'
              ? art.npcWanderer
              : s.kind === 'astro'
                ? art.customers[0]
                : art.customers[1];
          drawPixelShadow(ctx, s.x, s.y + 11, 8, 3, 0.44);
          if (spr) {
            ctx.drawImage(spr, s.x - 12, s.y - 16 - bob, 24, 28);
          }
        },
      });
    }

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

    if (this.activePrompt) {
      this.renderPrompt(ctx, this.activePrompt.label, this.activePrompt.x, this.activePrompt.y);
    }
  }

  private renderSignPills(ctx: CanvasRenderingContext2D): void {
    ctx.font = 'bold 5px Silkscreen, monospace';
    ctx.textAlign = 'center';
    const pills = [
      { text: 'SCHMIEDE', x: 144, y: 40, color: '#fb923c' },
      { text: '★ KAPITÄNS-TAFEL', x: GUILD_BOARD_POS.x, y: 48, color: '#fde047' },
      { text: 'MED-BAY', x: 356, y: 24, color: '#34d399' },
      { text: 'SCHWARZMARKT', x: 120, y: 148, color: '#c084fc' },
      { text: 'TECH-LABOR', x: 358, y: 148, color: '#38e8d4' },
      { text: 'RAUMHAFEN →', x: 416, y: 90, color: '#38e8d4' },
    ];
    const keysLit =
      (this.state.sector1Cleared ? 1 : 0) +
      (this.state.sector2Cleared ? 1 : 0) +
      (this.state.sector3Cleared ? 1 : 0) +
      (this.state.sector4Cleared ? 1 : 0);
    if (keysLit > 0) {
      pills.push({ text: `★ ${keysLit}/4 SCHLÜSSEL`, x: 416, y: 101, color: '#fde047' });
    }
    for (const p of pills) {
      const w = Math.ceil(ctx.measureText(p.text).width) + 10;
      ctx.fillStyle = 'rgba(11, 16, 28, 0.88)';
      ctx.fillRect(p.x - w / 2, p.y - 5, w, 9);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 0.7;
      ctx.strokeRect(p.x - w / 2, p.y - 5, w, 9);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y + 1.5);
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
