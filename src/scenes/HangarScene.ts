import { getHDArt } from '../assets/artLoader';
import { drawGlow, drawPixelShadow } from '../assets/pixelArt';
import { getAtlas } from '../assets/sprites';
import { sound } from '../engine/audio';
import { VIRTUAL_HEIGHT, VIRTUAL_WIDTH, type InputManager } from '../engine/input';
import type { GameState } from '../systems/gameState';
import type { Direction } from '../types';

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

export interface HangarCallbacks {
  onReturnToHub: () => void;
  onLaunchSector1: () => void;
  onLaunchSector2: () => void;
  onToast: (msg: string, tone?: 'info' | 'good' | 'warn') => void;
}

// Exact coordinates aligned pixel-for-pixel to public/art/hangar_bg.png (480x270 logical)
const PROMENADE_GATE_POS = { x: 64, y: 138 };
const DOCK1_POS = { x: 146, y: 86 }; // Sektor 1: Verlassene Korvette (Unlocked & Ship Docked!)
const DOCK2_POS = { x: 364, y: 86 }; // Sektor 2: Kristall-Nebel (Ship docks once Sector 1 cleared!)
const DOCK3_POS = { x: 146, y: 202 }; // Sektor 3: Plasma-Gießerei (Empty Pad)
const DOCK4_POS = { x: 364, y: 202 }; // Sektor 4: Quanten-Abgrund (Empty Pad)
const OMEGA_GATE_POS = { x: 248, y: 144 }; // Central 5th Deep-Space Portal (4 Sector Keys)

const SEAL_SOCKETS = [
  { x: 223, y: 120, sector: 1 },
  { x: 273, y: 120, sector: 2 },
  { x: 223, y: 166, sector: 3 },
  { x: 273, y: 166, sector: 4 },
];

export class HangarScene {
  private state: GameState;
  private callbacks: HangarCallbacks;

  public playerX = 88;
  public playerY = 142;
  private facing: Direction = 'right';
  private walkAnim = 0;
  private dashTimer = 0;
  private dashCooldown = 0;
  private dashVx = 0;
  private dashVy = 0;
  private entryCooldown = 0;

  // Ship launch takeoff animation when boarding Dock I or Dock II!
  private launchingSector: 1 | 2 | null = null;
  private launchTimer = 0;
  private shipLiftY = 0;

  private particles: Particle[] = [];
  private stars: Array<{ x: number; y: number; phase: number }> = [];
  private time = 0;

  public activePrompt: { label: string; x: number; y: number } | null = null;

  constructor(state: GameState, callbacks: HangarCallbacks) {
    this.state = state;
    this.callbacks = callbacks;

    for (let i = 0; i < 26; i++) {
      this.stars.push({
        x: 96 + Math.random() * 308,
        y: 3 + Math.random() * 19,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  public onEnter(from: 'hub' | 'dungeon', returnedSector: 1 | 2 = 1): void {
    this.state.restoreFullVitals();
    this.dashTimer = 0;
    this.dashCooldown = 0;
    this.launchingSector = null;
    this.launchTimer = 0;
    this.shipLiftY = 0;
    this.entryCooldown = 0.45;
    this.particles = [];

    if (from === 'dungeon') {
      if (returnedSector === 2 && this.state.sector1Cleared) {
        this.playerX = 312;
        this.playerY = 128;
        this.facing = 'down';
        this.spawnBurst(DOCK2_POS.x, DOCK2_POS.y + 24, '#c084fc', 20);
      } else {
        // Stepping cleanly off Dock I ramp after landing back from Sector 1!
        this.playerX = 198;
        this.playerY = 128;
        this.facing = 'down';
        this.spawnBurst(DOCK1_POS.x, DOCK1_POS.y + 24, '#38e8d4', 18);
      }
    } else {
      this.playerX = 92;
      this.playerY = 142;
      this.facing = 'right';
      this.spawnBurst(PROMENADE_GATE_POS.x + 8, PROMENADE_GATE_POS.y, '#38e8d4', 14);
    }
  }

  private spawnBurst(x: number, y: number, color: string, count: number): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 14 + Math.random() * 44;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        color,
        size: 1.5 + Math.random() * 1.5,
        life: 0.32 + Math.random() * 0.32,
        maxLife: 0.64,
      });
    }
  }

