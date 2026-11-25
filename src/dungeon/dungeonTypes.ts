import type { Direction, RunSummary } from '../types';
import type { RoomChest } from '../world/dungeonGen';

export type BossState =
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

export interface LeviathanArm {
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

export interface DebrisDrop {
  x: number;
  y: number;
  r: number;
  timer: number;
  maxTimer: number;
}

export interface SpearThrustFx {
  x: number;
  y: number;
  angle: number;
  length: number;
  comboStep: number;
  isCharge: boolean;
  life: number;
  maxLife: number;
}

export interface FistBurstFx {
  x: number;
  y: number;
  angle: number;
  step: number;
  isFinisher: boolean;
  life: number;
  maxLife: number;
}

export interface DiscusProjectile {
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

export interface Enemy {
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
  // Milestone 7: Elementar-Prägungen & Rift-Mutatoren
  burnTimer?: number;
  burnTickTimer?: number;
  burnDps?: number;
  cryoTimer?: number;
  mutator?: import('../types').RiftMutatorId;
}

export interface LightningArcFx {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  life: number;
  maxLife: number;
  color: string;
}

export interface SiphonOrbFx {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  healHp: number;
  healEn: number;
}

export interface Projectile {
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
  /** Milestone 10-A: Generation eines vom Kristall-Prisma geteilten Projektils (verhindert Ketten-Teilung). */
  splitGen?: number;
}

export interface LootDrop {
  x: number;
  y: number;
  vx: number;
  vy: number;
  itemId: string;
  age: number;
}

export interface WeaponSwing {
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

export interface SlashHitFx {
  x: number;
  y: number;
  angle: number;
  color: string;
  life: number;
  maxLife: number;
}

export interface BossAfterimage {
  x: number;
  y: number;
  height: number;
  tilt: number;
  enraged: boolean;
  isBreacher?: boolean;
  life: number;
  maxLife: number;
}

export interface LaserBeamFx {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  life: number;
  maxLife: number;
}

export interface ShockwaveFx {
  x: number;
  y: number;
  maxRadius: number;
  color: string;
  life: number;
  maxLife: number;
}

export interface FloorDecal {
  x: number;
  y: number;
  r: number;
  color: string;
  life: number;
  maxLife: number;
}

export interface Afterimage {
  x: number;
  y: number;
  facing: Direction;
  life: number;
  maxLife: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

export interface FloatingNum {
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
