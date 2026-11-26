// M11: Rig-Definitionen (Daten in rigs.json — gemeinsam mit scripts/art-import.py).
import type { Enemy } from '../dungeon/dungeonTypes';
import type { RigDef, RigPartDef } from '../engine/rig';
import rigData from './rigs.json';

interface RigJson {
  kind: Enemy['kind'];
  sheet: { file: string; order: string[] };
  parts: RigPartDef[];
}

const raw = rigData as unknown as Record<string, RigJson>;

export const RIGS: Record<string, RigDef> = Object.fromEntries(Object.entries(raw).map(([id, r]) => [id, { id, parts: r.parts }]));

/** Welcher Gegner/Boss (kind) nutzt welches Rig. */
export const RIG_BY_KIND: Partial<Record<Enemy['kind'], string>> = Object.fromEntries(Object.entries(raw).map(([id, r]) => [r.kind, id]));

/** Alle Bildnamen eines Rigs (aus den Teilen, ohne Doppelte). */
export function rigImageNames(id: string): string[] {
  return [...new Set(RIGS[id].parts.map((p) => p.image ?? p.id))];
}
