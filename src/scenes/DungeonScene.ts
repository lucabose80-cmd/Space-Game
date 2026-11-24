import { getHDArt } from '../assets/artLoader';
import { drawGlow, drawPixelShadow } from '../assets/pixelArt';
import { getAtlas } from '../assets/sprites';
import { getItemDef, rollLootItem } from '../data/items';
import { sound } from '../engine/audio';
import { VIRTUAL_HEIGHT, VIRTUAL_WIDTH, type InputManager } from '../engine/input';
import type { GameState } from '../systems/gameState';
import {
  addItemToBackpack,
  isBackpackFullFor,
  processDefeatPenalty,
  processSafeReturnEffects,
} from '../systems/inventory';
import type { Direction, RunSummary } from '../types';
import {
  generateSector1Dungeon,
  ROOM_BOTTOM,
  ROOM_CENTER_X,
  ROOM_CENTER_Y,
  ROOM_LEFT,
  ROOM_RIGHT,
  ROOM_TOP,
  roomKey,
  type DoorSide,
  type DungeonFloor,
  type DungeonRoom,
} from '../world/dungeonGen';

interface Enemy {
  id: number;
  kind: 'slime' | 'drone' | 'turret' | 'boss';
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  radius: number;
  flashTimer: number;
  aiTimer: number;
  phase: number;
  chargeDirX: number;
  chargeDirY: number;
  chargeActive: number;
  telegraphTimer: number;
  summonThreshold: number;
  anim: number;
}

interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fromPlayer: boolean;
  damage: number;
  color: string;
  radius: number;
  life: number;
}

interface LootDrop {
  x: number;
  y: number;
  vx: number;
  vy: number;
  itemId: string;
  age: number;
}

interface SlashArc {
  x: number;
  y: number;
  angle: number;
  radius: number;
  sweep: number;
  comboStep: number;
  life: number;
  maxLife: number;
}

interface Afterimage {
  x: number;
  y: number;
  facing: Direction;
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

interface FloatingNum {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

export interface DungeonCallbacks {
  onReturnToShop: (summary: RunSummary) => void;
  onToast: (msg: string, tone?: 'info' | 'good' | 'warn') => void;
  onHudDirty: () => void;
}

export class DungeonScene {
  private state: GameState;
  private callbacks: DungeonCallbacks;

  private floor: DungeonFloor = generateSector1Dungeon(8);
  public currentRoom!: DungeonRoom;

  public playerX = ROOM_CENTER_X;
  public playerY = ROOM_CENTER_Y;
  private facing: Direction = 'down';
  private walkAnim = 0;

  // Combat state
  private dashTimer = 0;
  private dashCooldown = 0;
  private dashVx = 0;
  private dashVy = 0;
  private invulnTimer = 0;
  private playerFlashTimer = 0;

  private meleeCooldown = 0;
  private comboStep = 0;
  private comboResetTimer = 0;
  private blasterCooldown = 0;

  // Warp-Beacon channel
  private warpChannel = 0;
  private readonly warpDuration = 1.25;
  private readonly warpCost = 20;

  // Room entities
  private enemies: Enemy[] = [];
  private projectiles: Projectile[] = [];
  private drops: LootDrop[] = [];
  private slashes: SlashArc[] = [];
  private afterimages: Afterimage[] = [];
  private particles: Particle[] = [];
  private floats: FloatingNum[] = [];
  private nextEnemyId = 1;

  // Juice & transitions
  private hitStop = 0;
  private shakeTimer = 0;
  private shakeMag = 0;
  private roomFade = 0;
  private time = 0;

  // Run telemetry
  private roomsCleared = 0;
  private enemiesDefeated = 0;
  private bossDefeatedInRun = false;
  private finished = false;

  public activePrompt: { label: string; x: number; y: number } | null = null;

  constructor(state: GameState, callbacks: DungeonCallbacks) {
    this.state = state;
    this.callbacks = callbacks;
  }

  public startRun(): void {
    this.floor = generateSector1Dungeon(8);
    this.state.restoreFullVitals();
    this.roomsCleared = 0;
    this.enemiesDefeated = 0;
    this.bossDefeatedInRun = false;
    this.finished = false;
    this.warpChannel = 0;
    this.invulnTimer = 0.5;
    this.dashCooldown = 0;
    this.dashTimer = 0;
    this.meleeCooldown = 0;
    this.blasterCooldown = 0;
    this.enterRoom(this.floor.startKey, null);
    this.spawnBurst(this.playerX, this.playerY, '#38e8d4', 20);
    this.callbacks.onToast(
      'Sektor 1: Verlassene Korvette — Finde den Schatzraum & den Core-Wächter MK-IV!',
      'info',
    );
    this.callbacks.onHudDirty();
  }

  private enterRoom(key: string, enteredFrom: DoorSide | null): void {
    const room = this.floor.rooms.get(key);
    if (!room) return;
    this.currentRoom = room;
    room.visited = true;

    this.enemies = [];
    this.projectiles = [];
    this.drops = [];
    this.slashes = [];
    this.afterimages = [];
    this.roomFade = 0.22;

    if (enteredFrom === 'north') {
      this.playerX = ROOM_CENTER_X;
      this.playerY = ROOM_TOP + 18;
      this.facing = 'down';
    } else if (enteredFrom === 'south') {
      this.playerX = ROOM_CENTER_X;
      this.playerY = ROOM_BOTTOM - 18;
      this.facing = 'up';
    } else if (enteredFrom === 'west') {
      this.playerX = ROOM_LEFT + 18;
      this.playerY = ROOM_CENTER_Y;
      this.facing = 'right';
    } else if (enteredFrom === 'east') {
      this.playerX = ROOM_RIGHT - 18;
      this.playerY = ROOM_CENTER_Y;
      this.facing = 'left';
    } else {
      this.playerX = ROOM_CENTER_X;
      this.playerY = ROOM_CENTER_Y + 18;
      this.facing = 'up';
    }

    // Spawn enemies if room is not yet cleared
    if (!room.cleared) {
      for (const sp of room.spawns) {
        this.spawnEnemy(sp.kind, sp.x, sp.y);
      }
      if (room.type === 'boss') {
        sound.playBossRoar();
        this.triggerShake(0.35, 4);
        this.callbacks.onToast('ACHTUNG: Core-Wächter MK-IV erwacht!', 'warn');
      }
    }
  }

