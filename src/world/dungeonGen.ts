import { applySectorMechanics, findFreeSpotSpiral, placeExtractBeacon } from '../dungeon/mechanicsGen';
import type { ItemStack, SectorId } from '../types';

export type RoomType = 'start' | 'combat' | 'treasure' | 'boss' | 'secret';

export type DoorSide = 'north' | 'south' | 'east' | 'west';

export interface ObstacleRect {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: 'pillar' | 'conduit' | 'crate' | 'crystal_spire' | 'bulkhead_wall' | 'forge_pillar' | 'monolith_obelisk';
}

export interface ChasmRect {
  x: number;
  y: number;
  w: number;
  h: number;
  /** True if falling into this chasm drops the player into a Moonlighter-style Secret Underground Vault! */
  secret?: boolean;
  secretVisited?: boolean;
}

export type RoomLayoutStyle =
  | 'open_pillars'
  | 'twin_conduits'
  | 'center_chasm'
  | 'cross_bridges'
  | 'dash_gorge'
  | 'flanking_trenches'
  | 'stepping_stones';

export interface DestructiblePod {
  id: number;
  x: number;
  y: number;
  hp: number;
  broken: boolean;
}

export interface RoomChest {
  x: number;
  y: number;
  opened: boolean;
  rare: boolean;
  secret?: boolean;
  slots?: Array<ItemStack | null>;
}

export interface HazardVent {
  x: number;
  y: number;
  r: number;
  phase: number;
}

// ==================== MEILENSTEIN 10-A: SEKTOR-RAUM-MECHANIKEN ====================
/** S2: solides, reflektierendes Kristall-Prisma. */
export interface CrystalPrism {
  id: number;
  x: number;
  y: number;
  r: number;
}

/** S3: periodischer Flammenstrahl (Linien-Gefahr). */
export interface FlameJet {
  /** Mittelpunkt */
  x: number;
  y: number;
  /** h = horizontaler Strahl, v = vertikaler Strahl */
  axis: 'h' | 'v';
  length: number;
  /** Sekunden-Offset im Zyklus */
  phase: number;
}

/** S3: Magnetplatte (Kreisfeld, zieht oder stößt ab). */
export interface MagnetPlate {
  x: number;
  y: number;
  r: number;
  polarity: 'pull' | 'push';
  phase: number;
}

/** S4: Astral-Teleporter-Pad, immer paarweise (gleiche pairId/Farbe). */
export interface TeleportPad {
  id: number;
  pairId: number;
  x: number;
  y: number;
  colorIdx: 0 | 1 | 2;
}

export interface EnemySpawn {
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
    // Sector 2: Kristall-Nebel enemies & bosses
    | 'crystal_crawler'
    | 'prism_drone'
    | 'shard_sniper'
    | 'void_crawler'
    | 'resonance_warden'
    | 'boss_quartz_golem'
    | 'boss_prism_weaver'
    | 'boss_prisma_archon'
    // Sector 3: Solar-Gießerei enemies & bosses
    | 'slag_beetle'
    | 'solar_drone'
    | 'magma_mortar'
    | 'ember_stalker'
    | 'forge_golem'
    | 'boss_slag_overlord'
    | 'boss_forge_warden'
    | 'boss_vulkan_titan'
    // Sector 4: Ältesten-Monolith & Sector 5: Omega-Anomalie enemies & bosses
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
}

export interface DungeonRoom {
  key: string;
  gx: number;
  gy: number;
  depth: number;
  type: RoomType;
  layoutStyle?: RoomLayoutStyle;
  doors: Record<DoorSide, boolean>;
  visited: boolean;
  cleared: boolean;
  obstacles: ObstacleRect[];
  chasms: ChasmRect[];
  pods: DestructiblePod[];
  hazards: HazardVent[];
  /** M10-C: Notfall-Bake (einmalige Extraktion ab Ebene II; nur in Kampfräumen) */
  extractBeacon?: { x: number; y: number; used: boolean };
  /** Milestone 10-A: Sektor-Mechaniken (alles optional) */
  prisms?: CrystalPrism[];
  flameJets?: FlameJet[];
  magnetPlates?: MagnetPlate[];
  teleporters?: TeleportPad[];
  hasHealStation?: boolean;
  healStationUsed?: boolean;
  chest: RoomChest | null;
  spawns: EnemySpawn[];
  tileSeed: number;
  /** For 'secret' subterranean rooms: key & safe return coords of the room above */
  secretParentKey?: string;
  secretReturnX?: number;
  secretReturnY?: number;
  /** Rare unstable Rift Portal spawning inside a cleared combat room (Milestone 7) */
  riftPortal?: {
    x: number;
    y: number;
    targetKey: string;
    cleared: boolean;
  } | null;
  /** True when this room is a Rift Anomaly chamber */
  isRiftChamber?: boolean;
  riftParentKey?: string;
  riftWave2Spawns?: EnemySpawn[];
  riftWave2Triggered?: boolean;
}

export interface DungeonFloor {
  sector: SectorId;
  floorIndex: 1 | 2 | 3;
  floorName: string;
  rooms: Map<string, DungeonRoom>;
  startKey: string;
  bossKey: string;
  treasureKey: string;
  isEndlessRift?: boolean;
  riftDepth?: number;
  visualSector?: 1 | 2 | 3 | 4;
}

