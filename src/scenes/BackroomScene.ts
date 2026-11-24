import { getHDArt } from '../assets/artLoader';
import { drawGlow, drawPixelShadow } from '../assets/pixelArt';
import { getAtlas } from '../assets/sprites';
import { sound } from '../engine/audio';
import { VIRTUAL_HEIGHT, VIRTUAL_WIDTH, type InputManager } from '../engine/input';
import type { GameState } from '../systems/gameState';
import type { Direction, WeaponId } from '../types';

export interface BackroomCallbacks {
  onReturnToShop: () => void;
  onOpenChest: () => void;
  onAdvanceTime: () => void;
  onToast: (msg: string, tone?: 'info' | 'good' | 'warn') => void;
}

// Walkable rounded oak floor aligned cleanly to public/art/backroom_bg.png
const FLOOR_LEFT = 48;
const FLOOR_RIGHT = 434;
const FLOOR_TOP = 112;
const FLOOR_BOTTOM = 232;
const FLOOR_CORNER_R = 24;
const PLAYER_RADIUS = 5.5;

const SLEEP_POD_POS = { x: 106, y: 148 };
const WEAPON_RACK_POS = { x: 106, y: 202 };
const TROPHY_PLINTH_POS = { x: 240, y: 112 };
const EXIT_DOOR_POS = { x: 240, y: 224 };

const CHEST_SPOTS = [
  { x: 374, y: 142, minTier: 0 },
  { x: 374, y: 186, minTier: 1 },
  { x: 330, y: 164, minTier: 2 },
];

export class BackroomScene {
  private state: GameState;
  private callbacks: BackroomCallbacks;

  public playerX = 240;
  public playerY = 204;
  private facing: Direction = 'up';
  private walkAnim = 0;
  private dashTimer = 0;
  private dashCooldown = 0;
  private dashVx = 0;
  private dashVy = 0;
  private time = 0;
  private entryCooldown = 0;

  private windowStars: Array<{ x: number; y: number; phase: number }> = [];
  private dustMotes: Array<{ x: number; y: number; phase: number; speed: number }> = [];

  public activePrompt: { label: string; x: number; y: number } | null = null;

  constructor(state: GameState, callbacks: BackroomCallbacks) {
    this.state = state;
    this.callbacks = callbacks;

    for (let i = 0; i < 24; i++) {
      this.windowStars.push({
        x: 152 + Math.random() * 176,
        y: 26 + Math.random() * 48,
        phase: Math.random() * Math.PI * 2,
      });
    }
    for (let i = 0; i < 14; i++) {
      this.dustMotes.push({
        x: 72 + Math.random() * 336,
        y: 112 + Math.random() * 112,
        phase: Math.random() * Math.PI * 2,
        speed: 3.5 + Math.random() * 4.5,
      });
    }
  }

  public onEnter(): void {
    this.state.restoreFullVitals();
    this.playerX = 240;
    this.playerY = 204;
    this.facing = 'up';
    this.walkAnim = 0;
    this.dashTimer = 0;
    this.dashCooldown = 0;
    this.entryCooldown = 0.25;
  }

  private getActiveChests(): Array<{ x: number; y: number }> {
    const tier = this.state.upgrades.shopTier ?? 0;
    return CHEST_SPOTS.filter((c) => tier >= c.minTier);
  }

  public update(dt: number, input: InputManager): void {
    this.time += dt;
    if (this.entryCooldown > 0) this.entryCooldown -= dt;

    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    const move = input.getMoveVector();

    if (input.dashPressed() && this.dashCooldown <= 0 && (move.x !== 0 || move.y !== 0)) {
      this.dashTimer = 0.16;
      this.dashCooldown = 0.45;
      this.dashVx = move.x * 230;
      this.dashVy = move.y * 230;
      sound.playDash();
    }

    let vx = move.x * 106;
    let vy = move.y * 106;
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
    this.updateInteraction(input, move.y);
  }