  private spawnEnemy(kind: Enemy['kind'], x: number, y: number): void {
    const baseScale = 1 + this.state.bossDefeatedCount * 0.12;
    if (kind === 'slime') {
      const hp = Math.round(38 * baseScale);
      this.enemies.push({
        id: this.nextEnemyId++,
        kind,
        x,
        y,
        vx: 0,
        vy: 0,
        hp,
        maxHp: hp,
        radius: 7,
        flashTimer: 0,
        aiTimer: 0.6 + Math.random() * 0.7,
        phase: 0,
        chargeDirX: 0,
        chargeDirY: 0,
        chargeActive: 0,
        telegraphTimer: 0,
        summonThreshold: 0,
        anim: Math.random() * 5,
      });
    } else if (kind === 'drone') {
      const hp = Math.round(46 * baseScale);
      this.enemies.push({
        id: this.nextEnemyId++,
        kind,
        x,
        y,
        vx: 0,
        vy: 0,
        hp,
        maxHp: hp,
        radius: 7,
        flashTimer: 0,
        aiTimer: 1.0 + Math.random() * 0.8,
        phase: Math.random() * Math.PI * 2,
        chargeDirX: 0,
        chargeDirY: 0,
        chargeActive: 0,
        telegraphTimer: 0,
        summonThreshold: 0,
        anim: 0,
      });
    } else if (kind === 'turret') {
      const hp = Math.round(62 * baseScale);
      this.enemies.push({
        id: this.nextEnemyId++,
        kind,
        x,
        y,
        vx: 0,
        vy: 0,
        hp,
        maxHp: hp,
        radius: 8,
        flashTimer: 0,
        aiTimer: 1.4 + Math.random() * 0.6,
        phase: 0,
        chargeDirX: 0,
        chargeDirY: 0,
        chargeActive: 0,
        telegraphTimer: 0,
        summonThreshold: 0,
        anim: 0,
      });
    } else {
      // BOSS: Core-Wächter MK-IV
      const hp = Math.round(340 * baseScale);
      this.enemies.push({
        id: this.nextEnemyId++,
        kind: 'boss',
        x,
        y,
        vx: 0,
        vy: 0,
        hp,
        maxHp: hp,
        radius: 14,
        flashTimer: 0,
        aiTimer: 1.4,
        phase: 0,
        chargeDirX: 0,
        chargeDirY: 0,
        chargeActive: 0,
        telegraphTimer: 0,
        summonThreshold: 0.6,
        anim: 0,
      });
    }
  }

  public update(dt: number, input: InputManager): void {
    if (this.finished) return;
    this.time += dt;
    this.roomFade = Math.max(0, this.roomFade - dt);

    if (this.shakeTimer > 0) {
      this.shakeTimer = Math.max(0, this.shakeTimer - dt);
    }

    if (this.hitStop > 0) {
      this.hitStop -= dt;
      this.updateEffects(dt * 0.25);
      return;
    }

    // Regenerate energy
    const prevEnergy = Math.floor(this.state.energy);
    this.state.energy = Math.min(100, this.state.energy + 18 * dt);
    if (Math.floor(this.state.energy) !== prevEnergy) {
      this.callbacks.onHudDirty();
    }

    this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    this.playerFlashTimer = Math.max(0, this.playerFlashTimer - dt);
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    this.meleeCooldown = Math.max(0, this.meleeCooldown - dt);
    this.blasterCooldown = Math.max(0, this.blasterCooldown - dt);
    if (this.comboResetTimer > 0) {
      this.comboResetTimer -= dt;
      if (this.comboResetTimer <= 0) this.comboStep = 0;
    }

    this.updatePlayer(dt, input);
    this.updateEnemies(dt);
    this.updateProjectiles(dt);
    this.updateDrops(dt);
    this.updateRoomInteractions(input);
    this.updateEffects(dt);
  }

  private getAimAngle(input: InputManager): number {
    if (input.isMouseActive()) {
      const m = input.getMousePos();
      return Math.atan2(m.y - this.playerY, m.x - this.playerX);
    }

    // Smart auto-aim on touch / keyboard-only: lock onto nearest enemy in range!
    let bestDist = 175;
    let bestAngle: number | null = null;
    for (const e of this.enemies) {
      const d = Math.hypot(e.x - this.playerX, e.y - this.playerY);
      if (d < bestDist) {
        bestDist = d;
        bestAngle = Math.atan2(e.y - this.playerY, e.x - this.playerX);
      }
    }
    if (bestAngle !== null) return bestAngle;

    // If no enemies nearby, softly aim toward an intact alien pod within reach
    let podDist = 56;
    for (const pod of this.currentRoom.pods) {
      if (pod.broken) continue;
      const d = Math.hypot(pod.x - this.playerX, pod.y - this.playerY);
      if (d < podDist) {
        podDist = d;
        bestAngle = Math.atan2(pod.y - this.playerY, pod.x - this.playerX);
      }
    }
    if (bestAngle !== null) return bestAngle;

    const mv = input.getMoveVector();
    if (Math.hypot(mv.x, mv.y) > 0.2) {
      return Math.atan2(mv.y, mv.x);
    }

    if (this.facing === 'right') return 0;
    if (this.facing === 'down') return Math.PI / 2;
    if (this.facing === 'left') return Math.PI;
    return -Math.PI / 2;
  }

  private updatePlayer(dt: number, input: InputManager): void {
    const move = input.getMoveVector();

    // Warp-Beacon channeling (hold R when safe or even in combat!)
    if (input.warpHeld() && this.dashTimer <= 0) {
      this.warpChannel += dt;
      if (Math.random() < dt * 16) {
        const a = Math.random() * Math.PI * 2;
        this.particles.push({
          x: this.playerX + Math.cos(a) * 16,
          y: this.playerY + Math.sin(a) * 16,
          vx: -Math.cos(a) * 28,
          vy: -Math.sin(a) * 28,
          color: '#38e8d4',
          size: 2,
          life: 0.35,
          maxLife: 0.35,
        });
      }
      if (this.warpChannel >= this.warpDuration) {
        this.triggerSafeWarp('warp', true);
        return;
      }
      return;
    } else {
      this.warpChannel = Math.max(0, this.warpChannel - dt * 2.5);
    }

    // Stimpack healing (Q)
    if (input.healPressed()) {
      const stats = this.state.getStats();
      if (this.state.stimCharges > 0 && this.state.hp < stats.maxHp) {
        this.state.stimCharges -= 1;
        const heal = stats.stimHeal;
        this.state.hp = Math.min(stats.maxHp, this.state.hp + heal);
        sound.playHeal();
        this.spawnBurst(this.playerX, this.playerY, '#4ade80', 14);
        this.floats.push({
          x: this.playerX,
          y: this.playerY - 14,
          text: `+${heal} HP`,
          color: '#4ade80',
          life: 1.0,
          maxLife: 1.0,
        });
        this.callbacks.onHudDirty();
      } else if (this.state.stimCharges <= 0) {
        this.callbacks.onToast('Keine Stimpacks mehr übrig!', 'warn');
      }
    }

    // Jetpack Dash (Space)
    if (input.dashPressed() && this.dashCooldown <= 0) {
      let dx = move.x;
      let dy = move.y;
      if (dx === 0 && dy === 0) {
        const angle = this.getAimAngle(input);
        dx = Math.cos(angle);
        dy = Math.sin(angle);
      }
      this.dashTimer = 0.19;
      this.dashCooldown = 0.54;
      this.invulnTimer = Math.max(this.invulnTimer, 0.28);
      this.dashVx = dx * 255;
      this.dashVy = dy * 255;
      sound.playDash();
      this.spawnBurst(this.playerX, this.playerY + 4, '#fb923c', 8);
    }

    let vx = move.x * 108;
    let vy = move.y * 108;

    if (this.dashTimer > 0) {
      this.dashTimer -= dt;
      vx = this.dashVx;
      vy = this.dashVy;
      if (Math.random() < 0.7) {
        this.afterimages.push({
          x: this.playerX,
          y: this.playerY,
          facing: this.facing,
          life: 0.16,
          maxLife: 0.16,
        });
      }
    }

    if (Math.abs(vx) > 1 || Math.abs(vy) > 1) {
      this.walkAnim += dt * 10;
      if (Math.abs(vx) > Math.abs(vy)) {
        this.facing = vx > 0 ? 'right' : 'left';
      } else {
        this.facing = vy > 0 ? 'down' : 'up';
      }
    } else {
      this.walkAnim = 0;
    }

    this.moveEntityWithCollisions(vx * dt, vy * dt);

    // Primary Melee: Plasma-Klinge (3-Hit Combo!)
    if (input.primaryPressed() && this.meleeCooldown <= 0 && this.dashTimer <= 0) {
      this.performPlasmaSlash(this.getAimAngle(input));
    }

    // Secondary Ranged: Puls-Blaster
    if ((input.secondaryPressed() || input.secondaryHeld()) && this.blasterCooldown <= 0 && this.dashTimer <= 0) {
      this.performBlasterShot(this.getAimAngle(input));
    }

    // Check walking through OPEN airlock doors!
    if (this.currentRoom.cleared) {
      this.checkDoorTransition();
    }
  }