// Playable room inner bounds matching public/art/dungeon_bg*.png (480x270 logical space)
export const ROOM_LEFT = 68;
export const ROOM_RIGHT = 412;
export const ROOM_TOP = 46;
export const ROOM_BOTTOM = 222;
export const ROOM_CENTER_X = (ROOM_LEFT + ROOM_RIGHT) / 2;
export const ROOM_CENTER_Y = (ROOM_TOP + ROOM_BOTTOM) / 2;

export function roomKey(gx: number, gy: number): string {
  return `${gx},${gy}`;
}

const DIRS: Array<{ side: DoorSide; opp: DoorSide; dx: number; dy: number }> = [
  { side: 'north', opp: 'south', dx: 0, dy: -1 },
  { side: 'south', opp: 'north', dx: 0, dy: 1 },
  { side: 'east', opp: 'west', dx: 1, dy: 0 },
  { side: 'west', opp: 'east', dx: -1, dy: 0 },
];

const FLOOR_NAMES_S1: Record<1 | 2 | 3, string> = {
  1: 'Ebene I · Frachtdeck',
  2: 'Ebene II · Maschinen-Deck',
  3: 'Ebene III · Reaktor-Kern',
};

const FLOOR_NAMES_S2: Record<1 | 2 | 3, string> = {
  1: 'Ebene I · Quarz-Kaverne',
  2: 'Ebene II · Resonanz-Ader',
  3: 'Ebene III · Herz des Nebels',
};

const FLOOR_NAMES_S3: Record<1 | 2 | 3, string> = {
  1: 'Ebene I · Schlacken-Halle',
  2: 'Ebene II · Schmelz-Trakt',
  3: 'Ebene III · Herz der Sonne',
};

const FLOOR_NAMES_S4: Record<1 | 2 | 3, string> = {
  1: 'Ebene I · Sternen-Vorhof',
  2: 'Ebene II · Astral-Bibliothek',
  3: 'Ebene III · Thron der Ältesten',
};

const FLOOR_NAMES_S5: Record<1 | 2 | 3, string> = {
  1: '5. Tor · Omega-Anomalie',
  2: '5. Tor · Omega-Anomalie',
  3: '5. Tor · Omega-Anomalie',
};

export function generateSector1Floor(floorIndex: 1 | 2 | 3 = 1, customRooms?: number): DungeonFloor {
  return generateSectorFloor(1, floorIndex, customRooms);
}

/** Kreis (x, y, pad) überlappt irgendein Rechteck? (Modulebene seit M10-A, Verhalten unverändert.) */
export function hitsAnyRect(
  rects: Array<{ x: number; y: number; w: number; h: number }>,
  x: number,
  y: number,
  pad: number,
): boolean {
  for (const r of rects) {
    if (x + pad > r.x && x - pad < r.x + r.w && y + pad > r.y && y - pad < r.y + r.h) {
      return true;
    }
  }
  return false;
}

