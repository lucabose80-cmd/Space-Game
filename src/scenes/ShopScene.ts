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
  targetX: number;
  targetY: number;
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

interface BgShuttle {
  x: number;
  y: number;
  speed: number;
  small: boolean;
}

export interface ShopCallbacks {
  onOpenPedestal: (pedestal: PedestalSlot) => void;
  onOpenWorkbench: () => void;
  onOpenChest: () => void;
  onEnterDungeon: () => void;
  onToast: (msg: string, tone?: 'info' | 'good' | 'warn') => void;
  onHudDirty: () => void;
}

// Shop walkable bounds
const FLOOR_LEFT = 44;
const FLOOR_RIGHT = 436;
const FLOOR_TOP = 84;
const FLOOR_BOTTOM = 232;

// Solid counter rectangle
const COUNTER_RECT = { x: 204, y: 108, w: 72, h: 20 };

// Interactive points
const WORKBENCH_POS = { x: 76, y: 118 };
const CHEST_POS = { x: 376, y: 102 };
const WARP_GATE_POS = { x: 432, y: 164 };
const SHOP_DOOR_POS = { x: 240, y: 234 };
const CHECKOUT_SPOT = { x: 240, y: 140 };

export class ShopScene {
  private state: GameState;
  private callbacks: ShopCallbacks;

  public playerX = 240;
  public playerY = 152;
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
  private spawnTimer = 1.5;

  private particles: Particle[] = [];
  private floats: FloatingText[] = [];
  private time = 0;

  private stars: Array<{ x: number; y: number; phase: number; bright: boolean }> = [];
  private shuttles: BgShuttle[] = [];

  public activePrompt: { label: string; x: number; y: number } | null = null;

