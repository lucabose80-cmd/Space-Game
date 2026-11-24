import { getHDArt } from '../assets/artLoader';
import { drawGlow, drawPixelShadow } from '../assets/pixelArt';
import { getAtlas } from '../assets/sprites';
import { COMPANION_DEFS } from '../data/companions';
import { sound } from '../engine/audio';
import { VIRTUAL_HEIGHT, VIRTUAL_WIDTH, type InputManager } from '../engine/input';
import type { GameState } from '../systems/gameState';
import type { Direction } from '../types';

export interface BackroomCallbacks {
  onReturnToShop: () => void;
  onOpenChest: () => void;
  onOpenCompanionDock: () => void;
  onOpenJukebox: () => void;
  onAdvanceTime: () => void;
  onToast: (msg: string, tone?: 'info' | 'good' | 'warn') => void;
}

// Architecturally aligned interaction spots matching public/art/backroom_bg.png (480x270 logical!)
const SLEEP_POD_POS = { x: 86, y: 140 };
const BOT_DOCK_POS = { x: 164, y: 142 };
const TROPHY_PLINTH_POS = { x: 240, y: 142 };
const JUKEBOX_POS = { x: 324, y: 142 };
const WEAPON_RACK_POS = { x: 122, y: 178 };
const CHEST_ALCOVE_POS = { x: 356, y: 178 };
const EXIT_DOOR_POS = { x: 240, y: 224 };

export class BackroomScene {
  private state: GameState;
  private callbacks: BackroomCallbacks;

