import { getHDArt } from '../assets/artLoader';
import { drawGlow, drawPixelShadow } from '../assets/pixelArt';
import { getAtlas } from '../assets/sprites';
import { sound } from '../engine/audio';
import { VIRTUAL_HEIGHT, VIRTUAL_WIDTH, type InputManager } from '../engine/input';
import type { GameState } from '../systems/gameState';
import type { Direction, SectorId } from '../types';

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
  onLaunchSector3: () => void;
  onLaunchSector4: () => void;
  onLaunchOmegaGate: () => void;
  onToast: (msg: string, tone?: 'info' | 'good' | 'warn') => void;
}

// Exact coordinates aligned pixel-for-pixel to public/art/hangar_bg.png (480x270 logical)
const PROMENADE_GATE_POS = { x: 64, y: 138 };
const DOCK1_POS = { x: 146, y: 86 }; // Sektor 1: Verlassene Korvette (Unlocked & Ship Docked!)
const DOCK2_POS = { x: 364, y: 86 }; // Sektor 2: Kristall-Nebel (Ship docks once Sector 1 cleared!)
const DOCK3_POS = { x: 146, y: 202 }; // Sektor 3: Solar-Gießerei (Ship docks once Sector 2 cleared!)
const DOCK4_POS = { x: 364, y: 202 }; // Sektor 4: Ältesten-Monolith (Ship docks once Sector 3 cleared!)
const OMEGA_GATE_POS = { x: 248, y: 144 }; // Central 5th Deep-Space Portal (4 Sector Keys -> Omega-Anomalie!)