  public update(dt: number, input: InputManager): void {
    this.time += dt;
    if (this.entryCooldown > 0) this.entryCooldown -= dt;
    if (this.dashCooldown > 0) this.dashCooldown -= dt;

    // Idle starship ion exhaust micro-sparks on Dock I
    if (Math.random() < dt * 9 && this.launchingSector !== 1) {
      const side = Math.random() < 0.5 ? -8 : 8;
      this.particles.push({
        x: DOCK1_POS.x + side + (Math.random() - 0.5) * 3,
        y: DOCK1_POS.y + 24,
        vx: (Math.random() - 0.5) * 6,
        vy: 14 + Math.random() * 14,
        color: Math.random() < 0.7 ? '#38e8d4' : '#a5f3fc',
        size: 1.4,
        life: 0.25 + Math.random() * 0.2,
        maxLife: 0.45,
      });
    }

    // Idle violet-cyan crystal thruster micro-sparks on Dock II once unlocked!
    if (this.state.sector1Cleared && Math.random() < dt * 9 && this.launchingSector !== 2) {
      const side = Math.random() < 0.5 ? -8 : 8;
      this.particles.push({
        x: DOCK2_POS.x + side + (Math.random() - 0.5) * 3,
        y: DOCK2_POS.y + 24,
        vx: (Math.random() - 0.5) * 6,
        vy: 14 + Math.random() * 14,
        color: Math.random() < 0.6 ? '#c084fc' : '#38e8d4',
        size: 1.4,
        life: 0.25 + Math.random() * 0.2,
        maxLife: 0.45,
      });
    }

    // Active starship launch sequence when boarding Dock I or Dock II!
    if (this.launchingSector !== null) {
      this.launchTimer += dt;
      this.activePrompt = null;
      const p = Math.min(1, this.launchTimer / 0.68);
      this.shipLiftY = p * p * 125;
      const dock = this.launchingSector === 2 ? DOCK2_POS : DOCK1_POS;
      for (let i = 0; i < 2; i++) {
        const side = i === 0 ? -8 : 8;
        this.particles.push({
          x: dock.x + side + (Math.random() - 0.5) * 4,
          y: dock.y + 24 - this.shipLiftY,
          vx: (Math.random() - 0.5) * 18,
          vy: 42 + Math.random() * 48,
          color:
            this.launchingSector === 2
              ? Math.random() < 0.5
                ? '#c084fc'
                : '#38e8d4'
              : Math.random() < 0.5
                ? '#fbbf24'
                : '#38e8d4',
          size: 2.2,
          life: 0.35,
          maxLife: 0.35,
        });
      }
      this.updateParticles(dt);
      if (this.launchTimer >= 0.68) {
        const target = this.launchingSector;
        this.launchingSector = null;
        if (target === 2) {
          this.callbacks.onLaunchSector2();
        } else {
          this.callbacks.onLaunchSector1();
        }
      }
      return;
    }

    const mv = input.getMoveVector();
    let vx = 0;
    let vy = 0;
    const stats = this.state.getStats();

    if (this.dashTimer > 0) {
      this.dashTimer -= dt;
      vx = this.dashVx;
      vy = this.dashVy;
      this.walkAnim += dt * 16;
    } else {
      const speed = 112 * stats.moveSpeedMult;
      vx = mv.x * speed;
      vy = mv.y * speed;
      if (mv.x !== 0 || mv.y !== 0) {
        this.walkAnim += dt * 11;
        if (Math.abs(mv.x) > Math.abs(mv.y)) {
          this.facing = mv.x > 0 ? 'right' : 'left';
        } else {
          this.facing = mv.y > 0 ? 'down' : 'up';
        }
      } else {
        this.walkAnim = 0;
      }

      if (input.dashPressed() && this.dashCooldown <= 0) {
        const dx = mv.x || (this.facing === 'right' ? 1 : this.facing === 'left' ? -1 : 0);
        const dy = mv.y || (this.facing === 'down' ? 1 : this.facing === 'up' ? -1 : 0);
        const len = Math.hypot(dx, dy) || 1;
        this.dashVx = (dx / len) * 245;
        this.dashVy = (dy / len) * 245;
        this.dashTimer = 0.14;
        this.dashCooldown = Math.max(0.28, 0.5 * stats.dashCooldownMult);
        sound.playDash();
        this.spawnBurst(this.playerX, this.playerY + 4, '#38e8d4', 8);
      }
    }

    this.movePlayer(vx * dt, vy * dt);
    this.updateInteraction(input, mv.x);
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
    if (x < 56 || x > 438 || y < 44 || y > 244) return false;
    // Left upper decorative portal & plant obstacle
    if (x < 84 && y < 112) return false;
    // Central 5th Omega Stargate circular pedestal obstacle
    if (Math.hypot(x - OMEGA_GATE_POS.x, y - OMEGA_GATE_POS.y) < 35) return false;
    // Keep hero clear of docked Sector 1 starship fuselage
    if (x > 118 && x < 174 && y > 54 && y < 114) return false;
    // Keep hero clear of docked Sector 2 Kristall-Kreuzer fuselage when unlocked!
    if (this.state.sector1Cleared && x > 336 && x < 392 && y > 54 && y < 114) return false;
    return true;
  }

