import { getHDArt } from '../assets/artLoader';
import { HUB_BUILDINGS, HUB_TIER_PATCHES, type HubBuildingDef, type HubBuildingId } from '../data/hubBuildings';
import { drawContactShadow, drawGlow, drawPixelShadow } from '../assets/pixelArt';
import { getAtlas } from '../assets/sprites';
import { sound } from '../engine/audio';
import { VIRTUAL_HEIGHT, VIRTUAL_WIDTH, type InputManager } from '../engine/input';
import { getChatterPool, STROLLER_PLAN, type StrollerKind } from '../data/story/storyChapters';
import type { GameState } from '../systems/gameState';
import { HubEvolutionRenderer } from './hubEvolution';
import { drawMinaSprite } from './HubCutsceneOverlay';
import type { Direction, StoryNpcId } from '../types';

interface Stroller {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  waitTimer: number;
  walkAnim: number;
  kind: StrollerKind;
  /** Variante für „guest“-Passanten (Index in art.customers). */
  variant?: number;
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
  onEnterMarketTerrace: () => void;
  onEnterDungeon: () => void;
  /** M10-A: Omega-Fest ist fällig (einmalig nach dem Omega-Sieg). */
  onFestivalDue?: () => void;
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
const MARKET_TERRACE_POS = { x: 240, y: 222 };
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
  private lastDt = 0.016;
  private evo: HubEvolutionRenderer;
  private tintCache = new Map<string, HTMLCanvasElement>();
  private chatterTimer = 12;
  /** Aktuelle Sprechblase eines Passanten (Test-Hook: öffentlich lesbar). */
  public chatter: { strollerIndex: number; text: string; life: number } | null = null;
  /** Sekunden bis zum Omega-Fest (-1 = nicht fällig). */
  private festivalTimer = -1;

  /** Enthüllungs-Effekt frisch geöffneter Gebäude (Baustellen-Patch blendet aus). */
  private reveals: Array<{ id: HubBuildingId; t: number }> = [];

  public activePrompt: { label: string; x: number; y: number } | null = null;
  /** Blendet während Live-Promenaden-Cutscenes doppelte NPCs, Spieler, !-Marker & Prompts aus. */
  public hideActorsForCutscene = false;

  constructor(state: GameState, callbacks: HubCallbacks) {
    this.state = state;
    this.callbacks = callbacks;
    this.evo = new HubEvolutionRenderer(state, {
      forge: FORGE_POS,
      medbay: MEDBAY_POS,
      nyxNpc: NYX_NPC_POS,
      techNpc: TECHLAB_NPC_POS,
      guild: GUILD_BOARD_POS,
    });

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
    this.syncStrollers();
  }

  /** Test-Hook: Zugriff auf den Stations-Renderer (Sprites ein-/ausschalten, aktive Elemente lesen). */
  public getEvolution(): HubEvolutionRenderer {
    return this.evo;
  }

  public getStrollerKinds(): StrollerKind[] {
    return this.strollers.map((x) => x.kind);
  }

  /** Passanten-Spots, die nicht in Kollisionskreisen (Obelisk, Leuchtfeuer) liegen. */
  private getStrollerSpots(): Array<{ x: number; y: number }> {
    const spots = [
      { x: 214, y: 174 },
      { x: 240, y: 164 },
      { x: 266, y: 174 },
      { x: 240, y: 112 },
      { x: 216, y: 204 },
      { x: 264, y: 204 },
    ];
    const cols = this.evo.getColliders();
    return spots.filter((p) => cols.every((c) => Math.hypot(p.x - c.x, p.y - c.y) > c.r + 16));
  }