  private movePlayer(dx: number, dy: number): void {
    let px = this.playerX + dx;
    let py = this.playerY + dy;

    const chests = this.getActiveChests();

    for (let iter = 0; iter < 3; iter++) {
      const clamped = this.clampToRoundedFloor(px, py);
      px = clamped.x;
      py = clamped.y;

      // Sleep Pod smooth circle
      const outSleep = this.pushOutCircle(px, py, SLEEP_POD_POS.x, SLEEP_POD_POS.y + 1, 10 + PLAYER_RADIUS);
      px = outSleep.x;
      py = outSleep.y;

      // Weapon Rack smooth circle
      const outRack = this.pushOutCircle(px, py, WEAPON_RACK_POS.x, WEAPON_RACK_POS.y + 2, 9 + PLAYER_RADIUS);
      px = outRack.x;
      py = outRack.y;

      // Trophy Plinth smooth circle
      const outTrophy = this.pushOutCircle(px, py, TROPHY_PLINTH_POS.x, TROPHY_PLINTH_POS.y, 11 + PLAYER_RADIUS);
      px = outTrophy.x;
      py = outTrophy.y;

      // Active Storage Chests (1 -> 2 -> 3 depending on Shop Tier!)
      for (const c of chests) {
        const outChest = this.pushOutCircle(px, py, c.x, c.y + 1, 10 + PLAYER_RADIUS);
        px = outChest.x;
        py = outChest.y;
      }
    }

    this.playerX = px;
    this.playerY = py;
  }

  private clampToRoundedFloor(x: number, y: number): { x: number; y: number } {
    const minX = FLOOR_LEFT + PLAYER_RADIUS;
    const maxX = FLOOR_RIGHT - PLAYER_RADIUS;
    const minY = FLOOR_TOP + PLAYER_RADIUS;
    const maxY = FLOOR_BOTTOM - PLAYER_RADIUS;
    let px = Math.max(minX, Math.min(maxX, x));
    let py = Math.max(minY, Math.min(maxY, y));

    const r = Math.max(2, FLOOR_CORNER_R - PLAYER_RADIUS);
    const innerMinX = minX + r;
    const innerMaxX = maxX - r;
    const innerMinY = minY + r;
    const innerMaxY = maxY - r;

    const cx = px < innerMinX ? innerMinX : px > innerMaxX ? innerMaxX : px;
    const cy = py < innerMinY ? innerMinY : py > innerMaxY ? innerMaxY : py;
    if (cx !== px && cy !== py) {
      const dx = px - cx;
      const dy = py - cy;
      const dist = Math.hypot(dx, dy);
      if (dist > r && dist > 0.001) {
        px = cx + (dx / dist) * r;
        py = cy + (dy / dist) * r;
      }
    }
    return { x: px, y: py };
  }

