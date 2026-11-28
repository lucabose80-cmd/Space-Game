/**
 * P7b — Sonderräume pro Ebene (rein, deterministisch, eigener PRNG — nie der globale Zufall):
 *  • Heilquelle: der Raum direkt VOR dem Boss (Moonlighter-Heilteich: heilt nur einen Teil der HP).
 *  • Käfig-Kammer: eigener, leerer Raum mit Sockel für den gefangenen Crew-Begleiter (Ebene II).
 * Beide Räume haben eigene Hintergrund-Sprites (`dungeon_cell_sN` / `dungeon_spring_sN`), keine Gegner, keine Hindernisse.
 */
import type { CrewId, SectorId } from '../types';
import { hashString, mulberry32 } from '../systems/seededRng';
import { ROOM_CENTER_X, ROOM_CENTER_Y, type DoorSide, type DungeonFloor, type DungeonRoom } from '../world/dungeonGen';
import { placeCaptive, placeExtractBeacon } from './mechanicsGen';

/** Anteil der max. HP, den eine Heilquelle insgesamt spendet (nicht komplett!). */
export const SPRING_HEAL_FRACTION = 0.45;
/** Heilung pro Sekunde (Anteil der max. HP), solange man im Becken steht. */
export const SPRING_HEAL_RATE = 0.12;
export const SPRING_RADIUS = 22;

const SIDE_DELTA: Record<DoorSide, { dx: number; dy: number }> = {
  north: { dx: 0, dy: -1 },
  south: { dx: 0, dy: 1 },
  east: { dx: 1, dy: 0 },
  west: { dx: -1, dy: 0 },
};

function byKey(a: DungeonRoom, b: DungeonRoom): number {
  return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
}

function eligible(r: DungeonRoom): boolean {
  return r.type === 'combat' && !r.isRiftChamber && !r.secretParentKey && !r.riftPortal && !r.special;
}

/** Entfernt alles aus dem Raum (Gegner, Hindernisse, Mechaniken, Truhe …) — er wird ein reiner Sonderraum. */
function strip(room: DungeonRoom): void {
  room.spawns = [];
  room.obstacles = [];
  room.chasms = [];
  room.pods = [];
  room.hazards = [];
  room.chest = null;
  room.prisms = undefined;
  room.flameJets = undefined;
  room.magnetPlates = undefined;
  room.teleporters = undefined;
  room.hasHealStation = undefined;
  room.extractBeacon = undefined;
}

/** Der mit dem Boss verbundene Kampfraum (höchste Tiefe, sonst kleinster Schlüssel). */
function bossNeighbour(floor: DungeonFloor): DungeonRoom | null {
  const boss = floor.rooms.get(floor.bossKey);
  if (!boss) return null;
  const out: DungeonRoom[] = [];
  for (const side of Object.keys(SIDE_DELTA) as DoorSide[]) {
    if (!boss.doors[side]) continue;
    const d = SIDE_DELTA[side];
    for (const r of floor.rooms.values()) {
      if (r.gx === boss.gx + d.dx && r.gy === boss.gy + d.dy && (eligible(r) || (r.type === 'combat' && !r.isRiftChamber && !r.secretParentKey && !r.special && r.riftPortal))) out.push(r);
    }
  }
  out.sort((a, b) => b.depth - a.depth || byKey(a, b));
  return out[0] ?? null;
}

export interface SpecialRoomOpts {
  /** Gefangener Begleiter dieser Ebene (null = keiner / schon befreit). */
  crew: CrewId | null;
  /** Heilquellen erlaubt (nicht in der Wochen-Prüfung). */
  springs: boolean;
}

/** Plant Sonderräume in die fertige Ebene. Gibt zurück, was platziert wurde. */
export function placeSpecialRooms(floor: DungeonFloor, opts: SpecialRoomOpts): { spring: string | null; cell: string | null } {
  const res = { spring: null as string | null, cell: null as string | null };
  const sector: SectorId = floor.sector;
  let beaconLost = false;

  if (opts.springs && sector <= 4) {
    const r = bossNeighbour(floor);
    if (r) {
      if (r.extractBeacon) beaconLost = true;
      // Riss-Portal in diesem Raum entfällt samt Kammer (der Raum wird zur ruhigen Quelle)
      if (r.riftPortal) {
        for (const [k, q] of [...floor.rooms.entries()]) if (q.isRiftChamber && q.riftParentKey === r.key) floor.rooms.delete(k);
        r.riftPortal = null;
      }
      strip(r);
      r.special = 'spring';
      r.spring = { x: ROOM_CENTER_X, y: ROOM_CENTER_Y, used: 0 };
      res.spring = r.key;
    }
  }

  if (opts.crew && floor.floorIndex === 2) {
    const cands = [...floor.rooms.values()].filter(eligible).sort(byKey);
    if (cands.length > 0) {
      const maxDepth = Math.max(...cands.map((c) => c.depth));
      const deep = cands.filter((c) => c.depth >= maxDepth - 1);
      const pool = deep.length > 0 ? deep : cands;
      const rng = mulberry32(hashString(`p7b:cell:${opts.crew}:${sector}:${pool.map((c) => c.key).join('|')}`));
      const room = pool[Math.floor(rng() * pool.length)];
      if (room.extractBeacon) beaconLost = true;
      strip(room);
      room.special = 'cell';
      room.captive = { crew: opts.crew, x: ROOM_CENTER_X, y: ROOM_CENTER_Y - 4, freed: false };
      res.cell = room.key;
    } else {
      placeCaptive(floor.rooms, sector, floor.floorIndex, opts.crew);
    }
  }

  // Wurde die Notfall-Bake mit einem Raum entfernt, wird sie in einem normalen Kampfraum neu gesetzt (Bake-Regel M10-C bleibt gültig)
  if (beaconLost) placeExtractBeacon(floor.rooms, sector, floor.floorIndex);
  return res;
}