  private performPlasmaSlash(angle: number): void {
    const stats = this.state.getStats();
    const isFinisher = this.comboStep === 2;
    const radius = isFinisher ? stats.bladeRange * 1.24 : stats.bladeRange;
    const sweep = isFinisher ? Math.PI * 1.45 : Math.PI * 0.78;
    const damage = isFinisher ? Math.round(stats.bladeDamage * 1.45) : stats.bladeDamage;

    // Orient facing toward attack
    if (Math.abs(Math.cos(angle)) > Math.abs(Math.sin(angle))) {
      this.facing = Math.cos(angle) > 0 ? 'right' : 'left';
    } else {
      this.facing = Math.sin(angle) > 0 ? 'down' : 'up';
    }

    // Slight forward lunge
    this.moveEntityWithCollisions(Math.cos(angle) * 6, Math.sin(angle) * 6);

    sound.playSlash(this.comboStep);
    this.slashes.push({
      x: this.playerX,
      y: this.playerY,
      angle,
      radius,
      sweep,
      comboStep: this.comboStep,
      life: isFinisher ? 0.2 : 0.14,
      maxLife: isFinisher ? 0.2 : 0.14,
    });

    // Hit enemies in arc
    let hitAny = false;
    for (const e of this.enemies) {
      const dx = e.x - this.playerX;
      const dy = e.y - this.playerY;
      const dist = Math.hypot(dx, dy);
      if (dist > radius + e.radius) continue;
      const diff = Math.abs(this.normalizeAngle(Math.atan2(dy, dx) - angle));
      if (diff <= sweep / 2 + 0.24 || dist < e.radius + 8) {
        this.damageEnemy(e, damage, Math.cos(angle), Math.sin(angle), isFinisher ? 150 : 95);
        hitAny = true;
      }
    }

    // Hit destructible Frachtkapseln
    for (const pod of this.currentRoom.pods) {
      if (pod.broken) continue;
      const dist = Math.hypot(pod.x - this.playerX, pod.y - this.playerY);
      if (dist <= radius + 10) {
        this.breakPod(pod);
        hitAny = true;
      }
    }

    if (hitAny) {
      this.hitStop = isFinisher ? 0.05 : 0.025;
      this.triggerShake(isFinisher ? 0.16 : 0.09, isFinisher ? 3.2 : 1.6);
      this.state.energy = Math.min(100, this.state.energy + 10);
      this.callbacks.onHudDirty();
    }

    this.meleeCooldown = isFinisher ? 0.34 : 0.2;
    this.comboStep = (this.comboStep + 1) % 3;
    this.comboResetTimer = 0.62;
  }

  private performBlasterShot(angle: number): void {
    const stats = this.state.getStats();
    if (this.state.energy < stats.blasterEnergyCost) return;

    this.state.energy -= stats.blasterEnergyCost;
    this.blasterCooldown = stats.blasterCooldown;
    sound.playBlaster();

    const speed = 260 + this.state.upgrades.blaster * 22;
    this.projectiles.push({
      x: this.playerX + Math.cos(angle) * 9,
      y: this.playerY + Math.sin(angle) * 9,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      fromPlayer: true,
      damage: stats.blasterDamage,
      color: '#38e8d4',
      radius: 3.5,
      life: 1.4,
    });
    this.callbacks.onHudDirty();
  }

  private moveEntityWithCollisions(dx: number, dy: number): void {
    const r = 6;
    const nx = Math.max(ROOM_LEFT + r, Math.min(ROOM_RIGHT - r, this.playerX + dx));
    if (!this.collidesRoomObstacle(nx, this.playerY, r)) {
      this.playerX = nx;
    }
    const ny = Math.max(ROOM_TOP + r, Math.min(ROOM_BOTTOM - r, this.playerY + dy));
    if (!this.collidesRoomObstacle(this.playerX, ny, r)) {
      this.playerY = ny;
    }
  }

  private collidesRoomObstacle(x: number, y: number, r: number): boolean {
    for (const ob of this.currentRoom.obstacles) {
      if (x + r > ob.x && x - r < ob.x + ob.w && y + r > ob.y && y - r < ob.y + ob.h) {
        return true;
      }
    }
    return false;
  }

  private checkDoorTransition(): void {
    const r = this.currentRoom;
    const doorHalf = 18;

    if (r.doors.north && Math.abs(this.playerX - ROOM_CENTER_X) < doorHalf && this.playerY <= ROOM_TOP + 8) {
      this.enterRoom(roomKey(r.gx, r.gy - 1), 'south');
    } else if (r.doors.south && Math.abs(this.playerX - ROOM_CENTER_X) < doorHalf && this.playerY >= ROOM_BOTTOM - 8) {
      this.enterRoom(roomKey(r.gx, r.gy + 1), 'north');
    } else if (r.doors.west && Math.abs(this.playerY - ROOM_CENTER_Y) < doorHalf && this.playerX <= ROOM_LEFT + 8) {
      this.enterRoom(roomKey(r.gx - 1, r.gy), 'east');
    } else if (r.doors.east && Math.abs(this.playerY - ROOM_CENTER_Y) < doorHalf && this.playerX >= ROOM_RIGHT - 8) {
      this.enterRoom(roomKey(r.gx + 1, r.gy), 'west');
    }
  }

