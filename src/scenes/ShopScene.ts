import { getHDArt } from '../assets/artLoader';
import { drawGlow, drawPixelShadow } from '../assets/pixelArt';
import { getAtlas } from '../assets/sprites';
import { getItemDef } from '../data/items';
import { sound } from '../engine/audio';
import { VIRTUAL_HEIGHT, VIRTUAL_WIDTH, type InputManager } from '../engine/input';
import { evaluatePrice, recordPriceReaction } from '../systems/economy';
import type { GameState } from '../systems/gameState';
import { addItemToChest } from '../systems/inventory';
import type { Direction, PedestalSlot, PriceReaction } from '../types';

interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
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

type CustomerState =
  | 'entering'
  | 'browsing'
  | 'thinking'
  | 'to_checkout'
  | 'waiting_checkout'
  | 'leaving';

interface Customer {
  id: number;
  speciesIndex: number;
  x: number;
  y: number;
  waypoints: Array<{ x: number; y: number }>;
  state: CustomerState;
  stateTimer: number;
  walkAnim: number;
  targetPedestalId: number | null;
  visitedPedestals: Set<number>;
  carriedItemId: string | null;
  carriedPrice: number;
  emote: PriceReaction | 'coin' | null;
  emoteTimer: number;
  patience: number;
  maxPatience: number;
}

export interface ShopCallbacks {
  onOpenPedestal: (pedestal: PedestalSlot) => void;
  onOpenWorkbench: () => void;
  onOpenChest: () => void;
  onEnterDungeon: () => void;
  onToast: (msg: string, tone?: 'info' | 'good' | 'warn') => void;
  onHudDirty: () => void;
}

// Walkable floor & architectural collision bounds aligned pixel-for-pixel to public/art/shop_bg.png
const FLOOR_LEFT = 54;
const FLOOR_RIGHT = 432;
const FLOOR_TOP = 114;
const FLOOR_BOTTOM = 228;

const SOLID_RECTS = [
  { x: 174, y: 106, w: 134, h: 72 }, // Grand U-shaped Checkout Counter
  { x: 24, y: 112, w: 70, h: 72 }, // Left Exo-Werkbank station
  { x: 26, y: 196, w: 62, h: 42 }, // Bottom-left stacked crates
  { x: 388, y: 206, w: 42, h: 32 }, // Bottom-right crate & potted plants
];

// Interactive station hotspots matching public/art/shop_bg.png
const WORKBENCH_POS = { x: 96, y: 150 };
const CHEST_POS = { x: 336, y: 118 };
const WARP_GATE_POS = { x: 426, y: 152 };
const SHOP_DOOR_POS = { x: 240, y: 218 };
const CHECKOUT_SPOT = { x: 240, y: 192 };

export class ShopScene {
  private state: GameState;
  private callbacks: ShopCallbacks;

  public playerX = 240;
  public playerY = 194;
  private facing: Direction = 'down';
  private walkAnim = 0;
  private dashTimer = 0;
  private dashCooldown = 0;
  private dashVx = 0;
  private dashVy = 0;

  public shopOpen = false;
  public shopTimer = 0;
  public readonly shopDuration = 95;
  public daySalesCount = 0;
  public daySalesCredits = 0;

  private customers: Customer[] = [];
  private nextCustomerId = 1;
  private spawnTimer = 1.4;

  private particles: Particle[] = [];
  private floats: FloatingText[] = [];
  private time = 0;

  private windowStars: Array<{ x: number; y: number; phase: number }> = [];
  private dustMotes: Array<{ x: number; y: number; phase: number; speed: number }> = [];

  public activePrompt: { label: string; x: number; y: number } | null = null;

  constructor(state: GameState, callbacks: ShopCallbacks) {
    this.state = state;
    this.callbacks = callbacks;

    for (let i = 0; i < 24; i++) {
      this.windowStars.push({
        x: 146 + Math.random() * 190,
        y: 26 + Math.random() * 52,
        phase: Math.random() * Math.PI * 2,
      });
    }
    for (let i = 0; i < 16; i++) {
      this.dustMotes.push({
        x: 70 + Math.random() * 340,
        y: 110 + Math.random() * 110,
        phase: Math.random() * Math.PI * 2,
        speed: 4 + Math.random() * 5,
      });
    }
  }

