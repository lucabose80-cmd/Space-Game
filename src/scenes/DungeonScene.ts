import { getHDArt } from '../assets/artLoader';
import { drawGlow, drawPixelShadow } from '../assets/pixelArt';
import { getAtlas } from '../assets/sprites';
import { COMPANION_DEFS, SUIT_THEMES } from '../data/companions';
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
import type { Direction, RunSummary, SectorId, WeaponId } from '../types';
import {
  generateSector1Floor,
  generateSectorFloor,
  ROOM_BOTTOM,
  ROOM_CENTER_X,
  ROOM_CENTER_Y,
  ROOM_LEFT,
  ROOM_RIGHT,
  ROOM_TOP,
  roomKey,
  type ChasmRect,
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
  | 'lev_omega_spiral'
  | 's2_idle'
  | 's2_slam_windup'
  | 's2_slam'
  | 's2_blink_windup'
  | 's2_prism_grid'
  | 's2_beam_windup'
  | 's2_twin_sweep'
  | 's2_nova_storm';

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
    | 'boss_leviathan'
    | 'crystal_crawler'
    | 'prism_drone'
    | 'shard_sniper'
    | 'void_crawler'
    | 'resonance_warden'
    | 'boss_quartz_golem'
    | 'boss_prism_weaver'
    | 'boss_prisma_archon'
    | 'slag_beetle'
    | 'solar_drone'
    | 'magma_mortar'
    | 'ember_stalker'
    | 'forge_golem'
    | 'boss_slag_overlord'
    | 'boss_forge_warden'
    | 'boss_vulkan_titan'
    | 'astral_scarab'
    | 'chrono_eye'
    | 'star_lancer'
    | 'void_wraith'
    | 'monolith_guard'
    | 'boss_chrono_sentinel'
    | 'boss_monolith_colossus'
    | 'boss_star_archon'
    | 'boss_omega_archon';
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
  public currentSector: SectorId = 1;
  public currentFloor: 1 | 2 | 3 = 1;
  public currentRoom!: DungeonRoom;

  public playerX = ROOM_CENTER_X;
  public playerY = ROOM_CENTER_Y;
  private lastSafeX = ROOM_CENTER_X;
  private lastSafeY = ROOM_CENTER_Y;
  private pitFallTimer = 0;
  private pitFallDuration = 0.46;
  private pitFallSecretRoomKey: string | null = null;
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
  public runElapsedSec = 0;
  private roomsCleared = 0;
  private enemiesDefeated = 0;
  private floorBossDefeated = false;
  private maxFloorReached = 1;
  private sector1ClearedInRun = false;
  private sector2ClearedInRun = false;
  private sector3ClearedInRun = false;
  private sector4ClearedInRun = false;
  private omegaClearedInRun = false;
  private finished = false;

  public activePrompt: { label: string; x: number; y: number } | null = null;

  constructor(state: GameState, callbacks: DungeonCallbacks) {
    this.state = state;
    this.callbacks = callbacks;
  }

  public isInBossFight(): boolean {
    return this.currentRoom?.type === 'boss' && this.enemies.some((e) => this.isBossKind(e.kind));
  }

  public startRun(sector: SectorId = 1): void {
    this.currentSector = sector;
    this.state.restoreFullVitals();
    this.runElapsedSec = 0;
    this.roomsCleared = 0;
    this.enemiesDefeated = 0;
    this.maxFloorReached = 1;
    this.sector1ClearedInRun = false;
    this.sector2ClearedInRun = false;
    this.sector3ClearedInRun = false;
    this.sector4ClearedInRun = false;
    this.omegaClearedInRun = false;
    this.lumaRoomCounter = 0;
    this.haloShieldReady = this.state.equippedCompanion === 'halo';
    this.haloChargeTimer = 0;
    this.finished = false;
    this.startFloor(sector === 5 ? 3 : 1, true, sector);
  }

  public startFloor(floorIndex: 1 | 2 | 3, freshRun = false, sector: SectorId = this.currentSector): void {
    this.currentSector = sector;
    this.currentFloor = floorIndex;
    this.maxFloorReached = Math.max(this.maxFloorReached, floorIndex);
    if (sector === 4) {
      if (floorIndex > this.state.deepestFloorS4) {
        this.state.deepestFloorS4 = floorIndex;
        this.state.save();
      }
    } else if (sector === 3) {
      if (floorIndex > this.state.deepestFloorS3) {
        this.state.deepestFloorS3 = floorIndex;
        this.state.save();
      }
    } else if (sector === 2) {
      if (floorIndex > this.state.deepestFloorS2) {
        this.state.deepestFloorS2 = floorIndex;
        this.state.save();
      }
    } else if (sector === 1 && floorIndex > this.state.deepestFloor) {
      this.state.deepestFloor = floorIndex;
      this.state.save();
    }
    this.floor = generateSectorFloor(sector, floorIndex);
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
    this.spawnBurst(
      this.playerX,
      this.playerY,
      sector === 5
        ? '#fde047'
        : sector === 4
          ? '#38e8d4'
          : sector === 3
            ? '#f97316'
            : sector === 2
              ? '#c084fc'
              : floorIndex === 3
                ? '#fbbf24'
                : '#38e8d4',
      24,
    );

    if (sector === 5) {
      this.callbacks.onToast(
        '🌌 5. TIEFENRAUM-TOR · OMEGA-ANOMALIE! Elite-Prüfung aller 4 Sektoren → ★ OMEGA STERNEN-ARCHON!',
        'warn',
      );
    } else if (sector === 4) {
      if (freshRun) {
        this.callbacks.onToast(
          this.state.timeOfDay === 'night'
            ? '🌙 Nacht-Expedition · Sektor 4 · Ebene I: Sternen-Vorhof (+35 % Rar-Loot)!'
            : '👑 Sektor 4 (Ältesten-Monolith) · Ebene I: Sternen-Vorhof — Astral-Skarabäen & Chrono-Augen!',
          this.state.timeOfDay === 'night' ? 'good' : 'info',
        );
      } else if (floorIndex === 2) {
        this.callbacks.onToast(
          '⬇ Sektor 4 · Ebene II: Astral-Bibliothek — Achtung: Sternen-Lanzen & Leeren-Geister!',
          'warn',
        );
      } else {
        this.callbacks.onToast(
          '⬇ Sektor 4 · Ebene III: Thron der Ältesten — ★ DER STERNEN-ARCHON erwartet dich!',
          'warn',
        );
      }
    } else if (sector === 3) {
      if (freshRun) {
        this.callbacks.onToast(
          this.state.timeOfDay === 'night'
            ? '🌙 Nacht-Expedition · Sektor 3 · Ebene I: Schlacken-Halle (+35 % Rar-Loot)!'
            : '🔥 Sektor 3 (Solar-Gießerei) · Ebene I: Schlacken-Halle — Schlacken-Käfer & Solar-Drohnen!',
          this.state.timeOfDay === 'night' ? 'good' : 'info',
        );
      } else if (floorIndex === 2) {
        this.callbacks.onToast(
          '⬇ Sektor 3 · Ebene II: Schmelz-Trakt — Neue Gegner: Magma-Mörser & Glut-Jäger!',
          'warn',
        );
      } else {
        this.callbacks.onToast(
          '⬇ Sektor 3 · Ebene III: Herz der Sonne — Nutze die Medstation! ★ VULKAN-TITAN wartet!',
          'warn',
        );
      }
    } else if (sector === 2) {
      if (freshRun) {
        this.callbacks.onToast(
          this.state.timeOfDay === 'night'
            ? '🌙 Nacht-Expedition · Sektor 2 · Ebene I: Quarz-Kaverne (+35 % Rar-Loot)!'
            : '💎 Sektor 2 (Kristall-Nebel) · Ebene I: Quarz-Kaverne — Achtung: Kristall-Krabbler & Prisma-Drohnen!',
          this.state.timeOfDay === 'night' ? 'good' : 'info',
        );
      } else if (floorIndex === 2) {
        this.callbacks.onToast(
          '⬇ Sektor 2 · Ebene II: Resonanz-Ader — Neue Gegner: Splitter-Schützen & Äther-Krabbler!',
          'warn',
        );
      } else {
        this.callbacks.onToast(
          '⬇ Sektor 2 · Ebene III: Herz des Nebels — Nutze die Medstation! Der ★ PRISMA-ARCHON erwartet dich!',
          'warn',
        );
      }
    } else if (freshRun) {
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
    this.pitFallTimer = 0;
    this.pitFallSecretRoomKey = null;
    this.activePrompt = null;
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
    this.lastSafeX = this.playerX;
    this.lastSafeY = this.playerY;

    if (!room.cleared) {
      for (const sp of room.spawns) {
        this.spawnEnemy(sp.kind, sp.x, sp.y);
      }
      if (room.type === 'boss') {
        sound.playBossRoar();
        this.triggerShake(0.42, 4.8);
        if (this.currentSector === 5) {
          this.callbacks.onToast('🌌 FINALER BOSS DES 5. TORS: ★ OMEGA STERNEN-ARCHON ERWACHT!', 'warn');
        } else if (this.currentSector === 4) {
          if (this.currentFloor === 1) this.callbacks.onToast('⚠ SEKTOR-4 BOSS I: Chrono-Wächter erwacht!', 'warn');
          else if (this.currentFloor === 2) this.callbacks.onToast('⚠ SEKTOR-4 BOSS II: Monolith-Koloss manifestiert sich!', 'warn');
          else this.callbacks.onToast('👑 SEKTOR-4-ENDBOSS: ★ DER STERNEN-ARCHON ERWACHT!', 'warn');
        } else if (this.currentSector === 3) {
          if (this.currentFloor === 1) this.callbacks.onToast('⚠ SEKTOR-3 BOSS I: Schlacken-Koloss erwacht!', 'warn');
          else if (this.currentFloor === 2) this.callbacks.onToast('⚠ SEKTOR-3 BOSS II: Gießerei-Meister heizt auf!', 'warn');
          else this.callbacks.onToast('🔥 SEKTOR-3-ENDBOSS: ★ VULKAN-TITAN ERWACHT!', 'warn');
        } else if (this.currentSector === 2) {
          if (this.currentFloor === 1) this.callbacks.onToast('⚠ SEKTOR-2 BOSS I: Quarz-Koloss MK-I erwacht!', 'warn');
          else if (this.currentFloor === 2) this.callbacks.onToast('⚠ SEKTOR-2 BOSS II: Prisma-Weberin manifestiert sich!', 'warn');
          else this.callbacks.onToast('🚨 SEKTOR-2-ENDBOSS: ★ PRISMA-ARCHON ERWACHT!', 'warn');
        } else if (this.currentFloor === 1) {
          this.callbacks.onToast('⚠ EBENEN-BOSS I: Schott-Brecher MK-II rückt vor!', 'warn');
        } else if (this.currentFloor === 2) {
          this.callbacks.onToast('⚠ EBENEN-BOSS II: Core-Wächter MK-IV erwacht!', 'warn');
        } else {
          this.callbacks.onToast('🚨 SEKTOR-1-ENDBOSS: A.E.G.I.S. LEVIATHAN AKTIVIERT!', 'warn');
        }
      }
    }
  }

  private enterSecretRoom(secretKey: string, returnX: number, returnY: number): void {
    const secretRoom = this.floor.rooms.get(secretKey);
    if (!secretRoom) return;
    secretRoom.secretReturnX = returnX;
    secretRoom.secretReturnY = returnY;
    this.currentRoom = secretRoom;
    const firstVisit = !secretRoom.visited;
    secretRoom.visited = true;

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
    this.pitFallTimer = 0;
    this.pitFallSecretRoomKey = null;
    this.roomFade = 0.28;

    this.playerX = ROOM_CENTER_X;
    this.playerY = ROOM_CENTER_Y + 26;
    this.lastSafeX = this.playerX;
    this.lastSafeY = this.playerY;
    this.facing = 'up';
    this.invulnTimer = 0.6;
    this.spawnBurst(this.playerX, this.playerY, '#fde047', 22);
    this.spawnBurst(this.playerX, this.playerY, this.currentSector === 2 ? '#e879f9' : '#38e8d4', 16);

    if (firstVisit) {
      this.callbacks.onToast(
        '★ GEHEIMER ABGRUND ENTDECKT! Du landest in einer verborgenen Schatzkammer mit seltener Beute!',
        'good',
      );
    } else {
      this.callbacks.onToast('★ Zurück in der geheimen Schatzkammer!', 'info');
    }
    this.callbacks.onHudDirty();
  }

  private exitSecretRoom(): void {
    const parentKey = this.currentRoom.secretParentKey;
    if (!parentKey) return;
    const rx = this.currentRoom.secretReturnX ?? ROOM_CENTER_X;
    const ry = this.currentRoom.secretReturnY ?? ROOM_CENTER_Y;
    sound.playWarp();
    this.enterRoom(parentKey, null);
    this.playerX = rx;
    this.playerY = ry;
    this.lastSafeX = rx;
    this.lastSafeY = ry;
    this.invulnTimer = 0.9;
    this.spawnBurst(rx, ry, '#38e8d4', 18);
    this.callbacks.onToast('Mit dem Grav-Seil sicher zurück nach oben gezogen!', 'info');
    this.callbacks.onHudDirty();
  }

  private isBossKind(kind: Enemy['kind']): boolean {
    return (
      kind === 'boss_breacher' ||
      kind === 'boss' ||
      kind === 'boss_leviathan' ||
      kind === 'boss_quartz_golem' ||
      kind === 'boss_prism_weaver' ||
      kind === 'boss_prisma_archon' ||
      kind === 'boss_slag_overlord' ||
      kind === 'boss_forge_warden' ||
      kind === 'boss_vulkan_titan' ||
      kind === 'boss_chrono_sentinel' ||
      kind === 'boss_monolith_colossus' ||
      kind === 'boss_star_archon' ||
      kind === 'boss_omega_archon'
    );
  }

  private spawnEnemy(kind: Enemy['kind'], x: number, y: number): void {
    const ngMult = 1 + this.state.ngPlusLevel * 0.35;
    const floorScale = (this.currentFloor === 1 ? 1.0 : this.currentFloor === 2 ? 1.24 : 1.48) * ngMult;
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
    } else if (kind === 'crystal_crawler') {
      const e = makeBase(Math.round(78 * baseScale), 9);
      e.aiTimer = 0.55 + Math.random() * 0.4;
      this.enemies.push(e);
    } else if (kind === 'prism_drone') {
      const e = makeBase(Math.round(86 * baseScale), 10);
      e.aiTimer = 1.05 + Math.random() * 0.5;
      e.phase = Math.random() * Math.PI * 2;
      this.enemies.push(e);
    } else if (kind === 'shard_sniper') {
      const e = makeBase(Math.round(82 * baseScale), 9);
      e.aiTimer = 1.2 + Math.random() * 0.5;
      e.aimAngle = Math.atan2(this.playerY - y, this.playerX - x);
      this.enemies.push(e);
    } else if (kind === 'void_crawler') {
      const e = makeBase(Math.round(96 * baseScale), 10);
      e.aiTimer = 0.55 + Math.random() * 0.35;
      this.enemies.push(e);
    } else if (kind === 'resonance_warden') {
      const e = makeBase(Math.round(120 * baseScale), 11);
      e.aiTimer = 1.35 + Math.random() * 0.5;
      e.aimAngle = Math.random() * Math.PI * 2;
      this.enemies.push(e);
    } else if (kind === 'slag_beetle') {
      const e = makeBase(Math.round(115 * baseScale), 10);
      e.aiTimer = 0.55 + Math.random() * 0.35;
      this.enemies.push(e);
    } else if (kind === 'solar_drone') {
      const e = makeBase(Math.round(124 * baseScale), 10);
      e.aiTimer = 1.0 + Math.random() * 0.45;
      e.phase = Math.random() * Math.PI * 2;
      this.enemies.push(e);
    } else if (kind === 'magma_mortar') {
      const e = makeBase(Math.round(135 * baseScale), 11);
      e.aiTimer = 1.15 + Math.random() * 0.45;
      e.aimAngle = Math.atan2(this.playerY - y, this.playerX - x);
      this.enemies.push(e);
    } else if (kind === 'ember_stalker') {
      const e = makeBase(Math.round(138 * baseScale), 10);
      e.aiTimer = 0.65 + Math.random() * 0.35;
      this.enemies.push(e);
    } else if (kind === 'forge_golem') {
      const e = makeBase(Math.round(178 * baseScale), 12);
      e.aiTimer = 1.25 + Math.random() * 0.4;
      e.aimAngle = Math.random() * Math.PI * 2;
      this.enemies.push(e);
    } else if (kind === 'astral_scarab') {
      const e = makeBase(Math.round(158 * baseScale), 10);
      e.aiTimer = 0.5 + Math.random() * 0.35;
      this.enemies.push(e);
    } else if (kind === 'chrono_eye') {
      const e = makeBase(Math.round(166 * baseScale), 10);
      e.aiTimer = 0.95 + Math.random() * 0.45;
      e.phase = Math.random() * Math.PI * 2;
      this.enemies.push(e);
    } else if (kind === 'star_lancer') {
      const e = makeBase(Math.round(174 * baseScale), 10);
      e.aiTimer = 1.1 + Math.random() * 0.4;
      e.aimAngle = Math.atan2(this.playerY - y, this.playerX - x);
      this.enemies.push(e);
    } else if (kind === 'void_wraith') {
      const e = makeBase(Math.round(182 * baseScale), 10);
      e.aiTimer = 0.65 + Math.random() * 0.35;
      this.enemies.push(e);
    } else if (kind === 'monolith_guard') {
      const e = makeBase(Math.round(235 * baseScale), 12);
      e.aiTimer = 1.2 + Math.random() * 0.45;
      e.aimAngle = Math.random() * Math.PI * 2;
      this.enemies.push(e);
    } else if (kind === 'boss_slag_overlord') {
      const e = makeBase(Math.round(680 * ngMult), 19);
      e.bossState = 's2_idle';
      e.bossStateTimer = 0.85;
      e.bossStateMax = 0.85;
      e.bossPhase2 = false;
      e.bossStatusText = 'SCHLACKEN-KERN AKTIV';
      this.enemies.push(e);
    } else if (kind === 'boss_forge_warden') {
      const e = makeBase(Math.round(920 * ngMult), 19);
      e.bossState = 's2_idle';
      e.bossStateTimer = 0.8;
      e.bossStateMax = 0.8;
      e.bossPhase2 = false;
      e.bossOrbitAngle = 0;
      e.bossStatusText = 'SCHMELZOFEN AKTIV';
      this.enemies.push(e);
    } else if (kind === 'boss_vulkan_titan') {
      const e = makeBase(Math.round(1580 * ngMult), 25);
      e.bossState = 's2_idle';
      e.bossStateTimer = 0.9;
      e.bossStateMax = 0.9;
      e.bossPhase2 = false;
      e.bossLaserAngle = Math.PI / 2;
      e.bossLaserDir = 1;
      e.bossLaserTick = 0;
      e.bossOrbitAngle = 0;
      e.summonThreshold = 1;
      e.bossStatusText = 'VULKAN-TITAN AKTIV';
      this.enemies.push(e);
    } else if (kind === 'boss_chrono_sentinel') {
      const e = makeBase(Math.round(980 * ngMult), 19);
      e.bossState = 's2_idle';
      e.bossStateTimer = 0.82;
      e.bossStateMax = 0.82;
      e.bossPhase2 = false;
      e.bossOrbitAngle = 0;
      e.bossStatusText = 'CHRONO-FELD AKTIV';
      this.enemies.push(e);
    } else if (kind === 'boss_monolith_colossus') {
      const e = makeBase(Math.round(1340 * ngMult), 20);
      e.bossState = 's2_idle';
      e.bossStateTimer = 0.8;
      e.bossStateMax = 0.8;
      e.bossPhase2 = false;
      e.bossOrbitAngle = 0;
      e.bossStatusText = 'MONOLITH-KERN AKTIV';
      this.enemies.push(e);
    } else if (kind === 'boss_star_archon') {
      const e = makeBase(Math.round(2180 * ngMult), 25);
      e.bossState = 's2_idle';
      e.bossStateTimer = 0.85;
      e.bossStateMax = 0.85;
      e.bossPhase2 = false;
      e.bossLaserAngle = Math.PI / 2;
      e.bossLaserDir = 1;
      e.bossLaserTick = 0;
      e.bossOrbitAngle = 0;
      e.summonThreshold = 1;
      e.bossStatusText = 'STERNEN-ARCHON AKTIV';
      this.enemies.push(e);
    } else if (kind === 'boss_omega_archon') {
      const e = makeBase(Math.round(2950 * ngMult), 27);
      e.bossState = 's2_idle';
      e.bossStateTimer = 0.8;
      e.bossStateMax = 0.8;
      e.bossPhase2 = false;
      e.bossLaserAngle = Math.PI / 2;
      e.bossLaserDir = 1;
      e.bossLaserTick = 0;
      e.bossOrbitAngle = 0;
      e.summonThreshold = 1;
      e.bossStatusText = 'OMEGA-ANOMALIE AKTIV';
      this.enemies.push(e);
    } else if (kind === 'boss_quartz_golem') {
      const e = makeBase(Math.round(440 * ngMult * (1 + Math.min(2, this.state.bossDefeatedCount) * 0.06)), 18);
      e.bossState = 's2_idle';
      e.bossStateTimer = 0.9;
      e.bossStateMax = 0.9;
      e.bossPhase2 = false;
      e.bossStatusText = 'QUARZ-KERN AKTIV';
      this.enemies.push(e);
    } else if (kind === 'boss_prism_weaver') {
      const e = makeBase(Math.round(620 * ngMult * (1 + Math.min(2, this.state.bossDefeatedCount) * 0.06)), 17);
      e.bossState = 's2_idle';
      e.bossStateTimer = 0.85;
      e.bossStateMax = 0.85;
      e.bossPhase2 = false;
      e.bossOrbitAngle = 0;
      e.bossStatusText = 'PRISMA-NETZ AKTIV';
      this.enemies.push(e);
    } else if (kind === 'boss_prisma_archon') {
      const e = makeBase(Math.round(1080 * ngMult * (1 + Math.min(2, this.state.bossDefeatedCount) * 0.05)), 24);
      e.bossState = 's2_idle';
      e.bossStateTimer = 0.95;
      e.bossStateMax = 0.95;
      e.bossPhase2 = false;
      e.bossLaserAngle = Math.PI / 2;
      e.bossLaserDir = 1;
      e.bossLaserTick = 0;
      e.bossOrbitAngle = 0;
      e.summonThreshold = 1;
      e.bossStatusText = 'PRISMA-ARCHON AKTIV';
      this.enemies.push(e);
    } else if (kind === 'boss_breacher') {
      const e = makeBase(Math.round(255 * ngMult * (1 + Math.min(2, this.state.bossDefeatedCount) * 0.08)), 16);
      e.bossState = 'stalk';
      e.bossStateTimer = 0.85;
      e.bossStateMax = 0.85;
      e.bossHeight = 0;
      e.bossPhase2 = false;
      e.bossStatusText = 'AKTIV';
      e.bossAfterimageTick = 0;
      this.enemies.push(e);
    } else if (kind === 'boss') {
      const e = makeBase(Math.round(420 * ngMult * (1 + Math.min(2, this.state.bossDefeatedCount) * 0.08)), 16);
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
      const e = makeBase(Math.round(760 * ngMult * (1 + Math.min(2, this.state.bossDefeatedCount) * 0.06)), 28);
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
    this.runElapsedSec += dt;
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
    // Active pit-fall tumble animation (normal abyss damage/respawn OR secret underground vault descent!)
    if (this.pitFallTimer > 0) {
      this.pitFallTimer -= dt;
      this.shieldActive = false;
      if (this.pitFallTimer <= 0) {
        this.pitFallTimer = 0;
        const secretKey = this.pitFallSecretRoomKey;
        this.pitFallSecretRoomKey = null;
        if (secretKey) {
          this.enterSecretRoom(secretKey, this.lastSafeX, this.lastSafeY);
        } else {
          const fallDmg = 14;
          this.state.hp = Math.max(0, this.state.hp - fallDmg);
          this.playerFlashTimer = 0.22;
          this.invulnTimer = 1.05;
          this.triggerShake(0.24, 3.6);
          sound.playPlayerHurt();
          this.playerX = this.lastSafeX;
          this.playerY = this.lastSafeY;
          this.spawnBurst(this.playerX, this.playerY, '#fb7185', 12);
          this.floats.push({
            x: this.playerX,
            y: this.playerY - 16,
            text: `ABGESTÜRZT! -${fallDmg}`,
            color: '#fb7185',
            life: 1.0,
            maxLife: 1.0,
          });
          this.callbacks.onHudDirty();
          if (this.state.hp <= 0) {
            this.triggerDefeat();
          }
        }
      }
      return;
    }

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

    // Chasm / Pit check: Jetpack-Dash, Spear Charge & Comet-Slam fly cleanly OVER narrow gaps!
    // Walking in (or running out of dash over a wide abyss) triggers a fall — or drops into a Secret Pit Vault!
    const isAirborne = this.dashTimer > 0 || this.lanceChargeTimer > 0 || this.cometSlamTimer > 0;
    if (!isAirborne) {
      const chasm = this.getChasmAt(this.playerX, this.playerY + 4, -3);
      if (chasm) {
        this.shieldActive = false;
        this.warpChannel = 0;
        if (chasm.secret) {
          chasm.secretVisited = true;
          this.pitFallDuration = 0.42;
          this.pitFallTimer = this.pitFallDuration;
          this.pitFallSecretRoomKey = `secret:${this.currentRoom.key}`;
          sound.playSecretChime();
          this.spawnBurst(this.playerX, this.playerY, '#fde047', 16);
          this.spawnBurst(this.playerX, this.playerY, '#e879f9', 10);
        } else {
          this.pitFallDuration = 0.46;
          this.pitFallTimer = this.pitFallDuration;
          this.pitFallSecretRoomKey = null;
          sound.playPitFall();
          this.spawnBurst(this.playerX, this.playerY + 2, '#94a3b8', 10);
        }
        return;
      }
      if (!this.getChasmAt(this.playerX, this.playerY + 4, 6)) {
        this.lastSafeX = this.playerX;
        this.lastSafeY = this.playerY;
      }
    }

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

  private getChasmAt(x: number, y: number, margin = 0): ChasmRect | null {
    const chasms = this.currentRoom?.chasms;
    if (!chasms) return null;
    for (const ch of chasms) {
      if (
        x + margin > ch.x &&
        x - margin < ch.x + ch.w &&
        y + margin > ch.y &&
        y - margin < ch.y + ch.h
      ) {
        return ch;
      }
    }
    return null;
  }

  private collidesRoomChasm(x: number, y: number, r: number): boolean {
    return this.getChasmAt(x, y, r) !== null;
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
      } else if (e.kind === 'crystal_crawler') {
        // Sector 2 Floor I: Armored quartz arachnid — brisk crystalline scuttle + telegraphed violet shard dash!
        if (e.chargeActive > 0) {
          e.chargeActive -= dt;
          e.vx = e.chargeDirX * 190;
          e.vy = e.chargeDirY * 190;
          if (Math.random() < dt * 20) {
            this.particles.push({
              x: e.x,
              y: e.y + 3,
              vx: -e.chargeDirX * 20,
              vy: -e.chargeDirY * 20,
              color: '#c084fc',
              size: 1.8,
              life: 0.22,
              maxLife: 0.22,
            });
          }
          if (e.chargeActive <= 0) {
            e.aiTimer = 0.85 + Math.random() * 0.35;
          }
        } else if (e.telegraphTimer > 0) {
          e.vx *= 0.2;
          e.vy *= 0.2;
          e.telegraphTimer -= dt;
          if (e.telegraphTimer <= 0) {
            e.chargeActive = 0.3;
            this.spawnBurst(e.x, e.y, '#c084fc', 8);
          }
        } else {
          const strafe = Math.sin(this.time * 4 + e.id) * 0.45;
          e.vx = (nx - ny * strafe) * 56;
          e.vy = (ny + nx * strafe) * 56;
          e.aiTimer -= dt;
          if (e.aiTimer <= 0 && dist < 135) {
            e.chargeDirX = nx;
            e.chargeDirY = ny;
            e.aimAngle = Math.atan2(dy, dx);
            e.telegraphTimer = 0.38;
          }
        }
      } else if (e.kind === 'prism_drone') {
        // Sector 2 Floor I/II: Hovering prism octahedron — rotates and fires 4-way '+' / 'x' crystal cross pulses!
        e.phase += dt * 1.4;
        const desiredDist = 92;
        const radial = dist < desiredDist - 18 ? -46 : dist > desiredDist + 24 ? 46 : 0;
        const orbit = 38 * e.moveDirX;
        e.vx = nx * radial - ny * orbit;
        e.vy = ny * radial + nx * orbit;

        if (e.telegraphTimer > 0) {
          e.vx *= 0.25;
          e.vy *= 0.25;
          e.telegraphTimer -= dt;
          if (e.telegraphTimer <= 0) {
            const offset = e.subBurst % 2 === 0 ? 0 : Math.PI / 4;
            e.subBurst += 1;
            sound.playBlaster();
            this.spawnBurst(e.x, e.y, '#38e8d4', 8);
            for (let k = 0; k < 4; k++) {
              const a = offset + k * (Math.PI / 2);
              this.projectiles.push({
                x: e.x + Math.cos(a) * 9,
                y: e.y + Math.sin(a) * 9,
                vx: Math.cos(a) * 142,
                vy: Math.sin(a) * 142,
                fromPlayer: false,
                damage: 14,
                color: k % 2 === 0 ? '#38e8d4' : '#e879f9',
                radius: 3.6,
                life: 1.55,
              });
            }
            e.aiTimer = 1.45 + Math.random() * 0.4;
            if (Math.random() < 0.4) e.moveDirX = -e.moveDirX;
          }
        } else {
          e.aiTimer -= dt;
          if (e.aiTimer <= 0) {
            e.telegraphTimer = 0.46;
          }
        }
      } else if (e.kind === 'shard_sniper') {
        // Sector 2 Floor II/III: Long-range amethyst marksman — projects magenta laser sightline (0.65s) then fires blazing crystal lance!
        if (e.telegraphTimer > 0) {
          e.vx *= 0.1;
          e.vy *= 0.1;
          // Track player during first 60% of windup, then lock line so player can dodge!
          if (e.telegraphTimer > 0.26) {
            e.aimAngle = Math.atan2(dy, dx);
          }
          e.telegraphTimer -= dt;
          if (e.telegraphTimer <= 0) {
            sound.playRailBeam();
            const ax = Math.cos(e.aimAngle);
            const ay = Math.sin(e.aimAngle);
            this.spawnBurst(e.x + ax * 10, e.y + ay * 10, '#f472b6', 10);
            this.projectiles.push({
              x: e.x + ax * 11,
              y: e.y + ay * 11,
              vx: ax * 275,
              vy: ay * 275,
              fromPlayer: false,
              damage: 19,
              color: '#f472b6',
              radius: 4.2,
              life: 1.35,
            });
            e.aiTimer = 1.65 + Math.random() * 0.45;
            e.moveDirX = -e.moveDirX;
          }
        } else {
          const desiredDist = 132;
          const radial = dist < desiredDist - 22 ? -64 : dist > desiredDist + 24 ? 44 : 0;
          e.vx = nx * radial - ny * 34 * e.moveDirX;
          e.vy = ny * radial + nx * 34 * e.moveDirX;
          e.aimAngle = Math.atan2(dy, dx);
          e.aiTimer -= dt;
          if (e.aiTimer <= 0) {
            e.telegraphTimer = 0.65;
          }
        }
      } else if (e.kind === 'void_crawler') {
        // Sector 2 Floor II/III Elite Variant: Neon void-crystal crawler — faster dash that leaves 4 glowing cyan-magenta crystal bursts!
        if (e.chargeActive > 0) {
          e.chargeActive -= dt;
          e.vx = e.chargeDirX * 225;
          e.vy = e.chargeDirY * 225;
          if (Math.random() < dt * 28) {
            this.particles.push({
              x: e.x,
              y: e.y + 2,
              vx: -e.chargeDirX * 26,
              vy: -e.chargeDirY * 26,
              color: Math.random() > 0.5 ? '#e879f9' : '#38e8d4',
              size: 2.0,
              life: 0.24,
              maxLife: 0.24,
            });
          }
          if (e.chargeActive <= 0) {
            this.spawnBurst(e.x, e.y, '#e879f9', 10);
            for (let k = 0; k < 4; k++) {
              const a = Math.PI / 4 + k * (Math.PI / 2);
              this.projectiles.push({
                x: e.x,
                y: e.y,
                vx: Math.cos(a) * 118,
                vy: Math.sin(a) * 118,
                fromPlayer: false,
                damage: 14,
                color: k % 2 === 0 ? '#e879f9' : '#38e8d4',
                radius: 3.5,
                life: 0.85,
              });
            }
            e.aiTimer = 0.9 + Math.random() * 0.35;
          }
        } else if (e.telegraphTimer > 0) {
          e.vx *= 0.15;
          e.vy *= 0.15;
          e.telegraphTimer -= dt;
          if (e.telegraphTimer <= 0) {
            e.chargeActive = 0.32;
            this.spawnBurst(e.x, e.y, '#38e8d4', 10);
          }
        } else {
          e.vx = (nx - ny * 0.4 * e.moveDirX) * 68;
          e.vy = (ny + nx * 0.4 * e.moveDirX) * 68;
          e.aiTimer -= dt;
          if (e.aiTimer <= 0 && dist < 155) {
            e.chargeDirX = nx;
            e.chargeDirY = ny;
            e.aimAngle = Math.atan2(dy, dx);
            e.telegraphTimer = 0.36;
            e.moveDirX = -e.moveDirX;
          }
        }
      } else if (e.kind === 'resonance_warden') {
        // Sector 2 Floor III: Floating golden-amethyst monolith with rotating crystal shield arc & 6-way radial shock-pulse!
        e.aimAngle += dt * 1.75;
        e.vx = nx * 30 - ny * 18 * e.moveDirX;
        e.vy = ny * 30 + nx * 18 * e.moveDirX;
        if (e.telegraphTimer > 0) {
          e.vx *= 0.25;
          e.vy *= 0.25;
          e.telegraphTimer -= dt;
          if (e.telegraphTimer <= 0) {
            sound.playBossSlam();
            this.shockwaves.push({
              x: e.x,
              y: e.y,
              maxRadius: 68,
              color: '#c084fc',
              life: 0.32,
              maxLife: 0.32,
            });
            for (let k = 0; k < 6; k++) {
              const a = e.aimAngle + k * (Math.PI / 3);
              this.projectiles.push({
                x: e.x + Math.cos(a) * 10,
                y: e.y + Math.sin(a) * 10,
                vx: Math.cos(a) * 134,
                vy: Math.sin(a) * 134,
                fromPlayer: false,
                damage: 16,
                color: k % 2 === 0 ? '#fde047' : '#c084fc',
                radius: 3.9,
                life: 1.45,
              });
            }
            e.aiTimer = 1.85 + Math.random() * 0.45;
          }
        } else {
          e.aiTimer -= dt;
          if (e.aiTimer <= 0) {
            e.telegraphTimer = 0.52;
          }
        }
      } else if (e.kind === 'slag_beetle' || e.kind === 'astral_scarab') {
        // Armored dash-crawler (S3 Slag Beetle / S4 Astral Scarab): rapid locked charge + 4-way spark burst!
        const isS4 = e.kind === 'astral_scarab';
        const colA = isS4 ? '#fde047' : '#f97316';
        const colB = isS4 ? '#38e8d4' : '#fde047';
        if (e.chargeActive > 0) {
          e.chargeActive -= dt;
          const spd = isS4 ? 245 : 220;
          e.vx = e.chargeDirX * spd;
          e.vy = e.chargeDirY * spd;
          if (Math.random() < dt * 26) {
            this.particles.push({
              x: e.x,
              y: e.y + 2,
              vx: -e.chargeDirX * 24,
              vy: -e.chargeDirY * 24,
              color: Math.random() > 0.5 ? colA : colB,
              size: 2.0,
              life: 0.24,
              maxLife: 0.24,
            });
          }
          if (e.chargeActive <= 0) {
            this.spawnBurst(e.x, e.y, colA, 10);
            for (let k = 0; k < 4; k++) {
              const a = (isS4 ? 0 : Math.PI / 4) + k * (Math.PI / 2);
              this.projectiles.push({
                x: e.x,
                y: e.y,
                vx: Math.cos(a) * (isS4 ? 138 : 122),
                vy: Math.sin(a) * (isS4 ? 138 : 122),
                fromPlayer: false,
                damage: isS4 ? 20 : 17,
                color: k % 2 === 0 ? colA : colB,
                radius: 3.6,
                life: 0.9,
              });
            }
            e.aiTimer = (isS4 ? 0.8 : 0.95) + Math.random() * 0.35;
          }
        } else if (e.telegraphTimer > 0) {
          e.vx *= 0.15;
          e.vy *= 0.15;
          e.telegraphTimer -= dt;
          if (e.telegraphTimer <= 0) {
            e.chargeActive = 0.32;
            this.spawnBurst(e.x, e.y, colB, 8);
          }
        } else {
          e.vx = (nx - ny * 0.35 * e.moveDirX) * (isS4 ? 76 : 66);
          e.vy = (ny + nx * 0.35 * e.moveDirX) * (isS4 ? 76 : 66);
          e.aiTimer -= dt;
          if (e.aiTimer <= 0 && dist < 165) {
            e.chargeDirX = nx;
            e.chargeDirY = ny;
            e.aimAngle = Math.atan2(dy, dx);
            e.telegraphTimer = 0.34;
            e.moveDirX = -e.moveDirX;
          }
        }
      } else if (e.kind === 'solar_drone' || e.kind === 'chrono_eye') {
        // Orbiting S3 Solar Drone (3-shot solar fan) / S4 Chrono Eye (4-shot swirling astral burst)!
        const isS4 = e.kind === 'chrono_eye';
        const desiredDist = 112;
        const radial = dist < desiredDist - 18 ? -52 : dist > desiredDist + 18 ? 48 : 0;
        e.vx = nx * radial - ny * 46 * e.moveDirX;
        e.vy = ny * radial + nx * 46 * e.moveDirX;
        e.aimAngle = Math.atan2(dy, dx);
        if (e.telegraphTimer > 0) {
          e.telegraphTimer -= dt;
          if (e.telegraphTimer <= 0) {
            sound.playBlaster();
            const count = isS4 ? 4 : 3;
            for (let k = 0; k < count; k++) {
              const offset = (k - (count - 1) / 2) * (isS4 ? 0.24 : 0.28);
              const a = e.aimAngle + offset;
              this.projectiles.push({
                x: e.x + Math.cos(a) * 9,
                y: e.y + Math.sin(a) * 9,
                vx: Math.cos(a) * (isS4 ? 175 : 158),
                vy: Math.sin(a) * (isS4 ? 175 : 158),
                fromPlayer: false,
                damage: isS4 ? 21 : 17,
                color: isS4 ? (k % 2 === 0 ? '#38e8d4' : '#fde047') : k % 2 === 0 ? '#f97316' : '#fde047',
                radius: 3.7,
                life: 1.5,
              });
            }
            e.aiTimer = (isS4 ? 1.3 : 1.45) + Math.random() * 0.4;
            if (Math.random() < 0.45) e.moveDirX = -e.moveDirX;
          }
        } else {
          e.aiTimer -= dt;
          if (e.aiTimer <= 0) e.telegraphTimer = 0.44;
        }
      } else if (e.kind === 'magma_mortar' || e.kind === 'star_lancer') {
        // S3 Magma Mortar (heavy 4-shell molten cross volley) / S4 Star Lancer (high-speed twin precision beam-lances)!
        const isS4 = e.kind === 'star_lancer';
        if (e.telegraphTimer > 0) {
          e.vx *= 0.1;
          e.vy *= 0.1;
          if (e.telegraphTimer > 0.24) e.aimAngle = Math.atan2(dy, dx);
          e.telegraphTimer -= dt;
          if (e.telegraphTimer <= 0) {
            sound.playRailBeam();
            if (isS4) {
              for (const off of [-0.07, 0.07]) {
                const a = e.aimAngle + off;
                this.projectiles.push({
                  x: e.x + Math.cos(a) * 11,
                  y: e.y + Math.sin(a) * 11,
                  vx: Math.cos(a) * 295,
                  vy: Math.sin(a) * 295,
                  fromPlayer: false,
                  damage: 23,
                  color: '#fde047',
                  radius: 4.1,
                  life: 1.35,
                });
              }
            } else {
              this.spawnBurst(e.x, e.y, '#f97316', 12);
              for (let k = 0; k < 4; k++) {
                const a = e.aimAngle + k * (Math.PI / 2);
                this.projectiles.push({
                  x: e.x + Math.cos(a) * 9,
                  y: e.y + Math.sin(a) * 9,
                  vx: Math.cos(a) * 165,
                  vy: Math.sin(a) * 165,
                  fromPlayer: false,
                  damage: 20,
                  color: '#fb923c',
                  radius: 4.5,
                  life: 1.4,
                });
              }
            }
            e.aiTimer = (isS4 ? 1.5 : 1.65) + Math.random() * 0.4;
            e.moveDirX = -e.moveDirX;
          }
        } else {
          const desiredDist = isS4 ? 136 : 118;
          const radial = dist < desiredDist - 20 ? -56 : dist > desiredDist + 24 ? 42 : 0;
          e.vx = nx * radial - ny * 32 * e.moveDirX;
          e.vy = ny * radial + nx * 32 * e.moveDirX;
          e.aimAngle = Math.atan2(dy, dx);
          e.aiTimer -= dt;
          if (e.aiTimer <= 0) e.telegraphTimer = 0.58;
        }
      } else if (e.kind === 'ember_stalker' || e.kind === 'void_wraith') {
        // Phasing assassin: blinks near player with burst & fires 5-way shadow/ember spread!
        const isS4 = e.kind === 'void_wraith';
        const col = isS4 ? '#38e8d4' : '#f97316';
        if (e.telegraphTimer > 0) {
          e.vx *= 0.15;
          e.vy *= 0.15;
          e.telegraphTimer -= dt;
          if (e.telegraphTimer <= 0) {
            const ang = Math.random() * Math.PI * 2;
            const bx = Math.max(ROOM_LEFT + 22, Math.min(ROOM_RIGHT - 22, this.playerX + Math.cos(ang) * 72));
            const by = Math.max(ROOM_TOP + 22, Math.min(ROOM_BOTTOM - 22, this.playerY + Math.sin(ang) * 62));
            if (!this.collidesRoomObstacle(bx, by, 10) && !this.collidesRoomChasm(bx, by, 8)) {
              this.spawnBurst(e.x, e.y, col, 10);
              e.x = bx;
              e.y = by;
            }
            sound.playWarp();
            this.spawnBurst(e.x, e.y, col, 12);
            const aim = Math.atan2(this.playerY - e.y, this.playerX - e.x);
            const shots = isS4 ? 5 : 3;
            for (let k = 0; k < shots; k++) {
              const a = aim + (k - (shots - 1) / 2) * 0.24;
              this.projectiles.push({
                x: e.x,
                y: e.y,
                vx: Math.cos(a) * (isS4 ? 172 : 162),
                vy: Math.sin(a) * (isS4 ? 172 : 162),
                fromPlayer: false,
                damage: isS4 ? 22 : 18,
                color: k % 2 === 0 ? col : '#fde047',
                radius: 3.6,
                life: 1.35,
              });
            }
            e.aiTimer = (isS4 ? 1.35 : 1.5) + Math.random() * 0.4;
          }
        } else {
          e.vx = (nx + ny * 0.45 * e.moveDirX) * 64;
          e.vy = (ny - nx * 0.45 * e.moveDirX) * 64;
          e.aiTimer -= dt;
          if (e.aiTimer <= 0) {
            e.telegraphTimer = 0.42;
            e.moveDirX = -e.moveDirX;
          }
        }
      } else if (e.kind === 'forge_golem' || e.kind === 'monolith_guard') {
        // Heavy Floor III Elite Sentinel: rotating barrier + radial 8-way magma/starlight shockwave!
        const isS4 = e.kind === 'monolith_guard';
        const colA = isS4 ? '#fde047' : '#f97316';
        const colB = isS4 ? '#38e8d4' : '#ef4444';
        e.aimAngle += dt * 1.9;
        e.vx = nx * 34 - ny * 18 * e.moveDirX;
        e.vy = ny * 34 + nx * 18 * e.moveDirX;
        if (e.telegraphTimer > 0) {
          e.vx *= 0.2;
          e.vy *= 0.2;
          e.telegraphTimer -= dt;
          if (e.telegraphTimer <= 0) {
            sound.playBossSlam();
            this.shockwaves.push({
              x: e.x,
              y: e.y,
              maxRadius: 74,
              color: colA,
              life: 0.32,
              maxLife: 0.32,
            });
            for (let k = 0; k < 8; k++) {
              const a = e.aimAngle + k * (Math.PI / 4);
              this.projectiles.push({
                x: e.x + Math.cos(a) * 10,
                y: e.y + Math.sin(a) * 10,
                vx: Math.cos(a) * (isS4 ? 155 : 142),
                vy: Math.sin(a) * (isS4 ? 155 : 142),
                fromPlayer: false,
                damage: isS4 ? 23 : 20,
                color: k % 2 === 0 ? colA : colB,
                radius: 4.0,
                life: 1.45,
              });
            }
            e.aiTimer = 1.7 + Math.random() * 0.4;
          }
        } else {
          e.aiTimer -= dt;
          if (e.aiTimer <= 0) e.telegraphTimer = 0.5;
        }
      } else if (e.kind === 'boss_quartz_golem' || e.kind === 'boss_slag_overlord' || e.kind === 'boss_monolith_colossus') {
        this.updateQuartzGolemAI(e, dt, dx, dy, nx, ny);
      } else if (e.kind === 'boss_prism_weaver' || e.kind === 'boss_forge_warden' || e.kind === 'boss_chrono_sentinel') {
        this.updatePrismWeaverAI(e, dt, dx, dy, nx, ny);
      } else if (
        e.kind === 'boss_prisma_archon' ||
        e.kind === 'boss_vulkan_titan' ||
        e.kind === 'boss_star_archon' ||
        e.kind === 'boss_omega_archon'
      ) {
        this.updatePrismaArchonAI(e, dt, dx, dy);
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
      const hovers =
        e.kind === 'drone' ||
        e.kind === 'drone_arc' ||
        e.kind === 'shield_drone' ||
        e.kind === 'prism_drone' ||
        e.kind === 'resonance_warden' ||
        e.kind === 'solar_drone' ||
        e.kind === 'chrono_eye' ||
        e.kind === 'void_wraith' ||
        e.kind === 'monolith_guard' ||
        e.kind === 'boss_prism_weaver' ||
        e.kind === 'boss_prisma_archon' ||
        e.kind === 'boss_forge_warden' ||
        e.kind === 'boss_vulkan_titan' ||
        e.kind === 'boss_chrono_sentinel' ||
        e.kind === 'boss_star_archon' ||
        e.kind === 'boss_omega_archon' ||
        airborne;

      if (e.kind !== 'boss_leviathan') {
        const ex = Math.max(ROOM_LEFT + e.radius, Math.min(ROOM_RIGHT - e.radius, e.x + e.vx * dt));
        if (
          (!this.collidesRoomObstacle(ex, e.y, e.radius * 0.85) &&
            !this.collidesRoomChasm(ex, e.y, e.radius * 0.7)) ||
          hovers
        ) {
          e.x = ex;
        } else if (e.kind === 'turret' || e.kind === 'spore_spitter') {
          e.moveDirX = -e.moveDirX;
        }
        const ey = Math.max(ROOM_TOP + e.radius, Math.min(ROOM_BOTTOM - e.radius, e.y + e.vy * dt));
        if (
          (!this.collidesRoomObstacle(e.x, ey, e.radius * 0.85) &&
            !this.collidesRoomChasm(e.x, ey, e.radius * 0.7)) ||
          hovers
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

  // ==================== SECTOR 2 FLOOR I BOSS: QUARZ-KOLOSS MK-I ====================
  private updateQuartzGolemAI(e: Enemy, dt: number, dx: number, dy: number, nx: number, ny: number): void {
    const enraged = e.hp <= e.maxHp * 0.5;
    if (enraged && !e.bossPhase2) {
      e.bossPhase2 = true;
      sound.playBossRoar();
      this.triggerShake(0.35, 4.2);
      this.shockwaves.push({ x: e.x, y: e.y, maxRadius: 82, color: '#c084fc', life: 0.36, maxLife: 0.36 });
      this.spawnBurst(e.x, e.y, '#e879f9', 22);
      this.callbacks.onToast('⚠ Quarz-Koloss MK-I geht in Kristall-Resonanz!', 'warn');
    }

    const state: BossState = e.bossState ?? 's2_idle';
    e.bossStateTimer = (e.bossStateTimer ?? 0) - dt;
    e.aimAngle = Math.atan2(dy, dx);

    if (state === 's2_idle') {
      const spd = enraged ? 54 : 40;
      e.vx = nx * spd;
      e.vy = ny * spd;
      if (e.bossStateTimer <= 0) {
        e.phase = (e.phase + 1) % 3;
        if (e.phase === 0 || e.phase === 2) {
          e.bossState = 's2_slam_windup';
          e.bossStateTimer = enraged ? 0.48 : 0.62;
          e.bossStateMax = e.bossStateTimer;
          e.bossStatusText = 'KRISTALL-BEBEN';
        } else {
          e.bossState = 's2_prism_grid';
          e.bossStateTimer = enraged ? 0.52 : 0.68;
          e.bossStateMax = e.bossStateTimer;
          e.bossStatusText = 'QUARZ-SALVE';
        }
      }
    } else if (state === 's2_slam_windup') {
      e.vx *= 0.2;
      e.vy *= 0.2;
      if (e.bossStateTimer <= 0) {
        sound.playBossSlam();
        this.triggerShake(0.3, 4.6);
        const radius = enraged ? 92 : 76;
        this.shockwaves.push({ x: e.x, y: e.y, maxRadius: radius, color: '#c084fc', life: 0.38, maxLife: 0.38 });
        this.spawnBurst(e.x, e.y, '#fde047', 18);
        const count = enraged ? 10 : 8;
        for (let k = 0; k < count; k++) {
          const a = e.aimAngle + (k / count) * Math.PI * 2;
          this.projectiles.push({
            x: e.x + Math.cos(a) * 14,
            y: e.y + Math.sin(a) * 14,
            vx: Math.cos(a) * (enraged ? 156 : 134),
            vy: Math.sin(a) * (enraged ? 156 : 134),
            fromPlayer: false,
            damage: 17,
            color: k % 2 === 0 ? '#c084fc' : '#fde047',
            radius: 4.0,
            life: 1.55,
          });
        }
        if (Math.hypot(dx, dy) < radius * 0.72) {
          this.damagePlayer(18, nx, ny);
        }
        e.bossState = 's2_idle';
        e.bossStateTimer = enraged ? 0.78 : 1.05;
        e.bossStateMax = e.bossStateTimer;
        e.bossStatusText = enraged ? 'RESONANZ II' : 'QUARZ-KERN AKTIV';
      }
    } else if (state === 's2_prism_grid') {
      e.vx *= 0.25;
      e.vy *= 0.25;
      if (e.bossStateTimer <= 0) {
        sound.playBlaster();
        const fan = enraged ? 5 : 3;
        const spread = 0.22;
        for (let k = -Math.floor(fan / 2); k <= Math.floor(fan / 2); k++) {
          const a = e.aimAngle + k * spread;
          this.projectiles.push({
            x: e.x + Math.cos(a) * 14,
            y: e.y + Math.sin(a) * 14,
            vx: Math.cos(a) * 185,
            vy: Math.sin(a) * 185,
            fromPlayer: false,
            damage: 16,
            color: '#38e8d4',
            radius: 4.2,
            life: 1.45,
          });
        }
        e.bossState = 's2_idle';
        e.bossStateTimer = enraged ? 0.72 : 0.96;
        e.bossStateMax = e.bossStateTimer;
        e.bossStatusText = enraged ? 'RESONANZ II' : 'QUARZ-KERN AKTIV';
      }
    }
  }

  // ==================== SECTOR 2 FLOOR II BOSS: PRISMA-WEBERIN ====================
  private updatePrismWeaverAI(e: Enemy, dt: number, dx: number, dy: number, nx: number, ny: number): void {
    const enraged = e.hp <= e.maxHp * 0.5;
    if (enraged && !e.bossPhase2) {
      e.bossPhase2 = true;
      sound.playBossRoar();
      this.triggerShake(0.35, 4.5);
      this.shockwaves.push({ x: e.x, y: e.y, maxRadius: 88, color: '#e879f9', life: 0.38, maxLife: 0.38 });
      this.spawnBurst(e.x, e.y, '#38e8d4', 24);
      this.callbacks.onToast('⚠ Prisma-Weberin entfesselt das Hyper-Prisma-Netz!', 'warn');
    }

    const state: BossState = e.bossState ?? 's2_idle';
    e.bossStateTimer = (e.bossStateTimer ?? 0) - dt;
    e.bossOrbitAngle = (e.bossOrbitAngle ?? 0) + dt * (enraged ? 2.6 : 1.8);
    e.aimAngle = Math.atan2(dy, dx);

    if (state === 's2_idle') {
      e.vx = -ny * (enraged ? 58 : 42) * e.moveDirX + nx * 16;
      e.vy = nx * (enraged ? 58 : 42) * e.moveDirX + ny * 16;
      if (e.bossStateTimer <= 0) {
        e.phase = (e.phase + 1) % 2;
        if (e.phase === 0) {
          // Pick one of 4 arena corners for telegraphed blink!
          const corners = [
            { x: ROOM_LEFT + 54, y: ROOM_TOP + 42 },
            { x: ROOM_RIGHT - 54, y: ROOM_TOP + 42 },
            { x: ROOM_LEFT + 54, y: ROOM_BOTTOM - 42 },
            { x: ROOM_RIGHT - 54, y: ROOM_BOTTOM - 42 },
          ];
          const c = corners[Math.floor(Math.random() * corners.length)];
          e.bossTargetX = c.x;
          e.bossTargetY = c.y;
          e.bossState = 's2_blink_windup';
          e.bossStateTimer = enraged ? 0.45 : 0.6;
          e.bossStateMax = e.bossStateTimer;
          e.bossStatusText = 'PHASEN-SPRUNG';
        } else {
          e.bossState = 's2_prism_grid';
          e.bossStateTimer = enraged ? 0.55 : 0.72;
          e.bossStateMax = e.bossStateTimer;
          e.bossStatusText = 'LASER-GITTER';
        }
      }
    } else if (state === 's2_blink_windup') {
      e.vx *= 0.15;
      e.vy *= 0.15;
      if (e.bossStateTimer <= 0) {
        this.spawnBurst(e.x, e.y, '#e879f9', 14);
        e.x = e.bossTargetX ?? ROOM_CENTER_X;
        e.y = e.bossTargetY ?? ROOM_CENTER_Y;
        this.spawnBurst(e.x, e.y, '#38e8d4', 18);
        sound.playBossLaser();
        // Fire aimed triple crystal orb volley right on arrival!
        const aim = Math.atan2(this.playerY - e.y, this.playerX - e.x);
        for (let k = -1; k <= 1; k++) {
          const a = aim + k * 0.24;
          this.projectiles.push({
            x: e.x + Math.cos(a) * 12,
            y: e.y + Math.sin(a) * 12,
            vx: Math.cos(a) * (enraged ? 198 : 168),
            vy: Math.sin(a) * (enraged ? 198 : 168),
            fromPlayer: false,
            damage: 17,
            color: k === 0 ? '#f472b6' : '#38e8d4',
            radius: 4.1,
            life: 1.5,
          });
        }
        e.moveDirX = -e.moveDirX;
        e.bossState = 's2_idle';
        e.bossStateTimer = enraged ? 0.7 : 0.95;
        e.bossStateMax = e.bossStateTimer;
        e.bossStatusText = enraged ? 'HYPER-NETZ' : 'PRISMA-NETZ AKTIV';
      }
    } else if (state === 's2_prism_grid') {
      e.vx *= 0.2;
      e.vy *= 0.2;
      if (e.bossStateTimer <= 0) {
        sound.playBlaster();
        const count = enraged ? 12 : 8;
        const base = e.bossOrbitAngle ?? 0;
        for (let k = 0; k < count; k++) {
          const a = base + (k / count) * Math.PI * 2;
          this.projectiles.push({
            x: e.x + Math.cos(a) * 12,
            y: e.y + Math.sin(a) * 12,
            vx: Math.cos(a) * (enraged ? 155 : 132),
            vy: Math.sin(a) * (enraged ? 155 : 132),
            fromPlayer: false,
            damage: 16,
            color: k % 2 === 0 ? '#e879f9' : '#38e8d4',
            radius: 3.8,
            life: 1.65,
          });
        }
        e.bossState = 's2_idle';
        e.bossStateTimer = enraged ? 0.68 : 0.92;
        e.bossStateMax = e.bossStateTimer;
        e.bossStatusText = enraged ? 'HYPER-NETZ' : 'PRISMA-NETZ AKTIV';
      }
    }
  }

  // ==================== SECTOR 2 ENDBOSS: ★ PRISMA-ARCHON ====================
  private updatePrismaArchonAI(e: Enemy, dt: number, dx: number, dy: number): void {
    const enraged = e.hp <= e.maxHp * 0.5;
    if (enraged && !e.bossPhase2) {
      e.bossPhase2 = true;
      sound.playBossRoar();
      this.triggerShake(0.55, 6.0);
      this.shockwaves.push({ x: e.x, y: e.y, maxRadius: 130, color: '#e879f9', life: 0.48, maxLife: 0.48 });
      this.spawnBurst(e.x, e.y, '#fde047', 32);
      this.callbacks.onToast('🚨 PRISMA-ARCHON PHASE II — ZERSPLITTERTER NOVA-STURM!', 'warn');
      if (e.summonThreshold > 0) {
        e.summonThreshold = 0;
        this.spawnEnemy('prism_drone', ROOM_CENTER_X - 88, ROOM_TOP + 54);
        this.spawnEnemy('prism_drone', ROOM_CENTER_X + 88, ROOM_TOP + 54);
      }
    }

    const state: BossState = e.bossState ?? 's2_idle';
    e.bossStateTimer = (e.bossStateTimer ?? 0) - dt;
    e.bossOrbitAngle = (e.bossOrbitAngle ?? 0) + dt * (enraged ? 2.4 : 1.5);
    e.aimAngle = Math.atan2(dy, dx);

    if (state === 's2_idle') {
      // Majestic floating figure-eight glide across upper-mid arena
      const tx = ROOM_CENTER_X + Math.sin(this.time * 0.9) * 84;
      const ty = ROOM_TOP + 56 + Math.sin(this.time * 1.8) * 18;
      e.vx = (tx - e.x) * 2.2;
      e.vy = (ty - e.y) * 2.2;

      if (e.bossStateTimer <= 0) {
        e.phase = (e.phase + 1) % 3;
        if (e.phase === 0) {
          e.bossState = 's2_beam_windup';
          e.bossStateTimer = enraged ? 0.62 : 0.78;
          e.bossStateMax = e.bossStateTimer;
          e.bossLaserAngle = Math.atan2(dy, dx);
          e.bossLaserDir = Math.random() < 0.5 ? 1 : -1;
          e.bossLaserTick = 0;
          e.bossStatusText = 'ZWILLINGS-PRISMASTRAHL';
        } else if (e.phase === 1) {
          e.bossState = 's2_prism_grid';
          e.bossStateTimer = enraged ? 0.55 : 0.72;
          e.bossStateMax = e.bossStateTimer;
          e.bossStatusText = 'KRISTALL-LANZEN';
        } else {
          e.bossState = 's2_nova_storm';
          e.bossStateTimer = enraged ? 2.1 : 1.45;
          e.bossStateMax = e.bossStateTimer;
          e.burstDelay = 0.12;
          e.bossStatusText = enraged ? 'NOVA-STURM II' : 'PRISMA-NOVA';
        }
      }
    } else if (state === 's2_beam_windup') {
      e.vx *= 0.2;
      e.vy *= 0.2;
      if (e.bossStateTimer <= 0) {
        sound.playBossLaser();
        this.triggerShake(0.25, 3.8);
        e.bossState = 's2_twin_sweep';
        e.bossStateTimer = enraged ? 1.55 : 1.3;
        e.bossStateMax = e.bossStateTimer;
      }
    } else if (state === 's2_twin_sweep') {
      e.vx *= 0.15;
      e.vy *= 0.15;
      const prog = 1 - Math.max(0, (e.bossStateTimer ?? 0) / Math.max(0.01, e.bossStateMax ?? 1));
      const base = e.bossLaserAngle ?? Math.PI / 2;
      const spread = 0.85 - prog * 0.72; // twin beams sweep inward like converging wings!
      e.bossLaserTick = (e.bossLaserTick ?? 0) - dt;
      if (e.bossLaserTick <= 0) {
        e.bossLaserTick = 0.11;
        const angles = [base - spread, base + spread];
        for (const a of angles) {
          const ex = e.x + Math.cos(a) * 260;
          const ey = e.y + Math.sin(a) * 260;
          if (this.pointToSegmentDist(this.playerX, this.playerY, e.x, e.y, ex, ey) < 11) {
            this.damagePlayer(18, Math.cos(a), Math.sin(a));
          }
        }
      }
      if (e.bossStateTimer <= 0) {
        e.bossState = 's2_idle';
        e.bossStateTimer = enraged ? 0.72 : 0.95;
        e.bossStateMax = e.bossStateTimer;
        e.bossStatusText = enraged ? 'PHASE II · ARCHON' : 'PRISMA-ARCHON AKTIV';
      }
    } else if (state === 's2_prism_grid') {
      e.vx *= 0.2;
      e.vy *= 0.2;
      if (e.bossStateTimer <= 0) {
        sound.playBlaster();
        const count = enraged ? 12 : 8;
        const aim = Math.atan2(dy, dx);
        for (let k = 0; k < count; k++) {
          const a = aim + (k / count) * Math.PI * 2;
          this.projectiles.push({
            x: e.x + Math.cos(a) * 16,
            y: e.y + Math.sin(a) * 16,
            vx: Math.cos(a) * (enraged ? 172 : 148),
            vy: Math.sin(a) * (enraged ? 172 : 148),
            fromPlayer: false,
            damage: 18,
            color: k % 3 === 0 ? '#fde047' : k % 2 === 0 ? '#e879f9' : '#38e8d4',
            radius: 4.2,
            life: 1.75,
          });
        }
        e.bossState = 's2_idle';
        e.bossStateTimer = enraged ? 0.65 : 0.88;
        e.bossStateMax = e.bossStateTimer;
        e.bossStatusText = enraged ? 'PHASE II · ARCHON' : 'PRISMA-ARCHON AKTIV';
      }
    } else if (state === 's2_nova_storm') {
      const tx = ROOM_CENTER_X;
      const ty = ROOM_CENTER_Y - 22;
      e.vx = (tx - e.x) * 2.5;
      e.vy = (ty - e.y) * 2.5;
      e.burstDelay -= dt;
      if (e.burstDelay <= 0) {
        e.burstDelay = enraged ? 0.16 : 0.22;
        const arms = enraged ? 4 : 3;
        const base = (e.bossOrbitAngle ?? 0) * 1.4;
        for (let k = 0; k < arms; k++) {
          const a = base + (k / arms) * Math.PI * 2;
          this.projectiles.push({
            x: e.x + Math.cos(a) * 14,
            y: e.y + Math.sin(a) * 14,
            vx: Math.cos(a) * 145,
            vy: Math.sin(a) * 145,
            fromPlayer: false,
            damage: 16,
            color: k % 2 === 0 ? '#f472b6' : '#fde047',
            radius: 3.9,
            life: 1.7,
          });
        }
      }
      if (e.bossStateTimer <= 0) {
        e.bossState = 's2_idle';
        e.bossStateTimer = enraged ? 0.78 : 1.05;
        e.bossStateMax = e.bossStateTimer;
        e.bossStatusText = enraged ? 'PHASE II · ARCHON' : 'PRISMA-ARCHON AKTIV';
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
    // Shield-Drone & Resonance-Warden kinetic/crystal barriers reduce non-piercing hits along their shield arc!
    let finalAmt = amount;
    if ((e.kind === 'shield_drone' || e.kind === 'resonance_warden') && !piercing) {
      const fromAngle = Math.atan2(-ky, -kx);
      const diff = Math.abs(this.normalizeAngle(fromAngle - e.aimAngle));
      const arcLimit = e.kind === 'resonance_warden' ? 0.95 : 1.08;
      if (diff <= arcLimit) {
        finalAmt = Math.max(2, Math.round(amount * (e.kind === 'resonance_warden' ? 0.45 : 0.35)));
        sound.playShieldBlock();
        this.spawnBurst(
          e.x + Math.cos(e.aimAngle) * 12,
          e.y + Math.sin(e.aimAngle) * 12,
          e.kind === 'resonance_warden' ? '#c084fc' : '#38e8d4',
          8,
        );
        this.floats.push({
          x: e.x,
          y: e.y - e.radius - 10,
          text: e.kind === 'resonance_warden' ? `BARRIERE -${finalAmt}` : `SCHILD -${finalAmt}`,
          color: e.kind === 'resonance_warden' ? '#e879f9' : '#67e8f9',
          life: 0.6,
          maxLife: 0.6,
        });
        e.hp -= finalAmt;
        e.flashTimer = 0.08;
        e.vx += kx * knockForce * 0.25;
        e.vy += ky * knockForce * 0.25;
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
        : e.kind === 'boss_prisma_archon'
          ? 0.06
          : this.isBossKind(e.kind)
            ? 0.12
            : e.kind === 'turret' || e.kind === 'shield_drone' || e.kind === 'resonance_warden'
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
    const sec = this.currentSector;

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
        this.spawnLootDrop(e.x, e.y, rollLootItem(2, k === 0, nightBoost, luckBonus, 1));
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
        this.spawnLootDrop(e.x, e.y, rollLootItem(3, k === 0, nightBoost, luckBonus, 1));
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
      this.state.recordSectorClear(1, this.runElapsedSec);
      // Drop Leviathan Omega Core + 4 rare/epic relics in center of arena!
      const dropY = ROOM_CENTER_Y - 12;
      this.spawnLootDrop(ROOM_CENTER_X, dropY, 'leviathan_core');
      this.spawnLootDrop(ROOM_CENTER_X - 18, dropY + 4, 'aegis_plate');
      for (let k = 0; k < 3; k++) {
        this.spawnLootDrop(
          ROOM_CENTER_X + (k - 1) * 16,
          dropY + 8,
          rollLootItem(3, true, nightBoost, luckBonus, 1),
        );
      }
      this.callbacks.onToast(
        '★ SEKTOR 1 BEZWUNGEN! A.E.G.I.S. LEVIATHAN zerstört! Sektor-2-Schlüssel & Dock II im Raumhafen freigeschaltet!',
        'good',
      );
      this.state.save();
    } else if (e.kind === 'boss_quartz_golem') {
      this.triggerShake(0.48, 5.2);
      this.shockwaves.push({
        x: e.x,
        y: e.y,
        maxRadius: 96,
        color: '#c084fc',
        life: 0.44,
        maxLife: 0.44,
      });
      this.floorBossDefeated = true;
      this.state.bossDefeatedCount += 1;
      this.spawnLootDrop(e.x, e.y, 'amethyst_core');
      this.spawnLootDrop(e.x + 10, e.y, 'prism_matrix');
      for (let k = 0; k < 2; k++) {
        this.spawnLootDrop(e.x, e.y, rollLootItem(2, k === 0, nightBoost, luckBonus, 2));
      }
      this.callbacks.onToast(
        'SIEG! Quarz-Koloss MK-I zersplittert! Links: Extraktion · Rechts: Tiefen-Aufzug → Ebene II (Resonanz-Ader)!',
        'good',
      );
      this.state.save();
    } else if (e.kind === 'boss_prism_weaver') {
      this.triggerShake(0.52, 5.6);
      this.shockwaves.push({
        x: e.x,
        y: e.y,
        maxRadius: 108,
        color: '#e879f9',
        life: 0.46,
        maxLife: 0.46,
      });
      this.floorBossDefeated = true;
      this.state.bossDefeatedCount += 1;
      this.spawnLootDrop(e.x, e.y, 'prism_matrix');
      this.spawnLootDrop(e.x - 10, e.y, 'resonance_tuning');
      for (let k = 0; k < 2; k++) {
        this.spawnLootDrop(e.x, e.y, rollLootItem(3, k === 0, nightBoost, luckBonus, 2));
      }
      this.callbacks.onToast(
        'SIEG! Prisma-Weberin besiegt! Links: Extraktion · Rechts: Tiefen-Aufzug → Ebene III (★ PRISMA-ARCHON)!',
        'good',
      );
      this.state.save();
    } else if (e.kind === 'boss_prisma_archon') {
      this.triggerShake(0.75, 7.2);
      this.shockwaves.push({
        x: e.x,
        y: e.y,
        maxRadius: 155,
        color: '#e879f9',
        life: 0.62,
        maxLife: 0.62,
      });
      this.spawnBurst(e.x, e.y, '#e879f9', 36);
      this.spawnBurst(e.x, e.y, '#fde047', 26);
      this.floorBossDefeated = true;
      this.state.bossDefeatedCount += 1;
      this.state.sector2Cleared = true;
      this.sector2ClearedInRun = true;
      this.state.recordSectorClear(2, this.runElapsedSec);
      // Clear any remaining Prism-Drone escorts when Archon falls!
      for (let j = this.enemies.length - 1; j >= 0; j--) {
        if (!this.isBossKind(this.enemies[j].kind)) {
          this.spawnBurst(this.enemies[j].x, this.enemies[j].y, '#c084fc', 10);
          this.enemies.splice(j, 1);
        }
      }
      const dropY = ROOM_CENTER_Y - 10;
      this.spawnLootDrop(ROOM_CENTER_X, dropY, 'archon_heart');
      this.spawnLootDrop(ROOM_CENTER_X - 18, dropY + 4, 'prism_matrix');
      for (let k = 0; k < 3; k++) {
        this.spawnLootDrop(
          ROOM_CENTER_X + (k - 1) * 16,
          dropY + 8,
          rollLootItem(3, true, nightBoost, luckBonus, 2),
        );
      }
      this.callbacks.onToast(
        '★ SEKTOR 2 BEZWUNGEN! PRISMA-ARCHON zerstört! Sektor-3-Schlüssel, Archon-Herz & Siegel #2 freigeschaltet!',
        'good',
      );
      this.state.checkAchievements(false);
      this.state.save();
    } else if (e.kind === 'boss_slag_overlord') {
      this.triggerShake(0.48, 5.2);
      this.shockwaves.push({ x: e.x, y: e.y, maxRadius: 96, color: '#f97316', life: 0.44, maxLife: 0.44 });
      this.floorBossDefeated = true;
      this.state.bossDefeatedCount += 1;
      this.spawnLootDrop(e.x, e.y, 'forge_ingot');
      this.spawnLootDrop(e.x + 10, e.y, 'pyro_lens');
      for (let k = 0; k < 2; k++) this.spawnLootDrop(e.x, e.y, rollLootItem(2, k === 0, nightBoost, luckBonus, 3));
      this.callbacks.onToast('SIEG! Schlacken-Koloss geschmolzen! Links: Extraktion · Rechts: Tiefen-Aufzug → Ebene II (Schmelz-Trakt)!', 'good');
      this.state.save();
    } else if (e.kind === 'boss_forge_warden') {
      this.triggerShake(0.52, 5.6);
      this.shockwaves.push({ x: e.x, y: e.y, maxRadius: 108, color: '#fb923c', life: 0.46, maxLife: 0.46 });
      this.floorBossDefeated = true;
      this.state.bossDefeatedCount += 1;
      this.spawnLootDrop(e.x, e.y, 'solar_core');
      this.spawnLootDrop(e.x - 10, e.y, 'foundry_gear');
      for (let k = 0; k < 2; k++) this.spawnLootDrop(e.x, e.y, rollLootItem(3, k === 0, nightBoost, luckBonus, 3));
      this.callbacks.onToast('SIEG! Gießerei-Meister besiegt! Links: Extraktion · Rechts: Tiefen-Aufzug → Ebene III (★ VULKAN-TITAN)!', 'good');
      this.state.save();
    } else if (e.kind === 'boss_vulkan_titan') {
      this.triggerShake(0.75, 7.2);
      this.shockwaves.push({ x: e.x, y: e.y, maxRadius: 158, color: '#f97316', life: 0.62, maxLife: 0.62 });
      this.spawnBurst(e.x, e.y, '#f97316', 36);
      this.spawnBurst(e.x, e.y, '#fde047', 26);
      this.floorBossDefeated = true;
      this.state.bossDefeatedCount += 1;
      this.state.sector3Cleared = true;
      this.sector3ClearedInRun = true;
      this.state.recordSectorClear(3, this.runElapsedSec);
      for (let j = this.enemies.length - 1; j >= 0; j--) {
        if (!this.isBossKind(this.enemies[j].kind)) this.enemies.splice(j, 1);
      }
      const dropY = ROOM_CENTER_Y - 10;
      this.spawnLootDrop(ROOM_CENTER_X, dropY, 'vulkan_heart');
      this.spawnLootDrop(ROOM_CENTER_X - 18, dropY + 4, 'solar_core');
      for (let k = 0; k < 3; k++) {
        this.spawnLootDrop(ROOM_CENTER_X + (k - 1) * 16, dropY + 8, rollLootItem(3, true, nightBoost, luckBonus, 3));
      }
      this.callbacks.onToast(
        '🔥 SEKTOR 3 BEZWUNGEN! ★ VULKAN-TITAN zerstört! Sektor-4-Schlüssel (Dock IV), Siegel #3 & Vulkan-Gold-Anzug freigeschaltet!',
        'good',
      );
      this.state.checkAchievements(false);
      this.state.save();
    } else if (e.kind === 'boss_chrono_sentinel') {
      this.triggerShake(0.48, 5.2);
      this.shockwaves.push({ x: e.x, y: e.y, maxRadius: 96, color: '#38e8d4', life: 0.44, maxLife: 0.44 });
      this.floorBossDefeated = true;
      this.state.bossDefeatedCount += 1;
      this.spawnLootDrop(e.x, e.y, 'monolith_key');
      this.spawnLootDrop(e.x + 10, e.y, 'star_lens');
      for (let k = 0; k < 2; k++) this.spawnLootDrop(e.x, e.y, rollLootItem(2, k === 0, nightBoost, luckBonus, 4));
      this.callbacks.onToast('SIEG! Chrono-Wächter gebrochen! Links: Extraktion · Rechts: Tiefen-Aufzug → Ebene II (Astral-Bibliothek)!', 'good');
      this.state.save();
    } else if (e.kind === 'boss_monolith_colossus') {
      this.triggerShake(0.55, 5.8);
      this.shockwaves.push({ x: e.x, y: e.y, maxRadius: 112, color: '#fde047', life: 0.46, maxLife: 0.46 });
      this.floorBossDefeated = true;
      this.state.bossDefeatedCount += 1;
      this.spawnLootDrop(e.x, e.y, 'celestial_matrix');
      this.spawnLootDrop(e.x - 10, e.y, 'monolith_key');
      for (let k = 0; k < 2; k++) this.spawnLootDrop(e.x, e.y, rollLootItem(3, k === 0, nightBoost, luckBonus, 4));
      this.callbacks.onToast('SIEG! Monolith-Koloss besiegt! Links: Extraktion · Rechts: Tiefen-Aufzug → Ebene III (★ DER STERNEN-ARCHON)!', 'good');
      this.state.save();
    } else if (e.kind === 'boss_star_archon') {
      this.triggerShake(0.8, 7.5);
      this.shockwaves.push({ x: e.x, y: e.y, maxRadius: 162, color: '#fde047', life: 0.65, maxLife: 0.65 });
      this.spawnBurst(e.x, e.y, '#38e8d4', 36);
      this.spawnBurst(e.x, e.y, '#fde047', 34);
      this.floorBossDefeated = true;
      this.state.bossDefeatedCount += 1;
      this.state.sector4Cleared = true;
      this.sector4ClearedInRun = true;
      this.state.recordSectorClear(4, this.runElapsedSec);
      for (let j = this.enemies.length - 1; j >= 0; j--) {
        if (!this.isBossKind(this.enemies[j].kind)) this.enemies.splice(j, 1);
      }
      const dropY = ROOM_CENTER_Y - 10;
      this.spawnLootDrop(ROOM_CENTER_X, dropY, 'archon_crown');
      this.spawnLootDrop(ROOM_CENTER_X - 18, dropY + 4, 'celestial_matrix');
      for (let k = 0; k < 3; k++) {
        this.spawnLootDrop(ROOM_CENTER_X + (k - 1) * 16, dropY + 8, rollLootItem(3, true, nightBoost, luckBonus, 4));
      }
      this.callbacks.onToast(
        '👑 SEKTOR 4 BEZWUNGEN! ★ DER STERNEN-ARCHON besiegt! ALLE 4 SIEGEL GLÜHEN — Das 5. Tiefenraum-Tor im Raumhafen steht offen!',
        'good',
      );
      this.state.checkAchievements(false);
      this.state.save();
    } else if (e.kind === 'boss_omega_archon') {
      this.triggerShake(0.9, 8.2);
      this.shockwaves.push({ x: e.x, y: e.y, maxRadius: 175, color: '#fde047', life: 0.72, maxLife: 0.72 });
      this.spawnBurst(e.x, e.y, '#fde047', 48);
      this.spawnBurst(e.x, e.y, '#38e8d4', 38);
      this.floorBossDefeated = true;
      this.state.bossDefeatedCount += 1;
      this.state.omegaCleared = true;
      this.omegaClearedInRun = true;
      this.state.recordSectorClear(5, this.runElapsedSec);
      for (let j = this.enemies.length - 1; j >= 0; j--) {
        if (!this.isBossKind(this.enemies[j].kind)) this.enemies.splice(j, 1);
      }
      const dropY = ROOM_CENTER_Y - 10;
      this.spawnLootDrop(ROOM_CENTER_X, dropY, 'archon_crown');
      this.spawnLootDrop(ROOM_CENTER_X - 18, dropY + 4, 'vulkan_heart');
      this.spawnLootDrop(ROOM_CENTER_X + 18, dropY + 4, 'archon_heart');
      this.spawnLootDrop(ROOM_CENTER_X, dropY + 12, 'celestial_matrix');
      this.callbacks.onToast(
        '🌌 OMEGA-ANOMALIE BEZWUNGEN! ★ STORY-FINALE VOLLENDET! Omega-Anzug & New Game+ im Logbuch freigeschaltet!',
        'good',
      );
      this.state.checkAchievements(false);
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
      } else if (e.kind === 'void_crawler') {
        // Void-Crawler death crystal shatter: 4 amethyst-cyan shards!
        this.spawnBurst(e.x, e.y, '#e879f9', 14);
        for (let k = 0; k < 4; k++) {
          const a = k * (Math.PI / 2);
          this.projectiles.push({
            x: e.x,
            y: e.y,
            vx: Math.cos(a) * 124,
            vy: Math.sin(a) * 124,
            fromPlayer: false,
            damage: 14,
            color: k % 2 === 0 ? '#e879f9' : '#38e8d4',
            radius: 3.6,
            life: 0.92,
          });
        }
      }
      if (Math.random() < 0.84) {
        this.spawnLootDrop(e.x, e.y, rollLootItem(lootDepth, false, nightBoost, luckBonus, sec));
        if (this.state.equippedCompanion === 'puck' && Math.random() < 0.25) {
          this.spawnLootDrop(e.x + 6, e.y - 4, rollLootItem(lootDepth, false, nightBoost, luckBonus, sec));
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
          rollLootItem(lootDepth, false, nightBoost, luckBonus, sec),
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
    this.spawnBurst(pod.x, pod.y, this.currentSector === 2 ? '#c084fc' : '#fbbf24', 10);
    if (Math.random() < 0.7) {
      this.spawnLootDrop(
        pod.x,
        pod.y,
        rollLootItem(
          this.currentRoom.depth + (this.currentFloor - 1),
          false,
          this.state.timeOfDay === 'night',
          this.state.getStats().lootLuckBonus,
          this.currentSector,
        ),
      );
    }
  }

  private spawnLootDrop(x: number, y: number, itemId: string): void {
    let sx = x;
    let sy = y;
    if (this.collidesRoomChasm(sx, sy, 6) || this.collidesRoomObstacle(sx, sy, 6)) {
      sx = this.lastSafeX;
      sy = this.lastSafeY;
    }
    const a = Math.random() * Math.PI * 2;
    const sp = 24 + Math.random() * 34;
    this.drops.push({
      x: sx,
      y: sy,
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

    if (this.currentRoom.type === 'secret') {
      const rx = ROOM_CENTER_X;
      const ry = ROOM_BOTTOM - 28;
      if (Math.hypot(this.playerX - rx, this.playerY - ry) < 28) {
        this.activePrompt = {
          label: '[E] Grav-Seil: Zurück nach oben',
          x: rx,
          y: ry - 22,
        };
        if (input.interactPressed()) {
          this.exitSecretRoom();
        }
        return;
      }
    }

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
            this.callbacks.onToast(
              this.currentSector === 5
                ? 'Notfall-Medstation genutzt — bereit für ★ OMEGA STERNEN-ARCHON!'
                : this.currentSector === 4
                  ? 'Notfall-Medstation genutzt — bereit für ★ DER STERNEN-ARCHON!'
                  : this.currentSector === 3
                    ? 'Notfall-Medstation genutzt — bereit für ★ VULKAN-TITAN!'
                    : this.currentSector === 2
                      ? 'Notfall-Medstation genutzt — bereit für ★ PRISMA-ARCHON!'
                      : 'Notfall-Medstation genutzt — bereit für A.E.G.I.S. LEVIATHAN!',
              'good',
            );
            this.callbacks.onHudDirty();
          }
          return;
        }
      }
    }

    if (this.currentRoom.type === 'boss' && this.floorBossDefeated) {
      if (this.currentFloor < 3 && this.currentSector !== 5) {
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
          const elevLabel =
            this.currentSector === 4
              ? nextFloor === 2
                ? '[E] Tiefen-Aufzug → Ebene II (Astral-Bibliothek)'
                : '[E] Tiefen-Aufzug → Ebene III (Thron der Ältesten)'
              : this.currentSector === 3
                ? nextFloor === 2
                  ? '[E] Tiefen-Aufzug → Ebene II (Schmelz-Trakt)'
                  : '[E] Tiefen-Aufzug → Ebene III (Herz der Sonne)'
                : this.currentSector === 2
                  ? nextFloor === 2
                    ? '[E] Tiefen-Aufzug → Ebene II (Resonanz-Ader)'
                    : '[E] Tiefen-Aufzug → Ebene III (Herz des Nebels)'
                  : nextFloor === 2
                    ? '[E] Tiefen-Aufzug → Ebene II (Maschinen-Deck)'
                    : '[E] Tiefen-Aufzug → Ebene III (Reaktor-Kern)';
          this.activePrompt = {
            label: elevLabel,
            x: elX - 10,
            y: padY - 24,
          };
          if (input.interactPressed()) {
            sound.playWarp();
            this.startFloor(nextFloor, false, this.currentSector);
          }
          return;
        }
      } else {
        const vx = ROOM_CENTER_X;
        const vy = ROOM_CENTER_Y + 12;
        if (Math.hypot(this.playerX - vx, this.playerY - vy) < 32) {
          this.activePrompt = {
            label:
              this.currentSector === 5
                ? '[E] 🌌 OMEGA-FINALE VOLLENDET! Zurück nach Port Solaris'
                : this.currentSector === 4
                  ? '[E] 👑 Sektor-4-Sieg! 5. Omega-Tor im Raumhafen aktiv!'
                  : this.currentSector === 3
                    ? '[E] 🔥 Sektor-3-Sieg! Raumhafen Port Solaris (S4-Schlüssel)'
                    : this.currentSector === 2
                      ? '[E] ★ Sektor-2-Sieg! Raumhafen Port Solaris (S3-Schlüssel)'
                      : '[E] ★ Sektor-1-Sieg! Raumhafen Port Solaris (S2-Schlüssel)',
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
        const chestTitle = chest.secret ? '★ Geheime Schatztruhe' : 'Relikt-Truhe';
        this.activePrompt = {
          label: !chest.opened
            ? `[E] ${chestTitle} öffnen`
            : remaining > 0
              ? `[E] ${chestTitle} durchsuchen (${remaining} übrig)`
              : `[E] ${chestTitle} (Leer · Ablegen möglich)`,
          x: chest.x,
          y: chest.y - 20,
        };
        if (input.interactPressed()) {
          if (!chest.opened) {
            chest.opened = true;
            if (chest.secret) sound.playSecretChime();
            else sound.playUpgrade();
            const nightBoost = this.state.timeOfDay === 'night';
            const luckBonus = this.state.getStats().lootLuckBonus;
            const d = Math.min(3, 1 + this.currentFloor);
            const sec = this.currentSector;
            const slots: Array<{ itemId: string; qty: number } | null> = new Array(8).fill(null);
            const guaranteedSecret =
              sec >= 4
                ? Math.random() < 0.5
                  ? 'celestial_matrix'
                  : 'monolith_key'
                : sec === 3
                  ? Math.random() < 0.5
                    ? 'solar_core'
                    : 'forge_ingot'
                  : sec === 2
                    ? Math.random() < 0.5
                      ? 'prism_matrix'
                      : 'amethyst_core'
                    : Math.random() < 0.5
                      ? 'aegis_plate'
                      : 'reactor_shard';
            const rolled: string[] = chest.secret
              ? [
                  guaranteedSecret,
                  rollLootItem(3, true, true, luckBonus + 0.25, sec),
                  rollLootItem(3, true, true, luckBonus + 0.2, sec),
                  rollLootItem(Math.min(3, d + 1), true, nightBoost, luckBonus + 0.15, sec),
                  rollLootItem(d, true, nightBoost, luckBonus, sec),
                ]
              : [
                  rollLootItem(d, true, nightBoost, luckBonus, sec),
                  rollLootItem(d, true, nightBoost, luckBonus, sec),
                  rollLootItem(d, false, nightBoost, luckBonus, sec),
                  rollLootItem(d, Math.random() < 0.55, nightBoost, luckBonus, sec),
                ];
            if (this.state.equippedCompanion === 'puck' && Math.random() < 0.25) {
              rolled.push(rollLootItem(d, true, nightBoost, luckBonus, sec));
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
            this.spawnBurst(
              chest.x,
              chest.y,
              chest.secret ? '#fde047' : sec === 3 ? '#f97316' : sec === 2 ? '#e879f9' : '#fbbf24',
              chest.secret ? 28 : 20,
            );
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
    this.state.checkAchievements(false);
    this.state.save();
    this.callbacks.onReturnToHub({
      victory: true,
      reason,
      sector: this.currentSector,
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
      runDurationSec: Math.max(1, Math.round(this.runElapsedSec)),
      sector1Cleared: this.sector1ClearedInRun,
      sector2Cleared: this.sector2ClearedInRun,
      sector3Cleared: this.sector3ClearedInRun,
      sector4Cleared: this.sector4ClearedInRun,
      omegaCleared: this.omegaClearedInRun,
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
      sector: this.currentSector,
      roomsCleared: this.roomsCleared,
      enemiesDefeated: this.enemiesDefeated,
      itemsSaved: res.itemsSaved,
      itemsLost: res.itemsLost,
      warpedToChest: res.warpedToChest,
      shatteredItems: res.shatteredItems,
      nightRun: this.state.timeOfDay === 'night',
      floorReached: this.maxFloorReached,
      runDurationSec: Math.max(1, Math.round(this.runElapsedSec)),
      sector1Cleared: false,
      sector2Cleared: false,
      sector3Cleared: false,
      sector4Cleared: false,
      omegaCleared: false,
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

    const roomBg =
      this.currentSector >= 4
        ? art.dungeonBgS4 ?? art.dungeonBg
        : this.currentSector === 3
          ? art.dungeonBgS3 ?? art.dungeonBg
          : this.currentSector === 2
            ? art.dungeonBgS2 ?? art.dungeonBg
            : art.dungeonBg;
    if (roomBg) {
      ctx.drawImage(roomBg, 0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    } else {
      ctx.fillStyle =
        this.currentSector >= 4
          ? '#0d1522'
          : this.currentSector === 3
            ? '#22100a'
            : this.currentSector === 2
              ? '#150d28'
              : '#0e131f';
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    }

    // Distinct Sector & Floor I / II / III Atmospheric Tints + Cosmic Night Ambience!
    if (this.currentSector === 5) {
      ctx.fillStyle = 'rgba(250, 204, 21, 0.08)';
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    } else if (this.currentSector === 4) {
      if (this.currentFloor === 2) {
        ctx.fillStyle = 'rgba(14, 48, 66, 0.16)';
        ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
      } else if (this.currentFloor === 3) {
        ctx.fillStyle = 'rgba(66, 48, 12, 0.16)';
        ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
      }
    } else if (this.currentSector === 3) {
      if (this.currentFloor === 2) {
        ctx.fillStyle = 'rgba(66, 22, 8, 0.15)';
        ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
      } else if (this.currentFloor === 3) {
        ctx.fillStyle = 'rgba(84, 18, 10, 0.2)';
        ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
      }
    } else if (this.currentSector === 2) {
      if (this.currentFloor === 2) {
        ctx.fillStyle = 'rgba(26, 18, 62, 0.16)';
        ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
      } else if (this.currentFloor === 3) {
        ctx.fillStyle = 'rgba(58, 12, 68, 0.19)';
        ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
      }
    } else if (this.currentFloor === 2) {
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

    // Subterranean Moonlighter Secret Vault ambiance & Grav-Rope exit shaft!
    if (this.currentRoom.type === 'secret') {
      this.renderSecretVaultOverlay(ctx);
    }

    // Integrated Abyssal Chasms & Pits (including subtle sparkling Secret Pit!)
    if (this.currentRoom.chasms && this.currentRoom.chasms.length > 0) {
      this.renderChasms(ctx);
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
      ctx.strokeStyle = active ? (this.currentSector === 2 ? '#e879f9' : '#fb923c') : warning ? '#fbbf24' : '#334155';
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
        const ventGlow = this.currentSector === 2 ? '#e879f9' : '#38e8d4';
        drawGlow(ctx, h.x, h.y - 4, h.r * 1.9, ventGlow, 0.48);
        ctx.fillStyle = this.currentSector === 2 ? 'rgba(232, 121, 249, 0.55)' : 'rgba(56, 232, 212, 0.55)';
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

    // Ambient bioluminescent spores / shimmering crystal motes in Sector 2!
    for (let s = 0; s < 12; s++) {
      const sx = ROOM_LEFT + ((s * 73 + this.currentRoom.tileSeed) % (ROOM_RIGHT - ROOM_LEFT));
      const sy =
        ROOM_TOP +
        ((s * 47 + Math.floor(this.time * 8) + this.currentRoom.tileSeed) % (ROOM_BOTTOM - ROOM_TOP));
      const a = 0.25 + 0.45 * Math.sin(this.time * 2.5 + s);
      ctx.fillStyle =
        this.currentSector === 2
          ? s % 3 === 0
            ? `rgba(232, 121, 249, ${Math.max(0, a)})`
            : s % 2 === 0
              ? `rgba(56, 232, 212, ${Math.max(0, a)})`
              : `rgba(253, 224, 71, ${Math.max(0, a * 0.85)})`
          : this.currentFloor === 3
            ? `rgba(251, 146, 60, ${Math.max(0, a)})`
            : this.currentFloor === 2
              ? `rgba(52, 211, 153, ${Math.max(0, a)})`
              : `rgba(56, 232, 212, ${Math.max(0, a)})`;
      ctx.fillRect(sx + Math.sin(this.time + s) * 4, sy, 1.5, 1.5);
    }

    this.renderDoors(ctx);

    if (this.currentRoom.type === 'start') {
      this.renderWarpPad(ctx, ROOM_CENTER_X, ROOM_CENTER_Y - 12, this.currentSector === 2 ? '#c084fc' : '#38e8d4');
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
        this.renderWarpPad(ctx, ROOM_CENTER_X + 48, padY, this.currentSector === 2 ? '#e879f9' : '#fbbf24');
        ctx.font = 'bold 5px Silkscreen, monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#67e8f9';
        ctx.fillText('EXTRAKTION', ROOM_CENTER_X - 48, padY + 22);
        ctx.fillStyle = this.currentSector === 2 ? '#f0abfc' : '#fde047';
        ctx.fillText(this.currentFloor === 1 ? '▼ EBENE II' : '▼ EBENE III', ROOM_CENTER_X + 48, padY + 22);
      } else {
        const vy = ROOM_CENTER_Y + 12;
        const winColor = this.currentSector === 2 ? '#e879f9' : '#fde047';
        this.renderWarpPad(ctx, ROOM_CENTER_X, vy, winColor);
        ctx.font = 'bold 5.2px Silkscreen, monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = winColor;
        ctx.fillText(this.currentSector === 2 ? '★ SEKTOR-2 SIEG!' : '★ SEKTOR-1 SIEG!', ROOM_CENTER_X, vy + 22);
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
      if ((e.kind === 'drone' || e.kind === 'shard_sniper') && e.telegraphTimer > 0) {
        const isSniper = e.kind === 'shard_sniper';
        const locked = isSniper && e.telegraphTimer <= 0.26;
        ctx.save();
        ctx.strokeStyle = isSniper
          ? locked
            ? '#ffffff'
            : `rgba(244, 114, 182, ${0.55 + 0.4 * Math.sin(this.time * 42)})`
          : `rgba(251, 113, 133, ${0.4 + 0.4 * Math.sin(this.time * 36)})`;
        ctx.lineWidth = isSniper ? (locked ? 2.1 : 1.5) : 1.2;
        if (!locked) ctx.setLineDash(isSniper ? [6, 3] : [4, 3]);
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        const len = isSniper ? 260 : 145;
        ctx.lineTo(e.x + Math.cos(e.aimAngle) * len, e.y + Math.sin(e.aimAngle) * len);
        ctx.stroke();
        ctx.restore();
      } else if (e.kind === 'boss_quartz_golem' && e.bossState === 's2_slam_windup') {
        const prog = 1 - Math.max(0, (e.bossStateTimer ?? 0) / Math.max(0.01, e.bossStateMax ?? 0.6));
        const r = (e.bossPhase2 ? 92 : 76) * 0.72;
        ctx.save();
        ctx.strokeStyle = `rgba(192, 132, 252, ${0.4 + prog * 0.55})`;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(e.x, e.y, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = `rgba(192, 132, 252, ${0.08 + prog * 0.22})`;
        ctx.beginPath();
        ctx.arc(e.x, e.y, r * prog, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (e.kind === 'boss_prism_weaver' && e.bossState === 's2_blink_windup') {
        const tx = e.bossTargetX ?? ROOM_CENTER_X;
        const ty = e.bossTargetY ?? ROOM_CENTER_Y;
        const prog = 1 - Math.max(0, (e.bossStateTimer ?? 0) / Math.max(0.01, e.bossStateMax ?? 0.6));
        ctx.save();
        ctx.strokeStyle = `rgba(232, 121, 249, ${0.5 + prog * 0.45})`;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(tx, ty, 20 - prog * 8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        ctx.restore();
        drawGlow(ctx, tx, ty, 24, '#e879f9', 0.35 + prog * 0.25);
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

    // Active Boss Sweeping Reactor & Prism Laser Beams (Core-Wächter, Leviathan & ★ Prisma-Archon!)
    for (const e of this.enemies) {
      if (e.kind === 'boss' && e.bossState === 'laser_sweep') {
        this.renderBossLaserBeam(ctx, e);
      } else if (e.kind === 'boss_leviathan' && (e.bossState === 'lev_twin_windup' || e.bossState === 'lev_twin_beam')) {
        this.renderLeviathanTwinBeams(ctx, e);
      } else if (
        (e.kind === 'boss_prisma_archon' ||
          e.kind === 'boss_vulkan_titan' ||
          e.kind === 'boss_star_archon' ||
          e.kind === 'boss_omega_archon') &&
        (e.bossState === 's2_beam_windup' || e.bossState === 's2_twin_sweep')
      ) {
        this.renderPrismaArchonTwinBeams(ctx, e);
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

  private renderSecretVaultOverlay(ctx: CanvasRenderingContext2D): void {
    const isS2 = this.currentSector === 2;
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 3.4);
    const accent = isS2 ? '#e879f9' : '#fde047';

    // Moody subterranean chamber vignette
    ctx.save();
    ctx.fillStyle = isS2 ? 'rgba(10, 4, 24, 0.34)' : 'rgba(6, 10, 22, 0.36)';
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

    // Etched ancient floor sanctuary rune circle around the Secret Treasure Chest
    const cx = ROOM_CENTER_X;
    const cy = ROOM_CENTER_Y - 12;
    ctx.strokeStyle = isS2
      ? `rgba(232, 121, 249, ${0.32 + pulse * 0.18})`
      : `rgba(253, 224, 71, ${0.32 + pulse * 0.18})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 42, 28, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx, cy, 32, 21, 0, 0, Math.PI * 2);
    ctx.stroke();
    drawGlow(ctx, cx, cy, 52, accent, 0.22 + pulse * 0.08);

    // Glowing Grav-Rope Return Pad & focused escape light shaft (cleanly below the chest!)
    const rx = ROOM_CENTER_X;
    const ry = ROOM_BOTTOM - 28;
    this.renderWarpPad(ctx, rx, ry, '#38e8d4');
    const shaftTop = ry - 36;
    const shaftGrad = ctx.createLinearGradient(rx, ry, rx, shaftTop);
    shaftGrad.addColorStop(0, 'rgba(56, 232, 212, 0.34)');
    shaftGrad.addColorStop(0.65, 'rgba(56, 232, 212, 0.14)');
    shaftGrad.addColorStop(1, 'rgba(56, 232, 212, 0)');
    ctx.fillStyle = shaftGrad;
    ctx.fillRect(rx - 7, shaftTop, 14, ry - shaftTop);

    // Shimmering Grav-Rope tether rising cleanly into the escape beam
    ctx.strokeStyle = 'rgba(165, 243, 252, 0.88)';
    ctx.lineWidth = 1.4;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(rx, ry);
    ctx.lineTo(rx, shaftTop + 4);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.font = 'bold 4.8px Silkscreen, monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#67e8f9';
    ctx.fillText('▲ GRAV-SEIL', rx, ry + 20);
    ctx.fillStyle = accent;
    ctx.fillText('★ GEHEIME SCHATZKAMMER', cx, ROOM_TOP + 14);
    ctx.restore();
  }

  private renderChasms(ctx: CanvasRenderingContext2D): void {
    const isS2 = this.currentSector === 2;
    const isS3 = this.currentSector === 3;
    const isS4 = this.currentSector >= 4;
    for (let idx = 0; idx < this.currentRoom.chasms.length; idx++) {
      const ch = this.currentRoom.chasms[idx];
      const { x, y, w, h } = ch;
      const cliffH = Math.min(12, Math.max(7, Math.floor(h * 0.34)));

      ctx.save();
      // 1. Integrated beveled floor rim matching sector architecture
      ctx.fillStyle = isS4 ? '#080e18' : isS3 ? '#1f0c08' : isS2 ? '#120b24' : '#0f1624';
      ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
      ctx.fillStyle = isS4 ? '#2c3d52' : isS3 ? '#5c2c1c' : isS2 ? '#3d2c6e' : '#3d4f69';
      ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
      ctx.fillStyle = isS4 ? '#162233' : isS3 ? '#331710' : isS2 ? '#231845' : '#1f2a3d';
      ctx.fillRect(x - 1, y - 1, w + 2, h + 2);

      // Subtle rim highlight along bottom & right lip catching overhead room light
      ctx.fillStyle = isS4 ? '#d4af37' : isS3 ? '#c2410c' : isS2 ? '#6d4db5' : '#617999';
      ctx.fillRect(x - 1, y + h + 1, w + 2, 1);
      ctx.fillRect(x + w + 1, y - 1, 1, h + 2);

      // Corner inlays themed per sector
      if (isS4) {
        ctx.fillStyle = '#fde047';
        ctx.fillRect(x - 2, y - 2, 3, 2);
        ctx.fillRect(x + w - 1, y + h, 3, 2);
        ctx.fillStyle = '#38e8d4';
        ctx.fillRect(x + w - 1, y - 2, 3, 2);
        ctx.fillRect(x - 2, y + h, 3, 2);
      } else if (isS3) {
        ctx.fillStyle = '#f97316';
        ctx.fillRect(x - 2, y - 2, 4, 2);
        ctx.fillRect(x + w - 2, y - 2, 4, 2);
        ctx.fillRect(x - 2, y + h, 4, 2);
        ctx.fillRect(x + w - 2, y + h, 4, 2);
      } else if (isS2) {
        ctx.fillStyle = '#a855f7';
        ctx.fillRect(x - 2, y - 2, 3, 2);
        ctx.fillRect(x + w - 1, y + h, 3, 2);
        ctx.fillStyle = '#38e8d4';
        ctx.fillRect(x + w - 1, y - 2, 3, 2);
        ctx.fillRect(x - 2, y + h, 3, 2);
      } else {
        ctx.fillStyle = '#d97706';
        ctx.fillRect(x - 2, y - 2, 4, 2);
        ctx.fillRect(x + w - 2, y - 2, 4, 2);
        ctx.fillRect(x - 2, y + h, 4, 2);
        ctx.fillRect(x + w - 2, y + h, 4, 2);
      }

      // 2. Deep abyssal / molten void interior
      ctx.fillStyle = isS4 ? '#040812' : isS3 ? '#1a0604' : isS2 ? '#070314' : '#050812';
      ctx.fillRect(x, y, w, h);

      // Sector 3 deep molten lava shimmer at the bottom of the foundry pit!
      if (isS3) {
        const lavaPulse = 0.25 + 0.14 * Math.sin(this.time * 2.4 + idx);
        const lavaGrad = ctx.createLinearGradient(x, y + cliffH, x, y + h);
        lavaGrad.addColorStop(0, 'rgba(234, 88, 12, 0.08)');
        lavaGrad.addColorStop(1, `rgba(249, 115, 22, ${lavaPulse})`);
        ctx.fillStyle = lavaGrad;
        ctx.fillRect(x, y + cliffH, w, Math.max(2, h - cliffH));
      }

      // 3. 3D North Vertical Cliff Face
      const cliffGrad = ctx.createLinearGradient(x, y, x, y + cliffH);
      if (isS4) {
        cliffGrad.addColorStop(0, '#1e2c40');
        cliffGrad.addColorStop(0.6, '#0d1522');
        cliffGrad.addColorStop(1, '#040812');
      } else if (isS3) {
        cliffGrad.addColorStop(0, '#472116');
        cliffGrad.addColorStop(0.6, '#260f09');
        cliffGrad.addColorStop(1, '#1a0604');
      } else if (isS2) {
        cliffGrad.addColorStop(0, '#27194f');
        cliffGrad.addColorStop(0.6, '#140c2e');
        cliffGrad.addColorStop(1, '#070314');
      } else {
        cliffGrad.addColorStop(0, '#232f42');
        cliffGrad.addColorStop(0.6, '#121a28');
        cliffGrad.addColorStop(1, '#050812');
      }
      ctx.fillStyle = cliffGrad;
      ctx.fillRect(x, y, w, cliffH);

      ctx.fillStyle = isS4
        ? 'rgba(18, 28, 42, 0.72)'
        : isS3
          ? 'rgba(54, 22, 14, 0.72)'
          : isS2
            ? 'rgba(34, 21, 68, 0.72)'
            : 'rgba(24, 34, 52, 0.72)';
      ctx.fillRect(x, y, 3, h);
      ctx.fillRect(x + w - 3, y, 3, h);

      for (let fx = x + 10; fx < x + w - 10; fx += 20) {
        const notchW = 4 + ((fx + idx * 3) % 4);
        ctx.fillStyle = isS4 ? '#223348' : isS3 ? '#4c2317' : isS2 ? '#362663' : '#35465e';
        ctx.fillRect(fx, y - 1, notchW, 2);
        ctx.fillStyle = isS4 ? '#354c68' : isS3 ? '#7c341d' : isS2 ? '#4c3685' : '#4a5f7d';
        ctx.fillRect(fx + 5, y + h - 1, notchW - 1, 2);
      }

      if (isS4) {
        // Golden celestial glyph pillars along the obsidian cliff wall
        for (let sx = x + 8; sx < x + w - 6; sx += 16) {
          ctx.fillStyle = '#334155';
          ctx.fillRect(sx, y, 3, cliffH - 1);
          ctx.fillStyle = '#ca8a04';
          ctx.fillRect(sx + 1, y + 1, 1, Math.max(2, cliffH - 3));
        }
      } else if (isS3) {
        // Molten glowing furnace vents along the slag shaft
        for (let sx = x + 8; sx < x + w - 6; sx += 16) {
          ctx.fillStyle = '#3f1d14';
          ctx.fillRect(sx, y, 3, cliffH - 1);
          ctx.fillStyle = '#f97316';
          ctx.fillRect(sx + 1, y + 2, 1, Math.max(2, cliffH - 4));
        }
      } else if (isS2) {
        for (let sx = x + 6; sx < x + w - 6; sx += 14) {
          const stH = 4 + ((sx * 7 + idx * 5) % 6);
          ctx.fillStyle = (sx + idx) % 2 === 0 ? '#5b21b6' : '#0e7490';
          ctx.fillRect(sx, y, 3, stH);
          ctx.fillStyle = (sx + idx) % 2 === 0 ? '#c084fc' : '#38e8d4';
          ctx.fillRect(sx + 1, y, 1, Math.max(2, stH - 2));
        }
      } else {
        for (let sx = x + 8; sx < x + w - 6; sx += 16) {
          ctx.fillStyle = '#334155';
          ctx.fillRect(sx, y, 3, cliffH - 1);
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(sx + 1, y + 2, 1, cliffH - 3);
        }
        ctx.fillStyle = '#1e3a4c';
        ctx.fillRect(x + 2, y + 3, w - 4, 2);
      }

      // Faint deep-space stars / glowing embers far below
      const starCount = Math.max(2, Math.floor((w * h) / 720));
      for (let s = 0; s < starCount; s++) {
        const seed = (idx + 1) * 97 + s * 53 + this.currentRoom.tileSeed;
        const px = x + 5 + (seed % Math.max(4, w - 10));
        const py = y + cliffH + 2 + ((seed * 3) % Math.max(4, h - cliffH - 5));
        const a = 0.14 + 0.18 * Math.sin(this.time * 1.8 + s * 2.1 + idx);
        ctx.fillStyle = isS4
          ? `rgba(253, 224, 71, ${Math.max(0.05, a)})`
          : isS3
            ? `rgba(251, 146, 60, ${Math.max(0.08, a * 1.4)})`
            : isS2
              ? `rgba(192, 132, 252, ${Math.max(0.04, a)})`
              : `rgba(148, 163, 184, ${Math.max(0.04, a)})`;
        ctx.fillRect(px, py, 1, 1);
      }

      // 4. MOONLIGHTER SECRET SPARKLING PIT TELL!
      if (ch.secret) {
        const cx = x + w * 0.5;
        const cy = y + cliffH + (h - cliffH) * 0.55;
        if (ch.secretVisited) {
          const p = 0.35 + 0.25 * Math.sin(this.time * 3.2);
          ctx.strokeStyle = `rgba(253, 224, 71, ${p})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(cx, cy - 4);
          ctx.lineTo(cx + 4, cy);
          ctx.lineTo(cx, cy + 4);
          ctx.lineTo(cx - 4, cy);
          ctx.closePath();
          ctx.stroke();
        } else {
          const cycle = (this.time + idx * 0.7) % 3.4;
          if (cycle < 0.72) {
            const flash = Math.sin((cycle / 0.72) * Math.PI);
            const alpha = flash * 0.56;
            const ox = Math.sin(Math.floor(this.time / 3.4) * 1.9) * Math.min(10, w * 0.18);
            const sx = cx + ox;
            const sy = cy;
            ctx.fillStyle = `rgba(254, 240, 138, ${alpha})`;
            ctx.fillRect(sx - 2.5, sy - 0.5, 5, 1);
            ctx.fillRect(sx - 0.5, sy - 2.5, 1, 5);
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 1.1})`;
            ctx.fillRect(sx - 0.7, sy - 0.7, 1.4, 1.4);
            drawGlow(ctx, sx, sy, 9, '#fde047', alpha * 0.28);
          }
        }
      }
      ctx.restore();
    }
  }

  private renderObstacle(ctx: CanvasRenderingContext2D, ob: DungeonRoom['obstacles'][number]): void {
    const atlas = getAtlas();
    const isS2 = this.currentSector === 2;
    const isS3 = this.currentSector === 3;
    const isS4 = this.currentSector >= 4;
    const { x, y, w, h } = ob;

    if (ob.kind === 'crate') {
      drawPixelShadow(ctx, x + w / 2, y + h + 1, w / 2, 3, 0.42);
      ctx.drawImage(atlas.props.crate, x, y, w, h);
      return;
    }

    if (ob.kind === 'forge_pillar') {
      // Sector 3 Heavy Cast-Iron & Glowing Magma Foundry Pillar!
      ctx.fillStyle = 'rgba(12, 4, 2, 0.78)';
      ctx.fillRect(x - 2, y + 3, w + 4, h + 1);
      ctx.fillStyle = '#29120c';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#472116';
      ctx.fillRect(x + 1, y + 1, w - 2, h - 4);
      ctx.fillStyle = '#6e3421';
      ctx.fillRect(x + 2, y + 1, w - 4, 4);
      // Molten magma core slit
      ctx.fillStyle = '#f97316';
      ctx.fillRect(x + 4, y + Math.floor(h / 2) - 2, w - 8, 4);
      ctx.fillStyle = '#fde047';
      ctx.fillRect(x + 6, y + Math.floor(h / 2) - 1, w - 12, 2);
      drawGlow(ctx, x + w / 2, y + h / 2, 18, '#f97316', 0.28);
      return;
    }

    if (ob.kind === 'monolith_obelisk') {
      // Sector 4/5 Gilded Obsidian Celestial Obelisk with glowing cyan-gold Elder Rune!
      ctx.fillStyle = 'rgba(4, 8, 18, 0.8)';
      ctx.fillRect(x - 2, y + 3, w + 4, h + 1);
      ctx.fillStyle = '#0e1726';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#1b2a40';
      ctx.fillRect(x + 1, y + 1, w - 2, h - 4);
      // Gold trim bevel
      ctx.fillStyle = '#ca8a04';
      ctx.fillRect(x + 1, y + 1, w - 2, 2);
      ctx.fillRect(x + 1, y + h - 5, w - 2, 1.5);
      // Glowing cyan celestial rune diamond
      const cx = x + w / 2;
      const cy = y + h / 2 - 1;
      ctx.fillStyle = '#38e8d4';
      ctx.fillRect(cx - 2.5, cy - 1, 5, 2);
      ctx.fillRect(cx - 1, cy - 2.5, 2, 5);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cx - 0.8, cy - 0.8, 1.6, 1.6);
      drawGlow(ctx, cx, cy, 18, '#38e8d4', 0.26);
      return;
    }

    if (ob.kind === 'crystal_spire' || (isS2 && ob.kind === 'pillar')) {
      const cx = Math.round(x + w * 0.5);
      const by = Math.round(y + h);
      drawPixelShadow(ctx, cx, by - 1, w * 0.56, 4.5, 0.56);

      ctx.fillStyle = '#120a26';
      ctx.fillRect(cx - 11, by - 9, 22, 8);
      ctx.fillRect(cx - 9, by - 11, 18, 11);
      ctx.fillStyle = '#261a4a';
      ctx.fillRect(cx - 10, by - 8, 20, 6);
      ctx.fillRect(cx - 8, by - 10, 16, 8);
      ctx.fillStyle = '#3a296e';
      ctx.fillRect(cx - 8, by - 9, 14, 3);

      const drawPixelCrystal = (
        px: number,
        baseY: number,
        cw: number,
        ch: number,
        dark: string,
        mid: string,
        bright: string,
      ) => {
        const half = Math.floor(cw / 2);
        ctx.fillStyle = '#120a26';
        ctx.fillRect(px - half - 1, baseY - ch + 3, cw + 2, ch - 2);
        ctx.fillRect(px - Math.max(1, half - 1) - 1, baseY - ch + 1, Math.max(2, cw - 2) + 2, 3);
        ctx.fillRect(px - 1, baseY - ch - 1, 2, 3);
        ctx.fillStyle = dark;
        ctx.fillRect(px - half, baseY - ch + 3, cw, ch - 3);
        ctx.fillRect(px - Math.max(1, half - 1), baseY - ch + 1, Math.max(2, cw - 2), 3);
        ctx.fillStyle = mid;
        ctx.fillRect(px - half, baseY - ch + 3, Math.max(1, half), ch - 4);
        ctx.fillRect(px - Math.max(1, half - 1), baseY - ch + 1, Math.max(1, half - 1), 2);
        ctx.fillStyle = bright;
        ctx.fillRect(px - Math.max(0, half - 1), baseY - ch + 2, 1, Math.max(3, ch - 6));
        ctx.fillRect(px, baseY - ch, 1, 2);
      };

      drawPixelCrystal(cx - 6, by - 6, 6, 13, '#0e7490', '#22d3ee', '#cffafe');
      drawPixelCrystal(cx + 6, by - 6, 6, 11, '#6b21a8', '#a855f7', '#e9d5ff');
      drawPixelCrystal(cx, by - 6, 8, 19, '#581c87', '#c084fc', '#fae8ff');

      ctx.fillStyle = '#38e8d4';
      ctx.fillRect(cx - 5, by - 4, 3, 1);
      ctx.fillStyle = '#e879f9';
      ctx.fillRect(cx + 2, by - 3, 3, 1);
      drawGlow(ctx, cx, by - 12, 20, '#c084fc', 0.24);
      return;
    }

    // Grounded recessed floor contact shadow & architectural flange
    ctx.fillStyle = 'rgba(6, 9, 18, 0.74)';
    ctx.fillRect(x - 2, y + 3, w + 4, h + 1);

    ctx.fillStyle = isS4 ? '#101b2b' : isS3 ? '#2e140d' : isS2 ? '#1a1233' : '#182233';
    ctx.fillRect(x - 1, y + h - 4, w + 2, 5);
    ctx.fillStyle = isS4 ? '#1d2d44' : isS3 ? '#421e14' : isS2 ? '#251a4a' : '#253247';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = isS4 ? '#2d4363' : isS3 ? '#5e2c1d' : isS2 ? '#3c2c70' : '#3c4e69';
    ctx.fillRect(x + 1, y + 1, w - 2, h - 5);
    ctx.fillStyle = isS4 ? '#ca8a04' : isS3 ? '#9a3412' : isS2 ? '#59429e' : '#586f8f';
    ctx.fillRect(x + 2, y + 1, w - 4, 4);
    ctx.fillStyle = isS4 ? '#fde047' : isS3 ? '#fb923c' : isS2 ? '#8064c9' : '#7b95b8';
    ctx.fillRect(x + 3, y + 2, w - 6, 1.2);
    ctx.fillStyle = isS4 ? '#fde047' : isS3 ? '#fdba74' : isS2 ? '#a78bfa' : '#94a3b8';
    ctx.fillRect(x + 3, y + 3, 1.5, 1.5);
    ctx.fillRect(x + w - 4.5, y + 3, 1.5, 1.5);
    ctx.fillRect(x + 3, y + h - 7, 1.5, 1.5);
    ctx.fillRect(x + w - 4.5, y + h - 7, 1.5, 1.5);

    if (ob.kind === 'conduit') {
      const glowCol = isS4 ? '#fde047' : isS3 ? '#f97316' : isS2 ? '#e879f9' : '#38e8d4';
      ctx.fillStyle = isS4 ? '#0f172a' : isS3 ? '#290d06' : isS2 ? '#1b0d30' : '#0d2536';
      ctx.fillRect(x + 4, y + Math.floor(h / 2) - 4, w - 8, 8);
      ctx.fillStyle = glowCol;
      ctx.fillRect(x + 6, y + Math.floor(h / 2) - 2, w - 12, 3.5);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + 8, y + Math.floor(h / 2) - 1, w - 16, 1.2);
      drawGlow(ctx, x + w / 2, y + h / 2, 24, glowCol, 0.34);
    } else if (ob.kind === 'bulkhead_wall') {
      // Integrated starship deck barrier with recessed ventilation louver & amber caution stripe!
      ctx.fillStyle = '#1d283a';
      ctx.fillRect(x + 4, y + 7, w - 8, h - 13);
      ctx.fillStyle = '#2d3c54';
      for (let vy = y + 8; vy < y + h - 7; vy += 3) {
        ctx.fillRect(x + 5, vy, w - 10, 1.2);
      }
      ctx.fillStyle = '#d97706';
      ctx.fillRect(x + 2, y + h - 5, 5, 1.5);
      ctx.fillRect(x + w - 7, y + h - 5, 5, 1.5);
    } else {
      ctx.fillStyle = isS2 ? '#291c52' : '#2b394f';
      ctx.fillRect(x + 5, y + 7, w - 10, h - 13);
      ctx.fillStyle = isS2 ? '#a855f7' : '#38e8d4';
      ctx.fillRect(x + Math.floor(w / 2) - 2, y + Math.floor(h / 2) - 2, 4, 2);
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

  private renderPrismaArchonTwinBeams(ctx: CanvasRenderingContext2D, e: Enemy): void {
    const base = e.bossLaserAngle ?? Math.PI / 2;
    const isWindup = e.bossState === 's2_beam_windup';
    const prog = 1 - Math.max(0, (e.bossStateTimer ?? 0) / Math.max(0.01, e.bossStateMax ?? 1));
    const spread = isWindup ? 0.85 : 0.85 - prog * 0.72;
    const angles = [base - spread, base + spread];

    ctx.save();
    for (const a of angles) {
      const x2 = e.x + Math.cos(a) * 260;
      const y2 = e.y + Math.sin(a) * 260;
      if (isWindup) {
        ctx.strokeStyle = `rgba(232, 121, 249, ${0.4 + 0.45 * Math.sin(this.time * 38)})`;
        ctx.lineWidth = 1.6;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.setLineDash([]);
      } else {
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = 'rgba(192, 132, 252, 0.55)';
        ctx.lineWidth = 11;
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        ctx.strokeStyle = '#e879f9';
        ctx.lineWidth = 5.5;
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.1;
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  private renderQuartzGolemBoss(ctx: CanvasRenderingContext2D, e: Enemy): void {
    const art = getHDArt();
    const enraged = Boolean(e.bossPhase2);
    const hover = Math.sin(this.time * 3.8) * 2.2;
    drawPixelShadow(ctx, e.x, e.y + 16, 20, 6.5, 0.55);
    drawGlow(ctx, e.x, e.y - 2 + hover, 36, enraged ? '#e879f9' : '#c084fc', enraged ? 0.52 : 0.34);

    // Orbiting quartz crystal shards around the colossus
    ctx.save();
    for (let k = 0; k < 4; k++) {
      const a = this.time * (enraged ? 3.2 : 1.9) + k * (Math.PI / 2);
      const ox = e.x + Math.cos(a) * 23;
      const oy = e.y - 2 + Math.sin(a) * 14;
      ctx.fillStyle = k % 2 === 0 ? '#fde047' : '#e879f9';
      ctx.fillRect(ox - 2, oy - 3, 4, 6);
    }
    ctx.restore();

    const spr = e.flashTimer > 0 ? art.resonanceWardenFlash : art.resonanceWarden;
    if (spr) {
      ctx.drawImage(spr, e.x - 23, e.y - 23 + hover, 46, 44);
    }
  }

  private renderPrismWeaverBoss(ctx: CanvasRenderingContext2D, e: Enemy): void {
    const art = getHDArt();
    const enraged = Boolean(e.bossPhase2);
    const hover = Math.sin(this.time * 5.2) * 3.2;
    drawPixelShadow(ctx, e.x, e.y + 15, 17, 5.5, 0.48);
    drawGlow(ctx, e.x, e.y + hover, 34, enraged ? '#f472b6' : '#38e8d4', enraged ? 0.55 : 0.38);

    // Rotating prism laser ring
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = enraged ? '#f472b6' : '#38e8d4';
    ctx.lineWidth = 1.4;
    const base = e.bossOrbitAngle ?? 0;
    for (let k = 0; k < 3; k++) {
      const a = base + k * ((Math.PI * 2) / 3);
      ctx.beginPath();
      ctx.arc(e.x, e.y + hover, 21, a, a + 0.85);
      ctx.stroke();
    }
    ctx.restore();

    const spr = e.flashTimer > 0 ? art.prismDroneFlash : art.prismDrone;
    if (spr) {
      ctx.save();
      if (e.bossState === 's2_blink_windup') {
        ctx.globalAlpha = 0.45 + 0.45 * Math.sin(this.time * 38);
      }
      ctx.drawImage(spr, e.x - 21, e.y - 21 + hover, 42, 42);
      ctx.restore();
    }
  }

  private renderPrismaArchonBoss(ctx: CanvasRenderingContext2D, e: Enemy): void {
    const art = getHDArt();
    const enraged = Boolean(e.bossPhase2);
    const hover = Math.sin(this.time * 3.4) * 3.6;
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 6.0);

    drawPixelShadow(ctx, e.x, e.y + 24, 30, 8.5, 0.55);
    drawGlow(ctx, e.x, e.y - 4 + hover, 56, enraged ? '#f43f5e' : '#c084fc', 0.42 + pulse * 0.16);
    drawGlow(ctx, e.x, e.y - 4 + hover, 28, '#fde047', 0.28 + pulse * 0.12);

    // Radiant rotating celestial prism halo behind the Archon!
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = enraged ? 'rgba(244, 114, 182, 0.72)' : 'rgba(232, 121, 249, 0.62)';
    ctx.lineWidth = 1.6;
    const orbit = e.bossOrbitAngle ?? 0;
    for (let k = 0; k < 4; k++) {
      const a = orbit + k * (Math.PI / 2);
      ctx.beginPath();
      ctx.arc(e.x, e.y - 4 + hover, 34, a, a + 0.72);
      ctx.stroke();
    }
    ctx.restore();

    const spr = e.flashTimer > 0 ? art.bossPrismaArchonFlash : art.bossPrismaArchon;
    if (spr) {
      ctx.drawImage(spr, e.x - 36, e.y - 32 + hover, 72, 60);
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
    if (e.kind === 'boss_quartz_golem') {
      this.renderQuartzGolemBoss(ctx, e);
      return;
    }
    if (e.kind === 'boss_prism_weaver') {
      this.renderPrismWeaverBoss(ctx, e);
      return;
    }
    if (e.kind === 'boss_prisma_archon') {
      this.renderPrismaArchonBoss(ctx, e);
      return;
    }
    if (
      e.kind === 'boss_slag_overlord' ||
      e.kind === 'boss_forge_warden' ||
      e.kind === 'boss_vulkan_titan' ||
      e.kind === 'boss_chrono_sentinel' ||
      e.kind === 'boss_monolith_colossus' ||
      e.kind === 'boss_star_archon' ||
      e.kind === 'boss_omega_archon'
    ) {
      const enraged = Boolean(e.bossPhase2);
      const isS3Boss =
        e.kind === 'boss_slag_overlord' || e.kind === 'boss_forge_warden' || e.kind === 'boss_vulkan_titan';
      const isMajor =
        e.kind === 'boss_vulkan_titan' || e.kind === 'boss_star_archon' || e.kind === 'boss_omega_archon';
      const isOmega = e.kind === 'boss_omega_archon';
      const hover = Math.sin(this.time * 3.2) * (isMajor ? 3.5 : 2.2);
      const pulse = 0.5 + 0.5 * Math.sin(this.time * 6.0);
      const glowA = isOmega ? '#fde047' : isS3Boss ? '#f97316' : '#38e8d4';
      const glowB = isOmega ? '#e879f9' : '#fde047';

      drawPixelShadow(ctx, e.x, e.y + (isMajor ? 24 : 18), isMajor ? 30 : 22, isMajor ? 8.5 : 6.5, 0.56);
      drawGlow(ctx, e.x, e.y - 4 + hover, isMajor ? 58 : 40, enraged ? '#f43f5e' : glowA, 0.44 + pulse * 0.16);
      drawGlow(ctx, e.x, e.y - 4 + hover, isMajor ? 30 : 20, glowB, 0.28 + pulse * 0.12);

      if (isMajor) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = isOmega ? 'rgba(253, 224, 71, 0.85)' : isS3Boss ? 'rgba(251, 146, 60, 0.72)' : 'rgba(56, 232, 212, 0.78)';
        ctx.lineWidth = isOmega ? 2.2 : 1.6;
        const orbit = e.bossOrbitAngle ?? this.time * 1.4;
        for (let k = 0; k < (isOmega ? 6 : 4); k++) {
          const a = orbit + k * ((Math.PI * 2) / (isOmega ? 6 : 4));
          ctx.beginPath();
          ctx.arc(e.x, e.y - 4 + hover, isOmega ? 38 : 34, a, a + 0.65);
          ctx.stroke();
        }
        ctx.restore();
      }

      const spr =
        e.kind === 'boss_vulkan_titan'
          ? e.flashTimer > 0
            ? art.bossVulkanTitanFlash
            : art.bossVulkanTitan
          : e.kind === 'boss_star_archon' || e.kind === 'boss_omega_archon'
            ? e.flashTimer > 0
              ? art.bossStarArchonFlash
              : art.bossStarArchon
            : e.kind === 'boss_slag_overlord'
              ? e.flashTimer > 0
                ? art.forgeGolemFlash
                : art.forgeGolem
              : e.kind === 'boss_forge_warden'
                ? e.flashTimer > 0
                  ? art.emberStalkerFlash
                  : art.emberStalker
                : e.kind === 'boss_chrono_sentinel'
                  ? e.flashTimer > 0
                    ? art.chronoEyeFlash
                    : art.chronoEye
                  : e.flashTimer > 0
                    ? art.monolithGuardFlash
                    : art.monolithGuard;
      if (spr) {
        const w = isOmega ? 78 : isMajor ? 72 : 48;
        const h = isOmega ? 70 : isMajor ? 64 : 48;
        ctx.drawImage(spr, e.x - w / 2, e.y - h / 2 - 4 + hover, w, h);
      }
      return;
    }

    drawPixelShadow(ctx, e.x, e.y + 9, 8.5, 3.2, 0.48);

    // Sector 3 & Sector 4 HD Pixel-Art Enemies!
    const m6SpriteMap: Partial<
      Record<
        Enemy['kind'],
        {
          spr: HTMLCanvasElement | null;
          flash: HTMLCanvasElement | null;
          w: number;
          h: number;
          glow: string;
          hovers?: boolean;
          shield?: boolean;
        }
      >
    > = {
      slag_beetle: { spr: art.slagBeetle, flash: art.slagBeetleFlash, w: 26, h: 24, glow: '#f97316' },
      solar_drone: { spr: art.solarDrone, flash: art.solarDroneFlash, w: 24, h: 24, glow: '#fde047', hovers: true },
      magma_mortar: { spr: art.magmaMortar, flash: art.magmaMortarFlash, w: 26, h: 26, glow: '#fb923c' },
      ember_stalker: { spr: art.emberStalker, flash: art.emberStalkerFlash, w: 25, h: 26, glow: '#f97316' },
      forge_golem: { spr: art.forgeGolem, flash: art.forgeGolemFlash, w: 30, h: 30, glow: '#f97316', shield: true },
      astral_scarab: { spr: art.astralScarab, flash: art.astralScarabFlash, w: 26, h: 24, glow: '#38e8d4' },
      chrono_eye: { spr: art.chronoEye, flash: art.chronoEyeFlash, w: 24, h: 24, glow: '#fde047', hovers: true },
      star_lancer: { spr: art.starLancer, flash: art.starLancerFlash, w: 26, h: 28, glow: '#fde047' },
      void_wraith: { spr: art.voidWraith, flash: art.voidWraithFlash, w: 26, h: 26, glow: '#38e8d4', hovers: true },
      monolith_guard: { spr: art.monolithGuard, flash: art.monolithGuardFlash, w: 30, h: 30, glow: '#fde047', hovers: true, shield: true },
    };
    const m6Def = m6SpriteMap[e.kind];
    if (m6Def) {
      const offY = m6Def.hovers ? Math.sin(this.time * 5.2 + e.id) * 2.5 : -Math.abs(Math.sin(e.anim * 5.6)) * 2.0;
      const spr = e.flashTimer > 0 ? m6Def.flash : m6Def.spr;
      if (spr) {
        ctx.drawImage(spr, e.x - m6Def.w / 2, e.y - m6Def.h / 2 - 2 + offY, m6Def.w, m6Def.h);
      }
      if (m6Def.shield) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = e.telegraphTimer > 0 ? '#fde047' : m6Def.glow;
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.arc(e.x, e.y + offY, 16, e.aimAngle - 0.9, e.aimAngle + 0.9);
        ctx.stroke();
        ctx.restore();
      }
      drawGlow(ctx, e.x, e.y + offY, e.telegraphTimer > 0 ? 22 : 16, m6Def.glow, e.telegraphTimer > 0 ? 0.56 : 0.3);
      this.renderEnemyMiniHp(ctx, e);
      return;
    }

    if (e.kind === 'crystal_crawler') {
      const hop = Math.abs(Math.sin(e.anim * 5.8)) * (e.chargeActive > 0 ? 4.2 : 1.8);
      const spr = e.flashTimer > 0 ? art.crystalCrawlerFlash : art.crystalCrawler;
      if (spr) {
        ctx.drawImage(spr, e.x - 13, e.y - 12 - hop, 26, 22);
      }
      drawGlow(ctx, e.x, e.y, e.telegraphTimer > 0 ? 20 : 15, '#c084fc', e.telegraphTimer > 0 ? 0.55 : 0.28);
      this.renderEnemyMiniHp(ctx, e);
      return;
    }
    if (e.kind === 'prism_drone') {
      const hover = Math.sin(this.time * 6.0 + e.id) * 2.8;
      const spr = e.flashTimer > 0 ? art.prismDroneFlash : art.prismDrone;
      if (spr) {
        ctx.drawImage(spr, e.x - 12, e.y - 13 + hover, 24, 24);
      }
      drawGlow(
        ctx,
        e.x,
        e.y + hover,
        e.telegraphTimer > 0 ? 22 : 16,
        e.telegraphTimer > 0 ? '#e879f9' : '#38e8d4',
        e.telegraphTimer > 0 ? 0.58 : 0.3,
      );
      this.renderEnemyMiniHp(ctx, e);
      return;
    }
    if (e.kind === 'shard_sniper') {
      const spr = e.flashTimer > 0 ? art.shardSniperFlash : art.shardSniper;
      if (spr) {
        ctx.drawImage(spr, e.x - 12, e.y - 16, 24, 27);
      }
      drawGlow(ctx, e.x, e.y - 2, e.telegraphTimer > 0 ? 22 : 15, '#f472b6', e.telegraphTimer > 0 ? 0.58 : 0.28);
      this.renderEnemyMiniHp(ctx, e);
      return;
    }
    if (e.kind === 'void_crawler') {
      const hop = Math.abs(Math.sin(e.anim * 6.6)) * (e.chargeActive > 0 ? 4.8 : 2.2);
      const spr = e.flashTimer > 0 ? art.voidCrawlerFlash : art.voidCrawler;
      if (spr) {
        ctx.drawImage(spr, e.x - 13, e.y - 12 - hop, 26, 22);
      }
      drawGlow(
        ctx,
        e.x,
        e.y,
        e.chargeActive > 0 ? 22 : 16,
        e.chargeActive > 0 ? '#38e8d4' : '#e879f9',
        e.chargeActive > 0 ? 0.55 : 0.32,
      );
      this.renderEnemyMiniHp(ctx, e);
      return;
    }
    if (e.kind === 'resonance_warden') {
      const hover = Math.sin(this.time * 4.5 + e.id) * 2.4;
      const spr = e.flashTimer > 0 ? art.resonanceWardenFlash : art.resonanceWarden;
      if (spr) {
        ctx.drawImage(spr, e.x - 14, e.y - 16 + hover, 28, 28);
      }
      // Rotating amethyst-gold crystal barrier arc!
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = e.telegraphTimer > 0 ? '#fde047' : '#e879f9';
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.arc(e.x, e.y + hover, 15.5, e.aimAngle - 0.9, e.aimAngle + 0.9);
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 0.9;
      ctx.stroke();
      ctx.restore();
      drawGlow(ctx, e.x, e.y + hover, 19, '#c084fc', e.telegraphTimer > 0 ? 0.52 : 0.3);
      this.renderEnemyMiniHp(ctx, e);
      return;
    }

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

    // Dramatic Moonlighter pit-fall shrink & tumble animation into the abyss!
    if (this.pitFallTimer > 0) {
      const prog = 1 - Math.max(0, this.pitFallTimer / Math.max(0.05, this.pitFallDuration));
      const fallScale = Math.max(0.08, 1 - prog * 0.88);
      const fallSpr = art.heroDown;
      if (fallSpr) {
        ctx.save();
        ctx.globalAlpha = Math.max(0.12, 1 - prog * 0.85);
        ctx.translate(this.playerX, this.playerY + prog * 14);
        ctx.rotate(prog * 5.2);
        ctx.scale(fallScale, fallScale);
        ctx.drawImage(fallSpr, -12, -16, 24, 28);
        ctx.restore();
      }
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

    // Hide shadow while dashing/leaping right over a chasm so the jump reads clearly!
    const overChasm = this.getChasmAt(this.playerX, this.playerY + 4, -2) !== null;
    if (!overChasm) {
      drawPixelShadow(ctx, this.playerX + lungeX * 0.5, this.playerY + 11, 8, 3.2, 0.5);
    }

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

    const suitAura = SUIT_THEMES[this.state.suitTheme] ?? SUIT_THEMES.classic;
    drawGlow(ctx, this.playerX, this.playerY, 24, suitAura.auraColor, this.state.suitTheme === 'classic' ? 0.14 : 0.24);
    if (this.state.suitTheme !== 'classic') {
      ctx.save();
      ctx.strokeStyle = suitAura.accent;
      ctx.globalAlpha = 0.35 + 0.2 * Math.sin(this.time * 4.2);
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.ellipse(this.playerX, this.playerY + 9, 10, 4.2, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  private renderMinimap(ctx: CanvasRenderingContext2D): void {
    const cx = VIRTUAL_WIDTH - 26;
    const cy = 22;
    const cell = 6;

    ctx.fillStyle = 'rgba(10, 15, 26, 0.88)';
    ctx.fillRect(cx - 22, cy - 17, 44, 34);
    ctx.strokeStyle = this.currentRoom.type === 'secret' ? '#fde047' : '#475569';
    ctx.lineWidth = 0.8;
    ctx.strokeRect(cx - 21.5, cy - 16.5, 43, 33);

    if (this.currentRoom.type === 'secret') {
      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 5px Silkscreen, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('★ GEHEIM', cx, cy + 2);
      return;
    }

    for (const room of this.floor.rooms.values()) {
      if (room.type === 'secret') continue;
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

    // Crisp live Speedrun Timer directly beneath the minimap
    const totalSec = Math.floor(this.runElapsedSec);
    const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
    const ss = String(totalSec % 60).padStart(2, '0');
    ctx.fillStyle = 'rgba(10, 15, 26, 0.88)';
    ctx.fillRect(cx - 22, cy + 19, 44, 10);
    ctx.strokeStyle = 'rgba(56, 232, 212, 0.45)';
    ctx.lineWidth = 0.7;
    ctx.strokeRect(cx - 21.5, cy + 19.5, 43, 9);
    ctx.fillStyle = '#a5f3fc';
    ctx.font = 'bold 5px Silkscreen, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('⏱ ' + mm + ':' + ss, cx, cy + 25.8);
  }

  private renderBossBar(ctx: CanvasRenderingContext2D): void {
    const boss = this.enemies.find((e) => this.isBossKind(e.kind));
    if (!boss) return;

    const pct = Math.max(0, boss.hp / boss.maxHp);
    const enraged = Boolean(boss.bossPhase2);
    const bw = 244;
    const bx = (VIRTUAL_WIDTH - bw) / 2;
    const by = VIRTUAL_HEIGHT - 27;

    const isS2Boss =
      boss.kind === 'boss_quartz_golem' ||
      boss.kind === 'boss_prism_weaver' ||
      boss.kind === 'boss_prisma_archon';
    const isS3Boss =
      boss.kind === 'boss_slag_overlord' ||
      boss.kind === 'boss_forge_warden' ||
      boss.kind === 'boss_vulkan_titan';
    const isS4Boss =
      boss.kind === 'boss_chrono_sentinel' ||
      boss.kind === 'boss_monolith_colossus' ||
      boss.kind === 'boss_star_archon' ||
      boss.kind === 'boss_omega_archon';

    ctx.fillStyle = 'rgba(12, 16, 26, 0.94)';
    ctx.fillRect(bx - 5, by - 12, bw + 10, 21);
    ctx.strokeStyle =
      boss.kind === 'boss_omega_archon'
        ? '#fde047'
        : isS4Boss
          ? enraged
            ? '#fde047'
            : '#38e8d4'
          : isS3Boss
            ? enraged
              ? '#ef4444'
              : '#f97316'
            : boss.kind === 'boss_prisma_archon'
              ? enraged
                ? '#f43f5e'
                : '#e879f9'
              : isS2Boss
                ? enraged
                  ? '#f472b6'
                  : '#c084fc'
                : boss.kind === 'boss_leviathan'
                  ? enraged
                    ? '#fb7185'
                    : '#fde047'
                  : enraged
                    ? '#fb7185'
                    : '#fb923c';
    ctx.lineWidth = 0.9;
    ctx.strokeRect(bx - 4.5, by - 11.5, bw + 9, 20);

    const baseNameMap: Partial<Record<Enemy['kind'], string>> = {
      boss_breacher: 'SCHOTT-BRECHER MK-II',
      boss: 'CORE-WÄCHTER MK-IV',
      boss_leviathan: '★ A.E.G.I.S. LEVIATHAN',
      boss_quartz_golem: 'QUARZ-KOLOSS MK-I',
      boss_prism_weaver: 'PRISMA-WEBERIN',
      boss_prisma_archon: '★ PRISMA-ARCHON',
      boss_slag_overlord: 'SCHLACKEN-KOLOSS',
      boss_forge_warden: 'GIESSEREI-MEISTER',
      boss_vulkan_titan: '★ VULKAN-TITAN',
      boss_chrono_sentinel: 'CHRONO-WÄCHTER',
      boss_monolith_colossus: 'MONOLITH-KOLOSS',
      boss_star_archon: '★ DER STERNEN-ARCHON',
      boss_omega_archon: '🌌 ★ OMEGA STERNEN-ARCHON',
    };
    const baseName = baseNameMap[boss.kind] ?? 'SEKTOR-BOSS';
    const status = boss.bossStatusText ? ` · ${boss.bossStatusText}` : '';
    const title = enraged ? `${baseName} [PHASE II]${status}` : `${baseName}${status}`;
    ctx.fillStyle = enraged ? '#fda4af' : isS4Boss ? '#a5f3fc' : isS3Boss ? '#fed7aa' : isS2Boss ? '#f5d0fe' : '#fde047';
    ctx.font = 'bold 5.2px Silkscreen, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(title, VIRTUAL_WIDTH / 2, by - 3.5);

    ctx.fillStyle = '#2a1822';
    ctx.fillRect(bx, by, bw, 5.5);
    ctx.fillStyle = enraged
      ? '#e11d48'
      : boss.kind === 'boss_omega_archon'
        ? '#eab308'
        : isS4Boss
          ? '#06b6d4'
          : isS3Boss
            ? '#ea580c'
            : boss.kind === 'boss_prisma_archon'
              ? '#c026d3'
              : isS2Boss
                ? '#a855f7'
                : boss.kind === 'boss_leviathan'
                  ? '#f59e0b'
                  : '#f97316';
    ctx.fillRect(bx, by, bw * pct, 5.5);
    ctx.fillStyle = enraged ? '#fda4af' : isS4Boss ? '#fde047' : isS2Boss ? '#f5d0fe' : '#fde047';
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