export function generateSectorFloor(
  sector: SectorId = 1,
  floorIndex: 1 | 2 | 3 = 1,
  customRooms?: number,
  /** `mechanics: false` unterdrückt die M10-A-Raum-Mechaniken (Wochen-Prüfung vor dem Gate). */
  opts?: { mechanics?: boolean; portalExclusion?: boolean; beacon?: boolean },
): DungeonFloor {
  const targetRooms = customRooms ?? (sector === 5 ? 5 : floorIndex === 1 ? 7 : floorIndex === 2 ? 8 : 6);
  const coords: Array<{ gx: number; gy: number }> = [{ gx: 0, gy: 0 }];
  const occupied = new Set<string>([roomKey(0, 0)]);

  // Random walk / branching growth favoring interesting Moonlighter-like shapes
  let guard = 0;
  while (coords.length < targetRooms && guard < 220) {
    guard++;
    const base = coords[Math.floor(Math.random() * coords.length)];
    const dir = DIRS[Math.floor(Math.random() * DIRS.length)];
    const nx = base.gx + dir.dx;
    const ny = base.gy + dir.dy;
    const key = roomKey(nx, ny);
    if (occupied.has(key)) continue;

    let neighborCount = 0;
    for (const d of DIRS) {
      if (occupied.has(roomKey(nx + d.dx, ny + d.dy))) neighborCount++;
    }
    if (neighborCount >= 2 && Math.random() < 0.72) continue;

    occupied.add(key);
    coords.push({ gx: nx, gy: ny });
  }

  // BFS from (0,0) for true graph depth
  const depthMap = new Map<string, number>();
  const queue: Array<{ gx: number; gy: number }> = [{ gx: 0, gy: 0 }];
  depthMap.set(roomKey(0, 0), 0);
  while (queue.length > 0) {
    const cur = queue.shift()!;
    const curD = depthMap.get(roomKey(cur.gx, cur.gy)) ?? 0;
    for (const d of DIRS) {
      const nk = roomKey(cur.gx + d.dx, cur.gy + d.dy);
      if (occupied.has(nk) && !depthMap.has(nk)) {
        depthMap.set(nk, curD + 1);
        queue.push({ gx: cur.gx + d.dx, gy: cur.gy + d.dy });
      }
    }
  }

  // Pick boss room = furthest room from start
  let bossKey = roomKey(0, 0);
  let maxDepth = -1;
  for (const [k, d] of depthMap.entries()) {
    if (k === roomKey(0, 0)) continue;
    if (d > maxDepth) {
      maxDepth = d;
      bossKey = k;
    }
  }

  // Pick treasure room = preferably a leaf room != start & != boss
  let treasureKey = '';
  for (const c of coords) {
    const k = roomKey(c.gx, c.gy);
    if (k === roomKey(0, 0) || k === bossKey) continue;
    let deg = 0;
    for (const d of DIRS) {
      if (occupied.has(roomKey(c.gx + d.dx, c.gy + d.dy))) deg++;
    }
    if (deg === 1) {
      treasureKey = k;
      break;
    }
  }
  if (!treasureKey) {
    const fallback = coords.find(
      (c) => roomKey(c.gx, c.gy) !== roomKey(0, 0) && roomKey(c.gx, c.gy) !== bossKey,
    );
    treasureKey = fallback ? roomKey(fallback.gx, fallback.gy) : bossKey;
  }

  const rooms = new Map<string, DungeonRoom>();
  let podCounter = 1;

  // Shuffled Moonlighter room layout deck so each floor has high visual & tactical variety!
  const layoutDeck: RoomLayoutStyle[] = [
    'center_chasm',
    'dash_gorge',
    'cross_bridges',
    'flanking_trenches',
    'stepping_stones',
    'open_pillars',
    'twin_conduits',
  ];
  for (let i = layoutDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [layoutDeck[i], layoutDeck[j]] = [layoutDeck[j], layoutDeck[i]];
  }
  let layoutIdx = 0;

  for (const c of coords) {
    const key = roomKey(c.gx, c.gy);
    const depth = depthMap.get(key) ?? 1;
    const type: RoomType =
      key === roomKey(0, 0)
        ? 'start'
        : key === bossKey
          ? 'boss'
          : key === treasureKey
            ? 'treasure'
            : 'combat';

    const doors: Record<DoorSide, boolean> = {
      north: occupied.has(roomKey(c.gx, c.gy - 1)),
      south: occupied.has(roomKey(c.gx, c.gy + 1)),
      east: occupied.has(roomKey(c.gx + 1, c.gy)),
      west: occupied.has(roomKey(c.gx - 1, c.gy)),
    };

    const obstacles: ObstacleRect[] = [];
    const chasms: ChasmRect[] = [];
    const pods: DestructiblePod[] = [];
    const hazards: HazardVent[] = [];
    const spawns: EnemySpawn[] = [];
    let chest: RoomChest | null = null;
    let hasHealStation = false;
    let layoutStyle: RoomLayoutStyle | undefined;

    const archKind: ObstacleRect['kind'] =
      sector === 2
        ? 'crystal_spire'
        : sector === 3
          ? 'forge_pillar'
          : sector >= 4
            ? 'monolith_obelisk'
            : 'bulkhead_wall';

    if (type === 'start') {
      pods.push(
        { id: podCounter++, x: ROOM_LEFT + 30, y: ROOM_TOP + 22, hp: 1, broken: false },
        { id: podCounter++, x: ROOM_RIGHT - 30, y: ROOM_TOP + 22, hp: 1, broken: false },
      );
      if (floorIndex === 3 || sector === 5) {
        hasHealStation = true;
      }
    } else if (type === 'treasure') {
      chest = { x: ROOM_CENTER_X, y: ROOM_CENTER_Y - 6, opened: false, rare: true };
      if (Math.random() < 0.5) {
        // Dramatic Moonlighter Treasure Shrine flanked by two abyssal rifts!
        chasms.push(
          { x: ROOM_LEFT + 34, y: ROOM_TOP + 20, w: 56, h: 32 },
          { x: ROOM_RIGHT - 90, y: ROOM_BOTTOM - 52, w: 56, h: 32 },
        );
        obstacles.push(
          { x: ROOM_RIGHT - 56, y: ROOM_TOP + 22, w: 22, h: 22, kind: archKind },
          { x: ROOM_LEFT + 34, y: ROOM_BOTTOM - 44, w: 22, h: 22, kind: archKind },
        );
      } else {
        obstacles.push(
          { x: ROOM_LEFT + 34, y: ROOM_TOP + 20, w: 22, h: 22, kind: archKind },
          { x: ROOM_RIGHT - 56, y: ROOM_TOP + 20, w: 22, h: 22, kind: archKind },
          { x: ROOM_LEFT + 34, y: ROOM_BOTTOM - 42, w: 22, h: 22, kind: archKind },
          { x: ROOM_RIGHT - 56, y: ROOM_BOTTOM - 42, w: 22, h: 22, kind: archKind },
        );
      }
      pods.push(
        { id: podCounter++, x: ROOM_CENTER_X - 54, y: ROOM_CENTER_Y - 24, hp: 1, broken: false },
        { id: podCounter++, x: ROOM_CENTER_X + 54, y: ROOM_CENTER_Y - 24, hp: 1, broken: false },
        { id: podCounter++, x: ROOM_CENTER_X - 54, y: ROOM_CENTER_Y + 24, hp: 1, broken: false },
        { id: podCounter++, x: ROOM_CENTER_X + 54, y: ROOM_CENTER_Y + 24, hp: 1, broken: false },
      );
    } else if (type === 'boss') {
      if (sector === 5) {
        obstacles.push(
          { x: ROOM_LEFT + 38, y: ROOM_BOTTOM - 48, w: 20, h: 20, kind: 'monolith_obelisk' },
          { x: ROOM_RIGHT - 58, y: ROOM_BOTTOM - 48, w: 20, h: 20, kind: 'monolith_obelisk' },
        );
        spawns.push({ kind: 'boss_omega_archon', x: ROOM_CENTER_X, y: ROOM_TOP + 52 });
      } else if (floorIndex === 3) {
        obstacles.push(
          { x: ROOM_LEFT + 34, y: ROOM_BOTTOM - 48, w: 20, h: 20, kind: archKind },
          { x: ROOM_RIGHT - 54, y: ROOM_BOTTOM - 48, w: 20, h: 20, kind: archKind },
        );
        const f3Boss: EnemySpawn['kind'] =
          sector === 4
            ? 'boss_star_archon'
            : sector === 3
              ? 'boss_vulkan_titan'
              : sector === 2
                ? 'boss_prisma_archon'
                : 'boss_leviathan';
        spawns.push({
          kind: f3Boss,
          x: ROOM_CENTER_X,
          y: sector === 1 ? ROOM_TOP + 34 : ROOM_TOP + 54,
        });
      } else if (floorIndex === 1) {
        const f1Obs: ObstacleRect['kind'] = sector === 1 ? 'crate' : archKind;
        obstacles.push(
          { x: ROOM_LEFT + 50, y: ROOM_TOP + 30, w: 20, h: 20, kind: f1Obs },
          { x: ROOM_RIGHT - 70, y: ROOM_TOP + 30, w: 20, h: 20, kind: f1Obs },
          { x: ROOM_LEFT + 50, y: ROOM_BOTTOM - 50, w: 20, h: 20, kind: f1Obs },
          { x: ROOM_RIGHT - 70, y: ROOM_BOTTOM - 50, w: 20, h: 20, kind: f1Obs },
        );
        const f1Boss: EnemySpawn['kind'] =
          sector === 4
            ? 'boss_chrono_sentinel'
            : sector === 3
              ? 'boss_slag_overlord'
              : sector === 2
                ? 'boss_quartz_golem'
                : 'boss_breacher';
        spawns.push({ kind: f1Boss, x: ROOM_CENTER_X, y: ROOM_CENTER_Y });
      } else {
        obstacles.push(
          { x: ROOM_LEFT + 48, y: ROOM_TOP + 28, w: 22, h: 22, kind: archKind },
          { x: ROOM_RIGHT - 70, y: ROOM_TOP + 28, w: 22, h: 22, kind: archKind },
          { x: ROOM_LEFT + 48, y: ROOM_BOTTOM - 50, w: 22, h: 22, kind: archKind },
          { x: ROOM_RIGHT - 70, y: ROOM_BOTTOM - 50, w: 22, h: 22, kind: archKind },
        );
        const f2Boss: EnemySpawn['kind'] =
          sector === 4
            ? 'boss_monolith_colossus'
            : sector === 3
              ? 'boss_forge_warden'
              : sector === 2
                ? 'boss_prism_weaver'
                : 'boss';
        spawns.push({ kind: f2Boss, x: ROOM_CENTER_X, y: ROOM_CENTER_Y });
      }
    } else {
      // Pick next unique Moonlighter combat layout from shuffled deck!
      layoutStyle = layoutDeck[layoutIdx % layoutDeck.length];
      layoutIdx++;

      if (layoutStyle === 'center_chasm') {
        chasms.push({ x: ROOM_CENTER_X - 44, y: ROOM_CENTER_Y - 18, w: 88, h: 36 });
        obstacles.push(
          { x: ROOM_CENTER_X - 96, y: ROOM_CENTER_Y - 40, w: 22, h: 22, kind: archKind },
          { x: ROOM_CENTER_X + 74, y: ROOM_CENTER_Y - 40, w: 22, h: 22, kind: archKind },
          { x: ROOM_CENTER_X - 96, y: ROOM_CENTER_Y + 20, w: 22, h: 22, kind: archKind },
          { x: ROOM_CENTER_X + 74, y: ROOM_CENTER_Y + 20, w: 22, h: 22, kind: archKind },
        );
      } else if (layoutStyle === 'dash_gorge') {
        chasms.push(
          { x: ROOM_CENTER_X - 17, y: ROOM_TOP + 28, w: 34, h: 38 },
          { x: ROOM_CENTER_X - 17, y: ROOM_BOTTOM - 66, w: 34, h: 38 },
        );
        obstacles.push(
          { x: ROOM_LEFT + 54, y: ROOM_CENTER_Y - 12, w: 22, h: 24, kind: 'conduit' },
          { x: ROOM_RIGHT - 76, y: ROOM_CENTER_Y - 12, w: 22, h: 24, kind: 'conduit' },
        );
      } else if (layoutStyle === 'cross_bridges') {
        chasms.push(
          { x: ROOM_LEFT + 38, y: ROOM_TOP + 18, w: 88, h: 38 },
          { x: ROOM_RIGHT - 126, y: ROOM_TOP + 18, w: 88, h: 38 },
          { x: ROOM_LEFT + 38, y: ROOM_BOTTOM - 56, w: 88, h: 38 },
          { x: ROOM_RIGHT - 126, y: ROOM_BOTTOM - 56, w: 88, h: 38 },
        );
        obstacles.push({
          x: ROOM_CENTER_X - 12,
          y: ROOM_CENTER_Y - 12,
          w: 24,
          h: 24,
          kind: 'conduit',
        });
      } else if (layoutStyle === 'flanking_trenches') {
        chasms.push(
          { x: ROOM_LEFT + 30, y: ROOM_TOP + 14, w: 86, h: 34 },
          { x: ROOM_RIGHT - 116, y: ROOM_BOTTOM - 48, w: 86, h: 34 },
        );
        obstacles.push(
          { x: ROOM_CENTER_X - 38, y: ROOM_CENTER_Y - 12, w: 26, h: 24, kind: archKind },
          { x: ROOM_CENTER_X + 12, y: ROOM_CENTER_Y - 12, w: 26, h: 24, kind: archKind },
          { x: ROOM_RIGHT - 64, y: ROOM_TOP + 20, w: 22, h: 22, kind: 'pillar' },
          { x: ROOM_LEFT + 42, y: ROOM_BOTTOM - 42, w: 22, h: 22, kind: 'pillar' },
        );
      } else if (layoutStyle === 'stepping_stones') {
        chasms.push(
          { x: ROOM_LEFT + 42, y: ROOM_CENTER_Y - 48, w: 96, h: 30 },
          { x: ROOM_RIGHT - 138, y: ROOM_CENTER_Y - 48, w: 96, h: 30 },
          { x: ROOM_LEFT + 42, y: ROOM_CENTER_Y + 18, w: 96, h: 30 },
          { x: ROOM_RIGHT - 138, y: ROOM_CENTER_Y + 18, w: 96, h: 30 },
        );
      } else if (layoutStyle === 'open_pillars') {
        obstacles.push(
          { x: ROOM_CENTER_X - 78, y: ROOM_CENTER_Y - 36, w: 34, h: 18, kind: archKind },
          { x: ROOM_CENTER_X + 44, y: ROOM_CENTER_Y - 36, w: 34, h: 18, kind: archKind },
          { x: ROOM_CENTER_X - 78, y: ROOM_CENTER_Y + 18, w: 34, h: 18, kind: archKind },
          { x: ROOM_CENTER_X + 44, y: ROOM_CENTER_Y + 18, w: 34, h: 18, kind: archKind },
          { x: ROOM_CENTER_X - 13, y: ROOM_CENTER_Y - 13, w: 26, h: 26, kind: 'conduit' },
        );
      } else {
        obstacles.push(
          { x: ROOM_CENTER_X - 62, y: ROOM_CENTER_Y - 13, w: 26, h: 26, kind: 'conduit' },
          { x: ROOM_CENTER_X + 36, y: ROOM_CENTER_Y - 13, w: 26, h: 26, kind: 'conduit' },
        );
        chasms.push(
          { x: ROOM_RIGHT - 90, y: ROOM_TOP + 16, w: 54, h: 34 },
          { x: ROOM_LEFT + 36, y: ROOM_BOTTOM - 50, w: 54, h: 34 },
        );
      }

      if (floorIndex >= 2 || sector === 5) {
        const ventCandidates = [
          { x: ROOM_CENTER_X - 74, y: ROOM_CENTER_Y },
          { x: ROOM_CENTER_X + 74, y: ROOM_CENTER_Y },
          { x: ROOM_CENTER_X, y: ROOM_CENTER_Y - 46 },
          { x: ROOM_CENTER_X, y: ROOM_CENTER_Y + 46 },
        ];
        let placedVents = 0;
        const maxVents = floorIndex === 3 || sector === 5 ? 2 : Math.random() < 0.65 ? 2 : 1;
        for (const vc of ventCandidates) {
          if (placedVents >= maxVents) break;
          if (!hitsAnyRect(obstacles, vc.x, vc.y, 18) && !hitsAnyRect(chasms, vc.x, vc.y, 16)) {
            hazards.push({
              x: vc.x,
              y: vc.y,
              r: 14,
              phase: placedVents * 2.1 + Math.random() * 1.8,
            });
            placedVents++;
          }
        }
      }

      const podCandidates = [
        { x: ROOM_LEFT + 22, y: ROOM_TOP + 18 },
        { x: ROOM_RIGHT - 22, y: ROOM_BOTTOM - 18 },
        { x: ROOM_RIGHT - 22, y: ROOM_TOP + 18 },
        { x: ROOM_LEFT + 22, y: ROOM_BOTTOM - 18 },
      ];
      let placedPods = 0;
      const desiredPods = Math.random() < 0.65 ? 3 : 2;
      for (const pc of podCandidates) {
        if (placedPods >= desiredPods) break;
        if (!hitsAnyRect(obstacles, pc.x, pc.y, 12) && !hitsAnyRect(chasms, pc.x, pc.y, 12)) {
          pods.push({ id: podCounter++, x: pc.x, y: pc.y, hp: 1, broken: false });
          placedPods++;
        }
      }

      const baseCount = sector === 5 ? 4 : floorIndex === 1 ? 2 : floorIndex === 2 ? 3 : 4;
      const enemyCount = Math.min(
        6,
        baseCount + Math.floor(depth * 0.75) + (Math.random() < 0.35 ? 1 : 0),
      );
      const rawSpots: Array<{ x: number; y: number }> = [
        { x: ROOM_CENTER_X - 88, y: ROOM_CENTER_Y - 42 },
        { x: ROOM_CENTER_X + 88, y: ROOM_CENTER_Y - 42 },
        { x: ROOM_CENTER_X - 88, y: ROOM_CENTER_Y + 42 },
        { x: ROOM_CENTER_X + 88, y: ROOM_CENTER_Y + 42 },
        { x: ROOM_CENTER_X, y: ROOM_CENTER_Y - 48 },
        { x: ROOM_CENTER_X, y: ROOM_CENTER_Y + 48 },
        { x: ROOM_CENTER_X - 118, y: ROOM_CENTER_Y },
        { x: ROOM_CENTER_X + 118, y: ROOM_CENTER_Y },
        { x: ROOM_CENTER_X - 50, y: ROOM_CENTER_Y },
        { x: ROOM_CENTER_X + 50, y: ROOM_CENTER_Y },
        { x: ROOM_LEFT + 34, y: ROOM_CENTER_Y - 44 },
        { x: ROOM_RIGHT - 34, y: ROOM_CENTER_Y + 44 },
      ];
      const candidateSpots = rawSpots.filter(
        (s) => !hitsAnyRect(obstacles, s.x, s.y, 14) && !hitsAnyRect(chasms, s.x, s.y, 14),
      );
      if (candidateSpots.length === 0) {
        candidateSpots.push({ x: ROOM_CENTER_X, y: ROOM_CENTER_Y });
      }
      for (let i = candidateSpots.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [candidateSpots[i], candidateSpots[j]] = [candidateSpots[j], candidateSpots[i]];
      }

      for (let i = 0; i < enemyCount; i++) {
        const spot = candidateSpots[i % candidateSpots.length];
        const r = Math.random();
        let kind: EnemySpawn['kind'] = 'slime';
        if (sector === 5) {
          // Omega Anomaly: Elite All-Star Gauntlet mixing top foes across all 4 sectors!
          const omegaPool: EnemySpawn['kind'][] = [
            'monolith_guard',
            'void_wraith',
            'star_lancer',
            'forge_golem',
            'ember_stalker',
            'resonance_warden',
            'phase_stalker',
          ];
          kind = omegaPool[(i + Math.floor(Math.random() * omegaPool.length)) % omegaPool.length];
        } else if (sector === 4) {
          if (floorIndex === 1) {
            kind = r > 0.48 ? 'chrono_eye' : 'astral_scarab';
          } else if (floorIndex === 2) {
            if (i === 0) kind = Math.random() < 0.52 ? 'star_lancer' : 'void_wraith';
            else if (r > 0.68) kind = 'star_lancer';
            else if (r > 0.4) kind = 'void_wraith';
            else if (r > 0.18) kind = 'chrono_eye';
            else kind = 'astral_scarab';
          } else {
            if (i === 0) kind = 'monolith_guard';
            else if (i === 1) kind = Math.random() < 0.55 ? 'star_lancer' : 'void_wraith';
            else if (r > 0.7) kind = 'monolith_guard';
            else if (r > 0.45) kind = 'star_lancer';
            else if (r > 0.22) kind = 'void_wraith';
            else kind = 'chrono_eye';
          }
        } else if (sector === 3) {
          if (floorIndex === 1) {
            kind = r > 0.48 ? 'solar_drone' : 'slag_beetle';
          } else if (floorIndex === 2) {
            if (i === 0) kind = Math.random() < 0.52 ? 'magma_mortar' : 'ember_stalker';
            else if (r > 0.68) kind = 'magma_mortar';
            else if (r > 0.4) kind = 'ember_stalker';
            else if (r > 0.18) kind = 'solar_drone';
            else kind = 'slag_beetle';
          } else {
            if (i === 0) kind = 'forge_golem';
            else if (i === 1) kind = Math.random() < 0.55 ? 'magma_mortar' : 'ember_stalker';
            else if (r > 0.7) kind = 'forge_golem';
            else if (r > 0.45) kind = 'magma_mortar';
            else if (r > 0.22) kind = 'ember_stalker';
            else kind = 'solar_drone';
          }
        } else if (sector === 2) {
          if (floorIndex === 1) {
            kind = r > 0.48 ? 'prism_drone' : 'crystal_crawler';
          } else if (floorIndex === 2) {
            if (i === 0) kind = Math.random() < 0.52 ? 'shard_sniper' : 'void_crawler';
            else if (r > 0.68) kind = 'shard_sniper';
            else if (r > 0.4) kind = 'void_crawler';
            else if (r > 0.18) kind = 'prism_drone';
            else kind = 'crystal_crawler';
          } else {
            if (i === 0) kind = 'resonance_warden';
            else if (i === 1) kind = Math.random() < 0.55 ? 'shard_sniper' : 'void_crawler';
            else if (r > 0.72) kind = 'resonance_warden';
            else if (r > 0.46) kind = 'shard_sniper';
            else if (r > 0.22) kind = 'void_crawler';
            else kind = 'prism_drone';
          }
        } else if (floorIndex === 1) {
          if (depth >= 2 && r > 0.74) kind = 'turret';
          else if (r > 0.44) kind = 'drone';
          else kind = 'slime';
        } else if (floorIndex === 2) {
          if (i === 0) kind = Math.random() < 0.45 ? 'drone_arc' : Math.random() < 0.55 ? 'shield_drone' : 'spore_spitter';
          else if (r > 0.74) kind = 'drone_arc';
          else if (r > 0.5) kind = 'spore_spitter';
          else if (r > 0.28) kind = 'shield_drone';
          else if (r > 0.14) kind = 'turret';
          else kind = 'drone';
        } else {
          if (i === 0) kind = 'phase_stalker';
          else if (i === 1) kind = Math.random() < 0.62 ? 'slime_magma' : 'drone_arc';
          else if (r > 0.74) kind = 'phase_stalker';
          else if (r > 0.5) kind = 'slime_magma';
          else if (r > 0.3) kind = 'drone_arc';
          else if (r > 0.14) kind = 'shield_drone';
          else kind = 'spore_spitter';
        }
        spawns.push({ kind, x: spot.x, y: spot.y });
      }
    }

    rooms.set(key, {
      key,
      gx: c.gx,
      gy: c.gy,
      depth,
      type,
      layoutStyle,
      doors,
      visited: type === 'start',
      cleared: type === 'start' || type === 'treasure',
      obstacles,
      chasms,
      pods,
      hazards,
      hasHealStation,
      healStationUsed: false,
      chest,
      spawns,
      tileSeed: Math.floor(Math.random() * 10000),
    });
  }

  // ==================== MOONLIGHTER SECRET SPARKLING PIT ====================
  const pitRooms = [...rooms.values()].filter(
    (r) => (r.type === 'combat' || r.type === 'treasure') && r.chasms.length > 0,
  );
  if (pitRooms.length > 0) {
    const parent = pitRooms[Math.floor(Math.random() * pitRooms.length)];
    const chosenChasm = parent.chasms[Math.floor(Math.random() * parent.chasms.length)];
    chosenChasm.secret = true;
    chosenChasm.secretVisited = false;

    const secretKey = `secret:${parent.key}`;
    const secretArchKind: ObstacleRect['kind'] =
      sector === 2
        ? 'crystal_spire'
        : sector === 3
          ? 'forge_pillar'
          : sector >= 4
            ? 'monolith_obelisk'
            : 'pillar';
    rooms.set(secretKey, {
      key: secretKey,
      gx: parent.gx,
      gy: parent.gy,
      depth: parent.depth + 1,
      type: 'secret',
      doors: { north: false, south: false, east: false, west: false },
      visited: false,
      cleared: true,
      obstacles: [
        { x: ROOM_LEFT + 44, y: ROOM_TOP + 26, w: 22, h: 22, kind: secretArchKind },
        { x: ROOM_RIGHT - 66, y: ROOM_TOP + 26, w: 22, h: 22, kind: secretArchKind },
        { x: ROOM_LEFT + 44, y: ROOM_BOTTOM - 52, w: 22, h: 22, kind: secretArchKind },
        { x: ROOM_RIGHT - 66, y: ROOM_BOTTOM - 52, w: 22, h: 22, kind: secretArchKind },
      ],
      chasms: [],
      pods: [
        { id: podCounter++, x: ROOM_CENTER_X - 66, y: ROOM_CENTER_Y - 12, hp: 1, broken: false },
        { id: podCounter++, x: ROOM_CENTER_X + 66, y: ROOM_CENTER_Y - 12, hp: 1, broken: false },
        { id: podCounter++, x: ROOM_CENTER_X, y: ROOM_TOP + 34, hp: 1, broken: false },
      ],
      hazards: [],
      chest: {
        x: ROOM_CENTER_X,
        y: ROOM_CENTER_Y - 14,
        opened: false,
        rare: true,
        secret: true,
      },
      spawns: [],
      tileSeed: Math.floor(Math.random() * 10000),
      secretParentKey: parent.key,
      secretReturnX: ROOM_CENTER_X,
      secretReturnY: ROOM_CENTER_Y,
    });
  }

  // ==================== MILESTONE 7: UNSTABLE RIFT-RISS IN REGULAR SECTORS ====================
  if (sector <= 4) {
    const combatCandidates = [...rooms.values()].filter(
      (r) => r.type === 'combat' && !r.secretParentKey && r.chasms.length === 0,
    );
    const shouldSpawnRift = floorIndex >= 2 || Math.random() < 0.55;
    if (shouldSpawnRift && combatCandidates.length > 0) {
      let host = combatCandidates[Math.floor(Math.random() * combatCandidates.length)];
      // M10-C: Portal nur auf freiem Platz (deterministische Spirale, kein zusätzlicher Zufall);
      // hat der Raum keinen, nimmt der nächste Kandidat in fester Reihenfolge
      let portalSpot = findFreeSpotSpiral(host, ROOM_CENTER_X, ROOM_CENTER_Y - 6, 16);
      if (!portalSpot) {
        for (const alt of combatCandidates) {
          const spot = findFreeSpotSpiral(alt, ROOM_CENTER_X, ROOM_CENTER_Y - 6, 16);
          if (spot) {
            host = alt;
            portalSpot = spot;
            break;
          }
        }
      }
      const riftKey = `rift:${host.key}`;
      host.riftPortal = {
        x: portalSpot?.x ?? ROOM_CENTER_X,
        y: portalSpot?.y ?? ROOM_CENTER_Y - 6,
        targetKey: riftKey,
        cleared: false,
      };
      const eliteWave1: EnemySpawn['kind'][] =
        sector === 1
          ? ['phase_stalker', 'prism_drone', 'drone_arc']
          : sector === 2
            ? ['void_crawler', 'ember_stalker', 'shard_sniper']
            : sector === 3
              ? ['forge_golem', 'star_lancer', 'magma_mortar']
              : ['monolith_guard', 'void_wraith', 'star_lancer'];
      const eliteWave2: EnemySpawn['kind'][] =
        sector === 1
          ? ['crystal_crawler', 'resonance_warden']
          : sector === 2
            ? ['solar_drone', 'forge_golem']
            : sector === 3
              ? ['void_wraith', 'monolith_guard']
              : ['monolith_guard', 'chrono_eye', 'void_wraith'];

      rooms.set(riftKey, {
        key: riftKey,
        gx: host.gx,
        gy: host.gy,
        depth: host.depth + 2,
        type: 'combat',
        doors: { north: false, south: false, east: false, west: false },
        visited: false,
        cleared: false,
        obstacles: [
          { x: ROOM_LEFT + 54, y: ROOM_TOP + 34, w: 20, h: 20, kind: 'monolith_obelisk' },
          { x: ROOM_RIGHT - 74, y: ROOM_TOP + 34, w: 20, h: 20, kind: 'monolith_obelisk' },
          { x: ROOM_LEFT + 54, y: ROOM_BOTTOM - 56, w: 20, h: 20, kind: 'monolith_obelisk' },
          { x: ROOM_RIGHT - 74, y: ROOM_BOTTOM - 56, w: 20, h: 20, kind: 'monolith_obelisk' },
        ],
        chasms: [],
        pods: [
          { id: podCounter++, x: ROOM_CENTER_X - 78, y: ROOM_CENTER_Y, hp: 1, broken: false },
          { id: podCounter++, x: ROOM_CENTER_X + 78, y: ROOM_CENTER_Y, hp: 1, broken: false },
        ],
        hazards: [],
        chest: {
          x: ROOM_CENTER_X,
          y: ROOM_TOP + 42,
          opened: false,
          rare: true,
          secret: true,
        },
        spawns: [
          { kind: eliteWave1[0], x: ROOM_CENTER_X - 66, y: ROOM_CENTER_Y - 26 },
          { kind: eliteWave1[1], x: ROOM_CENTER_X + 66, y: ROOM_CENTER_Y - 26 },
          { kind: eliteWave1[2], x: ROOM_CENTER_X, y: ROOM_TOP + 46 },
        ],
        riftWave2Spawns: eliteWave2.map((k, idx) => ({
          kind: k,
          x: ROOM_CENTER_X + (idx - (eliteWave2.length - 1) / 2) * 86,
          y: ROOM_CENTER_Y - 28,
        })),
        riftWave2Triggered: false,
        tileSeed: Math.floor(Math.random() * 10000),
        isRiftChamber: true,
        riftParentKey: host.key,
      });
    }
  }

  const floorNames =
    sector === 5
      ? FLOOR_NAMES_S5
      : sector === 4
        ? FLOOR_NAMES_S4
        : sector === 3
          ? FLOOR_NAMES_S3
          : sector === 2
            ? FLOOR_NAMES_S2
            : FLOOR_NAMES_S1;

  // Milestone 10-A: Sektor-Mechaniken (eigener lokaler PRNG — verbraucht KEIN globales Math.random)
  if (opts?.mechanics !== false) applySectorMechanics(rooms, sector, floorIndex, opts?.portalExclusion !== false);
  // M10-C: Notfall-Bake (eigener lokaler PRNG — verbraucht KEIN globales Math.random; nicht in der Wochen-Prüfung)
  if (opts?.beacon !== false) placeExtractBeacon(rooms, sector, floorIndex);

  return {
    sector,
    floorIndex,
    floorName: floorNames[floorIndex],
    rooms,
    startKey: roomKey(0, 0),
    bossKey,
    treasureKey,
  };
}

