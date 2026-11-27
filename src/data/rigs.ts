// M11: Rig-Definitionen (Daten in src/data/rigs/*.json — gemeinsam mit scripts/art-import.py).
import type { Enemy } from '../dungeon/dungeonTypes';
import type { RigDef, RigPartDef } from '../engine/rig';
// Jedes Rig liegt in einer eigenen Datei `rigs/<rig-id>.json` (paralleles Arbeiten ohne Merge-Konflikte).
const rigModules = import.meta.glob('./rigs/*.json', { eager: true, import: 'default' }) as Record<string, RigJson>;

interface RigJson {
  kind: Enemy['kind'];
  sheet: {
    file: string;
    order: string[];
    pixelRatio?: number;
    cols?: number;
    rows?: number;
    scaleRef?: string;
    torsoDisplayH?: number;
    /** Pose-Sets (M11 v2): Sheet-Datei, Modus, Bildnamen; `cells` teilt ein Sheet in mehrere Sets */
    sets?: { file: string; mode: 'limb' | 'swap'; ids: string[]; cells?: number[] }[];
  };
  parts: RigPartDef[];
  /** zusätzliche Bilder ohne eigenes Teil (z. B. kreisende Fäuste) — werden mitgeladen */
  extraImages?: string[];
}

const raw: Record<string, RigJson> = Object.fromEntries(Object.entries(rigModules).map(([path, def]) => [path.replace(/^.*\/(.+)\.json$/, '$1'), def]));

export const RIGS: Record<string, RigDef> = Object.fromEntries(Object.entries(raw).map(([id, r]) => [id, { id, parts: r.parts, ratio: r.sheet.pixelRatio ?? 1 }]));

/** Welcher Gegner/Boss (kind) nutzt welches Rig. */
export const RIG_BY_KIND: Partial<Record<Enemy['kind'], string>> = Object.fromEntries(Object.entries(raw).map(([id, r]) => [r.kind, id]));

/** Alle Bildnamen eines Rigs (aus den Teilen, ohne Doppelte). */
export function rigImageNames(id: string): string[] {
  return [...new Set([...RIGS[id].parts.flatMap((p) => [p.image ?? p.id, ...(p.variants ?? [])]), ...(raw[id].extraImages ?? [])])];
}