  private updateEnemies(dt: number): void {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.anim += dt * 6;
      e.flashTimer = Math.max(0, e.flashTimer - dt);

      // Apply knockback decay
      e.vx *= Math.pow(0.02, dt);
      e.vy *= Math.pow(0.02, dt);

      const dx = this.playerX - e.x;
      const dy = this.playerY - e.y;
      const dist = Math.max(1, Math.hypot(dx, dy));
      const nx = dx / dist;
      const ny = dy / dist;

      if (e.kind === 'slime') {
        e.aiTimer -= dt;
        if (e.aiTimer <= 0) {
          // Hop lunge toward player
          e.vx += nx * 125;
          e.vy += ny * 125;
          e.aiTimer = 1.05 + Math.random() * 0.45;
        }
      } else if (e.kind === 'drone') {
        e.phase += dt * 1.6;
        // Orbit around ~85px from player
        const desiredDist = 88;
        const radial = dist > desiredDist ? 1 : dist < 58 ? -1 : 0;
        const tx = -ny * Math.sin(e.phase) * 34 + nx * radial * 46;
        const ty = nx * Math.sin(e.phase) * 34 + ny * radial * 46;
        e.vx += tx * dt * 4;
        e.vy += ty * dt * 4;

        e.aiTimer -= dt;
        if (e.telegraphTimer > 0) {
          e.telegraphTimer -= dt;
          if (e.telegraphTimer <= 0) {
            this.fireEnemyBolt(e.x, e.y, Math.atan2(dy, dx), 155, 14, '#e879f9');
            e.aiTimer = 1.7 + Math.random() * 0.6;
          }
        } else if (e.aiTimer <= 0) {
          e.telegraphTimer = 0.42;
        }
      } else if (e.kind === 'turret') {
        e.vx *= 0.2;
        e.vy *= 0.2;
        e.aiTimer -= dt;
        if (e.telegraphTimer > 0) {
          e.telegraphTimer -= dt;
          if (e.telegraphTimer <= 0) {
            const baseAngle = Math.atan2(dy, dx);
            for (const offset of [-0.28, 0, 0.28]) {
              this.fireEnemyBolt(e.x, e.y, baseAngle + offset, 138, 15, '#fb923c');
            }
            e.aiTimer = 2.1 + Math.random() * 0.5;
          }
        } else if (e.aiTimer <= 0) {
          e.telegraphTimer = 0.55;
        }
      } else if (e.kind === 'boss') {
        this.updateBossAI(e, dt, dx, dy, dist, nx, ny);
      }

      // Move enemy safely inside room
      const ex = Math.max(ROOM_LEFT + e.radius, Math.min(ROOM_RIGHT - e.radius, e.x + e.vx * dt));
      if (!this.collidesRoomObstacle(ex, e.y, e.radius * 0.85) || e.kind === 'drone') {
        e.x = ex;
      }
      const ey = Math.max(ROOM_TOP + e.radius, Math.min(ROOM_BOTTOM - e.radius, e.y + e.vy * dt));
      if (!this.collidesRoomObstacle(e.x, ey, e.radius * 0.85) || e.kind === 'drone') {
        e.y = ey;
      }

      // Contact damage to player
      const pDist = Math.hypot(this.playerX - e.x, this.playerY - e.y);
      if (pDist < e.radius + 6) {
        this.damagePlayer(e.kind === 'boss' ? 22 : 12, (this.playerX - e.x) / Math.max(1, pDist), (this.playerY - e.y) / Math.max(1, pDist));
      }
    }
  }

  private updateBossAI(
    e: Enemy,
    dt: number,
    dx: number,
    dy: number,
    _dist: number,
    nx: number,
    ny: number,
  ): void {
    const enraged = e.hp < e.maxHp * 0.5;

    // Minion call at 60% & 28% HP
    if (e.hp / e.maxHp <= e.summonThreshold && e.summonThreshold > 0) {
      e.summonThreshold = e.summonThreshold > 0.4 ? 0.28 : 0;
      sound.playBossRoar();
      this.spawnEnemy('slime', ROOM_CENTER_X - 80, ROOM_CENTER_Y);
      this.spawnEnemy('drone', ROOM_CENTER_X + 80, ROOM_CENTER_Y);
      this.spawnBurst(e.x, e.y, '#fbbf24', 18);
    }

    if (e.chargeActive > 0) {
      e.chargeActive -= dt;
      e.vx = e.chargeDirX * (enraged ? 220 : 185);
      e.vy = e.chargeDirY * (enraged ? 220 : 185);
      if (Math.random() < 0.6) {
        this.particles.push({
          x: e.x,
          y: e.y,
          vx: -e.chargeDirX * 30,
          vy: -e.chargeDirY * 30,
          color: '#fb923c',
          size: 2.5,
          life: 0.25,
          maxLife: 0.25,
        });
      }
      return;
    }

    if (e.telegraphTimer > 0) {
      e.telegraphTimer -= dt;
      if (e.telegraphTimer <= 0) {
        if (e.phase % 2 === 0) {
          // Radial plasma ring burst
          const count = enraged ? 14 : 10;
          const rot = Math.atan2(dy, dx);
          for (let k = 0; k < count; k++) {
            const a = rot + (k / count) * Math.PI * 2;
            this.fireEnemyBolt(e.x, e.y, a, enraged ? 132 : 112, 16, '#fb923c');
          }
          sound.playBlaster();
        } else {
          // Dash charge along locked telegraph direction
          e.chargeActive = 0.55;
          sound.playDash();
        }
        e.phase += 1;
        e.aiTimer = enraged ? 1.15 : 1.55;
      }
      return;
    }

    // Gentle hover drift toward player
    e.vx += nx * 36 * dt * 2.5;
    e.vy += ny * 36 * dt * 2.5;

    e.aiTimer -= dt;
    if (e.aiTimer <= 0) {
      e.telegraphTimer = e.phase % 2 === 1 ? 0.58 : 0.45;
      e.chargeDirX = nx;
      e.chargeDirY = ny;
    }
  }