  /** Passanten-Plan je Kapitel (kumulativ, höchstens 6 inkl. der 2 Standard-Passanten). */
  private syncStrollers(): void {
    const wanted = STROLLER_PLAN.filter((p) => p.minChapter <= this.state.story.chapter).map((p) => p.kind);
    const extras = this.strollers.slice(2);
    if (extras.length === wanted.length && extras.every((x, i) => x.kind === wanted[i])) return;
    this.strollers = this.strollers.slice(0, 2);
    const spots = this.getStrollerSpots();
    wanted.slice(0, 4).forEach((kind, i) => {
      const sp = spots[(i + 1) % spots.length] ?? { x: 240, y: 190 };
      this.strollers.push({
        x: sp.x,
        y: sp.y,
        targetX: sp.x,
        targetY: sp.y,
        waitTimer: 1 + i * 0.7,
        walkAnim: 0,
        kind,
        variant: i + 2,
      });
    });
  }

  public onEnter(from: 'shop' | 'dungeon' | 'market_terrace'): void {
    this.state.restoreFullVitals();
    this.dashTimer = 0;
    this.dashCooldown = 0;
    this.particles = [];
    this.syncStrollers();
    // P4: Gebäude öffnen durch Ereignisse (erste Expedition, Verkäufe, Sektor-Sieg)
    this.state.checkHubUnlocks();
    this.reveals = [];
    for (const id of this.state.pendingHubReveals) {
      const def = HUB_BUILDINGS.find((b) => b.id === id);
      if (!def) continue;
      this.reveals.push({ id, t: 0 });
      this.callbacks.onToast(def.openToast, 'good');
      sound.playUpgradeReveal();
    }
    this.state.pendingHubReveals = [];
    this.chatter = null;
    this.chatterTimer = 8 + Math.random() * 6;
    // Omega-Fest: einmalig, nur auf Wunsch überspringbar (siehe main.ts)
    this.festivalTimer =
      this.state.story.chapter >= 5 && !this.state.story.flags.includes('festival_seen') ? 0.8 : -1;
    if (from === 'dungeon') {
      this.playerX = 388;
      this.playerY = 136;
      this.facing = 'left';
      this.spawnBurst(414, 144, '#38e8d4', 18);
    } else if (from === 'market_terrace') {
      this.playerX = 240;
      this.playerY = 202;
      this.facing = 'up';
    } else {
      this.playerX = 96;
      this.playerY = 138;
      this.facing = 'right';
    }
  }

  public update(dt: number, input: InputManager): void {
    this.time += dt;
    this.lastDt = dt;
    // Enthüllung geöffneter Gebäude: Funken über der Baustelle, dann ist sie weg
    for (let i = this.reveals.length - 1; i >= 0; i--) {
      const r = this.reveals[i];
      const def = HUB_BUILDINGS.find((b) => b.id === r.id);
      const prev = r.t;
      r.t += dt;
      if (def && Math.floor(prev * 12) !== Math.floor(r.t * 12)) {
        this.spawnBurst(def.rect.x / 2 + (Math.random() * def.rect.w) / 2, def.rect.y / 2 + (Math.random() * def.rect.h) / 2, '#fde047', 3);
      }
      if (r.t >= 1.5) this.reveals.splice(i, 1);
    }

    if (this.festivalTimer >= 0) {
      this.festivalTimer -= dt;
      if (this.festivalTimer < 0) {
        this.festivalTimer = -1;
        this.callbacks.onFestivalDue?.();
        return;
      }
    }

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
    this.updateChatter(dt);
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
    // M10-A: Obelisk & Leuchtfeuer der Stations-Entwicklung sind solide
    for (const c of this.evo.getColliders()) {
      if (Math.hypot(x - c.x, y - c.y) < c.r) return false;
    }
    // Keep clear of architecturally built-in Nyx's Black Market storefront (lower-left)
    if (x > 58 && x < 178 && y > 148 && y < 238) return false;
    // Keep clear of architecturally built-in Vex's Tech-Labor pavilion (lower-right)
    if (x > 302 && x < 418 && y > 148 && y < 248) return false;
    return true;
  }

