export type RoomType = 'start' | 'combat' | 'treasure' | 'boss';

export type DoorSide = 'north' | 'south' | 'east' | 'west';

export interface ObstacleRect {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: 'pillar' | 'conduit' | 'crate';
}

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
}

export interface EnemySpawn {
  kind: 'slime' | 'drone' | 'turret' | 'boss';
  x: number;
  y: number;
}

export interface DungeonRoom {
  key: string;
  gx: number;
  gy: number;
  depth: number;
  type: RoomType;
  doors: Record<DoorSide, boolean>;
  visited: boolean;
  cleared: boolean;
  obstacles: ObstacleRect[];
  pods: DestructiblePod[];
  chest: RoomChest | null;
  spawns: EnemySpawn[];
  tileSeed: number;
}

export interface DungeonFloor {
  rooms: Map<string, DungeonRoom>;
  startKey: string;
  bossKey: string;
  treasureKey: string;
}

// Playable room inner bounds matching public/art/dungeon_bg.png (480x270 logical space)
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

export function generateSector1Dungeon(targetRooms = 8): DungeonFloor {
  const coords: Array<{ gx: number; gy: number }> = [{ gx: 0, gy: 0 }];
  const occupied = new Set<string>([roomKey(0, 0)]);

  // Random walk / branching growth favoring interesting Moonlighter-like shapes
  let guard = 0;
  while (coords.length < targetRooms && guard < 200) {
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
    const pods: DestructiblePod[] = [];
    const spawns: EnemySpawn[] = [];
    let chest: RoomChest | null = null;

    if (type === 'start') {
      pods.push(
        { id: podCounter++, x: ROOM_LEFT + 30, y: ROOM_TOP + 22, hp: 1, broken: false },
        { id: podCounter++, x: ROOM_RIGHT - 30, y: ROOM_TOP + 22, hp: 1, broken: false },
      );
    } else if (type === 'treasure') {
      chest = { x: ROOM_CENTER_X, y: ROOM_CENTER_Y - 6, opened: false, rare: true };
      pods.push(
        { id: podCounter++, x: ROOM_CENTER_X - 54, y: ROOM_CENTER_Y - 24, hp: 1, broken: false },
        { id: podCounter++, x: ROOM_CENTER_X + 54, y: ROOM_CENTER_Y - 24, hp: 1, broken: false },
        { id: podCounter++, x: ROOM_CENTER_X - 54, y: ROOM_CENTER_Y + 24, hp: 1, broken: false },
        { id: podCounter++, x: ROOM_CENTER_X + 54, y: ROOM_CENTER_Y + 24, hp: 1, broken: false },
      );
      obstacles.push(
        { x: ROOM_LEFT + 34, y: ROOM_TOP + 20, w: 22, h: 22, kind: 'pillar' },
        { x: ROOM_RIGHT - 56, y: ROOM_TOP + 20, w: 22, h: 22, kind: 'pillar' },
        { x: ROOM_LEFT + 34, y: ROOM_BOTTOM - 42, w: 22, h: 22, kind: 'pillar' },
        { x: ROOM_RIGHT - 56, y: ROOM_BOTTOM - 42, w: 22, h: 22, kind: 'pillar' },
      );
    } else if (type === 'boss') {
      obstacles.push(
        { x: ROOM_LEFT + 48, y: ROOM_TOP + 28, w: 22, h: 22, kind: 'pillar' },
        { x: ROOM_RIGHT - 70, y: ROOM_TOP + 28, w: 22, h: 22, kind: 'pillar' },
        { x: ROOM_LEFT + 48, y: ROOM_BOTTOM - 50, w: 22, h: 22, kind: 'pillar' },
        { x: ROOM_RIGHT - 70, y: ROOM_BOTTOM - 50, w: 22, h: 22, kind: 'pillar' },
      );
      spawns.push({ kind: 'boss', x: ROOM_CENTER_X, y: ROOM_CENTER_Y });
    } else {
      const pattern = Math.floor(Math.random() * 3);
      if (pattern === 0) {
        obstacles.push(
          { x: ROOM_CENTER_X - 66, y: ROOM_CENTER_Y - 30, w: 22, h: 22, kind: 'pillar' },
          { x: ROOM_CENTER_X + 44, y: ROOM_CENTER_Y - 30, w: 22, h: 22, kind: 'pillar' },
          { x: ROOM_CENTER_X - 66, y: ROOM_CENTER_Y + 12, w: 22, h: 22, kind: 'pillar' },
          { x: ROOM_CENTER_X + 44, y: ROOM_CENTER_Y + 12, w: 22, h: 22, kind: 'pillar' },
        );
      } else if (pattern === 1) {
        obstacles.push(
          { x: ROOM_CENTER_X - 18, y: ROOM_CENTER_Y - 14, w: 36, h: 28, kind: 'conduit' },
          { x: ROOM_LEFT + 42, y: ROOM_TOP + 22, w: 20, h: 20, kind: 'crate' },
          { x: ROOM_RIGHT - 62, y: ROOM_BOTTOM - 42, w: 20, h: 20, kind: 'crate' },
        );
      } else {
        obstacles.push(
          { x: ROOM_CENTER_X - 58, y: ROOM_CENTER_Y - 12, w: 24, h: 24, kind: 'conduit' },
          { x: ROOM_CENTER_X + 34, y: ROOM_CENTER_Y - 12, w: 24, h: 24, kind: 'conduit' },
        );
      }

      pods.push(
        { id: podCounter++, x: ROOM_LEFT + 26, y: ROOM_TOP + 22, hp: 1, broken: false },
        { id: podCounter++, x: ROOM_RIGHT - 26, y: ROOM_BOTTOM - 22, hp: 1, broken: false },
      );
      if (Math.random() < 0.6) {
        pods.push({ id: podCounter++, x: ROOM_RIGHT - 26, y: ROOM_TOP + 22, hp: 1, broken: false });
      }

      const enemyCount = Math.min(5, 2 + Math.floor(depth * 0.85) + (Math.random() < 0.4 ? 1 : 0));
      const candidateSpots: Array<{ x: number; y: number }> = [
        { x: ROOM_CENTER_X - 84, y: ROOM_CENTER_Y - 40 },
        { x: ROOM_CENTER_X + 84, y: ROOM_CENTER_Y - 40 },
        { x: ROOM_CENTER_X - 84, y: ROOM_CENTER_Y + 40 },
        { x: ROOM_CENTER_X + 84, y: ROOM_CENTER_Y + 40 },
        { x: ROOM_CENTER_X, y: ROOM_CENTER_Y - 46 },
        { x: ROOM_CENTER_X, y: ROOM_CENTER_Y + 46 },
      ];
      for (let i = candidateSpots.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [candidateSpots[i], candidateSpots[j]] = [candidateSpots[j], candidateSpots[i]];
      }

      for (let i = 0; i < enemyCount; i++) {
        const spot = candidateSpots[i % candidateSpots.length];
        const r = Math.random();
        let kind: 'slime' | 'drone' | 'turret' = 'slime';
        if (depth >= 2 && r > 0.72) kind = 'turret';
        else if (r > 0.42) kind = 'drone';
        spawns.push({ kind, x: spot.x, y: spot.y });
      }
    }

    rooms.set(key, {
      key,
      gx: c.gx,
      gy: c.gy,
      depth,
      type,
      doors,
      visited: type === 'start',
      cleared: type === 'start' || type === 'treasure',
      obstacles,
      pods,
      chest,
      spawns,
      tileSeed: Math.floor(Math.random() * 10000),
    });
  }

  return {
    rooms,
    startKey: roomKey(0, 0),
    bossKey,
    treasureKey,
  };
}
