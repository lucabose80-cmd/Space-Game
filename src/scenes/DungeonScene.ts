import { getHDArt } from '../assets/artLoader';
import { drawGlow, drawPixelShadow } from '../assets/pixelArt';
import { getAtlas } from '../assets/sprites';
import { COMPANION_DEFS } from '../data/companions';
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
  generateSector1Floor,
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
  type RoomChest,
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
  | 'stunned'
  | 'breacher_stomp'
  | 'breacher_fan'
  | 'lev_idle'
  | 'lev_arm_track'
  | 'lev_arm_slam'
  | 'lev_twin_windup'
  | 'lev_twin_beam'
  | 'lev_debris'
  | 'lev_omega_spiral';

interface LeviathanArm {
  side: -1 | 1;
  homeX: number;
  homeY: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  state: 'idle' | 'tracking' | 'slamming' | 'grounded' | 'returning' | 'beam';
  timer: number;
  beamAngle: number;
}

interface DebrisDrop {
  x: number;
  y: number;
  r: number;
  timer: number;
  maxTimer: number;
}

interface SpearThrustFx {
  x: number;
  y: number;
  angle: number;
  length: number;
  comboStep: number;
  isCharge: boolean;
  life: number;
  maxLife: number;
}

interface FistBurstFx {
  x: number;
  y: number;
  angle: number;
  step: number;
  isFinisher: boolean;
  life: number;
  maxLife: number;
}

interface DiscusProjectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  speed: number;
  damage: number;
  bouncesLeft: number;
  recalling: boolean;
  spin: number;
  life: number;
  hitCooldowns: Map<number, number>;
  trail: Array<{ x: number; y: number }>;
}

interface Enemy {
  id: number;
  kind:
    | 'slime'
    | 'slime_magma'
    | 'drone'
    | 'drone_arc'
    | 'turret'
    | 'shield_drone'
    | 'spore_spitter'
    | 'phase_stalker'
    | 'boss_breacher'
    | 'boss'
    | 'boss_leviathan';
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
  // Leviathan articulated giant gauntlets
  levArms?: [LeviathanArm, LeviathanArm];
  levActiveSide?: 0 | 1;
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
  isSporeGlob?: boolean;
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
  isBreacher?: boolean;
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
  onOpenDungeonChest?: (chest: RoomChest) => void;
  onToast: (msg: string, tone?: 'info' | 'good' | 'warn') => void;
  onHudDirty: () => void;
}

export class DungeonScene {
  private state: GameState;
  private callbacks: DungeonCallbacks;

  private floor: DungeonFloor = generateSector1Floor(1);
  public currentFloor: 1 | 2 | 3 = 1;
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
  private lanceChargeTimer = 0;
  private lanceChargeAngle = 0;
  private lanceHitIds = new Set<number>();
  private cometSlamTimer = 0;
  private cometSlamAngle = 0;
  private discusOrbitTimer = 0;
  private discusOrbitAngle = 0;
  private discusOrbitHitCds = new Map<number, number>();
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
  private shieldOverheatTimer = 0;
  private shieldOverheatMsgCd = 0;
  private blasterRecoil = 0;
  private lastAimAngle = 0;
  private swingPoseTimer = 0;
  private swingPoseMax = 0.2;
  private swingPoseAngle = 0;
  private swingPoseDir: 1 | -1 = 1;
  private swingPoseCombo = 0;

  // Companion Bot (Familiar) live dungeon state
  private companionX = ROOM_CENTER_X - 18;
  private companionY = ROOM_CENTER_Y + 18;
  private sparkFireTimer = 0.7;
  private lumaRoomCounter = 0;
  private haloShieldReady = false;
  private haloChargeTimer = 0;

  // Warp-Beacon channel
  private warpChannel = 0;
  private readonly warpDuration = 1.25;
  private readonly warpCost = 20;

  // Room entities & FX
  private enemies: Enemy[] = [];
  private projectiles: Projectile[] = [];
  private discs: DiscusProjectile[] = [];
  private drops: LootDrop[] = [];
  private swings: WeaponSwing[] = [];
  private thrusts: SpearThrustFx[] = [];
  private fistBursts: FistBurstFx[] = [];
  private debrisDrops: DebrisDrop[] = [];
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
  private floorBossDefeated = false;
  private maxFloorReached = 1;
  private sector1ClearedInRun = false;
  private finished = false;

  public activePrompt: { label: string; x: number; y: number } | null = null;

  constructor(state: GameState, callbacks: DungeonCallbacks) {
    this.state = state;
    this.callbacks = callbacks;
  }

  public isInBossFight(): boolean {
    return this.currentRoom?.type === 'boss' && this.enemies.some((e) => this.isBossKind(e.kind));
  }

  public startRun(): void {
    this.state.restoreFullVitals();
    this.roomsCleared = 0;
    this.enemiesDefeated = 0;
    this.maxFloorReached = 1;
    this.sector1ClearedInRun = false;
    this.lumaRoomCounter = 0;
    this.haloShieldReady = this.state.equippedCompanion === 'halo';
    this.haloChargeTimer = 0;
    this.finished = false;
    this.startFloor(1, true);
  }

  public startFloor(floorIndex: 1 | 2 | 3, freshRun = false): void {
    this.currentFloor = floorIndex;
    this.maxFloorReached = Math.max(this.maxFloorReached, floorIndex);
    if (floorIndex > this.state.deepestFloor) {
      this.state.deepestFloor = floorIndex;
      this.state.save();
    }
    this.floor = generateSector1Floor(floorIndex);
    this.floorBossDefeated = false;
    this.warpChannel = 0;
    this.invulnTimer = 0.55;
    this.dashCooldown = 0;
    this.dashTimer = 0;
    this.lanceChargeTimer = 0;
    this.cometSlamTimer = 0;
    this.discusOrbitTimer = 0;
    this.attackCooldown = 0;
    this.specialCooldown = 0;
    this.shieldActive = false;
    this.shieldOpenAnim = 0;
    this.shieldOverheatTimer = 0;
    this.shieldOverheatMsgCd = 0;
    this.haloShieldReady = this.state.equippedCompanion === 'halo';
    this.haloChargeTimer = 0;
    this.enterRoom(this.floor.startKey, null);
    this.spawnBurst(this.playerX, this.playerY, floorIndex === 3 ? '#fbbf24' : '#38e8d4', 22);

    if (freshRun) {
      this.callbacks.onToast(
        this.state.timeOfDay === 'night'
          ? '🌙 Nacht-Expedition · Ebene I: Frachtdeck (+35 % Rar-Loot)!'
          : 'Sektor 1 · Ebene I: Frachtdeck — Beute bleibt nur bei Extraktion [R] sicher!',
        this.state.timeOfDay === 'night' ? 'good' : 'info',
      );
    } else if (floorIndex === 2) {
      this.callbacks.onToast(
        '⬇ Ebene II: Überwuchertes Maschinen-Deck — Achtung: Schild-Drohnen, Sporen-Spucker & Dampf-Ventile!',
        'warn',
      );
    } else {
      this.callbacks.onToast(
        '⬇ Ebene III: Reaktor-Kern — Nutze die Notfall-Medstation! Der gigantische A.E.G.I.S. LEVIATHAN wartet!',
        'warn',
      );
    }
    this.callbacks.onHudDirty();
  }

  private enterRoom(key: string, enteredFrom: DoorSide | null): void {
    const room = this.floor.rooms.get(key);
    if (!room) return;
    this.currentRoom = room;
    room.visited = true;

    this.enemies = [];
    this.projectiles = [];
    this.discs = [];
    this.drops = [];
    this.swings = [];
    this.thrusts = [];
    this.fistBursts = [];
    this.debrisDrops = [];
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
      this.playerY = ROOM_CENTER_Y + 24;
      this.facing = 'up';
    }