  public onEnter(fromDungeon = false): void {
    this.state.restoreFullVitals();
    this.shopOpen = false;
    this.customers = [];
    this.particles = [];
    this.floats = [];
    this.dashTimer = 0;
    this.dashCooldown = 0;
    if (fromDungeon) {
      this.playerX = 408;
      this.playerY = 152;
      this.facing = 'left';
      this.spawnBurst(426, 152, '#38e8d4', 20);
    } else {
      this.playerX = 240;
      this.playerY = 185;
      this.facing = 'down';
    }
    this.callbacks.onHudDirty();
  }

  public toggleShopOpen(): void {
    if (!this.shopOpen) {
      const hasStock = this.state.pedestals.some((p) => p.itemId !== null && p.qty > 0);
      if (!hasStock) {
        this.callbacks.onToast(
          'Bestücke zuerst mindestens ein Holo-Podest mit [E], bevor du öffnest!',
          'warn',
        );
        sound.playReaction('expensive');
        return;
      }
      this.shopOpen = true;
      this.shopTimer = this.shopDuration;
      this.daySalesCount = 0;
      this.daySalesCredits = 0;
      this.spawnTimer = 1.0;
      sound.playShopBell();
      this.callbacks.onToast('Astro-Barter ist GEÖFFNET! Bediene Kunden an der Kasse mit [E].', 'good');
      this.spawnBurst(SHOP_DOOR_POS.x, SHOP_DOOR_POS.y, '#4ade80', 14);
      this.callbacks.onHudDirty();
    } else {
      this.closeShop(true);
    }
  }

  private closeShop(manual: boolean): void {
    if (!this.shopOpen) return;
    this.shopOpen = false;

    for (const c of this.customers) {
      if (c.carriedItemId) {
        addItemToChest(this.state.inventory, c.carriedItemId, 1);
        c.carriedItemId = null;
      }
      c.state = 'leaving';
      c.waypoints = this.planPath(c.x, c.y, SHOP_DOOR_POS.x, SHOP_DOOR_POS.y + 10);
    }

    sound.playShopBell();
    if (this.daySalesCount > 0) {
      this.callbacks.onToast(
        `Tag ${this.state.day} beendet: ${this.daySalesCount} Relikte für ${this.daySalesCredits} Cr verkauft!`,
        'good',
      );
      this.state.advanceDay();
    } else if (!manual) {
      this.callbacks.onToast('Ladenschluss! Probiere neue Preise oder hol frischen Loot im Sektor.', 'info');
      this.state.advanceDay();
    } else {
      this.callbacks.onToast('Laden geschlossen.', 'info');
    }
    this.state.save();
    this.callbacks.onHudDirty();
  }

  /** Clean 1-waypoint router so customers gracefully walk around the U-shaped counter! */
  private planPath(fromX: number, fromY: number, toX: number, toY: number): Array<{ x: number; y: number }> {
    const crossesCounter =
      (fromX < 174 && toX > 308) ||
      (fromX > 308 && toX < 174) ||
      (fromY < 182 && toY > 186 && Math.abs(fromX - 240) < 75);
    if (crossesCounter) {
      return [
        { x: fromX < 240 ? 156 : 326, y: 204 },
        { x: 240, y: 204 },
        { x: toX, y: toY },
      ];
    }
    return [{ x: toX, y: toY }];
  }

