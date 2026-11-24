import { getHDArt } from '../assets/artLoader';
import { drawGlow, drawPixelShadow } from '../assets/pixelArt';
import { getAtlas } from '../assets/sprites';
import { getItemDef, rollLootItem } from '../data/items';
import { WEAPON_META } from '../data/upgrades';
import { sound } from '../engine/audio';
import { VIRTUAL_HEIGHT, VIRTUAL_WIDTH, type InputManager } from '../engine/input';
import type { GameState } from '../systems/gameState';
import {
  addItemToBackpack,
  isBackpackFullFor,
  processDefeatPenalty,
  processSafeReturnEffects,
} from '../systems/inventory';
import type { Direction, RunSummary, WeaponId } from '../types';
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

type BossState =
  | 'stalk'
  | 'charge_windup'
  | 'charge_dash'
  | 'slam_jump'
  | 'slam_air'
  | 'slam_impact'
  | 'laser_windup'
  | 'laser_sweep'
  | 'pylon_barrage'
  | 'phase2_roar'
  | 'stunned';

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
  subBurst: number;
  burstDelay: number;
  moveDirX: number;
  moveDirY: number;
  scurryTimer: number;
  chargeDirX: number;
  chargeDirY: number;
  chargeActive: number;
  telegraphTimer: number;
  aimAngle: number;
  summonThreshold: number;
  anim: number;
  // Multi-part animated boss state
  bossState?: BossState;
  bossStateTimer?: number;
  bossStateMax?: number;
  bossHeight?: number;
  bossTargetX?: number;
  bossTargetY?: number;
  bossLaserAngle?: number;
  bossLaserDir?: number;
  bossLaserTick?: number;
  bossOrbitAngle?: number;
  bossPylonRadius?: number;
  bossPhase2?: boolean;
  bossStatusText?: string;
  bossAfterimageTick?: number;
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

interface WeaponSwing {
  weapon: 'blade' | 'hammer';
  x: number;
  y: number;
  angle: number;
  radius: number;
  sweep: number;
  dir: 1 | -1; // clockwise vs counter-clockwise backhand!
  comboStep: number;
  life: number;
  maxLife: number;
}

interface SlashHitFx {
  x: number;
  y: number;
  angle: number;
  color: string;
  life: number;
  maxLife: number;
}

interface BossAfterimage {
  x: number;
  y: number;
  height: number;
  tilt: number;
  enraged: boolean;
  life: number;
  maxLife: number;
}

interface LaserBeamFx {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  life: number;
  maxLife: number;
}

interface ShockwaveFx {
  x: number;
  y: number;
  maxRadius: number;
  color: string;
  life: number;
  maxLife: number;
}

interface FloorDecal {
  x: number;
  y: number;
  r: number;
  color: string;
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
  onReturnToHub: (summary: RunSummary) => void;
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

  // Combat & Single-Equipped-Weapon state
  private dashTimer = 0;
  private dashCooldown = 0;
  private dashVx = 0;
  private dashVy = 0;
  private invulnTimer = 0;
  private playerFlashTimer = 0;

  private attackCooldown = 0;
  private specialCooldown = 0;
  private comboStep = 0;
  private comboResetTimer = 0;

  // Active kinetic shield (Blade secondary), melee lunge pose & blaster hold visuals
  private shieldActive = false;
  private shieldAngle = 0;
  private shieldOpenAnim = 0;
  private shieldHoldTime = 0;
  private shieldHitFlash = 0;
  private shieldRipple = 0;
  private shieldRippleAngle = 0;
  private shieldRecoil = 0;
  private blasterRecoil = 0;
  private lastAimAngle = 0;
  private swingPoseTimer = 0;
  private swingPoseMax = 0.2;
  private swingPoseAngle = 0;
  private swingPoseDir: 1 | -1 = 1;
  private swingPoseCombo = 0;

  // Warp-Beacon channel
  private warpChannel = 0;
  private readonly warpDuration = 1.25;
  private readonly warpCost = 20;

