import { updateDetached, type DetachedPart } from '../dungeon/anim/detached';
import { COMPANION_DEFS } from '../data/companions';
import { getInfusionDef, RIFT_MUTATOR_LIST, RIFT_MUTATORS } from '../data/infusions';
import { getItemDef, rollLootItem, rollRiftLootItem } from '../data/items';
import { WEAPON_META } from '../data/upgrades';
import { sound } from '../engine/audio';
import type { InputManager } from '../engine/input';
import type { GameState } from '../systems/gameState';
import {
  addItemToBackpack,
  isBackpackFullFor,
  processDefeatPenalty,
  processSafeReturnEffects,
} from '../systems/inventory';
import type {
  CompanionId,
  Direction,
  RiftMutatorId,
  RunSummary,
  SectorId,
  TrialOutcome,
  WeaponId,
  WeeklyTrialInfo,
} from '../types';
import { getDeviceSettings } from '../systems/deviceSettings';
import { haptic } from '../systems/haptics';
import { withSeededRandom } from '../systems/seededRng';
import { formatWeekLabel, getTrialFloorSeed, TRIAL_FLOORS, trialBossHpFactor, trialHasArena, trialHasMechanics } from '../systems/weeklyTrial';
import {
  generateEndlessRiftFloor,
  generateSector1Floor,
  generateSectorFloor,
  ROOM_CENTER_X,
  ROOM_CENTER_Y,
  roomBounds,
  roomKey,
  type ChasmRect,
  type DoorSide,
  type DungeonFloor,
  type DungeonRoom,
  type RoomBounds,
} from '../world/dungeonGen';

import { DungeonEnemyAi } from '../dungeon/enemyAi';
import { RoomMechanicsSystem } from '../dungeon/roomMechanics';
import { NavGrid } from '../dungeon/navGrid';
import { DungeonCamera } from '../dungeon/camera';
import { updateArenaVault } from '../dungeon/arenaVault';
import { ARENAS, arenaEnabled, attachArenas } from '../data/arenas';
import {
  arenaAimPoint,
  arenaAimPoints,
  arenaBeamHit,
  arenaClosestHitPoint,
  createLeviathanArena,
  isLeviathanArena,
  leviathanArenaDamage,
  onLeviathanArenaDefeated,
} from '../dungeon/bosses/leviathanArena';
import { BossFx } from '../dungeon/bosses/bossFx';
import { BOSS_HP, ENDBOSS_ARENA, ENEMY_SHIELDS, RIFT_SCALING } from '../data/balance';
import { findFreeSpotSpiral } from '../dungeon/mechanicsGen';
import { DungeonRenderer } from '../dungeon/dungeonRenderer';
import type {
  Afterimage,
  BossAfterimage,
  DebrisDrop,
  DiscusProjectile,
  DungeonCallbacks,
  Enemy,
  FistBurstFx,
  FloorDecal,
  FloatingNum,
  LaserBeamFx,
  LightningArcFx,
  LootDrop,
  Particle,
  Projectile,
  ShockwaveFx,
  SiphonOrbFx,
  SlashHitFx,
  SpearThrustFx,
  WeaponSwing,
} from '../dungeon/dungeonTypes';

export type { DungeonCallbacks };

export class DungeonScene {
  public enemyAi: DungeonEnemyAi;
  public dungeonRenderer: DungeonRenderer;
  public state: GameState;
  public callbacks: DungeonCallbacks;

  public floor: DungeonFloor = generateSector1Floor(1);
  public currentSector: SectorId = 1;
  public currentFloor: 1 | 2 | 3 = 1;
  public currentRoom!: DungeonRoom;
  /** M12 (Phase A): Grenzen des aktuellen Raums (Standardraum = `ROOM_LEFT…`, Arena = `room.bounds`). */
  /** M12 (Phase B): Kamera — im Standardraum immer (0, 0). */
  public readonly camera = new DungeonCamera();
  /** M12 Phase D: Titel-Banner (Auftritt/Sieg eines Arena-Endbosses), Bildschirmkoordinaten */
  public arenaBanner: { title: string; sub: string; t: number; max: number } | null = null;
  public get cameraTarget(): { playerX: number; playerY: number; roomBounds: DungeonRoom['bounds']; biasY?: number } {
    const arena = this.currentRoom?.arenaKind ? ARENAS[this.currentRoom.arenaKind] : undefined;
    return { playerX: this.playerX, playerY: this.playerY, roomBounds: this.currentRoom?.bounds, biasY: arena?.cameraBiasY };
  }
  public get bounds(): Readonly<RoomBounds> {
    return roomBounds(this.currentRoom);
  }
  /** M12: Reichweite für Strahl-Raycasts bis zur Raumgrenze — Standardraum = bisheriger Wert, Arena = Diagonale. */
  public rayLimit(standard: number): number {
    const rb = this.bounds;
    return this.currentRoom?.bounds ? Math.max(standard, Math.ceil(Math.hypot(rb.r - rb.l, rb.b - rb.t)) + 12) : standard;
  }

  public playerX = ROOM_CENTER_X;
  public playerY = ROOM_CENTER_Y;
  public lastSafeX = ROOM_CENTER_X;
  public lastSafeY = ROOM_CENTER_Y;
  public pitFallTimer = 0;
  public pitFallDuration = 0.46;
  public pitFallSecretRoomKey: string | null = null;
  public facing: Direction = 'down';
  public walkAnim = 0;

  // Combat & Single-Equipped-Weapon state
  public dashTimer = 0;
  public dashCooldown = 0;
  public dashVx = 0;
  public dashVy = 0;
  public lanceChargeTimer = 0;
  public lanceChargeAngle = 0;
  public lanceHitIds = new Set<number>();
  public cometSlamTimer = 0;
  public cometSlamAngle = 0;
  public discusOrbitTimer = 0;
  public discusOrbitAngle = 0;
  public discusOrbitHitCds = new Map<number, number>();
  public invulnTimer = 0;
  public playerFlashTimer = 0;

  public attackCooldown = 0;
  public specialCooldown = 0;
  public comboStep = 0;
  public comboResetTimer = 0;

  // Active kinetic shield (Blade secondary), melee lunge pose & blaster hold visuals
  public shieldActive = false;
  public shieldAngle = 0;
  public shieldOpenAnim = 0;
  public shieldHoldTime = 0;
  public shieldHitFlash = 0;
  public shieldRipple = 0;
  public shieldRippleAngle = 0;
  public shieldRecoil = 0;
  public shieldOverheatTimer = 0;
  public shieldOverheatMsgCd = 0;
  public blasterRecoil = 0;
  public lastAimAngle = 0;
  public swingPoseTimer = 0;
  public swingPoseMax = 0.2;
  public swingPoseAngle = 0;
  public swingPoseDir: 1 | -1 = 1;
  public swingPoseCombo = 0;

  // Companion Bot (Familiar) live dungeon state
  public companionX = ROOM_CENTER_X - 18;
  public companionY = ROOM_CENTER_Y + 18;
  public sparkFireTimer = 0.7;
  public lumaRoomCounter = 0;
  public haloShieldReady = false;
  public haloChargeTimer = 0;

  // Room entities & FX
  public enemies: Enemy[] = [];
  public projectiles: Projectile[] = [];
  public discs: DiscusProjectile[] = [];
  public drops: LootDrop[] = [];
  public swings: WeaponSwing[] = [];
  public thrusts: SpearThrustFx[] = [];
  public fistBursts: FistBurstFx[] = [];
  public debrisDrops: DebrisDrop[] = [];
  public slashHits: SlashHitFx[] = [];
  public bossAfterimages: BossAfterimage[] = [];
  public beams: LaserBeamFx[] = [];
  public shockwaves: ShockwaveFx[] = [];
  public decals: FloorDecal[] = [];
  public afterimages: Afterimage[] = [];
  public particles: Particle[] = [];
  /** M11: abgelöste Rig-Teile (Phase-2-Verwandlung), nur Darstellung */
  public detached: DetachedPart[] = [];
  public floats: FloatingNum[] = [];
  public lightningArcs: LightningArcFx[] = [];
  public siphonOrbs: SiphonOrbFx[] = [];
  public siphonHitCounter = 0;
  public nextEnemyId = 1;

  // Milestone 7: Endless Rift ("Die Unendliche Spirale") & Rift Chambers
  public isEndlessRift = false;
  public riftDepth = 0;
  public activeRiftMutator: RiftMutatorId | null = null;
  public riftLootMultiplier = 1;

  // Milestone 10-A: Sektor-Raum-Mechaniken (Laufzeit-System + raumlokale Uhr)
  public mechanics: RoomMechanicsSystem;
  /** Raumlokale Uhr in Sekunden (Reset bei enterRoom) — alle Mechanik-Zyklen laufen darüber, nie über `time`. */
  public mechanicsClock = 0;
  /** M10-C: Navigations-Raster des aktuellen Raums (Fluss-Feld zum Spieler) */
  public nav: NavGrid | null = null;
  /** M10-C: Boss-Telegraphie-Zonen, Strahlen & Platten */
  public readonly bossFx = new BossFx();

  // Milestone 9: Wöchentliche Galaktische Prüfung (Seeded Challenge Run)
  public isWeeklyTrial = false;
  public trialInfo: WeeklyTrialInfo | null = null;

  /** Begleiter-Drohne — in der Prüfung immer deaktiviert (faire Ausgangslage). */
  public get activeCompanion(): CompanionId | null {
    return this.isWeeklyTrial ? null : this.state.equippedCompanion;
  }

  // Juice & transitions
  public hitStop = 0;
  /** Großer Moment (Phase 2, Boss-/Elite-Kill): wird von normalen Hit-Stops nicht überschrieben */
  public heavyStop = 0;
  public shakeTimer = 0;
  public shakeMag = 0;
  public roomFade = 0;
  public time = 0;

  // Run telemetry
  public runElapsedSec = 0;
  public roomsCleared = 0;
  public enemiesDefeated = 0;
  public floorBossDefeated = false;
  public maxFloorReached = 1;
  public sector1ClearedInRun = false;
  public sector2ClearedInRun = false;
  public sector3ClearedInRun = false;
  public sector4ClearedInRun = false;
  public omegaClearedInRun = false;
  public finished = false;

  public activePrompt: { label: string; x: number; y: number } | null = null;

  constructor(state: GameState, callbacks: DungeonCallbacks) {
    this.enemyAi = new DungeonEnemyAi(this);
    this.mechanics = new RoomMechanicsSystem(this);
    this.dungeonRenderer = new DungeonRenderer(this);
    this.state = state;
    this.callbacks = callbacks;
  }

  /** Milestone 10-A: Ein Boss ist in Phase 2 (steuert die Musik-Intensität in main.ts). */
  public isBossPhase2Active(): boolean {
    return this.enemies.some((e) => this.isBossKind(e.kind) && e.bossPhase2 === true);
  }