  public update(dt: number, input: InputManager): void {
    this.time += dt;

    // Ambient sparks at left Exo-Werkbank
    if (Math.random() < dt * 4.5) {
      this.particles.push({
        x: 56 + (Math.random() - 0.5) * 26,
        y: 136 + (Math.random() - 0.5) * 14,
        vx: (Math.random() - 0.5) * 10,
        vy: -12 - Math.random() * 12,
        color: Math.random() > 0.45 ? '#38e8d4' : '#fbbf24',
        size: 1.5,
        life: 0.45 + Math.random() * 0.35,
        maxLife: 0.8,
      });
    }

    // Swirling energy motes pouring gently from the right Warp-Gate
    if (Math.random() < dt * 8) {
      this.particles.push({
        x: 438 + (Math.random() - 0.5) * 8,
        y: 152 + (Math.random() - 0.5) * 32,
        vx: -14 - Math.random() * 14,
        vy: (Math.random() - 0.5) * 8,
        color: Math.random() > 0.3 ? '#38e8d4' : '#a5f3fc',
        size: 1.5,
        life: 0.5 + Math.random() * 0.4,
        maxLife: 0.9,
      });
    }

    // Player movement & cozy dash
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    const move = input.getMoveVector();

    if (input.dashPressed() && this.dashCooldown <= 0 && (move.x !== 0 || move.y !== 0)) {
      this.dashTimer = 0.16;
      this.dashCooldown = 0.48;
      this.dashVx = move.x * 230;
      this.dashVy = move.y * 230;
      sound.playDash();
      this.spawnBurst(this.playerX, this.playerY + 4, '#fb923c', 6);
    }

    let vx = move.x * 104;
    let vy = move.y * 104;
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

    if (input.wasPressed('KeyO')) {
      this.toggleShopOpen();
    }

    if (this.shopOpen) {
      this.shopTimer -= dt;
      if (this.shopTimer <= 0) {
        this.closeShop(false);
      } else {
        this.spawnTimer -= dt;
        const maxCustomers = 3 + this.state.upgrades.shopAura;
        if (this.spawnTimer <= 0 && this.customers.length < maxCustomers) {
          this.spawnCustomer();
          this.spawnTimer = 4.0 + Math.random() * 2.5;
        }
      }
    }

    this.updateCustomers(dt);
    this.updateInteraction(input);
    this.updateEffects(dt);
  }

  private movePlayer(dx: number, dy: number): void {
    const nx = Math.max(FLOOR_LEFT + 8, Math.min(FLOOR_RIGHT - 8, this.playerX + dx));
    if (!this.collidesStatic(nx, this.playerY)) {
      this.playerX = nx;
    }
    const ny = Math.max(FLOOR_TOP + 6, Math.min(FLOOR_BOTTOM - 6, this.playerY + dy));
    if (!this.collidesStatic(this.playerX, ny)) {
      this.playerY = ny;
    }
  }

  private collidesStatic(x: number, y: number): boolean {
    const r = 6;
    for (const rect of SOLID_RECTS) {
      if (
        x + r > rect.x &&
        x - r < rect.x + rect.w &&
        y + r > rect.y &&
        y - r < rect.y + rect.h
      ) {
        return true;
      }
    }
    for (const p of this.state.pedestals) {
      if (Math.abs(x - p.x) < 15 && Math.abs(y - p.y) < 12) return true;
    }
    return false;
  }

  private spawnCustomer(): void {
    const c: Customer = {
      id: this.nextCustomerId++,
      speciesIndex: Math.floor(Math.random() * 3),
      x: SHOP_DOOR_POS.x + (Math.random() - 0.5) * 10,
      y: SHOP_DOOR_POS.y + 8,
      waypoints: [{ x: SHOP_DOOR_POS.x, y: 204 }],
      state: 'entering',
      stateTimer: 0.35,
      walkAnim: 0,
      targetPedestalId: null,
      visitedPedestals: new Set<number>(),
      carriedItemId: null,
      carriedPrice: 0,
      emote: null,
      emoteTimer: 0,
      patience: 26 * this.state.getStats().customerPatienceBonus,
      maxPatience: 26 * this.state.getStats().customerPatienceBonus,
    };
    this.customers.push(c);
  }

  private pickNextPedestal(c: Customer): PedestalSlot | null {
    const occupied = this.state.pedestals.filter(
      (p) => p.itemId !== null && p.qty > 0 && !c.visitedPedestals.has(p.id),
    );
    if (occupied.length === 0) return null;
    return occupied[Math.floor(Math.random() * occupied.length)];
  }

  private getBrowseSpot(ped: PedestalSlot): { x: number; y: number } {
    // Stand neatly beside the pedestal toward the central walkway so price tag stays 100% readable!
    return {
      x: ped.x < 240 ? ped.x + 22 : ped.x - 22,
      y: ped.y + 4,
    };
  }