const SEAL_SOCKETS = [
  { x: 223, y: 120, sector: 1 as const, color: '#fde047' },
  { x: 273, y: 120, sector: 2 as const, color: '#e879f9' },
  { x: 223, y: 166, sector: 3 as const, color: '#fb923c' },
  { x: 273, y: 166, sector: 4 as const, color: '#38e8d4' },
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

  // Ship boarding & launch takeoff animation when boarding Docks I–IV!
  private launchingSector: 1 | 2 | 3 | 4 | null = null;
  private launchTimer = 0;
  private shipLiftY = 0;
  private shipLiftX = 0;
  private boardStartX = 0;
  private boardStartY = 0;
  private ignitionTriggered = false;

  // Ship landing & disembark animation when returning from a successful extraction!
  private disembarkSector: 1 | 2 | 3 | 4 | null = null;
  private disembarkTimer = 0;
  private disembarkTouchdownPlayed = false;
  private onDisembarkDone: (() => void) | null = null;

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

  private getDockPos(sector: 1 | 2 | 3 | 4): { x: number; y: number } {
    return sector === 4 ? DOCK4_POS : sector === 3 ? DOCK3_POS : sector === 2 ? DOCK2_POS : DOCK1_POS;
  }

  /** Spielt nach erfolgreicher Extraktion die Landung am Dock + sichtbares Aussteigen über die Rampe ab. */
  public startDisembark(sector: 1 | 2 | 3 | 4, onDone?: () => void): void {
    this.launchingSector = null;
    this.disembarkSector = sector;
    this.disembarkTimer = 0;
    this.disembarkTouchdownPlayed = false;
    this.onDisembarkDone = onDone ?? null;
    const dock = this.getDockPos(sector);
    this.playerX = dock.x + 2;
    this.playerY = dock.y + 8;
    this.facing = 'down';
    this.activePrompt = null;
  }

  private countSectorKeys(): number {
    return (
      (this.state.sector1Cleared ? 1 : 0) +
      (this.state.sector2Cleared ? 1 : 0) +
      (this.state.sector3Cleared ? 1 : 0) +
      (this.state.sector4Cleared ? 1 : 0)
    );
  }

  public onEnter(from: 'hub' | 'dungeon', returnedSector: SectorId = 1): void {
    this.state.restoreFullVitals();
    this.dashTimer = 0;
    this.dashCooldown = 0;
    this.launchingSector = null;
    this.launchTimer = 0;
    this.shipLiftY = 0;
    this.shipLiftX = 0;
    this.disembarkSector = null;
    this.disembarkTimer = 0;
    this.onDisembarkDone = null;
    this.entryCooldown = 0.45;
    this.particles = [];

    if (from === 'dungeon') {
      if (returnedSector === 5) {
        this.playerX = OMEGA_GATE_POS.x;
        this.playerY = OMEGA_GATE_POS.y + 44;
        this.facing = 'down';
        this.spawnBurst(OMEGA_GATE_POS.x, OMEGA_GATE_POS.y, '#fde047', 26);
      } else if (returnedSector === 4 && this.state.sector3Cleared) {
        this.playerX = 312;
        this.playerY = 178;
        this.facing = 'up';
        this.spawnBurst(DOCK4_POS.x, DOCK4_POS.y + 18, '#38e8d4', 22);
      } else if (returnedSector === 3 && this.state.sector2Cleared) {
        this.playerX = 198;
        this.playerY = 178;
        this.facing = 'up';
        this.spawnBurst(DOCK3_POS.x, DOCK3_POS.y + 18, '#fb923c', 22);
      } else if (returnedSector === 2 && this.state.sector1Cleared) {
        this.playerX = 312;
        this.playerY = 128;
        this.facing = 'down';
        this.spawnBurst(DOCK2_POS.x, DOCK2_POS.y + 24, '#c084fc', 20);
      } else {
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

    // Geparkte Schiffe ruhen still am Dock (keine laufenden Triebwerke vor dem Einsteigen)

    // Landung & sichtbares Aussteigen über die Rampe nach erfolgreicher Extraktion (0..1.55 s)
    if (this.disembarkSector !== null) {
      this.disembarkTimer += dt;
      this.activePrompt = null;
      const dock = this.getDockPos(this.disembarkSector);
      const t = this.disembarkTimer;
      if (t < 0.56) {
        // Schiff schwebt diagonal von rechts-oben aufs Lande-Pad ein
        const p = 1 - Math.min(1, t / 0.56);
        const ease = p * p;
        this.shipLiftY = ease * 96;
        this.shipLiftX = ease * 72;
        if (Math.random() < dt * 26) {
          this.particles.push({
            x: dock.x + this.shipLiftX - 10 + (Math.random() - 0.5) * 8,
            y: dock.y - this.shipLiftY + 14,
            vx: -18 + (Math.random() - 0.5) * 14,
            vy: 24 + Math.random() * 24,
            color: Math.random() < 0.5 ? '#e2e8f0' : '#38e8d4',
            size: 2,
            life: 0.28,
            maxLife: 0.28,
          });
        }
      } else {
        this.shipLiftY = 0;
        this.shipLiftX = 0;
        if (!this.disembarkTouchdownPlayed) {
          this.disembarkTouchdownPlayed = true;
          sound.playBoardingChime();
          for (let i = 0; i < 16; i++) {
            const ang = (i / 16) * Math.PI * 2;
            this.particles.push({
              x: dock.x + Math.cos(ang) * 14,
              y: dock.y + 16 + Math.sin(ang) * 5,
              vx: Math.cos(ang) * (24 + Math.random() * 16),
              vy: Math.sin(ang) * 8,
              color: '#e2e8f0',
              size: 2.2,
              life: 0.36,
              maxLife: 0.36,
            });
          }
        }
        // Ab 0.72 s: Spieler tritt aus der geöffneten Kabinentür & geht sichtbar die Treppe herunter aufs Hangar-Deck!
        if (t >= 0.72 && t < 1.28) {
          const dp = Math.min(1, (t - 0.72) / 0.56);
          const doorX = dock.x + 10;
          const doorY = dock.y + 4;
          const footX = dock.x + 3;
          const footY = dock.y + 26;
          const deckY = dock.y + 34;
          if (dp < 0.78) {
            const u = dp / 0.78;
            this.playerX = doorX + (footX - doorX) * u;
            this.playerY = doorY + (footY - doorY) * u;
          } else {
            const u = (dp - 0.78) / 0.22;
            this.playerX = footX;
            this.playerY = footY + (deckY - footY) * u;
          }
          this.facing = 'down';
          this.walkAnim += dt * 13;
        } else if (t >= 1.28) {
          this.playerX = dock.x + 3;
          this.playerY = dock.y + 34;
          this.walkAnim = 0;
        }
      }
      this.updateParticles(dt);
      if (this.disembarkTimer >= 1.55) {
        this.disembarkSector = null;
        this.shipLiftX = 0;
        this.shipLiftY = 0;
        const done = this.onDisembarkDone;
        this.onDisembarkDone = null;
        done?.();
      }
      return;
    }

    // 4-Phasen-Startsequenz mit echter seitlicher Einstiegstreppe:
    // 0.00..0.24 s: Seitentür öffnet sich & Treppe fährt aus (ship_*_docked_open.png)
    // 0.24..0.68 s: Spieler geht an die Treppe & steigt sichtbar die Stufen hoch in die Kabine
    // 0.68..0.92 s: Tür schließt, Cockpit blitzt auf, Dock-Klammern lösen sich mit Dampf
    // 0.92..1.55 s: Triebwerke zünden & Schiff hebt im 3/4-Schräglagen-Sprite diagonal nach rechts-oben ab!
    if (this.launchingSector !== null) {
      this.launchTimer += dt;
      this.activePrompt = null;
      const dock = this.getDockPos(this.launchingSector);
      const flameA =
        this.launchingSector === 4
          ? '#fde047'
          : this.launchingSector === 3
            ? '#f97316'
            : this.launchingSector === 2
              ? '#c084fc'
              : '#fbbf24';
      const flameB = this.launchingSector === 3 ? '#fde047' : '#38e8d4';

      if (this.launchTimer < 0.24) {
        // Rampe fährt aus — Spieler richtet sich auf die Treppe aus
        this.facing = 'up';
        this.shipLiftY = 0;
        this.shipLiftX = 0;
      } else if (this.launchTimer < 0.68) {
        // Spieler geht an den Fuß der Treppe und steigt dann die Stufen hoch in die leuchtende Tür
        const bp = Math.min(1, (this.launchTimer - 0.24) / 0.44);
        const footX = dock.x + 3;
        const footY = dock.y + 26;
        const doorX = dock.x + 10;
        const doorY = dock.y + 4;
        if (bp < 0.4) {
          const u = bp / 0.4;
          this.playerX = this.boardStartX + (footX - this.boardStartX) * u;
          this.playerY = this.boardStartY + (footY - this.boardStartY) * u;
        } else {
          const u = (bp - 0.4) / 0.6;
          this.playerX = footX + (doorX - footX) * u;
          this.playerY = footY + (doorY - footY) * u;
        }
        this.facing = 'up';
        this.walkAnim += dt * 15;
        this.shipLiftY = 0;
        this.shipLiftX = 0;
      } else if (this.launchTimer < 0.92) {
        // Tür schließt & Dock-Halteklammern zischen mit Dampf auf
        this.shipLiftY = 0;
        this.shipLiftX = 0;
        if (Math.random() < dt * 26) {
          const side = Math.random() < 0.5 ? -24 : 24;
          this.particles.push({
            x: dock.x + side,
            y: dock.y + 10,
            vx: side * 1.2 + (Math.random() - 0.5) * 10,
            vy: (Math.random() - 0.5) * 12,
            color: '#e2e8f0',
            size: 2.4,
            life: 0.3,
            maxLife: 0.3,
          });
        }
      } else {
        if (!this.ignitionTriggered) {
          this.ignitionTriggered = true;
          sound.playWarp();
          for (let i = 0; i < 20; i++) {
            const ang = (i / 20) * Math.PI * 2;
            this.particles.push({
              x: dock.x + Math.cos(ang) * 12,
              y: dock.y + 18 + Math.sin(ang) * 5,
              vx: Math.cos(ang) * (30 + Math.random() * 24),
              vy: Math.sin(ang) * 10 + 14,
              color: i % 3 === 0 ? '#e2e8f0' : flameB,
              size: i % 3 === 0 ? 2.6 : 1.8,
              life: 0.42,
              maxLife: 0.42,
            });
          }
        }
        if (this.launchTimer < 1.14) {
          const ip = (this.launchTimer - 0.92) / 0.22;
          this.shipLiftY = ip * ip * 14;
          this.shipLiftX = ip * ip * 6;
        } else {
          const lp = Math.min(1, (this.launchTimer - 1.14) / 0.41);
          this.shipLiftY = 14 + lp * lp * 145;
          this.shipLiftX = 6 + lp * lp * 125;
        }
        for (let i = 0; i < 2; i++) {
          this.particles.push({
            x: dock.x + this.shipLiftX - 18 + (Math.random() - 0.5) * 6,
            y: dock.y - this.shipLiftY + 14 + (Math.random() - 0.5) * 6,
            vx: -48 - Math.random() * 35,
            vy: 34 + Math.random() * 38,
            color: Math.random() < 0.5 ? flameA : flameB,
            size: 2.2,
            life: 0.34,
            maxLife: 0.34,
          });
        }
      }

      this.updateParticles(dt);
      if (this.launchTimer >= 1.55) {
        const target = this.launchingSector;
        this.launchingSector = null;
        this.ignitionTriggered = false;
        this.shipLiftX = 0;
        this.shipLiftY = 0;
        if (target === 4) this.callbacks.onLaunchSector4();
        else if (target === 3) this.callbacks.onLaunchSector3();
        else if (target === 2) this.callbacks.onLaunchSector2();
        else this.callbacks.onLaunchSector1();
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
    if (x < 84 && y < 112) return false;
    if (Math.hypot(x - OMEGA_GATE_POS.x, y - OMEGA_GATE_POS.y) < 35) return false;
    if (x > 106 && x < 186 && y > 54 && y < 114) return false;
    if (this.state.sector1Cleared && x > 324 && x < 404 && y > 54 && y < 114) return false;
    if (this.state.sector2Cleared && x > 106 && x < 186 && y > 170 && y < 230) return false;
    if (this.state.sector3Cleared && x > 324 && x < 404 && y > 170 && y < 230) return false;
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

    // 2. Dock I — Sektor 1 (Verlassene Korvette)
    if (Math.hypot(this.playerX - DOCK1_POS.x, this.playerY - DOCK1_POS.y) < 66) {
      this.activePrompt = {
        label:
          this.state.timeOfDay === 'night'
            ? '[E] 🚀 Einsteigen · Nacht-Run Sektor 1 (+35 % Rar · Laden fällt aus)'
            : '[E] 🚀 Einsteigen & Start zu Sektor 1 (Ebene I–III)',
        x: DOCK1_POS.x + 12,
        y: DOCK1_POS.y + 44,
      };
      if (input.interactPressed()) {
        sound.playBoardingChime();
        this.launchingSector = 1;
        this.launchTimer = 0;
        this.boardStartX = this.playerX;
        this.boardStartY = this.playerY;
        this.ignitionTriggered = false;
        this.spawnBurst(DOCK1_POS.x, DOCK1_POS.y + 8, '#38e8d4', 12);
        this.callbacks.onToast('🚀 Einsteigen & Triebwerke hochfahren — Sektor 1: Verlassene Korvette!', 'good');
      }
      return;
    }

    // 3. Dock II — Sektor 2 (Kristall-Nebel)
    if (Math.hypot(this.playerX - DOCK2_POS.x, this.playerY - DOCK2_POS.y) < 66) {
      const unlocked = this.state.sector1Cleared;
      this.activePrompt = {
        label: unlocked
          ? this.state.timeOfDay === 'night'
            ? '[E] 🚀 Einsteigen · Nacht-Run Sektor 2 (+35 % Rar · Laden fällt aus)'
            : '[E] 🚀 Einsteigen & Start zu Sektor 2: Kristall-Nebel!'
          : '[E] Dock II · Gesperrt (Kein Schiff angedockt)',
        x: DOCK2_POS.x - 16,
        y: DOCK2_POS.y + 44,
      };
      if (input.interactPressed()) {
        if (unlocked) {
          sound.playBoardingChime();
          this.launchingSector = 2;
          this.launchTimer = 0;
          this.boardStartX = this.playerX;
          this.boardStartY = this.playerY;
          this.ignitionTriggered = false;
          this.spawnBurst(DOCK2_POS.x, DOCK2_POS.y + 8, '#c084fc', 14);
          this.callbacks.onToast('🚀 Einsteigen & Kristall-Kreuzer hochfahren — Sektor 2: Kristall-Nebel!', 'good');
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

    // 4. Dock III — Sektor 3 (Solar-Gießerei · Solar-Fregatte docked once Sector 2 is cleared!)
    if (Math.hypot(this.playerX - DOCK3_POS.x, this.playerY - DOCK3_POS.y) < 66) {
      const unlocked = this.state.sector2Cleared;
      this.activePrompt = {
        label: unlocked
          ? this.state.timeOfDay === 'night'
            ? '[E] 🚀 Einsteigen · Nacht-Run Sektor 3 (+35 % Rar · Laden fällt aus)'
            : '[E] 🚀 Einsteigen & Start zu Sektor 3: Solar-Gießerei!'
          : '[E] Dock III · Sektor 3 (Gesperrt — kein Schiff)',
        x: DOCK3_POS.x + 12,
        y: DOCK3_POS.y - 46,
      };
      if (input.interactPressed()) {
        if (unlocked) {
          sound.playBoardingChime();
          this.launchingSector = 3;
          this.launchTimer = 0;
          this.boardStartX = this.playerX;
          this.boardStartY = this.playerY;
          this.ignitionTriggered = false;
          this.spawnBurst(DOCK3_POS.x, DOCK3_POS.y + 8, '#f97316', 14);
          this.callbacks.onToast('🔥 Einsteigen & Solar-Fregatte hochfahren — Sektor 3: Solar-Gießerei!', 'good');
        } else {
          sound.playUiClick();
          this.callbacks.onToast(
            'Dock III (Solar-Gießerei): Kein Schiff angedockt — besiege ★ PRISMA-ARCHON in Sektor 2!',
            'warn',
          );
        }
      }
      return;
    }

    // 5. Dock IV — Sektor 4 (Ältesten-Monolith · Sternen-Jäger docked once Sector 3 is cleared!)
    if (Math.hypot(this.playerX - DOCK4_POS.x, this.playerY - DOCK4_POS.y) < 66) {
      const unlocked = this.state.sector3Cleared;
      this.activePrompt = {
        label: unlocked
          ? this.state.timeOfDay === 'night'
            ? '[E] 🚀 Einsteigen · Nacht-Run Sektor 4 (+35 % Rar · Laden fällt aus)'
            : '[E] 🚀 Einsteigen & Start zu Sektor 4: Ältesten-Monolith!'
          : '[E] Dock IV · Sektor 4 (Gesperrt — kein Schiff)',
        x: DOCK4_POS.x - 16,
        y: DOCK4_POS.y - 46,
      };
      if (input.interactPressed()) {
        if (unlocked) {
          sound.playBoardingChime();
          this.launchingSector = 4;
          this.launchTimer = 0;
          this.boardStartX = this.playerX;
          this.boardStartY = this.playerY;
          this.ignitionTriggered = false;
          this.spawnBurst(DOCK4_POS.x, DOCK4_POS.y + 8, '#fde047', 14);
          this.callbacks.onToast('👑 Einsteigen & Ältesten-Jäger hochfahren — Sektor 4: Ältesten-Monolith!', 'good');
        } else {
          sound.playUiClick();
          this.callbacks.onToast(
            'Dock IV (Ältesten-Monolith): Kein Schiff angedockt — besiege ★ VULKAN-TITAN in Sektor 3!',
            'warn',
          );
        }
      }
      return;
    }

    // 6. Central 5th Deep-Space Stargate — immer interagierbar (M9): das Ziel-Modal zeigt Sperren
    //    (Omega ab 4/4 Siegeln, Spirale ab Omega-Sieg, Galaktische Prüfung ab Sektor 1).
    if (Math.hypot(this.playerX - OMEGA_GATE_POS.x, this.playerY - OMEGA_GATE_POS.y) < 52) {
      this.activePrompt = {
        label: '[E] 5. TIEFENRAUM-TOR — Ziel wählen',
        x: OMEGA_GATE_POS.x,
        y: OMEGA_GATE_POS.y - 42,
      };
      if (input.interactPressed()) {
        sound.playWarp();
        if (this.countSectorKeys() >= 4) {
          this.spawnBurst(OMEGA_GATE_POS.x, OMEGA_GATE_POS.y, '#fde047', 30);
        }
        this.callbacks.onLaunchOmegaGate();
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

    for (const s of this.stars) {
      const a = 0.25 + 0.75 * Math.max(0, Math.sin(this.time * 2.5 + s.phase));
      ctx.fillStyle = `rgba(255, 252, 224, ${a})`;
      ctx.fillRect(s.x, s.y, 1.5, 1.5);
    }

    for (const lx of [91, 198, 310, 415]) {
      drawGlow(ctx, lx, 22, 24, '#fbbf24', 0.2 + pulse * 0.06);
    }

    drawGlow(ctx, 56, 134, 34, '#38e8d4', 0.26 + pulse * 0.1);

    // Central 5th Omega Stargate core & 4 Sector Key Seal Sockets
    const keysLit = this.countSectorKeys();
    const gateColor =
      keysLit >= 4 ? '#fde047' : keysLit === 3 ? '#fb923c' : keysLit === 2 ? '#c084fc' : keysLit === 1 ? '#fbbf24' : '#38e8d4';
    drawGlow(
      ctx,
      OMEGA_GATE_POS.x,
      OMEGA_GATE_POS.y,
      keysLit >= 4 ? 54 : 38,
      gateColor,
      (keysLit >= 4 ? 0.55 : keysLit >= 2 ? 0.34 : keysLit > 0 ? 0.24 : 0.12) + pulse * 0.12,
    );

    // Swirling Celestial Omega Vortex inside the 5th Gate when ALL 4 Keys are unlocked!
    if (keysLit >= 4) {
      ctx.save();
      ctx.translate(OMEGA_GATE_POS.x, OMEGA_GATE_POS.y);
      ctx.rotate(this.time * 1.4);
      const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, 22);
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
      grad.addColorStop(0.45, 'rgba(56, 232, 212, 0.8)');
      grad.addColorStop(0.8, 'rgba(250, 204, 21, 0.45)');
      grad.addColorStop(1, 'rgba(250, 204, 21, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(254, 240, 138, 0.9)';
      ctx.lineWidth = 1.4;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.arc(0, 0, 16 + pulse * 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    for (const sock of SEAL_SOCKETS) {
      const lit =
        (sock.sector === 1 && this.state.sector1Cleared) ||
        (sock.sector === 2 && this.state.sector2Cleared) ||
        (sock.sector === 3 && this.state.sector3Cleared) ||
        (sock.sector === 4 && this.state.sector4Cleared);
      if (lit) {
        drawGlow(ctx, sock.x, sock.y, 16, sock.color, 0.62 + pulse * 0.22);
        ctx.fillStyle = sock.color;
        ctx.beginPath();
        ctx.arc(sock.x, sock.y, 3.4, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
        ctx.beginPath();
        ctx.arc(sock.x, sock.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Empty Pad Hologram Indicators for locked docks
    if (!this.state.sector1Cleared) {
      this.renderEmptyDockHolo(ctx, DOCK2_POS.x, DOCK2_POS.y, '#64748b', 'GESPERRT', pulse);
    }
    if (!this.state.sector2Cleared) {
      this.renderEmptyDockHolo(ctx, DOCK3_POS.x, DOCK3_POS.y, '#64748b', 'GESPERRT', pulse);
    }
    if (!this.state.sector3Cleared) {
      this.renderEmptyDockHolo(ctx, DOCK4_POS.x, DOCK4_POS.y, '#64748b', 'GESPERRT', pulse);
    }

    // Neue 3/4-Seitenansicht-Raumschiffe auf den Hangar-Pads (geparkt, offene Treppe beim Ein-/Aussteigen, 3/4-Flug beim Start/Landen)
    const drawDockedShip = (
      sectorNum: 1 | 2 | 3 | 4,
      pos: { x: number; y: number },
      sprDocked: HTMLCanvasElement | null,
      sprOpen: HTMLCanvasElement | null,
      sprBank: HTMLCanvasElement | null,
      sprFallback: HTMLCanvasElement | null,
      idleCol: string,
      launchCol: string,
    ) => {
      const launching = this.launchingSector === sectorNum;
      const disembarking = this.disembarkSector === sectorNum;
      const ignited = launching && this.launchTimer >= 0.92;
      const flyingIn = disembarking && this.disembarkTimer < 0.56;
      const rampOpen =
        (launching && this.launchTimer >= 0.08 && this.launchTimer < 0.72) ||
        (disembarking && this.disembarkTimer >= 0.64 && this.disembarkTimer < 1.36);

      const liftY = ignited || flyingIn ? this.shipLiftY : 0;
      const liftX = ignited || flyingIn ? this.shipLiftX : 0;
      const rumble = ignited && this.launchTimer < 1.16 ? Math.sin(this.launchTimer * 68) * 1.2 : 0;
      const sx = pos.x + liftX + rumble;
      const sy = pos.y - liftY;

      drawPixelShadow(ctx, pos.x, pos.y + 24, 38, 12, Math.max(0.06, 0.52 - liftY / 160));
      if (ignited || flyingIn) {
        drawGlow(ctx, sx - 16, sy + 18, 42, launchCol, 0.48 + pulse * 0.14);
      } else if (rampOpen) {
        // Warmes Innenlicht aus der geöffneten Einstiegstür aufs Deck
        drawGlow(ctx, pos.x + 3, pos.y + 12, 30, idleCol, 0.36 + pulse * 0.1);
      } else {
        drawGlow(ctx, pos.x, pos.y + 4, 20, idleCol, 0.1 + pulse * 0.04);
      }

      if ((ignited && this.launchTimer >= 1.05) || flyingIn) {
        const flySpr = sprBank ?? sprFallback;
        if (flySpr) {
          ctx.drawImage(flySpr, Math.round(sx - 47), Math.round(sy - 47), 94, 94);
        }
      } else {
        const bodySpr = (rampOpen ? sprOpen : sprDocked) ?? sprDocked ?? sprFallback;
        if (bodySpr) {
          ctx.drawImage(bodySpr, Math.round(sx - 52), Math.round(sy - 54), 104, 104);
        }
      }

      // Cockpit-Aufblitzen („Pilot an Bord“: 0.68..0.92 s)
      if (launching && this.launchTimer >= 0.68 && this.launchTimer < 0.94) {
        const flash = Math.sin(((this.launchTimer - 0.68) / 0.26) * Math.PI);
        drawGlow(ctx, sx + 10, sy - 14, 22, '#ffffff', flash * 0.85);
        drawGlow(ctx, sx + 10, sy - 14, 32, idleCol, flash * 0.6);
      }
    };

    // Dock I — Starlighter Corvette (always unlocked)
    drawDockedShip(
      1,
      DOCK1_POS,
      art.shipCorvetteDocked,
      art.shipCorvetteDockedOpen,
      art.shipCorvetteBank,
      art.shipCorvette,
      '#38e8d4',
      '#fbbf24',
    );
    // Dock II — Kristall-Kreuzer (unlocked after Sector 1)
    if (this.state.sector1Cleared) {
      drawDockedShip(
        2,
        DOCK2_POS,
        art.shipCrystalDocked,
        art.shipCrystalDockedOpen,
        art.shipCrystalBank,
        art.shipCrystal,
        '#c084fc',
        '#e879f9',
      );
    }
    // Dock III — Solar-Fregatte (unlocked after Sector 2)
    if (this.state.sector2Cleared) {
      drawDockedShip(
        3,
        DOCK3_POS,
        art.shipSolarDocked,
        art.shipSolarDockedOpen,
        art.shipSolarBank,
        art.shipSolar,
        '#f97316',
        '#fde047',
      );
    }
    // Dock IV — Ältesten-Sternenjäger (unlocked after Sector 3)
    if (this.state.sector3Cleared) {
      drawDockedShip(
        4,
        DOCK4_POS,
        art.shipMonolithDocked,
        art.shipMonolithDockedOpen,
        art.shipMonolithBank,
        art.shipMonolith,
        '#38e8d4',
        '#fde047',
      );
    }

    this.renderSignPills(ctx);

    if (this.launchingSector === null && this.disembarkSector === null) {
      this.renderPlayer(ctx, 1);
    } else if (this.launchingSector !== null && this.launchTimer < 0.68) {
      // Spieler läuft an die Treppe, verkleinert sich perspektivisch beim Hochsteigen & verschwindet sauber in der Tür
      const bp = this.launchTimer < 0.24 ? 0 : Math.min(1, (this.launchTimer - 0.24) / 0.44);
      const stairT = bp < 0.4 ? 0 : (bp - 0.4) / 0.6;
      const scale = 1 - 0.3 * stairT;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - Math.max(0, (stairT - 0.68) / 0.32));
      this.renderPlayer(ctx, scale);
      ctx.restore();
    } else if (this.disembarkSector !== null && this.disembarkTimer >= 0.72) {
      // Spieler tritt aus der geöffneten Kabinentür (kleiner) & wächst beim Heruntergehen auf 100 %!
      const dp = Math.min(1, (this.disembarkTimer - 0.72) / 0.56);
      const stairOut = Math.min(1, dp / 0.78);
      const scale = 0.7 + 0.3 * stairOut;
      const alpha = Math.min(1, stairOut / 0.28);
      ctx.save();
      ctx.globalAlpha = alpha;
      this.renderPlayer(ctx, scale);
      ctx.restore();
    }

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
    const keys = this.countSectorKeys();

    const pills = [
      { text: '◀ PROMENADE', x: 66, y: 174, color: '#38e8d4' },
      {
        text: isNight ? 'DOCK I · SEKTOR 1 🌙' : 'DOCK I · SEKTOR 1',
        x: DOCK1_POS.x,
        y: 40,
        color: '#38e8d4',
      },
      {
        text: this.state.sector1Cleared
          ? isNight
            ? 'DOCK II · SEKTOR 2 🌙'
            : 'DOCK II · KRISTALL-NEBEL'
          : 'DOCK II · GESPERRT',
        x: DOCK2_POS.x,
        y: 40,
        color: this.state.sector1Cleared ? '#c084fc' : '#94a3b8',
      },
      {
        text: this.state.sector2Cleared
          ? isNight
            ? 'DOCK III · SOLAR-GIESSEREI 🌙'
            : 'DOCK III · SOLAR-GIESSEREI'
          : 'DOCK III · GESPERRT',
        x: DOCK3_POS.x,
        y: 155,
        color: this.state.sector2Cleared ? '#fb923c' : '#94a3b8',
      },
      {
        text: this.state.sector3Cleared
          ? isNight
            ? 'DOCK IV · MONOLITH 🌙'
            : 'DOCK IV · ÄLTESTEN-MONOLITH'
          : 'DOCK IV · GESPERRT',
        x: DOCK4_POS.x,
        y: 155,
        color: this.state.sector3Cleared ? '#38e8d4' : '#94a3b8',
      },
      {
        text: keys >= 4 ? '★ 5. TOR · OMEGA AKTIV!' : `5. TOR · ${keys}/4 SCHLÜSSEL`,
        x: OMEGA_GATE_POS.x,
        y: 188,
        color: keys >= 4 ? '#fde047' : keys >= 2 ? '#e879f9' : keys > 0 ? '#fbbf24' : '#94a3b8',
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

  private renderPlayer(ctx: CanvasRenderingContext2D, scale = 1): void {
    const art = getHDArt();
    const atlas = getAtlas();
    const walking = this.walkAnim > 0;
    const bob = walking ? Math.abs(Math.sin(this.walkAnim)) * 2.2 : Math.sin(this.time * 3) * 0.4;
    const tilt = walking ? Math.sin(this.walkAnim) * 0.05 : 0;

    drawPixelShadow(ctx, this.playerX, this.playerY + 11, 8 * scale, 3.2 * scale, 0.5);

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
      ctx.scale(scale, scale);
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
      ctx.save();
      ctx.translate(Math.round(this.playerX), Math.round(this.playerY + 10));
      ctx.scale(scale, scale);
      ctx.drawImage(spr, -8, -20);
      ctx.restore();
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