  private updateInteraction(input: InputManager, moveX: number): void {
    this.activePrompt = null;

    // 1. Left Gateway back to Port Solaris Promenade
    if (Math.hypot(this.playerX - PROMENADE_GATE_POS.x, this.playerY - PROMENADE_GATE_POS.y) < 34) {
      this.activePrompt = {
        label: '[E] Zurück zur Port Solaris Promenade',
        x: PROMENADE_GATE_POS.x + 48,
        y: PROMENADE_GATE_POS.y - 26,
      };
      if (input.interactPressed() || (this.entryCooldown <= 0 && moveX < -0.65 && this.playerX <= 66)) {
        sound.playUiClick();
        this.callbacks.onReturnToHub();
      }
      return;
    }

    // 2. Dock I — Sektor 1 (Verlassene Korvette · Unlocked & Starship Docked!)
    if (Math.hypot(this.playerX - DOCK1_POS.x, this.playerY - DOCK1_POS.y) < 58) {
      this.activePrompt = {
        label:
          this.state.timeOfDay === 'night'
            ? '[E] 🚀 Einsteigen · Nacht-Start Sektor 1 (+35 % Rar)'
            : '[E] 🚀 Einsteigen & Start zu Sektor 1 (Ebene I–III)',
        x: DOCK1_POS.x + 12,
        y: DOCK1_POS.y + 44,
      };
      if (input.interactPressed()) {
        sound.playWarp();
        this.launchingSector = 1;
        this.launchTimer = 0;
        this.spawnBurst(DOCK1_POS.x, DOCK1_POS.y + 24, '#fbbf24', 20);
        this.callbacks.onToast('🚀 Triebwerke gezündet — Kurs auf Sektor 1: Verlassene Korvette!', 'good');
      }
      return;
    }

    // 3. Dock II — Sektor 2 (Kristall-Nebel · Kristall-Kreuzer docked once Sector 1 is cleared!)
    if (Math.hypot(this.playerX - DOCK2_POS.x, this.playerY - DOCK2_POS.y) < 58) {
      const unlocked = this.state.sector1Cleared;
      this.activePrompt = {
        label: unlocked
          ? this.state.timeOfDay === 'night'
            ? '[E] 🚀 Einsteigen · Nacht-Start Sektor 2 (+35 % Rar)'
            : '[E] 🚀 Einsteigen & Start zu Sektor 2: Kristall-Nebel!'
          : '[E] Dock II · Gesperrt (Kein Schiff angedockt)',
        x: DOCK2_POS.x - 16,
        y: DOCK2_POS.y + 44,
      };
      if (input.interactPressed()) {
        if (unlocked) {
          sound.playWarp();
          this.launchingSector = 2;
          this.launchTimer = 0;
          this.spawnBurst(DOCK2_POS.x, DOCK2_POS.y + 24, '#c084fc', 22);
          this.callbacks.onToast('🚀 Kristall-Kreuzer startet — Kurs auf Sektor 2: Kristall-Nebel!', 'good');
        } else {
          sound.playUiClick();
          this.callbacks.onToast(
            'Dock II ist leer — besiege zuerst A.E.G.I.S. Leviathan auf Ebene III in Sektor 1, um Sektor 2 freizuschalten!',
            'warn',
          );
        }
      }
      return;
    }

    // 4. Dock III — Sektor 3 (Plasma-Gießerei · Empty Pad)
    if (Math.hypot(this.playerX - DOCK3_POS.x, this.playerY - DOCK3_POS.y) < 52) {
      const hasKey3 = this.state.sector2Cleared;
      this.activePrompt = {
        label: hasKey3
          ? '[E] Dock III · Sektor 3 (★ S3-Schlüssel bereit!)'
          : '[E] Dock III · Sektor 3 (Gesperrt — kein Schiff)',
        x: DOCK3_POS.x + 12,
        y: DOCK3_POS.y - 46,
      };
      if (input.interactPressed()) {
        sound.playUiClick();
        if (hasKey3) {
          this.callbacks.onToast(
            '★ Sektor-3-Schlüssel erkannt! Dock III (Plasma-Gießerei) öffnet sich mit Meilenstein 6!',
            'good',
          );
        } else {
          this.callbacks.onToast(
            'Dock III (Plasma-Gießerei): Kein Schiff angedockt — besiege PRISMA-ARCHON in Sektor 2 für den S3-Schlüssel!',
            'info',
          );
        }
      }
      return;
    }

    // 5. Dock IV — Sektor 4 (Quanten-Abgrund · Empty Pad)
    if (Math.hypot(this.playerX - DOCK4_POS.x, this.playerY - DOCK4_POS.y) < 52) {
      this.activePrompt = {
        label: '[E] Dock IV · Sektor 4 (Gesperrt — kein Schiff)',
        x: DOCK4_POS.x - 12,
        y: DOCK4_POS.y - 46,
      };
      if (input.interactPressed()) {
        sound.playUiClick();
        this.callbacks.onToast(
          'Dock IV (Quanten-Abgrund): Kein Expeditionsschiff angedockt — Sektor-4-Schlüssel erforderlich.',
          'info',
        );
      }
      return;
    }

    // 6. Central 5th Deep-Space Omega Stargate (requires all 4 Sector Keys!)
    if (Math.hypot(this.playerX - OMEGA_GATE_POS.x, this.playerY - OMEGA_GATE_POS.y) < 50) {
      const keys = (this.state.sector1Cleared ? 1 : 0) + (this.state.sector2Cleared ? 1 : 0);
      this.activePrompt = {
        label: `[E] 5. Tiefenraum-Tor inspizieren (${keys} / 4 Sektor-Schlüssel)`,
        x: OMEGA_GATE_POS.x,
        y: OMEGA_GATE_POS.y - 42,
      };
      if (input.interactPressed()) {
        sound.playUiClick();
        if (keys >= 2) {
          this.callbacks.onToast(
            `★ ${keys}/4 Sektor-Siegel glühen (Sektor 1 & Sektor 2)! Bezwinge auch Sektor 3 & 4, um das 5. Omega-Tor zu öffnen!`,
            'good',
          );
        } else if (keys === 1) {
          this.callbacks.onToast(
            `★ Das 1. Sektor-Siegel glüht bereits (${keys}/4)! Starte auf Dock II in den Kristall-Nebel für Siegel #2!`,
            'good',
          );
        } else {
          this.callbacks.onToast(
            'Das 5. Tiefenraum-Tor ist mit 4 antiken Siegeln verschlossen. Bezwinge alle 4 Sektoren, um es zu öffnen!',
            'info',
          );
        }
      }
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
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 3.6);

    if (art.hangarBg) {
      ctx.drawImage(art.hangarBg, 0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    } else {
      ctx.fillStyle = '#182032';
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    }

    if (isNight) {
      ctx.fillStyle = 'rgba(10, 16, 44, 0.24)';
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    }

    // Twinkling stars along top deep-space railing
    for (const s of this.stars) {
      const a = 0.25 + 0.75 * Math.max(0, Math.sin(this.time * 2.5 + s.phase));
      ctx.fillStyle = `rgba(255, 252, 224, ${a})`;
      ctx.fillRect(s.x, s.y, 1.5, 1.5);
    }

    // Subtle warm lantern glows along upper railing
    for (const lx of [91, 198, 310, 415]) {
      drawGlow(ctx, lx, 22, 24, '#fbbf24', 0.2 + pulse * 0.06);
    }

    // Left Promenade gateway glow
    drawGlow(ctx, 56, 134, 34, '#38e8d4', 0.26 + pulse * 0.1);

    // Central 5th Omega Stargate core & 4 Sector Key Seal Sockets
    const keysLit = (this.state.sector1Cleared ? 1 : 0) + (this.state.sector2Cleared ? 1 : 0);
    drawGlow(
      ctx,
      OMEGA_GATE_POS.x,
      OMEGA_GATE_POS.y,
      38,
      keysLit >= 2 ? '#c084fc' : keysLit > 0 ? '#fbbf24' : '#38e8d4',
      (keysLit >= 2 ? 0.34 : keysLit > 0 ? 0.24 : 0.12) + pulse * 0.09,
    );
    for (const sock of SEAL_SOCKETS) {
      const lit1 = sock.sector === 1 && this.state.sector1Cleared;
      const lit2 = sock.sector === 2 && this.state.sector2Cleared;
      if (lit1 || lit2) {
        const col = lit2 ? '#e879f9' : '#fde047';
        drawGlow(ctx, sock.x, sock.y, 15, col, 0.58 + pulse * 0.22);
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(sock.x, sock.y, 3.3, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
        ctx.beginPath();
        ctx.arc(sock.x, sock.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Empty Pad Hologram Indicators for locked docks
    if (!this.state.sector1Cleared) {
      this.renderEmptyDockHolo(ctx, DOCK2_POS.x, DOCK2_POS.y, '#64748b', 'GESPERRT', pulse);
    }
    this.renderEmptyDockHolo(
      ctx,
      DOCK3_POS.x,
      DOCK3_POS.y,
      this.state.sector2Cleared ? '#fb923c' : '#64748b',
      this.state.sector2Cleared ? 'S3 SCHLÜSSEL' : 'GESPERRT',
      pulse,
    );
    this.renderEmptyDockHolo(ctx, DOCK4_POS.x, DOCK4_POS.y, '#64748b', 'GESPERRT', pulse);

    // Dock I — Docked Starlighter Explorer Ship (with hover hum & launch takeoff!)
    const hover1 = this.launchingSector === 1 ? 0 : Math.sin(this.time * 3.4) * 1.1;
    const lift1 = this.launchingSector === 1 ? this.shipLiftY : 0;
    const ship1X = DOCK1_POS.x;
    const ship1Y = DOCK1_POS.y - lift1 + hover1;
    drawPixelShadow(ctx, DOCK1_POS.x, DOCK1_POS.y + 18, 22, 8, Math.max(0.06, 0.45 - lift1 / 160));
    drawGlow(
      ctx,
      ship1X,
      ship1Y + 18,
      this.launchingSector === 1 ? 34 : 22,
      this.launchingSector === 1 ? '#fbbf24' : '#38e8d4',
      0.34 + pulse * 0.14,
    );
    if (art.shipCorvette) {
      ctx.drawImage(art.shipCorvette, ship1X - 24, ship1Y - 30.5, 48, 57);
    }

    // Dock II — Docked Kristall-Kreuzer Starship once Sector 1 is cleared!
    if (this.state.sector1Cleared) {
      const hover2 = this.launchingSector === 2 ? 0 : Math.sin(this.time * 3.6 + 1.5) * 1.1;
      const lift2 = this.launchingSector === 2 ? this.shipLiftY : 0;
      const ship2X = DOCK2_POS.x;
      const ship2Y = DOCK2_POS.y - lift2 + hover2;
      drawPixelShadow(ctx, DOCK2_POS.x, DOCK2_POS.y + 18, 23, 8, Math.max(0.06, 0.45 - lift2 / 160));
      drawGlow(
        ctx,
        ship2X,
        ship2Y + 18,
        this.launchingSector === 2 ? 36 : 24,
        this.launchingSector === 2 ? '#e879f9' : '#c084fc',
        0.38 + pulse * 0.14,
      );
      if (art.shipCrystal) {
        ctx.drawImage(art.shipCrystal, ship2X - 27, ship2Y - 30.5, 54, 57);
      }
    }

    // Compact station sign pills
    this.renderSignPills(ctx);

    // Hero (hidden once boarded & lifting off!)
    if (this.launchingSector === null) {
      this.renderPlayer(ctx);
    }

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

  private renderEmptyDockHolo(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    color: string,
    tag: string,
    pulse: number,
  ): void {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.28 + pulse * 0.16;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.arc(x, y, 18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.72;
    ctx.font = 'bold 4.8px Silkscreen, monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = color;
    ctx.fillText(tag, x, y + 2);
    ctx.restore();
  }

  private renderSignPills(ctx: CanvasRenderingContext2D): void {
    ctx.font = 'bold 5px Silkscreen, monospace';
    ctx.textAlign = 'center';
    const isNight = this.state.timeOfDay === 'night';
    const keys = (this.state.sector1Cleared ? 1 : 0) + (this.state.sector2Cleared ? 1 : 0);

    const pills = [
      { text: '◀ PROMENADE', x: 66, y: 174, color: '#38e8d4' },
      {
        text: isNight ? 'DOCK I · SEKTOR 1 🌙' : 'DOCK I · SEKTOR 1',
        x: DOCK1_POS.x,
        y: 44,
        color: '#38e8d4',
      },
      {
        text: this.state.sector1Cleared
          ? isNight
            ? 'DOCK II · SEKTOR 2 🌙'
            : 'DOCK II · KRISTALL-NEBEL'
          : 'DOCK II · GESPERRT',
        x: DOCK2_POS.x,
        y: 44,
        color: this.state.sector1Cleared ? '#c084fc' : '#94a3b8',
      },
      {
        text: this.state.sector2Cleared ? 'DOCK III · S3 BEREIT ★' : 'DOCK III · PLASMA-GIESSEREI',
        x: DOCK3_POS.x,
        y: 160,
        color: this.state.sector2Cleared ? '#fb923c' : '#94a3b8',
      },
      { text: 'DOCK IV · QUANTEN-ABGRUND', x: DOCK4_POS.x, y: 160, color: '#94a3b8' },
      {
        text: `5. TOR · ${keys}/4 SCHLÜSSEL`,
        x: OMEGA_GATE_POS.x,
        y: 188,
        color: keys >= 2 ? '#e879f9' : keys > 0 ? '#fde047' : '#94a3b8',
      },
    ];

    for (const p of pills) {
      const w = Math.ceil(ctx.measureText(p.text).width) + 9;
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
      const spr =
        this.facing === 'up'
          ? atlas.heroUp[frame]
          : this.facing === 'right'
            ? atlas.heroRight[frame]
            : this.facing === 'left'
              ? atlas.heroLeft[frame]
              : atlas.heroDown[frame];
      ctx.drawImage(spr, Math.round(this.playerX - 8), Math.round(this.playerY - 10));
    }
  }

  private renderPrompt(ctx: CanvasRenderingContext2D, text: string, x: number, y: number): void {
    ctx.font = 'bold 5.5px Silkscreen, monospace';
    const w = Math.max(54, Math.ceil(ctx.measureText(text).width) + 14);
    const px = Math.max(8, Math.min(VIRTUAL_WIDTH - w - 8, x - w / 2));
    const py = Math.max(8, Math.min(VIRTUAL_HEIGHT - 16, y - 8));

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