/**
 * Generates an Endless Spiral ("Die Unendliche Spirale") floor for Milestone 7.
 * Cycles visual biome S1..S4, mixes elite cross-sector waves, and spawns a scaling Boss every 3rd floor!
 */
export function generateEndlessRiftFloor(riftDepth: number): DungeonFloor {
  const depthClean = Math.max(1, Math.floor(riftDepth));
  const visualSector = (((depthClean - 1) % 4) + 1) as 1 | 2 | 3 | 4;
  const isBossDepth = depthClean % 3 === 0;
  const baseFloor = generateSectorFloor(visualSector, isBossDepth ? 3 : 2, isBossDepth ? 5 : 6);

  // Swap boss room spawns: on every 3rd floor keep a cycling Sector Endboss; otherwise a fierce Mixed Rift Elite pack
  const bossRoom = baseFloor.rooms.get(baseFloor.bossKey);
  if (bossRoom) {
    if (isBossDepth) {
      const cycleIdx = Math.floor((depthClean - 1) / 3) % 4;
      const bossPool: EnemySpawn['kind'][] = [
        'boss_leviathan',
        'boss_prisma_archon',
        'boss_vulkan_titan',
        'boss_star_archon',
      ];
      const chosenBoss = bossPool[cycleIdx];
      bossRoom.spawns = [
        {
          kind: chosenBoss,
          x: ROOM_CENTER_X,
          y: chosenBoss === 'boss_leviathan' ? ROOM_TOP + 34 : ROOM_CENTER_Y - 12,
        },
      ];
    } else {
      const mixedPacks: EnemySpawn['kind'][][] = [
        ['phase_stalker', 'prism_drone', 'ember_stalker', 'shard_sniper'],
        ['forge_golem', 'void_wraith', 'resonance_warden', 'solar_drone'],
        ['monolith_guard', 'star_lancer', 'magma_mortar', 'void_crawler'],
      ];
      const pack = mixedPacks[(depthClean - 1) % mixedPacks.length];
      bossRoom.spawns = pack.map((k, idx) => ({
        kind: k,
        x: ROOM_CENTER_X + (idx % 2 === 0 ? -74 : 74),
        y: ROOM_CENTER_Y + (idx < 2 ? -30 : 24),
      }));
    }
  }

  // Remove mid-sector rift portals inside Endless Spiral (you're already inside the Rift!)
  for (const r of baseFloor.rooms.values()) {
    r.riftPortal = null;
  }

  const biomeLabel =
    visualSector === 1
      ? 'Wrack-Echo'
      : visualSector === 2
        ? 'Kristall-Echo'
        : visualSector === 3
          ? 'Solar-Echo'
          : 'Astral-Echo';

  return {
    ...baseFloor,
    sector: 5,
    floorIndex: isBossDepth ? 3 : 2,
    floorName: `∞ SPIRALE E${depthClean} · ${biomeLabel}${isBossDepth ? ' (BOSS)' : ''}`,
    isEndlessRift: true,
    riftDepth: depthClean,
    visualSector,
  };
}

export function generateSector1Dungeon(targetRooms = 7): DungeonFloor {
  return generateSector1Floor(1, targetRooms);
}
