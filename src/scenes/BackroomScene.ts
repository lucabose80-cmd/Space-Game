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
  onOpenLogbook: () => void;
  onOpenWeaponRack: () => void;
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
  /** Aufwach-Sequenz in der Koje nach K.O. (0 HP / Med-Evac) */
  private wakeUpTimer = -1;
  private onWakeDone: (() => void) | null = null;

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

  public onEnter(mode: 'default' | 'rescue' = 'default', onWakeDone?: () => void): void {
    this.state.restoreFullVitals();
    this.walkAnim = 0;
    this.dashTimer = 0;
    this.dashCooldown = 0;
    this.entryCooldown = 0.25;
    if (mode === 'rescue') {
      this.playerX = 92;
      this.playerY = 118;
      this.facing = 'down';
      this.wakeUpTimer = 0;
      this.onWakeDone = onWakeDone ?? null;
      this.activePrompt = null;
      sound.playDayTransition();
    } else {
      this.playerX = 240;
      this.playerY = 198;
      this.facing = 'up';
      this.wakeUpTimer = -1;
      this.onWakeDone = null;
    }
  }

  public update(dt: number, input: InputManager): void {
    this.time += dt;
    if (this.entryCooldown > 0) this.entryCooldown -= dt;

    // Aufwach-Animation in der Koje nach K.O. (0..1.25 s)
    if (this.wakeUpTimer >= 0) {
      this.wakeUpTimer += dt;
      this.activePrompt = null;
      if (this.wakeUpTimer >= 0.38 && this.wakeUpTimer < 1.05) {
        const p = Math.min(1, (this.wakeUpTimer - 0.38) / 0.67);
        const ease = 1 - (1 - p) * (1 - p);
        const hop = Math.sin(p * Math.PI) * 8;
        this.playerX = 92 + ease * 22;
        this.playerY = 118 + ease * 28 - hop;
        this.facing = 'down';
        this.walkAnim += dt * 11;
      } else if (this.wakeUpTimer >= 1.05) {
        this.playerX = 114;
        this.playerY = 146;
        this.walkAnim = 0;
      }
      if (this.wakeUpTimer >= 1.25) {
        this.wakeUpTimer = -1;
        this.callbacks.onToast('🩺 Dr. Lyra hat dich versorgt — du bist wieder sicher in deiner Koje!', 'info');
        const done = this.onWakeDone;
        this.onWakeDone = null;
        done?.();
      }
      return;
    }

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

  /** Quartier-Ausbaustufe 0..2 (Notkoje → Kajüte → Flaggschiff-Suite). */
  private get qTier(): number {
    return Math.max(0, Math.min(2, this.state.upgrades.quartersTier ?? 0));
  }

  private updateInteraction(input: InputManager, moveY: number): void {
    this.activePrompt = null;

    // 1. Eingebaute Chrono-Schlafkoje (Sleep Bunk — Day <-> Night cycle!)
    if (Math.hypot(this.playerX - SLEEP_POD_POS.x, this.playerY - SLEEP_POD_POS.y) < 34) {
      this.activePrompt = {
        // M10-C: tagsüber wird nicht geschlafen (Zeit für einen Run); nachts: Schicht überspringen
        label:
          this.state.timeOfDay === 'day'
            ? '☀ Tagsüber wird nicht geschlafen — ab in den Dungeon!'
            : `[E] Schicht überspringen → Morgen (Tag ${this.state.day + 1})`,
        x: SLEEP_POD_POS.x + 28,
        y: SLEEP_POD_POS.y - 26,
      };
      if (input.interactPressed() && this.state.timeOfDay === 'night') {
        this.callbacks.onAdvanceTime();
      }
      return;
    }

    // 2. Eingebaute Drohnen-Docking-Konsole (Companion Bots / Familiars!)
    if (Math.hypot(this.playerX - BOT_DOCK_POS.x, this.playerY - BOT_DOCK_POS.y) < 30) {
      if (this.qTier < 1) {
        this.activePrompt = {
          label: '🔒 Drohnen-Dock noch nicht gebaut — Quartier-Ausbau Stufe II (Shop-Ausbau-Terminal im Laden)',
          x: BOT_DOCK_POS.x,
          y: BOT_DOCK_POS.y - 28,
        };
        if (input.interactPressed()) {
          sound.playUiClick();
          this.callbacks.onToast('Unter der Plane liegt nur eine stillgelegte Dock-Luke. Baue dein Quartier im Shop-Ausbau aus (Stufe II).', 'info');
        }
        return;
      }
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

    // 3. Eingebauter Sektor-Trophäen-Altar (Sektor 1–4 & 5. Omega-Tor)
    if (Math.hypot(this.playerX - TROPHY_PLINTH_POS.x, this.playerY - TROPHY_PLINTH_POS.y) < 28) {
      const clearedCount =
        (this.state.sector1Cleared ? 1 : 0) +
        (this.state.sector2Cleared ? 1 : 0) +
        (this.state.sector3Cleared ? 1 : 0) +
        (this.state.sector4Cleared ? 1 : 0);
      this.activePrompt = {
        label: this.state.omegaCleared
          ? `[E] ★ OMEGA-LEGENDE (Alle 4 Sektoren + 5. Tor${this.state.ngPlusLevel > 0 ? ` · NG+${this.state.ngPlusLevel}` : ''})`
          : clearedCount > 0
            ? `[E] ★ Sektor-Trophäen inspizieren (${clearedCount}/4 Schlüssel aktiv)`
            : `[E] Sektor-1-Trophäe (Tiefste Ebene: ${this.state.deepestFloor}/3)`,
        x: TROPHY_PLINTH_POS.x,
        y: TROPHY_PLINTH_POS.y - 28,
      };
      if (input.interactPressed()) {
        sound.playUiClick();
        if (this.state.omegaCleared) {
          this.callbacks.onToast(
            `🌌 OMEGA-MEISTER! Alle 4 Sektor-Kerne & das 5. Tiefenraum-Tor bezwungen! Öffne dein Logbuch für Anzug-Stile & New Game+!`,
            'good',
          );
        } else if (this.state.sector4Cleared) {
          this.callbacks.onToast(
            '★ ALLE 4 SEKTOR-SCHLÜSSEL ERRUNGEN! Das zentrale 5. Tiefenraum-Tor im Raumhafen ist jetzt offen!',
            'good',
          );
        } else if (this.state.sector3Cleared) {
          this.callbacks.onToast(
            `🔥 Sektor 1–3 bezwungen (3/4 Schlüssel)! Der Ältesten-Sternenjäger wartet an Dock IV für Sektor 4 (Ebene ${this.state.deepestFloorS4}/3)!`,
            'good',
          );
        } else if (this.state.sector2Cleared) {
          this.callbacks.onToast(
            `💎 Sektor 1 & 2 bezwungen (2/4 Schlüssel)! Die Solar-Fregatte wartet an Dock III für Sektor 3 (Ebene ${this.state.deepestFloorS3}/3)!`,
            'good',
          );
        } else if (this.state.sector1Cleared) {
          this.callbacks.onToast(
            `★ Sektor 1 bezwungen! Der Kristall-Kreuzer wartet an Dock II im Raumhafen (Sektor 2 · Tiefste Ebene: ${this.state.deepestFloorS2}/3)!`,
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
      if (this.qTier < 1) {
        this.activePrompt = {
          label: '🔒 Jukebox noch nicht installiert — Quartier-Ausbau Stufe II (Shop-Ausbau-Terminal im Laden)',
          x: JUKEBOX_POS.x,
          y: JUKEBOX_POS.y - 28,
        };
        if (input.interactPressed()) {
          sound.playUiClick();
          this.callbacks.onToast('Das verschnürte Bündel ist noch verpackt. Baue dein Quartier im Shop-Ausbau aus (Stufe II).', 'info');
        }
        return;
      }
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

    // 5. Eingebaute Garderobe & Kapitäns-Logbuch (unten links)
    if (Math.hypot(this.playerX - WEAPON_RACK_POS.x, this.playerY - WEAPON_RACK_POS.y) < 28) {
      this.activePrompt = {
        label: '[E] Waffenschrank (Haupt- & Zweitwaffe)',
        x: WEAPON_RACK_POS.x + 14,
        y: WEAPON_RACK_POS.y - 22,
      };
      if (input.interactPressed()) {
        sound.playUiClick();
        this.callbacks.onOpenWeaponRack();
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

    const bg =
      this.qTier >= 2 ? (art.backroomBgT3 ?? art.backroomBg) : this.qTier === 1 ? art.backroomBg : (art.backroomBgT1 ?? art.backroomBg);
    if (bg) {
      ctx.drawImage(bg, 0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
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

    // Subtle living atmospheric lighting synced to built-in fixtures
    drawGlow(ctx, 108, 56, 36, '#fbbf24', 0.16 + nightBoost + pulse * 0.05);
    drawGlow(ctx, 404, 56, 36, '#fbbf24', 0.16 + nightBoost + pulse * 0.05);
    drawGlow(ctx, 86, 94, 30, isNight ? '#818cf8' : '#38e8d4', 0.14 + pulse * 0.06);
    if (this.qTier >= 1) {
      drawGlow(ctx, 164, 114, 30, '#38e8d4', 0.2 + pulse * 0.09);
      drawGlow(ctx, 326, 108, 28, '#fbbf24', 0.16 + pulse * 0.08);
    } else {
      // gesperrtes Dock: nur das kleine rote LOCKED-Licht blinkt
      drawGlow(ctx, 190, 112, 5, '#ef4444', 0.25 + pulse * 0.25);
    }
    drawGlow(ctx, EXIT_DOOR_POS.x, 236, 26, '#fbbf24', 0.16 + pulse * 0.06);

    // Active equipped Companion Bot hovering gently inside the glowing cyan Drone Bay dome!
    const activeBot = this.qTier >= 1 ? this.state.equippedCompanion : null;
    if (activeBot) {
      const botSpr = art.companions[activeBot];
      const bob = Math.sin(this.time * 4.0) * 2.0;
      const def = COMPANION_DEFS[activeBot];
      drawGlow(ctx, 164, 110 + bob, 18, def.accentColor, 0.32 + pulse * 0.12);
      if (botSpr) {
        ctx.drawImage(botSpr, 164 - 11, 99 + bob, 22, 22);
      }
    }

    // Stufe III: vier Trophäen-Vitrinen — je bezwungenem Sektor leuchtet die zugehörige Vitrine, die anderen sind abgedunkelt
    if (this.qTier >= 2) {
      const cleared = this.state.omegaCleared
        ? [true, true, true, true]
        : [this.state.sector1Cleared, this.state.sector2Cleared, this.state.sector3Cleared, this.state.sector4Cleared];
      const vit = [
        { x: 221, y: 87, w: 15, h: 22, col: '#fbbf24' }, // S1 Bernstein
        { x: 244, y: 86, w: 16, h: 23, col: '#c084fc' }, // S2 Violett
        { x: 266, y: 88, w: 16, h: 21, col: '#fb923c' }, // S3 Orange
        { x: 238, y: 110, w: 15, h: 14, col: '#38e8d4' }, // S4 Cyan
      ];
      vit.forEach((v, i) => {
        if (cleared[i]) {
          drawGlow(ctx, v.x, v.y, 17, v.col, 0.3 + pulse * 0.14);
        } else {
          ctx.fillStyle = 'rgba(8, 10, 24, 0.5)';
          ctx.fillRect(v.x - v.w / 2, v.y - v.h / 2, v.w, v.h);
        }
      });
    }

    // Radiant multi-sector victory auras over the built-in trophy altar!
    if (this.state.sector1Cleared && this.qTier === 1) {
      drawGlow(ctx, 240, 100, 32, '#fbbf24', 0.34 + pulse * 0.14);
      for (let i = 0; i < 4; i++) {
        const phase = (this.time * 0.65 + i * 0.25) % 1;
        const sx = 226 + i * 9 + Math.sin(this.time * 3 + i * 1.7) * 3;
        const sy = 104 - phase * 22;
        ctx.fillStyle = `rgba(254, 240, 138, ${Math.sin(phase * Math.PI) * 0.9})`;
        ctx.fillRect(sx, sy, 1.8, 1.8);
      }
    }
    if (this.state.sector2Cleared && this.qTier === 1) {
      drawGlow(ctx, 240, 96, 36, '#c084fc', 0.28 + pulse * 0.12);
    }
    if (this.state.sector3Cleared && this.qTier === 1) {
      drawGlow(ctx, 240, 94, 40, '#f97316', 0.28 + pulse * 0.12);
    }
    if ((this.state.sector4Cleared || this.state.omegaCleared) && this.qTier === 1) {
      drawGlow(ctx, 240, 90, 44, this.state.omegaCleared ? '#fde047' : '#38e8d4', 0.36 + pulse * 0.16);
      for (let i = 0; i < 5; i++) {
        const phase = (this.time * 0.85 + i * 0.2) % 1;
        const sx = 222 + i * 9 + Math.cos(this.time * 3.6 + i * 2.0) * 5;
        const sy = 100 - phase * 28;
        ctx.fillStyle = `rgba(165, 243, 252, ${Math.sin(phase * Math.PI) * 0.95})`;
        ctx.fillRect(sx, sy, 2.0, 2.0);
      }
    }

    // Floating musical notes rising softly from the built-in Retro-Jukebox when music is on!
    if (this.qTier >= 1 && !sound.isMuted() && !sound.isMusicMuted()) {
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

    // Player (bei Aufwach-Sequenz erst nach kurzem Erholungs-Glühen aus der Koje sichtbar)
    if (this.wakeUpTimer >= 0) {
      const healPulse = Math.sin(Math.min(1, this.wakeUpTimer / 1.1) * Math.PI);
      drawGlow(ctx, SLEEP_POD_POS.x, SLEEP_POD_POS.y - 6, 30, '#4ade80', healPulse * 0.55);
      if (this.wakeUpTimer >= 0.34) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, (this.wakeUpTimer - 0.34) / 0.22);
        this.renderPlayer(ctx);
        ctx.restore();
      }
    } else {
      this.renderPlayer(ctx);
    }

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

    const trophyText = this.state.omegaCleared
      ? '★ OMEGA-MEISTER'
      : this.state.sector4Cleared
        ? '★ 4/4 SEKTOREN'
        : this.state.sector3Cleared
          ? '★ S1–S3 SIEGER'
          : this.state.sector2Cleared
            ? '★ S1 & S2 SIEGER'
            : this.state.sector1Cleared
              ? '★ LEVIATHAN'
              : 'TROPHÄE';
    const trophyCol = this.state.omegaCleared
      ? '#fde047'
      : this.state.sector4Cleared
        ? '#38e8d4'
        : this.state.sector3Cleared
          ? '#fb923c'
          : this.state.sector2Cleared
            ? '#e879f9'
            : this.state.sector1Cleared
              ? '#fde047'
              : '#94a3b8';

    const badges = [
      { text: 'RUHEKOJE', x: 86, y: 66, color: '#38e8d4' },
      { text: this.qTier >= 1 ? 'DROHNEN' : '🔒 DROHNEN', x: 164, y: 80, color: this.qTier >= 1 ? '#38bdf8' : '#94a3b8' },
      { text: trophyText, x: 240, y: 74, color: trophyCol },
      { text: this.qTier >= 1 ? 'JUKEBOX' : '🔒 JUKEBOX', x: 326, y: 74, color: this.qTier >= 1 ? '#e879f9' : '#94a3b8' },
      { text: 'STIL & LOGBUCH', x: 84, y: 150, color: '#fb923c' },
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
