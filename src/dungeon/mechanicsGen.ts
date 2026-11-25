/**
 * Meilenstein 10-A — Platzierung der Sektor-Raum-Mechaniken (rein, deterministisch).
 *
 * WICHTIG: Diese Datei darf NIEMALS den globalen Zufalls-Aufruf der Laufzeit verwenden (siehe seededRng.ts).
 * Jeder zusätzliche globale Zufallsaufruf im Generator würde die Zufallsfolge verschieben und damit alle
 * (auch die geseedeten Wochen-Prüfungs-)Layouts ändern.
 * Stattdessen: eigener lokaler PRNG pro Raum, abgeleitet aus Sektor/Etage/Raum-Key/tileSeed.
 */
import type { SectorId } from '../types';
import { hashString, mulberry32 } from '../systems/seededRng';
import {
  hitsAnyRect,
  ROOM_BOTTOM,
  ROOM_CENTER_X,
  ROOM_CENTER_Y,
  ROOM_LEFT,
  ROOM_RIGHT,
  ROOM_TOP,
  type CrystalPrism,
  type DungeonRoom,
  type FlameJet,
  type TeleportPad,
} from '../world/dungeonGen';

type Rng = () => number;

/** Wahrscheinlichkeit pro Kampfraum je Etage (Index = floorIndex − 1). */
export const MECHANIC_CHANCE = {
  prism: [0.55, 0.7, 0.85],
  jet: [0.4, 0.6, 0.75],
  plate: [0.25, 0.45, 0.6],
  teleport: [0.5, 0.7, 0.85],
} as const;

export const PRISM_RADIUS = 7;
export const PLATE_RADIUS = 22;
/** Prüf-Radius beim Platzieren einer Magnetplatte (Wirkungsradius ist PLATE_RADIUS). */
export const PLATE_PLACE_RADIUS = 12;
export const PAD_RADIUS = 9;
export const PAD_MIN_DISTANCE = 140;

interface Circle {
  x: number;
  y: number;
  r: number;
}

function shuffle<T>(arr: T[], rng: Rng): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Primäres Kandidatenraster (siehe Plan §4.3.2). */
function primaryCandidates(): Array<{ x: number; y: number }> {
  const xs = [ROOM_LEFT + 48, ROOM_CENTER_X - 92, ROOM_CENTER_X - 46, ROOM_CENTER_X + 46, ROOM_CENTER_X + 92, ROOM_RIGHT - 48];
  const ys = [ROOM_TOP + 36, ROOM_CENTER_Y - 30, ROOM_CENTER_Y + 30, ROOM_BOTTOM - 36];
  const out: Array<{ x: number; y: number }> = [];
  for (const y of ys) for (const x of xs) out.push({ x, y });
  return out;
}

/** Feineres Ausweichraster für volle Räume (Hindernisse, Pods, Vents, viele Spawns). */
function fallbackCandidates(): Array<{ x: number; y: number }> {
  const out: Array<{ x: number; y: number }> = [];
  for (let y = ROOM_TOP + 28; y <= ROOM_BOTTOM - 28; y += 22) {
    for (let x = ROOM_LEFT + 30; x <= ROOM_RIGHT - 30; x += 24) out.push({ x, y });
  }
  return out;
}

/** Zuerst das primäre Raster (gemischt), danach das feine Ausweichraster (gemischt). */
function candidates(rng?: Rng): Array<{ x: number; y: number }> {
  if (!rng) return primaryCandidates();
  return [...shuffle(primaryCandidates(), rng), ...shuffle(fallbackCandidates(), rng)];
}

/** Tür-Korridore (40 px breit, 46 px tief) vor jeder offenen Tür. */
function doorCorridors(room: DungeonRoom): Array<{ x: number; y: number; w: number; h: number }> {
  const z: Array<{ x: number; y: number; w: number; h: number }> = [];
  if (room.doors.north) z.push({ x: ROOM_CENTER_X - 20, y: ROOM_TOP, w: 40, h: 46 });
  if (room.doors.south) z.push({ x: ROOM_CENTER_X - 20, y: ROOM_BOTTOM - 46, w: 40, h: 46 });
  if (room.doors.west) z.push({ x: ROOM_LEFT, y: ROOM_CENTER_Y - 20, w: 46, h: 40 });
  if (room.doors.east) z.push({ x: ROOM_RIGHT - 46, y: ROOM_CENTER_Y - 20, w: 46, h: 40 });
  return z;
}

/**
 * Freihalte-Zonen: Hindernisse, Schluchten, Vents, Pods, Truhe, Raummitte, Tür-Korridore,
 * Gegner-Spawns und bereits platzierte Mechaniken.
 * Exportiert, damit Tests die Regeln unabhängig nachprüfen können.
 */
