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
  | 'stealing'
  | 'fleeing'
  | 'to_checkout'
  | 'waiting_checkout'
  | 'leaving';

interface Customer {
  id: number;
  speciesIndex: number;
  isThief: boolean;
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
  onOpenBounties: () => void;
  onOpenSaleBox: () => void;
  onAdvanceTime: () => void;
  onEnterDungeon: () => void;
  onToast: (msg: string, tone?: 'info' | 'good' | 'warn') => void;
  onHudDirty: () => void;
}

type SolidShape =
  | { kind: 'rrect'; x: number; y: number; w: number; h: number; r: number }
  | { kind: 'circle'; x: number; y: number; r: number };

// Rounded walkable shop floor bounds aligned pixel-for-pixel to public/art/shop_bg*.png
const FLOOR_LEFT = 48;
const FLOOR_RIGHT = 434;
const FLOOR_TOP = 116;
const FLOOR_BOTTOM = 232;
const FLOOR_CORNER_R = 26;
const PLAYER_RADIUS = 5.5;

// Exact curved & L-shaped furniture collision geometry (ZERO invisible square corners!)
const SOLID_SHAPES: SolidShape[] = [
  // Grand U-shaped Checkout Counter — open right-side passage at y=121..147!
  { kind: 'rrect', x: 178, y: 98, w: 128, h: 22, r: 4 }, // Back counter console under window
  { kind: 'rrect', x: 176, y: 112, w: 20, h: 56, r: 8 }, // Left counter wing
  { kind: 'rrect', x: 178, y: 150, w: 128, h: 26, r: 13 }, // Rounded front checkout arc!
  { kind: 'rrect', x: 288, y: 148, w: 18, h: 26, r: 7 }, // Lower-right counter wing (below passage)
  { kind: 'circle', x: 165, y: 138, r: 6.5 }, // Small junction box left of counter

  // Left L-shaped Shop-Ausbau terminal (exact L contour — open floor in front!)
  { kind: 'rrect', x: 20, y: 110, w: 70, h: 34, r: 7 },
  { kind: 'rrect', x: 20, y: 140, w: 34, h: 42, r: 7 },

  // Bottom-left diagonal crate cluster (exact tight circles per crate)
  { kind: 'circle', x: 46, y: 206, r: 10 },
  { kind: 'circle', x: 65, y: 208, r: 8.5 },
  { kind: 'circle', x: 55, y: 224, r: 11 },
  { kind: 'circle', x: 74, y: 229, r: 9.5 },

  // Bottom-right tool crate & potted plants
  { kind: 'rrect', x: 391, y: 212, w: 25, h: 25, r: 6 },
  { kind: 'circle', x: 427, y: 223, r: 8.5 },
  { kind: 'circle', x: 434, y: 208, r: 7.5 },
];

