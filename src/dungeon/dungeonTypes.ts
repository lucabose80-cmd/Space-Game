import type { Direction, RunSummary } from '../types';
import type { EnemyKind, RoomChest } from '../world/dungeonGen';

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
  kind: EnemyKind;
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
  /** Laufzeit: Phase-2-Effekt (Hit-Stop/Vibration) schon gezeigt */
  phase2FxShown?: boolean;
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
  /** M10-C: Elite (goldener Rand) */
  elite?: boolean;
  /** M10-C Boss-Engine: aktueller Zustand (idle/windup/active/recover), Zug-Index, Zeit im aktiven Zustand */
  bossSub?: string;
  bossMoveIdx?: number;
  bossT?: number;
  /** M11: Phase-2-Teile (Rig `detach`) wurden bereits abgelöst — nur Darstellung, nicht gespeichert */
  rigDetached?: boolean;
  /** M11 Teilen: gemeinsame Gruppen-ID beider Hälften (id der Original-Hälfte) und Rolle 0 = Nahkampf/A, 1 = Fernkampf/B */
  splitGroup?: number;
  splitRole?: 0 | 1;
  /** M10-C Schilde: Sekunden, die der Schild unten ist (Angriff/Überhitzung); Treffer-Hitze 0…n */
  shieldDownTimer?: number;
  shieldHeat?: number;
  /** M10-C Navigation: Anti-Hänger-Zustand (Bodenläufer) */
  stuckTimer?: number;
  stuckRefX?: number;
  stuckRefY?: number;
  sidestepTimer?: number;
  sidestepDir?: number;
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
  /** M11: Darstellung als Faust (Kern-Wächter Phase 2: die kreisenden Fäuste werden abgefeuert) — nur Optik, Hitbox = radius */
  sprite?: 'fist';
  /** M11: Lenkung zum Spieler (rad/s) solange `life` > `homingUntilLife` — nur für abgefeuerte Fäuste */
  homing?: number;
  homingUntilLife?: number;
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
  /** Zusammenfassen von Schadenszahlen (Polish Teil 2) */
  enemyId?: number;
  sum?: number;
  bornAt?: number;
}

export interface DungeonCallbacks {
  onReturnToHub: (summary: RunSummary) => void;
  onOpenDungeonChest?: (chest: RoomChest) => void;
  onToast: (msg: string, tone?: 'info' | 'good' | 'warn') => void;
  onHudDirty: () => void;
}