  public playerX = 240;
  public playerY = 196;
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
        x: 80 + Math.random() * 320,
        y: 125 + Math.random() * 98,
        phase: Math.random() * Math.PI * 2,
        speed: 3.5 + Math.random() * 4.5,
      });
    }
  }

  public onEnter(): void {
    this.state.restoreFullVitals();
    this.playerX = 240;
    this.playerY = 198;
    this.facing = 'up';
    this.walkAnim = 0;
    this.dashTimer = 0;
    this.dashCooldown = 0;
    this.entryCooldown = 0.25;
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
    const nx = this.playerX + dx;
    if (this.isWalkable(nx, this.playerY)) {
      this.playerX = nx;
    }
    const ny = this.playerY + dy;
    if (this.isWalkable(this.playerX, ny)) {
      this.playerY = ny;
    }
  }

  /**
   * Exact walkable floor silhouette matching the architecturally built-in Captain's Quarters:
   * - Upper corridor right in front of Bunk Bed, Drone Dock, Trophy Altar & Jukebox (x=54..422, y=134..154)
   * - Wide central rug & side corridors between Left Weapon Alcove and Right Chest Alcove (x=122..358, y=134..226)
   * - Recessed bottom exit doorway arch back to Astro-Barter (x=214..266, y=218..236)
   */
  private isWalkable(x: number, y: number): boolean {
    // Upper promenade in front of bunk bed, drone console, trophy altar, jukebox & vinyl shelf
    if (x >= 54 && x <= 422 && y >= 134 && y <= 154) {
      return true;
    }
    // Central cozy rug hall between left weapon nook (x < 120) and right chest bay (x > 360)
    if (x >= 122 && x <= 358 && y >= 134 && y <= 226) {
      // Gently keep clear of the thick wooden door arch pillars flanking the exit doorway
      if (y > 194 && ((x >= 198 && x <= 212) || (x >= 268 && x <= 282))) {
        return false;
      }
      return true;
    }
    // Exit archway passage down to threshold rug
    if (x >= 214 && x <= 266 && y >= 194 && y <= 236) {
      return true;
    }
    return false;
  }

  private updateInteraction(input: InputManager, moveY: number): void {
    this.activePrompt = null;

    // 1. Eingebaute Chrono-Schlafkoje (Sleep Bunk — Day <-> Night cycle!)
    if (Math.hypot(this.playerX - SLEEP_POD_POS.x, this.playerY - SLEEP_POD_POS.y) < 34) {
      this.activePrompt = {
        label:
          this.state.timeOfDay === 'day'
            ? '[E] Ruhen → Nacht (+35 % Rar-Loot)'
            : `[E] Schlafen → Morgen (Tag ${this.state.day + 1})`,
        x: SLEEP_POD_POS.x + 28,
        y: SLEEP_POD_POS.y - 26,
      };
      if (input.interactPressed()) {
        this.callbacks.onAdvanceTime();
      }
      return;
    }

    // 2. Eingebaute Drohnen-Docking-Konsole (Companion Bots / Familiars!)
    if (Math.hypot(this.playerX - BOT_DOCK_POS.x, this.playerY - BOT_DOCK_POS.y) < 30) {
      const unlockedCount = Object.values(this.state.unlockedCompanions).filter(Boolean).length;
      this.activePrompt = {
        label: `[E] Drohnen-Dock (${unlockedCount}/4 Begleiter-Bots)`,
        x: BOT_DOCK_POS.x,
        y: BOT_DOCK_POS.y - 28,
      };
      if (input.interactPressed()) {
        sound.playUiClick();
        this.callbacks.onOpenCompanionDock();
      }
      return;
    }

    // 3. Eingebauter Sektor-1-Trophäen-Altar
    if (Math.hypot(this.playerX - TROPHY_PLINTH_POS.x, this.playerY - TROPHY_PLINTH_POS.y) < 28) {
      this.activePrompt = {
        label: this.state.sector1Cleared
          ? '[E] ★ A.E.G.I.S. Leviathan Trophäe inspizieren'
          : `[E] Sektor-1-Trophäe (Tiefste Ebene: ${this.state.deepestFloor}/3)`,
        x: TROPHY_PLINTH_POS.x,
        y: TROPHY_PLINTH_POS.y - 28,
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

    // 4. Eingebaute Sternen-Jukebox (Retro-Synth Soundtrack!)
    if (Math.hypot(this.playerX - JUKEBOX_POS.x, this.playerY - JUKEBOX_POS.y) < 32) {
      this.activePrompt = {
        label: '[E] Sternen-Jukebox (Musik wählen)',
        x: JUKEBOX_POS.x,
        y: JUKEBOX_POS.y - 28,
      };
      if (input.interactPressed()) {
        sound.playUiClick();
        this.callbacks.onOpenJukebox();
      }
      return;
    }

    // 5. Eingebaute Waffen-Nische (unten links)
    if (Math.hypot(this.playerX - WEAPON_RACK_POS.x, this.playerY - WEAPON_RACK_POS.y) < 28) {
      this.activePrompt = {
        label: '[E] Waffen-Regal & Ausrüstung',
        x: WEAPON_RACK_POS.x + 10,
        y: WEAPON_RACK_POS.y - 22,
      };
      if (input.interactPressed()) {
        sound.playUiClick();
        this.callbacks.onOpenChest();
      }
      return;
    }

    // 6. Eingebaute Lagertruhen-Nische (unten rechts)
    if (Math.hypot(this.playerX - CHEST_ALCOVE_POS.x, this.playerY - CHEST_ALCOVE_POS.y) < 30) {
      const cap = this.state.getStats().chestCapacity;
      this.activePrompt = {
        label: `[E] Lagertruhen öffnen (${cap} Slots sicher)`,
        x: CHEST_ALCOVE_POS.x - 16,
        y: CHEST_ALCOVE_POS.y - 22,
      };
      if (input.interactPressed()) {
        sound.playUiClick();
        this.callbacks.onOpenChest();
      }
      return;
    }

    // 7. Eingebauter Torbogen zurück zu Astro-Barter
    if (Math.hypot(this.playerX - EXIT_DOOR_POS.x, this.playerY - EXIT_DOOR_POS.y) < 28) {
      this.activePrompt = {
        label: '[E] Zurück in den Verkaufsraum (Astro-Barter)',
        x: EXIT_DOOR_POS.x,
        y: EXIT_DOOR_POS.y - 20,
      };
      if (input.interactPressed() || (this.entryCooldown <= 0 && moveY > 0.65 && this.playerY >= 224)) {
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
      ctx.fillStyle = 'rgba(255, 224, 150, 0.04)';
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    }

    // Twinkling stars in panoramic nebula window
    for (const s of this.windowStars) {
      const a = 0.25 + 0.75 * Math.max(0, Math.sin(this.time * 2.6 + s.phase));
      ctx.fillStyle = `rgba(255, 252, 224, ${a * (isNight ? 1.0 : 0.78)})`;
      ctx.fillRect(s.x, s.y, isNight ? 1.8 : 1.4, isNight ? 1.8 : 1.4);
    }

    // Subtle living atmospheric lighting synced to built-in fixtures (lanterns, bunk, drone bay, altar, jukebox, exit)
    drawGlow(ctx, 108, 56, 36, '#fbbf24', 0.16 + nightBoost + pulse * 0.05);
    drawGlow(ctx, 404, 56, 36, '#fbbf24', 0.16 + nightBoost + pulse * 0.05);
    drawGlow(ctx, 86, 94, 30, isNight ? '#818cf8' : '#38e8d4', 0.14 + pulse * 0.06);
    drawGlow(ctx, 164, 114, 30, '#38e8d4', 0.2 + pulse * 0.09);
    drawGlow(ctx, 326, 108, 28, '#fbbf24', 0.16 + pulse * 0.08);
    drawGlow(ctx, EXIT_DOOR_POS.x, 236, 26, '#fbbf24', 0.16 + pulse * 0.06);

    // Active equipped Companion Bot hovering gently inside the glowing cyan Drone Bay dome!
    const activeBot = this.state.equippedCompanion;
    if (activeBot) {
      const botSpr = art.companions[activeBot];
      const bob = Math.sin(this.time * 4.0) * 2.0;
      const def = COMPANION_DEFS[activeBot];
      drawGlow(ctx, 164, 110 + bob, 18, def.accentColor, 0.32 + pulse * 0.12);
      if (botSpr) {
        ctx.drawImage(botSpr, 164 - 11, 99 + bob, 22, 22);
      }
    }

    // Radiant golden victory aura & rising star sparkles over the built-in altar relics once Sector 1 is cleared!
    if (this.state.sector1Cleared) {
      drawGlow(ctx, 240, 100, 32, '#fbbf24', 0.34 + pulse * 0.14);
      drawGlow(ctx, 240, 92, 16, '#fef08a', 0.28 + pulse * 0.12);
      for (let i = 0; i < 4; i++) {
        const phase = (this.time * 0.65 + i * 0.25) % 1;
        const sx = 226 + i * 9 + Math.sin(this.time * 3 + i * 1.7) * 3;
        const sy = 104 - phase * 22;
        ctx.fillStyle = `rgba(254, 240, 138, ${Math.sin(phase * Math.PI) * 0.9})`;
        ctx.fillRect(sx, sy, 1.8, 1.8);
      }
    }

    // Floating musical notes rising softly from the built-in Retro-Jukebox when music is on!
    if (!sound.isMuted() && !sound.isMusicMuted()) {
      ctx.save();
      ctx.font = 'bold 6px Silkscreen, monospace';
      ctx.textAlign = 'center';
      for (let i = 0; i < 2; i++) {
        const phase = (this.time * 0.75 + i * 0.5) % 1;
        const nx = 326 + Math.sin(this.time * 2.8 + i * 2.4) * 7;
        const ny = 92 - phase * 16;
        ctx.globalAlpha = Math.sin(phase * Math.PI) * 0.92;
        ctx.fillStyle = i === 0 ? '#38e8d4' : '#f0abfc';
        ctx.fillText(i === 0 ? '♪' : '♫', nx, ny);
      }
      ctx.restore();
    }

    // Player
    this.renderPlayer(ctx);

    // Subtle crisp room signage pills aligned neatly above built-in zones
    this.renderBadges(ctx);

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
      { text: 'RUHEKOJE', x: 86, y: 66, color: '#38e8d4' },
      { text: 'DROHNEN', x: 164, y: 80, color: '#38bdf8' },
      {
        text: this.state.sector1Cleared ? '★ LEVIATHAN' : 'TROPHÄE',
        x: 240,
        y: 74,
        color: this.state.sector1Cleared ? '#fde047' : '#94a3b8',
      },
      { text: 'JUKEBOX', x: 326, y: 74, color: '#e879f9' },
      { text: 'WAFFEN', x: 80, y: 150, color: '#fb923c' },
      { text: 'LAGERTRUHE', x: 400, y: 150, color: '#fbbf24' },
      { text: '▼ ASTRO-BARTER', x: EXIT_DOOR_POS.x, y: 252, color: '#fde047' },
    ];

    for (const b of badges) {
      const w = Math.ceil(ctx.measureText(b.text).width) + 10;
      ctx.fillStyle = 'rgba(13, 18, 30, 0.88)';
      ctx.fillRect(b.x - w / 2, b.y - 5, w, 9);
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 0.7;
      ctx.strokeRect(b.x - w / 2, b.y - 5, w, 9);
      ctx.fillStyle = b.color;
      ctx.fillText(b.text, b.x, b.y + 1.5);
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