  private updateStrollers(dt: number): void {
    const speed = 28;
    const spots = this.getStrollerSpots();
    const cols = this.evo.getColliders();
    for (const s of this.strollers) {
      const dx = s.targetX - s.x;
      const dy = s.targetY - s.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 3) {
        s.x += (dx / dist) * speed * dt;
        s.y += (dy / dist) * speed * dt;
        s.walkAnim += dt * 7;
        // Obelisk & Co.: Passanten laufen außen herum statt hindurch
        for (const c of cols) {
          const cd = Math.hypot(s.x - c.x, s.y - c.y);
          if (cd < c.r + 7) {
            const nx = (s.x - c.x) / Math.max(0.01, cd);
            const ny = (s.y - c.y) / Math.max(0.01, cd);
            s.x = c.x + nx * (c.r + 7);
            s.y = c.y + ny * (c.r + 7);
          }
        }
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
        label: this.hasNewTalk('kael') ? '[E] 💬 Kael · Neues Gespräch' : "[E] Kael's Exo-Schmiede (Waffen & MK-VIII)",
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
        label: this.hasNewTalk('lyra') ? '[E] 💬 Lyra · Neues Gespräch' : "[E] Dr. Lyra's Med-Bay",
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
    if (this.lockedNear('blackmarket', input)) return;
    const nearNyx =
      Math.hypot(this.playerX - NYX_NPC_POS.x, this.playerY - NYX_NPC_POS.y) < 34 ||
      (this.playerX >= 76 && this.playerX <= 184 && this.playerY >= 139 && this.playerY <= 156);
    if (nearNyx) {
      this.activePrompt = {
        label: this.hasNewTalk('nyx') ? '[E] 💬 Nyx · Neues Gespräch' : "[E] Nyx' Schwarzmarkt (Seltene Teile)",
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
    if (this.lockedNear('techlab', input)) return;
    const nearVex =
      Math.hypot(this.playerX - TECHLAB_NPC_POS.x, this.playerY - TECHLAB_NPC_POS.y) < 34 ||
      (this.playerX >= 298 && this.playerX <= 400 && this.playerY >= 139 && this.playerY <= 156);
    if (nearVex) {
      this.activePrompt = {
        label: this.hasNewTalk('vex') ? '[E] 💬 Vex · Neues Gespräch' : "[E] Vex' Tech-Labor (Module & Sektor-Karte)",
        x: 332,
        y: 148,
      };
      if (input.interactPressed()) {
        sound.playUiClick();
        this.callbacks.onOpenTechLab();
      }
      return;
    }

    // 6. South Gateway to Marktplatz-Terrasse (Milo's Alchemie-Bar, Händler-Gilde & Solaris-Handelsbank!)
    if (Math.hypot(this.playerX - MARKET_TERRACE_POS.x, this.playerY - MARKET_TERRACE_POS.y) < 32) {
      if (this.lockedNear('terrace', input, true)) return;
      const readyNote =
        this.state.hasReadyBankPayout()
          ? ' ★ Auszahlung!'
          : this.state.hasReadyBigOrder()
            ? ' ★ Großauftrag!'
            : '';
      this.activePrompt = {
        label: `[E] ↓ Marktplatz-Terrasse (Alchemie & Bank)${readyNote}`,
        x: MARKET_TERRACE_POS.x,
        y: MARKET_TERRACE_POS.y - 22,
      };
      if (input.interactPressed()) {
        sound.playUiClick();
        this.callbacks.onEnterMarketTerrace();
      }
      return;
    }

    // 7. Gateway to Port Solaris Raumhafen & Sektor-Docks (Docks I–IV & 5. Tor!)
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

  // ==================== MEILENSTEIN 10-A: PASSANTEN-SPRECHBLASEN ====================
  private updateChatter(dt: number): void {
    if (this.chatter) {
      this.chatter.life -= dt;
      if (this.chatter.life <= 0) this.chatter = null;
    }
    this.chatterTimer -= dt;
    if (this.chatterTimer > 0) return;
    this.chatterTimer = 14 + Math.random() * 8;
    this.triggerChatter();
  }

  /**
   * Lässt EINEN zufälligen Passanten eine zum Kapitel/Flag passende Zeile sagen.
   * Keine Blase bei aktivem Prompt oder wenn alle Passanten näher als 40 px am Spieler stehen (`force` ignoriert das).
   */
  public triggerChatter(force = false): boolean {
    if (this.chatter && !force) return false;
    if (this.activePrompt && !force) return false;
    const pool = getChatterPool(this.state.story.chapter, this.state.story.flags);
    if (pool.length === 0) return false;
    const candidates: number[] = [];
    this.strollers.forEach((st, i) => {
      if (force || Math.hypot(st.x - this.playerX, st.y - this.playerY) >= 40) candidates.push(i);
    });
    if (candidates.length === 0) return false;
    const idx = candidates[Math.floor(Math.random() * candidates.length)];
    const line = pool[Math.floor(Math.random() * pool.length)];
    this.chatter = { strollerIndex: idx, text: line.text, life: 3.5 };
    return true;
  }

  /** Bricht auf höchstens 2 Zeilen à 34 Zeichen um. */
  private wrapChatter(text: string): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let cur = '';
    for (const w of words) {
      if ((cur + ' ' + w).trim().length > 34 && cur) {
        lines.push(cur);
        cur = w;
      } else {
        cur = (cur + ' ' + w).trim();
      }
    }
    if (cur) lines.push(cur);
    return lines.slice(0, 2);
  }

  private renderChatter(ctx: CanvasRenderingContext2D): void {
    const ch = this.chatter;
    if (!ch) return;
    const st = this.strollers[ch.strollerIndex];
    if (!st) return;
    const lines = this.wrapChatter(ch.text);
    ctx.save();
    ctx.font = 'bold 4.6px Silkscreen, monospace';
    ctx.textAlign = 'center';
    const w = Math.ceil(Math.max(...lines.map((l) => ctx.measureText(l).width))) + 8;
    const h = lines.length * 7 + 4;
    const bx = Math.max(w / 2 + 2, Math.min(VIRTUAL_WIDTH - w / 2 - 2, st.x));
    const by = st.y - 22 - h;
    const fade = Math.min(1, ch.life / 0.4, (3.5 - ch.life) / 0.25 + 0.2);
    ctx.globalAlpha = Math.max(0, Math.min(1, fade));
    ctx.fillStyle = 'rgba(11, 16, 28, 0.92)';
    ctx.fillRect(bx - w / 2, by, w, h);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 0.7;
    ctx.strokeRect(bx - w / 2, by, w, h);
    ctx.beginPath();
    ctx.moveTo(st.x - 2, by + h);
    ctx.lineTo(st.x + 2, by + h);
    ctx.lineTo(st.x, by + h + 3);
    ctx.closePath();
    ctx.fillStyle = 'rgba(11, 16, 28, 0.92)';
    ctx.fill();
    ctx.fillStyle = '#e2e8f0';
    lines.forEach((l, i) => ctx.fillText(l, bx, by + 7 + i * 7));
    ctx.restore();
  }

  /** Einmalig vorberechnete Einfärbung eines vorhandenen Kunden-Sprites (Fallback für neue Passanten). */
  private tinted(base: HTMLCanvasElement | undefined | null, color: string, key: string): HTMLCanvasElement | null {
    if (!base) return null;
    const hit = this.tintCache.get(key);
    if (hit) return hit;
    const c = document.createElement('canvas');
    c.width = base.width;
    c.height = base.height;
    const cx = c.getContext('2d');
    if (!cx) return base;
    cx.imageSmoothingEnabled = false;
    cx.drawImage(base, 0, 0);
    cx.globalCompositeOperation = 'source-atop';
    cx.globalAlpha = 0.4;
    cx.fillStyle = color;
    cx.fillRect(0, 0, c.width, c.height);
    this.tintCache.set(key, c);
    return c;
  }

  private getStrollerSprite(st: Stroller): HTMLCanvasElement | null {
    const art = getHDArt();
    const useSprites = this.evo.spritesEnabled;
    switch (st.kind) {
      case 'wanderer':
        return art.npcWanderer;
      case 'astro':
        return art.customers[0] ?? null;
      case 'horned':
        return art.customers[1] ?? null;
      case 'pilgrim':
        return (useSprites ? art.npcPilgrim : null) ?? this.tinted(art.customers[0], '#a855f7', 'pilgrim');
      case 'foundry':
        return (useSprites ? art.npcFoundryWorker : null) ?? this.tinted(art.customers[1], '#f97316', 'foundry');
      case 'scholar':
        return (useSprites ? art.npcElderScholar : null) ?? this.tinted(art.customers[2], '#14b8a6', 'scholar');
      case 'guest':
      default:
        return art.customers.length > 0 ? art.customers[(st.variant ?? 0) % art.customers.length] : null;
    }
  }

  private hasNewTalk(npc: StoryNpcId): boolean {
    return this.state.getPendingScene(npc) !== null;
  }

  /** „!“ über NPCs mit neuem Gespräch; nach „Später“ nur ein ruhiger Punkt. */
  /** Gesperrtes Gebäude: Prompt mit Hinweis statt Funktion. `force` = Position wurde bereits geprüft. */
  private lockedNear(id: HubBuildingId, input: InputManager, force = false): boolean {
    if (this.state.isHubBuildingOpen(id)) return false;
    const def = HUB_BUILDINGS.find((b) => b.id === id) as HubBuildingDef;
    let near = force;
    if (!near) {
      if (id === 'blackmarket') {
        near =
          Math.hypot(this.playerX - NYX_NPC_POS.x, this.playerY - NYX_NPC_POS.y) < 34 ||
          (this.playerX >= 76 && this.playerX <= 184 && this.playerY >= 139 && this.playerY <= 156);
      } else if (id === 'techlab') {
        near =
          Math.hypot(this.playerX - TECHLAB_NPC_POS.x, this.playerY - TECHLAB_NPC_POS.y) < 34 ||
          (this.playerX >= 298 && this.playerX <= 400 && this.playerY >= 139 && this.playerY <= 156);
      }
    }
    if (!near) return false;
    const x = id === 'blackmarket' ? 152 : id === 'techlab' ? 332 : MARKET_TERRACE_POS.x;
    const y = id === 'terrace' ? MARKET_TERRACE_POS.y - 22 : 148;
    this.activePrompt = { label: `🔒 ${def.name} — ${def.lockedHint}`, x, y };
    if (input.interactPressed()) {
      sound.playUiClick();
      this.callbacks.onToast(`${def.name}: ${def.lockedHint}.`, 'info');
    }
    return true;
  }

  /** Baustellen-Patches der noch geschlossenen Gebäude (und das Ausblenden beim Öffnen). */
  private renderLockPatches(ctx: CanvasRenderingContext2D): void {
    const art = getHDArt();
    // Läden sehen je Upgrade-Stufe anders aus (Tech-Labor nur, wenn schon geöffnet)
    const tiers = this.state.getHubTiers();
    for (const def of HUB_TIER_PATCHES) {
      const lvl = tiers[def.id];
      if (lvl <= 0) continue;
      if (def.id === 'tech' && !this.state.isHubBuildingOpen('techlab')) continue;
      const patch = def.patches[lvl - 1];
      const spr = patch ? art.hubTiers[patch.sprite] : null;
      if (spr) ctx.drawImage(spr, patch.rect.x / 2, patch.rect.y / 2, patch.rect.w / 2, patch.rect.h / 2);
    }
    const sprites: Record<HubBuildingId, HTMLCanvasElement | null> = {
      techlab: art.hubLockTech,
      blackmarket: art.hubLockBlack,
      terrace: art.hubLockTerr,
    };
    for (const def of HUB_BUILDINGS) {
      const spr = sprites[def.id];
      if (!spr) continue;
      const reveal = this.reveals.find((r) => r.id === def.id);
      let alpha = 0;
      if (reveal) alpha = 1 - Math.min(1, reveal.t / 1.4);
      else if (!this.state.isHubBuildingOpen(def.id)) alpha = 1;
      if (alpha <= 0.01) continue;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.drawImage(spr, def.rect.x / 2, def.rect.y / 2, def.rect.w / 2, def.rect.h / 2);
      ctx.restore();
    }
  }

  private renderStoryMarkers(ctx: CanvasRenderingContext2D): void {
    const spots: Array<{ npc: StoryNpcId; x: number; y: number }> = [
      { npc: 'kael', x: FORGE_POS.x, y: FORGE_POS.y - 31 },
      { npc: 'lyra', x: MEDBAY_POS.x, y: MEDBAY_POS.y - 30 },
    ];
    if (this.state.isHubBuildingOpen('blackmarket')) spots.push({ npc: 'nyx', x: NYX_NPC_POS.x, y: NYX_NPC_POS.y - 26 });
    if (this.state.isHubBuildingOpen('techlab')) spots.push({ npc: 'vex', x: TECHLAB_NPC_POS.x, y: TECHLAB_NPC_POS.y - 26 });
    for (const sp of spots) {
      const scene = this.state.getPendingScene(sp.npc);
      if (!scene) continue;
      ctx.save();
      ctx.textAlign = 'center';
      if (this.state.isSceneSkipped(scene.id)) {
        const a = 0.55 + 0.2 * Math.sin(this.time * 2);
        drawGlow(ctx, sp.x, sp.y, 7, '#fde047', 0.16);
        ctx.globalAlpha = a;
        ctx.fillStyle = '#fde047';
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, 2.1, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const hop = Math.sin(this.time * 5 + sp.x) * 1.6;
        drawGlow(ctx, sp.x, sp.y + hop, 10, '#fde047', 0.22);
        ctx.fillStyle = 'rgba(28, 20, 6, 0.94)';
        ctx.fillRect(sp.x - 5, sp.y - 6 + hop, 10, 11);
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 0.8;
        ctx.strokeRect(sp.x - 5, sp.y - 6 + hop, 10, 11);
        ctx.fillStyle = '#fde047';
        ctx.font = 'bold 8px Silkscreen, monospace';
        ctx.fillText('!', sp.x, sp.y + 3 + hop);
      }
      ctx.restore();
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
    this.renderLockPatches(ctx);

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

    // M10-A: Feuerwerk des Omega-Fests am Himmel über dem Aussichtsfenster
    this.evo.renderSkyLayer(ctx, this.lastDt);

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

    // M10-A: Stations-Entwicklung (Lichterketten, Wimpel, Esse-Glow) hinter den Schildern
    this.evo.renderBackLayer(ctx, this.time, isNight);

    // Subtle crisp building signage pills
    this.renderSignPills(ctx);

    // Depth-sorted entities: Guild Board Terminal, Kael, Dr. Lyra, Nyx, Vex, Strollers, Player
    type Drawable = { y: number; draw: () => void };
    const drawables: Drawable[] = [];

    // Integrated Galactic Guild Scoreboard Holo-Terminal on the scenic nebula overlook!
    drawables.push({
      y: GUILD_BOARD_POS.y + 8,
      draw: () => {
        if (art.propScoreboard) {
          drawContactShadow(ctx, art.propScoreboard, GUILD_BOARD_POS.x - 22, GUILD_BOARD_POS.y - 31, 44, 44, 0.6);
          ctx.drawImage(art.propScoreboard, GUILD_BOARD_POS.x - 22, GUILD_BOARD_POS.y - 31, 44, 44);
        } else {
          drawPixelShadow(ctx, GUILD_BOARD_POS.x, GUILD_BOARD_POS.y + 11, 20, 5.5, 0.54);
        }
      },
    });

    if (!this.hideActorsForCutscene) {
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

      // Kaels Schmiede-Gehilfin Mina an der zweiten Werkbank (dauerhaft nach Sektor 1 + Kael-Kapitel-1-Gespräch)
      if (this.state.isMinaPresent()) {
        const minaX = FORGE_POS.x + 22;
        const minaY = FORGE_POS.y + 4;
        drawables.push({
          y: minaY,
          draw: () => {
            // Warmes Glühen der zweiten Werkbank
            drawGlow(ctx, minaX, minaY - 6, 12, '#fb923c', 0.14 + Math.sin(this.time * 5.4) * 0.04);
            drawMinaSprite(ctx, minaX, minaY, this.time, true);
          },
        });
      }

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
      if (this.state.isHubBuildingOpen('blackmarket'))
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
      if (this.state.isHubBuildingOpen('techlab'))
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
    }

    // Strolling station residents
    // M10-A: y-sortierte Stations-Objekte (Laternen, Obelisk, Denkmal, Schilder, Leuchtfeuer …)
    for (const d of this.evo.getDrawables(ctx, this.time)) drawables.push(d);

    for (const s of this.strollers) {
      drawables.push({
        y: s.y,
        draw: () => {
          const walking = s.walkAnim > 0;
          const bob = walking ? Math.abs(Math.sin(s.walkAnim)) * 2 : 0;
          const spr = this.getStrollerSprite(s);
          drawPixelShadow(ctx, s.x, s.y + 11, 8, 3, 0.44);
          if (spr) {
            ctx.drawImage(spr, s.x - 12, s.y - 16 - bob, 24, 28);
          }
        },
      });
    }

    // Player
    if (!this.hideActorsForCutscene) {
      drawables.push({
        y: this.playerY,
        draw: () => this.renderPlayer(ctx),
      });
    }

    drawables.sort((a, b) => a.y - b.y);
    for (const d of drawables) d.draw();

    // Particles
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    if (!this.hideActorsForCutscene) {
      this.renderStoryMarkers(ctx);
      this.renderChatter(ctx);

      if (this.activePrompt) {
        this.renderPrompt(ctx, this.activePrompt.label, this.activePrompt.x, this.activePrompt.y);
      }
    }
  }

  private renderSignPills(ctx: CanvasRenderingContext2D): void {
    ctx.font = 'bold 5px Silkscreen, monospace';
    ctx.textAlign = 'center';
    const pills = [
      { text: 'SCHMIEDE', x: 144, y: 40, color: '#fb923c' },
      { text: '★ KAPITÄNS-TAFEL', x: GUILD_BOARD_POS.x, y: 48, color: '#fde047' },
      { text: 'MED-BAY', x: 356, y: 24, color: '#34d399' },
      { text: this.state.isHubBuildingOpen('blackmarket') ? 'SCHWARZMARKT' : '🔒 GESCHLOSSEN', x: 120, y: 148, color: this.state.isHubBuildingOpen('blackmarket') ? '#c084fc' : '#94a3b8' },
      { text: this.state.isHubBuildingOpen('techlab') ? 'TECH-LABOR' : '🔒 IM AUFBAU', x: 358, y: 148, color: this.state.isHubBuildingOpen('techlab') ? '#38e8d4' : '#94a3b8' },
      { text: 'RAUMHAFEN →', x: 416, y: 90, color: '#38e8d4' },
      {
        text:
          this.state.hasReadyBankPayout() || this.state.hasReadyBigOrder()
            ? '↓ TERRASSE · ★ BEREIT!'
            : this.state.isHubBuildingOpen('terrace')
              ? '↓ MARKTPLATZ-TERRASSE'
              : '🔒 TERRASSE GESPERRT',
        x: 240,
        y: 222,
        color: this.state.hasReadyBankPayout() ? '#4ade80' : '#fbbf24',
      },
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
