// M12 Phase C: Register der Endboss-Arenen + Umwandlung Kachelplan → Raum (Grenzen, Hindernisse, Boss-Spawn).
// Läuft NACH `generateSectorFloor` und verbraucht kein Math.random (Seeds der Wochen-Prüfung bleiben gleich, A10).
import { ENDBOSS_ARENA_LIVE } from '../balance';
import type { DungeonFloor, DungeonRoom, EnemyKind, ObstacleRect } from '../../world/dungeonGen';
import { ROOM_LEFT, ROOM_TOP } from '../../world/dungeonGen';
import { LEVIATHAN_ARENA } from './leviathan';
import { ARENA_TILE, type ArenaDef } from './types';

export { ARENA_TILE, type ArenaDef } from './types';

/** Arena je Endboss-`kind` (Pilot: nur Leviathan). */
export const ARENAS: Partial<Record<EnemyKind, ArenaDef>> = {
  boss_leviathan: LEVIATHAN_ARENA,
};

/** Endboss-Arenen aktiv? Live erst mit Phase D (`ENDBOSS_ARENA_LIVE`), vorher nur zum Ansehen per URL `?arena`. */
export function arenaEnabled(): boolean {
  if (ENDBOSS_ARENA_LIVE) return true;
  try {
    return typeof location !== 'undefined' && new URLSearchParams(location.search).has('arena');
  } catch {
    return false;
  }
}

/** Kachel an (Spalte, Zeile); außerhalb = Wand. */
export function arenaTileAt(def: ArenaDef, col: number, row: number): string {
  return def.tiles[row]?.[col] ?? 'W';
}

const SOLID_KIND: Record<string, ObstacleRect['kind']> = { W: 'bulkhead_wall', '#': 'pillar', v: 'conduit' };

/** Feste Kacheln → möglichst wenige Rechtecke (Zeilen-Läufe, dann gleiche Läufe senkrecht zusammenfassen). */
export function arenaObstacles(def: ArenaDef, originX: number, originY: number, skip?: (col: number, row: number) => boolean): ObstacleRect[] {
  type Run = { c0: number; c1: number; r0: number; r1: number; ch: string };
  const open: Run[] = [];
  const done: Run[] = [];
  for (let r = 0; r < def.tiles.length; r++) {
    const row = def.tiles[r];
    const runs: Run[] = [];
    for (let c = 0; c < row.length; ) {
      const ch = row[c];
      if (!SOLID_KIND[ch] || skip?.(c, r)) { c++; continue; }
      let e = c;
      while (e + 1 < row.length && row[e + 1] === ch && !skip?.(e + 1, r)) e++;
      runs.push({ c0: c, c1: e, r0: r, r1: r, ch });
      c = e + 1;
    }
    // senkrecht verlängern, wenn darüber exakt derselbe Lauf endet
    const next: Run[] = [];
    for (const run of runs) {
      const i = open.findIndex((o) => o.c0 === run.c0 && o.c1 === run.c1 && o.ch === run.ch && o.r1 === r - 1);
      if (i >= 0) { open[i].r1 = r; next.push(open[i]); open.splice(i, 1); }
      else next.push(run);
    }
    done.push(...open);
    open.length = 0;
    open.push(...next);
  }
  done.push(...open);
  return done.map((o) => ({
    x: originX + o.c0 * ARENA_TILE,
    y: originY + o.r0 * ARENA_TILE,
    w: (o.c1 - o.c0 + 1) * ARENA_TILE,
    h: (o.r1 - o.r0 + 1) * ARENA_TILE,
    kind: SOLID_KIND[o.ch],
  }));
}

/** Breite des Durchgangs (Kacheln) durch den Boss-Sockel, falls der Bossraum eine Nordtür hat. */
const NORTH_GAP = 3;

/** Wandelt einen Bossraum in die Arena um (Grenzen, Hindernisse, Spawn). Kein Zufall. */
export function applyArena(room: DungeonRoom, def: ArenaDef): void {
  const l = ROOM_LEFT;
  const t = ROOM_TOP;
  room.bounds = { l, r: l + def.size.w, t, b: t + def.size.h };
  room.arenaKind = def.kind;
  const cols = def.size.w / ARENA_TILE;
  const midC = Math.floor(cols / 2);
  const gap = room.doors.north ? (c: number, r: number) => def.tiles[r]?.[c] === 'W' && Math.abs(c - midC) <= (NORTH_GAP - 1) / 2 : undefined;
  room.obstacles = arenaObstacles(def, l, t, gap);
  room.chasms = [];
  room.pods = [];
  room.hazards = [];
  room.prisms = undefined;
  room.flameJets = undefined;
  room.magnetPlates = undefined;
  room.teleporters = undefined;
  room.chest = null;
  room.spawns = [{ kind: def.kind, x: l + def.bossAnchor.x, y: t + def.bossAnchor.y }];
}

/**
 * Hängt die Arenen an ein frisch generiertes Stockwerk (nur Sektor-Ebene III mit eigener Arena).
 * Ruft kein Math.random → `generateSectorFloor` bleibt bit-identisch, nur der Bossraum-Inhalt ändert sich.
 */
export function attachArenas(floor: DungeonFloor): boolean {
  if (floor.floorIndex !== 3 || floor.isEndlessRift) return false;
  const boss = floor.rooms.get(floor.bossKey);
  const kind = boss?.spawns.find((s) => ARENAS[s.kind])?.kind;
  const def = kind ? ARENAS[kind] : undefined;
  if (!boss || !def) return false;
  applyArena(boss, def);
  return true;
}