export function isFreeSpot(room: DungeonRoom, x: number, y: number, r: number, placed: Circle[]): boolean {
  if (x - r < ROOM_LEFT + 6 || x + r > ROOM_RIGHT - 6 || y - r < ROOM_TOP + 6 || y + r > ROOM_BOTTOM - 6) return false;
  if (hitsAnyRect(room.obstacles, x, y, r + 2)) return false;
  if (hitsAnyRect(room.chasms, x, y, r + 2)) return false;
  for (const h of room.hazards) if (Math.hypot(x - h.x, y - h.y) < h.r + r + 16) return false;
  for (const p of room.pods) if (Math.hypot(x - p.x, y - p.y) < r + 12) return false;
  if (room.chest && Math.hypot(x - room.chest.x, y - room.chest.y) < r + 20) return false;
  if (Math.hypot(x - ROOM_CENTER_X, y - ROOM_CENTER_Y) < r + 22) return false;
  for (const z of doorCorridors(room)) if (hitsAnyRect([z], x, y, r)) return false;
  for (const sp of room.spawns) if (Math.hypot(x - sp.x, y - sp.y) < 26) return false; // Plan: ≥ 26 px zu jedem Spawn
  for (const c of placed) if (Math.hypot(x - c.x, y - c.y) < r + c.r + 14) return false;
  return true;
}

function existingCircles(room: DungeonRoom): Circle[] {
  const out: Circle[] = [];
  for (const p of room.prisms ?? []) out.push({ x: p.x, y: p.y, r: p.r });
  for (const m of room.magnetPlates ?? []) out.push({ x: m.x, y: m.y, r: m.r });
  for (const t of room.teleporters ?? []) out.push({ x: t.x, y: t.y, r: PAD_RADIUS });
  for (const j of room.flameJets ?? []) {
    for (const s of jetSamplePoints(j)) out.push({ x: s.x, y: s.y, r: 5 });
  }
  return out;
}

export function jetSamplePoints(j: FlameJet): Array<{ x: number; y: number }> {
  const pts: Array<{ x: number; y: number }> = [];
  const n = Math.max(2, Math.ceil(j.length / 14));
  for (let i = 0; i <= n; i++) {
    const t = i / n - 0.5;
    pts.push(j.axis === 'h' ? { x: j.x + t * j.length, y: j.y } : { x: j.x, y: j.y + t * j.length });
  }
  return pts;
}

// ---------------- S2: Kristall-Prismen ----------------
function placePrisms(room: DungeonRoom, rng: Rng, floorIndex: 1 | 2 | 3): void {
  if (rng() >= MECHANIC_CHANCE.prism[floorIndex - 1]) return;
  const want = floorIndex === 1 ? 2 : 2 + (rng() < 0.4 ? 1 : 0);
  const out: CrystalPrism[] = [];
  const placed: Circle[] = [];
  let id = 0;
  for (const c of candidates(rng)) {
    if (out.length >= want) break;
    if (!isFreeSpot(room, c.x, c.y, PRISM_RADIUS, placed)) continue;
    out.push({ id: id++, x: c.x, y: c.y, r: PRISM_RADIUS });
    placed.push({ x: c.x, y: c.y, r: PRISM_RADIUS });
  }
  if (out.length > 0) room.prisms = out;
}

// ---------------- S3: Schmelz-Düsen & Magnetplatten ----------------
function placeFoundryMechanics(room: DungeonRoom, rng: Rng, floorIndex: 1 | 2 | 3): void {
  // Düsen — bei Platzmangel kürzer oder um 90° gedreht probieren
  if (rng() < MECHANIC_CHANCE.jet[floorIndex - 1]) {
    const want = 1 + (rng() < 0.45 ? 1 : 0);
    const jets: FlameJet[] = [];
    for (const c of candidates(rng)) {
      if (jets.length >= want) break;
      const firstAxis: 'h' | 'v' = rng() < 0.5 ? 'h' : 'v';
      const wantLen = 96 + Math.floor(rng() * 55);
      const phase = rng() * 3;
      const placed = [...existingCircles(room), ...jets.flatMap((j) => jetSamplePoints(j).map((sp) => ({ x: sp.x, y: sp.y, r: 5 })))];
      let found: FlameJet | null = null;
      for (const axis of [firstAxis, firstAxis === 'h' ? 'v' : 'h'] as const) {
        const maxHalf =
          axis === 'h' ? Math.min(c.x - (ROOM_LEFT + 8), ROOM_RIGHT - 8 - c.x) : Math.min(c.y - (ROOM_TOP + 8), ROOM_BOTTOM - 8 - c.y);
        for (let len = Math.min(wantLen, Math.floor(maxHalf * 2)); len >= 60; len -= 12) {
          const jet: FlameJet = { x: c.x, y: c.y, axis, length: len, phase };
          if (jetSamplePoints(jet).every((sp) => isFreeSpot(room, sp.x, sp.y, 4, placed))) {
            found = jet;
            break;
          }
        }
        if (found) break;
      }
      if (found) jets.push(found);
    }
    if (jets.length > 0) room.flameJets = jets;
  }
  // Magnetplatten (unabhängig von den Düsen)
  if (rng() < MECHANIC_CHANCE.plate[floorIndex - 1]) {
    const polarity: 'pull' | 'push' = rng() < 0.7 ? 'pull' : 'push';
    const phase = rng() * 5;
    for (const c of candidates(rng)) {
      // Bodendekal (nicht solide): Platzierung mit kleinerem Prüf-Radius, Wirkungsradius bleibt PLATE_RADIUS
      if (!isFreeSpot(room, c.x, c.y, PLATE_PLACE_RADIUS, existingCircles(room))) continue;
      room.magnetPlates = [{ x: c.x, y: c.y, r: PLATE_RADIUS, polarity, phase }];
      break;
    }
  }
}