  public isInBossFight(): boolean {
    return this.currentRoom?.type === 'boss' && this.enemies.some((e) => this.isBossKind(e.kind));
  }

  /** Gemeinsame Lauf-Zurücksetzung (Normal-, Spiralen- und Prüfungs-Läufe). */
  private resetRunTelemetry(): void {
    this.siphonHitCounter = 0;
    this.lightningArcs = [];
    this.siphonOrbs = [];
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
    this.haloShieldReady = this.activeCompanion === 'halo';
    this.haloChargeTimer = 0;
    this.finished = false;
  }

  private clearTrialState(): void {
    this.isWeeklyTrial = false;
    this.trialInfo = null;
    this.state.activeTrial = null;
  }

  public startRun(sector: SectorId = 1): void {
    this.clearTrialState();
    this.currentSector = sector;
    this.isEndlessRift = false;
    this.riftDepth = 0;
    this.activeRiftMutator = null;
    this.riftLootMultiplier = 1;
    this.resetRunTelemetry();
    this.startFloor(sector === 5 ? 3 : 1, true, sector);
  }

  public startEndlessRift(): void {
    this.clearTrialState();
    this.currentSector = 5;
    this.isEndlessRift = true;
    this.riftDepth = 1;
    this.resetRunTelemetry();
    this.startEndlessRiftFloor(1, true);
  }

  /** Galaktische Prüfung: normierte Ausrüstung, geseedete Ebenen, keine Beute/Progression. */
  public startWeeklyTrial(info: WeeklyTrialInfo): void {
    this.isWeeklyTrial = true;
    this.trialInfo = info;
    this.state.activeTrial = info; // VOR restoreFullVitals → normierte Max-HP
    this.currentSector = info.sector;
    this.isEndlessRift = false;
    this.riftDepth = 0;
    this.activeRiftMutator = info.mutator;
    this.riftLootMultiplier = 1;
    this.resetRunTelemetry();
    this.startFloor(1, true, info.sector);
  }

  public startEndlessRiftFloor(depth: number, freshRun = false): void {
    this.isEndlessRift = true;
    this.currentSector = 5;
    this.riftDepth = Math.max(1, Math.floor(depth));
    this.currentFloor = this.riftDepth % 3 === 0 ? 3 : 2;
    this.maxFloorReached = Math.max(this.maxFloorReached, this.riftDepth);
    this.riftLootMultiplier = 1 + Math.floor((this.riftDepth - 1) / 3) * 0.25;
    this.activeRiftMutator = RIFT_MUTATOR_LIST[(this.riftDepth - 1 + Math.floor(Math.random() * 2)) % RIFT_MUTATOR_LIST.length];

    this.floor = generateEndlessRiftFloor(this.riftDepth);
    this.floorBossDefeated = false;
    this.invulnTimer = 0.6;
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
    this.haloShieldReady = this.activeCompanion === 'halo';
    this.haloChargeTimer = 0;
    this.enterRoom(this.floor.startKey, null);
    this.spawnBurst(this.playerX, this.playerY, '#c084fc', 28);

    const mut = RIFT_MUTATORS[this.activeRiftMutator];
    const multPct = Math.round((this.riftLootMultiplier - 1) * 100);
    this.callbacks.onToast(
      freshRun
        ? `🌀 ∞ UNENDLICHE SPIRALE — Ebene ${this.riftDepth}! Mutator: ${mut.icon} ${mut.name} (${mut.description})`
        : `🌀 Ebene ${this.riftDepth} erreicht! ${mut.icon} ${mut.name}${multPct > 0 ? ` · +${multPct} % Bonus-Beute!` : ''}`,
      this.riftDepth % 3 === 0 ? 'warn' : 'info',
    );
    this.callbacks.onHudDirty();
  }

  public enterRiftChamber(riftKey: string): void {
    const room = this.floor.rooms.get(riftKey);
    if (!room) return;
    sound.playWarp();
    this.enterRoom(riftKey, null);
    this.playerX = this.bounds.cx;
    this.playerY = this.bounds.b - 34;
    this.lastSafeX = this.playerX;
    this.lastSafeY = this.playerY;
    this.spawnBurst(this.playerX, this.playerY, '#c084fc', 24);
    this.callbacks.onToast('🌀 INSTABILER RIFT! Besiege 2 Elite-Wellen für garantierte Rift-Katalysatoren!', 'warn');
  }

  public exitRiftChamber(): void {
    const parentKey = this.currentRoom.riftParentKey;
    if (!parentKey) return;
    sound.playWarp();
    this.enterRoom(parentKey, null);
    // M10-C: Rückkehrpunkt = freier Platz unterhalb des Portals (nicht in Objekten)
    const rp = this.currentRoom.riftPortal;
    const back = rp ? findFreeSpotSpiral(this.currentRoom, rp.x, rp.y + 30, 8) : null;
    this.playerX = back?.x ?? this.bounds.cx;
    this.playerY = back?.y ?? this.bounds.cy + 28;
    this.lastSafeX = this.playerX;
    this.lastSafeY = this.playerY;
    this.spawnBurst(this.playerX, this.playerY, '#38e8d4', 18);
  }