  constructor(state: GameState, callbacks: ShopCallbacks) {
    this.state = state;
    this.callbacks = callbacks;

    // Seed cozy twinkling nebula window stars
    for (let i = 0; i < 38; i++) {
      this.stars.push({
        x: 134 + Math.random() * 212,
        y: 15 + Math.random() * 46,
        phase: Math.random() * Math.PI * 2,
        bright: Math.random() > 0.65,
      });
    }
    this.shuttles = [
      { x: 165, y: 36, speed: 9, small: false },
      { x: 295, y: 25, speed: 6, small: true },
      { x: 240, y: 48, speed: 12, small: true },
    ];
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
      this.playerX = 398;
      this.playerY = 164;
      this.facing = 'left';
      this.spawnBurst(416, 164, '#38e8d4', 18);
    } else {
      this.playerX = 240;
      this.playerY = 152;
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
      this.spawnTimer = 1.1;
      sound.playShopBell();
      this.callbacks.onToast('Astro-Barter ist GEÖFFNET! Bediene Kunden an der Kasse mit [E].', 'good');
      this.spawnBurst(SHOP_DOOR_POS.x, SHOP_DOOR_POS.y - 6, '#4ade80', 14);
      this.callbacks.onHudDirty();
    } else {
      this.closeShop(true);
    }
  }

  private closeShop(manual: boolean): void {
    if (!this.shopOpen) return;
    this.shopOpen = false;

    // Return any unpaid items carried by customers cleanly to the chest
    for (const c of this.customers) {
      if (c.carriedItemId) {
        addItemToChest(this.state.inventory, c.carriedItemId, 1);
        c.carriedItemId = null;
      }
      c.state = 'leaving';
      c.targetX = SHOP_DOOR_POS.x;
      c.targetY = SHOP_DOOR_POS.y + 18;
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

  public update(dt: number, input: InputManager): void {
    this.time += dt;

    // Animate background shuttles
    for (const sh of this.shuttles) {
      sh.x += sh.speed * dt;
      if (sh.x > 360) sh.x = 122;
    }

    // Ambient forge sparks at Exo-Werkbank
    if (Math.random() < dt * 4.5) {
      this.particles.push({
        x: WORKBENCH_POS.x + (Math.random() - 0.5) * 16,
        y: WORKBENCH_POS.y - 6,
        vx: (Math.random() - 0.5) * 12,
        vy: -14 - Math.random() * 14,
        color: Math.random() > 0.4 ? '#fbbf24' : '#38e8d4',
        size: 1.5,
        life: 0.45 + Math.random() * 0.35,
        maxLife: 0.8,
      });
    }

    // Player movement & cozy dash
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    const move = input.getMoveVector();

    if (input.dashPressed() && this.dashCooldown <= 0 && (move.x !== 0 || move.y !== 0)) {
      this.dashTimer = 0.16;
      this.dashCooldown = 0.5;
      this.dashVx = move.x * 230;
      this.dashVy = move.y * 230;
      sound.playDash();
      this.spawnBurst(this.playerX, this.playerY + 4, '#fb923c', 6);
    }

    let vx = move.x * 102;
    let vy = move.y * 102;
    if (this.dashTimer > 0) {
      this.dashTimer -= dt;
      vx = this.dashVx;
      vy = this.dashVy;
    }

    if (Math.abs(vx) > 1 || Math.abs(vy) > 1) {
      this.walkAnim += dt * 9;
      if (Math.abs(vx) > Math.abs(vy)) {
        this.facing = vx > 0 ? 'right' : 'left';
      } else {
        this.facing = vy > 0 ? 'down' : 'up';
      }
    } else {
      this.walkAnim = 0;
    }

    this.movePlayer(vx * dt, vy * dt);

    // Quick toggle shop with 'O'
    if (input.wasPressed('KeyO')) {
      this.toggleShopOpen();
    }

    // Shop day timer & customer spawning
    if (this.shopOpen) {
      this.shopTimer -= dt;
      if (this.shopTimer <= 0) {
        this.closeShop(false);
      } else {
        this.spawnTimer -= dt;
        const maxCustomers = 3 + this.state.upgrades.shopAura;
        if (this.spawnTimer <= 0 && this.customers.length < maxCustomers) {
          this.spawnCustomer();
          this.spawnTimer = 4.2 + Math.random() * 2.8;
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
    // Counter collision
    if (
      x + r > COUNTER_RECT.x &&
      x - r < COUNTER_RECT.x + COUNTER_RECT.w &&
      y + r > COUNTER_RECT.y &&
      y - r < COUNTER_RECT.y + COUNTER_RECT.h
    ) {
      return true;
    }
    // Pedestals collision
    for (const p of this.state.pedestals) {
      if (Math.abs(x - p.x) < 15 && Math.abs(y - p.y) < 11) return true;
    }
    // Workbench collision
    if (Math.abs(x - WORKBENCH_POS.x) < 18 && Math.abs(y - WORKBENCH_POS.y) < 12) return true;
    // Storage chest collision
    if (Math.abs(x - CHEST_POS.x) < 14 && Math.abs(y - CHEST_POS.y) < 10) return true;
    return false;
  }

  private spawnCustomer(): void {
    const c: Customer = {
      id: this.nextCustomerId++,
      speciesIndex: Math.floor(Math.random() * 4),
      x: SHOP_DOOR_POS.x + (Math.random() - 0.5) * 14,
      y: SHOP_DOOR_POS.y + 12,
      targetX: SHOP_DOOR_POS.x,
      targetY: 204,
      state: 'entering',
      stateTimer: 0.4,
      walkAnim: 0,
      targetPedestalId: null,
      visitedPedestals: new Set<number>(),
      carriedItemId: null,
      carriedPrice: 0,
      emote: null,
      emoteTimer: 0,
      patience: 24 * this.state.getStats().customerPatienceBonus,
      maxPatience: 24 * this.state.getStats().customerPatienceBonus,
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

  private updateCustomers(dt: number): void {
    const speed = 52;

    for (let i = this.customers.length - 1; i >= 0; i--) {
      const c = this.customers[i];
      if (c.emoteTimer > 0) {
        c.emoteTimer -= dt;
        if (c.emoteTimer <= 0 && c.state !== 'waiting_checkout') {
          c.emote = null;
        }
      }

      const dx = c.targetX - c.x;
      const dy = c.targetY - c.y;
      const dist = Math.hypot(dx, dy);

      if (dist > 3) {
        c.x += (dx / dist) * speed * dt;
        c.y += (dy / dist) * speed * dt;
        c.walkAnim += dt * 7;
        continue;
      }

      c.walkAnim = 0;

      if (c.state === 'entering') {
        const ped = this.pickNextPedestal(c);
        if (ped) {
          c.state = 'browsing';
          c.targetPedestalId = ped.id;
          c.targetX = ped.x + (Math.random() - 0.5) * 8;
          c.targetY = ped.y + 25;
        } else {
          c.state = 'leaving';
          c.targetX = SHOP_DOOR_POS.x;
          c.targetY = SHOP_DOOR_POS.y + 18;
        }
      } else if (c.state === 'browsing') {
        c.state = 'thinking';
        c.stateTimer = 1.0 + Math.random() * 0.7;
      } else if (c.state === 'thinking') {
        c.stateTimer -= dt;
        if (c.stateTimer <= 0) {
          const ped = this.state.pedestals.find((p) => p.id === c.targetPedestalId);
          if (!ped || !ped.itemId || ped.qty <= 0) {
            // Item already taken; try another pedestal
            if (c.targetPedestalId !== null) c.visitedPedestals.add(c.targetPedestalId);
            const nextPed = this.pickNextPedestal(c);
            if (nextPed && c.visitedPedestals.size < 2) {
              c.state = 'browsing';
              c.targetPedestalId = nextPed.id;
              c.targetX = nextPed.x;
              c.targetY = nextPed.y + 25;
            } else {
              c.state = 'leaving';
              c.targetX = SHOP_DOOR_POS.x;
              c.targetY = SHOP_DOOR_POS.y + 18;
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
            // Take 1 unit from pedestal and head to checkout!
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
            const queueOffset = this.customers.filter(
              (other) => other.state === 'waiting_checkout' || other.state === 'to_checkout',
            ).length;
            c.targetX = CHECKOUT_SPOT.x + (queueOffset % 2 === 0 ? -1 : 1) * Math.min(24, queueOffset * 12);
            c.targetY = CHECKOUT_SPOT.y + Math.floor(queueOffset / 2) * 14;
            this.state.save();
          } else {
            recordPriceReaction(entry, ped.price, evalRes.reaction, false);
            this.state.save();
            // Outraged leaves immediately; expensive might check 1 more pedestal
            const nextPed =
              evalRes.reaction === 'expensive' && c.visitedPedestals.size < 2
                ? this.pickNextPedestal(c)
                : null;
            if (nextPed) {
              c.state = 'browsing';
              c.targetPedestalId = nextPed.id;
              c.targetX = nextPed.x;
              c.targetY = nextPed.y + 25;
            } else {
              c.state = 'leaving';
              c.targetX = SHOP_DOOR_POS.x;
              c.targetY = SHOP_DOOR_POS.y + 18;
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
          // Customer got tired waiting -> safely put item back in chest
          if (c.carriedItemId) {
            addItemToChest(this.state.inventory, c.carriedItemId, 1);
            c.carriedItemId = null;
          }
          c.emote = 'expensive';
          c.emoteTimer = 1.6;
          sound.playReaction('expensive');
          this.callbacks.onToast('Ein Kunde hat zu lange an der Kasse gewartet (Item zurück in Truhe).', 'warn');
          c.state = 'leaving';
          c.targetX = SHOP_DOOR_POS.x;
          c.targetY = SHOP_DOOR_POS.y + 18;
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
    waiter.targetX = SHOP_DOOR_POS.x;
    waiter.targetY = SHOP_DOOR_POS.y + 18;

    sound.playRegister();
    this.spawnBurst(CHECKOUT_SPOT.x, CHECKOUT_SPOT.y - 16, '#fbbf24', 14);
    this.floats.push({
      x: CHECKOUT_SPOT.x,
      y: CHECKOUT_SPOT.y - 24,
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

    // 1. Checkout Counter (highest priority when customer is waiting & player is nearby)
    const distCounter = Math.hypot(this.playerX - 240, this.playerY - 118);
    if (waitingCustomer && distCounter < 52) {
      this.activePrompt = {
        label: '[E] Kassieren!',
        x: 240,
        y: 92,
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
        : '[E] Podest bestücken';
      this.activePrompt = { label, x: nearestPed.x, y: nearestPed.y - 22 };
      if (input.interactPressed()) {
        sound.playUiClick();
        this.callbacks.onOpenPedestal(nearestPed);
      }
      return;
    }

    // 3. Exo-Werkbank
    if (Math.hypot(this.playerX - WORKBENCH_POS.x, this.playerY - WORKBENCH_POS.y) < 34) {
      this.activePrompt = { label: '[E] Exo-Werkbank (Upgrades)', x: WORKBENCH_POS.x + 12, y: WORKBENCH_POS.y - 22 };
      if (input.interactPressed()) {
        sound.playUiClick();
        this.callbacks.onOpenWorkbench();
      }
      return;
    }

    // 4. Lagertruhe
    if (Math.hypot(this.playerX - CHEST_POS.x, this.playerY - CHEST_POS.y) < 32) {
      this.activePrompt = { label: '[E] Lagertruhe & Fracht', x: CHEST_POS.x, y: CHEST_POS.y - 20 };
      if (input.interactPressed()) {
        sound.playUiClick();
        this.callbacks.onOpenChest();
      }
      return;
    }

    // 5. Warp-Gate to Sector 1
    if (Math.hypot(this.playerX - WARP_GATE_POS.x, this.playerY - WARP_GATE_POS.y) < 36) {
      this.activePrompt = {
        label: '[E] Warp: Verlassene Korvette',
        x: WARP_GATE_POS.x - 42,
        y: WARP_GATE_POS.y - 28,
      };
      if (input.interactPressed()) {
        if (this.shopOpen) {
          this.closeShop(true);
        }
        sound.playWarp();
        this.callbacks.onEnterDungeon();
      }
      return;
    }

    // 6. Shop Open/Close Door
    if (Math.hypot(this.playerX - SHOP_DOOR_POS.x, this.playerY - SHOP_DOOR_POS.y) < 32) {
      this.activePrompt = {
        label: this.shopOpen ? '[E] Laden schließen' : '[E] Laden öffnen',
        x: SHOP_DOOR_POS.x,
        y: SHOP_DOOR_POS.y - 22,
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
    const atlas = getAtlas();

    // Outer station hull darkness
    ctx.fillStyle = '#121521';
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

    // Outer metallic shop frame walls
    ctx.fillStyle = '#2d3548';
    ctx.fillRect(32, 6, 416, 252);
    ctx.fillStyle = '#1e2433';
    ctx.fillRect(36, 10, 408, 244);

    // Back wall (warm sci-fi paneling)
    ctx.fillStyle = '#38303b';
    ctx.fillRect(42, 14, 396, 68);
    ctx.fillStyle = '#4c3e4b';
    ctx.fillRect(42, 68, 396, 14);
    ctx.fillStyle = '#241e29';
    ctx.fillRect(42, 80, 396, 4);

    // Panoramic Spaceport Nebula Window!
    this.renderSpaceWindow(ctx);

    // Cozy Wood Plank Floor (clipped cleanly to floor bounds)
    ctx.save();
    ctx.beginPath();
    ctx.rect(FLOOR_LEFT, FLOOR_TOP, FLOOR_RIGHT - FLOOR_LEFT, FLOOR_BOTTOM - FLOOR_TOP);
    ctx.clip();
    let ty = 0;
    for (let y = FLOOR_TOP; y < FLOOR_BOTTOM; y += 16, ty++) {
      let tx = 0;
      for (let x = FLOOR_LEFT; x < FLOOR_RIGHT; x += 16, tx++) {
        const idx = (tx + ty * 3) % atlas.tiles.wood.length;
        ctx.drawImage(atlas.tiles.wood[idx], x, y);
      }
    }
    ctx.restore();

    // Subtle floor wall shadow
    ctx.fillStyle = 'rgba(15, 12, 24, 0.35)';
    ctx.fillRect(FLOOR_LEFT, FLOOR_TOP, FLOOR_RIGHT - FLOOR_LEFT, 6);

    // Cozy Decorative Rugs (matching concept art!)
    // Center entrance runner
    ctx.fillStyle = '#7c2d3b';
    ctx.fillRect(216, 134, 48, 86);
    ctx.fillStyle = '#d99038';
    ctx.fillRect(219, 137, 42, 80);
    ctx.fillStyle = '#8f3344';
    ctx.fillRect(222, 140, 36, 74);
    ctx.strokeStyle = '#e7a94e';
    ctx.lineWidth = 1;
    ctx.strokeRect(226.5, 152.5, 27, 48);

    // Side teal accents under pedestals
    ctx.fillStyle = 'rgba(20, 120, 118, 0.45)';
    ctx.fillRect(126, 156, 86, 42);
    ctx.fillRect(268, 156, 86, 42);

    // Warp-Gate Right Corridor Airlock
    this.renderWarpGate(ctx);

    // Bottom Shop Entrance Airlock & OPEN/CLOSED Sign
    this.renderShopDoor(ctx);

    // Decorative back-wall props (plants, shelves, crates)
    ctx.drawImage(atlas.props.plant, 48, 74);
    ctx.drawImage(atlas.props.plant, 412, 74);
    ctx.drawImage(atlas.props.crate, 48, 206);
    ctx.drawImage(atlas.props.crate, 64, 212);
    ctx.drawImage(atlas.props.plant, 408, 210);

    // Exo-Werkbank (Left)
    drawPixelShadow(ctx, WORKBENCH_POS.x, WORKBENCH_POS.y + 8, 15, 5);
    ctx.drawImage(atlas.props.workbench, WORKBENCH_POS.x - 14, WORKBENCH_POS.y - 8);
    drawGlow(ctx, WORKBENCH_POS.x, WORKBENCH_POS.y - 2, 26, '#fb923c', 0.22 + Math.sin(this.time * 4) * 0.05);

    // Lagertruhe (Right)
    drawPixelShadow(ctx, CHEST_POS.x, CHEST_POS.y + 6, 11, 4);
    ctx.drawImage(atlas.props.storageChest, CHEST_POS.x - 11, CHEST_POS.y - 6);
    drawGlow(ctx, CHEST_POS.x, CHEST_POS.y - 2, 18, '#38bdf8', 0.18);

    // Checkout Counter
    this.renderCounter(ctx);

    // Depth-sorted entities (Pedestals, Customers, Player)
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

    // Warm Cozy Shop Aura Lanterns (upgraded via Shop-Atmosphäre!)
    const auraLevel = this.state.upgrades.shopAura;
    const lanternAlpha = 0.16 + auraLevel * 0.07;
    drawGlow(ctx, 110, 74, 42, '#fbbf24', lanternAlpha);
    drawGlow(ctx, 370, 74, 42, '#fbbf24', lanternAlpha);
    drawGlow(ctx, 240, 114, 46, '#38e8d4', 0.15 + auraLevel * 0.04);

    // Particles
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
    ctx.globalAlpha = 1;

    // Floating Credit Popups
    ctx.font = 'bold 8px Silkscreen, monospace';
    ctx.textAlign = 'center';
    for (const f of this.floats) {
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life / 0.5));
      ctx.fillStyle = '#121521';
      ctx.fillText(f.text, Math.round(f.x) + 1, Math.round(f.y) + 1);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, Math.round(f.x), Math.round(f.y));
    }
    ctx.globalAlpha = 1;

    // Shop Open Timer Pill on Canvas top-center (under window)
    if (this.shopOpen) {
      const pct = Math.max(0, this.shopTimer / this.shopDuration);
      ctx.fillStyle = 'rgba(18, 22, 34, 0.88)';
      ctx.fillRect(190, 72, 100, 8);
      ctx.fillStyle = '#263042';
      ctx.fillRect(192, 74, 96, 4);
      ctx.fillStyle = pct > 0.25 ? '#4ade80' : '#fb923c';
      ctx.fillRect(192, 74, Math.round(96 * pct), 4);
    }

    // Active Context Interaction Prompt
    if (this.activePrompt) {
      this.renderPrompt(ctx, this.activePrompt.label, this.activePrompt.x, this.activePrompt.y);
    }
  }

  private renderSpaceWindow(ctx: CanvasRenderingContext2D): void {
    const atlas = getAtlas();

    // Cozy Left & Right Back-Wall Shelves + Warm Lantern Fixtures
    // Left display shelf with glowing relics
    ctx.fillStyle = '#5c331c';
    ctx.fillRect(54, 48, 56, 5);
    ctx.fillStyle = '#8b522e';
    ctx.fillRect(54, 47, 56, 2);
    ctx.fillStyle = '#38e8d4';
    ctx.fillRect(62, 39, 5, 8);
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(76, 41, 6, 6);
    ctx.fillStyle = '#c084fc';
    ctx.fillRect(92, 40, 5, 7);

    // Right noticeboard + shelf
    ctx.fillStyle = '#5c331c';
    ctx.fillRect(370, 34, 52, 24);
    ctx.fillStyle = '#9a6842';
    ctx.fillRect(373, 37, 46, 18);
    ctx.fillStyle = '#fef3c7';
    ctx.fillRect(377, 40, 10, 8);
    ctx.fillStyle = '#bae6fd';
    ctx.fillRect(391, 41, 12, 9);
    ctx.fillStyle = '#fde68a';
    ctx.fillRect(407, 39, 8, 10);

    // Warm wall lantern fixtures flanking the window
    for (const lx of [114, 366]) {
      ctx.fillStyle = '#475569';
      ctx.fillRect(lx - 3, 54, 6, 4);
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(lx - 2, 58, 4, 6);
      ctx.fillStyle = '#fef9c3';
      ctx.fillRect(lx - 1, 59, 2, 4);
    }

    const wx = 130;
    const wy = 16;
    const ww = 220;
    const wh = 46;

    // Window brushed-steel outer frame
    ctx.fillStyle = '#64748b';
    ctx.fillRect(wx - 4, wy - 3, ww + 8, wh + 6);
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(wx - 3, wy - 2, ww + 6, 2);

    ctx.save();
    ctx.beginPath();
    ctx.rect(wx, wy, ww, wh);
    ctx.clip();

    // Deep cosmic gradient
    const sky = ctx.createLinearGradient(wx, wy, wx + ww, wy + wh);
    sky.addColorStop(0, '#1e2752');
    sky.addColorStop(0.45, '#3b2d69');
    sky.addColorStop(1, '#1d375c');
    ctx.fillStyle = sky;
    ctx.fillRect(wx, wy, ww, wh);

    // Cozy pastel nebula swirls
    drawGlow(ctx, wx + 46, wy + 24, 48, '#38bdf8', 0.28);
    drawGlow(ctx, wx + 115, wy + 30, 52, '#c084fc', 0.28);
    drawGlow(ctx, wx + 178, wy + 18, 40, '#38e8d4', 0.22);

    // Twinkling stars
    for (const s of this.stars) {
      const a = 0.45 + 0.55 * Math.sin(this.time * 2.4 + s.phase);
      ctx.fillStyle = s.bright ? `rgba(255, 251, 214, ${a})` : `rgba(186, 230, 253, ${a * 0.8})`;
      ctx.fillRect(Math.round(s.x), Math.round(s.y), s.bright ? 2 : 1, 1);
    }

    // Passing pixel shuttles!
    for (const sh of this.shuttles) {
      const spr = sh.small ? atlas.props.shuttleSmall : atlas.props.shuttle;
      ctx.drawImage(spr, Math.round(sh.x), Math.round(sh.y));
      drawGlow(ctx, sh.x + 2, sh.y + spr.height / 2, 8, '#fb923c', 0.35);
    }

    // Subtle glass reflection diagonal
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath();
    ctx.moveTo(wx + 24, wy);
    ctx.lineTo(wx + 48, wy);
    ctx.lineTo(wx + 18, wy + wh);
    ctx.lineTo(wx - 6, wy + wh);
    ctx.closePath();
    ctx.fill();

    ctx.restore();

    // Warm Wooden Shop Signboard ("ASTRO-BARTER") mounted cleanly along window bottom sill
    ctx.fillStyle = '#4a2511';
    ctx.fillRect(192, 57, 96, 13);
    ctx.fillStyle = '#7c4322';
    ctx.fillRect(193, 58, 94, 11);
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 7px Silkscreen, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('ASTRO-BARTER', 240, 66);
  }

  private renderCounter(ctx: CanvasRenderingContext2D): void {
    const { x, y, w, h } = COUNTER_RECT;
    drawPixelShadow(ctx, x + w / 2, y + h + 1, w / 2 + 2, 4, 0.35);

    // Metal/wood counter body
    ctx.fillStyle = '#1e2433';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#8b5e3c';
    ctx.fillRect(x + 2, y + 2, w - 4, 6);
    ctx.fillStyle = '#64748b';
    ctx.fillRect(x + 2, y + 8, w - 4, h - 10);
    ctx.fillStyle = '#475569';
    ctx.fillRect(x + 2, y + h - 4, w - 4, 3);

    // Glowing holographic checkout screen on counter
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(x + 24, y + 3, 24, 9);
    ctx.fillStyle = '#38e8d4';
    ctx.fillRect(x + 26, y + 5, 20, 5);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + 28, y + 6, 8, 1);
    ctx.fillRect(x + 28, y + 8, 14, 1);

    // Cash drawer accent
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(x + 54, y + 4, 10, 5);
  }

  private renderPedestal(ctx: CanvasRenderingContext2D, p: PedestalSlot): void {
    const atlas = getAtlas();
    const active = p.itemId !== null && p.qty > 0;
    drawPixelShadow(ctx, p.x, p.y + 7, 13, 4);
    ctx.drawImage(
      active ? atlas.props.pedestalActive : atlas.props.pedestalEmpty,
      Math.round(p.x - 12),
      Math.round(p.y - 8),
    );

    if (active && p.itemId) {
      const def = getItemDef(p.itemId);
      const spr = atlas.items[p.itemId];
      const bob = Math.sin(this.time * 3.4 + p.id) * 2;
      drawGlow(ctx, p.x, p.y - 10 + bob, 18, def.glowColor, 0.32);
      if (spr) {
        ctx.drawImage(spr, Math.round(p.x - 8), Math.round(p.y - 18 + bob));
      }

      // Crisp Price Tag & Quantity Badge
      ctx.font = 'bold 6px Silkscreen, monospace';
      const tag = `${p.price}CR`;
      const tw = Math.max(30, Math.ceil(ctx.measureText(tag).width) + 8);
      ctx.fillStyle = 'rgba(15, 20, 32, 0.92)';
      ctx.fillRect(Math.round(p.x - tw / 2), Math.round(p.y + 8), tw, 9);
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 1;
      ctx.strokeRect(Math.round(p.x - tw / 2) + 0.5, Math.round(p.y + 8.5), tw - 1, 8);
      ctx.fillStyle = '#fde047';
      ctx.textAlign = 'center';
      ctx.fillText(tag, Math.round(p.x), Math.round(p.y + 15));

      if (p.qty > 1) {
        ctx.fillStyle = '#14b8a6';
        ctx.fillRect(Math.round(p.x + 6), Math.round(p.y - 20 + bob), 11, 8);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`x${p.qty}`, Math.round(p.x + 11.5), Math.round(p.y - 14 + bob));
      }
    }
  }

  private renderWarpGate(ctx: CanvasRenderingContext2D): void {
    const gx = WARP_GATE_POS.x;
    const gy = WARP_GATE_POS.y;
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 4.5);

    // Metallic airlock archway on right wall
    ctx.fillStyle = '#334155';
    ctx.fillRect(gx - 8, gy - 22, 16, 44);
    ctx.fillStyle = '#64748b';
    ctx.fillRect(gx - 6, gy - 20, 12, 40);

    // Glowing cyan warp portal field
    ctx.fillStyle = '#0f2938';
    ctx.fillRect(gx - 3, gy - 16, 9, 32);
    ctx.fillStyle = '#14b8a6';
    ctx.fillRect(gx - 2, gy - 14, 7, 28);
    ctx.fillStyle = '#38e8d4';
    ctx.fillRect(gx - 1, gy - 10 + Math.round(Math.sin(this.time * 6) * 2), 5, 20);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(gx + 1, gy - 6, 2, 12);

    drawGlow(ctx, gx - 2, gy, 32 + pulse * 6, '#38e8d4', 0.34 + pulse * 0.14);

    // Cleanly padded directional sign
    ctx.font = 'bold 6px Silkscreen, monospace';
    const label = 'SEKTOR 1';
    const sw = Math.ceil(ctx.measureText(label).width) + 10;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.fillRect(gx - sw - 2, gy - 32, sw, 11);
    ctx.strokeStyle = '#14b8a6';
    ctx.lineWidth = 1;
    ctx.strokeRect(gx - sw - 1.5, gy - 31.5, sw - 1, 10);
    ctx.fillStyle = '#38e8d4';
    ctx.textAlign = 'center';
    ctx.fillText(label, gx - sw / 2 - 2, gy - 24);
  }

  private renderShopDoor(ctx: CanvasRenderingContext2D): void {
    const dx = SHOP_DOOR_POS.x;
    const dy = SHOP_DOOR_POS.y;

    ctx.fillStyle = '#334155';
    ctx.fillRect(dx - 24, dy - 3, 48, 14);
    ctx.fillStyle = this.shopOpen ? '#064e3b' : '#451a03';
    ctx.fillRect(dx - 20, dy, 40, 9);

    ctx.fillStyle = this.shopOpen ? '#4ade80' : '#fbbf24';
    ctx.font = 'bold 6px Silkscreen, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(this.shopOpen ? 'OFFEN' : 'ZU [E]', dx, dy + 7);
    drawGlow(ctx, dx, dy + 4, 22, this.shopOpen ? '#4ade80' : '#fbbf24', 0.22);
  }

  private renderCustomer(ctx: CanvasRenderingContext2D, c: Customer): void {
    const atlas = getAtlas();
    const frames = atlas.customers[c.speciesIndex % atlas.customers.length];
    const frame = Math.floor(c.walkAnim) % 2;

    drawPixelShadow(ctx, c.x, c.y + 6, 6, 3);
    ctx.drawImage(frames[frame], Math.round(c.x - 8), Math.round(c.y - 10));

    // If carrying purchased item to checkout
    if (c.carriedItemId) {
      const itemSpr = atlas.items[c.carriedItemId];
      if (itemSpr) {
        ctx.drawImage(itemSpr, Math.round(c.x - 6), Math.round(c.y - 20), 12, 12);
      }
    }

    // Thinking dots
    if (c.state === 'thinking') {
      const dots = Math.floor(this.time * 4) % 4;
      ctx.fillStyle = 'rgba(15, 20, 32, 0.85)';
      ctx.fillRect(Math.round(c.x - 8), Math.round(c.y - 22), 16, 8);
      ctx.fillStyle = '#f8fafc';
      for (let d = 0; d < dots; d++) {
        ctx.fillRect(Math.round(c.x - 5 + d * 4), Math.round(c.y - 19), 2, 2);
      }
    }

    // Emote Bubble (Price reaction or Coin at checkout!)
    if (c.emote) {
      const emSpr = atlas.emotes[c.emote];
      const bob = Math.sin(this.time * 6) * 1.5;
      ctx.drawImage(emSpr, Math.round(c.x - 7), Math.round(c.y - 25 + bob));
    }

    // Patience bar at checkout
    if (c.state === 'waiting_checkout') {
      const pct = Math.max(0, c.patience / c.maxPatience);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(Math.round(c.x - 10), Math.round(c.y - 29), 20, 3);
      ctx.fillStyle = pct > 0.35 ? '#4ade80' : '#f87171';
      ctx.fillRect(Math.round(c.x - 9), Math.round(c.y - 28), Math.round(18 * pct), 1);
    }
  }

  private renderPlayer(ctx: CanvasRenderingContext2D): void {
    const atlas = getAtlas();
    const frame = Math.floor(this.walkAnim) % 2;
    let spr = atlas.heroDown[frame];
    if (this.facing === 'up') spr = atlas.heroUp[frame];
    else if (this.facing === 'right') spr = atlas.heroRight[frame];
    else if (this.facing === 'left') spr = atlas.heroLeft[frame];

    drawPixelShadow(ctx, this.playerX, this.playerY + 7, 6, 3);
    ctx.drawImage(spr, Math.round(this.playerX - 8), Math.round(this.playerY - 10));
  }

  private renderPrompt(ctx: CanvasRenderingContext2D, text: string, x: number, y: number): void {
    ctx.font = 'bold 6px Silkscreen, monospace';
    const w = Math.max(54, Math.ceil(ctx.measureText(text).width) + 16);
    const px = Math.max(8, Math.min(VIRTUAL_WIDTH - w - 8, Math.round(x - w / 2)));
    const py = Math.max(8, Math.round(y - 8));

    ctx.fillStyle = 'rgba(14, 19, 32, 0.92)';
    ctx.fillRect(px, py, w, 12);
    ctx.strokeStyle = '#38e8d4';
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 0.5, py + 0.5, w - 1, 11);
    ctx.fillStyle = '#f8fafc';
    ctx.textAlign = 'center';
    ctx.fillText(text, px + w / 2, py + 8.5);
  }
}