// ---------------- S4: Astral-Teleporter ----------------
function segmentHitsRect(ax: number, ay: number, bx: number, by: number, r: { x: number; y: number; w: number; h: number }): boolean {
  // grobe Abtastung entlang der Strecke (reicht für „Pads auf gegenüberliegenden Seiten einer Schlucht“)
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    const x = ax + (bx - ax) * t;
    const y = ay + (by - ay) * t;
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return true;
  }
  return false;
}

function placeTeleporters(room: DungeonRoom, rng: Rng, floorIndex: 1 | 2 | 3): void {
  if (rng() >= MECHANIC_CHANCE.teleport[floorIndex - 1]) return;
  const wantPairs = floorIndex === 3 ? 1 + (rng() < 0.5 ? 1 : 0) : 1;
  const pads: TeleportPad[] = [];
  let nextId = 0;
  const bigChasm = [...room.chasms].sort((a, b) => b.w * b.h - a.w * a.h)[0];

  for (let pair = 0; pair < wantPairs; pair++) {
    const placed = [...pads.map((p) => ({ x: p.x, y: p.y, r: PAD_RADIUS }))];
    const cands = [...primaryCandidates(), ...fallbackCandidates()].filter((c) => isFreeSpot(room, c.x, c.y, PAD_RADIUS, placed));
    // Paare bilden: Abstand ≥ 140; bevorzugt gegenüberliegende Raumhälften (bzw. über eine Schlucht hinweg)
    const combos: Array<{ a: { x: number; y: number }; b: { x: number; y: number }; score: number }> = [];
    for (let i = 0; i < cands.length; i++) {
      for (let j = i + 1; j < cands.length; j++) {
        const a = cands[i];
        const b = cands[j];
        if (Math.hypot(a.x - b.x, a.y - b.y) < PAD_MIN_DISTANCE) continue;
        if (Math.hypot(a.x - b.x, a.y - b.y) < PAD_RADIUS * 2 + 28) continue;
        const opposite = (a.x < ROOM_CENTER_X) !== (b.x < ROOM_CENTER_X) || (a.y < ROOM_CENTER_Y) !== (b.y < ROOM_CENTER_Y);
        const acrossChasm = bigChasm ? segmentHitsRect(a.x, a.y, b.x, b.y, bigChasm) : false;
        combos.push({ a, b, score: (bigChasm ? (acrossChasm ? 2 : 0) : 0) + (opposite ? 1 : 0) });
      }
    }
    if (combos.length === 0) break;
    const best = Math.max(...combos.map((c) => c.score));
    const pool = shuffle(combos.filter((c) => c.score === best), rng);
    // zweites Paar darf das erste nicht überlappen (isFreeSpot prüft gegen `placed` nur das erste Pad → hier beide)
    const pick = pool.find((c) => isFreeSpot(room, c.b.x, c.b.y, PAD_RADIUS, [...placed, { x: c.a.x, y: c.a.y, r: PAD_RADIUS }]));
    if (!pick) break;
    const colorIdx = (pair % 3) as 0 | 1 | 2;
    pads.push({ id: nextId++, pairId: pair, x: pick.a.x, y: pick.a.y, colorIdx });
    pads.push({ id: nextId++, pairId: pair, x: pick.b.x, y: pick.b.y, colorIdx });
  }
  if (pads.length >= 2) room.teleporters = pads;
}

/**
 * Platziert die Mechaniken des Sektors (S2 Prismen · S3 Düsen & Magnetplatten · S4 Teleporter).
 * S1, die Omega-Anomalie (Sektor 5), Rift-Kammern und Geheimräume bleiben unberührt.
 * Die Spirale nutzt `generateSectorFloor(visualSector, …)` und erhält die Mechaniken dadurch automatisch.
 */
export function applySectorMechanics(rooms: Map<string, DungeonRoom>, sector: SectorId, floorIndex: 1 | 2 | 3): void {
  if (sector < 2 || sector > 4) return;
  for (const room of rooms.values()) {
    if (room.type !== 'combat' || room.isRiftChamber || room.secretParentKey) continue;
    const rng = mulberry32(hashString(`m10:${sector}:${floorIndex}:${room.key}:${room.tileSeed}`));
    if (sector === 2) placePrisms(room, rng, floorIndex);
    else if (sector === 3) placeFoundryMechanics(room, rng, floorIndex);
    else placeTeleporters(room, rng, floorIndex);
  }
}