  public startFloor(floorIndex: 1 | 2 | 3, freshRun = false, sector: SectorId = this.currentSector): void {
    this.currentSector = sector;
    this.currentFloor = floorIndex;
    this.maxFloorReached = Math.max(this.maxFloorReached, floorIndex);
    if (this.isWeeklyTrial) {
      // Prüfung: keine Fortschritts-Rekorde
    } else if (sector === 4) {
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
    if (this.isWeeklyTrial && this.trialInfo) {
      // Identisches Layout für alle Spieler: NUR die synchrone Generierung läuft geseedet.
      const seed = getTrialFloorSeed(this.trialInfo.weekId, floorIndex);
      const mechanics = trialHasMechanics(this.trialInfo.weekId);
      this.floor = withSeededRandom(seed, () => generateSectorFloor(sector, floorIndex, undefined, { mechanics, portalExclusion: false, beacon: false }));
      // M12 Phase D: Arena erst ab TRIAL_ARENA_FROM_WEEK (und nur, wenn live) — nach der geseedeten Generierung, ohne Math.random
      if (trialHasArena(this.trialInfo.weekId)) attachArenas(this.floor);
      // Keine Rift-Risse in der Prüfung (Beute/Progression sind aus)
      for (const [key, room] of [...this.floor.rooms.entries()]) {
        if (room.isRiftChamber) this.floor.rooms.delete(key);
        else if (room.riftPortal) room.riftPortal = undefined;
      }
    } else {
      this.floor = generateSectorFloor(sector, floorIndex);
      // M12 (Phase C): Endboss-Arena an den Bossraum hängen — nach der Generierung, ohne Math.random.
      // Wochen-Prüfung: nie vor TRIAL_ARENA_FROM_WEEK (kommt mit Phase D).
      if (arenaEnabled()) attachArenas(this.floor);
    }
    this.floorBossDefeated = false;
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
    this.haloShieldReady = this.activeCompanion === 'halo';
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

    if (this.isWeeklyTrial && this.trialInfo) {
      const mut = RIFT_MUTATORS[this.trialInfo.mutator];
      this.callbacks.onToast(
        freshRun
          ? `🏅 GALAKTISCHE PRÜFUNG ${formatWeekLabel(this.trialInfo.weekId)} — Sektor ${sector} · Mutator ${mut.icon} ${mut.name}! Normierte Ausrüstung, keine Beute — nur Ruhm!`
          : `🏅 Prüfung · Ebene ${floorIndex} von ${TRIAL_FLOORS} · ${mut.icon} ${mut.name}`,
        floorIndex === TRIAL_FLOORS ? 'warn' : 'info',
      );
    } else if (sector === 5) {
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
          : 'Sektor 1 · Ebene I: Frachtdeck — Beute bleibt nur an Teleportern sicher (Start-Raum, nach Bossen, Notfall-Bake)!',
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

  public enterRoom(key: string, enteredFrom: DoorSide | null): void {
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
    this.mechanicsClock = 0;
    this.mechanics.resetForRoom();
    this.rebuildNav();
    this.bossFx.clear();
    this.detached.length = 0;
    this.aimTargetId = null;
    this.roomFade = 0.22;

    const rb = this.bounds; // M12: Türen/Eintritt relativ zu den Raumgrenzen
    if (enteredFrom === 'north') {
      this.playerX = rb.cx;
      this.playerY = rb.t + 18;
      this.facing = 'down';
    } else if (enteredFrom === 'south') {
      this.playerX = rb.cx;
      this.playerY = rb.b - 18;
      this.facing = 'up';
    } else if (enteredFrom === 'west') {
      this.playerX = rb.l + 18;
      this.playerY = rb.cy;
      this.facing = 'right';
    } else if (enteredFrom === 'east') {
      this.playerX = rb.r - 18;
      this.playerY = rb.cy;
      this.facing = 'left';
    } else {
      this.playerX = rb.cx;
      this.playerY = rb.cy + 24;
      this.facing = 'up';
    }
    this.lastSafeX = this.playerX;
    this.lastSafeY = this.playerY;
    this.camera.snap(this.cameraTarget);

    if (!room.cleared) {
      for (const sp of room.spawns) {
        this.spawnEnemy(sp.kind, sp.x, sp.y);
        if (sp.elite) this.makeElite(this.enemies[this.enemies.length - 1]);
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
          else if (this.currentFloor === 2) this.callbacks.onToast('⚠ SEKTOR-3 BOSS II: Gießerei-Meisterin heizt auf!', 'warn');
          else this.callbacks.onToast('🔥 SEKTOR-3-ENDBOSS: ★ VULKAN-TITAN ERWACHT!', 'warn');
        } else if (this.currentSector === 2) {
          if (this.currentFloor === 1) this.callbacks.onToast('⚠ SEKTOR-2 BOSS I: Quarz-Koloss MK-I erwacht!', 'warn');
          else if (this.currentFloor === 2) this.callbacks.onToast('⚠ SEKTOR-2 BOSS II: Prisma-Weberin manifestiert sich!', 'warn');
          else this.callbacks.onToast('🚨 SEKTOR-2-ENDBOSS: ★ PRISMA-ARCHON ERWACHT!', 'warn');
        } else if (this.currentFloor === 1) {
          this.callbacks.onToast('⚠ EBENEN-BOSS I: Schrott-Sammler „Krall“ rückt an!', 'warn');
        } else if (this.currentFloor === 2) {
          this.callbacks.onToast('⚠ EBENEN-BOSS II: Kern-Wächter MK-IV erwacht!', 'warn');
        } else {
          this.callbacks.onToast('🚨 SEKTOR-1-ENDBOSS: A.E.G.I.S. LEVIATHAN AKTIVIERT!', 'warn');
        }
      }
    }
  }

  public enterSecretRoom(secretKey: string, returnX: number, returnY: number): void {
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

    this.playerX = this.bounds.cx;
    this.playerY = this.bounds.cy + 26;
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

  public exitSecretRoom(): void {
    const parentKey = this.currentRoom.secretParentKey;
    if (!parentKey) return;
    const rx = this.currentRoom.secretReturnX ?? this.bounds.cx;
    const ry = this.currentRoom.secretReturnY ?? this.bounds.cy;
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

  /** M10-C: Gefahren-Sterne (★☆☆ … ★★★) aus dem Rift-HP-Faktor. */
  public riftDangerStars(sector: number, floor: number): string {
    const f = RIFT_SCALING.hpFactor(sector, floor);
    const n = f < 2.0 ? 1 : f < 2.6 ? 2 : 3;
    return '★'.repeat(n) + '☆'.repeat(3 - n);
  }

  /** M10-C: Elite — ×2 HP, goldener Rand, immer ein Rift-Mutator (deterministisch nach Gegner-ID). */
  public makeElite(e: Enemy | undefined): void {
    if (!e) return;
    e.elite = true;
    e.maxHp = Math.round(e.maxHp * 2);
    e.hp = e.maxHp;
    e.mutator ??= RIFT_MUTATOR_LIST[e.id % RIFT_MUTATOR_LIST.length];
  }

  /** Navigations-Raster neu aufbauen (Raumwechsel; Tests nach Hindernis-Änderung). */
  public rebuildNav(): void {
    this.nav = new NavGrid((x, y, r) => this.collidesRoomObstacle(x, y, r) || this.collidesRoomChasm(x, y, r), 7, this.bounds);
  }

  public isBossKind(kind: Enemy['kind']): boolean {
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

  public spawnEnemy(kind: Enemy['kind'], x: number, y: number): void {
    const trial = this.isWeeklyTrial;
    const ngLevel = trial ? 0 : this.state.ngPlusLevel; // Prüfung: keine NG+-Skalierung
    const bossCount = trial ? 1 : this.state.bossDefeatedCount; // Prüfung: fester Boss-Faktor
    const ngMult = 1 + ngLevel * 0.35;
    const floorScale = (this.currentFloor === 1 ? 1.0 : this.currentFloor === 2 ? 1.24 : 1.48) * ngMult;
    const baseScale = floorScale * (1 + Math.min(3, bossCount) * 0.08);
    const inRiftChamber = Boolean(this.currentRoom?.isRiftChamber);
    const riftMutator: RiftMutatorId | undefined = this.isEndlessRift || trial
      ? (this.activeRiftMutator ?? undefined)
      : inRiftChamber
        ? RIFT_MUTATOR_LIST[Math.floor(Math.random() * RIFT_MUTATOR_LIST.length)]
        : undefined;
    const riftHpMult = this.isEndlessRift
      ? (1 + Math.max(0, this.riftDepth - 1) * 0.24) * (riftMutator === 'armored' ? 1.3 : 1.0)
      : trial
        ? riftMutator === 'armored'
          ? 1.3
          : 1.0
        : inRiftChamber
        ? RIFT_SCALING.hpFactor(this.currentRoom.riftSector ?? this.currentSector, this.currentRoom.riftFloor ?? this.currentFloor) *
          (riftMutator === 'armored' ? 1.25 : 1.0)
        : 1.0;

    // M10-C: Boss-HP in der Prüfung auf normierte Stufe-4-Ausrüstung skaliert (gleiche Kampfdauer wie im Normalspiel)
    const trialBossMult = trial && this.isBossKind(kind) ? trialBossHpFactor(kind) : 1;
    const makeBase = (hp: number, radius: number): Enemy => {
      const scaledHp = Math.max(10, Math.round(hp * riftHpMult * trialBossMult));
      return {
        id: this.nextEnemyId++,
        kind,
        x,
        y,
        vx: 0,
        vy: 0,
        hp: scaledHp,
        maxHp: scaledHp,
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
        mutator: riftMutator,
      };
    };

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
      const e = makeBase(Math.round(BOSS_HP.boss_slag_overlord * ngMult), 19);
      e.bossState = 's2_idle';
      e.bossStateTimer = 0.85;
      e.bossStateMax = 0.85;
      e.bossPhase2 = false;
      e.bossStatusText = 'SCHLACKEN-KERN AKTIV';
      this.enemies.push(e);
    } else if (kind === 'boss_forge_warden') {
      const e = makeBase(Math.round(BOSS_HP.boss_forge_warden * ngMult), 19);
      e.bossState = 's2_idle';
      e.bossStateTimer = 0.8;
      e.bossStateMax = 0.8;
      e.bossPhase2 = false;
      e.bossOrbitAngle = 0;
      e.bossStatusText = 'SCHMELZOFEN AKTIV';
      this.enemies.push(e);
    } else if (kind === 'boss_vulkan_titan') {
      const e = makeBase(Math.round(BOSS_HP.boss_vulkan_titan * ngMult), 25);
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
      const e = makeBase(Math.round(BOSS_HP.boss_chrono_sentinel * ngMult), 19);
      e.bossState = 's2_idle';
      e.bossStateTimer = 0.82;
      e.bossStateMax = 0.82;
      e.bossPhase2 = false;
      e.bossOrbitAngle = 0;
      e.bossStatusText = 'CHRONO-FELD AKTIV';
      this.enemies.push(e);
    } else if (kind === 'boss_monolith_colossus') {
      const e = makeBase(Math.round(BOSS_HP.boss_monolith_colossus * ngMult), 20);
      e.bossState = 's2_idle';
      e.bossStateTimer = 0.8;
      e.bossStateMax = 0.8;
      e.bossPhase2 = false;
      e.bossOrbitAngle = 0;
      e.bossStatusText = 'MONOLITH-KERN AKTIV';
      this.enemies.push(e);
    } else if (kind === 'boss_star_archon') {
      const e = makeBase(Math.round(BOSS_HP.boss_star_archon * ngMult), 25);
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
      const e = makeBase(Math.round(BOSS_HP.boss_omega_archon * ngMult), 27);
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
      const e = makeBase(Math.round(BOSS_HP.boss_quartz_golem * ngMult * (1 + Math.min(2, bossCount) * 0.06)), 18);
      e.bossState = 's2_idle';
      e.bossStateTimer = 0.9;
      e.bossStateMax = 0.9;
      e.bossPhase2 = false;
      e.bossStatusText = 'QUARZ-KERN AKTIV';
      this.enemies.push(e);
    } else if (kind === 'boss_prism_weaver') {
      const e = makeBase(Math.round(BOSS_HP.boss_prism_weaver * ngMult * (1 + Math.min(2, bossCount) * 0.06)), 17);
      e.bossState = 's2_idle';
      e.bossStateTimer = 0.85;
      e.bossStateMax = 0.85;
      e.bossPhase2 = false;
      e.bossOrbitAngle = 0;
      e.bossStatusText = 'PRISMA-NETZ AKTIV';
      this.enemies.push(e);
    } else if (kind === 'boss_prisma_archon') {
      const e = makeBase(Math.round(BOSS_HP.boss_prisma_archon * ngMult * (1 + Math.min(2, bossCount) * 0.05)), 24);
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
      const e = makeBase(Math.round(BOSS_HP.boss_breacher * ngMult * (1 + Math.min(2, bossCount) * 0.08)), 16);
      e.bossState = 'stalk';
      e.bossStateTimer = 0.85;
      e.bossStateMax = 0.85;
      e.bossHeight = 0;
      e.bossPhase2 = false;
      e.bossStatusText = 'AKTIV';
      e.bossAfterimageTick = 0;
      this.enemies.push(e);
    } else if (kind === 'boss') {
      const e = makeBase(Math.round(BOSS_HP.boss * ngMult * (1 + Math.min(2, bossCount) * 0.08)), 16);
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
      // M12 Phase D: in der Arena mehr HP (größere Halle, längere Ausweichwege)
      const arenaMult = this.currentRoom?.arenaKind === 'boss_leviathan' ? ENDBOSS_ARENA.leviathan.hpMult : 1;
      const e = makeBase(Math.round(BOSS_HP.boss_leviathan * arenaMult * ngMult * (1 + Math.min(2, bossCount) * 0.06)), 28);
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
          homeX: this.bounds.cx - 78,
          homeY: this.bounds.t + 54,
          x: this.bounds.cx - 78,
          y: this.bounds.t + 54,
          targetX: this.bounds.cx - 78,
          targetY: this.bounds.t + 54,
          state: 'idle',
          timer: 0,
          beamAngle: Math.PI / 2,
        },
        {
          side: 1,
          homeX: this.bounds.cx + 78,
          homeY: this.bounds.t + 54,
          x: this.bounds.cx + 78,
          y: this.bounds.t + 54,
          targetX: this.bounds.cx + 78,
          targetY: this.bounds.t + 54,
          state: 'idle',
          timer: 0,
          beamAngle: Math.PI / 2,
        },
      ];
      if (arenaMult !== 1) createLeviathanArena(this, e);
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
    // M12 (Phase B): während einer Kamerafahrt ist die Spieler-Eingabe gesperrt
    if (this.camera.inputLocked) {
      const prev = input.locked;
      input.locked = true;
      try {
        this.updateFrame(dt, input);
      } finally {
        input.locked = prev;
      }
    } else {
      this.updateFrame(dt, input);
    }
    if (!this.finished) this.camera.update(dt, this.cameraTarget);
    if (this.arenaBanner) {
      this.arenaBanner.t -= dt;
      if (this.arenaBanner.t <= 0) this.arenaBanner = null;
    }
  }

  private updateFrame(dt: number, input: InputManager): void {
    this.time += dt;
    this.runElapsedSec += dt;
    this.roomFade = Math.max(0, this.roomFade - dt);

    if (this.shakeTimer > 0) {
      this.shakeTimer = Math.max(0, this.shakeTimer - dt);
    }

    if (this.hitStop > 0 || this.heavyStop > 0) {
      if (this.hitStop > 0) this.hitStop -= dt;
      if (this.heavyStop > 0) this.heavyStop -= dt;
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
      const lumaMult = this.activeCompanion === 'luma' ? 1.15 : 1.0;
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
    // Smart-Zielhilfe: Ziel jedes Frame aktualisieren (Fadenkreuz sichtbar, Haftung greift)
    if (getDeviceSettings().aimAssist === 'smart' && !input.isMouseActive()) this.getAimAngle(input);
    this.updateCompanion(dt);
    this.enemyAi.updateHazardsAndDebris(dt);
    this.mechanicsClock += dt;
    this.mechanics.update(dt);
    updateArenaVault(this, dt); // M12: Schatzkammer nach dem Arena-Sieg
    this.nav?.tick(dt, this.playerX, this.playerY);
    this.bossFx.beginFrame();
    this.syncSplitPools();
    this.enemyAi.updateEnemies(dt);
    this.bossFx.update(this, dt);
    // Polish Teil 2: Phase-2-Wechsel eines Bosses einmalig mit Hit-Stop + Vibration betonen (rein darstellend)
    for (const be of this.enemies) {
      if (be.bossPhase2 && !be.phase2FxShown && this.isBossKind(be.kind)) {
        be.phase2FxShown = true;
        this.heavyStop = Math.max(this.heavyStop, 0.09);
        haptic([40, 40, 60]);
      }
    }
    this.updateProjectiles(dt);
    this.updateDiscs(dt);
    this.updateDrops(dt);
    this.updateRoomInteractions(input);
    this.updateEffects(dt);
  }

  public triggerShieldBreak(): void {
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

  /** Milestone 10-A: aktuell anvisierter Gegner im Smart-Modus (Enemy-id; Leviathan-Arme: 1 000 000 + id·10 + Index). */
  public aimTargetId: number | null = null;
  private aimSmartActive = false;

  /** Position des anvisierten Ziels (nur Smart-Zielhilfe ohne Maus) — für das Fadenkreuz im Renderer. */
  public getAimTarget(): { x: number; y: number; r: number } | null {
    if (!this.aimSmartActive || this.aimTargetId === null) return null;
    if (this.aimTargetId >= 1_000_000) {
      const eid = Math.floor((this.aimTargetId - 1_000_000) / 10);
      const idx = (this.aimTargetId - 1_000_000) % 10;
      const boss = this.enemies.find((e) => e.id === eid);
      if (boss?.levArena) return arenaAimPoint(boss, idx);
      const arm = boss?.levArms?.[idx];
      return arm ? { x: arm.x, y: arm.y, r: 12 } : null;
    }
    const e = this.enemies.find((x) => x.id === this.aimTargetId && x.hp > 0);
    return e ? { x: e.x, y: e.y, r: e.radius } : null;
  }

  public getAimAngle(input: InputManager): number {
    if (input.isMouseActive()) {
      this.aimSmartActive = false;
      const m = this.camera.toWorld(input.getMousePos().x, input.getMousePos().y); // M12: Bildschirm → Welt
      return Math.atan2(m.y - this.playerY, m.x - this.playerX);
    }

    // Milestone 10-A: Zielhilfe-Modus (pro Gerät) — gilt für alle Nicht-Maus-Eingaben (Touch, Gamepad, Tastatur)
    const mode = getDeviceSettings().aimAssist;
    if (mode === 'off') {
      this.aimSmartActive = false;
      this.aimTargetId = null;
      return this.aimMoveOrFacing(input);
    }
    if (mode === 'smart') {
      this.aimSmartActive = true;
      const a = this.aimSmart(input);
      if (a !== null) return a;
      return this.aimPodsOrFallback(input, null);
    }
    this.aimSmartActive = false;
    this.aimTargetId = null;
    return this.aimStandard(input);
  }

  /** „Standard“: exakt das bisherige Verhalten (nächster Gegner < 185 px, Leviathan-Arme, Pods < 56 px). */
  private aimStandard(input: InputManager): number {
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
          if (arm.dead) continue;
          const ad = Math.hypot(arm.x - this.playerX, arm.y - this.playerY);
          if (ad < bestDist) {
            bestDist = ad;
            bestAngle = Math.atan2(arm.y - this.playerY, arm.x - this.playerX);
          }
        }
      }
    }
    if (bestAngle !== null) return bestAngle;
    return this.aimPodsOrFallback(input, null);
  }

  private aimPodsOrFallback(input: InputManager, bestAngleIn: number | null): number {
    let bestAngle = bestAngleIn;
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
    return this.aimMoveOrFacing(input);
  }

  /** Laufrichtung, sonst letzte Blickrichtung (auch Zielhilfe „Aus“). */
  private aimMoveOrFacing(input: InputManager): number {
    const mv = input.getMoveVector();
    if (Math.hypot(mv.x, mv.y) > 0.2) {
      return Math.atan2(mv.y, mv.x);
    }
    if (this.facing === 'right') return 0;
    if (this.facing === 'down') return Math.PI / 2;
    if (this.facing === 'left') return Math.PI;
    return -Math.PI / 2;
  }

  /**
   * „Smart“: Score = Distanz + Blickwinkel-Abweichung·70 − (niedrige HP ? 25 : 0) − (kein Boss ? 10 : 0).
   * Ziel-Haftung: Das bisherige Ziel bleibt, solange es lebt, < 230 px entfernt ist und höchstens 35 Punkte schlechter ist.
   */
  private aimSmart(input: InputManager): number | null {
    const look = this.aimMoveOrFacing(input);
    type Cand = { id: number; x: number; y: number; d: number; score: number };
    const cands: Cand[] = [];
    const push = (id: number, x: number, y: number, boss: boolean, lowHp: boolean): void => {
      const d = Math.hypot(x - this.playerX, y - this.playerY);
      if (d > 230) return;
      const diff = Math.abs(this.normalizeAngle(Math.atan2(y - this.playerY, x - this.playerX) - look));
      cands.push({ id, x, y, d, score: d + diff * 70 - (lowHp ? 25 : 0) - (boss ? 0 : 10) });
    };
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      const boss = this.isBossKind(e.kind);
      push(e.id, e.x, e.y, boss, e.hp / Math.max(1, e.maxHp) < 0.3);
      if (e.levArena && isLeviathanArena(this, e)) {
        for (const w of arenaAimPoints(e)) push(1_000_000 + e.id * 10 + w.idx, w.x, w.y, true, false);
      } else if (e.kind === 'boss_leviathan' && e.levArms) {
        e.levArms.forEach((arm, i) => push(1_000_000 + e.id * 10 + i, arm.x, arm.y, true, false));
      }
    }
    if (cands.length === 0) {
      this.aimTargetId = null;
      return null;
    }
    const fresh = cands.filter((c) => c.d <= 210);
    const best = (fresh.length > 0 ? fresh : cands).reduce((a, b) => (b.score < a.score ? b : a));
    const current = cands.find((c) => c.id === this.aimTargetId);
    const chosen = current && current.score - best.score <= 35 ? current : best;
    this.aimTargetId = chosen.id;
    return Math.atan2(chosen.y - this.playerY, chosen.x - this.playerX);
  }

  public updatePlayer(dt: number, input: InputManager): void {
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
          haptic(35);
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
      this.mechanics.onMeleeHitWhere((px, py) => Math.hypot(px - this.playerX, py - this.playerY) <= 20);
      return;
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

    const baseSpeed = (this.shieldActive ? 54 : 108) * stats.moveSpeedMult * this.bossFx.slowMult;
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

  public orientFacing(angle: number): void {
    if (Math.abs(Math.cos(angle)) > Math.abs(Math.sin(angle))) {
      this.facing = Math.cos(angle) > 0 ? 'right' : 'left';
    } else {
      this.facing = Math.sin(angle) > 0 ? 'down' : 'up';
    }
  }

  public performPlasmaSlash(angle: number): void {
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
    this.mechanics.onMeleeHitWhere((px, py) => Math.hypot(px - this.playerX, py - this.playerY) <= radius + 10);

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

  public performSpearThrust(angle: number): void {
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
    this.mechanics.onMeleeHitWhere((px, py) => this.pointToSegmentDist(px, py, sx, sy, ex, ey) <= 13);

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

  public performIonLanceCharge(angle: number): void {
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

  public getClosestEnemyHitPoint(
    e: Enemy,
    refX: number,
    refY: number,
  ): { x: number; y: number; r: number } {
    let bestX = e.x;
    let bestY = e.y;
    let bestR = e.radius;
    let bestD = Math.hypot(e.x - refX, e.y - refY) - e.radius;
    // M12 Phase D: Arena-Leviathan — Schwachstellen (Arme/Ventile/Linse) + Panzer, Treffer wird gemerkt
    if (e.levArena && isLeviathanArena(this, e)) {
      const p = arenaClosestHitPoint(this, e, refX, refY);
      return { x: p.x, y: p.y, r: p.r };
    }
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

  public getDistanceToEnemyHitbox(e: Enemy, px: number, py: number): number {
    const hit = this.getClosestEnemyHitPoint(e, px, py);
    return Math.hypot(hit.x - px, hit.y - py) - hit.r;
  }

  public performBlasterShot(angle: number): void {
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

  public performPiercingBeam(angle: number): void {
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
    const rb = this.bounds;
    const rayMax = this.rayLimit(360);
    let maxT = rayMax;
    for (let t = 8; t < rayMax; t += 6) {
      const px = sx + dx * t;
      const py = sy + dy * t;
      if (px < rb.l || px > rb.r || py < rb.t || py > rb.b) {
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
      if (e.levArena && isLeviathanArena(this, e)) hit = arenaBeamHit(this, e, sx, sy, ex, ey);
      else if (!hit && e.kind === 'boss_leviathan' && e.levArms) {
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
    this.mechanics.onMeleeHitWhere((px, py) => this.pointToSegmentDist(px, py, sx, sy, ex, ey) <= 13);
    this.callbacks.onHudDirty();
  }

  public performHammerSwing(angle: number): void {
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
    this.mechanics.onMeleeHitWhere((px, py) => Math.hypot(px - this.playerX, py - this.playerY) <= radius + 12);

    if (hitAny) {
      this.hitStop = 0.055;
      this.state.energy = Math.min(100, this.state.energy + 14);
      this.callbacks.onHudDirty();
    }

    this.attackCooldown = isHeavy ? 0.5 : 0.38;
    this.comboStep = (this.comboStep + 1) % 2;
    this.comboResetTimer = 0.85;
  }

  public performGravShockwave(): void {
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
    this.mechanics.onMeleeHitWhere((px, py) => Math.hypot(px - this.playerX, py - this.playerY) <= maxR);
    this.callbacks.onHudDirty();
  }

  // ==================== KINETIK-FÄUSTE (4er-SERIE + KOMETEN-SPRUNG) ====================
  public performFistCombo(angle: number): void {
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
    this.mechanics.onMeleeHitWhere((px, py) => Math.hypot(px - punchX, py - punchY) <= range + 6);

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

  public performCometSlam(angle: number): void {
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

  public triggerCometImpact(): void {
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
    this.mechanics.onMeleeHitWhere((px, py) => Math.hypot(px - this.playerX, py - this.playerY) <= maxR);
  }

  // ==================== PHASEN-DISKUS (RICOCHET + MAGNET-RÜCKRUF / ORBIT) ====================
  public performDiscusThrow(angle: number): void {
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

  public performDiscusRecall(): void {
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

  public updateDiscs(dt: number): void {
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
        this.mechanics.onMeleeHitWhere((px, py) => Math.hypot(px - bx, py - by) <= 13);
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
        const rb = this.bounds;
        let nx = d.x + d.vx * dt;
        let ny = d.y + d.vy * dt;
        let bounced = false;

        // Room wall bounce
        if (nx <= rb.l + 7 || nx >= rb.r - 7) {
          d.vx = -d.vx;
          nx = Math.max(rb.l + 8, Math.min(rb.r - 8, nx));
          bounced = true;
        }
        if (ny <= rb.t + 7 || ny >= rb.b - 7) {
          d.vy = -d.vy;
          ny = Math.max(rb.t + 8, Math.min(rb.b - 8, ny));
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
      this.mechanics.onMeleeHitWhere((px, py) => Math.hypot(px - d.x, py - d.y) <= 14);

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

  public nudgeDiscTowardEnemy(d: DiscusProjectile, excludeId: number): boolean {
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
  public updateCompanion(dt: number): void {
    const comp = this.activeCompanion;
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

  public pointToSegmentDist(
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

  public moveEntityWithCollisions(dx: number, dy: number): void {
    const rb = this.bounds;
    const r = 6;
    const nx = Math.max(rb.l + r, Math.min(rb.r - r, this.playerX + dx));
    if (!this.collidesRoomObstacle(nx, this.playerY, r)) {
      this.playerX = nx;
    }
    const ny = Math.max(rb.t + r, Math.min(rb.b - r, this.playerY + dy));
    if (!this.collidesRoomObstacle(this.playerX, ny, r)) {
      this.playerY = ny;
    }
  }

  /** `includeMechanics = false`: nur die statischen Hindernisse (Projektile werden von den Prismen selbst behandelt). */
  public collidesRoomObstacle(x: number, y: number, r: number, includeMechanics = true): boolean {
    for (const ob of this.currentRoom.obstacles) {
      if (x + r > ob.x && x - r < ob.x + ob.w && y + r > ob.y && y - r < ob.y + ob.h) {
        return true;
      }
    }
    return includeMechanics && this.mechanics.collides(x, y, r);
  }

  public getChasmAt(x: number, y: number, margin = 0): ChasmRect | null {
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

  public collidesRoomChasm(x: number, y: number, r: number): boolean {
    return this.getChasmAt(x, y, r) !== null;
  }

  public checkDoorTransition(): void {
    const r = this.currentRoom;
    const rb = this.bounds;
    const doorHalf = 18;

    if (r.doors.north && Math.abs(this.playerX - rb.cx) < doorHalf && this.playerY <= rb.t + 8) {
      this.enterRoom(roomKey(r.gx, r.gy - 1), 'south');
    } else if (r.doors.south && Math.abs(this.playerX - rb.cx) < doorHalf && this.playerY >= rb.b - 8) {
      this.enterRoom(roomKey(r.gx, r.gy + 1), 'north');
    } else if (r.doors.west && Math.abs(this.playerY - rb.cy) < doorHalf && this.playerX <= rb.l + 8) {
      this.enterRoom(roomKey(r.gx - 1, r.gy), 'east');
    } else if (r.doors.east && Math.abs(this.playerY - rb.cy) < doorHalf && this.playerX >= rb.r - 8) {
      this.enterRoom(roomKey(r.gx + 1, r.gy), 'west');
    }
  }


  public damageEnemy(
    e: Enemy,
    amount: number,
    kx: number,
    ky: number,
    knockForce: number,
    piercing = false,
    allowInfusion = true,
  ): void {
    // M10-C (G4) Schilde mit Counterplay: Shield-Drone & Resonance-Warden blocken frontal 100 % —
    // ABER: der Schild fällt, solange der Gegner angreift (Fenster), und überhitzt nach mehreren Blocks.
    // Durchdringende Angriffe (z. B. Speer-Lanze) und Treffer von Seite/Rücken wirken voll.
    let finalAmt = amount;
    if ((e.kind === 'shield_drone' || e.kind === 'resonance_warden') && !piercing && (e.shieldDownTimer ?? 0) <= 0) {
      const cfg = ENEMY_SHIELDS[e.kind];
      const fromAngle = Math.atan2(-ky, -kx);
      const diff = Math.abs(this.normalizeAngle(fromAngle - e.aimAngle));
      if (diff <= cfg.arc) {
        const barrierColor = e.kind === 'resonance_warden' ? '#c084fc' : '#38e8d4';
        sound.playShieldBlock();
        this.spawnBurst(e.x + Math.cos(e.aimAngle) * 12, e.y + Math.sin(e.aimAngle) * 12, barrierColor, 8);
        e.shieldHeat = (e.shieldHeat ?? 0) + 1;
        const overheated = e.shieldHeat >= cfg.maxHeat;
        this.floats.push({
          x: e.x,
          y: e.y - e.radius - 10,
          text: overheated ? 'ÜBERHITZT!' : 'BLOCK',
          color: overheated ? '#fb923c' : e.kind === 'resonance_warden' ? '#e879f9' : '#67e8f9',
          life: overheated ? 0.9 : 0.5,
          maxLife: overheated ? 0.9 : 0.5,
        });
        if (overheated) {
          e.shieldDownTimer = cfg.overheatSec;
          e.shieldHeat = 0;
          this.spawnBurst(e.x, e.y, '#fb923c', 14);
        }
        e.flashTimer = 0.06;
        e.vx += kx * knockForce * 0.25;
        e.vy += ky * knockForce * 0.25;
        return;
      }
    }

    // Cryo-Stasis shatter bonus (+10% damage against chilled targets)
    if (e.cryoTimer && e.cryoTimer > 0) {
      finalAmt = Math.round(finalAmt * 1.1);
    }

    // Vex' Ionen-Kette passive Crit module (1.65x golden critical strike!)
    const stats = this.state.getStats();
    const isCrit = stats.critChance > 0 && Math.random() < stats.critChance;
    if (isCrit) {
      finalAmt = Math.round(finalAmt * 1.65);
    }

    // M12 Phase D: Arena-Leviathan nimmt nur an offenen Schwachstellen Schaden (sonst Funken + „GEPANZERT“)
    if (e.levArena && isLeviathanArena(this, e)) {
      finalAmt = leviathanArenaDamage(this, e, finalAmt);
      if (finalAmt <= 0) return;
    }
    e.hp -= finalAmt;
    if (e.splitGroup !== undefined) for (const o of this.enemies) if (o !== e && o.splitGroup === e.splitGroup) o.hp = e.hp; // gemeinsamer Pool
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

    const inf = allowInfusion ? this.state.getActiveInfusion() : 'none';
    const infDef = getInfusionDef(inf);

    sound.playHit();
    this.spawnBurst(
      e.x,
      e.y,
      isCrit ? '#fde047' : infDef ? infDef.color : '#38e8d4',
      isCrit ? 10 : 6,
    );
    // Polish Teil 2: Treffer am selben Gegner innerhalb 0,3 s zu EINER wachsenden Zahl zusammenfassen (Krits bleiben einzeln)
    const mergeInto = isCrit
      ? undefined
      : this.floats.find((f) => f.enemyId === e.id && f.sum !== undefined && this.time - (f.bornAt ?? 0) < 0.3);
    if (mergeInto) {
      mergeInto.sum = (mergeInto.sum ?? 0) + finalAmt;
      mergeInto.text = `${mergeInto.sum}`;
      mergeInto.life = mergeInto.maxLife;
    } else {
      this.floats.push({
        x: e.x + (Math.random() - 0.5) * 8,
        y: e.y - e.radius - 4,
        text: isCrit ? `KRIT! ${finalAmt}` : `${finalAmt}`,
        color: isCrit ? '#fde047' : infDef ? infDef.color : '#f8fafc',
        life: isCrit ? 0.85 : 0.65,
        maxLife: isCrit ? 0.85 : 0.65,
        ...(isCrit ? {} : { enemyId: e.id, sum: finalAmt, bornAt: this.time }),
      });
      if (this.floats.length > 48) this.floats.splice(0, this.floats.length - 48);
    }

    // Apply Elementar-Prägung effects (Milestone 7)
    if (inf === 'solar_burn') {
      e.burnTimer = 3.0;
      e.burnTickTimer = Math.min(e.burnTickTimer ?? 0.5, 0.5);
      e.burnDps = Math.max(5, Math.round(finalAmt * 0.14));
      this.spawnBurst(e.x, e.y, '#fb923c', 5);
    } else if (inf === 'cryo_stasis') {
      e.cryoTimer = 2.6;
      this.spawnBurst(e.x, e.y, '#67e8f9', 5);
    } else if (inf === 'ion_chain') {
      const chainTargets = this.enemies
        .filter((other) => other.id !== e.id && other.hp > 0 && Math.hypot(other.x - e.x, other.y - e.y) <= 94)
        .sort((a, b) => Math.hypot(a.x - e.x, a.y - e.y) - Math.hypot(b.x - e.x, b.y - e.y))
        .slice(0, 2);
      const chainDmg = Math.max(4, Math.round(finalAmt * 0.38));
      for (const target of chainTargets) {
        this.lightningArcs.push({
          x1: e.x,
          y1: e.y,
          x2: target.x,
          y2: target.y,
          life: 0.22,
          maxLife: 0.22,
          color: '#fde047',
        });
        this.damageEnemy(target, chainDmg, 0, 0, 0, true, false);
      }
    } else if (inf === 'void_siphon') {
      this.siphonHitCounter += 1;
      if (this.siphonHitCounter >= 4) {
        this.siphonHitCounter = 0;
        const healHp = Math.max(4, Math.round(stats.maxHp * 0.04));
        const ang = Math.atan2(this.playerY - e.y, this.playerX - e.x) + (Math.random() - 0.5) * 0.8;
        this.siphonOrbs.push({
          x: e.x,
          y: e.y,
          vx: Math.cos(ang) * 90,
          vy: Math.sin(ang) * 90,
          life: 2.2,
          healHp,
          healEn: 14,
        });
        this.spawnBurst(e.x, e.y, '#e879f9', 7);
      }
    }

    if (e.hp <= 0) {
      this.onEnemyKilled(e);
    }
  }

  /** M11 Teilen: Boss in zwei Hälften teilen (gemeinsamer HP-Pool, eine Boss-Leiste). Nur einmal pro Boss. */
  public splitBoss(e: Enemy): boolean {
    if (e.splitGroup !== undefined || !this.enemies.includes(e)) return false;
    const rb = this.bounds;
    const side = e.x > rb.cx ? -1 : 1;
    const twin: Enemy = { ...e, id: this.nextEnemyId++, x: Math.max(rb.l + 30, Math.min(rb.r - 30, e.x + side * 46)), vx: 0, vy: 0, flashTimer: 0, splitRole: 1 };
    e.splitGroup = e.id;
    e.splitRole = 0;
    twin.splitGroup = e.id;
    for (const h of [e, twin]) {
      h.radius = Math.max(8, Math.round(h.radius * 0.85));
      h.bossSub = 'idle';
      h.bossStateTimer = 1.1;
      h.bossMoveIdx = h.splitRole === 1 ? 1 : 0;
    }
    this.enemies.push(twin);
    this.spawnBurst(twin.x, twin.y, '#e879f9', 22);
    this.spawnBurst(e.x, e.y, '#e879f9', 22);
    this.callbacks.onToast('⚠ Der Boss teilt sich! Beide Hälften teilen sich dieselben Lebenspunkte.', 'warn');
    return true;
  }

  /** M11 Teilen: Pool angleichen (HP aller Hälften gleich) und bei ≤ 15 % HP wieder vereinen. Pro Frame aus dem Update. */
  public syncSplitPools(): void {
    for (const a of this.enemies) {
      if (a.splitGroup === undefined || a.splitRole !== 0) continue;
      const group = this.enemies.filter((o) => o.splitGroup === a.splitGroup);
      const pool = Math.min(...group.map((o) => o.hp));
      for (const o of group) o.hp = pool;
      if (group.length === 2) {
        // Hälften nicht übereinander stehen lassen
        const [h0, h1] = group;
        const ddx = h1.x - h0.x || 1;
        const ddy = h1.y - h0.y;
        const dd = Math.hypot(ddx, ddy);
        if (dd < 30) {
          const push = (30 - dd) * 0.08;
          h0.x -= (ddx / dd) * push;
          h0.y -= (ddy / dd) * push;
          h1.x += (ddx / dd) * push;
          h1.y += (ddy / dd) * push;
        }
      }
      if (group.length > 1 && pool <= a.maxHp * 0.15) {
        for (const o of group) if (o !== a) this.enemies.splice(this.enemies.indexOf(o), 1);
        a.splitGroup = undefined;
        a.splitRole = undefined;
        a.radius = Math.round(a.radius / 0.85);
        this.spawnBurst(a.x, a.y, '#fde047', 24);
        this.callbacks.onToast('Die Hälften verschmelzen wieder!', 'warn');
      }
    }
  }

  private readonly killedSplitGroups = new Set<number>();

  public onEnemyKilled(e: Enemy): void {
    if (e.splitGroup !== undefined) {
      // M11 Teilen: Sieg/Belohnung nur einmal — die andere Hälfte verschwindet still
      if (this.killedSplitGroups.has(e.splitGroup)) return;
      this.killedSplitGroups.add(e.splitGroup);
      for (let j = this.enemies.length - 1; j >= 0; j--) if (this.enemies[j] !== e && this.enemies[j].splitGroup === e.splitGroup) this.enemies.splice(j, 1);
    }
    const idx = this.enemies.indexOf(e);
    if (idx !== -1) this.enemies.splice(idx, 1);
    if (this.isBossKind(e.kind)) this.bossFx.clear(); // M10-C: Boss-Zonen/Strahlen enden mit dem Boss
    if (e.kind === 'boss') {
      // D15/D7: Todes-Sequenz + Rückstand je Boden-Biom (nur Optik)
      this.decals.push({ x: e.x, y: e.y + 6, r: 16, color: 'rgba(0,0,0,0)', life: 1.3, maxLife: 1.3, fx: 'cw_death' });
      this.decals.push({ x: e.x, y: e.y + 8, r: 16, color: 'rgba(0,0,0,0)', life: 40, maxLife: 40, fx: 'cw_remnant' });
    }
    // Polish Teil 2: Hit-Stop bei Boss-Sieg / Elite-Kill (nur Darstellung, Logik pausiert kurz gleichmäßig)
    if (this.isBossKind(e.kind)) this.heavyStop = Math.max(this.heavyStop, 0.12);
    else if (e.elite) this.heavyStop = Math.max(this.heavyStop, 0.06);

    // 🔥 Solar-Brand Kill-Nova: burning enemies explode in a fiery shockwave on defeat!
    if (e.burnTimer && e.burnTimer > 0) {
      this.shockwaves.push({
        x: e.x,
        y: e.y,
        maxRadius: 56,
        color: '#fb923c',
        life: 0.3,
        maxLife: 0.3,
      });
      this.spawnBurst(e.x, e.y, '#fb923c', 16);
      const novaDmg = Math.max(8, Math.round(e.maxHp * 0.22));
      const victims = [...this.enemies].filter(
        (other) => other.hp > 0 && Math.hypot(other.x - e.x, other.y - e.y) <= 58,
      );
      for (const v of victims) {
        this.damageEnemy(v, novaDmg, (v.x - e.x) / 30, (v.y - e.y) / 30, 80, true, false);
      }
    }

    this.enemiesDefeated += 1;
    if (!this.isWeeklyTrial) this.state.totalEnemiesDefeated += 1;
    sound.playEnemyDefeat();
    const isBoss = this.isBossKind(e.kind);
    this.spawnBurst(e.x, e.y, isBoss ? '#fbbf24' : '#c084fc', isBoss ? 36 : 14);

    const nightBoost = this.state.timeOfDay === 'night';
    const luckBonus = this.state.getStats().lootLuckBonus;
    const lootDepth = this.currentRoom.depth + (this.currentFloor - 1);
    const sec = this.currentSector;

    if (this.isWeeklyTrial && isBoss) {
      this.handleTrialBossKilled(e);
    } else if (e.kind === 'boss_breacher') {
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
        'SIEG! Schrott-Sammler „Krall“ besiegt! Links: Extraktion · Rechts: Tiefen-Aufzug → Ebene II!',
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
        'SIEG! Kern-Wächter MK-IV besiegt! Links: Extraktion · Rechts: Tiefen-Aufzug → Ebene III (Endboss)!',
        'good',
      );
      this.state.save();
    } else if (e.kind === 'boss_leviathan') {
      if (e.levArena && isLeviathanArena(this, e)) onLeviathanArenaDefeated(this, e);
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
      const firstLeviathanWin = !this.state.hasLeviathanTrophy();
      this.state.sector1Cleared = true;
      this.sector1ClearedInRun = true;
      this.state.recordSectorClear(1, this.runElapsedSec);
      // Drop Leviathan Omega Core + 4 rare/epic relics in center of arena!
      const dropY = this.bounds.cy - 12;
      this.spawnLootDrop(this.bounds.cx, dropY, 'leviathan_core');
      this.spawnLootDrop(this.bounds.cx - 18, dropY + 4, 'aegis_plate');
      // M12 (E): Trophäen-Relikt beim Erstsieg (nie in der Wochen-Prüfung — die läuft über handleTrialBossKilled)
      if (firstLeviathanWin) this.spawnLootDrop(this.bounds.cx + 18, dropY + 4, 'trophy_leviathan');
      for (let k = 0; k < 3; k++) {
        this.spawnLootDrop(
          this.bounds.cx + (k - 1) * 16,
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
      const dropY = this.bounds.cy - 10;
      this.spawnLootDrop(this.bounds.cx, dropY, 'archon_heart');
      this.spawnLootDrop(this.bounds.cx - 18, dropY + 4, 'prism_matrix');
      for (let k = 0; k < 3; k++) {
        this.spawnLootDrop(
          this.bounds.cx + (k - 1) * 16,
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
      this.callbacks.onToast('SIEG! Gießerei-Meisterin besiegt! Links: Extraktion · Rechts: Tiefen-Aufzug → Ebene III (★ VULKAN-TITAN)!', 'good');
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
      const dropY = this.bounds.cy - 10;
      this.spawnLootDrop(this.bounds.cx, dropY, 'vulkan_heart');
      this.spawnLootDrop(this.bounds.cx - 18, dropY + 4, 'solar_core');
      for (let k = 0; k < 3; k++) {
        this.spawnLootDrop(this.bounds.cx + (k - 1) * 16, dropY + 8, rollLootItem(3, true, nightBoost, luckBonus, 3));
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
      const dropY = this.bounds.cy - 10;
      this.spawnLootDrop(this.bounds.cx, dropY, 'archon_crown');
      this.spawnLootDrop(this.bounds.cx - 18, dropY + 4, 'celestial_matrix');
      for (let k = 0; k < 3; k++) {
        this.spawnLootDrop(this.bounds.cx + (k - 1) * 16, dropY + 8, rollLootItem(3, true, nightBoost, luckBonus, 4));
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
      const dropY = this.bounds.cy - 10;
      this.spawnLootDrop(this.bounds.cx, dropY, 'archon_crown');
      this.spawnLootDrop(this.bounds.cx - 18, dropY + 4, 'vulkan_heart');
      this.spawnLootDrop(this.bounds.cx + 18, dropY + 4, 'archon_heart');
      this.spawnLootDrop(this.bounds.cx, dropY + 12, 'celestial_matrix');
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
        if (this.activeCompanion === 'puck' && Math.random() < 0.25) {
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

    // Check live Companion Bot milestone unlocks (Spark / Luma / Halo)! (nicht in der Prüfung)
    const newlyUnlocked = this.isWeeklyTrial ? [] : this.state.checkCompanionUnlocks();
    for (const cid of newlyUnlocked) {
      sound.playCompanionUnlock();
      this.callbacks.onToast(
        `🤖 Begleiter freigeschaltet: ${COMPANION_DEFS[cid].name}! Im Hinterzimmer am Drohnen-Dock ausrüstbar!`,
        'good',
      );
    }

    if (this.enemies.length === 0 && !this.currentRoom.cleared) {
      // Milestone 7: Rift Anomaly Chamber Wave 2 trigger!
      if (
        this.currentRoom.isRiftChamber &&
        !this.currentRoom.riftWave2Triggered &&
        this.currentRoom.riftWave2Spawns &&
        this.currentRoom.riftWave2Spawns.length > 0
      ) {
        this.currentRoom.riftWave2Triggered = true;
        this.triggerShake(0.28, 3.4);
        sound.playDoorUnlock();
        for (const sp of this.currentRoom.riftWave2Spawns) {
          this.spawnBurst(sp.x, sp.y, '#c084fc', 16);
          this.spawnEnemy(sp.kind, sp.x, sp.y);
          if (sp.elite) this.makeElite(this.enemies[this.enemies.length - 1]);
        }
        this.callbacks.onToast('🌀 RIFT-WELLE 2! Verstärkte Anomalie-Wächter erscheinen!', 'warn');
        return;
      }
      // M10-C: dritte Welle ab Ebene II
      if (
        this.currentRoom.isRiftChamber &&
        !this.currentRoom.riftWave3Triggered &&
        this.currentRoom.riftWave3Spawns &&
        this.currentRoom.riftWave3Spawns.length > 0
      ) {
        this.currentRoom.riftWave3Triggered = true;
        this.triggerShake(0.34, 4.2);
        sound.playDoorUnlock();
        for (const sp of this.currentRoom.riftWave3Spawns) {
          this.spawnBurst(sp.x, sp.y, '#e879f9', 18);
          this.spawnEnemy(sp.kind, sp.x, sp.y);
          if (sp.elite) this.makeElite(this.enemies[this.enemies.length - 1]);
        }
        this.callbacks.onToast('🌀 RIFT-WELLE 3! Die Anomalie schlägt zurück!', 'warn');
        return;
      }

      this.currentRoom.cleared = true;
      this.roomsCleared += 1;
      sound.playDoorUnlock();

      if (this.currentRoom.isRiftChamber) {
        // Rift Chamber cleared! Mark parent portal cleared & drop guaranteed Rift Catalyst + Anomaly Relic!
        const parentRoom = this.currentRoom.riftParentKey
          ? this.floor.rooms.get(this.currentRoom.riftParentKey)
          : undefined;
        if (parentRoom?.riftPortal) parentRoom.riftPortal.cleared = true;
        this.state.recordRiftChamberCleared();
        this.spawnLootDrop(this.bounds.cx - 18, this.bounds.cy, 'rift_catalyst');
        this.spawnLootDrop(this.bounds.cx + 18, this.bounds.cy, rollRiftLootItem(Math.max(2, this.currentSector)));
        this.state.save();
        this.callbacks.onToast(
          '🌀 RIFT STABILISIERT! Rift-Katalysator & Anomalie-Relikt erbeutet — öffne die Truhe & kehre zurück!',
          'good',
        );
      } else if (this.isEndlessRift && this.currentRoom.type === 'boss') {
        // Endless Spiral floor cleared! Record deepest Rift floor & grant Rift relic drops scaled by depth!
        this.floorBossDefeated = true;
        const isRecord = this.state.recordRiftDepth(this.riftDepth);
        const bonusDrops = 1 + Math.floor(this.riftDepth / 3);
        this.spawnLootDrop(this.bounds.cx - 16, this.bounds.cy - 12, 'rift_catalyst');
        for (let k = 0; k < bonusDrops; k++) {
          this.spawnLootDrop(
            this.bounds.cx + (k - 0.5) * 20,
            this.bounds.cy - 6,
            rollRiftLootItem(this.riftDepth),
          );
        }
        this.state.save();
        this.callbacks.onToast(
          `🌀 SPIRAL-EBENE ${this.riftDepth} GEMEISTERT${isRecord ? ' (NEUER REKORD!)' : ''}! Links: Extraktion · Rechts: Tiefer → Ebene ${this.riftDepth + 1}!`,
          'good',
        );
      } else if (this.currentRoom.type === 'combat') {
        this.spawnLootDrop(
          this.bounds.cx,
          this.bounds.cy,
          this.isEndlessRift
            ? Math.random() < 0.45
              ? rollRiftLootItem(this.riftDepth)
              : rollLootItem(lootDepth, true, nightBoost, luckBonus, this.floor.visualSector ?? 1)
            : rollLootItem(lootDepth, false, nightBoost, luckBonus, sec),
        );
        if (this.currentRoom.riftPortal && !this.currentRoom.riftPortal.cleared) {
          this.spawnBurst(this.currentRoom.riftPortal.x, this.currentRoom.riftPortal.y, '#c084fc', 22);
          this.callbacks.onToast('🌀 Ein instabiler RIFT-RISS hat sich in diesem Raum geöffnet!', 'info');
        }
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
      if (this.activeCompanion === 'luma' && this.currentRoom.type === 'combat') {
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

  /** Prüfungs-Boss besiegt: nur Effekte + Ebenen-Ausgang — KEINE Progression, KEINE Beute. */
  private handleTrialBossKilled(e: Enemy): void {
    this.triggerShake(0.6, 6.0);
    this.shockwaves.push({ x: e.x, y: e.y, maxRadius: 120, color: '#fde047', life: 0.5, maxLife: 0.5 });
    this.spawnBurst(e.x, e.y, '#fde047', 34);
    this.floorBossDefeated = true;
    for (let j = this.enemies.length - 1; j >= 0; j--) {
      if (!this.isBossKind(this.enemies[j].kind)) this.enemies.splice(j, 1);
    }
    this.callbacks.onToast(
      this.currentFloor >= TRIAL_FLOORS
        ? '🏅 PRÜFUNG GESCHAFFT! Tritt in den Sieges-Transporter, um dein Ergebnis zu melden!'
        : `🏅 Ebene ${this.currentFloor} gemeistert! Links: Prüfung abbrechen · Rechts: Tiefen-Aufzug → Ebene ${this.currentFloor + 1}`,
      'good',
    );
  }

  /** Beendet die Prüfung: Ergebnis speichern, Inventar bleibt UNBERÜHRT (kein Verlust, keine Beute). */
  public finishWeeklyTrial(outcome: TrialOutcome): void {
    if (this.finished || !this.trialInfo) return;
    this.finished = true;
    sound.playWarp();
    const info = this.trialInfo;
    const completed = outcome === 'victory';
    const timeSec = Math.max(1, Math.round(this.runElapsedSec));
    const result = this.state.recordWeeklyTrialResult({
      weekId: info.weekId,
      sector: info.sector,
      completed,
      timeSec,
      floorReached: this.maxFloorReached,
      roomsCleared: this.roomsCleared,
    });
    const summary: RunSummary = {
      victory: completed,
      reason: completed ? 'boss_victory' : outcome === 'defeat' ? 'defeat' : 'warp',
      sector: info.sector,
      floorReached: this.maxFloorReached,
      runDurationSec: timeSec,
      roomsCleared: this.roomsCleared,
      enemiesDefeated: this.enemiesDefeated,
      itemsSaved: 0,
      itemsLost: 0,
      warpedToChest: [],
      shatteredItems: [],
      isWeeklyTrial: true,
      trialOutcome: outcome,
      trialResult: result,
    };
    this.state.activeTrial = null;
    this.isWeeklyTrial = false;
    this.trialInfo = null;
    this.state.restoreFullVitals();
    this.callbacks.onReturnToHub(summary);
  }

  public damagePlayer(amount: number, kx: number, ky: number, attacker?: Enemy): void {
    if (this.invulnTimer > 0 || this.finished) return;

    // M10-C: Instabile Risse (Kammer) schlagen härter — Faktor nach Sektor & Ebene (nicht in Spirale/Prüfung)
    if (this.currentRoom.isRiftChamber && !this.isEndlessRift && !this.isWeeklyTrial) {
      amount = Math.round(
        amount * RIFT_SCALING.damageFactor(this.currentRoom.riftSector ?? this.currentSector, this.currentRoom.riftFloor ?? this.currentFloor),
      );
    }
    // Milestone 7 Rift Mutators: Overcharged deals +25% damage; Vampiric heals attacker on hit!
    if (attacker?.mutator === 'overcharged') {
      amount = Math.round(amount * 1.25);
    }
    if (attacker?.mutator === 'vampiric' && attacker.hp > 0) {
      const leach = Math.max(4, Math.round(attacker.maxHp * 0.06));
      attacker.hp = Math.min(attacker.maxHp, attacker.hp + leach);
      this.spawnBurst(attacker.x, attacker.y, '#f43f5e', 6);
    }

    // Aegis-Bot Halo: golden orbital shield completely absorbs 1 incoming hit every 12s!
    if (this.activeCompanion === 'halo' && this.haloShieldReady) {
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
          haptic([15, 30, 15]);
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
    this.moveEntityWithCollisions(kx * 10, ky * 10);

    if (finalAmount === amount) {
      sound.playPlayerHurt();
      haptic(35);
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

  public breakPod(pod: DungeonRoom['pods'][number]): void {
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

  public spawnLootDrop(x: number, y: number, itemId: string): void {
    if (this.isWeeklyTrial) return; // Prüfung: keine Beute!
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

  public updateProjectiles(dt: number): void {
    const rb = this.bounds;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      if (p.homing && !p.fromPlayer && p.life > (p.homingUntilLife ?? 0)) {
        // Faust verfolgt den Spieler: Flugrichtung dreht mit begrenzter Rate zum Ziel, Tempo bleibt gleich
        const sp = Math.hypot(p.vx, p.vy);
        const cur = Math.atan2(p.vy, p.vx);
        const want = Math.atan2(this.playerY - p.y, this.playerX - p.x);
        const diff = Math.atan2(Math.sin(want - cur), Math.cos(want - cur));
        const turn = Math.max(-p.homing * dt, Math.min(p.homing * dt, diff));
        p.vx = Math.cos(cur + turn) * sp;
        p.vy = Math.sin(cur + turn) * sp;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.sprite === 'fist' && p.life <= 0) this.spawnBurst(p.x, p.y, '#fb7185', 8); // Faust löst sich auf
      if (p.sprite === 'scrap' && p.life <= 0) this.spawnBurst(p.x, p.y, '#fb923c', 6); // Schrottklumpen zerplatzt

      // Milestone 10-A: Kristall-Prismen spiegeln/teilen Projektile, BEVOR die Wand-Prüfung greift
      const mechRes = this.mechanics.handleProjectile(p);
      if (mechRes === 'absorbed' || mechRes === 'split') {
        this.projectiles.splice(i, 1);
        continue;
      }

      const hitWall =
        p.x < rb.l ||
        p.x > rb.r ||
        p.y < rb.t ||
        p.y > rb.b ||
        this.collidesRoomObstacle(p.x, p.y, p.radius, false);

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
              haptic([15, 30, 15]);
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

  public updateDrops(dt: number): void {
    const rb = this.bounds;
    const hasPuck = this.activeCompanion === 'puck';
    const magnetRadius = hasPuck ? 116 : 44;
    const pullSpeed = hasPuck ? 185 : 135;

    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.age += dt;
      d.vx *= Math.pow(0.04, dt);
      d.vy *= Math.pow(0.04, dt);
      d.x = Math.max(rb.l + 8, Math.min(rb.r - 8, d.x + d.vx * dt));
      d.y = Math.max(rb.t + 8, Math.min(rb.b - 8, d.y + d.vy * dt));

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

  public updateRoomInteractions(input: InputManager): void {
    this.activePrompt = null;

    // Milestone 7: Cleared Rift Anomaly Chamber return portal
    if (this.currentRoom.isRiftChamber && this.currentRoom.cleared) {
      const rx = this.bounds.cx;
      const ry = this.bounds.b - 28;
      if (Math.hypot(this.playerX - rx, this.playerY - ry) < 28) {
        this.activePrompt = {
          label: '[E] 🌀 Rift-Ausgang: Zurück in den Sektor',
          x: rx,
          y: ry - 22,
        };
        if (input.interactPressed()) {
          this.exitRiftChamber();
        }
        return;
      }
    }

    // Milestone 7: Unstable Rift-Riss portal inside cleared regular combat room
    if (
      this.currentRoom.cleared &&
      this.currentRoom.riftPortal &&
      !this.currentRoom.riftPortal.cleared
    ) {
      const rp = this.currentRoom.riftPortal;
      if (Math.hypot(this.playerX - rp.x, this.playerY - rp.y) < 26) {
        this.activePrompt = {
          label: `[E] 🌀 Instabilen Rift betreten · Gefahr ${this.riftDangerStars(this.currentRoom.riftSector ?? this.currentSector, this.currentRoom.riftFloor ?? this.currentFloor)}`,
          x: rp.x,
          y: rp.y - 24,
        };
        if (input.interactPressed()) {
          this.enterRiftChamber(rp.targetKey);
        }
        return;
      }
    }

    if (this.currentRoom.type === 'secret') {
      const rx = this.bounds.cx;
      const ry = this.bounds.b - 28;
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

    // M10-C: Notfall-Bake (ab Ebene II, nach Raum-Clear, einmalig) — einziger Teleporter außerhalb von Start-Raum & Bossen
    const beacon = this.currentRoom.extractBeacon;
    if (beacon && !beacon.used && this.currentRoom.cleared && !this.isWeeklyTrial) {
      if (Math.hypot(this.playerX - beacon.x, this.playerY - beacon.y) < 26) {
        this.activePrompt = {
          label: '[E] Notfall-Bake: Extraktion (einmalig · Beute sichern)',
          x: beacon.x,
          y: beacon.y - 26,
        };
        if (input.interactPressed()) {
          beacon.used = true;
          this.triggerSafeWarp('warp');
        }
        return;
      }
    }

    if (this.currentRoom.type === 'start') {
      if (Math.hypot(this.playerX - this.bounds.cx, this.playerY - (this.bounds.cy - 12)) < 28) {
        this.activePrompt = {
          label: this.isWeeklyTrial
            ? '[E] Prüfung abbrechen (zählt als Versuch)'
            : '[E] Extraktion: Raumhafen Port Solaris (Gratis)',
          x: this.bounds.cx,
          y: this.bounds.cy - 32,
        };
        if (input.interactPressed()) {
          this.triggerSafeWarp('warp');
        }
        return;
      }

      // Floor III Start Room: One-time Emergency Med-Terminal before Leviathan!
      if (this.currentRoom.hasHealStation && !this.currentRoom.healStationUsed) {
        const hx = this.bounds.cx + 70;
        const hy = this.bounds.cy - 12;
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
              this.isEndlessRift
                ? `Notfall-Medstation genutzt — bereit für ∞ Spirale Ebene ${this.riftDepth}!`
                : this.currentSector === 5
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
      if (this.isEndlessRift) {
        // Endless Spiral Dual Risk-Reward Choice: Left = Extract with Loot, Right = Descend to Depth + 1!
        const exX = this.bounds.cx - 48;
        const elX = this.bounds.cx + 48;
        const padY = this.bounds.cy + 6;
        if (Math.hypot(this.playerX - exX, this.playerY - padY) < 28) {
          this.activePrompt = {
            label: '[E] ⇪ Sicher extrahieren (Beute behalten)',
            x: exX,
            y: padY - 24,
          };
          if (input.interactPressed()) {
            this.triggerSafeWarp('boss_victory');
          }
          return;
        }
        if (Math.hypot(this.playerX - elX, this.playerY - padY) < 28) {
          const nextDepth = this.riftDepth + 1;
          this.activePrompt = {
            label: `[E] 🌀 Tiefer in die Spirale → Ebene ${nextDepth}${nextDepth % 3 === 0 ? ' (BOSS!)' : ''}`,
            x: elX,
            y: padY - 24,
          };
          if (input.interactPressed()) {
            sound.playWarp();
            this.startEndlessRiftFloor(nextDepth, false);
          }
          return;
        }
      } else if (this.currentFloor < 3 && this.currentSector !== 5) {
        // Dual Moonlighter Exit Choice: Left = Safe Extraction, Right = Descend Deeper!
        const exX = this.bounds.cx - 48;
        const elX = this.bounds.cx + 48;
        const padY = this.bounds.cy + 6;
        if (Math.hypot(this.playerX - exX, this.playerY - padY) < 28) {
          this.activePrompt = {
            label: this.isWeeklyTrial
              ? '[E] Prüfung abbrechen (zählt als Versuch)'
              : '[E] Extraktion: Raumhafen Port Solaris (Beute sichern)',
            x: exX,
            y: padY - 24,
          };
          if (input.interactPressed()) {
            this.triggerSafeWarp('boss_victory');
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
        const vx = this.bounds.cx;
        const vy = this.bounds.cy + 12;
        if (Math.hypot(this.playerX - vx, this.playerY - vy) < 32) {
          this.activePrompt = {
            label: this.isWeeklyTrial
              ? '[E] 🏅 PRÜFUNG GESCHAFFT! Sieges-Transporter → Ergebnis melden'
              : this.currentSector === 5
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
            this.triggerSafeWarp('boss_victory');
          }
          return;
        }
      }
    }

    if (this.isWeeklyTrial && this.currentRoom.chest) {
      const sealed = this.currentRoom.chest;
      if (Math.hypot(this.playerX - sealed.x, this.playerY - sealed.y) < 30) {
        this.activePrompt = { label: '🏅 Prüfungs-Truhe versiegelt — hier zählt nur Ruhm!', x: sealed.x, y: sealed.y - 20 };
        if (input.interactPressed()) {
          sound.playUiClick();
          this.callbacks.onToast('🏅 Prüfungs-Truhe versiegelt — hier zählt nur Ruhm!', 'info');
        }
      }
    }
    const chest = this.isWeeklyTrial ? undefined : this.currentRoom.chest;
    if (chest) {
      if (Math.hypot(this.playerX - chest.x, this.playerY - chest.y) < 30) {
        const remaining = chest.slots
          ? chest.slots.reduce((acc, s) => acc + (s ? s.qty : 0), 0)
          : 0;
        const chestTitle = chest.boss ? '★ Boss-Truhe' : chest.secret ? '★ Geheime Schatztruhe' : 'Relikt-Truhe';
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
            if (this.activeCompanion === 'puck' && Math.random() < 0.25) {
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

  public triggerSafeWarp(reason: 'warp' | 'boss_victory'): void {
    if (this.finished) return;
    if (this.isWeeklyTrial) {
      // Prüfung: Sieg nur über den Sieges-Transporter nach dem Ebene-3-Boss, sonst Abbruch (keine Gebühr)
      const won = reason === 'boss_victory' && this.currentFloor >= TRIAL_FLOORS && this.floorBossDefeated;
      this.finishWeeklyTrial(won ? 'victory' : 'abort');
      return;
    }
    this.finished = true;
    sound.playWarp();
    const res = processSafeReturnEffects(this.state.inventory);
    const consumedBuff = this.state.consumeAlchemyBuff();
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
      isEndlessRift: this.isEndlessRift,
      riftDepthReached: this.isEndlessRift ? this.riftDepth : undefined,
      riftLootMultiplier: this.isEndlessRift ? this.riftLootMultiplier : undefined,
      consumedAlchemyBuff: consumedBuff,
      sector1Cleared: this.sector1ClearedInRun,
      sector2Cleared: this.sector2ClearedInRun,
      sector3Cleared: this.sector3ClearedInRun,
      sector4Cleared: this.sector4ClearedInRun,
      omegaCleared: this.omegaClearedInRun,
    });
  }

  public triggerDefeat(): void {
    if (this.finished) return;
    if (this.isWeeklyTrial) {
      this.finishWeeklyTrial('defeat');
      return;
    }
    this.finished = true;
    sound.playWarp();
    const res = processDefeatPenalty(this.state.inventory);
    const consumedBuff = this.state.consumeAlchemyBuff();
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
      isEndlessRift: this.isEndlessRift,
      riftDepthReached: this.isEndlessRift ? this.riftDepth : undefined,
      consumedAlchemyBuff: consumedBuff,
      sector1Cleared: false,
      sector2Cleared: false,
      sector3Cleared: false,
      sector4Cleared: false,
      omegaCleared: false,
    });
  }

  public spawnBurst(x: number, y: number, color: string, count: number): void {
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

  public triggerShake(duration: number, mag: number): void {
    this.shakeTimer = Math.max(this.shakeTimer, duration);
    this.shakeMag = Math.max(this.shakeMag, mag);
  }

  public updateEffects(dt: number): void {
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
    for (let i = this.lightningArcs.length - 1; i >= 0; i--) {
      this.lightningArcs[i].life -= dt;
      if (this.lightningArcs[i].life <= 0) this.lightningArcs.splice(i, 1);
    }
    for (let i = this.siphonOrbs.length - 1; i >= 0; i--) {
      const o = this.siphonOrbs[i];
      o.life -= dt;
      const dx = this.playerX - o.x;
      const dy = this.playerY - o.y;
      const dist = Math.max(1, Math.hypot(dx, dy));
      o.vx += (dx / dist) * 560 * dt;
      o.vy += (dy / dist) * 560 * dt;
      const sp = Math.hypot(o.vx, o.vy);
      if (sp > 230) {
        o.vx = (o.vx / sp) * 230;
        o.vy = (o.vy / sp) * 230;
      }
      o.x += o.vx * dt;
      o.y += o.vy * dt;
      if (dist < 14) {
        const stats = this.state.getStats();
        const prevHp = this.state.hp;
        this.state.hp = Math.min(stats.maxHp, this.state.hp + o.healHp);
        this.state.energy = Math.min(100, this.state.energy + o.healEn);
        const gained = Math.round(this.state.hp - prevHp);
        this.spawnBurst(this.playerX, this.playerY, '#e879f9', 8);
        this.floats.push({
          x: this.playerX,
          y: this.playerY - 18,
          text: gained > 0 ? `+${gained} HP +${o.healEn} EN` : `+${o.healEn} EN`,
          color: '#e879f9',
          life: 0.9,
          maxLife: 0.9,
        });
        this.callbacks.onHudDirty();
        this.siphonOrbs.splice(i, 1);
        continue;
      }
      if (o.life <= 0) this.siphonOrbs.splice(i, 1);
    }
    updateDetached(this.detached, dt);
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

  public normalizeAngle(a: number): number {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  }


  public render(ctx: CanvasRenderingContext2D, input: InputManager): void {
    this.dungeonRenderer.render(ctx, input);
  }
}