  private updateCustomers(dt: number): void {
    const speed = 54;

    for (let i = this.customers.length - 1; i >= 0; i--) {
      const c = this.customers[i];
      if (c.emoteTimer > 0) {
        c.emoteTimer -= dt;
        if (c.emoteTimer <= 0 && c.state !== 'waiting_checkout') {
          c.emote = null;
        }
      }

      const nextWp = c.waypoints[0];
      if (nextWp) {
        const dx = nextWp.x - c.x;
        const dy = nextWp.y - c.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 3) {
          c.x += (dx / dist) * speed * dt;
          c.y += (dy / dist) * speed * dt;
          c.walkAnim += dt * 9;
          continue;
        }
        c.waypoints.shift();
        if (c.waypoints.length > 0) continue;
      }

      c.walkAnim = 0;

      if (c.state === 'entering') {
        const ped = this.pickNextPedestal(c);
        if (ped) {
          c.state = 'browsing';
          c.targetPedestalId = ped.id;
          const spot = this.getBrowseSpot(ped);
          c.waypoints = this.planPath(c.x, c.y, spot.x, spot.y);
        } else {
          c.state = 'leaving';
          c.waypoints = this.planPath(c.x, c.y, SHOP_DOOR_POS.x, SHOP_DOOR_POS.y + 10);
        }
      } else if (c.state === 'browsing') {
        c.state = 'thinking';
        c.stateTimer = 1.0 + Math.random() * 0.7;
      } else if (c.state === 'thinking') {
        c.stateTimer -= dt;
        if (c.stateTimer <= 0) {
          const ped = this.state.pedestals.find((p) => p.id === c.targetPedestalId);
          if (!ped || !ped.itemId || ped.qty <= 0) {
            if (c.targetPedestalId !== null) c.visitedPedestals.add(c.targetPedestalId);
            const nextPed = this.pickNextPedestal(c);
            if (nextPed && c.visitedPedestals.size < 2) {
              c.state = 'browsing';
              c.targetPedestalId = nextPed.id;
              const spot = this.getBrowseSpot(nextPed);
              c.waypoints = this.planPath(c.x, c.y, spot.x, spot.y);
            } else {
              c.state = 'leaving';
              c.waypoints = this.planPath(c.x, c.y, SHOP_DOOR_POS.x, SHOP_DOOR_POS.y + 10);
            }
            continue;
          }

          c.visitedPedestals.add(ped.id);
          const entry = this.state.codex[ped.itemId];
          const evalRes = evaluatePrice(ped.itemId, ped.price, entry);
          c.emote = evalRes.reaction;
          c.emoteTimer = 2.0;
          sound.playReaction(evalRes.reaction);

          if (evalRes.willBuy) {
            const boughtId = ped.itemId;
            const boughtPrice = ped.price;
            ped.qty -= 1;
            if (ped.qty <= 0) {
              ped.itemId = null;
              ped.qty = 0;
            }
            recordPriceReaction(entry, boughtPrice, evalRes.reaction, true);
            c.carriedItemId = boughtId;
            c.carriedPrice = boughtPrice;
            c.state = 'to_checkout';
            const queueIdx = this.customers.filter(
              (other) => other.state === 'waiting_checkout' || other.state === 'to_checkout',
            ).length;
            const qx = CHECKOUT_SPOT.x + (queueIdx === 0 ? 0 : queueIdx % 2 === 1 ? -18 : 18);
            const qy = CHECKOUT_SPOT.y + Math.floor(queueIdx / 3) * 12;
            c.waypoints = this.planPath(c.x, c.y, qx, qy);
            this.state.save();
          } else {
            recordPriceReaction(entry, ped.price, evalRes.reaction, false);
            this.state.save();
            const nextPed =
              evalRes.reaction === 'expensive' && c.visitedPedestals.size < 2
                ? this.pickNextPedestal(c)
                : null;
            if (nextPed) {
              c.state = 'browsing';
              c.targetPedestalId = nextPed.id;
              const spot = this.getBrowseSpot(nextPed);
              c.waypoints = this.planPath(c.x, c.y, spot.x, spot.y);
            } else {
              c.state = 'leaving';
              c.waypoints = this.planPath(c.x, c.y, SHOP_DOOR_POS.x, SHOP_DOOR_POS.y + 10);
            }
          }
        }
      } else if (c.state === 'to_checkout') {
        c.state = 'waiting_checkout';
        c.emote = 'coin';
        c.emoteTimer = 99;
      } else if (c.state === 'waiting_checkout') {
        c.patience -= dt;
        if (c.patience <= 0) {
          if (c.carriedItemId) {
            addItemToChest(this.state.inventory, c.carriedItemId, 1);
            c.carriedItemId = null;
          }
          c.emote = 'expensive';
          c.emoteTimer = 1.6;
          sound.playReaction('expensive');
          this.callbacks.onToast('Ein Kunde hat zu lange an der Kasse gewartet (Item zurück in Truhe).', 'warn');
          c.state = 'leaving';
          c.waypoints = this.planPath(c.x, c.y, SHOP_DOOR_POS.x, SHOP_DOOR_POS.y + 10);
        }
      } else if (c.state === 'leaving') {
        this.customers.splice(i, 1);
      }
    }
  }

  private checkoutNextCustomer(): boolean {
    const waiter = this.customers.find((c) => c.state === 'waiting_checkout');
    if (!waiter || !waiter.carriedItemId) return false;

    const tipBonus = Math.round(waiter.carriedPrice * this.state.getStats().shopTipBonus);
    const total = waiter.carriedPrice + tipBonus;
    const itemName = getItemDef(waiter.carriedItemId).name;

    this.state.credits += total;
    this.state.totalEarned += total;
    this.state.totalSold += 1;
    this.daySalesCount += 1;
    this.daySalesCredits += total;

    waiter.carriedItemId = null;
    waiter.emote = 'fair';
    waiter.emoteTimer = 1.5;
    waiter.state = 'leaving';
    waiter.waypoints = this.planPath(waiter.x, waiter.y, SHOP_DOOR_POS.x, SHOP_DOOR_POS.y + 10);

    sound.playRegister();
    this.spawnBurst(CHECKOUT_SPOT.x, CHECKOUT_SPOT.y - 16, '#fbbf24', 16);
    this.floats.push({
      x: CHECKOUT_SPOT.x,
      y: CHECKOUT_SPOT.y - 26,
      text: tipBonus > 0 ? `+${total} Cr (+${tipBonus} Tipp)` : `+${total} Cr`,
      color: '#fde047',
      life: 1.4,
      maxLife: 1.4,
    });
    this.callbacks.onToast(`${itemName} verkauft für ${total} Cr!`, 'good');
    this.state.save();
    this.callbacks.onHudDirty();
    return true;
  }

  private updateInteraction(input: InputManager): void {
    this.activePrompt = null;

    const waitingCustomer = this.customers.find((c) => c.state === 'waiting_checkout');

    // 1. Checkout Counter (priority when customer is waiting!)
    const distCounter = Math.hypot(this.playerX - 240, this.playerY - 186);
    if (waitingCustomer && distCounter < 58) {
      this.activePrompt = {
        label: '[E] Kassieren!',
        x: 240,
        y: 164,
      };
      if (input.interactPressed()) {
        this.checkoutNextCustomer();
      }
      return;
    }

    // 2. Holo-Pedestals
    let nearestPed: PedestalSlot | null = null;
    let bestPedDist = 30;
    for (const p of this.state.pedestals) {
      const d = Math.hypot(this.playerX - p.x, this.playerY - p.y);
      if (d < bestPedDist) {
        bestPedDist = d;
        nearestPed = p;
      }
    }
    if (nearestPed) {
      const label = nearestPed.itemId
        ? `[E] ${getItemDef(nearestPed.itemId).name} (${nearestPed.price} Cr)`
        : '[E] Holo-Podest bestücken';
      this.activePrompt = { label, x: nearestPed.x, y: nearestPed.y - 24 };
      if (input.interactPressed()) {
        sound.playUiClick();
        this.callbacks.onOpenPedestal(nearestPed);
      }
      return;
    }

    // 3. Scan-Codex & Markt-Terminal (left holographic station inside shop)
    if (Math.hypot(this.playerX - WORKBENCH_POS.x, this.playerY - WORKBENCH_POS.y) < 34) {
      this.activePrompt = {
        label: '[E] Scan-Codex & Preise',
        x: WORKBENCH_POS.x + 10,
        y: WORKBENCH_POS.y - 26,
      };
      if (input.interactPressed()) {
        sound.playUiClick();
        this.callbacks.onOpenWorkbench();
      }
      return;
    }

    // 4. Lagertruhe (blue steel chest upper-right)
    if (Math.hypot(this.playerX - CHEST_POS.x, this.playerY - CHEST_POS.y) < 32) {
      this.activePrompt = {
        label: '[E] Lagertruhe & Fracht',
        x: CHEST_POS.x,
        y: CHEST_POS.y - 18,
      };
      if (input.interactPressed()) {
        sound.playUiClick();
        this.callbacks.onOpenChest();
      }
      return;
    }

    // 5. Exit Airlock to Port Solaris Promenade (Schmiede, Med-Bay & Warp-Gate!)
    if (Math.hypot(this.playerX - WARP_GATE_POS.x, this.playerY - WARP_GATE_POS.y) < 36) {
      this.activePrompt = {
        label: '[E] Port Solaris (Shops & Sektor)',
        x: WARP_GATE_POS.x - 46,
        y: WARP_GATE_POS.y - 28,
      };
      if (input.interactPressed()) {
        if (this.shopOpen) {
          this.closeShop(true);
        }
        sound.playUiClick();
        this.callbacks.onEnterDungeon();
      }
      return;
    }

    // 6. Shop Open/Close Door (bottom airlock hatch)
    if (Math.hypot(this.playerX - SHOP_DOOR_POS.x, this.playerY - SHOP_DOOR_POS.y) < 30) {
      this.activePrompt = {
        label: this.shopOpen ? '[E] Laden schließen' : '[E] Laden öffnen',
        x: SHOP_DOOR_POS.x,
        y: SHOP_DOOR_POS.y - 18,
      };
      if (input.interactPressed()) {
        this.toggleShopOpen();
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

  private updateEffects(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i];
      f.y -= 18 * dt;
      f.life -= dt;
      if (f.life <= 0) this.floats.splice(i, 1);
    }
  }

  public render(ctx: CanvasRenderingContext2D): void {
    const art = getHDArt();

    // 1. High-craft Moonlighter Space-Shop Room Backdrop (960x540 rendered 1:1!)
    if (art.shopBg) {
      ctx.drawImage(art.shopBg, 0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    } else {
      ctx.fillStyle = '#1b1d2b';
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    }

    // 2. Living Atmospheric Overlays on Top of Room Art
    // Subtle twinkling star glints inside the panoramic nebula window
    for (const s of this.windowStars) {
      const a = 0.25 + 0.75 * Math.max(0, Math.sin(this.time * 2.8 + s.phase));
      ctx.fillStyle = `rgba(255, 252, 224, ${a * 0.85})`;
      ctx.fillRect(s.x, s.y, 1.5, 1.5);
    }

    // Pulsing cyan holographic glows on Counter, Exo-Werkbank, and Warp-Gate
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 4.2);
    drawGlow(ctx, 206, 146, 22, '#38e8d4', 0.14 + pulse * 0.08);
    drawGlow(ctx, 240, 156, 24, '#38e8d4', 0.12 + pulse * 0.06);
    drawGlow(ctx, 64, 132, 32, '#38e8d4', 0.16 + pulse * 0.08);
    drawGlow(ctx, 444, 152, 42 + pulse * 6, '#38e8d4', 0.28 + pulse * 0.14);

    // Subtle crisp status pill on bottom airlock door & SEKTOR 1 badge by Warp-Gate
    this.renderStationBadges(ctx);

    // 3. Depth-Sorted Dynamic Entities (Pedestals, Customers, Player)
    type Drawable = { y: number; draw: () => void };
    const drawables: Drawable[] = [];

    for (const p of this.state.pedestals) {
      drawables.push({
        y: p.y,
        draw: () => this.renderPedestal(ctx, p),
      });
    }

    for (const c of this.customers) {
      drawables.push({
        y: c.y,
        draw: () => this.renderCustomer(ctx, c),
      });
    }

    drawables.push({
      y: this.playerY,
      draw: () => this.renderPlayer(ctx),
    });

    drawables.sort((a, b) => a.y - b.y);
    for (const d of drawables) d.draw();

    // 4. Warm Cozy Lighting Aura & Floating Dust Motes (enhanced by Shop-Atmosphäre upgrade!)
    const auraLevel = this.state.upgrades.shopAura;
    drawGlow(ctx, 118, 92, 54, '#fbbf24', 0.11 + auraLevel * 0.06);
    drawGlow(ctx, 368, 92, 54, '#fbbf24', 0.11 + auraLevel * 0.06);

    for (const m of this.dustMotes) {
      const mx = m.x + Math.sin(this.time * 0.7 + m.phase) * 8;
      const my = m.y - ((this.time * m.speed + m.phase * 15) % 85) + 40;
      const alpha = 0.2 + 0.35 * Math.sin(this.time * 2 + m.phase);
      ctx.fillStyle = `rgba(255, 240, 195, ${Math.max(0, alpha)})`;
      ctx.fillRect(mx, my, 1, 1);
    }

    // 5. Particles
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    // 6. Floating Credit Popups
    ctx.font = 'bold 7px Silkscreen, monospace';
    ctx.textAlign = 'center';
    for (const f of this.floats) {
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life / 0.5));
      ctx.fillStyle = '#121521';
      ctx.fillText(f.text, f.x + 0.8, f.y + 0.8);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;

    // 7. Shop Open Day Timer Bar (neatly tucked right beneath Astro-Barter sign!)
    if (this.shopOpen) {
      const pct = Math.max(0, this.shopTimer / this.shopDuration);
      ctx.fillStyle = 'rgba(14, 18, 30, 0.9)';
      ctx.fillRect(194, 34, 92, 7);
      ctx.fillStyle = '#263042';
      ctx.fillRect(196, 35.5, 88, 4);
      ctx.fillStyle = pct > 0.25 ? '#4ade80' : '#fb923c';
      ctx.fillRect(196, 35.5, 88 * pct, 4);
    }

    // 8. Active Context Interaction Prompt
    if (this.activePrompt) {
      this.renderPrompt(ctx, this.activePrompt.label, this.activePrompt.x, this.activePrompt.y);
    }
  }

  private renderStationBadges(ctx: CanvasRenderingContext2D): void {
    // Bottom door OPEN/CLOSED status pill
    const dx = SHOP_DOOR_POS.x;
    const dy = 216;
    ctx.fillStyle = this.shopOpen ? 'rgba(6, 78, 59, 0.92)' : 'rgba(69, 26, 3, 0.92)';
    ctx.fillRect(dx - 20, dy - 5, 40, 10);
    ctx.strokeStyle = this.shopOpen ? '#4ade80' : '#fbbf24';
    ctx.lineWidth = 0.8;
    ctx.strokeRect(dx - 20, dy - 5, 40, 10);
    ctx.fillStyle = this.shopOpen ? '#4ade80' : '#fde047';
    ctx.font = 'bold 5.5px Silkscreen, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(this.shopOpen ? 'OFFEN' : 'ZU [E]', dx, dy + 2);

    // Subtle Port Solaris Promenade exit badge
    const gx = 412;
    const gy = 114;
    ctx.fillStyle = 'rgba(12, 18, 32, 0.88)';
    ctx.fillRect(gx - 28, gy - 5, 56, 10);
    ctx.strokeStyle = '#38e8d4';
    ctx.lineWidth = 0.8;
    ctx.strokeRect(gx - 28, gy - 5, 56, 10);
    ctx.fillStyle = '#38e8d4';
    ctx.fillText('PROMENADE', gx, gy + 2);
  }

  private renderPedestal(ctx: CanvasRenderingContext2D, p: PedestalSlot): void {
    const art = getHDArt();
    const atlas = getAtlas();
    const active = p.itemId !== null && p.qty > 0;

    drawPixelShadow(ctx, p.x, p.y + 11, 14, 4.5, 0.45);
    if (art.pedestal) {
      ctx.drawImage(art.pedestal, p.x - 14, p.y - 14, 28, 28);
    } else {
      ctx.drawImage(
        active ? atlas.props.pedestalActive : atlas.props.pedestalEmpty,
        Math.round(p.x - 12),
        Math.round(p.y - 8),
      );
    }

    drawGlow(ctx, p.x, p.y - 4, 18, '#38e8d4', active ? 0.26 : 0.14);

    if (active && p.itemId) {
      const def = getItemDef(p.itemId);
      const bob = Math.sin(this.time * 3.4 + p.id) * 2.2;
      drawGlow(ctx, p.x, p.y - 14 + bob, 20, def.glowColor, 0.36);

      const hdSpr = art.items[p.itemId];
      if (hdSpr) {
        ctx.drawImage(hdSpr, p.x - 10, p.y - 25 + bob, 20, 20);
      } else if (atlas.items[p.itemId]) {
        ctx.drawImage(atlas.items[p.itemId], Math.round(p.x - 8), Math.round(p.y - 20 + bob));
      }

      // Crisp Golden Price Tag & Quantity Badge
      ctx.font = 'bold 5.5px Silkscreen, monospace';
      const tag = `${p.price}CR`;
      const tw = Math.max(28, Math.ceil(ctx.measureText(tag).width) + 8);
      ctx.fillStyle = 'rgba(13, 18, 30, 0.94)';
      ctx.fillRect(p.x - tw / 2, p.y + 11, tw, 9);
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 0.8;
      ctx.strokeRect(p.x - tw / 2, p.y + 11, tw, 9);
      ctx.fillStyle = '#fde047';
      ctx.textAlign = 'center';
      ctx.fillText(tag, p.x, p.y + 17.5);

      if (p.qty > 1) {
        ctx.fillStyle = '#0f766e';
        ctx.fillRect(p.x + 7, p.y - 26 + bob, 11, 8);
        ctx.strokeStyle = '#38e8d4';
        ctx.lineWidth = 0.6;
        ctx.strokeRect(p.x + 7, p.y - 26 + bob, 11, 8);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`x${p.qty}`, p.x + 12.5, p.y - 20 + bob);
      }
    }
  }

  private renderCustomer(ctx: CanvasRenderingContext2D, c: Customer): void {
    const art = getHDArt();
    const atlas = getAtlas();
    const walking = c.walkAnim > 0;
    const bob = walking ? Math.abs(Math.sin(c.walkAnim)) * 2.2 : Math.sin(this.time * 2.8 + c.id) * 0.5;
    const tilt = walking ? Math.sin(c.walkAnim) * 0.06 : 0;

    drawPixelShadow(ctx, c.x, c.y + 11, 8, 3.2, 0.48);

    if (art.customers.length > 0) {
      const spr = art.customers[c.speciesIndex % art.customers.length];
      ctx.save();
      ctx.translate(c.x, c.y + 10 - bob);
      ctx.rotate(tilt);
      ctx.drawImage(spr, -12, -26, 24, 28);
      ctx.restore();
    } else {
      const frames = atlas.customers[c.speciesIndex % atlas.customers.length];
      ctx.drawImage(frames[Math.floor(c.walkAnim) % 2], Math.round(c.x - 8), Math.round(c.y - 10));
    }

    // Carried item when walking to checkout
    if (c.carriedItemId) {
      const itemSpr = art.items[c.carriedItemId] ?? atlas.items[c.carriedItemId];
      if (itemSpr) {
        ctx.drawImage(itemSpr, c.x - 7, c.y - 24 - bob, 14, 14);
      }
    }

    // Thinking dots bubble
    if (c.state === 'thinking') {
      const dots = Math.floor(this.time * 4) % 4;
      ctx.fillStyle = 'rgba(15, 20, 32, 0.9)';
      ctx.fillRect(c.x - 9, c.y - 27, 18, 8);
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 0.6;
      ctx.strokeRect(c.x - 9, c.y - 27, 18, 8);
      ctx.fillStyle = '#f8fafc';
      for (let d = 0; d < dots; d++) {
        ctx.fillRect(c.x - 6 + d * 4.5, c.y - 24, 2, 2);
      }
    }

    // Reaction Emote Bubble
    if (c.emote) {
      const emSpr = atlas.emotes[c.emote];
      const ebob = Math.sin(this.time * 6) * 1.4;
      ctx.drawImage(emSpr, c.x - 7, c.y - 31 + ebob, 14, 11);
    }

    // Checkout Patience Bar
    if (c.state === 'waiting_checkout') {
      const pct = Math.max(0, c.patience / c.maxPatience);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(c.x - 11, c.y - 35, 22, 3.5);
      ctx.fillStyle = pct > 0.35 ? '#4ade80' : '#f87171';
      ctx.fillRect(c.x - 10, c.y - 34, 20 * pct, 1.5);
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
      let spr = atlas.heroDown[frame];
      if (this.facing === 'up') spr = atlas.heroUp[frame];
      else if (this.facing === 'right') spr = atlas.heroRight[frame];
      else if (this.facing === 'left') spr = atlas.heroLeft[frame];
      ctx.drawImage(spr, Math.round(this.playerX - 8), Math.round(this.playerY - 10));
    }
  }

  private renderPrompt(ctx: CanvasRenderingContext2D, text: string, x: number, y: number): void {
    ctx.font = 'bold 5.5px Silkscreen, monospace';
    const w = Math.max(52, Math.ceil(ctx.measureText(text).width) + 14);
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