// Interactive station hotspots matching public/art/shop_bg*.png
const WORKBENCH_POS = { x: 92, y: 164 };
const SLEEP_POD_POS = { x: 120, y: 122 };
const SALE_BOX_POS = { x: 186, y: 188 };
const CHEST_POS = { x: 334, y: 118 };
const BOUNTY_BOARD_POS = { x: 386, y: 118 };
const WARP_GATE_POS = { x: 426, y: 152 };
const SHOP_DOOR_POS = { x: 240, y: 218 };
const CHECKOUT_SPOT = { x: 240, y: 192 };
const COUNTER_GATE_POS = { x: 296, y: 134 };

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
  private gateOpen = 0;

  public shopOpen = false;
  public shopTimer = 0;
  public readonly shopDuration = 95;
  public daySalesCount = 0;
  public daySalesCredits = 0;

  private customers: Customer[] = [];
  private nextCustomerId = 1;
  private spawnTimer = 1.4;
  private saleBoxTimer = 5.5;

  private particles: Particle[] = [];
  private floats: FloatingText[] = [];
  private time = 0;

  private windowStars: Array<{ x: number; y: number; phase: number }> = [];
  private dustMotes: Array<{ x: number; y: number; phase: number; speed: number }> = [];

  public activePrompt: { label: string; x: number; y: number } | null = null;

  constructor(state: GameState, callbacks: ShopCallbacks) {
    this.state = state;
    this.callbacks = callbacks;

    for (let i = 0; i < 26; i++) {
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
      this.playerY = 188;
      this.facing = 'down';
    }
    this.callbacks.onHudDirty();
  }

  public toggleShopOpen(): void {
    if (!this.shopOpen) {
      const hasStock =
        this.state.pedestals.some((p) => p.itemId !== null && p.qty > 0) ||
        (this.state.getStats().hasSaleBox && this.state.countSaleBoxItems() > 0);
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
      this.spawnTimer = 0.9;
      this.saleBoxTimer = 6.5;
      sound.playShopBell();
      this.callbacks.onToast(
        'Astro-Barter ist GEÖFFNET! Geh rechts hinter den Tresen [E] & achte auf Weltraum-Diebe!',
        'good',
      );
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
    if (this.daySalesCount > 0 || !manual) {
      const res = this.state.advanceTimeOfDay();
      if (this.daySalesCount > 0) {
        const phaseNote = res.newDay
          ? `Morgen bricht an (Tag ${res.day} · neue Aufträge!)`
          : `Nacht bricht an (+35 % seltener Loot in Sektor 1!)`;
        this.callbacks.onToast(
          `Schicht beendet: ${this.daySalesCount} Relikte für ${this.daySalesCredits} Cr! ${phaseNote}`,
          'good',
        );
      } else {
        this.callbacks.onToast(
          res.newDay
            ? `Ladenschluss! Tag ${res.day} beginnt mit frischen Aufträgen.`
            : 'Ladenschluss! Die Nacht bricht an — ideal für eine Sektor-Expedition (+35 % Rar-Loot)!',
          'info',
        );
      }
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
        { x: fromX < 240 ? 158 : 320, y: 208 },
        { x: 240, y: 208 },
        { x: toX, y: toY },
      ];
    }
    return [{ x: toX, y: toY }];
  }

  public update(dt: number, input: InputManager): void {
    this.time += dt;

    // Ambient sparks at left Shop-Ausbau console
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

    // Swirling energy motes pouring gently from the right Promenade exit
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

    // Player movement & cozy dash (also great for tackling fleeing Space Thieves!)
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    const move = input.getMoveVector();

    if (input.dashPressed() && this.dashCooldown <= 0 && (move.x !== 0 || move.y !== 0)) {
      this.dashTimer = 0.17;
      this.dashCooldown = 0.46;
      this.dashVx = move.x * 238;
      this.dashVy = move.y * 238;
      sound.playDash();
      this.spawnBurst(this.playerX, this.playerY + 4, '#fb923c', 6);
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

    if (input.wasPressed('KeyO')) {
      this.toggleShopOpen();
    }

    if (this.shopOpen) {
      this.shopTimer -= dt;
      if (this.shopTimer <= 0) {
        this.closeShop(false);
      } else {
        const stats = this.state.getStats();
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0 && this.customers.length < stats.maxCustomers) {
          this.spawnCustomer();
          const tierPace = Math.max(2.6, 4.0 - this.state.upgrades.shopTier * 0.55);
          this.spawnTimer = tierPace + Math.random() * 2.1;
        }

        // Automatic Bargain Sales from unlocked Sale-Box (Stufe II+) while shoppers are inside!
        if (stats.hasSaleBox && this.state.countSaleBoxItems() > 0 && this.customers.length > 0) {
          this.saleBoxTimer -= dt;
          if (this.saleBoxTimer <= 0) {
            this.saleBoxTimer = 6.5 + Math.random() * 3.5;
            const sale = this.state.popSaleBoxSale();
            if (sale) {
              this.daySalesCount += 1;
              this.daySalesCredits += sale.price;
              sound.playRegister();
              this.spawnBurst(SALE_BOX_POS.x, SALE_BOX_POS.y - 4, '#fb923c', 12);
              this.floats.push({
                x: SALE_BOX_POS.x,
                y: SALE_BOX_POS.y - 16,
                text: `+${sale.price} Cr (SALE!)`,
                color: '#fbbf24',
                life: 1.4,
                maxLife: 1.4,
              });
              this.callbacks.onToast(
                `Sonderangebot! ${sale.itemName} automatisch für ${sale.price} Cr verkauft.`,
                'good',
              );
              this.callbacks.onHudDirty();
            }
          }
        }
      }
    }

    // Smoothly retract holographic counter filament whenever hero approaches the right-side passage!
    const nearGate = Math.hypot(this.playerX - COUNTER_GATE_POS.x, this.playerY - COUNTER_GATE_POS.y) < 34;
    const gateTarget = nearGate ? 1 : 0;
    this.gateOpen += (gateTarget - this.gateOpen) * Math.min(1, dt * 12);

    this.updateCustomers(dt);
    this.updateInteraction(input);
    this.updateEffects(dt);
  }

  public isBehindCounter(x = this.playerX, y = this.playerY): boolean {
    return x >= 192 && x <= 290 && y >= 118 && y <= 152;
  }

  private movePlayer(dx: number, dy: number): void {
    let px = this.playerX + dx;
    let py = this.playerY + dy;
    const hasSaleBox = this.state.getStats().hasSaleBox;

    // 3-pass exact SDF push-out so player glides smoothly around every rounded edge & circle!
    for (let iter = 0; iter < 3; iter++) {
      // 1. Curved room outer boundary (rounded corners matching wooden walls!)
      const clamped = this.clampToRoundedFloor(px, py);
      px = clamped.x;
      py = clamped.y;

      // 2. Curved furniture & U-counter walls
      for (const s of SOLID_SHAPES) {
        if (s.kind === 'circle') {
          const out = this.pushOutCircle(px, py, s.x, s.y, s.r + PLAYER_RADIUS);
          px = out.x;
          py = out.y;
        } else {
          const out = this.pushOutRoundedRect(px, py, s.x, s.y, s.w, s.h, s.r, PLAYER_RADIUS);
          px = out.x;
          py = out.y;
        }
      }

      // 3. Chrono-Ruhekapsel (Sleep Pod) & unlocked Sale-Box smooth circles
      const outSleep = this.pushOutCircle(px, py, SLEEP_POD_POS.x, SLEEP_POD_POS.y + 1, 8.5 + PLAYER_RADIUS);
      px = outSleep.x;
      py = outSleep.y;

      if (hasSaleBox) {
        const outBox = this.pushOutCircle(px, py, SALE_BOX_POS.x, SALE_BOX_POS.y + 1, 7.5 + PLAYER_RADIUS);
        px = outBox.x;
        py = outBox.y;
      }

      // 4. Round Holo-Pedestals (smooth circular slide — 4 / 6 / 8 depending on Shop Tier!)
      for (const p of this.state.pedestals) {
        const out = this.pushOutCircle(px, py, p.x, p.y + 1, 10.0 + PLAYER_RADIUS);
        px = out.x;
        py = out.y;
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

    // Push gently inward along the 4 curved wooden corner arcs
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

  private pushOutRoundedRect(
    px: number,
    py: number,
    rx: number,
    ry: number,
    rw: number,
    rh: number,
    cornerR: number,
    pad: number,
  ): { x: number; y: number } {
    const cr = Math.min(cornerR, rw * 0.5, rh * 0.5);
    const ix0 = rx + cr;
    const ix1 = rx + rw - cr;
    const iy0 = ry + cr;
    const iy1 = ry + rh - cr;

    const qx = Math.max(ix0, Math.min(ix1, px));
    const qy = Math.max(iy0, Math.min(iy1, py));
    const dx = px - qx;
    const dy = py - qy;
    const d2 = dx * dx + dy * dy;
    const minDist = cr + pad;

    if (d2 >= minDist * minDist) return { x: px, y: py };

    if (d2 > 0.0001) {
      const dist = Math.sqrt(d2);
      return {
        x: qx + (dx / dist) * minDist,
        y: qy + (dy / dist) * minDist,
      };
    }

    // Center is inside inner core rect: push out along nearest face
    const dLeft = px - ix0;
    const dRight = ix1 - px;
    const dTop = py - iy0;
    const dBottom = iy1 - py;
    const m = Math.min(dLeft, dRight, dTop, dBottom);
    if (m === dLeft) return { x: ix0 - minDist, y: py };
    if (m === dRight) return { x: ix1 + minDist, y: py };
    if (m === dTop) return { x: px, y: iy0 - minDist };
    return { x: px, y: iy1 + minDist };
  }

  private spawnCustomer(): void {
    const hasStockedPed = this.state.pedestals.some((p) => p.itemId !== null && p.qty > 0);
    const hasActiveThief = this.customers.some((c) => c.isThief);
    // ~20% chance to spawn a sneaky Space Thief whenever stocked pedestals exist!
    const isThief = hasStockedPed && !hasActiveThief && Math.random() < 0.2;

    const c: Customer = {
      id: this.nextCustomerId++,
      speciesIndex: Math.floor(Math.random() * 3),
      isThief,
      x: SHOP_DOOR_POS.x + (Math.random() - 0.5) * 10,
      y: SHOP_DOOR_POS.y + 8,
      waypoints: [{ x: SHOP_DOOR_POS.x, y: 206 }],
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
      x: ped.x < 240 ? ped.x + 20 : ped.x - 20,
      y: ped.y + 4,
    };
  }

  private tackleThief(c: Customer, index: number): void {
    const recoveredId = c.carriedItemId;
    let recoveredName = 'Relikt';
    if (recoveredId) {
      recoveredName = getItemDef(recoveredId).name;
      // Restore item back onto original pedestal if empty or matching, else safely into Shop Chest!
      const ped = this.state.pedestals.find((p) => p.id === c.targetPedestalId);
      if (ped && (!ped.itemId || ped.itemId === recoveredId)) {
        ped.itemId = recoveredId;
        ped.qty += 1;
      } else {
        addItemToChest(this.state.inventory, recoveredId, 1);
      }
      c.carriedItemId = null;
    }

    const bounty = 35;
    this.state.credits += bounty;
    this.state.totalEarned += bounty;
    this.state.save();

    sound.playThiefCaught();
    this.spawnBurst(c.x, c.y, '#fbbf24', 18);
    this.spawnBurst(c.x, c.y, '#c084fc', 12);
    this.floats.push({
      x: c.x,
      y: c.y - 18,
      text: `GESCHNAPPT! +${bounty} Cr`,
      color: '#4ade80',
      life: 1.5,
      maxLife: 1.5,
    });
    this.callbacks.onToast(
      recoveredId
        ? `Weltraum-Dieb gestellt! ${recoveredName} gerettet + ${bounty} Cr Kopfgeld!`
        : `Weltraum-Dieb vertrieben! +${bounty} Cr Sicherheits-Prämie!`,
      'good',
    );
    this.customers.splice(index, 1);
    this.callbacks.onHudDirty();
  }

  private updateCustomers(dt: number): void {
    for (let i = this.customers.length - 1; i >= 0; i--) {
      const c = this.customers[i];

      // Space Thief Tackle Check: bump or dash into a stealing/fleeing thief to recover stolen loot!
      if (c.isThief && (c.state === 'fleeing' || c.state === 'stealing')) {
        const catchDist = this.dashTimer > 0 ? 24 : 19;
        if (Math.hypot(this.playerX - c.x, this.playerY - c.y) < catchDist) {
          this.tackleThief(c, i);
          continue;
        }
      }

      if (c.emoteTimer > 0) {
        c.emoteTimer -= dt;
        if (c.emoteTimer <= 0 && c.state !== 'waiting_checkout') {
          c.emote = null;
        }
      }

      const speed = c.state === 'fleeing' ? 88 : c.isThief ? 62 : 54;
      const nextWp = c.waypoints[0];
      if (nextWp) {
        const dx = nextWp.x - c.x;
        const dy = nextWp.y - c.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 3) {
          c.x += (dx / dist) * speed * dt;
          c.y += (dy / dist) * speed * dt;
          c.walkAnim += dt * (c.state === 'fleeing' ? 15 : 9);
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
        if (c.isThief) {
          c.state = 'stealing';
          c.stateTimer = 1.05;
        } else {
          c.state = 'thinking';
          c.stateTimer = 1.0 + Math.random() * 0.7;
        }
      } else if (c.state === 'stealing') {
        c.stateTimer -= dt;
        if (c.stateTimer <= 0) {
          const ped = this.state.pedestals.find((p) => p.id === c.targetPedestalId);
          if (ped && ped.itemId && ped.qty > 0) {
            const stolenId = ped.itemId;
            ped.qty -= 1;
            if (ped.qty <= 0) {
              ped.itemId = null;
              ped.qty = 0;
            }
            c.carriedItemId = stolenId;
            c.state = 'fleeing';
            c.waypoints = this.planPath(c.x, c.y, SHOP_DOOR_POS.x, SHOP_DOOR_POS.y + 10);
            sound.playThiefAlarm();
            this.spawnBurst(ped.x, ped.y - 8, '#fb7185', 14);
            this.floats.push({
              x: c.x,
              y: c.y - 20,
              text: 'DIEBSTAHL!',
              color: '#fb7185',
              life: 1.5,
              maxLife: 1.5,
            });
            this.callbacks.onToast(
              `🚨 DIEB! Schnapp ihn mit Dash [SPACE] oder lauf in ihn hinein, bevor er entkommt!`,
              'warn',
            );
            this.state.save();
          } else {
            c.state = 'leaving';
            c.waypoints = this.planPath(c.x, c.y, SHOP_DOOR_POS.x, SHOP_DOOR_POS.y + 10);
          }
        }
      } else if (c.state === 'fleeing') {
        // Reached the exit door — thief escaped with the relic!
        const lostName = c.carriedItemId ? getItemDef(c.carriedItemId).name : 'einem Relikt';
        sound.playReaction('outrageous');
        this.callbacks.onToast(`Der Weltraum-Dieb ist mit ${lostName} entkommen!`, 'warn');
        this.customers.splice(i, 1);
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

    // 1. Checkout Counter — authentic Moonlighter rule: walk behind the counter to ring up buyers!
    const behind = this.isBehindCounter();
    if (waitingCustomer && behind) {
      this.activePrompt = {
        label: '[E] Kassieren!',
        x: 240,
        y: 112,
      };
      if (input.interactPressed()) {
        this.checkoutNextCustomer();
      }
      return;
    }
    if (waitingCustomer && !behind && Math.hypot(this.playerX - 240, this.playerY - 186) < 46) {
      this.activePrompt = {
        label: '→ Rechts hinter den Tresen zum Kassieren!',
        x: 248,
        y: 162,
      };
      return;
    }

    // 2. Holo-Pedestals
    let nearestPed: PedestalSlot | null = null;
    let bestPedDist = 27;
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

    // 3. Unlocked Sonderangebots-Kiste (Sale-Box, Stufe II+)
    if (this.state.getStats().hasSaleBox) {
      if (Math.hypot(this.playerX - SALE_BOX_POS.x, this.playerY - SALE_BOX_POS.y) < 26) {
        const count = this.state.countSaleBoxItems();
        this.activePrompt = {
          label: `[E] Sonderangebots-Kiste (${count})`,
          x: SALE_BOX_POS.x,
          y: SALE_BOX_POS.y - 22,
        };
        if (input.interactPressed()) {
          sound.playUiClick();
          this.callbacks.onOpenSaleBox();
        }
        return;
      }
    }

    // 4. Chrono-Ruhekapsel (Sleep Pod — Day <-> Night cycle!)
    if (Math.hypot(this.playerX - SLEEP_POD_POS.x, this.playerY - SLEEP_POD_POS.y) < 26) {
      const label =
        this.state.timeOfDay === 'day'
          ? '[E] Ruhen → Nacht (+35 % Rar-Loot)'
          : `[E] Schlafen → Morgen (Tag ${this.state.day + 1})`;
      this.activePrompt = {
        label,
        x: SLEEP_POD_POS.x + 14,
        y: SLEEP_POD_POS.y - 20,
      };
      if (input.interactPressed()) {
        if (this.shopOpen) this.closeShop(true);
        this.callbacks.onAdvanceTime();
      }
      return;
    }

    // 5. Auftrags-Pinnwand (Sonderaufträge / Bounties!)
    if (Math.hypot(this.playerX - BOUNTY_BOARD_POS.x, this.playerY - BOUNTY_BOARD_POS.y) < 28) {
      this.activePrompt = {
        label: this.state.hasReadyBounty()
          ? '[E] ★ Sonderauftrag abliefern!'
          : '[E] Auftrags-Pinnwand (Bounties)',
        x: BOUNTY_BOARD_POS.x - 16,
        y: BOUNTY_BOARD_POS.y - 18,
      };
      if (input.interactPressed()) {
        sound.playUiClick();
        this.callbacks.onOpenBounties();
      }
      return;
    }

    // 6. Astro-Barter Shop-Terminal (Shop-Ausbau, Vergrößerung & Deko)
    if (Math.hypot(this.playerX - WORKBENCH_POS.x, this.playerY - WORKBENCH_POS.y) < 38) {
      this.activePrompt = {
        label: '[E] Shop-Ausbau & Vergrößerung',
        x: WORKBENCH_POS.x + 16,
        y: WORKBENCH_POS.y - 26,
      };
      if (input.interactPressed()) {
        sound.playUiClick();
        this.callbacks.onOpenWorkbench();
      }
      return;
    }

    // 7. Lagertruhe (blue steel chest upper-right)
    if (Math.hypot(this.playerX - CHEST_POS.x, this.playerY - CHEST_POS.y) < 28) {
      this.activePrompt = {
        label: `[E] Lagertruhe (${this.state.getStats().chestCapacity} Slots)`,
        x: CHEST_POS.x,
        y: CHEST_POS.y - 18,
      };
      if (input.interactPressed()) {
        sound.playUiClick();
        this.callbacks.onOpenChest();
      }
      return;
    }

    // 8. Exit Airlock to Port Solaris Promenade (Schmiede, Med-Bay & Warp-Gate!)
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

    // 9. Shop Open/Close Door (bottom airlock hatch)
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
    const isNight = this.state.timeOfDay === 'night';
    const shopTier = this.state.upgrades.shopTier ?? 0;
    const shopBg =
      shopTier >= 2
        ? (art.shopBgT3 ?? art.shopBgT2 ?? art.shopBg)
        : shopTier === 1
          ? (art.shopBgT2 ?? art.shopBg)
          : art.shopBg;

    // 1. High-craft Tiered Moonlighter Space-Shop Room Backdrop (960x540 rendered 1:1!)
    if (shopBg) {
      ctx.drawImage(shopBg, 0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    } else {
      ctx.fillStyle = '#1b1d2b';
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    }

    // Real Day / Night Atmospheric Lighting Wash
    if (isNight) {
      ctx.fillStyle = 'rgba(10, 16, 44, 0.25)';
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    } else {
      ctx.fillStyle = 'rgba(255, 224, 150, 0.045)';
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    }

    // 2. Living Atmospheric Overlays on Top of Room Art
    // Subtle twinkling star glints inside the panoramic nebula window
    for (const s of this.windowStars) {
      const a = 0.25 + 0.75 * Math.max(0, Math.sin(this.time * 2.8 + s.phase));
      ctx.fillStyle = `rgba(255, 252, 224, ${a * (isNight ? 1.0 : 0.75)})`;
      ctx.fillRect(s.x, s.y, isNight ? 1.8 : 1.4, isNight ? 1.8 : 1.4);
    }

    // Pulsing cyan holographic glows on Counter, Shop-Ausbau Terminal, and Promenade Exit
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 4.2);
    const nightBoost = isNight ? 0.1 : 0;
    drawGlow(ctx, 206, 146, 22, '#38e8d4', 0.14 + nightBoost + pulse * 0.08);
    drawGlow(ctx, 240, 156, 24, '#38e8d4', 0.12 + nightBoost + pulse * 0.06);
    drawGlow(ctx, 64, 132, 32, '#38e8d4', 0.16 + nightBoost + pulse * 0.08);
    drawGlow(ctx, 444, 152, 42 + pulse * 6, '#38e8d4', 0.28 + nightBoost + pulse * 0.14);

    // Subtle crisp status pills (Door, Promenade, Shop-Ausbau, Auftrags-Pinnwand!)
    this.renderStationBadges(ctx, pulse);

    // Sleek retractable holographic laser filament on the baked right-side counter opening!
    this.renderCounterGate(ctx, pulse);

    // 3. Depth-Sorted Dynamic Entities (Sleep Pod, Sale-Box, Pedestals, Customers, Player)
    type Drawable = { y: number; draw: () => void };
    const drawables: Drawable[] = [];

    // Chrono-Ruhekapsel (Sleep Pod) upper-left
    drawables.push({
      y: SLEEP_POD_POS.y,
      draw: () => this.renderSleepPod(ctx, pulse),
    });

    // Unlocked Sonderangebots-Kiste (Sale-Box, Stufe II+)
    if (this.state.getStats().hasSaleBox) {
      drawables.push({
        y: SALE_BOX_POS.y,
        draw: () => this.renderSaleBox(ctx, pulse),
      });
    }

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

    // 3D Perspective Occlusion: when hero stands BEHIND the counter, draw the front counter lip in front!
    if (shopBg && this.playerY < 156 && this.playerX > 180 && this.playerX < 306) {
      // Exact slice of front counter masonry & checkout console from active 960x540 tier backdrop (2x scale)
      ctx.drawImage(shopBg, 174 * 2, 150 * 2, 136 * 2, 32 * 2, 174, 150, 136, 32);
      // Re-draw any customer or Sale-Box directly in front of the counter so depth stays crisp
      if (this.state.getStats().hasSaleBox) {
        this.renderSaleBox(ctx, pulse);
      }
      for (const c of this.customers) {
        if (c.y >= 174 && c.x > 168 && c.x < 316) {
          this.renderCustomer(ctx, c);
        }
      }
    }

    // 4. Warm Cozy Lighting Aura, Unlocked Shop Decor Lanterns & Dust Motes
    const auraLevel = this.state.upgrades.shopAura ?? 0;
    const scannerLevel = this.state.upgrades.shopScanner ?? 0;
    drawGlow(ctx, 118, 92, 56, '#fbbf24', 0.11 + nightBoost + auraLevel * 0.06);
    drawGlow(ctx, 368, 92, 56, '#fbbf24', 0.11 + nightBoost + auraLevel * 0.06);

    if (auraLevel >= 1) {
      // Visible floating warm Holo-Lanterns flanking the shop!
      const lanterns = [
        { x: 156, y: 108, phase: 0 },
        { x: 324, y: 108, phase: 1.8 },
      ];
      for (const l of lanterns) {
        const bob = Math.sin(this.time * 3.1 + l.phase) * 2.2;
        drawGlow(ctx, l.x, l.y + bob, 26, '#fbbf24', 0.34 + nightBoost);
        ctx.fillStyle = '#475569';
        ctx.fillRect(l.x - 3, l.y - 5 + bob, 6, 2);
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(l.x - 3.5, l.y - 3 + bob, 7, 7);
        ctx.fillStyle = '#fef3c7';
        ctx.fillRect(l.x - 2, l.y - 1.5 + bob, 4, 4);
      }
    }
    if (auraLevel >= 2) {
      // VIP Star-Lounge orbiting golden-cyan crystal ornaments flanking the panoramic window
      const crystals = [
        { x: 158, y: 84, phase: 0.7 },
        { x: 322, y: 84, phase: 2.5 },
      ];
      for (const cr of crystals) {
        const bob = Math.sin(this.time * 4 + cr.phase) * 2.5;
        drawGlow(ctx, cr.x, cr.y + bob, 20, '#38e8d4', 0.32 + nightBoost);
        ctx.fillStyle = '#38e8d4';
        ctx.beginPath();
        ctx.moveTo(cr.x, cr.y - 5 + bob);
        ctx.lineTo(cr.x + 3.5, cr.y + bob);
        ctx.lineTo(cr.x, cr.y + 5 + bob);
        ctx.lineTo(cr.x - 3.5, cr.y + bob);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(cr.x - 0.8, cr.y - 2 + bob, 1.6, 2);
      }
    }
    if (scannerLevel >= 1) {
      drawGlow(ctx, 240, 152, 26, '#34d399', 0.16 + pulse * 0.08);
    }

    for (const m of this.dustMotes) {
      const mx = m.x + Math.sin(this.time * 0.7 + m.phase) * 8;
      const my = m.y - ((this.time * m.speed + m.phase * 15) % 85) + 40;
      const alpha = 0.2 + 0.35 * Math.sin(this.time * 2 + m.phase);
      ctx.fillStyle = isNight
        ? `rgba(165, 243, 252, ${Math.max(0, alpha)})`
        : `rgba(255, 240, 195, ${Math.max(0, alpha)})`;
      ctx.fillRect(mx, my, 1, 1);
    }

    // 5. Particles
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    // 6. Floating Credit & Thief Popups
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

  private renderSleepPod(ctx: CanvasRenderingContext2D, pulse: number): void {
    const art = getHDArt();
    const x = SLEEP_POD_POS.x;
    const y = SLEEP_POD_POS.y;
    const isNight = this.state.timeOfDay === 'night';

    drawPixelShadow(ctx, x, y + 9, 12, 4, 0.45);
    drawGlow(ctx, x, y - 2, 20, isNight ? '#818cf8' : '#38e8d4', 0.2 + pulse * 0.08);
    if (art.propSleepPod) {
      ctx.drawImage(art.propSleepPod, x - 13, y - 16, 26, 26);
    } else {
      ctx.fillStyle = '#334155';
      ctx.fillRect(x - 10, y - 8, 20, 14);
      ctx.fillStyle = '#38e8d4';
      ctx.fillRect(x - 7, y - 5, 14, 7);
    }
  }

  private renderSaleBox(ctx: CanvasRenderingContext2D, pulse: number): void {
    const art = getHDArt();
    const x = SALE_BOX_POS.x;
    const y = SALE_BOX_POS.y;
    const count = this.state.countSaleBoxItems();

    drawPixelShadow(ctx, x, y + 9, 11, 3.6, 0.46);
    drawGlow(ctx, x, y - 2, 18, '#fb923c', (count > 0 ? 0.3 : 0.14) + pulse * 0.08);
    if (art.propSaleBox) {
      ctx.drawImage(art.propSaleBox, x - 11, y - 14, 22, 23);
    } else {
      ctx.fillStyle = '#92400e';
      ctx.fillRect(x - 9, y - 7, 18, 14);
    }

    // Compact amber "SALE" / stock count badge
    ctx.font = 'bold 5px Silkscreen, monospace';
    ctx.textAlign = 'center';
    const tag = count > 0 ? `SALE ×${count}` : 'SALE';
    const tw = Math.max(24, Math.ceil(ctx.measureText(tag).width) + 6);
    ctx.fillStyle = 'rgba(20, 14, 10, 0.92)';
    ctx.fillRect(x - tw / 2, y + 8, tw, 8);
    ctx.strokeStyle = count > 0 ? '#fbbf24' : '#94a3b8';
    ctx.lineWidth = 0.7;
    ctx.strokeRect(x - tw / 2, y + 8, tw, 8);
    ctx.fillStyle = count > 0 ? '#fde047' : '#cbd5e1';
    ctx.fillText(tag, x, y + 14);
  }

  private renderStationBadges(ctx: CanvasRenderingContext2D, pulse: number): void {
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
    const gx = 418;
    const gy = 116;
    ctx.fillStyle = 'rgba(12, 18, 32, 0.88)';
    ctx.fillRect(gx - 28, gy - 5, 56, 10);
    ctx.strokeStyle = '#38e8d4';
    ctx.lineWidth = 0.8;
    ctx.strokeRect(gx - 28, gy - 5, 56, 10);
    ctx.fillStyle = '#38e8d4';
    ctx.fillText('PROMENADE', gx, gy + 2);

    // Subtle Astro-Barter Shop-Ausbau badge above left holographic console
    const tx = 68;
    const ty = 104;
    ctx.fillStyle = 'rgba(12, 18, 32, 0.88)';
    ctx.fillRect(tx - 30, ty - 5, 60, 10);
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 0.8;
    ctx.strokeRect(tx - 30, ty - 5, 60, 10);
    ctx.fillStyle = '#fde047';
    ctx.fillText('SHOP-AUSBAU', tx, ty + 2);

    // Auftrags-Pinnwand (Bounties Board) compact pinned wall badge right below cork board
    const bx = BOUNTY_BOARD_POS.x - 4;
    const by = 82;
    const ready = this.state.hasReadyBounty();
    ctx.fillStyle = 'rgba(15, 22, 36, 0.92)';
    ctx.fillRect(bx - 22, by - 5, 44, 10);
    ctx.strokeStyle = ready ? '#4ade80' : '#fbbf24';
    ctx.lineWidth = 0.8;
    ctx.strokeRect(bx - 22, by - 5, 44, 10);
    ctx.fillStyle = ready ? '#4ade80' : '#fde047';
    ctx.fillText('AUFTRÄGE', bx, by + 2);

    if (ready) {
      const bob = Math.sin(this.time * 6) * 2;
      drawGlow(ctx, bx + 22, by - 6 + bob, 11, '#fbbf24', 0.45 + pulse * 0.25);
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(bx + 22, by - 6 + bob, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 6px Silkscreen, monospace';
      ctx.fillText('!', bx + 22, by - 4 + bob);
    }
  }

  private renderCounterGate(ctx: CanvasRenderingContext2D, pulse: number): void {
    // Architectural right-side counter opening is baked directly into shop_bg*.png!
    // Render ONLY a sleek retractable cyan holographic security filament between the two stone caps:
    const topY = 121;
    const botY = 146;
    const gx = 297;
    const closedFrac = Math.max(0, 1 - this.gateOpen);

    ctx.save();
    // Subtle micro emitter pins integrated flush into top & bottom counter end-caps
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(gx - 2, topY - 1, 4, 2.5);
    ctx.fillRect(gx - 2, botY - 1.5, 4, 2.5);
    ctx.fillStyle = closedFrac > 0.15 ? '#38e8d4' : '#4ade80';
    ctx.fillRect(gx - 1, topY - 0.5, 2, 1.5);
    ctx.fillRect(gx - 1, botY - 1, 2, 1.5);

    // Retracting dual-end laser filament (disappears seamlessly when player steps up!)
    if (closedFrac > 0.04) {
      const halfSpan = ((botY - topY) * 0.5) * closedFrac;
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(56, 232, 212, ${(0.28 + pulse * 0.22) * closedFrac})`;
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.moveTo(gx, topY);
      ctx.lineTo(gx, topY + halfSpan);
      ctx.moveTo(gx, botY);
      ctx.lineTo(gx, botY - halfSpan);
      ctx.stroke();

      ctx.strokeStyle = `rgba(224, 255, 255, ${(0.72 + pulse * 0.25) * closedFrac})`;
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(gx, topY);
      ctx.lineTo(gx, topY + halfSpan);
      ctx.moveTo(gx, botY);
      ctx.lineTo(gx, botY - halfSpan);
      ctx.stroke();
    }
    ctx.restore();

    // Soft pulsing checkout mat inside the counter booth when a customer is waiting!
    const waitingCustomer = this.customers.find((c) => c.state === 'waiting_checkout');
    if (waitingCustomer) {
      const behind = this.isBehindCounter();
      ctx.save();
      ctx.strokeStyle = behind ? '#4ade80' : '#fde047';
      ctx.lineWidth = 1.2;
      ctx.globalAlpha = 0.5 + pulse * 0.45;
      ctx.beginPath();
      ctx.ellipse(240, 138, 12 + pulse * 2, 7 + pulse, 0, 0, Math.PI * 2);
      ctx.stroke();
      drawGlow(ctx, 240, 138, 20, behind ? '#4ade80' : '#fbbf24', 0.25 + pulse * 0.14);

      if (!behind) {
        // Gentle pulsing entry arrow right at the open counter entrance!
        const shift = Math.sin(this.time * 8) * 2.5;
        ctx.fillStyle = '#4ade80';
        ctx.font = 'bold 7px Silkscreen, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('◀', 311 + shift, 136);
      }
      ctx.restore();
    }
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
    const tilt = walking ? Math.sin(c.walkAnim) * (c.state === 'fleeing' ? 0.12 : 0.06) : 0;

    // Flashing red capture ring beneath fleeing Space Thief!
    if (c.isThief && c.state === 'fleeing') {
      const alertPulse = 0.5 + 0.5 * Math.sin(this.time * 20);
      ctx.save();
      ctx.strokeStyle = `rgba(251, 113, 133, ${0.55 + alertPulse * 0.45})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(c.x, c.y + 10, 12 + alertPulse * 3, 5 + alertPulse * 1.5, 0, 0, Math.PI * 2);
      ctx.stroke();
      drawGlow(ctx, c.x, c.y, 18, '#fb7185', 0.25 + alertPulse * 0.2);
      ctx.restore();
    } else if (c.isThief && c.state === 'stealing') {
      drawGlow(ctx, c.x, c.y, 16, '#c084fc', 0.35);
    }

    drawPixelShadow(ctx, c.x, c.y + 11, 8, 3.2, 0.48);

    const thiefSpr = c.isThief ? art.custThief : null;
    if (thiefSpr) {
      ctx.save();
      ctx.translate(c.x, c.y + 10 - bob);
      ctx.rotate(tilt);
      ctx.drawImage(thiefSpr, -11, -26, 22, 28);
      ctx.restore();
    } else if (art.customers.length > 0) {
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

    // Carried item (either buying or stolen loot!)
    if (c.carriedItemId) {
      const itemSpr = art.items[c.carriedItemId] ?? atlas.items[c.carriedItemId];
      if (itemSpr) {
        ctx.drawImage(itemSpr, c.x - 7, c.y - 24 - bob, 14, 14);
      }
    }

    // Space Thief warning & fleeing alert badge!
    if (c.isThief && (c.state === 'stealing' || c.state === 'fleeing')) {
      const ebob = Math.sin(this.time * 14) * 1.8;
      const isFlee = c.state === 'fleeing';
      ctx.fillStyle = isFlee ? 'rgba(136, 19, 55, 0.95)' : 'rgba(59, 7, 100, 0.92)';
      ctx.fillRect(c.x - 16, c.y - 36 + ebob, 32, 9);
      ctx.strokeStyle = isFlee ? '#fb7185' : '#c084fc';
      ctx.lineWidth = 0.8;
      ctx.strokeRect(c.x - 16, c.y - 36 + ebob, 32, 9);
      ctx.fillStyle = isFlee ? '#fff1f2' : '#e9d5ff';
      ctx.font = 'bold 5px Silkscreen, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(isFlee ? 'DIEB!' : '⚠ ...', c.x, c.y - 29.5 + ebob);
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