  private fireEnemyBolt(
    x: number,
    y: number,
    angle: number,
    speed: number,
    damage: number,
    color: string,
  ): void {
    this.projectiles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      fromPlayer: false,
      damage,
      color,
      radius: 3.5,
      life: 2.8,
    });
  }

  private damageEnemy(e: Enemy, amount: number, kx: number, ky: number, knockForce: number): void {
    e.hp -= amount;
    e.flashTimer = 0.11;
    const resistance = e.kind === 'boss' ? 0.18 : e.kind === 'turret' ? 0.1 : 1.0;
    e.vx += kx * knockForce * resistance;
    e.vy += ky * knockForce * resistance;

    sound.playHit();
    this.spawnBurst(e.x, e.y, '#38e8d4', 6);
    this.floats.push({
      x: e.x + (Math.random() - 0.5) * 8,
      y: e.y - e.radius - 4,
      text: `${amount}`,
      color: '#f8fafc',
      life: 0.65,
      maxLife: 0.65,
    });

    if (e.hp <= 0) {
      this.onEnemyKilled(e);
    }
  }

  private onEnemyKilled(e: Enemy): void {
    const idx = this.enemies.indexOf(e);
    if (idx !== -1) this.enemies.splice(idx, 1);

    this.enemiesDefeated += 1;
    sound.playEnemyDefeat();
    this.spawnBurst(e.x, e.y, e.kind === 'boss' ? '#fbbf24' : '#c084fc', e.kind === 'boss' ? 32 : 14);

    if (e.kind === 'boss') {
      this.triggerShake(0.45, 5);
      this.bossDefeatedInRun = true;
      this.state.bossDefeatedCount += 1;
      // Guaranteed Boss Heart + 3 rare/uncommon relics!
      this.spawnLootDrop(e.x, e.y, 'mk4_heart');
      for (let k = 0; k < 3; k++) {
        this.spawnLootDrop(e.x, e.y, rollLootItem(2, k === 0));
      }
      this.callbacks.onToast(
        'SIEG! Core-Wächter MK-IV besiegt! Sammle den Loot und nutze das Sieges-Portal [E]!',
        'good',
      );
      this.state.save();
    } else {
      // Generous Moonlighter-style loot drop chance (78%)
      if (Math.random() < 0.78) {
        this.spawnLootDrop(e.x, e.y, rollLootItem(this.currentRoom.depth));
      }
    }

    // Check if room is now cleared!
    if (this.enemies.length === 0 && !this.currentRoom.cleared) {
      this.currentRoom.cleared = true;
      this.roomsCleared += 1;
      sound.playDoorUnlock();
      if (this.currentRoom.type === 'combat') {
        // Bonus loot orb on room clear
        this.spawnLootDrop(ROOM_CENTER_X, ROOM_CENTER_Y, rollLootItem(this.currentRoom.depth));
      }
    }
  }

  private damagePlayer(amount: number, kx: number, ky: number): void {
    if (this.invulnTimer > 0 || this.finished) return;
    this.state.hp = Math.max(0, this.state.hp - amount);
    this.invulnTimer = 0.75;
    this.playerFlashTimer = 0.16;
    this.warpChannel = 0;
    this.moveEntityWithCollisions(kx * 12, ky * 12);

    sound.playPlayerHurt();
    this.triggerShake(0.2, 3.5);
    this.spawnBurst(this.playerX, this.playerY, '#fb7185', 10);
    this.floats.push({
      x: this.playerX,
      y: this.playerY - 14,
      text: `-${amount}`,
      color: '#fb7185',
      life: 0.85,
      maxLife: 0.85,
    });
    this.callbacks.onHudDirty();

    if (this.state.hp <= 0) {
      this.triggerDefeat();
    }
  }

  private breakPod(pod: DungeonRoom['pods'][number]): void {
    pod.broken = true;
    sound.playHit();
    this.spawnBurst(pod.x, pod.y, '#fbbf24', 10);
    if (Math.random() < 0.65) {
      this.spawnLootDrop(pod.x, pod.y, rollLootItem(this.currentRoom.depth));
    }
  }

  private spawnLootDrop(x: number, y: number, itemId: string): void {
    const a = Math.random() * Math.PI * 2;
    const sp = 28 + Math.random() * 44;
    this.drops.push({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      itemId,
      age: 0,
    });
  }

  private updateProjectiles(dt: number): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;

      const hitWall =
        p.x < ROOM_LEFT ||
        p.x > ROOM_RIGHT ||
        p.y < ROOM_TOP ||
        p.y > ROOM_BOTTOM ||
        this.collidesRoomObstacle(p.x, p.y, p.radius);

      if (hitWall || p.life <= 0) {
        this.spawnBurst(p.x, p.y, p.color, 4);
        this.projectiles.splice(i, 1);
        continue;
      }

      if (p.fromPlayer) {
        let consumed = false;
        for (const e of this.enemies) {
          if (Math.hypot(e.x - p.x, e.y - p.y) < e.radius + p.radius) {
            const len = Math.max(1, Math.hypot(p.vx, p.vy));
            this.damageEnemy(e, p.damage, p.vx / len, p.vy / len, 55);
            consumed = true;
            break;
          }
        }
        if (!consumed) {
          for (const pod of this.currentRoom.pods) {
            if (!pod.broken && Math.hypot(pod.x - p.x, pod.y - p.y) < 10) {
              this.breakPod(pod);
              consumed = true;
              break;
            }
          }
        }
        if (consumed) {
          this.projectiles.splice(i, 1);
        }
      } else {
        if (Math.hypot(this.playerX - p.x, this.playerY - p.y) < 7 + p.radius) {
          const len = Math.max(1, Math.hypot(p.vx, p.vy));
          this.damagePlayer(p.damage, p.vx / len, p.vy / len);
          this.projectiles.splice(i, 1);
        }
      }
    }
  }

  private updateDrops(dt: number): void {
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.age += dt;
      d.vx *= Math.pow(0.04, dt);
      d.vy *= Math.pow(0.04, dt);
      d.x = Math.max(ROOM_LEFT + 8, Math.min(ROOM_RIGHT - 8, d.x + d.vx * dt));
      d.y = Math.max(ROOM_TOP + 8, Math.min(ROOM_BOTTOM - 8, d.y + d.vy * dt));

      const dist = Math.hypot(this.playerX - d.x, this.playerY - d.y);
      // Gentle magnetic pull when close and backpack has space
      if (d.age > 0.22 && dist < 44 && !isBackpackFullFor(this.state.inventory, d.itemId)) {
        d.x += ((this.playerX - d.x) / Math.max(1, dist)) * 135 * dt;
        d.y += ((this.playerY - d.y) / Math.max(1, dist)) * 135 * dt;
      }

      if (d.age > 0.22 && dist < 13) {
        const rem = addItemToBackpack(this.state.inventory, d.itemId, 1);
        if (rem === 0) {
          this.state.markDiscovered(d.itemId);
          const def = getItemDef(d.itemId);
          sound.playPickup();
          this.spawnBurst(d.x, d.y, def.glowColor, 6);
          this.floats.push({
            x: d.x,
            y: d.y - 10,
            text: `+1 ${def.name}`,
            color: def.glowColor,
            life: 1.0,
            maxLife: 1.0,
          });
          this.drops.splice(i, 1);
          this.callbacks.onHudDirty();
        }
      }
    }
  }

  private updateRoomInteractions(input: InputManager): void {
    this.activePrompt = null;

    // 1. Start Room Free Exit Warp Pad
    if (this.currentRoom.type === 'start') {
      if (Math.hypot(this.playerX - ROOM_CENTER_X, this.playerY - (ROOM_CENTER_Y - 12)) < 28) {
        this.activePrompt = {
          label: '[E] Zurück zu Port Solaris (Gratis)',
          x: ROOM_CENTER_X,
          y: ROOM_CENTER_Y - 32,
        };
        if (input.interactPressed()) {
          this.triggerSafeWarp('warp', false);
        }
        return;
      }
    }

    // 2. Boss Victory Portal
    if (this.currentRoom.type === 'boss' && this.bossDefeatedInRun) {
      if (Math.hypot(this.playerX - ROOM_CENTER_X, this.playerY - ROOM_CENTER_Y) < 30) {
        this.activePrompt = {
          label: '[E] Sieges-Warp nach Port Solaris!',
          x: ROOM_CENTER_X,
          y: ROOM_CENTER_Y - 26,
        };
        if (input.interactPressed()) {
          this.triggerSafeWarp('boss_victory', false);
        }
        return;
      }
    }

    // 3. Ancient Treasure Chest
    const chest = this.currentRoom.chest;
    if (chest && !chest.opened) {
      if (Math.hypot(this.playerX - chest.x, this.playerY - chest.y) < 28) {
        this.activePrompt = {
          label: '[E] Relikt-Truhe öffnen',
          x: chest.x,
          y: chest.y - 20,
        };
        if (input.interactPressed()) {
          chest.opened = true;
          sound.playUpgrade();
          this.spawnBurst(chest.x, chest.y, '#fbbf24', 20);
          // Drop 3 shiny relics, at least 2 rare/epic!
          this.spawnLootDrop(chest.x, chest.y, rollLootItem(2, true));
          this.spawnLootDrop(chest.x, chest.y, rollLootItem(2, true));
          this.spawnLootDrop(chest.x, chest.y, rollLootItem(2, false));
          this.callbacks.onToast('Uralte Relikt-Truhe geplündert!', 'good');
        }
      }
    }
  }

  private triggerSafeWarp(reason: 'warp' | 'boss_victory', chargeFee: boolean): void {
    if (this.finished) return;
    this.finished = true;
    if (chargeFee) {
      const fee = Math.min(this.state.credits, this.warpCost);
      this.state.credits -= fee;
    }
    sound.playWarp();
    const res = processSafeReturnEffects(this.state.inventory);
    this.state.save();
    this.callbacks.onReturnToShop({
      victory: true,
      reason,
      roomsCleared: this.roomsCleared,
      enemiesDefeated: this.enemiesDefeated,
      itemsSaved: res.savedCount,
      itemsLost: 0,
      warpedToChest: res.warpedToChest,
      shatteredItems: [],
    });
  }

  private triggerDefeat(): void {
    if (this.finished) return;
    this.finished = true;
    sound.playWarp();
    const res = processDefeatPenalty(this.state.inventory);
    this.state.save();
    this.callbacks.onReturnToShop({
      victory: false,
      reason: 'defeat',
      roomsCleared: this.roomsCleared,
      enemiesDefeated: this.enemiesDefeated,
      itemsSaved: res.itemsSaved,
      itemsLost: res.itemsLost,
      warpedToChest: [],
      shatteredItems: res.shatteredItems,
    });
  }

  private spawnBurst(x: number, y: number, color: string, count: number): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 25 + Math.random() * 75;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        color,
        size: 1.5 + Math.random() * 1.8,
        life: 0.25 + Math.random() * 0.3,
        maxLife: 0.55,
      });
    }
  }

  private triggerShake(duration: number, mag: number): void {
    this.shakeTimer = Math.max(this.shakeTimer, duration);
    this.shakeMag = Math.max(this.shakeMag, mag);
  }

  private updateEffects(dt: number): void {
    for (let i = this.slashes.length - 1; i >= 0; i--) {
      this.slashes[i].life -= dt;
      if (this.slashes[i].life <= 0) this.slashes.splice(i, 1);
    }
    for (let i = this.afterimages.length - 1; i >= 0; i--) {
      this.afterimages[i].life -= dt;
      if (this.afterimages[i].life <= 0) this.afterimages.splice(i, 1);
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i];
      f.y -= 20 * dt;
      f.life -= dt;
      if (f.life <= 0) this.floats.splice(i, 1);
    }
  }

  private normalizeAngle(a: number): number {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  }

  public render(ctx: CanvasRenderingContext2D, input: InputManager): void {
    const art = getHDArt();
    const atlas = getAtlas();

    ctx.save();
    if (this.shakeTimer > 0) {
      const sx = (Math.random() - 0.5) * 2 * this.shakeMag;
      const sy = (Math.random() - 0.5) * 2 * this.shakeMag;
      ctx.translate(sx, sy);
    }

    // 1. High-craft Moonlighter Derelict Starship Room Backdrop (960x540 rendered 1:1!)
    if (art.dungeonBg) {
      ctx.drawImage(art.dungeonBg, 0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    } else {
      ctx.fillStyle = '#0e131f';
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    }

    // Subtle ambient bioluminescent spores floating in the derelict room
    for (let s = 0; s < 10; s++) {
      const sx = ROOM_LEFT + ((s * 73 + this.currentRoom.tileSeed) % (ROOM_RIGHT - ROOM_LEFT));
      const sy =
        ROOM_TOP +
        ((s * 47 + Math.floor(this.time * 8) + this.currentRoom.tileSeed) % (ROOM_BOTTOM - ROOM_TOP));
      const a = 0.25 + 0.45 * Math.sin(this.time * 2.5 + s);
      ctx.fillStyle = `rgba(56, 232, 212, ${Math.max(0, a)})`;
      ctx.fillRect(sx + Math.sin(this.time + s) * 4, sy, 1.5, 1.5);
    }

    // 2. Active Airlock Doors (red laser bars when locked / glowing cyan energy when open!)
    this.renderDoors(ctx);

    // 3. Start Room Warp Pad OR Boss Victory Portal
    if (this.currentRoom.type === 'start') {
      this.renderWarpPad(ctx, ROOM_CENTER_X, ROOM_CENTER_Y - 12, '#38e8d4');
    } else if (this.currentRoom.type === 'boss' && this.bossDefeatedInRun) {
      this.renderWarpPad(ctx, ROOM_CENTER_X, ROOM_CENTER_Y, '#fbbf24');
    }

    // 4. Obstacles (pillars, conduits, crates)
    for (const ob of this.currentRoom.obstacles) {
      this.renderObstacle(ctx, ob);
    }

    // 5. Destructible Golden Alien Frachtkapseln
    for (const pod of this.currentRoom.pods) {
      if (!pod.broken) {
        drawPixelShadow(ctx, pod.x, pod.y + 9, 9, 3.5, 0.48);
        if (art.podIntact) {
          ctx.drawImage(art.podIntact, pod.x - 11, pod.y - 13, 22, 24);
        } else {
          ctx.drawImage(atlas.props.podIntact, Math.round(pod.x - 8), Math.round(pod.y - 7));
        }
        drawGlow(ctx, pod.x, pod.y - 1, 16, '#fbbf24', 0.22);
      } else {
        ctx.drawImage(atlas.props.podBroken, Math.round(pod.x - 8), Math.round(pod.y - 5));
      }
    }

    // 6. Ornate Ancient Treasure Chest
    if (this.currentRoom.chest) {
      const ch = this.currentRoom.chest;
      drawPixelShadow(ctx, ch.x, ch.y + 10, 14, 4.5, 0.5);
      const chestSpr = ch.opened ? art.chestOpen : art.chestClosed;
      if (chestSpr) {
        ctx.drawImage(chestSpr, ch.x - 14, ch.y - 13, 28, 25);
      } else {
        ctx.drawImage(
          ch.opened ? atlas.props.chestOpen : atlas.props.chestClosed,
          Math.round(ch.x - 10),
          Math.round(ch.y - 6),
        );
      }
      if (!ch.opened) {
        drawGlow(ctx, ch.x, ch.y - 2, 28, '#fbbf24', 0.34 + Math.sin(this.time * 4) * 0.08);
      }
    }

    // 7. HD Glowing Loot Drops
    for (const d of this.drops) {
      const def = getItemDef(d.itemId);
      const bob = Math.sin(this.time * 5 + d.x) * 2.2;
      drawPixelShadow(ctx, d.x, d.y + 7, 6, 2.5, 0.42);
      drawGlow(ctx, d.x, d.y + bob, 16, def.glowColor, 0.4);
      const spr = art.items[d.itemId] ?? atlas.items[d.itemId];
      if (spr) {
        ctx.drawImage(spr, d.x - 9, d.y - 10 + bob, 18, 18);
      }
    }

    // 8. Jetpack Dash Afterimages
    for (const a of this.afterimages) {
      ctx.save();
      ctx.globalAlpha = (a.life / a.maxLife) * 0.45;
      if (art.heroFlash) {
        ctx.drawImage(art.heroFlash, a.x - 12, a.y - 16, 24, 28);
      } else {
        ctx.drawImage(atlas.heroFlash, Math.round(a.x - 8), Math.round(a.y - 10));
      }
      ctx.restore();
    }

    // 9. Boss Charge Telegraph Lane
    for (const e of this.enemies) {
      if (e.kind === 'boss' && e.telegraphTimer > 0 && e.phase % 2 === 1) {
        ctx.save();
        ctx.strokeStyle = 'rgba(251, 113, 133, 0.72)';
        ctx.lineWidth = 8;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(e.x + e.chargeDirX * 140, e.y + e.chargeDirY * 140);
        ctx.stroke();
        ctx.restore();
      }
    }

    // 10. Depth-Sorted Enemies & Player
    type Drawable = { y: number; draw: () => void };
    const drawables: Drawable[] = [];
    for (const e of this.enemies) {
      drawables.push({ y: e.y, draw: () => this.renderEnemy(ctx, e) });
    }
    drawables.push({ y: this.playerY, draw: () => this.renderPlayer(ctx) });
    drawables.sort((a, b) => a.y - b.y);
    for (const d of drawables) d.draw();

    // 11. Plasma Blade Slash Arcs
    for (const s of this.slashes) {
      const alpha = s.life / s.maxLife;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = s.comboStep === 2 ? `rgba(253, 224, 71, ${alpha})` : `rgba(56, 232, 212, ${alpha})`;
      ctx.lineWidth = s.comboStep === 2 ? 7 : 5;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius * 0.85, s.angle - s.sweep / 2, s.angle + s.sweep / 2);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.9})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius * 0.92, s.angle - s.sweep / 2, s.angle + s.sweep / 2);
      ctx.stroke();
      ctx.restore();
    }

    // 12. Projectiles
    for (const p of this.projectiles) {
      drawGlow(ctx, p.x, p.y, 12, p.color, 0.55);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
    }

    // 13. Particles
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    // 14. Warp-Beacon Channel Ring
    if (this.warpChannel > 0.05) {
      const pct = Math.min(1, this.warpChannel / this.warpDuration);
      ctx.save();
      ctx.strokeStyle = '#38e8d4';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(this.playerX, this.playerY, 17, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
      ctx.stroke();
      drawGlow(ctx, this.playerX, this.playerY, 26, '#38e8d4', 0.35 * pct);
      ctx.restore();
    }

    // 15. Floating Damage & Loot Numbers
    ctx.font = 'bold 6.5px Silkscreen, monospace';
    ctx.textAlign = 'center';
    for (const f of this.floats) {
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life / 0.4));
      ctx.fillStyle = '#0e131f';
      ctx.fillText(f.text, f.x + 0.8, f.y + 0.8);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;

    // 16. Mouse Aim Reticle
    if (input.isMouseActive() && !input.locked) {
      const m = input.getMousePos();
      ctx.strokeStyle = 'rgba(56, 232, 212, 0.8)';
      ctx.lineWidth = 0.8;
      ctx.strokeRect(m.x - 3.5, m.y - 3.5, 7, 7);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(m.x - 0.5, m.y - 0.5, 1, 1);
    }

    ctx.restore();

    // Unshaken overlays
    this.renderMinimap(ctx);
    this.renderBossBar(ctx);

    if (this.activePrompt) {
      this.renderPrompt(ctx, this.activePrompt.label, this.activePrompt.x, this.activePrompt.y);
    }

    if (this.roomFade > 0) {
      ctx.fillStyle = `rgba(10, 14, 24, ${Math.min(1, this.roomFade / 0.22)})`;
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    }
  }

  private renderDoors(ctx: CanvasRenderingContext2D): void {
    const locked = !this.currentRoom.cleared;
    const doors = this.currentRoom.doors;
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 5);

    const drawH = (x: number, y: number) => {
      if (locked) {
        ctx.fillStyle = 'rgba(42, 12, 22, 0.85)';
        ctx.fillRect(x - 16, y - 5, 32, 10);
        ctx.fillStyle = '#fb7185';
        ctx.fillRect(x - 15, y - 3, 30, 2);
        ctx.fillRect(x - 15, y + 1, 30, 2);
        ctx.fillStyle = '#fff1f2';
        ctx.fillRect(x - 14, y - 2.5, 28, 0.8);
        ctx.fillRect(x - 14, y + 1.5, 28, 0.8);
        drawGlow(ctx, x, y, 26, '#fb7185', 0.42);
      } else {
        ctx.fillStyle = 'rgba(8, 30, 42, 0.85)';
        ctx.fillRect(x - 15, y - 5, 30, 10);
        ctx.fillStyle = '#38e8d4';
        ctx.fillRect(x - 13, y - 1.5, 26, 3);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x - 10, y - 0.5, 20, 1);
        drawGlow(ctx, x, y, 24 + pulse * 4, '#38e8d4', 0.36);
      }
    };

    const drawV = (x: number, y: number) => {
      if (locked) {
        ctx.fillStyle = 'rgba(42, 12, 22, 0.85)';
        ctx.fillRect(x - 5, y - 18, 10, 36);
        ctx.fillStyle = '#fb7185';
        ctx.fillRect(x - 3, y - 16, 2, 32);
        ctx.fillRect(x + 1, y - 16, 2, 32);
        ctx.fillStyle = '#fff1f2';
        ctx.fillRect(x - 2.5, y - 15, 0.8, 30);
        ctx.fillRect(x + 1.5, y - 15, 0.8, 30);
        drawGlow(ctx, x, y, 26, '#fb7185', 0.42);
      } else {
        ctx.fillStyle = 'rgba(8, 30, 42, 0.85)';
        ctx.fillRect(x - 5, y - 16, 10, 32);
        ctx.fillStyle = '#38e8d4';
        ctx.fillRect(x - 1.5, y - 14, 3, 28);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x - 0.5, y - 11, 1, 22);
        drawGlow(ctx, x, y, 24 + pulse * 4, '#38e8d4', 0.36);
      }
    };

    if (doors.north) drawH(ROOM_CENTER_X, ROOM_TOP - 6);
    if (doors.south) drawH(ROOM_CENTER_X, ROOM_BOTTOM + 10);
    if (doors.west) drawV(ROOM_LEFT - 10, ROOM_CENTER_Y);
    if (doors.east) drawV(ROOM_RIGHT + 10, ROOM_CENTER_Y);
  }

  private renderWarpPad(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): void {
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 5);
    ctx.fillStyle = 'rgba(18, 26, 40, 0.9)';
    ctx.beginPath();
    ctx.arc(x, y, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 12 + pulse * 1.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.3 + pulse * 0.22;
    ctx.beginPath();
    ctx.arc(x, y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    drawGlow(ctx, x, y, 32, color, 0.4);
  }

  private renderObstacle(ctx: CanvasRenderingContext2D, ob: DungeonRoom['obstacles'][number]): void {
    const atlas = getAtlas();
    if (ob.kind === 'crate') {
      drawPixelShadow(ctx, ob.x + ob.w / 2, ob.y + ob.h + 1, ob.w / 2, 3, 0.4);
      ctx.drawImage(atlas.props.crate, ob.x, ob.y, ob.w, ob.h);
      return;
    }

    ctx.fillStyle = 'rgba(10, 14, 24, 0.72)';
    ctx.fillRect(ob.x - 1, ob.y + 3, ob.w + 2, ob.h);
    ctx.fillStyle = '#1e2738';
    ctx.fillRect(ob.x, ob.y, ob.w, ob.h);
    ctx.fillStyle = '#475569';
    ctx.fillRect(ob.x + 1, ob.y + 1, ob.w - 2, ob.h - 4);
    ctx.fillStyle = '#64748b';
    ctx.fillRect(ob.x + 2, ob.y + 2, ob.w - 4, 4);
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(ob.x + 3, ob.y + 3, 2, 2);
    ctx.fillRect(ob.x + ob.w - 5, ob.y + 3, 2, 2);
    ctx.fillRect(ob.x + 3, ob.y + ob.h - 7, 2, 2);
    ctx.fillRect(ob.x + ob.w - 5, ob.y + ob.h - 7, 2, 2);

    if (ob.kind === 'conduit') {
      ctx.fillStyle = '#0f2938';
      ctx.fillRect(ob.x + 5, ob.y + Math.floor(ob.h / 2) - 4, ob.w - 10, 7);
      ctx.fillStyle = '#38e8d4';
      ctx.fillRect(ob.x + 6, ob.y + Math.floor(ob.h / 2) - 2, ob.w - 12, 3);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(ob.x + 8, ob.y + Math.floor(ob.h / 2) - 1, ob.w - 16, 1);
      drawGlow(ctx, ob.x + ob.w / 2, ob.y + ob.h / 2, 22, '#38e8d4', 0.3);
    } else {
      ctx.fillStyle = '#334155';
      ctx.fillRect(ob.x + 5, ob.y + 8, ob.w - 10, ob.h - 14);
    }
  }

  private renderEnemy(ctx: CanvasRenderingContext2D, e: Enemy): void {
    const art = getHDArt();
    const atlas = getAtlas();
    const frame = Math.floor(e.anim) % 2;

    if (e.kind === 'boss') {
      const hover = Math.sin(this.time * 3.5) * 2;
      drawPixelShadow(ctx, e.x, e.y + 18, 22, 7, 0.55);
      const spr = e.flashTimer > 0 ? art.bossFlash ?? atlas.bossFlash : art.boss ?? atlas.boss[frame];
      if (art.boss) {
        ctx.drawImage(spr, e.x - 26, e.y - 28 + hover, 52, 50);
      } else {
        ctx.drawImage(spr, Math.round(e.x - 14), Math.round(e.y - 13));
      }
      drawGlow(ctx, e.x, e.y + hover, 34, e.telegraphTimer > 0 ? '#fb7185' : '#fb923c', 0.42);
      return;
    }

    drawPixelShadow(ctx, e.x, e.y + 9, 8.5, 3.2, 0.48);

    if (e.kind === 'slime') {
      const squish = Math.sin(e.anim * 1.4) * 0.1;
      const spr = e.flashTimer > 0 ? art.slimeFlash ?? atlas.slimeFlash : art.slime ?? atlas.slime[frame];
      if (art.slime) {
        ctx.save();
        ctx.translate(e.x, e.y + 9);
        ctx.scale(1 + squish, 1 - squish);
        ctx.drawImage(spr, -11, -20, 22, 21);
        ctx.restore();
      } else {
        ctx.drawImage(spr, Math.round(e.x - 8), Math.round(e.y - 8));
      }
      drawGlow(ctx, e.x, e.y, 14, '#c084fc', 0.22);
    } else if (e.kind === 'drone') {
      const hover = Math.sin(this.time * 6 + e.id) * 2.4;
      const spr = e.flashTimer > 0 ? art.droneFlash ?? atlas.droneFlash : art.drone ?? atlas.drone[0];
      if (art.drone) {
        ctx.drawImage(spr, e.x - 11, e.y - 12 + hover, 22, 22);
      } else {
        ctx.drawImage(spr, Math.round(e.x - 8), Math.round(e.y - 9 + hover));
      }
      if (e.telegraphTimer > 0) drawGlow(ctx, e.x, e.y + hover, 18, '#fb7185', 0.55);
      else drawGlow(ctx, e.x, e.y + hover, 13, '#38e8d4', 0.22);
    } else {
      const spr =
        e.flashTimer > 0
          ? art.turretFlash ?? atlas.turretFlash
          : e.telegraphTimer > 0
            ? art.turret1 ?? atlas.turret[1]
            : art.turret0 ?? atlas.turret[0];
      if (art.turret0) {
        ctx.drawImage(spr, e.x - 12, e.y - 13, 24, 24);
      } else {
        ctx.drawImage(spr, Math.round(e.x - 8), Math.round(e.y - 8));
      }
      if (e.telegraphTimer > 0) drawGlow(ctx, e.x, e.y, 20, '#fbbf24', 0.5);
    }

    this.renderEnemyMiniHp(ctx, e);
  }

  private renderEnemyMiniHp(ctx: CanvasRenderingContext2D, e: Enemy): void {
    if (e.hp >= e.maxHp) return;
    const pct = Math.max(0, e.hp / e.maxHp);
    ctx.fillStyle = '#0e131f';
    ctx.fillRect(e.x - 10, e.y - 16, 20, 3);
    ctx.fillStyle = '#fb7185';
    ctx.fillRect(e.x - 9, e.y - 15, 18 * pct, 1.2);
  }

  private renderPlayer(ctx: CanvasRenderingContext2D): void {
    const art = getHDArt();
    const atlas = getAtlas();
    if (this.invulnTimer > 0 && this.dashTimer <= 0 && Math.floor(this.time * 24) % 2 === 0) {
      return;
    }

    const walking = this.walkAnim > 0;
    const bob = walking ? Math.abs(Math.sin(this.walkAnim)) * 2.2 : Math.sin(this.time * 3) * 0.4;
    const tilt = walking ? Math.sin(this.walkAnim) * 0.05 : 0;

    drawPixelShadow(ctx, this.playerX, this.playerY + 11, 8, 3.2, 0.5);

    const hdSpr = this.playerFlashTimer > 0
      ? art.heroFlash
      : this.facing === 'up'
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
      if (this.playerFlashTimer > 0) spr = atlas.heroFlash;
      ctx.drawImage(spr, Math.round(this.playerX - 8), Math.round(this.playerY - 10));
    }
    drawGlow(ctx, this.playerX, this.playerY, 22, '#38e8d4', 0.16);
  }

  private renderMinimap(ctx: CanvasRenderingContext2D): void {
    const cx = VIRTUAL_WIDTH - 26;
    const cy = 22;
    const cell = 6;

    ctx.fillStyle = 'rgba(10, 15, 26, 0.88)';
    ctx.fillRect(cx - 22, cy - 17, 44, 34);
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 0.8;
    ctx.strokeRect(cx - 21.5, cy - 16.5, 43, 33);

    for (const room of this.floor.rooms.values()) {
      const adjVisited =
        room.visited ||
        this.floor.rooms.get(roomKey(room.gx + 1, room.gy))?.visited ||
        this.floor.rooms.get(roomKey(room.gx - 1, room.gy))?.visited ||
        this.floor.rooms.get(roomKey(room.gx, room.gy + 1))?.visited ||
        this.floor.rooms.get(roomKey(room.gx, room.gy - 1))?.visited;
      if (!adjVisited) continue;

      const rx = cx + (room.gx - this.currentRoom.gx) * cell;
      const ry = cy + (room.gy - this.currentRoom.gy) * cell;
      if (rx < cx - 18 || rx > cx + 16 || ry < cy - 13 || ry > cy + 12) continue;

      if (room.key === this.currentRoom.key) {
        ctx.fillStyle = '#38e8d4';
      } else if (room.type === 'boss') {
        ctx.fillStyle = '#fb7185';
      } else if (room.type === 'treasure') {
        ctx.fillStyle = '#fbbf24';
      } else if (room.visited) {
        ctx.fillStyle = '#64748b';
      } else {
        ctx.fillStyle = '#293448';
      }
      ctx.fillRect(rx - 2, ry - 2, 5, 5);
    }
  }

  private renderBossBar(ctx: CanvasRenderingContext2D): void {
    const boss = this.enemies.find((e) => e.kind === 'boss');
    if (!boss) return;

    const pct = Math.max(0, boss.hp / boss.maxHp);
    const bw = 220;
    const bx = (VIRTUAL_WIDTH - bw) / 2;
    const by = VIRTUAL_HEIGHT - 26;

    ctx.fillStyle = 'rgba(12, 16, 26, 0.92)';
    ctx.fillRect(bx - 4, by - 11, bw + 8, 19);
    ctx.strokeStyle = '#fb923c';
    ctx.lineWidth = 0.8;
    ctx.strokeRect(bx - 3.5, by - 10.5, bw + 7, 18);

    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 5.5px Silkscreen, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('CORE-WÄCHTER MK-IV', VIRTUAL_WIDTH / 2, by - 3);

    ctx.fillStyle = '#2a1822';
    ctx.fillRect(bx, by, bw, 5);
    ctx.fillStyle = '#f97316';
    ctx.fillRect(bx, by, bw * pct, 5);
    ctx.fillStyle = '#fde047';
    ctx.fillRect(bx, by, bw * pct, 1.2);
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