  private pushOutCircle(
    px: number,
    py: number,
    cx: number,
    cy: number,
    minDist: number,
  ): { x: number; y: number } {
    const dx = px - cx;
    const dy = py - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= minDist * minDist) return { x: px, y: py };
    const dist = Math.sqrt(d2);
    if (dist < 0.0001) return { x: cx, y: cy + minDist };
    return {
      x: cx + (dx / dist) * minDist,
      y: cy + (dy / dist) * minDist,
    };
  }

  private updateInteraction(input: InputManager, moveY: number): void {
    this.activePrompt = null;

    // 1. Chrono-Ruhekapsel (Sleep Pod — Day <-> Night cycle!)
    if (Math.hypot(this.playerX - SLEEP_POD_POS.x, this.playerY - SLEEP_POD_POS.y) < 30) {
      this.activePrompt = {
        label:
          this.state.timeOfDay === 'day'
            ? '[E] Ruhen → Nacht (+35 % Rar-Loot)'
            : `[E] Schlafen → Morgen (Tag ${this.state.day + 1})`,
        x: SLEEP_POD_POS.x + 28,
        y: SLEEP_POD_POS.y - 22,
      };
      if (input.interactPressed()) {
        this.callbacks.onAdvanceTime();
      }
      return;
    }

    // 2. Lagertruhen (1–3 chests depending on Shop Tier!)
    const chests = this.getActiveChests();
    for (const c of chests) {
      if (Math.hypot(this.playerX - c.x, this.playerY - c.y) < 28) {
        this.activePrompt = {
          label: `[E] Lagertruhe (${this.state.getStats().chestCapacity} Slots · ${chests.length} Truhe${chests.length > 1 ? 'n' : ''})`,
          x: c.x - 14,
          y: c.y - 20,
        };
        if (input.interactPressed()) {
          sound.playUiClick();
          this.callbacks.onOpenChest();
        }
        return;
      }
    }

    // 3. Waffen-Ständer (quick gear & loadout access)
    if (Math.hypot(this.playerX - WEAPON_RACK_POS.x, this.playerY - WEAPON_RACK_POS.y) < 28) {
      this.activePrompt = {
        label: '[E] Waffen-Ständer & Ausrüstung',
        x: WEAPON_RACK_POS.x + 20,
        y: WEAPON_RACK_POS.y - 20,
      };
      if (input.interactPressed()) {
        sound.playUiClick();
        this.callbacks.onOpenChest();
      }
      return;
    }

    // 4. Sektor-1-Trophäen-Sockel
    if (Math.hypot(this.playerX - TROPHY_PLINTH_POS.x, this.playerY - TROPHY_PLINTH_POS.y) < 30) {
      this.activePrompt = {
        label: this.state.sector1Cleared
          ? '[E] ★ A.E.G.I.S. Leviathan Trophäe inspizieren'
          : `[E] Sektor-1-Trophäe (Tiefste Ebene: ${this.state.deepestFloor}/3)`,
        x: TROPHY_PLINTH_POS.x,
        y: TROPHY_PLINTH_POS.y - 14,
      };
      if (input.interactPressed()) {
        sound.playUiClick();
        if (this.state.sector1Cleared) {
          this.callbacks.onToast(
            '★ Sektor 1 bezwungen! Der goldene Leviathan-Kern schaltet den Sektor-2-Schlüssel (Kristall-Asteroidenfeld) frei!',
            'good',
          );
        } else {
          this.callbacks.onToast(
            `Besiege den gigantischen Sektor-1-Endboss A.E.G.I.S. LEVIATHAN auf Ebene III, um diese Trophäe zu erringen! (Erreicht: Ebene ${this.state.deepestFloor}/3)`,
            'info',
          );
        }
      }
      return;
    }

    // 5. Exit Doorway back to Astro-Barter salesroom
    if (Math.hypot(this.playerX - EXIT_DOOR_POS.x, this.playerY - EXIT_DOOR_POS.y) < 28) {
      this.activePrompt = {
        label: '[E] Zurück in den Verkaufsraum (Astro-Barter)',
        x: EXIT_DOOR_POS.x,
        y: EXIT_DOOR_POS.y - 18,
      };
      if (input.interactPressed() || (this.entryCooldown <= 0 && moveY > 0.65 && this.playerY >= FLOOR_BOTTOM - 8)) {
        sound.playUiClick();
        this.callbacks.onReturnToShop();
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D): void {
    const art = getHDArt();
    const isNight = this.state.timeOfDay === 'night';
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 3.8);
    const nightBoost = isNight ? 0.12 : 0;

    if (art.backroomBg) {
      ctx.drawImage(art.backroomBg, 0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    } else {
      ctx.fillStyle = '#231b16';
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    }

    // Cozy Day / Night atmospheric lighting
    if (isNight) {
      ctx.fillStyle = 'rgba(10, 16, 44, 0.28)';
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    } else {
      ctx.fillStyle = 'rgba(255, 224, 150, 0.05)';
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    }

    // Twinkling stars in panoramic nebula window
    for (const s of this.windowStars) {
      const a = 0.25 + 0.75 * Math.max(0, Math.sin(this.time * 2.6 + s.phase));
      ctx.fillStyle = `rgba(255, 252, 224, ${a * (isNight ? 1.0 : 0.78)})`;
      ctx.fillRect(s.x, s.y, isNight ? 1.8 : 1.4, isNight ? 1.8 : 1.4);
    }

    // Cozy ambient glows (warm lamps, trophy plinth, exit door)
    drawGlow(ctx, 108, 92, 54, '#fbbf24', 0.16 + nightBoost);
    drawGlow(ctx, 372, 92, 54, '#fbbf24', 0.16 + nightBoost);
    drawGlow(
      ctx,
      TROPHY_PLINTH_POS.x,
      TROPHY_PLINTH_POS.y - 6,
      28,
      this.state.sector1Cleared ? '#fbbf24' : '#38e8d4',
      (this.state.sector1Cleared ? 0.34 : 0.18) + pulse * 0.1,
    );
    drawGlow(ctx, EXIT_DOOR_POS.x, EXIT_DOOR_POS.y + 4, 28, '#fbbf24', 0.2 + pulse * 0.08);

    // Subtle crisp room labels
    this.renderBadges(ctx);

    // Depth-sorted props & player
    type Drawable = { y: number; draw: () => void };
    const drawables: Drawable[] = [];

    // Trophy on top-center plinth
    drawables.push({
      y: TROPHY_PLINTH_POS.y - 4,
      draw: () => this.renderTrophy(ctx, pulse),
    });

    // Chrono-Ruhekapsel (Sleep Pod)
    drawables.push({
      y: SLEEP_POD_POS.y,
      draw: () => this.renderSleepPod(ctx, pulse),
    });

    // Weapon Rack (displays unlocked weapons!)
    drawables.push({
      y: WEAPON_RACK_POS.y,
      draw: () => this.renderWeaponRack(ctx, pulse),
    });

    // Storage Chests (1 / 2 / 3 based on Shop Tier!)
    const chests = this.getActiveChests();
    for (let i = 0; i < chests.length; i++) {
      const c = chests[i];
      drawables.push({
        y: c.y,
        draw: () => this.renderChest(ctx, c.x, c.y, i, pulse),
      });
    }

    // Player
    drawables.push({
      y: this.playerY,
      draw: () => this.renderPlayer(ctx),
    });

    drawables.sort((a, b) => a.y - b.y);
    for (const d of drawables) d.draw();

    // Floating warm dust motes
    for (const m of this.dustMotes) {
      const mx = m.x + Math.sin(this.time * 0.7 + m.phase) * 7;
      const my = m.y - ((this.time * m.speed + m.phase * 15) % 85) + 40;
      const alpha = 0.22 + 0.32 * Math.sin(this.time * 2 + m.phase);
      ctx.fillStyle = isNight
        ? `rgba(165, 243, 252, ${Math.max(0, alpha)})`
        : `rgba(255, 236, 185, ${Math.max(0, alpha)})`;
      ctx.fillRect(mx, my, 1, 1);
    }

    if (this.activePrompt) {
      this.renderPrompt(ctx, this.activePrompt.label, this.activePrompt.x, this.activePrompt.y);
    }
  }

  private renderBadges(ctx: CanvasRenderingContext2D): void {
    ctx.font = 'bold 5px Silkscreen, monospace';
    ctx.textAlign = 'center';

    const badges = [
      { text: 'RUHEKAPSEL', x: SLEEP_POD_POS.x, y: SLEEP_POD_POS.y - 22, color: '#38e8d4' },
      { text: 'LAGERTRUHEN', x: 362, y: 118, color: '#fbbf24' },
      {
        text: this.state.sector1Cleared ? '★ LEVIATHAN' : 'TROPHÄE',
        x: TROPHY_PLINTH_POS.x,
        y: 82,
        color: this.state.sector1Cleared ? '#fde047' : '#94a3b8',
      },
      { text: '▼ ASTRO-BARTER', x: EXIT_DOOR_POS.x, y: 238, color: '#fde047' },
    ];

    for (const b of badges) {
      const w = Math.ceil(ctx.measureText(b.text).width) + 10;
      ctx.fillStyle = 'rgba(13, 18, 30, 0.9)';
      ctx.fillRect(b.x - w / 2, b.y - 5, w, 9);
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 0.7;
      ctx.strokeRect(b.x - w / 2, b.y - 5, w, 9);
      ctx.fillStyle = b.color;
      ctx.fillText(b.text, b.x, b.y + 1.5);
    }
  }

  private renderTrophy(ctx: CanvasRenderingContext2D, pulse: number): void {
    const art = getHDArt();
    const x = TROPHY_PLINTH_POS.x;
    const y = TROPHY_PLINTH_POS.y - 6;

    if (this.state.sector1Cleared && art.propTrophyS1) {
      const bob = Math.sin(this.time * 3.2) * 1.4;
      drawGlow(ctx, x, y - 6 + bob, 22, '#fbbf24', 0.38 + pulse * 0.14);
      ctx.drawImage(art.propTrophyS1, x - 12, y - 22 + bob, 24, 28);
    } else {
      // Holographic lock preview before Leviathan is conquered
      const bob = Math.sin(this.time * 2.8) * 1.2;
      ctx.save();
      ctx.globalAlpha = 0.45 + pulse * 0.25;
      ctx.strokeStyle = '#38e8d4';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y - 16 + bob);
      ctx.lineTo(x + 6, y - 8 + bob);
      ctx.lineTo(x, y + bob);
      ctx.lineTo(x - 6, y - 8 + bob);
      ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = '#38e8d4';
      ctx.font = 'bold 5.5px Silkscreen, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('?', x, y - 6 + bob);
      ctx.restore();
    }
  }

  private renderSleepPod(ctx: CanvasRenderingContext2D, pulse: number): void {
    const art = getHDArt();
    const x = SLEEP_POD_POS.x;
    const y = SLEEP_POD_POS.y;
    const isNight = this.state.timeOfDay === 'night';

    drawPixelShadow(ctx, x, y + 10, 14, 4.5, 0.48);
    drawGlow(ctx, x, y - 2, 24, isNight ? '#818cf8' : '#38e8d4', 0.24 + pulse * 0.1);
    if (art.propSleepPod) {
      ctx.drawImage(art.propSleepPod, x - 15, y - 18, 30, 30);
    } else {
      ctx.fillStyle = '#334155';
      ctx.fillRect(x - 11, y - 8, 22, 16);
      ctx.fillStyle = '#38e8d4';
      ctx.fillRect(x - 8, y - 5, 16, 8);
    }
  }

  private renderWeaponRack(ctx: CanvasRenderingContext2D, pulse: number): void {
    const art = getHDArt();
    const x = WEAPON_RACK_POS.x;
    const y = WEAPON_RACK_POS.y;

    drawPixelShadow(ctx, x, y + 9, 15, 4, 0.45);

    // Sleek steel-and-oak wall weapon stand
    ctx.fillStyle = '#3f2a1d';
    ctx.fillRect(x - 15, y - 4, 30, 12);
    ctx.fillStyle = '#5c3c28';
    ctx.fillRect(x - 13, y - 2, 26, 8);
    ctx.strokeStyle = '#92623c';
    ctx.lineWidth = 0.8;
    ctx.strokeRect(x - 15, y - 4, 30, 12);

    // Mount all unlocked weapon sprites neatly on the rack!
    const allWeapons: WeaponId[] = ['blade', 'spear', 'blaster', 'hammer'];
    const unlocked = allWeapons.filter((w) => this.state.unlockedWeapons[w]);
    const spacing = unlocked.length > 1 ? Math.min(8, 20 / (unlocked.length - 1)) : 0;
    const startX = x - ((unlocked.length - 1) * spacing) / 2;

    for (let i = 0; i < unlocked.length; i++) {
      const wid = unlocked[i];
      const wx = startX + i * spacing;
      const spr = art.weapons[wid];
      if (wid === this.state.equippedWeapon) {
        drawGlow(ctx, wx, y - 8, 10, '#38e8d4', 0.28 + pulse * 0.1);
      }
      if (spr) {
        ctx.drawImage(spr, wx - 7, y - 16, 14, 14);
      }
    }
  }

  private renderChest(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    index: number,
    pulse: number,
  ): void {
    const art = getHDArt();
    const atlas = getAtlas();
    drawPixelShadow(ctx, x, y + 9, 12, 4, 0.48);
    drawGlow(ctx, x, y - 1, 18, index === 0 ? '#38e8d4' : '#fbbf24', 0.16 + pulse * 0.06);
    if (art.chestClosed) {
      ctx.drawImage(art.chestClosed, x - 13, y - 15, 26, 26);
    } else {
      ctx.drawImage(atlas.props.chestClosed, Math.round(x - 8), Math.round(y - 8));
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