  // Room entities & FX
  private enemies: Enemy[] = [];
  private projectiles: Projectile[] = [];
  private drops: LootDrop[] = [];
  private swings: WeaponSwing[] = [];
  private slashHits: SlashHitFx[] = [];
  private bossAfterimages: BossAfterimage[] = [];
  private beams: LaserBeamFx[] = [];
  private shockwaves: ShockwaveFx[] = [];
  private decals: FloorDecal[] = [];
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
    this.attackCooldown = 0;
    this.specialCooldown = 0;
    this.shieldActive = false;
    this.enterRoom(this.floor.startKey, null);
    this.spawnBurst(this.playerX, this.playerY, '#38e8d4', 20);
    this.callbacks.onToast(
      'Sektor 1: Verlassene Korvette — Beute bleibt nur bei Extraktion [R] sicher!',
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
    this.swings = [];
    this.slashHits = [];
    this.bossAfterimages = [];
    this.beams = [];
    this.shockwaves = [];
    this.decals = [];
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
    const baseScale = 1 + this.state.bossDefeatedCount * 0.14;
    if (kind === 'slime') {
      const hp = Math.round(48 * baseScale);
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
        aiTimer: 0.35 + Math.random() * 0.35,
        phase: 0,
        subBurst: 0,
        burstDelay: 0,
        moveDirX: 0,
        moveDirY: 0,
        scurryTimer: 0,
        chargeDirX: 0,
        chargeDirY: 0,
        chargeActive: 0,
        telegraphTimer: 0,
        aimAngle: 0,
        summonThreshold: 0,
        anim: Math.random() * 5,
      });
    } else if (kind === 'drone') {
      const hp = Math.round(54 * baseScale);
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
        aiTimer: 0.9 + Math.random() * 0.6,
        phase: Math.random() * Math.PI * 2,
        subBurst: 0,
        burstDelay: 0,
        moveDirX: Math.random() > 0.5 ? 1 : -1,
        moveDirY: 0,
        scurryTimer: 0,
        chargeDirX: 0,
        chargeDirY: 0,
        chargeActive: 0,
        telegraphTimer: 0,
        aimAngle: 0,
        summonThreshold: 0,
        anim: 0,
      });
    } else if (kind === 'turret') {
      const hp = Math.round(68 * baseScale);
      this.enemies.push({
        id: this.nextEnemyId++,
        kind,
        x,
        y,
        vx: 0,
        vy: 0,
        hp,
        maxHp: hp,
        radius: 9,
        flashTimer: 0,
        aiTimer: 0.9 + Math.random() * 0.5,
        phase: 0,
        subBurst: 0,
        burstDelay: 0,
        moveDirX: 0,
        moveDirY: 0,
        scurryTimer: 0.8 + Math.random() * 0.4,
        chargeDirX: 0,
        chargeDirY: 0,
        chargeActive: 0,
        telegraphTimer: 0,
        aimAngle: 0,
        summonThreshold: 0,
        anim: 0,
      });
    } else {
      const hp = Math.round(380 * baseScale);
      this.enemies.push({
        id: this.nextEnemyId++,
        kind: 'boss',
        x,
        y,
        vx: 0,
        vy: 0,
        hp,
        maxHp: hp,
        radius: 16,
        flashTimer: 0,
        aiTimer: 1.0,
        phase: 0,
        subBurst: 0,
        burstDelay: 0,
        moveDirX: 0,
        moveDirY: 0,
        scurryTimer: 0,
        chargeDirX: 0,
        chargeDirY: 0,
        chargeActive: 0,
        telegraphTimer: 0,
        aimAngle: 0,
        summonThreshold: 0.5,
        anim: 0,
        bossState: 'stalk',
        bossStateTimer: 0.95,
        bossStateMax: 0.95,
        bossHeight: 0,
        bossTargetX: x,
        bossTargetY: y,
        bossLaserAngle: 0,
        bossLaserDir: 1,
        bossLaserTick: 0,
        bossOrbitAngle: 0,
        bossPylonRadius: 28,
        bossPhase2: false,
        bossStatusText: 'AKTIV',
        bossAfterimageTick: 0,
      });
    }
  }

  public swapWeapon(): void {
    if (this.state.swapEquippedWeapons()) {
      this.shieldActive = false;
      this.comboStep = 0;
      sound.playWeaponSwap();
      const meta = WEAPON_META[this.state.equippedWeapon];
      this.floats.push({
        x: this.playerX,
        y: this.playerY - 18,
        text: meta.name,
        color: meta.accentColor,
        life: 0.95,
        maxLife: 0.95,
      });
      this.callbacks.onHudDirty();
    } else {
      this.callbacks.onToast('Schmiede eine zweite Waffe bei Kael auf Port Solaris zum Wechseln!', 'info');
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

    // Regenerate energy smoothly (boosted by Dr. Lyra's Nano-Vitalserum!)
    const stats = this.state.getStats();
    const prevEnergy = Math.floor(this.state.energy);
    this.state.energy = Math.min(
      100,
      this.state.energy + (this.shieldActive ? 6 : 16) * stats.energyRegenMult * dt,
    );
    if (Math.floor(this.state.energy) !== prevEnergy) {
      this.callbacks.onHudDirty();
    }

    this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    this.playerFlashTimer = Math.max(0, this.playerFlashTimer - dt);
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.specialCooldown = Math.max(0, this.specialCooldown - dt);
    this.blasterRecoil = Math.max(0, this.blasterRecoil - dt * 5);
    this.swingPoseTimer = Math.max(0, this.swingPoseTimer - dt);
    this.shieldHitFlash = Math.max(0, this.shieldHitFlash - dt * 4.5);
    this.shieldRipple = Math.max(0, this.shieldRipple - dt * 3.4);
    this.shieldRecoil = Math.max(0, this.shieldRecoil - dt * 7.0);

    if (this.comboResetTimer > 0) {
      this.comboResetTimer -= dt;
      if (this.comboResetTimer <= 0) this.comboStep = 0;
    }

    // Quick weapon swap with 'C'
    if (input.wasPressed('KeyC')) {
      this.swapWeapon();
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
    const weapon: WeaponId = this.state.equippedWeapon;

    // Warp-Beacon channeling (hold R)
    if (input.warpHeld() && this.dashTimer <= 0) {
      this.shieldActive = false;
      this.warpChannel += dt;
      if (Math.random() < dt * 18) {
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

    // Blade Secondary: Hold RMB / K for Hex-Aegis Kinetic Shield (+ Perfect Parry Reflect window!)
    const wasShielding = this.shieldActive;
    this.shieldActive =
      weapon === 'blade' && input.secondaryHeld() && this.dashTimer <= 0 && this.attackCooldown <= 0.05;
    if (this.shieldActive) {
      if (!wasShielding) {
        this.shieldHoldTime = 0;
        this.shieldRipple = 0.65;
        this.shieldRippleAngle = this.getAimAngle(input);
      } else {
        this.shieldHoldTime += dt;
      }
      this.shieldOpenAnim = Math.min(1, this.shieldOpenAnim + dt * 9.5);
      this.shieldAngle = this.getAimAngle(input);
      this.orientFacing(this.shieldAngle);
    } else {
      this.shieldHoldTime = 0;
      this.shieldOpenAnim = Math.max(0, this.shieldOpenAnim - dt * 11.0);
    }

    // Jetpack Dash (Space)
    if (input.dashPressed() && this.dashCooldown <= 0) {
      this.shieldActive = false;
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
      this.dashVx = dx * 258;
      this.dashVy = dy * 258;
      sound.playDash();
      this.spawnBurst(this.playerX, this.playerY + 4, '#fb923c', 8);
    }

    const baseSpeed = this.shieldActive ? 54 : 108;
    let vx = move.x * baseSpeed;
    let vy = move.y * baseSpeed;

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
      this.walkAnim += dt * (this.shieldActive ? 6 : 10);
      if (!this.shieldActive) {
        if (Math.abs(vx) > Math.abs(vy)) {
          this.facing = vx > 0 ? 'right' : 'left';
        } else {
          this.facing = vy > 0 ? 'down' : 'up';
        }
      }
    } else {
      this.walkAnim = 0;
    }

    this.moveEntityWithCollisions(vx * dt, vy * dt);

    // Primary Attack based on SINGLE equipped weapon!
    if (input.primaryPressed() && this.attackCooldown <= 0 && this.dashTimer <= 0) {
      this.shieldActive = false;
      const aim = this.getAimAngle(input);
      this.lastAimAngle = aim;
      if (weapon === 'blade') {
        this.performPlasmaSlash(aim);
      } else if (weapon === 'blaster') {
        this.performBlasterShot(aim);
      } else {
        this.performHammerSwing(aim);
      }
    }

    // Secondary Special Ability based on equipped weapon!
    if (input.secondaryPressed() && this.specialCooldown <= 0 && this.dashTimer <= 0) {
      const aim = this.getAimAngle(input);
      this.lastAimAngle = aim;
      if (weapon === 'blaster') {
        this.performPiercingBeam(aim);
      } else if (weapon === 'hammer') {
        this.performGravShockwave();
      }
    }

    if (this.currentRoom.cleared) {
      this.checkDoorTransition();
    }
  }

  private orientFacing(angle: number): void {
    if (Math.abs(Math.cos(angle)) > Math.abs(Math.sin(angle))) {
      this.facing = Math.cos(angle) > 0 ? 'right' : 'left';
    } else {
      this.facing = Math.sin(angle) > 0 ? 'down' : 'up';
    }
  }

  private performPlasmaSlash(angle: number): void {
    const stats = this.state.getStats();
    const isFinisher = this.comboStep === 2;
    const radius = isFinisher ? stats.bladeRange * 1.26 : stats.bladeRange;
    const sweep = isFinisher ? Math.PI * 1.92 : Math.PI * 1.05;
    const damage = isFinisher ? Math.round(stats.bladeDamage * 1.48) : stats.bladeDamage;
    const swingDir: 1 | -1 = this.comboStep === 1 ? -1 : 1;
    const duration = isFinisher ? 0.28 : 0.21;

    this.orientFacing(angle);
    this.swingPoseTimer = duration;
    this.swingPoseMax = duration;
    this.swingPoseAngle = angle;
    this.swingPoseDir = swingDir;
    this.swingPoseCombo = this.comboStep;

    if (isFinisher) {
      this.afterimages.push({
        x: this.playerX,
        y: this.playerY,
        facing: this.facing,
        life: 0.2,
        maxLife: 0.2,
      });
    }
    this.moveEntityWithCollisions(Math.cos(angle) * (isFinisher ? 11 : 7), Math.sin(angle) * (isFinisher ? 11 : 7));

    sound.playSlash(this.comboStep);
    this.swings.push({
      weapon: 'blade',
      x: this.playerX,
      y: this.playerY,
      angle,
      radius,
      sweep,
      dir: swingDir,
      comboStep: this.comboStep,
      life: duration,
      maxLife: duration,
    });

    // Tangential plasma sparks flying right off the sword tip along the crescent!
    const sparkCount = isFinisher ? 18 : 9;
    for (let k = 0; k < sparkCount; k++) {
      const u = k / Math.max(1, sparkCount - 1);
      const a = angle - (sweep / 2) * swingDir + sweep * swingDir * u;
      const dist = radius * (0.72 + Math.random() * 0.34);
      const tangAngle = a + swingDir * (Math.PI / 2);
      const sp = 28 + Math.random() * 52;
      this.particles.push({
        x: this.playerX + Math.cos(a) * dist,
        y: this.playerY - 2 + Math.sin(a) * dist * 0.84,
        vx: Math.cos(tangAngle) * sp + Math.cos(a) * 18,
        vy: Math.sin(tangAngle) * sp * 0.84 + Math.sin(a) * 14,
        color: isFinisher
          ? k % 2 === 0
            ? '#fde047'
            : '#38e8d4'
          : k % 3 === 0
            ? '#ffffff'
            : this.comboStep === 1
              ? '#67e8f9'
              : '#38e8d4',
        size: isFinisher ? 2 : 1.6,
        life: 0.2 + Math.random() * 0.18,
        maxLife: 0.38,
      });
    }

    // Boot dust puff on lunge / spin finisher
    for (let k = 0; k < (isFinisher ? 8 : 3); k++) {
      const a = Math.random() * Math.PI * 2;
      this.particles.push({
        x: this.playerX + Math.cos(a) * 5,
        y: this.playerY + 9,
        vx: Math.cos(a) * (isFinisher ? 34 : 16),
        vy: Math.sin(a) * 12,
        color: 'rgba(203, 213, 225, 0.75)',
        size: 1.8,
        life: 0.22,
        maxLife: 0.22,
      });
    }

    if (isFinisher) {
      this.shockwaves.push({
        x: this.playerX,
        y: this.playerY,
        maxRadius: radius * 1.18,
        color: '#fde047',
        life: 0.24,
        maxLife: 0.24,
      });
    }

    let hitAny = false;
    for (const e of [...this.enemies]) {
      if (e.kind === 'boss' && (e.bossHeight ?? 0) > 28) continue;
      const dx = e.x - this.playerX;
      const dy = e.y - this.playerY;
      const dist = Math.hypot(dx, dy);
      if (dist > radius + e.radius) continue;
      const diff = Math.abs(this.normalizeAngle(Math.atan2(dy, dx) - angle));
      if (diff <= sweep / 2 + 0.28 || dist < e.radius + 9) {
        this.slashHits.push({
          x: e.x,
          y: e.y - 2,
          angle: angle + (Math.random() - 0.5) * 0.5,
          color: isFinisher ? '#fde047' : '#38e8d4',
          life: 0.18,
          maxLife: 0.18,
        });
        this.damageEnemy(e, damage, Math.cos(angle), Math.sin(angle), isFinisher ? 165 : 105);
        hitAny = true;
      }
    }

    for (const pod of this.currentRoom.pods) {
      if (pod.broken) continue;
      if (Math.hypot(pod.x - this.playerX, pod.y - this.playerY) <= radius + 10) {
        this.breakPod(pod);
        hitAny = true;
      }
    }

    if (hitAny) {
      this.hitStop = isFinisher ? 0.055 : 0.028;
      this.triggerShake(isFinisher ? 0.16 : 0.09, isFinisher ? 3.2 : 1.7);
      this.state.energy = Math.min(100, this.state.energy + 10);
      this.callbacks.onHudDirty();
    }

    this.attackCooldown = isFinisher ? 0.34 : 0.2;
    this.comboStep = (this.comboStep + 1) % 3;
    this.comboResetTimer = 0.64;
  }

  private performBlasterShot(angle: number): void {
    const stats = this.state.getStats();
    this.orientFacing(angle);
    this.attackCooldown = stats.blasterCooldown;
    this.blasterRecoil = 1.0;
    sound.playBlaster();

    const mx = this.playerX + Math.cos(angle) * 12;
    const my = this.playerY + Math.sin(angle) * 12;
    this.spawnBurst(mx, my, '#38bdf8', 5);

    const speed = 275 + this.state.upgrades.blaster * 22;
    this.projectiles.push({
      x: mx,
      y: my,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      fromPlayer: true,
      damage: stats.blasterDamage,
      color: '#38bdf8',
      radius: 3.5,
      life: 1.45,
    });
  }

  private performPiercingBeam(angle: number): void {
    const cost = 38;
    if (this.state.energy < cost) {
      this.callbacks.onToast('Zu wenig Energie für Durchschuss-Laser (38 EN)!', 'warn');
      return;
    }
    this.state.energy -= cost;
    this.specialCooldown = 0.65;
    this.attackCooldown = 0.32;
    this.blasterRecoil = 1.4;
    this.orientFacing(angle);
    sound.playRailBeam();
    this.triggerShake(0.18, 3.0);

    const stats = this.state.getStats();
    const beamDamage = Math.round(stats.blasterDamage * 2.25);
    const sx = this.playerX + Math.cos(angle) * 10;
    const sy = this.playerY + Math.sin(angle) * 10;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);

    // Raycast to room boundary
    let maxT = 360;
    for (let t = 8; t < 360; t += 6) {
      const px = sx + dx * t;
      const py = sy + dy * t;
      if (px < ROOM_LEFT || px > ROOM_RIGHT || py < ROOM_TOP || py > ROOM_BOTTOM) {
        maxT = t;
        break;
      }
    }
    const ex = sx + dx * maxT;
    const ey = sy + dy * maxT;
    this.beams.push({ x1: sx, y1: sy, x2: ex, y2: ey, life: 0.24, maxLife: 0.24 });

    // Hit ALL grounded enemies along beam line!
    for (const e of [...this.enemies]) {
      if (e.kind === 'boss' && (e.bossHeight ?? 0) > 28) continue;
      const distToLine = this.pointToSegmentDist(e.x, e.y, sx, sy, ex, ey);
      if (distToLine <= e.radius + 9) {
        this.damageEnemy(e, beamDamage, dx, dy, 120);
      }
    }
    for (const pod of this.currentRoom.pods) {
      if (!pod.broken && this.pointToSegmentDist(pod.x, pod.y, sx, sy, ex, ey) <= 13) {
        this.breakPod(pod);
      }
    }
    this.callbacks.onHudDirty();
  }

  private performHammerSwing(angle: number): void {
    const stats = this.state.getStats();
    const isHeavy = this.comboStep === 1;
    const radius = isHeavy ? stats.hammerRange * 1.18 : stats.hammerRange;
    const sweep = isHeavy ? Math.PI * 1.32 : Math.PI * 1.02;
    const damage = isHeavy ? Math.round(stats.hammerDamage * 1.32) : stats.hammerDamage;
    const swingDir: 1 | -1 = isHeavy ? -1 : 1;
    const duration = isHeavy ? 0.28 : 0.24;

    this.orientFacing(angle);
    this.swingPoseTimer = duration;
    this.swingPoseMax = duration;
    this.swingPoseAngle = angle;
    this.swingPoseDir = swingDir;
    this.swingPoseCombo = isHeavy ? 2 : 0;

    this.moveEntityWithCollisions(Math.cos(angle) * 8, Math.sin(angle) * 8);

    sound.playHammerSmash();
    this.triggerShake(isHeavy ? 0.2 : 0.12, isHeavy ? 3.8 : 2.4);
    this.swings.push({
      weapon: 'hammer',
      x: this.playerX,
      y: this.playerY,
      angle,
      radius,
      sweep,
      dir: swingDir,
      comboStep: this.comboStep,
      life: duration,
      maxLife: duration,
    });

    if (isHeavy) {
      // Scorched floor crack decal right in front of the heavy slam!
      this.decals.push({
        x: this.playerX + Math.cos(angle) * (radius * 0.72),
        y: this.playerY + Math.sin(angle) * (radius * 0.62),
        r: 11,
        color: 'rgba(249, 115, 22, 0.34)',
        life: 3.5,
        maxLife: 3.5,
      });
    }

    for (let k = 0; k < 14; k++) {
      const a = angle - sweep / 2 + Math.random() * sweep;
      const dist = radius * (0.65 + Math.random() * 0.35);
      this.particles.push({
        x: this.playerX + Math.cos(a) * dist,
        y: this.playerY + Math.sin(a) * dist * 0.84,
        vx: Math.cos(a) * 48,
        vy: Math.sin(a) * 40,
        color: k % 2 === 0 ? '#fb923c' : '#fde047',
        size: 2.1,
        life: 0.28,
        maxLife: 0.28,
      });
    }

    let hitAny = false;
    for (const e of [...this.enemies]) {
      if (e.kind === 'boss' && (e.bossHeight ?? 0) > 28) continue;
      const dx = e.x - this.playerX;
      const dy = e.y - this.playerY;
      const dist = Math.hypot(dx, dy);
      if (dist > radius + e.radius) continue;
      const diff = Math.abs(this.normalizeAngle(Math.atan2(dy, dx) - angle));
      if (diff <= sweep / 2 + 0.26 || dist < e.radius + 10) {
        this.slashHits.push({
          x: e.x,
          y: e.y - 2,
          angle: angle + 0.2,
          color: '#fb923c',
          life: 0.2,
          maxLife: 0.2,
        });
        this.damageEnemy(e, damage, Math.cos(angle), Math.sin(angle), isHeavy ? 210 : 165);
        hitAny = true;
      }
    }
    for (const pod of this.currentRoom.pods) {
      if (!pod.broken && Math.hypot(pod.x - this.playerX, pod.y - this.playerY) <= radius + 12) {
        this.breakPod(pod);
        hitAny = true;
      }
    }

    if (hitAny) {
      this.hitStop = 0.055;
      this.state.energy = Math.min(100, this.state.energy + 14);
      this.callbacks.onHudDirty();
    }

    this.attackCooldown = isHeavy ? 0.5 : 0.38;
    this.comboStep = (this.comboStep + 1) % 2;
    this.comboResetTimer = 0.85;
  }

  private performGravShockwave(): void {
    const cost = 42;
    if (this.state.energy < cost) {
      this.callbacks.onToast('Zu wenig Energie für Grav-Schockwelle (42 EN)!', 'warn');
      return;
    }
    this.state.energy -= cost;
    this.specialCooldown = 0.85;
    this.attackCooldown = 0.4;
    const stats = this.state.getStats();
    const dmg = Math.round(stats.hammerDamage * 1.45);
    const maxR = 66;

    sound.playHammerSmash();
    this.triggerShake(0.28, 4.5);
    this.shockwaves.push({
      x: this.playerX,
      y: this.playerY,
      maxRadius: maxR,
      color: '#fb923c',
      life: 0.32,
      maxLife: 0.32,
    });
    this.spawnBurst(this.playerX, this.playerY, '#fbbf24', 22);

    for (const e of [...this.enemies]) {
      const dx = e.x - this.playerX;
      const dy = e.y - this.playerY;
      const dist = Math.max(1, Math.hypot(dx, dy));
      if (dist <= maxR + e.radius) {
        this.damageEnemy(e, dmg, dx / dist, dy / dist, 230);
      }
    }
    for (const pod of this.currentRoom.pods) {
      if (!pod.broken && Math.hypot(pod.x - this.playerX, pod.y - this.playerY) <= maxR) {
        this.breakPod(pod);
      }
    }
    this.callbacks.onHudDirty();
  }

  private pointToSegmentDist(
    px: number,
    py: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
  ): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(px - x1, py - y1);
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
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

  // ==================== LIVELY, DYNAMIC ENEMY AI ====================
  private updateEnemies(dt: number): void {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.anim += dt * 7.5;
      e.flashTimer = Math.max(0, e.flashTimer - dt);

      e.vx *= Math.pow(0.03, dt);
      e.vy *= Math.pow(0.03, dt);

      const dx = this.playerX - e.x;
      const dy = this.playerY - e.y;
      const dist = Math.max(1, Math.hypot(dx, dy));
      const nx = dx / dist;
      const ny = dy / dist;

      if (e.kind === 'slime') {
        // Energetic continuous bouncing hops + slime trail + telegraphed pounce every 3rd hop!
        if (e.telegraphTimer > 0) {
          e.telegraphTimer -= dt;
          if (e.telegraphTimer <= 0) {
            // Fast pounce lunge!
            e.vx += e.chargeDirX * 195;
            e.vy += e.chargeDirY * 195;
            this.spawnBurst(e.x, e.y + 4, '#c084fc', 5);
            e.aiTimer = 0.72;
          }
        } else {
          e.aiTimer -= dt;
          if (e.aiTimer <= 0) {
            e.phase += 1;
            if (e.phase % 3 === 0 && dist < 130) {
              // Wind-up crouch before pounce
              e.telegraphTimer = 0.36;
              e.chargeDirX = nx;
              e.chargeDirY = ny;
            } else {
              // Bouncy zig-zag hop toward player
              const jitter = (Math.random() - 0.5) * 0.65;
              const hopAngle = Math.atan2(dy, dx) + jitter;
              e.vx += Math.cos(hopAngle) * 112;
              e.vy += Math.sin(hopAngle) * 112;
              this.decals.push({
                x: e.x,
                y: e.y + 7,
                r: 4 + Math.random() * 2,
                color: 'rgba(168, 85, 247, 0.35)',
                life: 2.2,
                maxLife: 2.2,
              });
              e.aiTimer = 0.56 + Math.random() * 0.22;
            }
          }
        }
      } else if (e.kind === 'drone') {
        // Agile orbiting strafe + laser lock sightline + rapid 2-bolt burst + tactical side-dash!
        e.phase += dt * 2.2;
        const desiredDist = 86;
        const radial = dist > desiredDist + 12 ? 1 : dist < 56 ? -1 : 0;
        const strafe = e.moveDirX;
        const tx = -ny * strafe * 62 + nx * radial * 54;
        const ty = nx * strafe * 62 + ny * radial * 54;
        e.vx += tx * dt * 4.5;
        e.vy += ty * dt * 4.5;

        // Subtle cyan thruster exhaust
        if (Math.random() < dt * 10) {
          this.particles.push({
            x: e.x,
            y: e.y + 4,
            vx: -e.vx * 0.25,
            vy: 12,
            color: '#38e8d4',
            size: 1.4,
            life: 0.22,
            maxLife: 0.22,
          });
        }

        if (e.subBurst > 0) {
          e.burstDelay -= dt;
          if (e.burstDelay <= 0) {
            this.fireEnemyBolt(e.x, e.y, e.aimAngle + (Math.random() - 0.5) * 0.08, 162, 13, '#e879f9');
            e.subBurst -= 1;
            e.burstDelay = 0.16;
            if (e.subBurst === 0) {
              // Immediate agile side-dash reposition!
              e.moveDirX = -e.moveDirX;
              e.vx += -ny * e.moveDirX * 145;
              e.vy += nx * e.moveDirX * 145;
              e.aiTimer = 1.45 + Math.random() * 0.5;
            }
          }
        } else if (e.telegraphTimer > 0) {
          e.telegraphTimer -= dt;
          e.aimAngle = Math.atan2(dy, dx);
          if (e.telegraphTimer <= 0) {
            e.subBurst = 2;
            e.burstDelay = 0;
          }
        } else {
          e.aiTimer -= dt;
          if (e.aiTimer <= 0) {
            e.telegraphTimer = 0.46;
            e.aimAngle = Math.atan2(dy, dx);
          }
        }
      } else if (e.kind === 'turret') {
        // Mobile Scurry-Turret: scurries briskly to flank -> plants & fires 3-bolt fan -> repositions!
        if (e.scurryTimer > 0) {
          e.scurryTimer -= dt;
          if (e.moveDirX === 0 && e.moveDirY === 0) {
            const perp = Math.random() > 0.5 ? 1 : -1;
            const a = Math.atan2(dy, dx) + perp * (0.75 + Math.random() * 0.6);
            e.moveDirX = Math.cos(a);
            e.moveDirY = Math.sin(a);
          }
          e.vx = e.moveDirX * 72;
          e.vy = e.moveDirY * 72;
          if (Math.random() < dt * 8) {
            this.particles.push({
              x: e.x,
              y: e.y + 8,
              vx: -e.vx * 0.2,
              vy: -6,
              color: '#94a3b8',
              size: 1.5,
              life: 0.25,
              maxLife: 0.25,
            });
          }
          if (e.scurryTimer <= 0) {
            e.moveDirX = 0;
            e.moveDirY = 0;
            e.aiTimer = 0.45;
          }
        } else if (e.telegraphTimer > 0) {
          e.vx *= 0.2;
          e.vy *= 0.2;
          e.telegraphTimer -= dt;
          if (e.telegraphTimer <= 0) {
            const baseAngle = Math.atan2(dy, dx);
            for (const offset of [-0.28, 0, 0.28]) {
              this.fireEnemyBolt(e.x, e.y, baseAngle + offset, 142, 15, '#fb923c');
            }
            this.spawnBurst(e.x, e.y, '#fbbf24', 6);
            // Scurry immediately after firing!
            e.scurryTimer = 0.95 + Math.random() * 0.45;
          }
        } else {
          e.aiTimer -= dt;
          if (e.aiTimer <= 0) {
            e.telegraphTimer = 0.52;
          }
        }
      } else if (e.kind === 'boss') {
        this.updateBossAI(e, dt, dx, dy, nx, ny);
      }

      const prevX = e.x;
      const prevY = e.y;
      const airborne = e.kind === 'boss' && (e.bossHeight ?? 0) > 22;

      const ex = Math.max(ROOM_LEFT + e.radius, Math.min(ROOM_RIGHT - e.radius, e.x + e.vx * dt));
      if (!this.collidesRoomObstacle(ex, e.y, e.radius * 0.85) || e.kind === 'drone' || airborne) {
        e.x = ex;
      } else if (e.kind === 'turret') {
        e.moveDirX = -e.moveDirX;
      }
      const ey = Math.max(ROOM_TOP + e.radius, Math.min(ROOM_BOTTOM - e.radius, e.y + e.vy * dt));
      if (!this.collidesRoomObstacle(e.x, ey, e.radius * 0.85) || e.kind === 'drone' || airborne) {
        e.y = ey;
      } else if (e.kind === 'turret') {
        e.moveDirY = -e.moveDirY;
      }

      // Boss wall slam bounce during Rocket Charge!
      if (e.kind === 'boss' && e.bossState === 'charge_dash') {
        const hitWall =
          (Math.abs(e.vx) > 20 && Math.abs(e.x - prevX) < 0.25) ||
          (Math.abs(e.vy) > 20 && Math.abs(e.y - prevY) < 0.25);
        if (hitWall) {
          sound.playBossSlam();
          this.triggerShake(0.28, 4.5);
          this.spawnBurst(e.x, e.y, '#fbbf24', 18);
          this.shockwaves.push({
            x: e.x,
            y: e.y,
            maxRadius: 42,
            color: '#fb923c',
            life: 0.26,
            maxLife: 0.26,
          });
          e.vx = -e.chargeDirX * 55;
          e.vy = -e.chargeDirY * 55;
          e.bossState = 'stunned';
          e.bossStateTimer = 0.55;
          e.bossStateMax = 0.55;
          e.bossStatusText = 'ÜBERHITZT';
        }
      }

      if (!airborne) {
        const pDist = Math.hypot(this.playerX - e.x, this.playerY - e.y);
        if (pDist < e.radius + 7) {
          const pushX = (this.playerX - e.x) / Math.max(1, pDist);
          const pushY = (this.playerY - e.y) / Math.max(1, pDist);
          this.damagePlayer(e.kind === 'boss' ? 20 : 12, pushX, pushY, e);
        }
      }
    }
  }

  private getBossPylonPositions(e: Enemy): Array<{ x: number; y: number; depth: number; angle: number }> {
    const count = e.bossPhase2 ? 4 : 3;
    const baseAngle = e.bossOrbitAngle ?? 0;
    const rx = e.bossPylonRadius ?? 28;
    const ry = rx * 0.48;
    const z = e.bossHeight ?? 0;
    const list: Array<{ x: number; y: number; depth: number; angle: number }> = [];
    for (let i = 0; i < count; i++) {
      const a = baseAngle + (i / count) * Math.PI * 2;
      list.push({
        x: e.x + Math.cos(a) * rx,
        y: e.y - 4 - z + Math.sin(a) * ry,
        depth: Math.sin(a),
        angle: a,
      });
    }
    return list;
  }

  private updateBossAI(e: Enemy, dt: number, dx: number, dy: number, nx: number, ny: number): void {
    const enraged = e.hp <= e.maxHp * 0.5;
    const state: BossState = e.bossState ?? 'stalk';

    // Orbiting plasma pylons spin continuously (faster during barrage & Phase 2!)
    const orbitSpeed =
      state === 'pylon_barrage' ? (enraged ? 5.6 : 4.4) : enraged ? 3.1 : 2.1;
    e.bossOrbitAngle = (e.bossOrbitAngle ?? 0) + dt * orbitSpeed;
    const desiredRadius =
      state === 'pylon_barrage' ? 37 : state === 'phase2_roar' ? 42 : 28;
    e.bossPylonRadius =
      (e.bossPylonRadius ?? 28) + (desiredRadius - (e.bossPylonRadius ?? 28)) * Math.min(1, dt * 6);

    // Phase 2 dramatic Overload Transition at 50% HP!
    if (enraged && !e.bossPhase2 && state !== 'slam_air' && state !== 'slam_jump') {
      e.bossPhase2 = true;
      e.bossState = 'phase2_roar';
      e.bossStateTimer = 1.1;
      e.bossStateMax = 1.1;
      e.bossHeight = 0;
      e.bossStatusText = 'KERN-ÜBERLASTUNG!';
      e.vx = 0;
      e.vy = 0;
      sound.playBossRoar();
      this.triggerShake(0.45, 5.2);
      this.shockwaves.push({
        x: e.x,
        y: e.y,
        maxRadius: 96,
        color: '#fb7185',
        life: 0.45,
        maxLife: 0.45,
      });
      this.spawnBurst(e.x, e.y, '#fb7185', 26);
      this.spawnEnemy('slime', ROOM_CENTER_X - 80, ROOM_CENTER_Y);
      this.spawnEnemy('drone', ROOM_CENTER_X + 80, ROOM_CENTER_Y);
      this.callbacks.onToast('⚠ PHASE II: Core-Wächter MK-IV im Überlastungs-Modus!', 'warn');
      return;
    }

    // Continuous thruster & damaged-armor embers
    const sparkRate = enraged ? 16 : 9;
    if (Math.random() < dt * sparkRate) {
      this.particles.push({
        x: e.x + (Math.random() - 0.5) * 18,
        y: e.y + 8 - (e.bossHeight ?? 0) + (Math.random() - 0.5) * 8,
        vx: (Math.random() - 0.5) * 18,
        vy: 14 + Math.random() * 18,
        color: enraged ? (Math.random() > 0.4 ? '#fb7185' : '#fbbf24') : '#38e8d4',
        size: 1.7,
        life: 0.3,
        maxLife: 0.3,
      });
    }

    e.bossStateTimer = (e.bossStateTimer ?? 0) - dt;

    if (state === 'phase2_roar') {
      e.bossHeight = Math.sin((1 - Math.max(0, e.bossStateTimer) / 1.1) * Math.PI) * 14;
      if (Math.random() < dt * 22) {
        const a = Math.random() * Math.PI * 2;
        this.particles.push({
          x: e.x + Math.cos(a) * 16,
          y: e.y - (e.bossHeight ?? 0) + Math.sin(a) * 12,
          vx: Math.cos(a) * 70,
          vy: Math.sin(a) * 70,
          color: '#fb7185',
          size: 2.2,
          life: 0.3,
          maxLife: 0.3,
        });
      }
      if (e.bossStateTimer <= 0) {
        e.bossHeight = 0;
        e.bossState = 'stalk';
        e.bossStateTimer = 0.55;
        e.bossStateMax = 0.55;
        e.bossStatusText = 'ÜBERLASTET';
      }
      return;
    }

    if (state === 'stunned') {
      e.bossHeight = 0;
      if (Math.random() < dt * 12) {
        this.particles.push({
          x: e.x + (Math.random() - 0.5) * 18,
          y: e.y - 12,
          vx: (Math.random() - 0.5) * 20,
          vy: -22,
          color: '#94a3b8',
          size: 2,
          life: 0.35,
          maxLife: 0.35,
        });
      }
      if (e.bossStateTimer <= 0) {
        e.bossState = 'stalk';
        e.bossStateTimer = enraged ? 0.65 : 0.95;
        e.bossStateMax = e.bossStateTimer;
        e.bossStatusText = enraged ? 'ÜBERLASTET' : 'AKTIV';
      }
      return;
    }

    if (state === 'charge_windup') {
      e.vx *= 0.2;
      e.vy *= 0.2;
      // Continuously refine aim for first 60% of windup, then lock lane cleanly!
      if (e.bossStateTimer > (e.bossStateMax ?? 0.62) * 0.38) {
        e.chargeDirX = nx;
        e.chargeDirY = ny;
      }
      if (Math.random() < dt * 20) {
        this.particles.push({
          x: e.x - e.chargeDirX * 14 + (Math.random() - 0.5) * 10,
          y: e.y - e.chargeDirY * 14 + (Math.random() - 0.5) * 8,
          vx: -e.chargeDirX * 65,
          vy: -e.chargeDirY * 65,
          color: '#fb923c',
          size: 2,
          life: 0.22,
          maxLife: 0.22,
        });
      }
      if (e.bossStateTimer <= 0) {
        sound.playBossCharge();
        e.bossState = 'charge_dash';
        e.bossStateTimer = enraged ? 0.58 : 0.52;
        e.bossStateMax = e.bossStateTimer;
        e.bossAfterimageTick = 0;
        e.bossStatusText = 'RAKETEN-RAMME!';
      }
      return;
    }

    if (state === 'charge_dash') {
      const speed = enraged ? 275 : 230;
      e.vx = e.chargeDirX * speed;
      e.vy = e.chargeDirY * speed;
      e.bossAfterimageTick = (e.bossAfterimageTick ?? 0) - dt;
      if (e.bossAfterimageTick <= 0) {
        e.bossAfterimageTick = 0.055;
        this.bossAfterimages.push({
          x: e.x,
          y: e.y,
          height: e.bossHeight ?? 0,
          tilt: e.chargeDirX * 0.26,
          enraged,
          life: 0.24,
          maxLife: 0.24,
        });
      }
      if (e.bossStateTimer <= 0) {
        e.bossState = 'stalk';
        e.bossStateTimer = enraged ? 0.8 : 1.1;
        e.bossStateMax = e.bossStateTimer;
        e.bossStatusText = enraged ? 'ÜBERLASTET' : 'AKTIV';
      }
      return;
    }

    if (state === 'slam_jump') {
      const maxT = e.bossStateMax ?? 0.42;
      const p = 1 - Math.max(0, e.bossStateTimer) / maxT;
      e.bossHeight = Math.pow(p, 0.7) * 76;
      e.vx *= 0.4;
      e.vy *= 0.4;
      if (Math.random() < dt * 26) {
        this.particles.push({
          x: e.x + (Math.random() - 0.5) * 14,
          y: e.y + 10 - (e.bossHeight ?? 0),
          vx: (Math.random() - 0.5) * 28,
          vy: 45 + Math.random() * 35,
          color: '#fbbf24',
          size: 2.2,
          life: 0.25,
          maxLife: 0.25,
        });
      }
      if (e.bossStateTimer <= 0) {
        e.bossState = 'slam_air';
        e.bossStateTimer = enraged ? 0.46 : 0.56;
        e.bossStateMax = e.bossStateTimer;
        e.bossTargetX = this.playerX;
        e.bossTargetY = this.playerY;
        e.bossStatusText = 'SCHWERKRAFT-STURZ!';
      }
      return;
    }

    if (state === 'slam_air') {
      const maxT = e.bossStateMax ?? 0.52;
      const p = 1 - Math.max(0, e.bossStateTimer) / maxT;
      // Track player during first 55% of air hover, then lock landing reticle!
      if (p < 0.55) {
        e.bossTargetX = (e.bossTargetX ?? this.playerX) + (this.playerX - (e.bossTargetX ?? this.playerX)) * Math.min(1, dt * 6);
        e.bossTargetY = (e.bossTargetY ?? this.playerY) + (this.playerY - (e.bossTargetY ?? this.playerY)) * Math.min(1, dt * 6);
      }
      const tx = Math.max(ROOM_LEFT + 26, Math.min(ROOM_RIGHT - 26, e.bossTargetX ?? ROOM_CENTER_X));
      const ty = Math.max(ROOM_TOP + 24, Math.min(ROOM_BOTTOM - 24, e.bossTargetY ?? ROOM_CENTER_Y));
      e.bossTargetX = tx;
      e.bossTargetY = ty;
      e.x += (tx - e.x) * Math.min(1, dt * 7);
      e.y += (ty - e.y) * Math.min(1, dt * 7);

      if (p > 0.72) {
        // Rapid meteor descent!
        const fallP = (p - 0.72) / 0.28;
        e.bossHeight = 76 * (1 - fallP * fallP);
      } else {
        e.bossHeight = 76;
      }

      if (e.bossStateTimer <= 0) {
        e.bossHeight = 0;
        e.x = tx;
        e.y = ty;
        sound.playBossSlam();
        this.triggerShake(0.36, 5.5);
        // Scorched crater decal + double shockwave + radial embers!
        this.decals.push({
          x: e.x,
          y: e.y + 8,
          r: 22,
          color: 'rgba(15, 23, 42, 0.55)',
          life: 6.0,
          maxLife: 6.0,
        });
        this.shockwaves.push({
          x: e.x,
          y: e.y + 4,
          maxRadius: 68,
          color: enraged ? '#fb7185' : '#fb923c',
          life: 0.34,
          maxLife: 0.34,
        });
        this.shockwaves.push({
          x: e.x,
          y: e.y + 4,
          maxRadius: 42,
          color: '#fde047',
          life: 0.24,
          maxLife: 0.24,
        });
        this.spawnBurst(e.x, e.y + 4, '#fbbf24', 24);
        const bolts = enraged ? 10 : 8;
        for (let k = 0; k < bolts; k++) {
          const a = (k / bolts) * Math.PI * 2 + 0.2;
          this.fireEnemyBolt(e.x, e.y, a, enraged ? 132 : 112, 15, '#fb923c');
        }
        // Slam AoE hit check
        const distPlayer = Math.hypot(this.playerX - e.x, this.playerY - e.y);
        if (distPlayer <= 44) {
          const px = (this.playerX - e.x) / Math.max(1, distPlayer);
          const py = (this.playerY - e.y) / Math.max(1, distPlayer);
          this.damagePlayer(24, px, py, e);
        }
        e.bossState = 'slam_impact';
        e.bossStateTimer = 0.42;
        e.bossStateMax = 0.42;
        e.bossStatusText = 'EINSCHLAG!';
      }
      return;
    }

    if (state === 'slam_impact') {
      e.vx *= 0.2;
      e.vy *= 0.2;
      if (e.bossStateTimer <= 0) {
        e.bossState = 'stalk';
        e.bossStateTimer = enraged ? 0.78 : 1.05;
        e.bossStateMax = e.bossStateTimer;
        e.bossStatusText = enraged ? 'ÜBERLASTET' : 'AKTIV';
      }
      return;
    }

    if (state === 'laser_windup') {
      e.vx *= 0.25;
      e.vy *= 0.25;
      e.bossHeight = 6 + Math.sin(this.time * 18) * 1.5;
      // Spiral imploding energy motes into boss reactor core!
      if (Math.random() < dt * 28) {
        const a = Math.random() * Math.PI * 2;
        this.particles.push({
          x: e.x + Math.cos(a) * 28,
          y: e.y - 6 + Math.sin(a) * 22,
          vx: -Math.cos(a) * 78,
          vy: -Math.sin(a) * 78,
          color: enraged ? '#fb7185' : '#fde047',
          size: 1.8,
          life: 0.3,
          maxLife: 0.3,
        });
      }
      if (e.bossStateTimer <= 0) {
        sound.playBossLaser();
        this.triggerShake(0.25, 2.5);
        e.bossState = 'laser_sweep';
        e.bossStateTimer = enraged ? 1.25 : 1.1;
        e.bossStateMax = e.bossStateTimer;
        e.bossLaserTick = 0;
        e.bossStatusText = 'KERN-LASER!';
      }
      return;
    }

    if (state === 'laser_sweep') {
      e.vx *= 0.15;
      e.vy *= 0.15;
      e.bossHeight = 6;
      const sweepRate = (enraged ? 2.15 : 1.75) * (e.bossLaserDir ?? 1);
      e.bossLaserAngle = (e.bossLaserAngle ?? 0) + sweepRate * dt;

      // Raycast laser to wall & damage player if intersected!
      const lx = e.x;
      const ly = e.y - 8;
      const cosA = Math.cos(e.bossLaserAngle);
      const sinA = Math.sin(e.bossLaserAngle);
      let maxT = 320;
      for (let t = 12; t < 320; t += 6) {
        const px = lx + cosA * t;
        const py = ly + sinA * t;
        if (px < ROOM_LEFT || px > ROOM_RIGHT || py < ROOM_TOP || py > ROOM_BOTTOM) {
          maxT = t;
          break;
        }
      }
      const exWall = lx + cosA * maxT;
      const eyWall = ly + sinA * maxT;
      if (Math.random() < dt * 26) {
        this.particles.push({
          x: exWall,
          y: eyWall,
          vx: -cosA * 40 + (Math.random() - 0.5) * 45,
          vy: -sinA * 40 + (Math.random() - 0.5) * 45,
          color: '#fde047',
          size: 1.9,
          life: 0.22,
          maxLife: 0.22,
        });
      }
      const distLine = this.pointToSegmentDist(this.playerX, this.playerY, lx, ly, exWall, eyWall);
      if (distLine <= 11) {
        this.damagePlayer(18, -sinA * (e.bossLaserDir ?? 1), cosA * (e.bossLaserDir ?? 1), e);
      }

      if (e.bossStateTimer <= 0) {
        e.bossHeight = 0;
        e.bossState = 'stalk';
        e.bossStateTimer = enraged ? 0.85 : 1.15;
        e.bossStateMax = e.bossStateTimer;
        e.bossStatusText = enraged ? 'ÜBERLASTET' : 'AKTIV';
      }
      return;
    }

    if (state === 'pylon_barrage') {
      e.bossHeight = 5 + Math.sin(this.time * 8) * 2;
      e.vx += nx * 24 * dt;
      e.vy += ny * 24 * dt;
      e.burstDelay -= dt;
      if (e.subBurst > 0 && e.burstDelay <= 0) {
        // Fire projectiles straight out of EACH orbiting plasma pylon!
        const pylons = this.getBossPylonPositions(e);
        for (const py of pylons) {
          const toPlayer = Math.atan2(this.playerY - py.y, this.playerX - py.x);
          const aim = e.subBurst % 2 === 0 ? toPlayer : py.angle;
          this.fireEnemyBolt(py.x, py.y, aim, enraged ? 148 : 122, 14, enraged ? '#fb7185' : '#38e8d4');
          this.spawnBurst(py.x, py.y, enraged ? '#fb7185' : '#38e8d4', 4);
        }
        sound.playBlaster();
        e.subBurst -= 1;
        e.burstDelay = enraged ? 0.24 : 0.3;
      }
      if (e.bossStateTimer <= 0) {
        e.bossHeight = 0;
        e.bossState = 'stalk';
        e.bossStateTimer = enraged ? 0.8 : 1.05;
        e.bossStateMax = e.bossStateTimer;
        e.bossStatusText = enraged ? 'ÜBERLASTET' : 'AKTIV';
      }
      return;
    }

    // Default 'stalk' state: active hovering pursuit + lateral weave, then launch next attack!
    e.bossHeight = Math.max(0, (e.bossHeight ?? 0) - dt * 20);
    const sway = Math.sin(this.time * 2.4) * 38;
    e.vx += (nx * (enraged ? 58 : 44) - ny * sway) * dt * 3.0;
    e.vy += (ny * (enraged ? 58 : 44) + nx * sway) * dt * 3.0;

    if (e.bossStateTimer <= 0) {
      const atk = e.phase % 4;
      e.phase += 1;
      if (atk === 0) {
        // Orbital Pylon Barrage
        e.bossState = 'pylon_barrage';
        e.subBurst = enraged ? 4 : 3;
        e.burstDelay = 0.35;
        e.bossStateTimer = enraged ? 1.35 : 1.28;
        e.bossStateMax = e.bossStateTimer;
        e.bossStatusText = 'ORBIT-SALVE!';
      } else if (atk === 1) {
        // Rocket Charge Dash
        e.bossState = 'charge_windup';
        e.bossStateTimer = enraged ? 0.54 : 0.64;
        e.bossStateMax = e.bossStateTimer;
        e.chargeDirX = nx;
        e.chargeDirY = ny;
        e.bossStatusText = 'ANLAUF...';
      } else if (atk === 2) {
        // Gravity Jump Slam
        e.bossState = 'slam_jump';
        e.bossStateTimer = 0.4;
        e.bossStateMax = 0.4;
        e.bossTargetX = this.playerX;
        e.bossTargetY = this.playerY;
        sound.playDash();
        e.bossStatusText = 'SPRUNG-ANGRIFF!';
      } else {
        // Sweeping Reactor Laser!
        e.bossState = 'laser_windup';
        e.bossStateTimer = enraged ? 0.65 : 0.76;
        e.bossStateMax = e.bossStateTimer;
        e.bossLaserDir = Math.random() > 0.5 ? 1 : -1;
        e.bossLaserAngle = Math.atan2(dy, dx) - e.bossLaserDir * 0.95;
        e.bossStatusText = 'LASER LÄDT...';
      }
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
    const resistance = e.kind === 'boss' ? 0.12 : e.kind === 'turret' ? 0.35 : 1.0;
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
    this.spawnBurst(e.x, e.y, e.kind === 'boss' ? '#fbbf24' : '#c084fc', e.kind === 'boss' ? 36 : 14);

    if (e.kind === 'boss') {
      this.triggerShake(0.5, 5.5);
      this.shockwaves.push({
        x: e.x,
        y: e.y,
        maxRadius: 92,
        color: '#fbbf24',
        life: 0.45,
        maxLife: 0.45,
      });
      this.bossDefeatedInRun = true;
      this.state.bossDefeatedCount += 1;
      this.spawnLootDrop(e.x, e.y, 'mk4_heart');
      for (let k = 0; k < 3; k++) {
        this.spawnLootDrop(e.x, e.y, rollLootItem(2, k === 0));
      }
      this.callbacks.onToast(
        'SIEG! Core-Wächter MK-IV besiegt! Sammle den Loot und nutze das Sieges-Portal [E]!',
        'good',
      );
      this.state.save();
    } else if (Math.random() < 0.8) {
      this.spawnLootDrop(e.x, e.y, rollLootItem(this.currentRoom.depth));
    }

    if (this.enemies.length === 0 && !this.currentRoom.cleared) {
      this.currentRoom.cleared = true;
      this.roomsCleared += 1;
      sound.playDoorUnlock();
      if (this.currentRoom.type === 'combat') {
        this.spawnLootDrop(ROOM_CENTER_X, ROOM_CENTER_Y, rollLootItem(this.currentRoom.depth));
      }
      // Dr. Lyra's Nano-Vitalserum passive heal on room clear!
      const stats = this.state.getStats();
      if (stats.roomClearHeal > 0 && this.state.hp < stats.maxHp) {
        const healed = Math.min(stats.maxHp - this.state.hp, stats.roomClearHeal);
        this.state.hp += healed;
        sound.playHeal();
        this.spawnBurst(this.playerX, this.playerY, '#34d399', 12);
        this.floats.push({
          x: this.playerX,
          y: this.playerY - 16,
          text: `+${Math.round(healed)} BIO`,
          color: '#34d399',
          life: 1.0,
          maxLife: 1.0,
        });
        this.callbacks.onHudDirty();
      }
    }
  }

  private damagePlayer(amount: number, kx: number, ky: number, attacker?: Enemy): void {
    if (this.invulnTimer > 0 || this.finished) return;

    // Check Hex-Aegis Kinetic Shield block!
    let finalAmount = amount;
    if (this.shieldActive) {
      const incomingAngle = Math.atan2(-ky, -kx);
      const diff = Math.abs(this.normalizeAngle(incomingAngle - this.shieldAngle));
      if (diff <= Math.PI * 0.6) {
        const isPerfect = this.shieldHoldTime <= 0.24;
        finalAmount = isPerfect ? 0 : Math.max(2, Math.round(amount * 0.25));
        this.shieldHitFlash = 1.0;
        this.shieldRipple = 1.0;
        this.shieldRippleAngle = incomingAngle;
        this.shieldRecoil = 1.0;
        if (isPerfect) {
          sound.playPerfectParry();
          this.hitStop = 0.04;
          this.triggerShake(0.14, 2.8);
          this.state.energy = Math.min(100, this.state.energy + 14);
          this.shockwaves.push({
            x: this.playerX + Math.cos(this.shieldAngle) * 12,
            y: this.playerY + Math.sin(this.shieldAngle) * 12,
            maxRadius: 34,
            color: '#fde047',
            life: 0.2,
            maxLife: 0.2,
          });
        } else {
          sound.playShieldBlock();
        }
        this.spawnBurst(
          this.playerX + Math.cos(this.shieldAngle) * 13,
          this.playerY + Math.sin(this.shieldAngle) * 13,
          isPerfect ? '#fde047' : '#38e8d4',
          isPerfect ? 16 : 10,
        );
        if (attacker) {
          attacker.vx -= kx * (isPerfect ? 230 : 150);
          attacker.vy -= ky * (isPerfect ? 230 : 150);
        }
        this.floats.push({
          x: this.playerX,
          y: this.playerY - 17,
          text: isPerfect ? 'PERFEKT!' : `BLOCK -${finalAmount}`,
          color: isPerfect ? '#fde047' : '#38e8d4',
          life: 0.8,
          maxLife: 0.8,
        });
        if (isPerfect) {
          this.invulnTimer = Math.max(this.invulnTimer, 0.35);
          this.callbacks.onHudDirty();
          return;
        }
      }
    }

    this.state.hp = Math.max(0, this.state.hp - finalAmount);
    this.invulnTimer = 0.72;
    this.playerFlashTimer = 0.15;
    this.warpChannel = 0;
    this.moveEntityWithCollisions(kx * 10, ky * 10);

    if (finalAmount === amount) {
      sound.playPlayerHurt();
      this.triggerShake(0.2, 3.5);
      this.spawnBurst(this.playerX, this.playerY, '#fb7185', 10);
      this.floats.push({
        x: this.playerX,
        y: this.playerY - 14,
        text: `-${finalAmount}`,
        color: '#fb7185',
        life: 0.85,
        maxLife: 0.85,
      });
    }
    this.callbacks.onHudDirty();

    if (this.state.hp <= 0) {
      this.triggerDefeat();
    }
  }

  private breakPod(pod: DungeonRoom['pods'][number]): void {
    pod.broken = true;
    sound.playHit();
    this.spawnBurst(pod.x, pod.y, '#fbbf24', 10);
    if (Math.random() < 0.68) {
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
          if (e.kind === 'boss' && (e.bossHeight ?? 0) > 28) continue;
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
        // Check Hex-Aegis Kinetic Shield projectile block & Perfect Parry Reflect!
        if (this.shieldActive && Math.hypot(this.playerX - p.x, this.playerY - p.y) < 18 + p.radius) {
          const toBolt = Math.atan2(p.y - this.playerY, p.x - this.playerX);
          if (Math.abs(this.normalizeAngle(toBolt - this.shieldAngle)) <= Math.PI * 0.58) {
            const isPerfect = this.shieldHoldTime <= 0.24;
            this.shieldHitFlash = 1.0;
            this.shieldRipple = 1.0;
            this.shieldRippleAngle = toBolt;
            this.shieldRecoil = 1.0;

            if (isPerfect) {
              // Reflect the enemy projectile back in blazing gold at 1.9x speed & 2x damage!
              sound.playPerfectParry();
              this.hitStop = 0.036;
              this.triggerShake(0.12, 2.4);
              const speed = Math.max(240, Math.hypot(p.vx, p.vy) * 1.9);
              p.fromPlayer = true;
              p.vx = Math.cos(this.shieldAngle) * speed;
              p.vy = Math.sin(this.shieldAngle) * speed;
              p.damage = Math.max(26, Math.round(p.damage * 2.1));
              p.color = '#fde047';
              p.radius = 4.5;
              p.life = 1.8;
              this.state.energy = Math.min(100, this.state.energy + 14);
              this.spawnBurst(p.x, p.y, '#fde047', 14);
              this.shockwaves.push({
                x: p.x,
                y: p.y,
                maxRadius: 28,
                color: '#fde047',
                life: 0.18,
                maxLife: 0.18,
              });
              this.floats.push({
                x: p.x,
                y: p.y - 10,
                text: 'KONTER!',
                color: '#fde047',
                life: 0.75,
                maxLife: 0.75,
              });
            } else {
              sound.playShieldBlock();
              this.spawnBurst(p.x, p.y, '#38e8d4', 11);
              this.state.energy = Math.min(100, this.state.energy + 7);
              this.floats.push({
                x: p.x,
                y: p.y - 8,
                text: 'PARADE!',
                color: '#38e8d4',
                life: 0.65,
                maxLife: 0.65,
              });
              this.projectiles.splice(i, 1);
            }
            this.callbacks.onHudDirty();
            continue;
          }
        }

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

    if (this.currentRoom.type === 'start') {
      if (Math.hypot(this.playerX - ROOM_CENTER_X, this.playerY - (ROOM_CENTER_Y - 12)) < 28) {
        this.activePrompt = {
          label: '[E] Extraktion: Port Solaris (Gratis)',
          x: ROOM_CENTER_X,
          y: ROOM_CENTER_Y - 32,
        };
        if (input.interactPressed()) {
          this.triggerSafeWarp('warp', false);
        }
        return;
      }
    }

    if (this.currentRoom.type === 'boss' && this.bossDefeatedInRun) {
      if (Math.hypot(this.playerX - ROOM_CENTER_X, this.playerY - ROOM_CENTER_Y) < 30) {
        this.activePrompt = {
          label: '[E] Sieges-Extraktion: Port Solaris!',
          x: ROOM_CENTER_X,
          y: ROOM_CENTER_Y - 26,
        };
        if (input.interactPressed()) {
          this.triggerSafeWarp('boss_victory', false);
        }
        return;
      }
    }

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
    this.callbacks.onReturnToHub({
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
    this.callbacks.onReturnToHub({
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
    for (let i = this.swings.length - 1; i >= 0; i--) {
      this.swings[i].life -= dt;
      if (this.swings[i].life <= 0) this.swings.splice(i, 1);
    }
    for (let i = this.slashHits.length - 1; i >= 0; i--) {
      this.slashHits[i].life -= dt;
      if (this.slashHits[i].life <= 0) this.slashHits.splice(i, 1);
    }
    for (let i = this.bossAfterimages.length - 1; i >= 0; i--) {
      this.bossAfterimages[i].life -= dt;
      if (this.bossAfterimages[i].life <= 0) this.bossAfterimages.splice(i, 1);
    }
    for (let i = this.beams.length - 1; i >= 0; i--) {
      this.beams[i].life -= dt;
      if (this.beams[i].life <= 0) this.beams.splice(i, 1);
    }
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      this.shockwaves[i].life -= dt;
      if (this.shockwaves[i].life <= 0) this.shockwaves.splice(i, 1);
    }
    for (let i = this.decals.length - 1; i >= 0; i--) {
      this.decals[i].life -= dt;
      if (this.decals[i].life <= 0) this.decals.splice(i, 1);
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

  // ==================== HD RENDERING ====================
  public render(ctx: CanvasRenderingContext2D, input: InputManager): void {
    const art = getHDArt();
    const atlas = getAtlas();

    ctx.save();
    if (this.shakeTimer > 0) {
      const sx = (Math.random() - 0.5) * 2 * this.shakeMag;
      const sy = (Math.random() - 0.5) * 2 * this.shakeMag;
      ctx.translate(sx, sy);
    }

    if (art.dungeonBg) {
      ctx.drawImage(art.dungeonBg, 0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    } else {
      ctx.fillStyle = '#0e131f';
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    }

    // Floor slime & crater decals
    for (const d of this.decals) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, d.life / d.maxLife);
      ctx.fillStyle = d.color;
      ctx.beginPath();
      ctx.ellipse(d.x, d.y, d.r, d.r * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Ambient bioluminescent spores
    for (let s = 0; s < 10; s++) {
      const sx = ROOM_LEFT + ((s * 73 + this.currentRoom.tileSeed) % (ROOM_RIGHT - ROOM_LEFT));
      const sy =
        ROOM_TOP +
        ((s * 47 + Math.floor(this.time * 8) + this.currentRoom.tileSeed) % (ROOM_BOTTOM - ROOM_TOP));
      const a = 0.25 + 0.45 * Math.sin(this.time * 2.5 + s);
      ctx.fillStyle = `rgba(56, 232, 212, ${Math.max(0, a)})`;
      ctx.fillRect(sx + Math.sin(this.time + s) * 4, sy, 1.5, 1.5);
    }

    this.renderDoors(ctx);

    if (this.currentRoom.type === 'start') {
      this.renderWarpPad(ctx, ROOM_CENTER_X, ROOM_CENTER_Y - 12, '#38e8d4');
    } else if (this.currentRoom.type === 'boss' && this.bossDefeatedInRun) {
      this.renderWarpPad(ctx, ROOM_CENTER_X, ROOM_CENTER_Y, '#fbbf24');
    }

    for (const ob of this.currentRoom.obstacles) {
      this.renderObstacle(ctx, ob);
    }

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

    // Glowing Rocket-Charge Boss Afterimages!
    for (const ba of this.bossAfterimages) {
      const alpha = (ba.life / ba.maxLife) * 0.48;
      if (art.bossFlash) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = alpha;
        ctx.translate(ba.x, ba.y - ba.height);
        ctx.rotate(ba.tilt);
        ctx.drawImage(art.bossFlash, -26, -28, 52, 50);
        ctx.restore();
      }
      drawGlow(ctx, ba.x, ba.y - ba.height, 26, ba.enraged ? '#fb7185' : '#fb923c', alpha * 0.7);
    }

    // Enemy & Boss Floor Telegraphs (Drone Laser Sightlines, Boss Charge Lanes, Slam Target Reticles, Laser Aim!)
    for (const e of this.enemies) {
      if (e.kind === 'drone' && e.telegraphTimer > 0) {
        ctx.save();
        ctx.strokeStyle = `rgba(251, 113, 133, ${0.4 + 0.4 * Math.sin(this.time * 36)})`;
        ctx.lineWidth = 1.2;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(e.x + Math.cos(e.aimAngle) * 145, e.y + Math.sin(e.aimAngle) * 145);
        ctx.stroke();
        ctx.restore();
      } else if (e.kind === 'boss') {
        this.renderBossFloorTelegraph(ctx, e);
      }
    }

    // Depth-sorted enemies & hero (airborne boss renders above grounded actors!)
    type Drawable = { y: number; draw: () => void };
    const drawables: Drawable[] = [];
    for (const e of this.enemies) {
      const sortY = e.kind === 'boss' && (e.bossHeight ?? 0) > 12 ? 999 : e.y;
      drawables.push({ y: sortY, draw: () => this.renderEnemy(ctx, e) });
    }
    drawables.push({ y: this.playerY, draw: () => this.renderPlayer(ctx) });
    drawables.sort((a, b) => a.y - b.y);
    for (const d of drawables) d.draw();

    // Active Boss Sweeping Reactor Laser Beam!
    for (const e of this.enemies) {
      if (e.kind === 'boss' && e.bossState === 'laser_sweep') {
        this.renderBossLaserBeam(ctx, e);
      }
    }

    // Faceted 2.5D Hex-Aegis Kinetic Shield (animates smoothly on deploy & retract!)
    if (this.shieldOpenAnim > 0.02) {
      this.renderKineticShield(ctx);
    }

    // Hand-Crafted 2.5D Tapered Crescent Weapon Swings + Ghost-Blade Trails!
    for (const s of this.swings) {
      this.renderWeaponSwing(ctx, s);
    }

    // Crisp X-Slash Impact Flashes on Struck Enemies!
    for (const h of this.slashHits) {
      const t = 1 - h.life / h.maxLife;
      const alpha = Math.max(0, 1 - t);
      const len = 11 + t * 9;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.translate(h.x, h.y);
      ctx.rotate(h.angle);
      for (const offset of [-0.55, 0.55]) {
        ctx.save();
        ctx.rotate(offset);
        ctx.fillStyle = h.color;
        ctx.globalAlpha = alpha * 0.85;
        ctx.beginPath();
        ctx.moveTo(-len, 0);
        ctx.lineTo(0, -2.8 * (1 - t * 0.5));
        ctx.lineTo(len, 0);
        ctx.lineTo(0, 2.8 * (1 - t * 0.5));
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.moveTo(-len * 0.72, 0);
        ctx.lineTo(0, -1.1);
        ctx.lineTo(len * 0.72, 0);
        ctx.lineTo(0, 1.1);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    }

    // Piercing Railgun Beams (Puls-Blaster Secondary!)
    for (const b of this.beams) {
      const alpha = b.life / b.maxLife;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      ctx.strokeStyle = `rgba(56, 189, 248, ${alpha * 0.55})`;
      ctx.lineWidth = 11 * alpha + 3;
      ctx.beginPath();
      ctx.moveTo(b.x1, b.y1);
      ctx.lineTo(b.x2, b.y2);
      ctx.stroke();

      ctx.strokeStyle = `rgba(56, 232, 212, ${alpha})`;
      ctx.lineWidth = 5 * alpha + 1.5;
      ctx.beginPath();
      ctx.moveTo(b.x1, b.y1);
      ctx.lineTo(b.x2, b.y2);
      ctx.stroke();

      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(b.x1, b.y1);
      ctx.lineTo(b.x2, b.y2);
      ctx.stroke();
      ctx.restore();
    }

    // Shockwave Rings (Hammer Secondary, Blade Finisher & Boss Slam!)
    for (const sw of this.shockwaves) {
      const progress = 1 - sw.life / sw.maxLife;
      const r = 10 + (sw.maxRadius - 10) * progress;
      const alpha = 1 - progress;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = sw.color;
      ctx.globalAlpha = alpha * 0.85;
      ctx.lineWidth = 4 * alpha + 1;
      ctx.beginPath();
      ctx.ellipse(sw.x, sw.y, r, r * 0.78, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    for (const p of this.projectiles) {
      drawGlow(ctx, p.x, p.y, 12, p.color, 0.55);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
    }

    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;

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

    if (input.isMouseActive() && !input.locked) {
      const m = input.getMousePos();
      ctx.strokeStyle = 'rgba(56, 232, 212, 0.8)';
      ctx.lineWidth = 0.8;
      ctx.strokeRect(m.x - 3.5, m.y - 3.5, 7, 7);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(m.x - 0.5, m.y - 0.5, 1, 1);
    }

    ctx.restore();

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

  /**
   * Draws a razor-sharp 2.5D tapered polygon crescent ribbon (Moonlighter / Hyper Light Drifter feel)
   * that starts needle-thin at tailAngle and swells smoothly into a cutting blade head at headAngle.
   */
  private drawTaperedCrescent(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    baseRadius: number,
    tailAngle: number,
    headAngle: number,
    maxThickness: number,
    squashY: number,
    fillStyle: string,
  ): void {
    const segs = 22;
    ctx.fillStyle = fillStyle;
    ctx.beginPath();
    // Outer cutting edge (tail -> head)
    for (let i = 0; i <= segs; i++) {
      const u = i / segs;
      const a = tailAngle + (headAngle - tailAngle) * u;
      const taper = Math.sin(Math.pow(u, 0.68) * Math.PI);
      const rOut = baseRadius + taper * maxThickness * 0.55;
      const px = cx + Math.cos(a) * rOut;
      const py = cy + Math.sin(a) * rOut * squashY;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    // Inner trailing edge (head -> tail)
    for (let i = segs; i >= 0; i--) {
      const u = i / segs;
      const a = tailAngle + (headAngle - tailAngle) * u;
      const taper = Math.sin(Math.pow(u, 0.85) * Math.PI);
      const rIn = Math.max(4, baseRadius - taper * maxThickness * 0.72);
      const px = cx + Math.cos(a) * rIn;
      const py = cy + Math.sin(a) * rIn * squashY;
      ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }

  private renderWeaponSwing(ctx: CanvasRenderingContext2D, s: WeaponSwing): void {
    const art = getHDArt();
    const t = 1 - s.life / s.maxLife; // 0 -> 1 over swing
    const alpha = Math.max(0, 1 - Math.pow(t, 1.45));
    // Ultra-snappy whip-out curve: fast slice across front, crisp hang at follow-through!
    const eased = 1 - Math.pow(1 - t, 3.6);

    const startA = s.dir === 1 ? s.angle - s.sweep / 2 : s.angle + s.sweep / 2;
    const endA = s.dir === 1 ? s.angle + s.sweep / 2 : s.angle - s.sweep / 2;
    const curA = startA + (endA - startA) * eased;
    const trailFrac = Math.max(0, eased - (s.comboStep === 2 ? 0.85 : 0.78));
    const tailA = startA + (endA - startA) * trailFrac;

    const isHammer = s.weapon === 'hammer';
    const isBackhand = s.weapon === 'blade' && s.comboStep === 1;
    const isFinisher = s.weapon === 'blade' && s.comboStep === 2;
    const cx = this.playerX;
    const cy = this.playerY - 2;
    const squashY = 0.84;

    const outerGlow = isHammer
      ? `rgba(234, 88, 12, ${alpha * 0.52})`
      : isFinisher
        ? `rgba(245, 158, 11, ${alpha * 0.56})`
        : isBackhand
          ? `rgba(56, 189, 248, ${alpha * 0.52})`
          : `rgba(13, 148, 136, ${alpha * 0.55})`;

    const midCore = isHammer
      ? `rgba(251, 146, 60, ${alpha * 0.92})`
      : isFinisher
        ? `rgba(253, 224, 71, ${alpha * 0.95})`
        : isBackhand
          ? `rgba(103, 232, 249, ${alpha * 0.92})`
          : `rgba(56, 232, 212, ${alpha * 0.94})`;

    const edgeWhite = `rgba(255, 255, 255, ${alpha * 0.96})`;

    // 1. Multi-layered 2.5D Tapered Energy Crescent Ribbon!
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // Wide outer atmospheric energy plume
    this.drawTaperedCrescent(
      ctx,
      cx,
      cy,
      s.radius * 0.82,
      tailA,
      curA,
      isHammer ? 19 : isFinisher ? 17 : 14,
      squashY,
      outerGlow,
    );

    // Rich primary razor crescent
    this.drawTaperedCrescent(
      ctx,
      cx,
      cy,
      s.radius * 0.88,
      tailA + (curA - tailA) * 0.08,
      curA,
      isHammer ? 12 : isFinisher ? 11 : 9,
      squashY,
      midCore,
    );

    // Twin inner plasma streak on Combo 3 Finisher or Backhand!
    if (isFinisher || isBackhand) {
      this.drawTaperedCrescent(
        ctx,
        cx,
        cy,
        s.radius * 0.62,
        tailA + (curA - tailA) * 0.14,
        curA,
        isFinisher ? 6.5 : 4.2,
        squashY,
        isFinisher ? `rgba(56, 232, 212, ${alpha * 0.85})` : `rgba(167, 243, 208, ${alpha * 0.65})`,
      );
    }

    // Razor white-hot leading cutting edge
    this.drawTaperedCrescent(
      ctx,
      cx,
      cy,
      s.radius * 0.96,
      tailA + (curA - tailA) * 0.28,
      curA,
      isHammer ? 4.2 : 3.2,
      squashY,
      edgeWhite,
    );

    // Crisp kinetic speed-line arc slicing inside the ribbon
    ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.55})`;
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    for (let i = 0; i <= 14; i++) {
      const u = i / 14;
      const a = tailA + (curA - tailA) * (0.2 + u * 0.78);
      const rLine = s.radius * 0.74;
      const px = cx + Math.cos(a) * rLine;
      const py = cy + Math.sin(a) * rLine * squashY;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();

    // 2. 3-Frame Motion-Blur Ghost Trail + Solid HD Weapon Sprite sweeping around hero's hand!
    const wepSpr = isHammer ? art.weapons.hammer : art.weapons.blade;
    if (wepSpr) {
      const baseSize = isHammer ? 30 : isFinisher ? 28 : 25;
      const swingReach = isHammer ? 10 : 8;
      const velScale = 1 + Math.sin(t * Math.PI) * 0.14;

      // 3 fading motion-blur afterimages trailing behind the active blade!
      for (let g = 3; g >= 1; g--) {
        const gFrac = Math.max(0, eased - g * 0.11);
        const gA = startA + (endA - startA) * gFrac;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = alpha * (0.42 - g * 0.1);
        ctx.translate(cx + Math.cos(gA) * swingReach, cy + Math.sin(gA) * swingReach * squashY);
        ctx.rotate(gA + Math.PI / 4);
        ctx.drawImage(wepSpr, -baseSize * 0.18, -baseSize * 0.92, baseSize, baseSize);
        ctx.restore();
      }

      // Main crisp weapon sprite at current blade head
      ctx.save();
      ctx.translate(cx + Math.cos(curA) * swingReach, cy + Math.sin(curA) * swingReach * squashY);
      ctx.rotate(curA + Math.PI / 4);
      ctx.scale(velScale, velScale);
      ctx.drawImage(wepSpr, -baseSize * 0.18, -baseSize * 0.92, baseSize, baseSize);
      ctx.restore();

      // Gleaming 4-point pixel star-glint right at the plasma blade tip!
      if (t < 0.72) {
        const tipX = cx + Math.cos(curA) * (s.radius * 0.96);
        const tipY = cy + Math.sin(curA) * (s.radius * 0.96) * squashY;
        const glint = (1 - t / 0.72) * (isFinisher ? 9 : 6.5);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(tipX - glint, tipY - 0.8, glint * 2, 1.6);
        ctx.fillRect(tipX - 0.8, tipY - glint, 1.6, glint * 2);
        drawGlow(ctx, tipX, tipY, 14, isHammer ? '#fb923c' : isFinisher ? '#fde047' : '#38e8d4', alpha * 0.75);
        ctx.restore();
      }
    }
  }

  private renderKineticShield(ctx: CanvasRenderingContext2D): void {
    const open = this.shieldOpenAnim;
    // Elastic snap-open spring curve
    const spring = open < 1 ? open * (1 + Math.sin(open * Math.PI) * 0.14) : 1;
    const halfSpan = Math.PI * 0.46 * Math.min(1.06, spring);
    if (halfSpan < 0.05) return;

    const cx = this.playerX;
    const cy = this.playerY - 2;
    const squashY = 0.86;
    const baseR = 17.5 - this.shieldRecoil * 2.8;
    const innerR = baseR - 5.2;
    const outerR = baseR + 2.4;
    const panels = 6;
    const startA = this.shieldAngle - halfSpan;
    const endA = this.shieldAngle + halfSpan;

    const pulse = 0.5 + 0.5 * Math.sin(this.time * 11);
    const perfectWindow = this.shieldActive && this.shieldHoldTime <= 0.24;
    const flash = Math.max(this.shieldHitFlash, perfectWindow ? 0.55 : 0);
    const alpha = Math.min(1, open * 1.15);

    const pt = (r: number, a: number) => ({
      x: cx + Math.cos(a) * r,
      y: cy + Math.sin(a) * r * squashY,
    });

    const emitter = pt(6.5, this.shieldAngle);
    const leftTip = pt(baseR, startA);
    const rightTip = pt(baseR, endA);
    const frontMid = pt(outerR + 0.8, this.shieldAngle);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // 1. Holographic projector beams shooting from hero's wrist emitter to shield wings!
    ctx.strokeStyle = flash > 0.4 ? `rgba(253, 224, 71, ${alpha * 0.45})` : `rgba(56, 232, 212, ${alpha * 0.36})`;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(emitter.x, emitter.y);
    ctx.lineTo(leftTip.x, leftTip.y);
    ctx.moveTo(emitter.x, emitter.y);
    ctx.lineTo(rightTip.x, rightTip.y);
    ctx.stroke();

    // 2. Translucent 6-Panel Faceted 2.5D Hex-Aegis Field Fill!
    ctx.beginPath();
    for (let i = 0; i <= panels; i++) {
      const a = startA + (endA - startA) * (i / panels);
      const p = pt(outerR, a);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    for (let i = panels; i >= 0; i--) {
      const a = startA + (endA - startA) * (i / panels);
      const p = pt(innerR, a);
      ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.fillStyle =
      flash > 0.35
        ? `rgba(253, 224, 71, ${alpha * (0.28 + flash * 0.34)})`
        : `rgba(20, 184, 166, ${alpha * (0.24 + pulse * 0.1)})`;
    ctx.fill();

    // 3. Illuminated Sci-Fi Honeycomb / Facet Grid Struts + Traveling Scanline!
    const scanIdx = ((this.time * 4.2) % (panels + 1)) - 0.5;
    for (let i = 0; i < panels; i++) {
      const a0 = startA + (endA - startA) * (i / panels);
      const a1 = startA + (endA - startA) * ((i + 1) / panels);
      const am = (a0 + a1) * 0.5;
      const scanBoost = Math.max(0, 1 - Math.abs(i - scanIdx) * 0.85);

      const o0 = pt(outerR, a0);
      const o1 = pt(outerR, a1);
      const i0 = pt(innerR, a0);
      const i1 = pt(innerR, a1);
      const midIn = pt((innerR + outerR) * 0.5, am);

      // Highlight individual scanned facet subtly
      if (scanBoost > 0.15) {
        ctx.fillStyle = `rgba(165, 243, 252, ${alpha * scanBoost * 0.28})`;
        ctx.beginPath();
        ctx.moveTo(o0.x, o0.y);
        ctx.lineTo(o1.x, o1.y);
        ctx.lineTo(i1.x, i1.y);
        ctx.lineTo(i0.x, i0.y);
        ctx.closePath();
        ctx.fill();
      }

      // Crisp honeycomb diagonal struts inside each energy panel
      ctx.strokeStyle =
        flash > 0.45
          ? `rgba(255, 251, 235, ${alpha * 0.8})`
          : `rgba(103, 232, 249, ${alpha * (0.42 + scanBoost * 0.45)})`;
      ctx.lineWidth = 0.85;
      ctx.beginPath();
      ctx.moveTo(i0.x, i0.y);
      ctx.lineTo(o0.x, o0.y);
      ctx.moveTo(i0.x, i0.y);
      ctx.lineTo(midIn.x, midIn.y);
      ctx.lineTo(o1.x, o1.y);
      ctx.stroke();
    }

    // 4. Outer Razor Facet Frame (Teal Halo + Incandescent Core Edge)
    ctx.strokeStyle =
      flash > 0.4
        ? `rgba(253, 224, 71, ${alpha * 0.92})`
        : `rgba(56, 232, 212, ${alpha * (0.85 + pulse * 0.15)})`;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    for (let i = 0; i <= panels; i++) {
      const a = startA + (endA - startA) * (i / panels);
      const p = pt(outerR, a);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();

    ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.95})`;
    ctx.lineWidth = 1.1;
    ctx.stroke();

    // Inner subtle boundary rail
    ctx.strokeStyle = `rgba(56, 232, 212, ${alpha * 0.5})`;
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    for (let i = 0; i <= panels; i++) {
      const a = startA + (endA - startA) * (i / panels);
      const p = pt(innerR, a);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();

    // 5. Expanding Energy Impact Ripple Wave on Block / Deploy!
    if (this.shieldRipple > 0.04) {
      const rp = pt(baseR, this.shieldRippleAngle);
      const rWave = (1 - this.shieldRipple) * 16 + 3;
      ctx.strokeStyle =
        this.shieldHitFlash > 0.2
          ? `rgba(253, 224, 71, ${this.shieldRipple})`
          : `rgba(165, 243, 252, ${this.shieldRipple * 0.9})`;
      ctx.lineWidth = 1.8 * this.shieldRipple + 0.6;
      ctx.beginPath();
      ctx.ellipse(rp.x, rp.y, rWave, rWave * 0.72, this.shieldAngle + Math.PI / 2, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 6. Dual Wing Emitter Nodes & Central Aegis Diamond!
    const nodeColor = flash > 0.4 ? '#fde047' : '#38e8d4';
    for (const tip of [leftTip, rightTip]) {
      ctx.fillStyle = nodeColor;
      ctx.fillRect(tip.x - 1.8, tip.y - 1.8, 3.6, 3.6);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(tip.x - 0.8, tip.y - 0.8, 1.6, 1.6);
    }

    // Central Aegis core emblem at front center of barrier
    ctx.fillStyle = nodeColor;
    ctx.beginPath();
    ctx.moveTo(frontMid.x, frontMid.y - 3.2);
    ctx.lineTo(frontMid.x + 2.8, frontMid.y);
    ctx.lineTo(frontMid.x, frontMid.y + 3.2);
    ctx.lineTo(frontMid.x - 2.8, frontMid.y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(frontMid.x - 1, frontMid.y - 1, 2, 2);

    // Soft ambient shield glow
    drawGlow(ctx, frontMid.x, frontMid.y, 19, nodeColor, alpha * (0.34 + flash * 0.25));
    ctx.restore();
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

  private renderBossFloorTelegraph(ctx: CanvasRenderingContext2D, e: Enemy): void {
    const state = e.bossState ?? 'stalk';
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 22);

    if (state === 'charge_windup') {
      // Glowing red Rocket-Charge corridor + scrolling warning chevrons!
      const len = 165;
      const angle = Math.atan2(e.chargeDirY, e.chargeDirX);
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(angle);
      ctx.fillStyle = `rgba(244, 63, 94, ${0.14 + pulse * 0.14})`;
      ctx.fillRect(0, -14, len, 28);
      ctx.strokeStyle = `rgba(251, 113, 133, ${0.65 + pulse * 0.3})`;
      ctx.lineWidth = 1.2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(0, -14, len, 28);
      ctx.setLineDash([]);
      // Animated scrolling directional chevrons inside lane
      const shift = (this.time * 85) % 24;
      ctx.strokeStyle = `rgba(253, 224, 71, ${0.7 + pulse * 0.3})`;
      ctx.lineWidth = 1.6;
      for (let x = shift; x < len - 10; x += 24) {
        ctx.beginPath();
        ctx.moveTo(x - 4, -6);
        ctx.lineTo(x + 3, 0);
        ctx.lineTo(x - 4, 6);
        ctx.stroke();
      }
      ctx.restore();
    } else if (state === 'slam_jump' || state === 'slam_air') {
      // Pulsing Crimson Ground Target Reticle for Gravity Jump Slam!
      const tx = e.bossTargetX ?? e.x;
      const ty = e.bossTargetY ?? e.y;
      const maxT = e.bossStateMax ?? 0.5;
      const prog =
        state === 'slam_jump'
          ? 0.2
          : Math.min(1, 0.2 + 0.8 * (1 - Math.max(0, e.bossStateTimer ?? 0) / maxT));
      ctx.save();
      ctx.fillStyle = `rgba(244, 63, 94, ${0.12 + prog * 0.2})`;
      ctx.beginPath();
      ctx.ellipse(tx, ty + 4, 42 * prog, 42 * prog * 0.65, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = `rgba(251, 113, 133, ${0.75 + pulse * 0.25})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(tx, ty + 4, 42, 42 * 0.65, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Inner lock-on crosshair
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(tx - 12, ty + 4);
      ctx.lineTo(tx + 12, ty + 4);
      ctx.moveTo(tx, ty - 5);
      ctx.lineTo(tx, ty + 13);
      ctx.stroke();
      ctx.restore();
    } else if (state === 'laser_windup') {
      // Blinking crimson targeting beam before Reactor Laser Sweep!
      const a = e.bossLaserAngle ?? 0;
      const lx = e.x;
      const ly = e.y - 8;
      ctx.save();
      ctx.strokeStyle = `rgba(251, 113, 133, ${0.45 + pulse * 0.5})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 3]);
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(lx + Math.cos(a) * 260, ly + Math.sin(a) * 260);
      ctx.stroke();
      ctx.restore();
    }
  }

  private renderBossLaserBeam(ctx: CanvasRenderingContext2D, e: Enemy): void {
    const a = e.bossLaserAngle ?? 0;
    const lx = e.x;
    const ly = e.y - 8 - (e.bossHeight ?? 0);
    const cosA = Math.cos(a);
    const sinA = Math.sin(a);
    let maxT = 320;
    for (let t = 12; t < 320; t += 6) {
      const px = lx + cosA * t;
      const py = ly + sinA * t;
      if (px < ROOM_LEFT || px > ROOM_RIGHT || py < ROOM_TOP || py > ROOM_BOTTOM) {
        maxT = t;
        break;
      }
    }
    const ex = lx + cosA * maxT;
    const ey = ly + sinA * maxT;
    const flicker = 0.85 + Math.sin(this.time * 48) * 0.15;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    // Wide blazing crimson plasma sheath
    ctx.strokeStyle = 'rgba(244, 63, 94, 0.55)';
    ctx.lineWidth = 17 * flicker;
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(ex, ey);
    ctx.stroke();

    // Molten orange inner beam
    ctx.strokeStyle = 'rgba(251, 146, 60, 0.92)';
    ctx.lineWidth = 9 * flicker;
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(ex, ey);
    ctx.stroke();

    // Incandescent white-gold core
    ctx.strokeStyle = '#fffbeb';
    ctx.lineWidth = 3.5 * flicker;
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(ex, ey);
    ctx.stroke();

    // Glowing reactor muzzle & wall impact blast flare!
    drawGlow(ctx, lx, ly, 24, '#fb7185', 0.8);
    drawGlow(ctx, ex, ey, 22, '#fde047', 0.85);
    ctx.restore();
  }

  private drawBossPylon(
    ctx: CanvasRenderingContext2D,
    px: number,
    py: number,
    bossX: number,
    bossY: number,
    enraged: boolean,
    charging: boolean,
  ): void {
    const coreColor = enraged ? '#fb7185' : charging ? '#fde047' : '#38e8d4';
    // Thin glowing energy tether linking pylon to boss reactor
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = coreColor;
    ctx.globalAlpha = charging ? 0.55 : 0.25;
    ctx.lineWidth = charging ? 1.5 : 0.9;
    ctx.beginPath();
    ctx.moveTo(bossX, bossY);
    ctx.lineTo(px, py);
    ctx.stroke();
    ctx.restore();

    // Armored diamond satellite pylon
    drawGlow(ctx, px, py, charging ? 16 : 11, coreColor, charging ? 0.65 : 0.35);
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(px, py - 6.5);
    ctx.lineTo(px + 5, py);
    ctx.lineTo(px, py + 6.5);
    ctx.lineTo(px - 5, py);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // Glowing inner plasma crystal
    ctx.fillStyle = coreColor;
    ctx.beginPath();
    ctx.moveTo(px, py - 3.6);
    ctx.lineTo(px + 2.8, py);
    ctx.lineTo(px, py + 3.6);
    ctx.lineTo(px - 2.8, py);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(px - 1, py - 1, 2, 2);
  }

  private renderAnimatedBoss(ctx: CanvasRenderingContext2D, e: Enemy): void {
    const art = getHDArt();
    const atlas = getAtlas();
    const frame = Math.floor(e.anim) % 2;
    const state = e.bossState ?? 'stalk';
    const enraged = Boolean(e.bossPhase2);
    const z = e.bossHeight ?? 0;

    // Ground shadow shrinks naturally as Boss rockets high into the air!
    const shadowScale = Math.max(0.32, 1 - z / 115);
    drawPixelShadow(ctx, e.x, e.y + 18, 23 * shadowScale, 7.5 * shadowScale, 0.58 * shadowScale);

    // State-driven mechanical body squash/stretch, recoil shudder & banking tilt!
    const hover =
      state === 'slam_jump' || state === 'slam_air' || state === 'slam_impact'
        ? 0
        : Math.sin(this.time * (enraged ? 6.5 : 4.2)) * 2.6;

    let scaleX = 1;
    let scaleY = 1;
    let tilt = Math.max(-0.18, Math.min(0.18, e.vx * 0.0014));
    let jitterX = 0;
    let jitterY = 0;

    if (state === 'charge_windup') {
      scaleX = 1.2;
      scaleY = 0.8;
      jitterX = (Math.random() - 0.5) * 2.4;
      jitterY = (Math.random() - 0.5) * 1.4;
    } else if (state === 'charge_dash') {
      scaleX = 1.15;
      scaleY = 0.88;
      tilt = e.chargeDirX * 0.25;
    } else if (state === 'slam_jump') {
      scaleX = 0.84;
      scaleY = 1.24;
    } else if (state === 'slam_air') {
      scaleX = 1.06;
      scaleY = 1.06;
      tilt = Math.sin(this.time * 16) * 0.06;
    } else if (state === 'slam_impact') {
      const p = 1 - Math.max(0, e.bossStateTimer ?? 0) / (e.bossStateMax ?? 0.42);
      const bounce = Math.max(0, 1 - p * 2.4);
      scaleX = 1 + bounce * 0.34;
      scaleY = 1 - bounce * 0.3;
    } else if (state === 'laser_windup' || state === 'phase2_roar') {
      jitterX = (Math.random() - 0.5) * 2.6;
      jitterY = (Math.random() - 0.5) * 2.2;
      scaleX = 1 + Math.sin(this.time * 30) * 0.06;
      scaleY = 1 - Math.sin(this.time * 30) * 0.05;
    } else if (state === 'stunned') {
      tilt = Math.sin(this.time * 18) * 0.14;
      scaleX = 1.06;
      scaleY = 0.94;
    }

    const bodyX = e.x + jitterX;
    const bodyY = e.y - z + hover + jitterY;
    const pylons = this.getBossPylonPositions(e);
    const pylonCharging = state === 'pylon_barrage' || state === 'phase2_roar';

    // 1. Back-orbiting 3D plasma pylons (drawn behind boss chassis)
    for (const py of pylons) {
      if (py.depth < 0) {
        this.drawBossPylon(ctx, py.x, py.y, bodyX, bodyY - 4, enraged, pylonCharging);
      }
    }

    // 2. Animated Plasma Thruster Flames under chassis & Rocket-Charge Jet Cone!
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const jetFlicker = 0.75 + Math.sin(this.time * 42) * 0.25;
    const jetLen = state === 'slam_jump' ? 24 * jetFlicker : state === 'stalk' ? 10 * jetFlicker : 14 * jetFlicker;
    const jetColor = enraged ? '#fb7185' : '#38e8d4';
    for (const ox of [-10, 10]) {
      ctx.fillStyle = jetColor;
      ctx.globalAlpha = 0.75;
      ctx.beginPath();
      ctx.moveTo(bodyX + ox - 3.5, bodyY + 13);
      ctx.lineTo(bodyX + ox + 3.5, bodyY + 13);
      ctx.lineTo(bodyX + ox, bodyY + 13 + jetLen);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.moveTo(bodyX + ox - 1.5, bodyY + 13);
      ctx.lineTo(bodyX + ox + 1.5, bodyY + 13);
      ctx.lineTo(bodyX + ox, bodyY + 13 + jetLen * 0.55);
      ctx.closePath();
      ctx.fill();
    }

    // Massive horizontal rocket booster flame during Rocket Charge Dash!
    if (state === 'charge_dash') {
      const ca = Math.atan2(-e.chargeDirY, -e.chargeDirX);
      ctx.save();
      ctx.translate(bodyX, bodyY);
      ctx.rotate(ca);
      ctx.fillStyle = '#f97316';
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.moveTo(12, -11);
      ctx.lineTo(12, 11);
      ctx.lineTo(44 * jetFlicker, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fef08a';
      ctx.globalAlpha = 0.95;
      ctx.beginPath();
      ctx.moveTo(12, -5);
      ctx.lineTo(12, 5);
      ctx.lineTo(28 * jetFlicker, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();

    // 3. Main Boss Chassis Sprite with Mechanical Squash/Stretch & Tilt!
    const spr = e.flashTimer > 0 ? art.bossFlash ?? atlas.bossFlash : art.boss ?? atlas.boss[frame];
    ctx.save();
    ctx.translate(bodyX, bodyY + 16);
    ctx.rotate(tilt);
    ctx.scale(scaleX, scaleY);
    if (art.boss) {
      ctx.drawImage(spr, -27, -45, 54, 52);
    } else {
      ctx.drawImage(spr, -14, -29);
    }
    ctx.restore();

    // 4. Pulsing Chest Reactor Core Glow Overlay (changes color with attack & Phase 2!)
    const corePulse = 0.5 + 0.5 * Math.sin(this.time * (enraged ? 14 : 7));
    const coreColor =
      state === 'laser_windup' || state === 'laser_sweep' || enraged
        ? '#fb7185'
        : state === 'charge_windup' || state === 'charge_dash'
          ? '#fb923c'
          : '#fbbf24';
    const coreR = state === 'laser_windup' || state === 'laser_sweep' ? 28 + corePulse * 8 : 18 + corePulse * 5;
    drawGlow(ctx, bodyX, bodyY - 6, coreR, coreColor, 0.45 + corePulse * 0.25);

    // Hot glowing center core dot right on the chest reactor
    if (state === 'laser_windup' || state === 'laser_sweep' || enraged) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.65 + corePulse * 0.35;
      ctx.beginPath();
      ctx.arc(bodyX, bodyY - 6, state === 'laser_windup' ? 4.5 + corePulse * 2 : 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 5. Front-orbiting 3D plasma pylons (drawn IN FRONT of boss chassis!)
    for (const py of pylons) {
      if (py.depth >= 0) {
        this.drawBossPylon(ctx, py.x, py.y, bodyX, bodyY - 4, enraged, pylonCharging);
      }
    }
  }

  private renderEnemy(ctx: CanvasRenderingContext2D, e: Enemy): void {
    const art = getHDArt();
    const atlas = getAtlas();
    const frame = Math.floor(e.anim) % 2;

    if (e.kind === 'boss') {
      this.renderAnimatedBoss(ctx, e);
      return;
    }

    drawPixelShadow(ctx, e.x, e.y + 9, 8.5, 3.2, 0.48);

    if (e.kind === 'slime') {
      const speed = Math.hypot(e.vx, e.vy);
      const crouch = e.telegraphTimer > 0 ? 0.24 : Math.sin(e.anim * 1.6) * 0.12;
      const hopLift = Math.min(5, speed * 0.045);
      const spr = e.flashTimer > 0 ? art.slimeFlash ?? atlas.slimeFlash : art.slime ?? atlas.slime[frame];
      if (art.slime) {
        ctx.save();
        ctx.translate(e.x, e.y + 9 - hopLift);
        ctx.scale(1 + crouch, 1 - crouch);
        ctx.drawImage(spr, -11, -20, 22, 21);
        ctx.restore();
      } else {
        ctx.drawImage(spr, Math.round(e.x - 8), Math.round(e.y - 8));
      }
      drawGlow(ctx, e.x, e.y, 16, e.telegraphTimer > 0 ? '#f472b6' : '#c084fc', e.telegraphTimer > 0 ? 0.45 : 0.22);
    } else if (e.kind === 'drone') {
      const hover = Math.sin(this.time * 6.5 + e.id) * 2.6;
      const bank = Math.max(-0.22, Math.min(0.22, e.vx * 0.0025));
      const spr = e.flashTimer > 0 ? art.droneFlash ?? atlas.droneFlash : art.drone ?? atlas.drone[0];
      if (art.drone) {
        ctx.save();
        ctx.translate(e.x, e.y + hover);
        ctx.rotate(bank);
        ctx.drawImage(spr, -11, -12, 22, 22);
        ctx.restore();
      } else {
        ctx.drawImage(spr, Math.round(e.x - 8), Math.round(e.y - 9 + hover));
      }
      if (e.telegraphTimer > 0) drawGlow(ctx, e.x, e.y + hover, 18, '#fb7185', 0.55);
      else drawGlow(ctx, e.x, e.y + hover, 13, '#38e8d4', 0.22);
    } else {
      const scurrying = e.scurryTimer > 0;
      const bob = scurrying ? Math.abs(Math.sin(this.time * 22 + e.id)) * 2.2 : 0;
      const tilt = scurrying ? Math.sin(this.time * 22 + e.id) * 0.08 : 0;
      const spr =
        e.flashTimer > 0
          ? art.turretFlash ?? atlas.turretFlash
          : e.telegraphTimer > 0
            ? art.turret1 ?? atlas.turret[1]
            : art.turret0 ?? atlas.turret[0];
      if (art.turret0) {
        ctx.save();
        ctx.translate(e.x, e.y - bob);
        ctx.rotate(tilt);
        ctx.drawImage(spr, -12, -13, 24, 24);
        ctx.restore();
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

  private drawReadyMeleeWeapon(ctx: CanvasRenderingContext2D, bob: number): void {
    const art = getHDArt();
    const wep = this.state.equippedWeapon;
    if (wep === 'blaster' || this.swings.length > 0) return;
    const spr = wep === 'hammer' ? art.weapons.hammer : art.weapons.blade;
    if (!spr) return;

    const idleBreath = Math.sin(this.time * 4.2) * 0.06;
    const walkSwing = this.walkAnim > 0 ? Math.sin(this.walkAnim) * 0.14 : 0;
    const size = wep === 'hammer' ? 21 : 19;

    let ox = 8;
    let oy = -2;
    let rot = -0.35 + idleBreath + walkSwing;
    if (this.shieldActive) {
      // Brace blade defensively right behind the Kinetic Shield!
      ox = Math.cos(this.shieldAngle) * 7;
      oy = -2 + Math.sin(this.shieldAngle) * 6;
      rot = this.shieldAngle + Math.PI * 0.72;
    } else if (this.facing === 'left') {
      ox = -8;
      oy = -2;
      rot = -Math.PI * 0.72 - idleBreath - walkSwing;
    } else if (this.facing === 'up') {
      ox = 7;
      oy = -5;
      rot = -0.65 + idleBreath;
    } else if (this.facing === 'down') {
      ox = 8;
      oy = 0;
      rot = 0.28 + idleBreath + walkSwing;
    }

    ctx.save();
    ctx.translate(this.playerX + ox, this.playerY + oy - bob * 0.65);
    ctx.rotate(rot + Math.PI / 4);
    ctx.drawImage(spr, -size * 0.22, -size * 0.82, size, size);
    ctx.restore();
  }

  private renderPlayer(ctx: CanvasRenderingContext2D): void {
    const art = getHDArt();
    const atlas = getAtlas();
    if (this.invulnTimer > 0 && this.dashTimer <= 0 && Math.floor(this.time * 24) % 2 === 0) {
      return;
    }

    const walking = this.walkAnim > 0;
    const bob = walking ? Math.abs(Math.sin(this.walkAnim)) * 2.2 : Math.sin(this.time * 3) * 0.4;

    // Dynamic Melee Body Lunge, Squash/Stretch & Lean during Blade / Hammer Swings!
    let lungeX = 0;
    let lungeY = 0;
    let scaleX = 1;
    let scaleY = 1;
    let tilt = walking ? Math.sin(this.walkAnim) * 0.05 : 0;
    if (this.swingPoseTimer > 0) {
      const p = 1 - this.swingPoseTimer / Math.max(0.05, this.swingPoseMax);
      const pulse = Math.sin(p * Math.PI);
      lungeX = Math.cos(this.swingPoseAngle) * pulse * 4.2;
      lungeY = Math.sin(this.swingPoseAngle) * pulse * 3.2;
      scaleX = 1 + pulse * 0.14;
      scaleY = 1 - pulse * 0.1;
      tilt +=
        this.swingPoseCombo === 2
          ? Math.sin(p * Math.PI * 2) * 0.24
          : this.swingPoseDir * pulse * 0.22;
    }

    drawPixelShadow(ctx, this.playerX + lungeX * 0.5, this.playerY + 11, 8, 3.2, 0.5);

    // Draw ready weapon BEHIND hero when facing up!
    if (this.facing === 'up') {
      this.drawReadyMeleeWeapon(ctx, bob);
    }

    const hdSpr =
      this.playerFlashTimer > 0
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
      ctx.translate(this.playerX + lungeX, this.playerY + 10 - bob + lungeY);
      ctx.rotate(tilt);
      ctx.scale(scaleX, scaleY);
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

    // Draw ready melee weapon IN FRONT of hero when facing down / left / right!
    if (this.facing !== 'up') {
      this.drawReadyMeleeWeapon(ctx, bob);
    }

    // Show equipped Puls-Blaster in hand when equipped!
    if (this.state.equippedWeapon === 'blaster' && art.weapons.blaster) {
      const a = this.lastAimAngle;
      const recoil = this.blasterRecoil * 3.5;
      ctx.save();
      ctx.translate(
        this.playerX + Math.cos(a) * (8 - recoil),
        this.playerY - 1 + Math.sin(a) * (8 - recoil),
      );
      ctx.rotate(a + Math.PI / 4);
      ctx.drawImage(art.weapons.blaster, -8, -8, 16, 16);
      ctx.restore();
    }

    drawGlow(ctx, this.playerX, this.playerY, 22, WEAPON_META[this.state.equippedWeapon].accentColor, 0.14);
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
    const enraged = Boolean(boss.bossPhase2);
    const bw = 232;
    const bx = (VIRTUAL_WIDTH - bw) / 2;
    const by = VIRTUAL_HEIGHT - 27;

    ctx.fillStyle = 'rgba(12, 16, 26, 0.94)';
    ctx.fillRect(bx - 5, by - 12, bw + 10, 21);
    ctx.strokeStyle = enraged ? '#fb7185' : '#fb923c';
    ctx.lineWidth = 0.9;
    ctx.strokeRect(bx - 4.5, by - 11.5, bw + 9, 20);

    const status = boss.bossStatusText ? ` · ${boss.bossStatusText}` : '';
    const title = enraged
      ? `CORE-WÄCHTER MK-IV [PHASE II]${status}`
      : `CORE-WÄCHTER MK-IV${status}`;
    ctx.fillStyle = enraged ? '#fda4af' : '#fde047';
    ctx.font = 'bold 5.2px Silkscreen, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(title, VIRTUAL_WIDTH / 2, by - 3.5);

    ctx.fillStyle = '#2a1822';
    ctx.fillRect(bx, by, bw, 5.5);
    ctx.fillStyle = enraged ? '#e11d48' : '#f97316';
    ctx.fillRect(bx, by, bw * pct, 5.5);
    ctx.fillStyle = enraged ? '#fda4af' : '#fde047';
    ctx.fillRect(bx, by, bw * pct, 1.3);

    // Phase-2 threshold notch at 50%
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(bx + bw * 0.5 - 0.5, by - 0.5, 1, 6.5);
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