    if (!room.cleared) {
      for (const sp of room.spawns) {
        this.spawnEnemy(sp.kind, sp.x, sp.y);
      }
      if (room.type === 'boss') {
        sound.playBossRoar();
        this.triggerShake(0.4, 4.5);
        if (this.currentFloor === 1) {
          this.callbacks.onToast('⚠ EBENEN-BOSS I: Schott-Brecher MK-II rückt vor!', 'warn');
        } else if (this.currentFloor === 2) {
          this.callbacks.onToast('⚠ EBENEN-BOSS II: Core-Wächter MK-IV erwacht!', 'warn');
        } else {
          this.callbacks.onToast('🚨 SEKTOR-1-ENDBOSS: A.E.G.I.S. LEVIATHAN AKTIVIERT!', 'warn');
        }
      }
    }
  }

  private isBossKind(kind: Enemy['kind']): boolean {
    return kind === 'boss_breacher' || kind === 'boss' || kind === 'boss_leviathan';
  }

  private spawnEnemy(kind: Enemy['kind'], x: number, y: number): void {
    const floorScale = this.currentFloor === 1 ? 1.0 : this.currentFloor === 2 ? 1.24 : 1.48;
    const baseScale = floorScale * (1 + Math.min(3, this.state.bossDefeatedCount) * 0.08);

    const makeBase = (hp: number, radius: number): Enemy => ({
      id: this.nextEnemyId++,
      kind,
      x,
      y,
      vx: 0,
      vy: 0,
      hp,
      maxHp: hp,
      radius,
      flashTimer: 0,
      aiTimer: 0.6 + Math.random() * 0.4,
      phase: 0,
      subBurst: 0,
      burstDelay: 0,
      moveDirX: Math.random() > 0.5 ? 1 : -1,
      moveDirY: 0,
      scurryTimer: 0,
      chargeDirX: 0,
      chargeDirY: 0,
      chargeActive: 0,
      telegraphTimer: 0,
      aimAngle: Math.PI / 2,
      summonThreshold: 0,
      anim: Math.random() * 5,
    });

    if (kind === 'slime') {
      const e = makeBase(Math.round(46 * baseScale), 8);
      e.aiTimer = 0.35 + Math.random() * 0.35;
      this.enemies.push(e);
    } else if (kind === 'slime_magma') {
      const e = makeBase(Math.round(68 * baseScale), 9);
      e.aiTimer = 0.4 + Math.random() * 0.35;
      this.enemies.push(e);
    } else if (kind === 'drone') {
      const e = makeBase(Math.round(52 * baseScale), 8);
      e.aiTimer = 0.9 + Math.random() * 0.6;
      e.phase = Math.random() * Math.PI * 2;
      this.enemies.push(e);
    } else if (kind === 'drone_arc') {
      const e = makeBase(Math.round(66 * baseScale), 9);
      e.aiTimer = 0.95 + Math.random() * 0.45;
      e.phase = Math.random() * Math.PI * 2;
      this.enemies.push(e);
    } else if (kind === 'turret') {
      const e = makeBase(Math.round(66 * baseScale), 9);
      e.aiTimer = 0.9 + Math.random() * 0.5;
      e.scurryTimer = 0.8 + Math.random() * 0.4;
      e.moveDirX = 0;
      this.enemies.push(e);
    } else if (kind === 'shield_drone') {
      const e = makeBase(Math.round(78 * baseScale), 10);
      e.aiTimer = 1.1 + Math.random() * 0.5;
      e.aimAngle = Math.atan2(this.playerY - y, this.playerX - x);
      this.enemies.push(e);
    } else if (kind === 'spore_spitter') {
      const e = makeBase(Math.round(72 * baseScale), 9);
      e.aiTimer = 1.0 + Math.random() * 0.5;
      e.scurryTimer = 0;
      this.enemies.push(e);
    } else if (kind === 'phase_stalker') {
      const e = makeBase(Math.round(84 * baseScale), 10);
      e.aiTimer = 1.0 + Math.random() * 0.45;
      e.aimAngle = Math.atan2(this.playerY - y, this.playerX - x);
      this.enemies.push(e);
    } else if (kind === 'boss_breacher') {
      const e = makeBase(Math.round(255 * (1 + Math.min(2, this.state.bossDefeatedCount) * 0.08)), 16);
      e.bossState = 'stalk';
      e.bossStateTimer = 0.85;
      e.bossStateMax = 0.85;
      e.bossHeight = 0;
      e.bossPhase2 = false;
      e.bossStatusText = 'AKTIV';
      e.bossAfterimageTick = 0;
      this.enemies.push(e);
    } else if (kind === 'boss') {
      const e = makeBase(Math.round(420 * (1 + Math.min(2, this.state.bossDefeatedCount) * 0.08)), 16);
      e.bossState = 'stalk';
      e.bossStateTimer = 0.95;
      e.bossStateMax = 0.95;
      e.bossHeight = 0;
      e.bossTargetX = x;
      e.bossTargetY = y;
      e.bossLaserAngle = 0;
      e.bossLaserDir = 1;
      e.bossLaserTick = 0;
      e.bossOrbitAngle = 0;
      e.bossPylonRadius = 28;
      e.bossPhase2 = false;
      e.bossStatusText = 'AKTIV';
      e.bossAfterimageTick = 0;
      this.enemies.push(e);
    } else {
      // Gigantic Sector-1 Endboss: A.E.G.I.S. LEVIATHAN!
      const e = makeBase(Math.round(760 * (1 + Math.min(2, this.state.bossDefeatedCount) * 0.06)), 28);
      e.bossState = 'lev_idle';
      e.bossStateTimer = 1.05;
      e.bossStateMax = 1.05;
      e.bossHeight = 0;
      e.bossPhase2 = false;
      e.bossStatusText = 'OMEGA-KERN AKTIV';
      e.levActiveSide = 0;
      e.levArms = [
        {
          side: -1,
          homeX: ROOM_CENTER_X - 78,
          homeY: ROOM_TOP + 54,
          x: ROOM_CENTER_X - 78,
          y: ROOM_TOP + 54,
          targetX: ROOM_CENTER_X - 78,
          targetY: ROOM_TOP + 54,
          state: 'idle',
          timer: 0,
          beamAngle: Math.PI / 2,
        },
        {
          side: 1,
          homeX: ROOM_CENTER_X + 78,
          homeY: ROOM_TOP + 54,
          x: ROOM_CENTER_X + 78,
          y: ROOM_TOP + 54,
          targetX: ROOM_CENTER_X + 78,
          targetY: ROOM_TOP + 54,
          state: 'idle',
          timer: 0,
          beamAngle: Math.PI / 2,
        },
      ];
      this.enemies.push(e);
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

    // Energy system: holding the Hex-Aegis Shield actively drains EN (no infinite turtle!);
    // otherwise regenerate smoothly (boosted by Dr. Lyra's Nano-Vitalserum!)
    const stats = this.state.getStats();
    const prevEnergy = Math.floor(this.state.energy);
    this.shieldOverheatTimer = Math.max(0, this.shieldOverheatTimer - dt);
    this.shieldOverheatMsgCd = Math.max(0, this.shieldOverheatMsgCd - dt);
    if (this.shieldActive) {
      this.state.energy = Math.max(0, this.state.energy - 26 * dt);
      if (this.state.energy <= 0) {
        this.triggerShieldBreak();
      }
    } else {
      const regenRate = this.shieldOverheatTimer > 0 ? 11 : 16;
      const lumaMult = this.state.equippedCompanion === 'luma' ? 1.15 : 1.0;
      this.state.energy = Math.min(100, this.state.energy + regenRate * stats.energyRegenMult * lumaMult * dt);
    }
    if (Math.floor(this.state.energy) !== prevEnergy) {
      this.callbacks.onHudDirty();
    }

    // Subtle overheating smoke sparks from wrist emitter during shield lockout
    if (this.shieldOverheatTimer > 0 && Math.random() < dt * 10) {
      this.particles.push({
        x: this.playerX + (Math.random() - 0.5) * 10,
        y: this.playerY - 4 + (Math.random() - 0.5) * 6,
        vx: (Math.random() - 0.5) * 16,
        vy: -16 - Math.random() * 14,
        color: Math.random() > 0.4 ? '#fb923c' : '#fb7185',
        size: 1.5,
        life: 0.25,
        maxLife: 0.25,
      });
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
    this.updateCompanion(dt);
    this.updateHazardsAndDebris(dt);
    this.updateEnemies(dt);
    this.updateProjectiles(dt);
    this.updateDiscs(dt);
    this.updateDrops(dt);
    this.updateRoomInteractions(input);
    this.updateEffects(dt);
  }

  private triggerShieldBreak(): void {
    this.shieldActive = false;
    this.shieldOpenAnim = 0;
    this.shieldHoldTime = 0;
    this.shieldOverheatTimer = 1.8;
    this.state.energy = 0;
    sound.playShieldBreak();
    this.triggerShake(0.22, 3.2);
    const sx = this.playerX + Math.cos(this.shieldAngle) * 14;
    const sy = this.playerY - 2 + Math.sin(this.shieldAngle) * 12;
    this.spawnBurst(sx, sy, '#38e8d4', 14);
    this.spawnBurst(sx, sy, '#fb7185', 10);
    this.shockwaves.push({
      x: sx,
      y: sy,
      maxRadius: 34,
      color: '#fb7185',
      life: 0.22,
      maxLife: 0.22,
    });
    this.floats.push({
      x: this.playerX,
      y: this.playerY - 18,
      text: 'SCHILD ÜBERHITZT!',
      color: '#fb7185',
      life: 1.0,
      maxLife: 1.0,
    });
    this.callbacks.onHudDirty();
  }

  private getAimAngle(input: InputManager): number {
    if (input.isMouseActive()) {
      const m = input.getMousePos();
      return Math.atan2(m.y - this.playerY, m.x - this.playerX);
    }

    // Smart auto-aim on touch / keyboard-only: lock onto nearest enemy (or grounded Leviathan gauntlet!)
    let bestDist = 185;
    let bestAngle: number | null = null;
    for (const e of this.enemies) {
      const d = Math.hypot(e.x - this.playerX, e.y - this.playerY);
      if (d < bestDist) {
        bestDist = d;
        bestAngle = Math.atan2(e.y - this.playerY, e.x - this.playerX);
      }
      if (e.kind === 'boss_leviathan' && e.levArms) {
        for (const arm of e.levArms) {
          const ad = Math.hypot(arm.x - this.playerX, arm.y - this.playerY);
          if (ad < bestDist) {
            bestDist = ad;
            bestAngle = Math.atan2(arm.y - this.playerY, arm.x - this.playerX);
          }
        }
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
    const stats = this.state.getStats();

    // Active Comet-Slam Lunge (Kinetik-Fäuste Secondary leaping slam!)
    if (this.cometSlamTimer > 0) {
      this.cometSlamTimer = Math.max(0, this.cometSlamTimer - dt);
      const speed = 265;
      this.moveEntityWithCollisions(
        Math.cos(this.cometSlamAngle) * speed * dt,
        Math.sin(this.cometSlamAngle) * speed * dt,
      );
      if (Math.random() < 0.85) {
        this.afterimages.push({
          x: this.playerX,
          y: this.playerY,
          facing: this.facing,
          life: 0.16,
          maxLife: 0.16,
        });
        this.particles.push({
          x: this.playerX + (Math.random() - 0.5) * 8,
          y: this.playerY + (Math.random() - 0.5) * 8,
          vx: -Math.cos(this.cometSlamAngle) * 45,
          vy: -Math.sin(this.cometSlamAngle) * 45,
          color: Math.random() > 0.4 ? '#fbbf24' : '#38e8d4',
          size: 2.2,
          life: 0.22,
          maxLife: 0.22,
        });
      }
      if (this.cometSlamTimer <= 0) {
        this.triggerCometImpact();
      }
      return;
    }

    // Active Ion-Lance Charge (Spear Secondary piercing i-frame dash!)
    if (this.lanceChargeTimer > 0) {
      this.lanceChargeTimer = Math.max(0, this.lanceChargeTimer - dt);
      const speed = 315;
      const vx = Math.cos(this.lanceChargeAngle) * speed;
      const vy = Math.sin(this.lanceChargeAngle) * speed;
      this.moveEntityWithCollisions(vx * dt, vy * dt);

      if (Math.random() < 0.85) {
        this.afterimages.push({
          x: this.playerX,
          y: this.playerY,
          facing: this.facing,
          life: 0.18,
          maxLife: 0.18,
        });
        this.particles.push({
          x: this.playerX + (Math.random() - 0.5) * 8,
          y: this.playerY - 2 + (Math.random() - 0.5) * 8,
          vx: -vx * 0.2,
          vy: -vy * 0.2,
          color: Math.random() > 0.4 ? '#38e8d4' : '#fde047',
          size: 2.0,
          life: 0.22,
          maxLife: 0.22,
        });
      }

      const chargeDmg = Math.round(stats.spearDamage * 1.75);
      for (const e of [...this.enemies]) {
        if (this.lanceHitIds.has(e.id)) continue;
        if (e.kind === 'boss' && (e.bossHeight ?? 0) > 28) continue;
        const hitDist = this.getDistanceToEnemyHitbox(e, this.playerX, this.playerY);
        if (hitDist <= 22) {
          this.lanceHitIds.add(e.id);
          this.slashHits.push({
            x: e.x,
            y: e.y - 2,
            angle: this.lanceChargeAngle,
            color: '#fde047',
            life: 0.2,
            maxLife: 0.2,
          });
          this.damageEnemy(
            e,
            chargeDmg,
            Math.cos(this.lanceChargeAngle),
            Math.sin(this.lanceChargeAngle),
            165,
            true,
          );
          this.hitStop = 0.032;
          this.triggerShake(0.12, 2.6);
        }
      }
      for (const pod of this.currentRoom.pods) {
        if (!pod.broken && Math.hypot(pod.x - this.playerX, pod.y - this.playerY) <= 20) {
          this.breakPod(pod);
        }
      }
      return;
    }

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

    // Blade Secondary: Skill-based Hex-Aegis Kinetic Shield (drains EN while held; Perfect Parry <=0.24s!)
    const wasShielding = this.shieldActive;
    const wantsShield =
      weapon === 'blade' && input.secondaryHeld() && this.dashTimer <= 0 && this.attackCooldown <= 0.05;
    const canShield =
      this.shieldOverheatTimer <= 0 && (wasShielding ? this.state.energy > 0 : this.state.energy >= 8);

    if (wantsShield && !canShield && this.shieldOverheatMsgCd <= 0) {
      this.shieldOverheatMsgCd = 0.65;
      sound.playReaction('expensive');
      this.floats.push({
        x: this.playerX,
        y: this.playerY - 16,
        text: this.shieldOverheatTimer > 0 ? 'ÜBERHITZT!' : 'KEINE EN!',
        color: '#fb923c',
        life: 0.7,
        maxLife: 0.7,
      });
    }

    this.shieldActive = wantsShield && canShield;
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

    // Jetpack Dash (Space) — boosted by Vex' Schub-Kondensator!
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
      this.dashCooldown = 0.54 * stats.dashCooldownMult;
      this.invulnTimer = Math.max(this.invulnTimer, 0.28);
      this.dashVx = dx * 258;
      this.dashVy = dy * 258;
      sound.playDash();
      this.spawnBurst(this.playerX, this.playerY + 4, '#fb923c', 8);
    }

    const baseSpeed = (this.shieldActive ? 54 : 108) * stats.moveSpeedMult;
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
      } else if (weapon === 'spear') {
        this.performSpearThrust(aim);
      } else if (weapon === 'fists') {
        this.performFistCombo(aim);
      } else if (weapon === 'discus') {
        this.performDiscusThrow(aim);
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
      if (weapon === 'spear') {
        this.performIonLanceCharge(aim);
      } else if (weapon === 'fists') {
        this.performCometSlam(aim);
      } else if (weapon === 'discus') {
        this.performDiscusRecall();
      } else if (weapon === 'blaster') {
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
      const hitPt = this.getClosestEnemyHitPoint(e, this.playerX, this.playerY);
      const dx = hitPt.x - this.playerX;
      const dy = hitPt.y - this.playerY;
      const dist = Math.hypot(dx, dy);
      if (dist > radius + hitPt.r) continue;
      const diff = Math.abs(this.normalizeAngle(Math.atan2(dy, dx) - angle));
      if (diff <= sweep / 2 + 0.28 || dist < hitPt.r + 9) {
        this.slashHits.push({
          x: hitPt.x,
          y: hitPt.y - 2,
          angle: angle + (Math.random() - 0.5) * 0.5,
          color: isFinisher ? '#fde047' : '#38e8d4',
          life: 0.18,
          maxLife: 0.18,
        });
        this.damageEnemy(e, damage, Math.cos(angle), Math.sin(angle), isFinisher ? 165 : 105, isFinisher);
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

  private performSpearThrust(angle: number): void {
    const stats = this.state.getStats();
    const isFinisher = this.comboStep === 2;
    const length = isFinisher ? stats.spearRange * 1.28 : stats.spearRange;
    const damage = isFinisher ? Math.round(stats.spearDamage * 1.45) : stats.spearDamage;
    const duration = isFinisher ? 0.22 : 0.17;

    this.orientFacing(angle);
    this.swingPoseTimer = duration;
    this.swingPoseMax = duration;
    this.swingPoseAngle = angle;
    this.swingPoseDir = this.comboStep === 1 ? -1 : 1;
    this.swingPoseCombo = this.comboStep;

    this.moveEntityWithCollisions(Math.cos(angle) * (isFinisher ? 10 : 6), Math.sin(angle) * (isFinisher ? 10 : 6));
    sound.playSlash(this.comboStep);

    const sx = this.playerX + Math.cos(angle) * 6;
    const sy = this.playerY - 2 + Math.sin(angle) * 6;
    const ex = sx + Math.cos(angle) * length;
    const ey = sy + Math.sin(angle) * length;

    this.thrusts.push({
      x: sx,
      y: sy,
      angle,
      length,
      comboStep: this.comboStep,
      isCharge: false,
      life: duration,
      maxLife: duration,
    });

    // Crisp needle-sparks shooting forward along the piercing plasma spear!
    const sparkCount = isFinisher ? 14 : 7;
    for (let k = 0; k < sparkCount; k++) {
      const u = 0.25 + (k / sparkCount) * 0.75;
      this.particles.push({
        x: sx + (ex - sx) * u,
        y: sy + (ey - sy) * u,
        vx: Math.cos(angle) * (55 + Math.random() * 45) + (Math.random() - 0.5) * 24,
        vy: Math.sin(angle) * (55 + Math.random() * 45) + (Math.random() - 0.5) * 24,
        color: isFinisher ? (k % 2 === 0 ? '#fde047' : '#38e8d4') : k % 2 === 0 ? '#ffffff' : '#67e8f9',
        size: isFinisher ? 2.0 : 1.5,
        life: 0.22,
        maxLife: 0.22,
      });
    }

    let hitAny = false;
    for (const e of [...this.enemies]) {
      if (e.kind === 'boss' && (e.bossHeight ?? 0) > 28) continue;
      const hitPt = this.getClosestEnemyHitPoint(e, (sx + ex) * 0.5, (sy + ey) * 0.5);
      const dLine = this.pointToSegmentDist(hitPt.x, hitPt.y, sx, sy, ex, ey);
      if (dLine <= hitPt.r + (isFinisher ? 11 : 8)) {
        this.slashHits.push({
          x: hitPt.x,
          y: hitPt.y - 2,
          angle,
          color: isFinisher ? '#fde047' : '#38e8d4',
          life: 0.18,
          maxLife: 0.18,
        });
        // Spear 3rd-hit finisher pierces frontal shields!
        this.damageEnemy(e, damage, Math.cos(angle), Math.sin(angle), isFinisher ? 145 : 92, isFinisher);
        hitAny = true;
      }
    }

    for (const pod of this.currentRoom.pods) {
      if (!pod.broken && this.pointToSegmentDist(pod.x, pod.y, sx, sy, ex, ey) <= 13) {
        this.breakPod(pod);
        hitAny = true;
      }
    }

    if (hitAny) {
      this.hitStop = isFinisher ? 0.045 : 0.022;
      this.triggerShake(isFinisher ? 0.14 : 0.08, isFinisher ? 2.8 : 1.5);
      this.state.energy = Math.min(100, this.state.energy + 11);
      this.callbacks.onHudDirty();
    }

    this.attackCooldown = isFinisher ? 0.29 : 0.18;
    this.comboStep = (this.comboStep + 1) % 3;
    this.comboResetTimer = 0.62;
  }

  private performIonLanceCharge(angle: number): void {
    const cost = 34;
    if (this.state.energy < cost) {
      this.callbacks.onToast('Zu wenig Energie für Lanzen-Vorstoß (34 EN)!', 'warn');
      return;
    }
    this.state.energy -= cost;
    this.specialCooldown = 0.68;
    this.attackCooldown = 0.28;
    this.orientFacing(angle);
    this.lanceChargeTimer = 0.22;
    this.lanceChargeAngle = angle;
    this.lanceHitIds.clear();
    this.invulnTimer = Math.max(this.invulnTimer, 0.34);
    sound.playDash();
    sound.playRailBeam();
    this.triggerShake(0.16, 2.8);
    this.thrusts.push({
      x: this.playerX,
      y: this.playerY - 2,
      angle,
      length: 72,
      comboStep: 2,
      isCharge: true,
      life: 0.25,
      maxLife: 0.25,
    });
    this.spawnBurst(this.playerX, this.playerY, '#38e8d4', 14);
    this.callbacks.onHudDirty();
  }

  private getClosestEnemyHitPoint(
    e: Enemy,
    refX: number,
    refY: number,
  ): { x: number; y: number; r: number } {
    let bestX = e.x;
    let bestY = e.y;
    let bestR = e.radius;
    let bestD = Math.hypot(e.x - refX, e.y - refY) - e.radius;
    if (e.kind === 'boss_leviathan' && e.levArms) {
      for (const arm of e.levArms) {
        const armR = 17;
        const d = Math.hypot(arm.x - refX, arm.y - refY) - armR;
        if (d < bestD) {
          bestD = d;
          bestX = arm.x;
          bestY = arm.y;
          bestR = armR;
        }
      }
    }
    return { x: bestX, y: bestY, r: bestR };
  }

  private getDistanceToEnemyHitbox(e: Enemy, px: number, py: number): number {
    const hit = this.getClosestEnemyHitPoint(e, px, py);
    return Math.hypot(hit.x - px, hit.y - py) - hit.r;
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

    // Hit ALL grounded enemies along beam line (pierces shields!)
    for (const e of [...this.enemies]) {
      if (e.kind === 'boss' && (e.bossHeight ?? 0) > 28) continue;
      let hit = this.pointToSegmentDist(e.x, e.y, sx, sy, ex, ey) <= e.radius + 9;
      if (!hit && e.kind === 'boss_leviathan' && e.levArms) {
        hit = e.levArms.some((arm) => this.pointToSegmentDist(arm.x, arm.y, sx, sy, ex, ey) <= 22);
      }
      if (hit) {
        this.damageEnemy(e, beamDamage, dx, dy, 120, true);
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
      const hitPt = this.getClosestEnemyHitPoint(e, this.playerX, this.playerY);
      const dx = hitPt.x - this.playerX;
      const dy = hitPt.y - this.playerY;
      const dist = Math.hypot(dx, dy);
      if (dist > radius + hitPt.r) continue;
      const diff = Math.abs(this.normalizeAngle(Math.atan2(dy, dx) - angle));
      if (diff <= sweep / 2 + 0.26 || dist < hitPt.r + 10) {
        this.slashHits.push({
          x: hitPt.x,
          y: hitPt.y - 2,
          angle: angle + 0.2,
          color: '#fb923c',
          life: 0.2,
          maxLife: 0.2,
        });
        this.damageEnemy(e, damage, Math.cos(angle), Math.sin(angle), isHeavy ? 210 : 165, isHeavy);
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
      const hitPt = this.getClosestEnemyHitPoint(e, this.playerX, this.playerY);
      const dx = hitPt.x - this.playerX;
      const dy = hitPt.y - this.playerY;
      const dist = Math.max(1, Math.hypot(dx, dy));
      if (dist <= maxR + hitPt.r) {
        this.damageEnemy(e, dmg, dx / dist, dy / dist, 230, true);
      }
    }
    for (const pod of this.currentRoom.pods) {
      if (!pod.broken && Math.hypot(pod.x - this.playerX, pod.y - this.playerY) <= maxR) {
        this.breakPod(pod);
      }
    }
    this.callbacks.onHudDirty();
  }

  // ==================== KINETIK-FÄUSTE (4er-SERIE + KOMETEN-SPRUNG) ====================
  private performFistCombo(angle: number): void {
    const stats = this.state.getStats();
    const step = this.comboStep % 4;
    const isFinisher = step === 3;
    const range = isFinisher ? stats.fistsRange * 1.32 : stats.fistsRange;
    const damage = isFinisher ? Math.round(stats.fistsDamage * 1.65) : stats.fistsDamage;
    const duration = isFinisher ? 0.22 : 0.12;

    this.orientFacing(angle);
    this.swingPoseTimer = duration;
    this.swingPoseMax = duration;
    this.swingPoseAngle = angle;
    this.swingPoseDir = step % 2 === 0 ? 1 : -1;
    this.swingPoseCombo = isFinisher ? 2 : step % 2;

    // Mobile snappy step-in punch feel!
    const stepIn = isFinisher ? 10 : 6;
    this.moveEntityWithCollisions(Math.cos(angle) * stepIn, Math.sin(angle) * stepIn);

    sound.playFistPunch(step);
    const punchX = this.playerX + Math.cos(angle) * (range * 0.55);
    const punchY = this.playerY - 1 + Math.sin(angle) * (range * 0.55);

    this.fistBursts.push({
      x: punchX,
      y: punchY,
      angle,
      step,
      isFinisher,
      life: isFinisher ? 0.22 : 0.13,
      maxLife: isFinisher ? 0.22 : 0.13,
    });

    if (isFinisher) {
      this.shockwaves.push({
        x: punchX,
        y: punchY,
        maxRadius: range * 1.35,
        color: '#fbbf24',
        life: 0.22,
        maxLife: 0.22,
      });
    }

    for (let k = 0; k < (isFinisher ? 12 : 5); k++) {
      const spread = (Math.random() - 0.5) * (isFinisher ? 1.5 : 0.9);
      const sp = (isFinisher ? 62 : 42) + Math.random() * 44;
      this.particles.push({
        x: punchX,
        y: punchY,
        vx: Math.cos(angle + spread) * sp,
        vy: Math.sin(angle + spread) * sp,
        color: k % 2 === 0 ? '#38e8d4' : '#fbbf24',
        size: isFinisher ? 2.1 : 1.5,
        life: 0.18 + Math.random() * 0.12,
        maxLife: 0.3,
      });
    }

    let hitAny = false;
    for (const e of [...this.enemies]) {
      if (e.kind === 'boss' && (e.bossHeight ?? 0) > 28) continue;
      const hitPt = this.getClosestEnemyHitPoint(e, punchX, punchY);
      const dx = hitPt.x - this.playerX;
      const dy = hitPt.y - this.playerY;
      const dist = Math.hypot(dx, dy);
      if (dist > range + hitPt.r + 4) continue;
      const diff = Math.abs(this.normalizeAngle(Math.atan2(dy, dx) - angle));
      if (diff <= (isFinisher ? 1.25 : 0.95) || dist < hitPt.r + 12) {
        this.spawnBurst(hitPt.x, hitPt.y - 2, isFinisher ? '#fbbf24' : '#38e8d4', isFinisher ? 10 : 5);
        // 4th-hit uppercut breaks frontal shields!
        this.damageEnemy(e, damage, Math.cos(angle), Math.sin(angle), isFinisher ? 175 : 70, isFinisher);
        hitAny = true;
      }
    }

    for (const pod of this.currentRoom.pods) {
      if (!pod.broken && Math.hypot(pod.x - punchX, pod.y - punchY) <= range + 6) {
        this.breakPod(pod);
        hitAny = true;
      }
    }

    if (hitAny) {
      this.hitStop = isFinisher ? 0.048 : 0.018;
      this.triggerShake(isFinisher ? 0.15 : 0.06, isFinisher ? 3.0 : 1.2);
      this.state.energy = Math.min(100, this.state.energy + (isFinisher ? 12 : 6));
      this.callbacks.onHudDirty();
    }

    this.attackCooldown = isFinisher ? 0.24 : 0.13;
    this.comboStep = (step + 1) % 4;
    this.comboResetTimer = 0.56;
  }

  private performCometSlam(angle: number): void {
    const cost = 32;
    if (this.state.energy < cost) {
      this.callbacks.onToast('Zu wenig Energie für Kometen-Sprung (32 EN)!', 'warn');
      return;
    }
    this.state.energy -= cost;
    this.specialCooldown = 0.78;
    this.attackCooldown = 0.28;
    this.cometSlamTimer = 0.22;
    this.cometSlamAngle = angle;
    this.invulnTimer = Math.max(this.invulnTimer, 0.34);
    this.orientFacing(angle);
    sound.playDash();
    this.spawnBurst(this.playerX, this.playerY, '#fbbf24', 10);
    this.callbacks.onHudDirty();
  }

  private triggerCometImpact(): void {
    const stats = this.state.getStats();
    const dmg = Math.round(stats.fistsDamage * 2.15);
    const maxR = 48;

    sound.playCometSlam();
    this.triggerShake(0.24, 4.2);
    this.shockwaves.push({
      x: this.playerX,
      y: this.playerY,
      maxRadius: maxR,
      color: '#fbbf24',
      life: 0.28,
      maxLife: 0.28,
    });
    this.decals.push({
      x: this.playerX,
      y: this.playerY + 4,
      r: 22,
      color: 'rgba(251, 146, 60, 0.35)',
      life: 2.2,
      maxLife: 2.2,
    });
    this.spawnBurst(this.playerX, this.playerY, '#fbbf24', 18);
    this.spawnBurst(this.playerX, this.playerY, '#38e8d4', 10);

    for (const e of [...this.enemies]) {
      if (e.kind === 'boss' && (e.bossHeight ?? 0) > 28) continue;
      const hitPt = this.getClosestEnemyHitPoint(e, this.playerX, this.playerY);
      const dx = hitPt.x - this.playerX;
      const dy = hitPt.y - this.playerY;
      const dist = Math.max(1, Math.hypot(dx, dy));
      if (dist <= maxR + hitPt.r) {
        this.damageEnemy(e, dmg, dx / dist, dy / dist, 210, true);
      }
    }
    for (const pod of this.currentRoom.pods) {
      if (!pod.broken && Math.hypot(pod.x - this.playerX, pod.y - this.playerY) <= maxR) {
        this.breakPod(pod);
      }
    }
  }

  // ==================== PHASEN-DISKUS (RICOCHET + MAGNET-RÜCKRUF / ORBIT) ====================
  private performDiscusThrow(angle: number): void {
    if (this.discs.length >= 2) {
      // Gently recall oldest disc if player already has 2 active discs out!
      this.discs[0].recalling = true;
      this.attackCooldown = 0.16;
      return;
    }

    const stats = this.state.getStats();
    const speed = 235;
    this.orientFacing(angle);
    this.swingPoseTimer = 0.16;
    this.swingPoseMax = 0.16;
    this.swingPoseAngle = angle;
    this.swingPoseDir = 1;
    this.swingPoseCombo = 0;

    sound.playDiscusThrow();
    this.discs.push({
      x: this.playerX + Math.cos(angle) * 10,
      y: this.playerY - 1 + Math.sin(angle) * 10,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      speed,
      damage: stats.discusDamage,
      bouncesLeft: stats.discusBounces,
      recalling: false,
      spin: 0,
      life: 2.6,
      hitCooldowns: new Map<number, number>(),
      trail: [],
    });
    this.attackCooldown = 0.24;
  }

  private performDiscusRecall(): void {
    const cost = 28;
    if (this.state.energy < cost) {
      this.callbacks.onToast('Zu wenig Energie für Phasen-Rückruf / Orbit (28 EN)!', 'warn');
      return;
    }
    this.state.energy -= cost;
    this.specialCooldown = 0.65;
    sound.playDiscusRecall();

    if (this.discs.length > 0) {
      // Magnet-Recall: pull all active discs straight through enemies for 1.7x piercing damage!
      for (const d of this.discs) {
        d.recalling = true;
        d.hitCooldowns.clear();
        d.life = Math.max(d.life, 1.5);
      }
      this.shockwaves.push({
        x: this.playerX,
        y: this.playerY,
        maxRadius: 34,
        color: '#c084fc',
        life: 0.22,
        maxLife: 0.22,
      });
      this.floats.push({
        x: this.playerX,
        y: this.playerY - 18,
        text: 'MAGNET-RÜCKRUF!',
        color: '#e879f9',
        life: 0.85,
        maxLife: 0.85,
      });
    } else {
      // Klingen-Orbit: spawn twin spinning orbital phase blades around hero for 3.2s!
      this.discusOrbitTimer = 3.2;
      this.discusOrbitHitCds.clear();
      this.shockwaves.push({
        x: this.playerX,
        y: this.playerY,
        maxRadius: 36,
        color: '#c084fc',
        life: 0.24,
        maxLife: 0.24,
      });
      this.floats.push({
        x: this.playerX,
        y: this.playerY - 18,
        text: 'KLINGEN-ORBIT!',
        color: '#c084fc',
        life: 0.85,
        maxLife: 0.85,
      });
    }
    this.callbacks.onHudDirty();
  }

  private updateDiscs(dt: number): void {
    const stats = this.state.getStats();

    // Update active Orbiting Blade Ring (when Discus secondary activated with 0 discs in flight)
    if (this.discusOrbitTimer > 0) {
      this.discusOrbitTimer = Math.max(0, this.discusOrbitTimer - dt);
      this.discusOrbitAngle += dt * 7.8;
      for (const [eid, cd] of this.discusOrbitHitCds) {
        if (cd - dt <= 0) this.discusOrbitHitCds.delete(eid);
        else this.discusOrbitHitCds.set(eid, cd - dt);
      }
      const orbitR = 26;
      const orbitDmg = Math.round(stats.discusDamage * 0.85);
      for (let b = 0; b < 2; b++) {
        const a = this.discusOrbitAngle + b * Math.PI;
        const bx = this.playerX + Math.cos(a) * orbitR;
        const by = this.playerY - 1 + Math.sin(a) * orbitR;
        for (const e of [...this.enemies]) {
          if (this.discusOrbitHitCds.has(e.id)) continue;
          if (e.kind === 'boss' && (e.bossHeight ?? 0) > 28) continue;
          if (this.getDistanceToEnemyHitbox(e, bx, by) <= 10) {
            this.discusOrbitHitCds.set(e.id, 0.34);
            const len = Math.max(1, Math.hypot(e.x - this.playerX, e.y - this.playerY));
            this.damageEnemy(e, orbitDmg, (e.x - this.playerX) / len, (e.y - this.playerY) / len, 65, false);
            this.spawnBurst(bx, by, '#c084fc', 5);
          }
        }
        for (const pod of this.currentRoom.pods) {
          if (!pod.broken && Math.hypot(pod.x - bx, pod.y - by) <= 13) {
            this.breakPod(pod);
          }
        }
      }
    }

    // Update bouncing / recalling Phase Discs!
    for (let i = this.discs.length - 1; i >= 0; i--) {
      const d = this.discs[i];
      d.life -= dt;
      d.spin += dt * (d.recalling ? 24 : 16);

      for (const [eid, cd] of d.hitCooldowns) {
        if (cd - dt <= 0) d.hitCooldowns.delete(eid);
        else d.hitCooldowns.set(eid, cd - dt);
      }

      d.trail.push({ x: d.x, y: d.y });
      if (d.trail.length > 7) d.trail.shift();

      if (d.recalling) {
        const dx = this.playerX - d.x;
        const dy = this.playerY - d.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 14 || d.life <= 0) {
          this.spawnBurst(this.playerX, this.playerY, '#c084fc', 6);
          this.discs.splice(i, 1);
          continue;
        }
        const recallSpeed = 320;
        d.vx = (dx / dist) * recallSpeed;
        d.vy = (dy / dist) * recallSpeed;
        d.x += d.vx * dt;
        d.y += d.vy * dt;
      } else {
        let nx = d.x + d.vx * dt;
        let ny = d.y + d.vy * dt;
        let bounced = false;

        // Room wall bounce
        if (nx <= ROOM_LEFT + 7 || nx >= ROOM_RIGHT - 7) {
          d.vx = -d.vx;
          nx = Math.max(ROOM_LEFT + 8, Math.min(ROOM_RIGHT - 8, nx));
          bounced = true;
        }
        if (ny <= ROOM_TOP + 7 || ny >= ROOM_BOTTOM - 7) {
          d.vy = -d.vy;
          ny = Math.max(ROOM_TOP + 8, Math.min(ROOM_BOTTOM - 8, ny));
          bounced = true;
        }

        // Obstacle / pillar bounce
        if (!bounced && this.collidesRoomObstacle(nx, ny, 5)) {
          if (!this.collidesRoomObstacle(d.x - d.vx * dt, ny, 5)) {
            d.vx = -d.vx;
          } else {
            d.vy = -d.vy;
          }
          nx = d.x + d.vx * dt;
          ny = d.y + d.vy * dt;
          bounced = true;
        }

        d.x = nx;
        d.y = ny;

        if (bounced) {
          if (d.bouncesLeft > 0) {
            d.bouncesLeft -= 1;
            sound.playDiscusBounce();
            this.spawnBurst(d.x, d.y, '#38e8d4', 6);
            this.nudgeDiscTowardEnemy(d, -1);
          } else {
            d.recalling = true;
            d.hitCooldowns.clear();
          }
        }
        if (d.life <= 0.45) {
          d.recalling = true;
        }
      }

      // Break salvage pods
      for (const pod of this.currentRoom.pods) {
        if (!pod.broken && Math.hypot(pod.x - d.x, pod.y - d.y) <= 14) {
          this.breakPod(pod);
        }
      }

      // Enemy hit check (bounces off enemies on normal flight, pierces on Magnet-Recall!)
      for (const e of [...this.enemies]) {
        if (d.hitCooldowns.has(e.id)) continue;
        if (e.kind === 'boss' && (e.bossHeight ?? 0) > 28) continue;
        if (this.getDistanceToEnemyHitbox(e, d.x, d.y) <= 9) {
          d.hitCooldowns.set(e.id, 0.24);
          const len = Math.max(1, Math.hypot(d.vx, d.vy));
          const dmg = d.recalling ? Math.round(d.damage * 1.7) : d.damage;
          this.damageEnemy(e, dmg, d.vx / len, d.vy / len, d.recalling ? 95 : 55, d.recalling);
          this.slashHits.push({
            x: d.x,
            y: d.y,
            angle: Math.atan2(d.vy, d.vx),
            color: d.recalling ? '#f0abfc' : '#38e8d4',
            life: 0.14,
            maxLife: 0.14,
          });
          this.state.energy = Math.min(100, this.state.energy + 4);
          this.callbacks.onHudDirty();

          if (!d.recalling) {
            if (d.bouncesLeft > 0) {
              d.bouncesLeft -= 1;
              sound.playDiscusBounce();
              this.spawnBurst(d.x, d.y, '#c084fc', 7);
              // Ricochet toward another enemy or reflect away cleanly!
              if (!this.nudgeDiscTowardEnemy(d, e.id)) {
                const ang = Math.atan2(d.y - e.y, d.x - e.x) + (Math.random() - 0.5) * 0.5;
                d.vx = Math.cos(ang) * d.speed;
                d.vy = Math.sin(ang) * d.speed;
              }
            } else {
              d.recalling = true;
              d.hitCooldowns.clear();
            }
            break;
          }
        }
      }
    }
  }

  private nudgeDiscTowardEnemy(d: DiscusProjectile, excludeId: number): boolean {
    let best: Enemy | null = null;
    let bestDist = 175;
    for (const e of this.enemies) {
      if (e.id === excludeId) continue;
      if (e.kind === 'boss' && (e.bossHeight ?? 0) > 28) continue;
      const dist = Math.hypot(e.x - d.x, e.y - d.y);
      if (dist < bestDist) {
        bestDist = dist;
        best = e;
      }
    }
    if (!best) return false;
    const ang = Math.atan2(best.y - d.y, best.x - d.x);
    d.vx = Math.cos(ang) * d.speed;
    d.vy = Math.sin(ang) * d.speed;
    return true;
  }

  // ==================== COMPANION BOTS (FREISCHALTBARE BEGLEITER / FAMILIARS) ====================
  private updateCompanion(dt: number): void {
    const comp = this.state.equippedCompanion;
    if (!comp) return;

    // Gentle orbital follow offset behind hero
    const orbitX = this.playerX + Math.cos(this.time * 2.1) * 18 - (this.facing === 'right' ? 8 : this.facing === 'left' ? -8 : 0);
    const orbitY = this.playerY - 6 + Math.sin(this.time * 2.6) * 12;
    this.companionX += (orbitX - this.companionX) * Math.min(1, dt * 6.5);
    this.companionY += (orbitY - this.companionY) * Math.min(1, dt * 6.5);

    // Kampf-Bot Spark: fires automatic plasma darts every 1.35s at nearest enemy!
    if (comp === 'spark' && this.enemies.length > 0) {
      this.sparkFireTimer -= dt;
      if (this.sparkFireTimer <= 0) {
        let target: Enemy | null = null;
        let bestD = 210;
        for (const e of this.enemies) {
          if (e.kind === 'boss' && (e.bossHeight ?? 0) > 28) continue;
          const dist = Math.hypot(e.x - this.companionX, e.y - this.companionY);
          if (dist < bestD) {
            bestD = dist;
            target = e;
          }
        }
        if (target) {
          this.sparkFireTimer = 1.35;
          const ang = Math.atan2(target.y - this.companionY, target.x - this.companionX);
          const dmg = 14 + this.currentFloor * 5;
          this.projectiles.push({
            x: this.companionX + Math.cos(ang) * 7,
            y: this.companionY + Math.sin(ang) * 7,
            vx: Math.cos(ang) * 245,
            vy: Math.sin(ang) * 245,
            fromPlayer: true,
            damage: dmg,
            color: '#fb7185',
            radius: 3.5,
            life: 1.2,
          });
          sound.playBlaster();
          this.spawnBurst(this.companionX, this.companionY, '#fb7185', 4);
        } else {
          this.sparkFireTimer = 0.25;
        }
      }
    }

    // Aegis-Bot Halo: recharges golden orbital shield every 12s!
    if (comp === 'halo' && !this.haloShieldReady) {
      this.haloChargeTimer += dt;
      if (this.haloChargeTimer >= 12.0) {
        this.haloChargeTimer = 0;
        this.haloShieldReady = true;
        sound.playHaloBlock();
        this.spawnBurst(this.playerX, this.playerY, '#fde047', 12);
        this.floats.push({
          x: this.playerX,
          y: this.playerY - 18,
          text: 'HALO BEREIT!',
          color: '#fde047',
          life: 1.0,
          maxLife: 1.0,
        });
      }
    }
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
      } else if (e.kind === 'shield_drone') {
        // Armored Aegis-Drone: tracks player with frontal kinetic shield arc (flank or pierce!), fires 3-bolt burst!
        const targetAng = Math.atan2(dy, dx);
        const turnDiff = this.normalizeAngle(targetAng - e.aimAngle);
        const turnRate = e.telegraphTimer > 0 ? 1.2 : 2.3;
        e.aimAngle += Math.max(-turnRate * dt, Math.min(turnRate * dt, turnDiff));

        const desiredDist = 74;
        const radial = dist > desiredDist + 14 ? 1 : dist < 50 ? -1 : 0;
        const strafe = e.moveDirX;
        e.vx += (-ny * strafe * 44 + nx * radial * 46) * dt * 4;
        e.vy += (nx * strafe * 44 + ny * radial * 46) * dt * 4;

        if (e.telegraphTimer > 0) {
          e.telegraphTimer -= dt;
          if (e.telegraphTimer <= 0) {
            for (const off of [-0.24, 0, 0.24]) {
              this.fireEnemyBolt(e.x, e.y, e.aimAngle + off, 148, 14, '#38e8d4');
            }
            this.spawnBurst(e.x + Math.cos(e.aimAngle) * 10, e.y + Math.sin(e.aimAngle) * 10, '#38e8d4', 6);
            e.moveDirX = -e.moveDirX;
            e.aiTimer = 1.65 + Math.random() * 0.45;
          }
        } else {
          e.aiTimer -= dt;
          if (e.aiTimer <= 0) {
            e.telegraphTimer = 0.48;
          }
        }
      } else if (e.kind === 'spore_spitter') {
        // Bioluminescent Floor II/III Spore-Spitter: fires bursting spore globs that split into 5 mini-spores, then burrows!
        if (e.scurryTimer > 0) {
          e.scurryTimer -= dt;
          e.vx = e.moveDirX * 84;
          e.vy = e.moveDirY * 84;
          if (Math.random() < dt * 14) {
            this.particles.push({
              x: e.x,
              y: e.y + 6,
              vx: (Math.random() - 0.5) * 20,
              vy: -14,
              color: '#34d399',
              size: 1.8,
              life: 0.25,
              maxLife: 0.25,
            });
          }
          if (e.scurryTimer <= 0) {
            e.aiTimer = 0.7 + Math.random() * 0.4;
          }
        } else if (e.telegraphTimer > 0) {
          e.vx *= 0.2;
          e.vy *= 0.2;
          e.telegraphTimer -= dt;
          if (e.telegraphTimer <= 0) {
            const ang = Math.atan2(dy, dx);
            this.projectiles.push({
              x: e.x,
              y: e.y,
              vx: Math.cos(ang) * 124,
              vy: Math.sin(ang) * 124,
              fromPlayer: false,
              damage: 14,
              color: '#a3e635',
              radius: 5.0,
              life: 0.85,
              isSporeGlob: true,
            });
            this.spawnBurst(e.x, e.y, '#34d399', 7);
            // Skitter away to a new flank angle
            const away = ang + Math.PI + (Math.random() - 0.5) * 1.4;
            e.moveDirX = Math.cos(away);
            e.moveDirY = Math.sin(away);
            e.scurryTimer = 0.72;
          }
        } else {
          e.aiTimer -= dt;
          if (e.aiTimer <= 0) {
            e.telegraphTimer = 0.5;
          }
        }
      } else if (e.kind === 'drone_arc') {
        // Floor II/III Overcharged Arc-Drone: agile orbital strafing + 3-bolt electric arc fan!
        e.phase += dt * 2.4;
        const desiredDist = 104;
        const radial = dist > desiredDist + 16 ? 1 : dist < desiredDist - 16 ? -1 : 0;
        const tx = -ny * Math.sin(e.phase * 0.7) * 68;
        const ty = nx * Math.sin(e.phase * 0.7) * 68;
        e.vx = nx * radial * 52 + tx;
        e.vy = ny * radial * 52 + ty;
        if (e.telegraphTimer > 0) {
          e.vx *= 0.22;
          e.vy *= 0.22;
          e.telegraphTimer -= dt;
          if (Math.random() < dt * 16) {
            this.particles.push({
              x: e.x + (Math.random() - 0.5) * 14,
              y: e.y + (Math.random() - 0.5) * 14,
              vx: (Math.random() - 0.5) * 26,
              vy: (Math.random() - 0.5) * 26,
              color: Math.random() < 0.5 ? '#c084fc' : '#38e8d4',
              size: 1.6,
              life: 0.2,
              maxLife: 0.2,
            });
          }
          if (e.telegraphTimer <= 0) {
            const baseAng = Math.atan2(dy, dx);
            for (const offset of [-0.25, 0, 0.25]) {
              const a = baseAng + offset;
              this.projectiles.push({
                x: e.x + Math.cos(a) * 10,
                y: e.y + Math.sin(a) * 10,
                vx: Math.cos(a) * 148,
                vy: Math.sin(a) * 148,
                fromPlayer: false,
                damage: 14,
                color: offset === 0 ? '#38e8d4' : '#c084fc',
                radius: 3.4,
                life: 1.7,
              });
            }
            this.spawnBurst(e.x, e.y, '#c084fc', 8);
            e.aiTimer = 1.65 + Math.random() * 0.45;
          }
        } else {
          e.aiTimer -= dt;
          if (e.aiTimer <= 0) {
            e.telegraphTimer = 0.48;
          }
        }
      } else if (e.kind === 'slime_magma') {
        // Floor III Reactor Magma-Slime: aggressive flaming hops leaving molten ember decals + 2-shot ember burst on pounce!
        if (e.chargeActive > 0) {
          e.chargeActive -= dt;
          e.vx = e.chargeDirX * 138;
          e.vy = e.chargeDirY * 138;
          if (Math.random() < dt * 22) {
            this.particles.push({
              x: e.x,
              y: e.y + 4,
              vx: (Math.random() - 0.5) * 26,
              vy: (Math.random() - 0.5) * 26,
              color: Math.random() < 0.5 ? '#fb923c' : '#fde047',
              size: 2.0,
              life: 0.28,
              maxLife: 0.28,
            });
          }
          if (e.chargeActive <= 0) {
            // Molten landing impact: fire decal + 2 flanking sparks!
            this.decals.push({
              x: e.x,
              y: e.y + 5,
              r: 13,
              color: 'rgba(249, 115, 22, 0.36)',
              life: 3.4,
              maxLife: 3.4,
            });
            const ang = Math.atan2(dy, dx);
            for (const off of [-0.45, 0.45]) {
              this.projectiles.push({
                x: e.x,
                y: e.y,
                vx: Math.cos(ang + off) * 116,
                vy: Math.sin(ang + off) * 116,
                fromPlayer: false,
                damage: 13,
                color: '#fb923c',
                radius: 3.6,
                life: 1.15,
              });
            }
            this.spawnBurst(e.x, e.y, '#f97316', 9);
            e.aiTimer = 0.85 + Math.random() * 0.35;
          }
        } else if (e.telegraphTimer > 0) {
          e.vx *= 0.2;
          e.vy *= 0.2;
          e.telegraphTimer -= dt;
          if (e.telegraphTimer <= 0) {
            e.chargeDirX = nx;
            e.chargeDirY = ny;
            e.chargeActive = 0.34;
          }
        } else {
          e.vx = nx * 44;
          e.vy = ny * 44;
          e.aiTimer -= dt;
          if (e.aiTimer <= 0) {
            e.telegraphTimer = 0.38;
          }
        }
      } else if (e.kind === 'phase_stalker') {
        // Brand-new Floor III Phase-Stalker: stalks, telegraphs a magenta phase-blink near the player's flank, teleports & lunges with twin plasma blades!
        if (e.chargeActive > 0) {
          e.chargeActive -= dt;
          e.vx = e.chargeDirX * 195;
          e.vy = e.chargeDirY * 195;
          if (Math.random() < dt * 28) {
            this.particles.push({
              x: e.x,
              y: e.y,
              vx: -e.chargeDirX * 22,
              vy: -e.chargeDirY * 22,
              color: '#f43f5e',
              size: 2.0,
              life: 0.24,
              maxLife: 0.24,
            });
          }
          if (e.chargeActive <= 0) {
            e.aiTimer = 1.25 + Math.random() * 0.45;
          }
        } else if (e.telegraphTimer > 0) {
          e.vx *= 0.15;
          e.vy *= 0.15;
          e.telegraphTimer -= dt;
          if (e.telegraphTimer <= 0) {
            // Execute phase-blink to telegraphed flank spot, then strike toward hero!
            this.spawnBurst(e.x, e.y, '#e879f9', 10);
            const tx = Math.max(ROOM_LEFT + 18, Math.min(ROOM_RIGHT - 18, e.bossTargetX ?? e.x));
            const ty = Math.max(ROOM_TOP + 18, Math.min(ROOM_BOTTOM - 18, e.bossTargetY ?? e.y));
            if (!this.collidesRoomObstacle(tx, ty, e.radius)) {
              e.x = tx;
              e.y = ty;
            }
            this.spawnBurst(e.x, e.y, '#f43f5e', 12);
            const sdx = this.playerX - e.x;
            const sdy = this.playerY - e.y;
            const sd = Math.max(1, Math.hypot(sdx, sdy));
            e.chargeDirX = sdx / sd;
            e.chargeDirY = sdy / sd;
            e.aimAngle = Math.atan2(sdy, sdx);
            e.chargeActive = 0.24;
            // Also fire a crisp twin-blade energy wave on dash!
            this.projectiles.push({
              x: e.x + e.chargeDirX * 10,
              y: e.y + e.chargeDirY * 10,
              vx: e.chargeDirX * 175,
              vy: e.chargeDirY * 175,
              fromPlayer: false,
              damage: 15,
              color: '#f43f5e',
              radius: 4.0,
              life: 0.65,
            });
          }
        } else {
          // Agile flanking stalk
          const ang = Math.atan2(dy, dx);
          e.aimAngle = ang;
          e.vx = nx * 48 - ny * 26 * e.moveDirX;
          e.vy = ny * 48 + nx * 26 * e.moveDirX;
          e.aiTimer -= dt;
          if (e.aiTimer <= 0) {
            // Choose a telegraphed blink position ~58px beside/behind hero
            const flankAngle = ang + Math.PI + (Math.random() < 0.5 ? 0.9 : -0.9);
            e.bossTargetX = Math.max(
              ROOM_LEFT + 22,
              Math.min(ROOM_RIGHT - 22, this.playerX + Math.cos(flankAngle) * 58),
            );
            e.bossTargetY = Math.max(
              ROOM_TOP + 22,
              Math.min(ROOM_BOTTOM - 22, this.playerY + Math.sin(flankAngle) * 52),
            );
            e.telegraphTimer = 0.54;
            e.moveDirX = -e.moveDirX;
          }
        }
      } else if (e.kind === 'boss_breacher') {
        this.updateBreacherAI(e, dt, dx, dy, nx, ny);
      } else if (e.kind === 'boss') {
        this.updateBossAI(e, dt, dx, dy, nx, ny);
      } else if (e.kind === 'boss_leviathan') {
        this.updateLeviathanAI(e, dt);
      }

      const prevX = e.x;
      const prevY = e.y;
      const airborne = e.kind === 'boss' && (e.bossHeight ?? 0) > 22;

      if (e.kind !== 'boss_leviathan') {
        const ex = Math.max(ROOM_LEFT + e.radius, Math.min(ROOM_RIGHT - e.radius, e.x + e.vx * dt));
        if (
          !this.collidesRoomObstacle(ex, e.y, e.radius * 0.85) ||
          e.kind === 'drone' ||
          e.kind === 'drone_arc' ||
          e.kind === 'shield_drone' ||
          airborne
        ) {
          e.x = ex;
        } else if (e.kind === 'turret' || e.kind === 'spore_spitter') {
          e.moveDirX = -e.moveDirX;
        }
        const ey = Math.max(ROOM_TOP + e.radius, Math.min(ROOM_BOTTOM - e.radius, e.y + e.vy * dt));
        if (
          !this.collidesRoomObstacle(e.x, ey, e.radius * 0.85) ||
          e.kind === 'drone' ||
          e.kind === 'drone_arc' ||
          e.kind === 'shield_drone' ||
          airborne
        ) {
          e.y = ey;
        } else if (e.kind === 'turret' || e.kind === 'spore_spitter') {
          e.moveDirY = -e.moveDirY;
        }
      }

      // Boss wall slam bounce during Rocket/Hydraulic Charge!
      if ((e.kind === 'boss' || e.kind === 'boss_breacher') && e.bossState === 'charge_dash') {
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
          e.bossStateTimer = 0.6;
          e.bossStateMax = 0.6;
          e.bossStatusText = 'ÜBERHITZT';
        }
      }

      if (!airborne) {
        const pDist = Math.hypot(this.playerX - e.x, this.playerY - e.y);
        if (pDist < e.radius + 7) {
          const pushX = (this.playerX - e.x) / Math.max(1, pDist);
          const pushY = (this.playerY - e.y) / Math.max(1, pDist);
          this.damagePlayer(this.isBossKind(e.kind) ? 20 : 12, pushX, pushY, e);
        }
        // Leviathan gauntlet contact damage during slams!
        if (e.kind === 'boss_leviathan' && e.levArms) {
          for (const arm of e.levArms) {
            if (arm.state === 'slamming') {
              const aDist = Math.hypot(this.playerX - arm.x, this.playerY - arm.y);
              if (aDist < 19) {
                this.damagePlayer(
                  20,
                  (this.playerX - arm.x) / Math.max(1, aDist),
                  (this.playerY - arm.y) / Math.max(1, aDist),
                  e,
                );
              }
            }
          }
        }
      }
    }
  }

  private updateHazardsAndDebris(dt: number): void {
    // 1. Floor II/III Steam / Plasma Floor Vents (4.0s cycle: safe 0..2.2, warn 2.2..3.0, active 3.0..4.0)
    for (const h of this.currentRoom.hazards) {
      const cycle = (this.time + h.phase) % 4.0;
      if (cycle >= 3.0) {
        if (Math.random() < dt * 16) {
          this.particles.push({
            x: h.x + (Math.random() - 0.5) * h.r,
            y: h.y + (Math.random() - 0.5) * h.r * 0.7,
            vx: (Math.random() - 0.5) * 18,
            vy: -34 - Math.random() * 24,
            color: Math.random() > 0.45 ? '#38e8d4' : '#fb923c',
            size: 2,
            life: 0.25,
            maxLife: 0.25,
          });
        }
        if (this.dashTimer <= 0 && this.lanceChargeTimer <= 0) {
          const dist = Math.hypot(this.playerX - h.x, this.playerY - h.y);
          if (dist < h.r + 4) {
            this.damagePlayer(
              14,
              (this.playerX - h.x) / Math.max(1, dist),
              (this.playerY - h.y) / Math.max(1, dist),
            );
          }
        }
      }
    }

    // 2. Leviathan Falling Reactor Debris Rings!
    for (let i = this.debrisDrops.length - 1; i >= 0; i--) {
      const d = this.debrisDrops[i];
      d.timer -= dt;
      if (d.timer <= 0) {
        sound.playBossSlam();
        this.triggerShake(0.16, 2.8);
        this.decals.push({
          x: d.x,
          y: d.y + 2,
          r: d.r * 0.7,
          color: 'rgba(15, 23, 42, 0.55)',
          life: 4.5,
          maxLife: 4.5,
        });
        this.shockwaves.push({
          x: d.x,
          y: d.y,
          maxRadius: d.r + 12,
          color: '#fb923c',
          life: 0.26,
          maxLife: 0.26,
        });
        this.spawnBurst(d.x, d.y, '#fbbf24', 14);
        const pd = Math.hypot(this.playerX - d.x, this.playerY - d.y);
        if (pd <= d.r + 4) {
          this.damagePlayer(
            18,
            (this.playerX - d.x) / Math.max(1, pd),
            (this.playerY - d.y) / Math.max(1, pd),
          );
        }
        this.debrisDrops.splice(i, 1);
      }
    }
  }

  // ==================== FLOOR I BOSS: SCHOTT-BRECHER MK-II ====================
  private updateBreacherAI(e: Enemy, dt: number, dx: number, dy: number, nx: number, ny: number): void {
    const enraged = e.hp <= e.maxHp * 0.5;
    if (enraged && !e.bossPhase2) {
      e.bossPhase2 = true;
      sound.playBossRoar();
      this.triggerShake(0.32, 4.0);
      this.shockwaves.push({ x: e.x, y: e.y, maxRadius: 72, color: '#fb923c', life: 0.36, maxLife: 0.36 });
      this.spawnBurst(e.x, e.y, '#fbbf24', 20);
      this.callbacks.onToast('⚠ Schott-Brecher MK-II aktiviert Hydraulik-Overdrive!', 'warn');
    }

    const state: BossState = e.bossState ?? 'stalk';
    e.bossStateTimer = (e.bossStateTimer ?? 0) - dt;

    if (state === 'stunned') {
      if (e.bossStateTimer <= 0) {
        e.bossState = 'stalk';
        e.bossStateTimer = enraged ? 0.65 : 0.9;
        e.bossStateMax = e.bossStateTimer;
        e.bossStatusText = enraged ? 'OVERDRIVE' : 'AKTIV';
      }
      return;
    }

    if (state === 'charge_windup') {
      e.vx *= 0.2;
      e.vy *= 0.2;
      if (e.bossStateTimer > (e.bossStateMax ?? 0.55) * 0.35) {
        e.chargeDirX = nx;
        e.chargeDirY = ny;
      }
      if (e.bossStateTimer <= 0) {
        sound.playBossCharge();
        e.bossState = 'charge_dash';
        e.bossStateTimer = enraged ? 0.52 : 0.46;
        e.bossStateMax = e.bossStateTimer;
        e.bossStatusText = 'HYDRAULIK-RAMME!';
      }
      return;
    }

    if (state === 'charge_dash') {
      const spd = enraged ? 235 : 198;
      e.vx = e.chargeDirX * spd;
      e.vy = e.chargeDirY * spd;
      e.bossAfterimageTick = (e.bossAfterimageTick ?? 0) - dt;
      if (e.bossAfterimageTick <= 0) {
        e.bossAfterimageTick = 0.06;
        this.bossAfterimages.push({
          x: e.x,
          y: e.y,
          height: 0,
          tilt: e.chargeDirX * 0.2,
          enraged,
          isBreacher: true,
          life: 0.22,
          maxLife: 0.22,
        });
      }
      if (e.bossStateTimer <= 0) {
        e.bossState = 'stalk';
        e.bossStateTimer = enraged ? 0.72 : 0.95;
        e.bossStateMax = e.bossStateTimer;
        e.bossStatusText = enraged ? 'OVERDRIVE' : 'AKTIV';
      }
      return;
    }

    if (state === 'breacher_stomp') {
      e.vx *= 0.2;
      e.vy *= 0.2;
      if (e.bossStateTimer <= 0) {
        sound.playBossSlam();
        this.triggerShake(0.3, 4.5);
        this.shockwaves.push({ x: e.x, y: e.y + 4, maxRadius: 64, color: '#fbbf24', life: 0.32, maxLife: 0.32 });
        this.spawnBurst(e.x, e.y + 4, '#fb923c', 20);
        const bolts = enraged ? 8 : 6;
        for (let k = 0; k < bolts; k++) {
          const a = (k / bolts) * Math.PI * 2 + 0.15;
          this.fireEnemyBolt(e.x, e.y, a, enraged ? 132 : 112, 14, '#fbbf24');
        }
        const pd = Math.hypot(this.playerX - e.x, this.playerY - e.y);
        if (pd <= 46) {
          this.damagePlayer(18, (this.playerX - e.x) / Math.max(1, pd), (this.playerY - e.y) / Math.max(1, pd), e);
        }
        e.bossState = 'stalk';
        e.bossStateTimer = enraged ? 0.78 : 1.05;
        e.bossStateMax = e.bossStateTimer;
        e.bossStatusText = enraged ? 'OVERDRIVE' : 'AKTIV';
      }
      return;
    }

    if (state === 'breacher_fan') {
      e.vx *= 0.3;
      e.vy *= 0.3;
      if (e.bossStateTimer <= 0) {
        const base = Math.atan2(dy, dx);
        const spread = enraged ? [-0.42, -0.21, 0, 0.21, 0.42] : [-0.36, -0.18, 0, 0.18, 0.36];
        for (const off of spread) {
          this.fireEnemyBolt(e.x, e.y, base + off, enraged ? 152 : 134, 13, '#fb923c');
        }
        sound.playBlaster();
        this.spawnBurst(e.x, e.y, '#fbbf24', 10);
        e.bossState = 'stalk';
        e.bossStateTimer = enraged ? 0.72 : 0.96;
        e.bossStateMax = e.bossStateTimer;
        e.bossStatusText = enraged ? 'OVERDRIVE' : 'AKTIV';
      }
      return;
    }

    // Stalk toward player with heavy industrial stomp rhythm
    e.vx += nx * (enraged ? 58 : 44) * dt * 3.2;
    e.vy += ny * (enraged ? 58 : 44) * dt * 3.2;

    if (e.bossStateTimer <= 0) {
      const atk = e.phase % 3;
      e.phase += 1;
      if (atk === 0) {
        e.bossState = 'charge_windup';
        e.bossStateTimer = enraged ? 0.48 : 0.58;
        e.bossStateMax = e.bossStateTimer;
        e.chargeDirX = nx;
        e.chargeDirY = ny;
        e.bossStatusText = 'ANLAUF...';
      } else if (atk === 1) {
        e.bossState = 'breacher_stomp';
        e.bossStateTimer = 0.48;
        e.bossStateMax = 0.48;
        e.bossStatusText = 'SEISMIK-STAMPFER!';
      } else {
        e.bossState = 'breacher_fan';
        e.bossStateTimer = 0.44;
        e.bossStateMax = 0.44;
        e.bossStatusText = 'SCHROTT-SALVE!';
      }
    }
  }

  // ==================== FLOOR III GIGANTIC BOSS: A.E.G.I.S. LEVIATHAN ====================
  private updateLeviathanAI(e: Enemy, dt: number): void {
    const arms = e.levArms;
    if (!arms) return;
    const enraged = e.hp <= e.maxHp * 0.5;

    // Dramatic Phase-2 Omega Overload at 50% HP!
    if (enraged && !e.bossPhase2) {
      e.bossPhase2 = true;
      e.bossState = 'phase2_roar';
      e.bossStateTimer = 1.25;
      e.bossStateMax = 1.25;
      e.bossStatusText = 'OMEGA-ÜBERLASTUNG!';
      for (const arm of arms) {
        arm.state = 'returning';
      }
      sound.playBossRoar();
      this.triggerShake(0.55, 6.2);
      this.shockwaves.push({ x: e.x, y: e.y + 8, maxRadius: 140, color: '#fb7185', life: 0.5, maxLife: 0.5 });
      this.spawnBurst(e.x, e.y + 8, '#fb7185', 34);
      this.callbacks.onToast('🚨 PHASE II: A.E.G.I.S. LEVIATHAN zündet OMEGA-ÜBERLASTUNG!', 'warn');
      return;
    }

    // Update each giant articulated gauntlet smoothly
    for (const arm of arms) {
      if (arm.state === 'idle' || arm.state === 'returning') {
        const hoverY = arm.homeY + Math.sin(this.time * 3.0 + arm.side) * 4;
        arm.x += (arm.homeX - arm.x) * Math.min(1, dt * 6);
        arm.y += (hoverY - arm.y) * Math.min(1, dt * 6);
        if (arm.state === 'returning' && Math.hypot(arm.x - arm.homeX, arm.y - hoverY) < 4) {
          arm.state = 'idle';
        }
      } else if (arm.state === 'tracking') {
        arm.timer -= dt;
        // Track player smoothly during first 65% of lock-on
        if (arm.timer > 0.24) {
          arm.targetX += (this.playerX - arm.targetX) * Math.min(1, dt * 7);
          arm.targetY +=
            (Math.max(ROOM_TOP + 62, Math.min(ROOM_BOTTOM - 18, this.playerY)) - arm.targetY) *
            Math.min(1, dt * 7);
        }
        arm.x += (arm.targetX - arm.x) * Math.min(1, dt * 5);
        arm.y += (arm.targetY - 38 - arm.y) * Math.min(1, dt * 5);
        if (arm.timer <= 0) {
          arm.state = 'slamming';
          arm.timer = 0.16;
        }
      } else if (arm.state === 'slamming') {
        arm.timer -= dt;
        arm.x += (arm.targetX - arm.x) * Math.min(1, dt * 22);
        arm.y += (arm.targetY - arm.y) * Math.min(1, dt * 24);
        if (arm.timer <= 0) {
          arm.x = arm.targetX;
          arm.y = arm.targetY;
          arm.state = 'grounded';
          arm.timer = enraged ? 0.95 : 1.2;
          sound.playBossSlam();
          this.triggerShake(0.32, 5.2);
          this.decals.push({
            x: arm.x,
            y: arm.y + 6,
            r: 22,
            color: 'rgba(15, 23, 42, 0.58)',
            life: 6.0,
            maxLife: 6.0,
          });
          this.shockwaves.push({
            x: arm.x,
            y: arm.y + 2,
            maxRadius: 58,
            color: enraged ? '#fb7185' : '#fb923c',
            life: 0.32,
            maxLife: 0.32,
          });
          this.spawnBurst(arm.x, arm.y + 4, '#fbbf24', 22);
          const bolts = enraged ? 8 : 6;
          for (let k = 0; k < bolts; k++) {
            this.fireEnemyBolt(arm.x, arm.y, (k / bolts) * Math.PI * 2, enraged ? 130 : 108, 14, '#fb923c');
          }
          const pd = Math.hypot(this.playerX - arm.x, this.playerY - arm.y);
          if (pd <= 34) {
            this.damagePlayer(
              22,
              (this.playerX - arm.x) / Math.max(1, pd),
              (this.playerY - arm.y) / Math.max(1, pd),
              e,
            );
          }
        }
      } else if (arm.state === 'grounded') {
        // Vulnerable on floor so player can slash/spear the giant gauntlet!
        arm.timer -= dt;
        if (arm.timer <= 0) {
          arm.state = 'returning';
        }
      } else if (arm.state === 'beam') {
        const bx = arm.side < 0 ? ROOM_CENTER_X - 96 : ROOM_CENTER_X + 96;
        const by = ROOM_TOP + 52;
        arm.x += (bx - arm.x) * Math.min(1, dt * 8);
        arm.y += (by - arm.y) * Math.min(1, dt * 8);
      }
    }

    const state: BossState = e.bossState ?? 'lev_idle';
    e.bossStateTimer = (e.bossStateTimer ?? 0) - dt;

    if (state === 'phase2_roar') {
      if (e.bossStateTimer <= 0) {
        e.bossState = 'lev_idle';
        e.bossStateTimer = 0.55;
        e.bossStateMax = 0.55;
        e.bossStatusText = 'OMEGA-ÜBERLASTUNG';
      }
      return;
    }

    if (state === 'lev_arm_track') {
      if (e.bossStateTimer <= 0) {
        e.bossState = 'lev_idle';
        e.bossStateTimer = enraged ? 0.55 : 0.8;
        e.bossStateMax = e.bossStateTimer;
        e.bossStatusText = enraged ? 'OMEGA-KERN' : 'AKTIV';
      }
      return;
    }

    if (state === 'lev_twin_windup') {
      for (const arm of arms) {
        arm.state = 'beam';
        arm.beamAngle = arm.side < 0 ? 0.65 : Math.PI - 0.65;
      }
      if (e.bossStateTimer <= 0) {
        sound.playBossLaser();
        this.triggerShake(0.28, 3.4);
        e.bossState = 'lev_twin_beam';
        e.bossStateTimer = enraged ? 1.45 : 1.3;
        e.bossStateMax = e.bossStateTimer;
        e.bossStatusText = 'ZWILLINGS-STRAHL!';
      }
      return;
    }

    if (state === 'lev_twin_beam') {
      const rate = enraged ? 0.98 : 0.78;
      for (const arm of arms) {
        // Left sweeps clockwise toward center, Right sweeps counter-clockwise toward center
        arm.beamAngle += (arm.side < 0 ? 1 : -1) * rate * dt;
        const cosA = Math.cos(arm.beamAngle);
        const sinA = Math.sin(arm.beamAngle);
        const ex = arm.x + cosA * 260;
        const ey = arm.y + sinA * 260;
        if (this.pointToSegmentDist(this.playerX, this.playerY, arm.x, arm.y, ex, ey) <= 10) {
          this.damagePlayer(18, -sinA * arm.side, cosA * arm.side, e);
        }
      }
      if (e.bossStateTimer <= 0) {
        for (const arm of arms) arm.state = 'returning';
        e.bossState = 'lev_idle';
        e.bossStateTimer = enraged ? 0.65 : 0.9;
        e.bossStateMax = e.bossStateTimer;
        e.bossStatusText = enraged ? 'OMEGA-KERN' : 'AKTIV';
      }
      return;
    }

    if (state === 'lev_debris') {
      e.burstDelay -= dt;
      if (e.subBurst > 0 && e.burstDelay <= 0) {
        e.subBurst -= 1;
        e.burstDelay = enraged ? 0.2 : 0.26;
        // Aim first drop near player, rest scattered across arena!
        const tx =
          e.subBurst % 3 === 0
            ? Math.max(ROOM_LEFT + 28, Math.min(ROOM_RIGHT - 28, this.playerX + (Math.random() - 0.5) * 34))
            : ROOM_LEFT + 32 + Math.random() * (ROOM_RIGHT - ROOM_LEFT - 64);
        const ty =
          e.subBurst % 3 === 0
            ? Math.max(ROOM_TOP + 68, Math.min(ROOM_BOTTOM - 22, this.playerY + (Math.random() - 0.5) * 28))
            : ROOM_TOP + 72 + Math.random() * (ROOM_BOTTOM - ROOM_TOP - 94);
        this.debrisDrops.push({ x: tx, y: ty, r: 22, timer: 0.95, maxTimer: 0.95 });
      }
      if (e.bossStateTimer <= 0) {
        e.bossState = 'lev_idle';
        e.bossStateTimer = enraged ? 0.6 : 0.85;
        e.bossStateMax = e.bossStateTimer;
        e.bossStatusText = enraged ? 'OMEGA-KERN' : 'AKTIV';
      }
      return;
    }

    if (state === 'lev_omega_spiral') {
      e.burstDelay -= dt;
      if (e.subBurst > 0 && e.burstDelay <= 0) {
        e.subBurst -= 1;
        e.burstDelay = enraged ? 0.16 : 0.22;
        const base = (e.subBurst * 0.34) + 0.35;
        const count = enraged ? 7 : 5;
        for (let k = 0; k < count; k++) {
          const a = 0.22 + (k / (count - 1)) * (Math.PI - 0.44) + Math.sin(base) * 0.14;
          this.fireEnemyBolt(e.x, e.y + 12, a, enraged ? 142 : 118, 14, enraged ? '#fb7185' : '#38e8d4');
        }
        sound.playBlaster();
      }
      if (e.bossStateTimer <= 0) {
        e.bossState = 'lev_idle';
        e.bossStateTimer = enraged ? 0.65 : 0.9;
        e.bossStateMax = e.bossStateTimer;
        e.bossStatusText = enraged ? 'OMEGA-KERN' : 'AKTIV';
      }
      return;
    }

    // lev_idle: pick next grand titan pattern!
    if (e.bossStateTimer <= 0) {
      const atk = e.phase % 4;
      e.phase += 1;
      if (atk === 0 || atk === 2) {
        // Giant Gauntlet Slam (alternating Left / Right!)
        const sideIdx: 0 | 1 = (e.levActiveSide ?? 0) === 0 ? 1 : 0;
        e.levActiveSide = sideIdx;
        const arm = arms[sideIdx];
        arm.state = 'tracking';
        arm.timer = enraged ? 0.68 : 0.82;
        arm.targetX = Math.max(ROOM_LEFT + 34, Math.min(ROOM_RIGHT - 34, this.playerX));
        arm.targetY = Math.max(ROOM_TOP + 68, Math.min(ROOM_BOTTOM - 22, this.playerY));
        e.bossState = 'lev_arm_track';
        e.bossStateTimer = enraged ? 1.85 : 2.25;
        e.bossStateMax = e.bossStateTimer;
        e.bossStatusText = 'TITANEN-FAUSTSCHLAG!';
      } else if (atk === 1) {
        // Twin Sweeping Plasma Beams!
        e.bossState = 'lev_twin_windup';
        e.bossStateTimer = enraged ? 0.65 : 0.8;
        e.bossStateMax = e.bossStateTimer;
        e.bossStatusText = 'ZWILLINGS-STRAHL LÄDT...';
      } else if (enraged && e.phase % 8 === 4) {
        // Phase-2 Omega Spiral Plasma Wave!
        e.bossState = 'lev_omega_spiral';
        e.subBurst = 6;
        e.burstDelay = 0.15;
        e.bossStateTimer = 1.5;
        e.bossStateMax = 1.5;
        e.bossStatusText = 'OMEGA-SPIRALE!';
      } else {
        // Falling Reactor Debris Rain!
        e.bossState = 'lev_debris';
        e.subBurst = enraged ? 8 : 6;
        e.burstDelay = 0.1;
        e.bossStateTimer = 1.9;
        e.bossStateMax = 1.9;
        e.bossStatusText = 'TRÜMMER-HAGEL!';
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

  private damageEnemy(
    e: Enemy,
    amount: number,
    kx: number,
    ky: number,
    knockForce: number,
    piercing = false,
  ): void {
    // Shield-Drone frontal kinetic barrier reduces non-piercing frontal hits by 65%!
    let finalAmt = amount;
    if (e.kind === 'shield_drone' && !piercing) {
      const fromAngle = Math.atan2(-ky, -kx);
      const diff = Math.abs(this.normalizeAngle(fromAngle - e.aimAngle));
      if (diff <= 1.08) {
        finalAmt = Math.max(2, Math.round(amount * 0.35));
        sound.playShieldBlock();
        this.spawnBurst(
          e.x + Math.cos(e.aimAngle) * 11,
          e.y + Math.sin(e.aimAngle) * 11,
          '#38e8d4',
          8,
        );
        this.floats.push({
          x: e.x,
          y: e.y - e.radius - 10,
          text: `SCHILD -${finalAmt}`,
          color: '#67e8f9',
          life: 0.6,
          maxLife: 0.6,
        });
        e.hp -= finalAmt;
        e.flashTimer = 0.08;
        e.vx += kx * knockForce * 0.3;
        e.vy += ky * knockForce * 0.3;
        if (e.hp <= 0) this.onEnemyKilled(e);
        return;
      }
    }

    // Vex' Ionen-Kette passive Crit module (1.65x golden critical strike!)
    const stats = this.state.getStats();
    const isCrit = stats.critChance > 0 && Math.random() < stats.critChance;
    if (isCrit) {
      finalAmt = Math.round(finalAmt * 1.65);
    }

    e.hp -= finalAmt;
    e.flashTimer = 0.11;
    const resistance =
      e.kind === 'boss_leviathan'
        ? 0
        : this.isBossKind(e.kind)
          ? 0.12
          : e.kind === 'turret' || e.kind === 'shield_drone'
            ? 0.35
            : 1.0;
    e.vx += kx * knockForce * resistance;
    e.vy += ky * knockForce * resistance;

    sound.playHit();
    this.spawnBurst(e.x, e.y, isCrit ? '#fde047' : '#38e8d4', isCrit ? 10 : 6);
    this.floats.push({
      x: e.x + (Math.random() - 0.5) * 8,
      y: e.y - e.radius - 4,
      text: isCrit ? `KRIT! ${finalAmt}` : `${finalAmt}`,
      color: isCrit ? '#fde047' : '#f8fafc',
      life: isCrit ? 0.85 : 0.65,
      maxLife: isCrit ? 0.85 : 0.65,
    });

    if (e.hp <= 0) {
      this.onEnemyKilled(e);
    }
  }

  private onEnemyKilled(e: Enemy): void {
    const idx = this.enemies.indexOf(e);
    if (idx !== -1) this.enemies.splice(idx, 1);

    this.enemiesDefeated += 1;
    this.state.totalEnemiesDefeated += 1;
    sound.playEnemyDefeat();
    const isBoss = this.isBossKind(e.kind);
    this.spawnBurst(e.x, e.y, isBoss ? '#fbbf24' : '#c084fc', isBoss ? 36 : 14);

    const nightBoost = this.state.timeOfDay === 'night';
    const luckBonus = this.state.getStats().lootLuckBonus;
    const lootDepth = this.currentRoom.depth + (this.currentFloor - 1);

    if (e.kind === 'boss_breacher') {
      this.triggerShake(0.45, 5.0);
      this.shockwaves.push({
        x: e.x,
        y: e.y,
        maxRadius: 86,
        color: '#fbbf24',
        life: 0.42,
        maxLife: 0.42,
      });
      this.floorBossDefeated = true;
      this.state.bossDefeatedCount += 1;
      this.state.breacherDefeated = true;
      this.spawnLootDrop(e.x, e.y, 'reactor_shard');
      for (let k = 0; k < 2; k++) {
        this.spawnLootDrop(e.x, e.y, rollLootItem(2, k === 0, nightBoost, luckBonus));
      }
      this.callbacks.onToast(
        'SIEG! Schott-Brecher MK-II besiegt! Links: Extraktion · Rechts: Tiefen-Aufzug → Ebene II!',
        'good',
      );
      this.state.save();
    } else if (e.kind === 'boss') {
      this.triggerShake(0.5, 5.5);
      this.shockwaves.push({
        x: e.x,
        y: e.y,
        maxRadius: 96,
        color: '#fbbf24',
        life: 0.45,
        maxLife: 0.45,
      });
      this.floorBossDefeated = true;
      this.state.bossDefeatedCount += 1;
      this.state.coreWatcherDefeated = true;
      this.spawnLootDrop(e.x, e.y, 'mk4_heart');
      this.spawnLootDrop(e.x, e.y, 'aegis_plate');
      for (let k = 0; k < 2; k++) {
        this.spawnLootDrop(e.x, e.y, rollLootItem(3, k === 0, nightBoost, luckBonus));
      }
      this.callbacks.onToast(
        'SIEG! Core-Wächter MK-IV besiegt! Links: Extraktion · Rechts: Tiefen-Aufzug → Ebene III (Endboss)!',
        'good',
      );
      this.state.save();
    } else if (e.kind === 'boss_leviathan') {
      this.debrisDrops = [];
      this.triggerShake(0.75, 7.0);
      this.shockwaves.push({
        x: e.x,
        y: e.y + 12,
        maxRadius: 145,
        color: '#fde047',
        life: 0.6,
        maxLife: 0.6,
      });
      this.spawnBurst(e.x, e.y + 10, '#fde047', 42);
      this.floorBossDefeated = true;
      this.state.bossDefeatedCount += 1;
      this.state.sector1Cleared = true;
      this.sector1ClearedInRun = true;
      // Drop Leviathan Omega Core + 4 rare/epic relics in center of arena!
      const dropY = ROOM_CENTER_Y - 12;
      this.spawnLootDrop(ROOM_CENTER_X, dropY, 'leviathan_core');
      this.spawnLootDrop(ROOM_CENTER_X - 18, dropY + 4, 'aegis_plate');
      for (let k = 0; k < 3; k++) {
        this.spawnLootDrop(
          ROOM_CENTER_X + (k - 1) * 16,
          dropY + 8,
          rollLootItem(3, true, nightBoost, luckBonus),
        );
      }
      this.callbacks.onToast(
        '★ SEKTOR 1 BEZWUNGEN! A.E.G.I.S. LEVIATHAN zerstört! Sektor-2-Schlüssel & Backroom-Trophäe freigeschaltet!',
        'good',
      );
      this.state.save();
    } else {
      if (e.kind === 'slime_magma') {
        // Molten Reactor Slime death eruption: 4 diagonal embers!
        this.spawnBurst(e.x, e.y, '#f97316', 14);
        for (let k = 0; k < 4; k++) {
          const a = Math.PI / 4 + k * (Math.PI / 2);
          this.projectiles.push({
            x: e.x,
            y: e.y,
            vx: Math.cos(a) * 112,
            vy: Math.sin(a) * 112,
            fromPlayer: false,
            damage: 13,
            color: '#fb923c',
            radius: 3.6,
            life: 0.9,
          });
        }
      }
      if (Math.random() < 0.84) {
        this.spawnLootDrop(e.x, e.y, rollLootItem(lootDepth, false, nightBoost, luckBonus));
        if (this.state.equippedCompanion === 'puck' && Math.random() < 0.25) {
          this.spawnLootDrop(e.x + 6, e.y - 4, rollLootItem(lootDepth, false, nightBoost, luckBonus));
          this.floats.push({
            x: this.companionX,
            y: this.companionY - 10,
            text: '+1 BEUTE (PUCK)',
            color: '#fbbf24',
            life: 1.0,
            maxLife: 1.0,
          });
        }
      }
    }

    // Check live Companion Bot milestone unlocks (Spark / Luma / Halo)!
    const newlyUnlocked = this.state.checkCompanionUnlocks();
    for (const cid of newlyUnlocked) {
      sound.playCompanionUnlock();
      this.callbacks.onToast(
        `🤖 Begleiter freigeschaltet: ${COMPANION_DEFS[cid].name}! Im Hinterzimmer am Drohnen-Dock ausrüstbar!`,
        'good',
      );
    }

    if (this.enemies.length === 0 && !this.currentRoom.cleared) {
      this.currentRoom.cleared = true;
      this.roomsCleared += 1;
      sound.playDoorUnlock();
      if (this.currentRoom.type === 'combat') {
        this.spawnLootDrop(
          ROOM_CENTER_X,
          ROOM_CENTER_Y,
          rollLootItem(lootDepth, false, nightBoost, luckBonus),
        );
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
      // Heil-Bot Luma: heals +10 HP every 2nd cleared combat room!
      if (this.state.equippedCompanion === 'luma' && this.currentRoom.type === 'combat') {
        this.lumaRoomCounter += 1;
        if (this.lumaRoomCounter % 2 === 0 && this.state.hp < stats.maxHp) {
          const lumaHeal = Math.min(stats.maxHp - this.state.hp, 10);
          this.state.hp += lumaHeal;
          sound.playHeal();
          this.spawnBurst(this.companionX, this.companionY, '#34d399', 12);
          this.floats.push({
            x: this.playerX,
            y: this.playerY - 24,
            text: `+${Math.round(lumaHeal)} LUMA`,
            color: '#6ee7b7',
            life: 1.1,
            maxLife: 1.1,
          });
          this.callbacks.onHudDirty();
        }
      }
    }
  }

  private damagePlayer(amount: number, kx: number, ky: number, attacker?: Enemy): void {
    if (this.invulnTimer > 0 || this.finished) return;

    // Aegis-Bot Halo: golden orbital shield completely absorbs 1 incoming hit every 12s!
    if (this.state.equippedCompanion === 'halo' && this.haloShieldReady) {
      this.haloShieldReady = false;
      this.haloChargeTimer = 0;
      this.invulnTimer = 0.65;
      sound.playHaloBlock();
      this.triggerShake(0.14, 2.6);
      this.shockwaves.push({
        x: this.playerX,
        y: this.playerY,
        maxRadius: 42,
        color: '#fde047',
        life: 0.28,
        maxLife: 0.28,
      });
      this.spawnBurst(this.playerX, this.playerY, '#fde047', 16);
      this.floats.push({
        x: this.playerX,
        y: this.playerY - 20,
        text: 'HALO-SCHILD!',
        color: '#fde047',
        life: 1.05,
        maxLife: 1.05,
      });
      if (attacker && attacker.kind !== 'boss_leviathan') {
        attacker.vx -= kx * 180;
        attacker.vy -= ky * 180;
      }
      return;
    }

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
          this.state.energy = Math.min(100, this.state.energy + 16);
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
          this.state.energy = Math.max(0, this.state.energy - 12);
        }
        this.spawnBurst(
          this.playerX + Math.cos(this.shieldAngle) * 13,
          this.playerY + Math.sin(this.shieldAngle) * 13,
          isPerfect ? '#fde047' : '#38e8d4',
          isPerfect ? 16 : 10,
        );
        if (attacker && attacker.kind !== 'boss_leviathan') {
          attacker.vx -= kx * (isPerfect ? 230 : 150);
          attacker.vy -= ky * (isPerfect ? 230 : 150);
        }
        this.floats.push({
          x: this.playerX,
          y: this.playerY - 17,
          text: isPerfect ? 'PERFEKT! +16 EN' : `BLOCK -${finalAmount}`,
          color: isPerfect ? '#fde047' : '#38e8d4',
          life: 0.8,
          maxLife: 0.8,
        });
        if (!isPerfect && this.state.energy <= 0) {
          this.triggerShieldBreak();
        }
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
    if (Math.random() < 0.7) {
      this.spawnLootDrop(
        pod.x,
        pod.y,
        rollLootItem(
          this.currentRoom.depth + (this.currentFloor - 1),
          false,
          this.state.timeOfDay === 'night',
          this.state.getStats().lootLuckBonus,
        ),
      );
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
        if (p.isSporeGlob) {
          // Burst Spore-Glob into 5 radial bioluminescent mini-spores!
          this.spawnBurst(p.x, p.y, '#a3e635', 10);
          for (let k = 0; k < 5; k++) {
            const a = (k / 5) * Math.PI * 2 + 0.3;
            this.projectiles.push({
              x: p.x,
              y: p.y,
              vx: Math.cos(a) * 102,
              vy: Math.sin(a) * 102,
              fromPlayer: false,
              damage: 11,
              color: '#34d399',
              radius: 2.8,
              life: 1.15,
            });
          }
        } else {
          this.spawnBurst(p.x, p.y, p.color, 4);
        }
        this.projectiles.splice(i, 1);
        continue;
      }

      if (p.fromPlayer) {
        let consumed = false;
        for (const e of this.enemies) {
          if (e.kind === 'boss' && (e.bossHeight ?? 0) > 28) continue;
          const hitDist = this.getDistanceToEnemyHitbox(e, p.x, p.y);
          if (hitDist < p.radius) {
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
              p.isSporeGlob = false;
              p.vx = Math.cos(this.shieldAngle) * speed;
              p.vy = Math.sin(this.shieldAngle) * speed;
              p.damage = Math.max(26, Math.round(p.damage * 2.1));
              p.color = '#fde047';
              p.radius = 4.5;
              p.life = 1.8;
              this.state.energy = Math.min(100, this.state.energy + 16);
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
                text: 'KONTER! +16 EN',
                color: '#fde047',
                life: 0.75,
                maxLife: 0.75,
              });
            } else {
              sound.playShieldBlock();
              this.spawnBurst(p.x, p.y, '#38e8d4', 11);
              this.state.energy = Math.max(0, this.state.energy - 12);
              this.floats.push({
                x: p.x,
                y: p.y - 8,
                text: 'PARADE (-12 EN)',
                color: '#38e8d4',
                life: 0.65,
                maxLife: 0.65,
              });
              this.projectiles.splice(i, 1);
              if (this.state.energy <= 0) {
                this.triggerShieldBreak();
              }
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
    const hasPuck = this.state.equippedCompanion === 'puck';
    const magnetRadius = hasPuck ? 116 : 44;
    const pullSpeed = hasPuck ? 185 : 135;

    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.age += dt;
      d.vx *= Math.pow(0.04, dt);
      d.vy *= Math.pow(0.04, dt);
      d.x = Math.max(ROOM_LEFT + 8, Math.min(ROOM_RIGHT - 8, d.x + d.vx * dt));
      d.y = Math.max(ROOM_TOP + 8, Math.min(ROOM_BOTTOM - 8, d.y + d.vy * dt));

      const dist = Math.hypot(this.playerX - d.x, this.playerY - d.y);
      if (d.age > 0.22 && dist < magnetRadius && !isBackpackFullFor(this.state.inventory, d.itemId)) {
        d.x += ((this.playerX - d.x) / Math.max(1, dist)) * pullSpeed * dt;
        d.y += ((this.playerY - d.y) / Math.max(1, dist)) * pullSpeed * dt;
      }

      if (d.age > 0.22 && dist < 13) {
        const rem = addItemToBackpack(this.state.inventory, d.itemId, 1);
        if (rem === 0) {
          this.state.markDiscovered(d.itemId);
          const def = getItemDef(d.itemId);
          sound.playPickup();
          this.spawnBurst(d.x, d.y, def.glowColor, 6);
          const pinNeed = this.state.getPinnedItemNeed(d.itemId);
          this.floats.push({
            x: d.x,
            y: d.y - 10,
            text: pinNeed
              ? `📌 +1 ${def.name} (${pinNeed.owned}/${pinNeed.required})`
              : `+1 ${def.name}`,
            color: pinNeed ? '#fde047' : def.glowColor,
            life: pinNeed ? 1.35 : 1.0,
            maxLife: pinNeed ? 1.35 : 1.0,
          });
          if (pinNeed) {
            this.spawnBurst(d.x, d.y, '#fde047', 10);
          }
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
          label: '[E] Extraktion: Raumhafen Port Solaris (Gratis)',
          x: ROOM_CENTER_X,
          y: ROOM_CENTER_Y - 32,
        };
        if (input.interactPressed()) {
          this.triggerSafeWarp('warp', false);
        }
        return;
      }

      // Floor III Start Room: One-time Emergency Med-Terminal before Leviathan!
      if (this.currentRoom.hasHealStation && !this.currentRoom.healStationUsed) {
        const hx = ROOM_CENTER_X + 70;
        const hy = ROOM_CENTER_Y - 12;
        if (Math.hypot(this.playerX - hx, this.playerY - hy) < 28) {
          this.activePrompt = {
            label: '[E] Notfall-Medstation (+60 % HP & +1 Stimpack)',
            x: hx - 12,
            y: hy - 22,
          };
          if (input.interactPressed()) {
            this.currentRoom.healStationUsed = true;
            const stats = this.state.getStats();
            const heal = Math.round(stats.maxHp * 0.6);
            this.state.hp = Math.min(stats.maxHp, this.state.hp + heal);
            this.state.stimCharges = Math.min(stats.maxStimCharges, this.state.stimCharges + 1);
            sound.playHeal();
            this.spawnBurst(hx, hy, '#34d399', 18);
            this.floats.push({
              x: this.playerX,
              y: this.playerY - 16,
              text: `+${heal} HP & +1 STIM`,
              color: '#34d399',
              life: 1.3,
              maxLife: 1.3,
            });
            this.callbacks.onToast('Notfall-Medstation genutzt — bereit für A.E.G.I.S. LEVIATHAN!', 'good');
            this.callbacks.onHudDirty();
          }
          return;
        }
      }
    }

    if (this.currentRoom.type === 'boss' && this.floorBossDefeated) {
      if (this.currentFloor < 3) {
        // Dual Moonlighter Exit Choice: Left = Safe Extraction, Right = Descend Deeper!
        const exX = ROOM_CENTER_X - 48;
        const elX = ROOM_CENTER_X + 48;
        const padY = ROOM_CENTER_Y + 6;
        if (Math.hypot(this.playerX - exX, this.playerY - padY) < 28) {
          this.activePrompt = {
            label: '[E] Extraktion: Raumhafen Port Solaris (Beute sichern)',
            x: exX,
            y: padY - 24,
          };
          if (input.interactPressed()) {
            this.triggerSafeWarp('boss_victory', false);
          }
          return;
        }
        if (Math.hypot(this.playerX - elX, this.playerY - padY) < 28) {
          const nextFloor = (this.currentFloor + 1) as 2 | 3;
          this.activePrompt = {
            label:
              nextFloor === 2
                ? '[E] Tiefen-Aufzug → Ebene II (Maschinen-Deck)'
                : '[E] Tiefen-Aufzug → Ebene III (Reaktor-Kern)',
            x: elX - 10,
            y: padY - 24,
          };
          if (input.interactPressed()) {
            sound.playWarp();
            this.startFloor(nextFloor, false);
          }
          return;
        }
      } else {
        // Floor III Leviathan defeated -> Golden Sector-1 Victory Portal!
        const vx = ROOM_CENTER_X;
        const vy = ROOM_CENTER_Y + 12;
        if (Math.hypot(this.playerX - vx, this.playerY - vy) < 32) {
          this.activePrompt = {
            label: '[E] ★ Sektor-1-Sieg! Raumhafen Port Solaris (S2-Schlüssel)',
            x: vx,
            y: vy - 26,
          };
          if (input.interactPressed()) {
            this.triggerSafeWarp('boss_victory', false);
          }
          return;
        }
      }
    }

    const chest = this.currentRoom.chest;
    if (chest) {
      if (Math.hypot(this.playerX - chest.x, this.playerY - chest.y) < 30) {
        const remaining = chest.slots
          ? chest.slots.reduce((acc, s) => acc + (s ? s.qty : 0), 0)
          : 0;
        this.activePrompt = {
          label: !chest.opened
            ? '[E] Relikt-Truhe öffnen'
            : remaining > 0
              ? `[E] Relikt-Truhe durchsuchen (${remaining} übrig)`
              : '[E] Relikt-Truhe (Leer · Ablegen möglich)',
          x: chest.x,
          y: chest.y - 20,
        };
        if (input.interactPressed()) {
          if (!chest.opened) {
            chest.opened = true;
            sound.playUpgrade();
            const nightBoost = this.state.timeOfDay === 'night';
            const luckBonus = this.state.getStats().lootLuckBonus;
            const d = Math.min(3, 1 + this.currentFloor);
            const slots: Array<{ itemId: string; qty: number } | null> = new Array(8).fill(null);
            const rolled: string[] = [
              rollLootItem(d, true, nightBoost, luckBonus),
              rollLootItem(d, true, nightBoost, luckBonus),
              rollLootItem(d, false, nightBoost, luckBonus),
              rollLootItem(d, Math.random() < 0.55, nightBoost, luckBonus),
            ];
            if (this.state.equippedCompanion === 'puck' && Math.random() < 0.25) {
              rolled.push(rollLootItem(d, true, nightBoost, luckBonus));
              this.floats.push({
                x: this.companionX,
                y: this.companionY - 10,
                text: '+1 EXTRA-RELIKT (PUCK)',
                color: '#fbbf24',
                life: 1.1,
                maxLife: 1.1,
              });
            }
            for (const itemId of rolled) {
              this.state.markDiscovered(itemId);
              const existing = slots.find((s) => s && s.itemId === itemId && s.qty < getItemDef(itemId).maxStack);
              if (existing) {
                existing.qty += 1;
              } else {
                const emptyIdx = slots.findIndex((s) => s === null);
                if (emptyIdx >= 0) slots[emptyIdx] = { itemId, qty: 1 };
              }
            }
            chest.slots = slots;
            this.spawnBurst(chest.x, chest.y, '#fbbf24', 20);
          } else {
            sound.playUiClick();
          }
          if (this.callbacks.onOpenDungeonChest) {
            this.callbacks.onOpenDungeonChest(chest);
          }
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
    // ZERO direct credits from dungeons — all wealth comes from selling relics in Astro-Barter!
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
      clonedItems: res.clonedItems,
      cursedLost: res.cursedLost,
      synthesizedItems: res.synthesizedItems,
      resonanceBonus: 0,
      nightRun: this.state.timeOfDay === 'night',
      floorReached: this.maxFloorReached,
      sector1Cleared: this.sector1ClearedInRun,
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
      warpedToChest: res.warpedToChest,
      shatteredItems: res.shatteredItems,
      nightRun: this.state.timeOfDay === 'night',
      floorReached: this.maxFloorReached,
      sector1Cleared: false,
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
    for (let i = this.thrusts.length - 1; i >= 0; i--) {
      this.thrusts[i].life -= dt;
      if (this.thrusts[i].life <= 0) this.thrusts.splice(i, 1);
    }
    for (let i = this.fistBursts.length - 1; i >= 0; i--) {
      this.fistBursts[i].life -= dt;
      if (this.fistBursts[i].life <= 0) this.fistBursts.splice(i, 1);
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

    // Distinct Floor I / II / III Atmospheric Tints + Cosmic Night Ambience!
    if (this.currentFloor === 2) {
      ctx.fillStyle = 'rgba(10, 56, 46, 0.2)';
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    } else if (this.currentFloor === 3) {
      ctx.fillStyle = 'rgba(54, 16, 12, 0.22)';
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    }
    if (this.state.timeOfDay === 'night') {
      ctx.fillStyle = 'rgba(15, 23, 54, 0.16)';
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

    // Floor II/III Steam & Plasma Hazard Vents!
    for (const h of this.currentRoom.hazards) {
      const cycle = (this.time + h.phase) % 4.0;
      const warning = cycle >= 2.2 && cycle < 3.0;
      const active = cycle >= 3.0;
      ctx.save();
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.ellipse(h.x, h.y, h.r, h.r * 0.65, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = active ? '#fb923c' : warning ? '#fbbf24' : '#334155';
      ctx.lineWidth = active ? 2 : 1.1;
      ctx.stroke();
      // Metal grate bars
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      for (let gx = -h.r * 0.55; gx <= h.r * 0.55; gx += 4.5) {
        ctx.beginPath();
        ctx.moveTo(h.x + gx, h.y - h.r * 0.45);
        ctx.lineTo(h.x + gx, h.y + h.r * 0.45);
        ctx.stroke();
      }
      if (warning) {
        const wPulse = 0.5 + 0.5 * Math.sin(this.time * 26);
        ctx.fillStyle = `rgba(251, 191, 36, ${0.18 + wPulse * 0.25})`;
        ctx.beginPath();
        ctx.ellipse(h.x, h.y, h.r, h.r * 0.65, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (active) {
        drawGlow(ctx, h.x, h.y - 4, h.r * 1.9, '#38e8d4', 0.48);
        ctx.fillStyle = 'rgba(56, 232, 212, 0.55)';
        ctx.beginPath();
        ctx.ellipse(h.x, h.y, h.r * 0.9, h.r * 0.58, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
        ctx.beginPath();
        ctx.ellipse(h.x, h.y - 1, h.r * 0.45, h.r * 0.28, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Ambient bioluminescent spores (emerald on Floor II, embers on Floor III!)
    for (let s = 0; s < 10; s++) {
      const sx = ROOM_LEFT + ((s * 73 + this.currentRoom.tileSeed) % (ROOM_RIGHT - ROOM_LEFT));
      const sy =
        ROOM_TOP +
        ((s * 47 + Math.floor(this.time * 8) + this.currentRoom.tileSeed) % (ROOM_BOTTOM - ROOM_TOP));
      const a = 0.25 + 0.45 * Math.sin(this.time * 2.5 + s);
      ctx.fillStyle =
        this.currentFloor === 3
          ? `rgba(251, 146, 60, ${Math.max(0, a)})`
          : this.currentFloor === 2
            ? `rgba(52, 211, 153, ${Math.max(0, a)})`
            : `rgba(56, 232, 212, ${Math.max(0, a)})`;
      ctx.fillRect(sx + Math.sin(this.time + s) * 4, sy, 1.5, 1.5);
    }

    this.renderDoors(ctx);

    if (this.currentRoom.type === 'start') {
      this.renderWarpPad(ctx, ROOM_CENTER_X, ROOM_CENTER_Y - 12, '#38e8d4');
      // Floor III Start Room Emergency Med-Station!
      if (this.currentRoom.hasHealStation) {
        const hx = ROOM_CENTER_X + 70;
        const hy = ROOM_CENTER_Y - 12;
        const used = Boolean(this.currentRoom.healStationUsed);
        drawPixelShadow(ctx, hx, hy + 10, 11, 4, 0.48);
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(hx - 10, hy - 14, 20, 22);
        ctx.strokeStyle = used ? '#475569' : '#34d399';
        ctx.lineWidth = 1;
        ctx.strokeRect(hx - 10, hy - 14, 20, 22);
        ctx.fillStyle = used ? '#334155' : '#10b981';
        ctx.fillRect(hx - 6, hy - 9, 12, 10);
        if (!used) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(hx - 1.2, hy - 7.5, 2.4, 7);
          ctx.fillRect(hx - 3.5, hy - 5.2, 7, 2.4);
          drawGlow(ctx, hx, hy - 4, 24, '#34d399', 0.34 + Math.sin(this.time * 5) * 0.08);
        }
      }
    } else if (this.currentRoom.type === 'boss' && this.floorBossDefeated) {
      if (this.currentFloor < 3) {
        const padY = ROOM_CENTER_Y + 6;
        this.renderWarpPad(ctx, ROOM_CENTER_X - 48, padY, '#38e8d4');
        this.renderWarpPad(ctx, ROOM_CENTER_X + 48, padY, '#fbbf24');
        ctx.font = 'bold 5px Silkscreen, monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#67e8f9';
        ctx.fillText('EXTRAKTION', ROOM_CENTER_X - 48, padY + 22);
        ctx.fillStyle = '#fde047';
        ctx.fillText(this.currentFloor === 1 ? '▼ EBENE II' : '▼ EBENE III', ROOM_CENTER_X + 48, padY + 22);
      } else {
        const vy = ROOM_CENTER_Y + 12;
        this.renderWarpPad(ctx, ROOM_CENTER_X, vy, '#fde047');
        ctx.font = 'bold 5.2px Silkscreen, monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fde047';
        ctx.fillText('★ SEKTOR-1 SIEG!', ROOM_CENTER_X, vy + 22);
      }
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
      const pinNeed = this.state.getPinnedItemNeed(d.itemId);
      const wanted = Boolean(pinNeed && pinNeed.stillNeeded > 0);
      drawPixelShadow(ctx, d.x, d.y + 7, 6, 2.5, 0.42);
      drawGlow(ctx, d.x, d.y + bob, wanted ? 22 : 16, wanted ? '#fde047' : def.glowColor, wanted ? 0.56 : 0.4);
      const spr = art.items[d.itemId] ?? atlas.items[d.itemId];
      if (spr) {
        ctx.drawImage(spr, d.x - 9, d.y - 10 + bob, 18, 18);
      }
      if (wanted) {
        const pinBob = Math.sin(this.time * 7 + d.x) * 1.5;
        ctx.fillStyle = 'rgba(15, 22, 36, 0.92)';
        ctx.fillRect(d.x - 10, d.y - 20 + pinBob, 20, 8);
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 0.7;
        ctx.strokeRect(d.x - 10, d.y - 20 + pinBob, 20, 8);
        ctx.fillStyle = '#fde047';
        ctx.font = 'bold 4.8px Silkscreen, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('★ PIN', d.x, d.y - 14 + pinBob);
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
      const bFlash = ba.isBreacher ? art.bossBreacherFlash : art.bossFlash;
      if (bFlash) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = alpha;
        ctx.translate(ba.x, ba.y - ba.height);
        ctx.rotate(ba.tilt);
        ctx.drawImage(bFlash, -26, -28, 52, 50);
        ctx.restore();
      }
      drawGlow(ctx, ba.x, ba.y - ba.height, 26, ba.enraged ? '#fb7185' : '#fb923c', alpha * 0.7);
    }

    // Leviathan Falling Reactor Debris Telegraphs!
    for (const dr of this.debrisDrops) {
      const prog = 1 - Math.max(0, dr.timer / dr.maxTimer);
      ctx.save();
      ctx.fillStyle = `rgba(244, 63, 94, ${0.14 + prog * 0.25})`;
      ctx.beginPath();
      ctx.ellipse(dr.x, dr.y, dr.r * prog, dr.r * prog * 0.65, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(251, 146, 60, ${0.65 + prog * 0.35})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(dr.x, dr.y, dr.r, dr.r * 0.65, 0, 0, Math.PI * 2);
      ctx.stroke();
      // Falling glowing hull chunk descending into reticle
      if (prog > 0.35) {
        const dropH = (1 - prog) * 140;
        ctx.fillStyle = '#475569';
        ctx.fillRect(dr.x - 6, dr.y - dropH - 6, 12, 10);
        ctx.fillStyle = '#fb923c';
        ctx.fillRect(dr.x - 4, dr.y - dropH - 4, 8, 4);
      }
      ctx.restore();
    }

    // Enemy & Boss Floor Telegraphs
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
      } else if (e.kind === 'boss' || e.kind === 'boss_breacher') {
        this.renderBossFloorTelegraph(ctx, e);
      } else if (e.kind === 'boss_leviathan') {
        this.renderLeviathanFloorTelegraphs(ctx, e);
      }
    }

    // Depth-sorted enemies & hero (airborne boss renders above grounded actors!)
    type Drawable = { y: number; draw: () => void };
    const drawables: Drawable[] = [];
    for (const e of this.enemies) {
      const sortY =
        e.kind === 'boss_leviathan'
          ? ROOM_TOP + 20
          : e.kind === 'boss' && (e.bossHeight ?? 0) > 12
            ? 999
            : e.y;
      drawables.push({ y: sortY, draw: () => this.renderEnemy(ctx, e) });
    }
    drawables.push({ y: this.playerY, draw: () => this.renderPlayer(ctx) });
    if (this.state.equippedCompanion) {
      drawables.push({ y: this.companionY, draw: () => this.renderCompanion(ctx) });
    }
    drawables.sort((a, b) => a.y - b.y);
    for (const d of drawables) d.draw();

    // Active Aegis-Bot Halo golden orbital shield ring around hero when charged!
    if (this.state.equippedCompanion === 'halo' && this.haloShieldReady) {
      const hp = 0.5 + 0.5 * Math.sin(this.time * 5.2);
      ctx.save();
      ctx.strokeStyle = `rgba(253, 224, 71, ${0.55 + hp * 0.35})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(this.playerX, this.playerY - 1, 14 + hp * 1.5, 16 + hp * 1.5, 0, 0, Math.PI * 2);
      ctx.stroke();
      drawGlow(ctx, this.playerX, this.playerY - 1, 20, '#fbbf24', 0.14 + hp * 0.08);
      ctx.restore();
    }

    // Active Boss Sweeping Reactor Laser Beams (Core-Wächter & Leviathan Twin Beams!)
    for (const e of this.enemies) {
      if (e.kind === 'boss' && e.bossState === 'laser_sweep') {
        this.renderBossLaserBeam(ctx, e);
      } else if (e.kind === 'boss_leviathan' && (e.bossState === 'lev_twin_windup' || e.bossState === 'lev_twin_beam')) {
        this.renderLeviathanTwinBeams(ctx, e);
      }
    }

    // Faceted 2.5D Hex-Aegis Kinetic Shield (animates smoothly on deploy & retract!)
    if (this.shieldOpenAnim > 0.02) {
      this.renderKineticShield(ctx);
    } else if (this.shieldOverheatTimer > 0) {
      const pct = Math.max(0, this.shieldOverheatTimer / 1.8);
      ctx.save();
      ctx.strokeStyle = 'rgba(251, 113, 133, 0.85)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(this.playerX, this.playerY + 11, 10, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Hand-Crafted 2.5D Tapered Crescent Weapon Swings, Ionen-Speer Thrusts, Kinetik-Fäuste & Phasen-Diskus!
    for (const s of this.swings) {
      this.renderWeaponSwing(ctx, s);
    }
    for (const tr of this.thrusts) {
      this.renderSpearThrust(ctx, tr);
    }
    this.renderFistBursts(ctx);
    this.renderDiscs(ctx);

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
    const energyPct = Math.max(0, Math.min(1, this.state.energy / 100));
    const lowEnergy = energyPct < 0.28;
    const warnFlicker = lowEnergy ? 0.55 + 0.45 * Math.sin(this.time * 38) : 1;
    const flash = Math.max(this.shieldHitFlash, perfectWindow ? 0.55 : 0);
    const alpha = Math.min(1, open * 1.15) * warnFlicker;

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
    ctx.strokeStyle =
      flash > 0.4
        ? `rgba(253, 224, 71, ${alpha * 0.45})`
        : lowEnergy
          ? `rgba(251, 113, 133, ${alpha * 0.48})`
          : `rgba(56, 232, 212, ${alpha * 0.36})`;
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
        : lowEnergy
          ? `rgba(244, 63, 94, ${alpha * (0.26 + pulse * 0.16)})`
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
        ctx.fillStyle = lowEnergy
          ? `rgba(253, 186, 116, ${alpha * scanBoost * 0.3})`
          : `rgba(165, 243, 252, ${alpha * scanBoost * 0.28})`;
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
          : lowEnergy
            ? `rgba(251, 146, 60, ${alpha * (0.55 + scanBoost * 0.4)})`
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

    // 4. Outer Razor Facet Frame (Teal / Warning Coral Halo + Incandescent Core Edge)
    ctx.strokeStyle =
      flash > 0.4
        ? `rgba(253, 224, 71, ${alpha * 0.92})`
        : lowEnergy
          ? `rgba(251, 113, 133, ${alpha * 0.95})`
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

    // Inner subtle boundary rail + live diegetic shield-energy meter arc!
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.55)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = 0; i <= panels; i++) {
      const a = startA + (endA - startA) * (i / panels);
      const p = pt(innerR, a);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();

    const meterSpan = halfSpan * energyPct;
    ctx.strokeStyle =
      energyPct < 0.28 ? '#fb7185' : energyPct < 0.55 ? '#fbbf24' : '#38e8d4';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    const meterSegs = 10;
    for (let i = 0; i <= meterSegs; i++) {
      const a = this.shieldAngle - meterSpan + meterSpan * 2 * (i / meterSegs);
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
    const nodeColor = flash > 0.4 ? '#fde047' : lowEnergy ? '#fb7185' : '#38e8d4';
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

  private renderSpearThrust(ctx: CanvasRenderingContext2D, tr: SpearThrustFx): void {
    const art = getHDArt();
    const t = 1 - tr.life / tr.maxLife;
    const alpha = Math.max(0, 1 - Math.pow(t, 1.35));
    const extend = Math.min(1, t * 4.2);
    const len = tr.length * (0.45 + 0.55 * extend);
    const isFinisher = tr.comboStep === 2 || tr.isCharge;

    ctx.save();
    ctx.translate(tr.x, tr.y);
    ctx.rotate(tr.angle);

    // 1. Multi-layer piercing plasma lance cone & sonic shock rings!
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = isFinisher
      ? `rgba(253, 224, 71, ${alpha * 0.46})`
      : `rgba(56, 232, 212, ${alpha * 0.45})`;
    ctx.beginPath();
    ctx.moveTo(-4, 0);
    ctx.lineTo(len * 0.28, -(isFinisher ? 9 : 6.5));
    ctx.lineTo(len + 6, 0);
    ctx.lineTo(len * 0.28, isFinisher ? 9 : 6.5);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = isFinisher
      ? `rgba(56, 232, 212, ${alpha * 0.85})`
      : `rgba(103, 232, 249, ${alpha * 0.85})`;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(len * 0.32, -(isFinisher ? 4.8 : 3.4));
    ctx.lineTo(len + 3, 0);
    ctx.lineTo(len * 0.32, isFinisher ? 4.8 : 3.4);
    ctx.closePath();
    ctx.fill();

    // White-hot needle core
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.96})`;
    ctx.beginPath();
    ctx.moveTo(4, 0);
    ctx.lineTo(len * 0.45, -1.6);
    ctx.lineTo(len + 2, 0);
    ctx.lineTo(len * 0.45, 1.6);
    ctx.closePath();
    ctx.fill();

    // Expanding sonic piercing rings along shaft
    ctx.strokeStyle = isFinisher
      ? `rgba(253, 224, 71, ${alpha * 0.85})`
      : `rgba(165, 243, 252, ${alpha * 0.78})`;
    ctx.lineWidth = 1.2;
    for (const frac of [0.35, 0.68]) {
      const rx = len * frac;
      const ry = (isFinisher ? 7.5 : 5.5) * (0.6 + t * 0.7);
      ctx.beginPath();
      ctx.ellipse(rx, 0, 2.2, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    // 2. Lunging HD Ionen-Speer sprite right inside the plasma lance!
    if (art.weapons.spear) {
      const lungeDist = len * 0.42;
      ctx.save();
      ctx.translate(tr.x + Math.cos(tr.angle) * lungeDist, tr.y + Math.sin(tr.angle) * lungeDist);
      ctx.rotate(tr.angle + Math.PI / 4);
      ctx.globalAlpha = Math.min(1, alpha * 1.4);
      ctx.drawImage(art.weapons.spear, -13, -15, 28, 28);
      ctx.restore();
    }
  }

  private renderLeviathanFloorTelegraphs(ctx: CanvasRenderingContext2D, e: Enemy): void {
    if (!e.levArms) return;
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 24);
    for (const arm of e.levArms) {
      if (arm.state === 'tracking' || arm.state === 'slamming') {
        ctx.save();
        ctx.fillStyle = `rgba(244, 63, 94, ${0.18 + pulse * 0.18})`;
        ctx.beginPath();
        ctx.ellipse(arm.targetX, arm.targetY + 4, 30, 20, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(251, 113, 133, ${0.75 + pulse * 0.25})`;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.ellipse(arm.targetX, arm.targetY + 4, 30, 20, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(arm.targetX - 10, arm.targetY + 4);
        ctx.lineTo(arm.targetX + 10, arm.targetY + 4);
        ctx.moveTo(arm.targetX, arm.targetY - 4);
        ctx.lineTo(arm.targetX, arm.targetY + 12);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  private renderLeviathanTwinBeams(ctx: CanvasRenderingContext2D, e: Enemy): void {
    if (!e.levArms) return;
    const windup = e.bossState === 'lev_twin_windup';
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 36);
    for (const arm of e.levArms) {
      const cosA = Math.cos(arm.beamAngle);
      const sinA = Math.sin(arm.beamAngle);
      const ex = arm.x + cosA * 255;
      const ey = arm.y + sinA * 255;
      ctx.save();
      if (windup) {
        ctx.strokeStyle = `rgba(251, 113, 133, ${0.45 + pulse * 0.5})`;
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 3]);
        ctx.beginPath();
        ctx.moveTo(arm.x, arm.y);
        ctx.lineTo(ex, ey);
        ctx.stroke();
      } else {
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(244, 63, 94, 0.58)';
        ctx.lineWidth = 14 + pulse * 3;
        ctx.beginPath();
        ctx.moveTo(arm.x, arm.y);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(251, 146, 60, 0.92)';
        ctx.lineWidth = 7 + pulse * 2;
        ctx.stroke();
        ctx.strokeStyle = '#fffbeb';
        ctx.lineWidth = 2.8;
        ctx.stroke();
        drawGlow(ctx, arm.x, arm.y, 20, '#fb7185', 0.8);
      }
      ctx.restore();
    }
  }

  private renderBreacherBoss(ctx: CanvasRenderingContext2D, e: Enemy): void {
    const art = getHDArt();
    const state = e.bossState ?? 'stalk';
    const enraged = Boolean(e.bossPhase2);
    const stompBob = Math.abs(Math.sin(this.time * (enraged ? 11 : 7))) * 2.4;
    let scaleX = 1;
    let scaleY = 1;
    let tilt = Math.max(-0.18, Math.min(0.18, e.vx * 0.0014));
    if (state === 'charge_windup') {
      scaleX = 1.22;
      scaleY = 0.78;
    } else if (state === 'breacher_stomp') {
      scaleX = 0.86;
      scaleY = 1.22;
    } else if (state === 'stunned') {
      tilt = Math.sin(this.time * 18) * 0.14;
    }

    drawPixelShadow(ctx, e.x, e.y + 17, 22, 7.2, 0.55);
    const spr = e.flashTimer > 0 ? art.bossBreacherFlash : art.bossBreacher;
    if (spr) {
      ctx.save();
      ctx.translate(e.x, e.y + 16 - stompBob);
      ctx.rotate(tilt);
      ctx.scale(scaleX, scaleY);
      ctx.drawImage(spr, -27, -45, 54, 52);
      ctx.restore();
    }
    const corePulse = 0.5 + 0.5 * Math.sin(this.time * (enraged ? 14 : 7));
    drawGlow(ctx, e.x, e.y - 4, 20 + corePulse * 6, enraged ? '#fb7185' : '#fbbf24', 0.42 + corePulse * 0.22);
  }

  private renderLeviathanBoss(ctx: CanvasRenderingContext2D, e: Enemy): void {
    const enraged = Boolean(e.bossPhase2);
    const flash = e.flashTimer > 0;
    const pulse = 0.5 + 0.5 * Math.sin(this.time * (enraged ? 14 : 6));
    const breath = Math.sin(this.time * 2.8) * 1.8;
    const cx = e.x;
    const cy = e.y + breath;

    // 1. Massive Armored Titan Hull Chassis spanning top of Reactor Core Arena!
    ctx.save();
    drawPixelShadow(ctx, cx, cy + 28, 84, 14, 0.58);

    // Armored Outer Wing Bulkheads with metallic bevel & rivets
    ctx.fillStyle = flash ? '#f8fafc' : '#111827';
    ctx.fillRect(cx - 90, cy - 29, 180, 48);
    ctx.fillStyle = flash ? '#ffffff' : '#1e293b';
    ctx.fillRect(cx - 86, cy - 27, 172, 43);
    ctx.fillStyle = flash ? '#ffffff' : '#334155';
    ctx.fillRect(cx - 82, cy - 24, 164, 34);
    // Top armor bevel highlight
    ctx.fillStyle = '#64748b';
    ctx.fillRect(cx - 82, cy - 24, 164, 2.5);

    // Bronze / Steel Shoulder Armor Plates, Horn Fins & Glowing Exhaust Vents
    ctx.fillStyle = flash ? '#fef3c7' : enraged ? '#7f1d1d' : '#78350f';
    ctx.fillRect(cx - 78, cy - 22, 46, 28);
    ctx.fillRect(cx + 32, cy - 22, 46, 28);
    ctx.fillStyle = enraged ? '#b91c1c' : '#b45309';
    ctx.fillRect(cx - 76, cy - 20, 42, 4);
    ctx.fillRect(cx + 34, cy - 20, 42, 4);
    ctx.strokeStyle = enraged ? '#fb7185' : '#fbbf24';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(cx - 78, cy - 22, 46, 28);
    ctx.strokeRect(cx + 32, cy - 22, 46, 28);

    // Armored corner bolts
    ctx.fillStyle = '#fde68a';
    for (const bx of [cx - 75, cx - 36, cx + 35, cx + 74]) {
      ctx.fillRect(bx, cy - 19, 2, 2);
      ctx.fillRect(bx, cy + 2, 2, 2);
    }

    // Shoulder plasma radiator slits
    for (const side of [-1, 1]) {
      const vx = cx + side * 55;
      ctx.fillStyle = enraged ? '#fb7185' : '#38e8d4';
      for (let s = 0; s < 3; s++) {
        ctx.fillRect(vx - 13, cy - 14 + s * 6, 26, 2.6);
      }
      drawGlow(ctx, vx, cy - 8, 22, enraged ? '#fb7185' : '#38e8d4', 0.32 + pulse * 0.14);
    }

    // Central Crown Crest & Mandible Hull
    ctx.fillStyle = flash ? '#ffffff' : '#475569';
    ctx.beginPath();
    ctx.moveTo(cx - 36, cy - 28);
    ctx.lineTo(cx + 36, cy - 28);
    ctx.lineTo(cx + 28, cy + 24);
    ctx.lineTo(cx, cy + 33);
    ctx.lineTo(cx - 28, cy + 24);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#64748b';
    ctx.fillRect(cx - 30, cy - 27, 60, 4);
    ctx.strokeStyle = enraged ? '#fb7185' : '#fbbf24';
    ctx.lineWidth = 1.3;
    ctx.stroke();

    // Twin golden-crimson brow fins flanking Omega Eye
    ctx.fillStyle = enraged ? '#fb7185' : '#fbbf24';
    ctx.fillRect(cx - 26, cy - 20, 10, 3);
    ctx.fillRect(cx + 16, cy - 20, 10, 3);

    // Rotating Omega Reactor Eye Ring (Core Weakpoint!)
    const coreColor = enraged ? '#fb7185' : '#fbbf24';
    drawGlow(ctx, cx, cy + 2, 34 + pulse * 8, coreColor, 0.5 + pulse * 0.25);
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(cx, cy + 2, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = coreColor;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(cx, cy + 2, 13, this.time * 2, this.time * 2 + Math.PI * 1.45);
    ctx.stroke();
    ctx.fillStyle = coreColor;
    ctx.beginPath();
    ctx.arc(cx, cy + 2, 8 + pulse * 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx, cy + 2, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 2. Articulated Segmented Chain Arms + Massive Hydraulic Giant Gauntlets!
    if (e.levArms) {
      for (const arm of e.levArms) {
        const shX = cx + arm.side * 66;
        const shY = cy + 6;
        const grounded = arm.state === 'grounded';
        const slamming = arm.state === 'slamming';

        // Segmented steel hydraulic chain joints from shoulder -> gauntlet
        ctx.save();
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(shX, shY);
        ctx.lineTo(arm.x, arm.y);
        ctx.stroke();
        ctx.strokeStyle = enraged ? '#fb7185' : '#38e8d4';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        for (let seg = 1; seg <= 3; seg++) {
          const u = seg / 4;
          const jx = shX + (arm.x - shX) * u;
          const jy = shY + (arm.y - shY) * u;
          ctx.fillStyle = '#1e293b';
          ctx.beginPath();
          ctx.arc(jx, jy, 4.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#94a3b8';
          ctx.lineWidth = 0.9;
          ctx.stroke();
        }

        // Ground shadow under gauntlet
        drawPixelShadow(ctx, arm.x, arm.y + 16, grounded ? 19 : 14, grounded ? 6 : 4, grounded ? 0.58 : 0.35);

        // Massive Armored Gauntlet Fist!
        ctx.translate(arm.x, arm.y);
        const fistFill = flash ? '#ffffff' : grounded ? '#92400e' : '#334155';
        ctx.fillStyle = fistFill;
        ctx.fillRect(-15, -13, 30, 26);
        ctx.strokeStyle = slamming || enraged ? '#fb7185' : grounded ? '#fde047' : '#38e8d4';
        ctx.lineWidth = grounded ? 1.8 : 1.2;
        ctx.strokeRect(-15, -13, 30, 26);
        // Knuckle plates & glowing plasma core emitter inside fist
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(-12, 7, 6, 7);
        ctx.fillRect(-3, 8, 6, 7);
        ctx.fillRect(6, 7, 6, 7);
        ctx.fillStyle = enraged ? '#fb7185' : grounded ? '#fde047' : '#38e8d4';
        ctx.beginPath();
        ctx.arc(0, -1, 5.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-2, -3, 4, 4);
        ctx.restore();

        drawGlow(
          ctx,
          arm.x,
          arm.y,
          grounded ? 26 : 18,
          grounded ? '#fde047' : enraged ? '#fb7185' : '#38e8d4',
          grounded ? 0.45 : 0.25,
        );
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
    if (e.kind === 'boss_breacher') {
      this.renderBreacherBoss(ctx, e);
      return;
    }
    if (e.kind === 'boss_leviathan') {
      this.renderLeviathanBoss(ctx, e);
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
    } else if (e.kind === 'slime_magma') {
      const hop = Math.abs(Math.sin(e.anim * 5.2)) * (e.chargeActive > 0 ? 5.2 : 2.6);
      const sq = e.telegraphTimer > 0 ? 0.22 : Math.sin(e.anim * 5.2) * 0.1;
      const spr = e.flashTimer > 0 ? art.slimeMagmaFlash ?? art.slimeFlash : art.slimeMagma ?? art.slime;
      if (spr) {
        ctx.save();
        ctx.translate(e.x, e.y + 7 - hop);
        ctx.scale(1 + sq, 1 - sq);
        ctx.drawImage(spr, -12, -20, 24, 21);
        ctx.restore();
      }
      drawGlow(ctx, e.x, e.y, e.telegraphTimer > 0 ? 22 : 17, '#f97316', e.telegraphTimer > 0 ? 0.56 : 0.34);
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
    } else if (e.kind === 'drone_arc') {
      const hover = Math.sin(this.time * 7.2 + e.id) * 2.8;
      const bank = Math.max(-0.24, Math.min(0.24, e.vx * 0.0028));
      const spr = e.flashTimer > 0 ? art.droneArcFlash ?? art.droneFlash : art.droneArc ?? art.drone;
      if (spr) {
        ctx.save();
        ctx.translate(e.x, e.y + hover);
        ctx.rotate(bank);
        ctx.drawImage(spr, -12.5, -13, 25, 25);
        ctx.restore();
      }
      drawGlow(
        ctx,
        e.x,
        e.y + hover,
        e.telegraphTimer > 0 ? 22 : 16,
        e.telegraphTimer > 0 ? '#38e8d4' : '#c084fc',
        e.telegraphTimer > 0 ? 0.6 : 0.32,
      );
    } else if (e.kind === 'phase_stalker') {
      // Draw pulsing magenta teleport landing telegraph ring right before phase-blink!
      if (e.telegraphTimer > 0 && e.bossTargetX !== undefined && e.bossTargetY !== undefined) {
        const p = 1 - Math.max(0, e.telegraphTimer / 0.54);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(244, 63, 94, ${0.45 + p * 0.5})`;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(e.bossTargetX, e.bossTargetY, 15 - p * 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = `rgba(232, 121, 249, ${0.35 + p * 0.45})`;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(e.bossTargetX, e.bossTargetY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
        drawGlow(ctx, e.bossTargetX, e.bossTargetY, 18, '#f43f5e', 0.3 + p * 0.25);
      }
      const hover = Math.sin(this.time * 6 + e.id) * 1.4;
      const spr = e.flashTimer > 0 ? art.phaseStalkerFlash : art.phaseStalker;
      if (spr) {
        ctx.save();
        if (e.telegraphTimer > 0) {
          ctx.globalAlpha = 0.45 + 0.4 * Math.sin(this.time * 36);
        }
        ctx.translate(e.x, e.y + 10 - hover);
        ctx.drawImage(spr, -13, -27, 26, 28);
        ctx.restore();
      }
      drawGlow(
        ctx,
        e.x,
        e.y,
        e.chargeActive > 0 ? 22 : 16,
        e.chargeActive > 0 ? '#f43f5e' : '#e879f9',
        e.chargeActive > 0 ? 0.52 : 0.28,
      );
    } else if (e.kind === 'shield_drone') {
      const hover = Math.sin(this.time * 5.2 + e.id) * 2.2;
      const spr = e.flashTimer > 0 ? art.shieldDroneFlash : art.shieldDrone;
      if (spr) {
        ctx.drawImage(spr, e.x - 13, e.y - 14 + hover, 26, 26);
      }
      // Visible glowing frontal kinetic shield arc (tells player to flank or pierce!)
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = e.telegraphTimer > 0 ? '#fde047' : '#38e8d4';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.arc(e.x, e.y + hover, 14, e.aimAngle - 0.95, e.aimAngle + 0.95);
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 0.9;
      ctx.stroke();
      ctx.restore();
      drawGlow(ctx, e.x, e.y + hover, 17, '#38e8d4', 0.28);
    } else if (e.kind === 'spore_spitter') {
      const pulse = Math.sin(this.time * 7 + e.id) * 0.1;
      const spr = e.flashTimer > 0 ? art.sporeSpitterFlash : art.sporeSpitter;
      if (spr) {
        ctx.save();
        ctx.translate(e.x, e.y + 8);
        ctx.scale(1 + pulse, 1 - pulse);
        ctx.drawImage(spr, -12, -22, 24, 23);
        ctx.restore();
      }
      drawGlow(
        ctx,
        e.x,
        e.y - 2,
        e.telegraphTimer > 0 ? 22 : 15,
        e.telegraphTimer > 0 ? '#a3e635' : '#34d399',
        e.telegraphTimer > 0 ? 0.52 : 0.26,
      );
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
    if (
      (wep !== 'blade' && wep !== 'spear' && wep !== 'hammer') ||
      this.swings.length > 0 ||
      this.thrusts.length > 0
    ) {
      return;
    }
    const spr =
      wep === 'hammer'
        ? art.weapons.hammer
        : wep === 'spear'
          ? art.weapons.spear
          : art.weapons.blade;
    if (!spr) return;

    const idleBreath = Math.sin(this.time * 4.2) * 0.06;
    const walkSwing = this.walkAnim > 0 ? Math.sin(this.walkAnim) * 0.14 : 0;
    const size = wep === 'spear' ? 23 : wep === 'hammer' ? 21 : 19;

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

  private renderCompanion(ctx: CanvasRenderingContext2D): void {
    const compId = this.state.equippedCompanion;
    if (!compId) return;
    const art = getHDArt();
    const def = COMPANION_DEFS[compId];
    const bob = Math.sin(this.time * 5.2) * 2.2;

    drawPixelShadow(ctx, this.companionX, this.companionY + 9, 5.5, 2.2, 0.36);
    drawGlow(ctx, this.companionX, this.companionY - 2 + bob, 14, def.accentColor, 0.28);
    const spr = art.companions[compId];
    if (spr) {
      ctx.drawImage(spr, this.companionX - 9, this.companionY - 12 + bob, 18, 18);
    } else {
      ctx.fillStyle = def.accentColor;
      ctx.beginPath();
      ctx.arc(this.companionX, this.companionY - 2 + bob, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private renderFistBursts(ctx: CanvasRenderingContext2D): void {
    for (const f of this.fistBursts) {
      const t = 1 - f.life / f.maxLife;
      const alpha = Math.max(0, 1 - t);
      const len = (f.isFinisher ? 24 : 15) + t * (f.isFinisher ? 14 : 8);
      const spread = f.isFinisher ? 12 : 7;

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.translate(f.x, f.y);
      ctx.rotate(f.angle);

      // Kinetic shockwave cone / knuckle arc
      ctx.strokeStyle = f.isFinisher ? `rgba(251, 191, 36, ${alpha})` : `rgba(56, 232, 212, ${alpha})`;
      ctx.lineWidth = f.isFinisher ? 3.2 : 2.2;
      ctx.beginPath();
      ctx.arc(0, 0, len * 0.55, -0.85, 0.85);
      ctx.stroke();

      ctx.fillStyle = f.isFinisher
        ? `rgba(254, 240, 138, ${alpha * 0.72})`
        : `rgba(165, 243, 252, ${alpha * 0.65})`;
      ctx.beginPath();
      ctx.moveTo(-4, 0);
      ctx.lineTo(len * 0.85, -spread * (1 - t * 0.35));
      ctx.lineTo(len, 0);
      ctx.lineTo(len * 0.85, spread * (1 - t * 0.35));
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  private renderDiscs(ctx: CanvasRenderingContext2D): void {
    const art = getHDArt();

    // Active ricochet & recalling Phase Discs
    for (const d of this.discs) {
      // Glowing phase trail
      if (d.trail.length > 1) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 1; i < d.trail.length; i++) {
          const p0 = d.trail[i - 1];
          const p1 = d.trail[i];
          const frac = i / d.trail.length;
          ctx.strokeStyle = d.recalling
            ? `rgba(240, 171, 252, ${frac * 0.85})`
            : `rgba(56, 232, 212, ${frac * 0.75})`;
          ctx.lineWidth = 1.5 + frac * 2.5;
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(p1.x, p1.y);
          ctx.stroke();
        }
        ctx.restore();
      }

      drawGlow(ctx, d.x, d.y, d.recalling ? 20 : 16, d.recalling ? '#f0abfc' : '#c084fc', 0.42);
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(d.spin);
      if (art.weapons.discus) {
        ctx.drawImage(art.weapons.discus, -8, -8, 16, 16);
      } else {
        ctx.strokeStyle = '#38e8d4';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Active Klingen-Orbit twin phase blades (Discus secondary with 0 active discs)
    if (this.discusOrbitTimer > 0) {
      const orbitR = 26;
      const alpha = Math.min(1, this.discusOrbitTimer / 0.45);
      ctx.save();
      ctx.globalAlpha = alpha * 0.45;
      ctx.strokeStyle = '#c084fc';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(this.playerX, this.playerY - 1, orbitR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      for (let b = 0; b < 2; b++) {
        const a = this.discusOrbitAngle + b * Math.PI;
        const bx = this.playerX + Math.cos(a) * orbitR;
        const by = this.playerY - 1 + Math.sin(a) * orbitR;
        drawGlow(ctx, bx, by, 14, '#c084fc', 0.36 * alpha);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(bx, by);
        ctx.rotate(this.time * 18);
        if (art.weapons.discus) {
          ctx.drawImage(art.weapons.discus, -7, -7, 14, 14);
        }
        ctx.restore();
      }
    }
  }

  private renderPlayer(ctx: CanvasRenderingContext2D): void {
    const art = getHDArt();
    const atlas = getAtlas();
    if (
      this.invulnTimer > 0 &&
      this.dashTimer <= 0 &&
      this.lanceChargeTimer <= 0 &&
      this.cometSlamTimer <= 0 &&
      Math.floor(this.time * 24) % 2 === 0
    ) {
      return;
    }

    const walking = this.walkAnim > 0;
    const bob = walking ? Math.abs(Math.sin(this.walkAnim)) * 2.2 : Math.sin(this.time * 3) * 0.4;

    // Dynamic Melee Body Lunge, Squash/Stretch & Lean during Blade / Spear / Fists / Hammer attacks!
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

    // Show equipped Puls-Blaster, Kinetik-Fäuste, or ready Phasen-Diskus in hand!
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
    } else if (this.state.equippedWeapon === 'fists' && art.weapons.fists) {
      // Dual glowing kinetic energy gauntlets flanking hero — alternating left/right jab thrusts!
      const a = this.swingPoseTimer > 0 ? this.swingPoseAngle : this.lastAimAngle;
      const perpX = -Math.sin(a);
      const perpY = Math.cos(a);
      const isPunching = this.swingPoseTimer > 0;
      const punchPhase = isPunching
        ? Math.sin((1 - this.swingPoseTimer / Math.max(0.05, this.swingPoseMax)) * Math.PI)
        : 0;
      const isFinisher = isPunching && this.swingPoseCombo === 2;

      for (const side of [-1, 1] as const) {
        const activeSide = isFinisher || (isPunching && this.swingPoseDir === side);
        const reach = activeSide ? 8 + punchPhase * (isFinisher ? 11 : 8) : 5.5;
        const spread = activeSide ? (isFinisher ? 4.5 : 3.2) : 6.5;
        const gx = this.playerX + lungeX + Math.cos(a) * reach + perpX * side * spread;
        const gy = this.playerY - 1 - bob + Math.sin(a) * reach + perpY * side * spread;
        drawGlow(
          ctx,
          gx,
          gy,
          activeSide ? 13 : 8,
          isFinisher ? '#fde047' : activeSide ? '#38e8d4' : '#fb923c',
          activeSide ? 0.5 : 0.24,
        );
        ctx.save();
        ctx.translate(gx, gy);
        ctx.rotate(a + Math.PI / 2);
        const sz = activeSide ? 11 : 8.5;
        const halfW = art.weapons.fists.width / 2;
        const srcX = side < 0 ? 0 : halfW;
        ctx.drawImage(
          art.weapons.fists,
          srcX,
          0,
          halfW,
          art.weapons.fists.height,
          -sz * 0.42,
          -sz * 0.55,
          sz * 0.84,
          sz * 1.1,
        );
        ctx.restore();
      }
    } else if (this.state.equippedWeapon === 'discus' && this.discs.length < 2 && art.weapons.discus) {
      // Hovering mini phase-discus spinning lightly beside hero's hand when ready to throw!
      const hx = this.playerX + (this.facing === 'left' ? -10 : 10);
      const hy = this.playerY - 2 - bob;
      ctx.save();
      ctx.translate(hx, hy);
      ctx.rotate(this.time * 6);
      ctx.drawImage(art.weapons.discus, -6, -6, 12, 12);
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
    const boss = this.enemies.find((e) => this.isBossKind(e.kind));
    if (!boss) return;

    const pct = Math.max(0, boss.hp / boss.maxHp);
    const enraged = Boolean(boss.bossPhase2);
    const bw = 244;
    const bx = (VIRTUAL_WIDTH - bw) / 2;
    const by = VIRTUAL_HEIGHT - 27;

    ctx.fillStyle = 'rgba(12, 16, 26, 0.94)';
    ctx.fillRect(bx - 5, by - 12, bw + 10, 21);
    ctx.strokeStyle =
      boss.kind === 'boss_leviathan' ? (enraged ? '#fb7185' : '#fde047') : enraged ? '#fb7185' : '#fb923c';
    ctx.lineWidth = 0.9;
    ctx.strokeRect(bx - 4.5, by - 11.5, bw + 9, 20);

    const baseName =
      boss.kind === 'boss_breacher'
        ? 'SCHOTT-BRECHER MK-II'
        : boss.kind === 'boss_leviathan'
          ? '★ A.E.G.I.S. LEVIATHAN'
          : 'CORE-WÄCHTER MK-IV';
    const status = boss.bossStatusText ? ` · ${boss.bossStatusText}` : '';
    const title = enraged ? `${baseName} [PHASE II]${status}` : `${baseName}${status}`;
    ctx.fillStyle = enraged ? '#fda4af' : '#fde047';
    ctx.font = 'bold 5.2px Silkscreen, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(title, VIRTUAL_WIDTH / 2, by - 3.5);

    ctx.fillStyle = '#2a1822';
    ctx.fillRect(bx, by, bw, 5.5);
    ctx.fillStyle = enraged ? '#e11d48' : boss.kind === 'boss_leviathan' ? '#f59e0b' : '#f97316';
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
