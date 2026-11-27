// M11: Schnittstelle eines Rig-Animationsmoduls. Jede Datei `anim/rigs/<rig-id>.ts` exportiert `anim: RigAnim` und wird von
// `bossAnims.ts` automatisch gefunden (Dateiname = Rig-Id aus `src/data/rigs/<rig-id>.json`). Neue Rigs brauchen keine Änderung an gemeinsamen Dateien.
import type { Pose } from '../../engine/rig';
import type { Enemy } from '../dungeonTypes';

export interface RigAnim {
  /** Ziel-Pose je Frame (ungeglättet). `lookDx/lookDy` = Spieler minus Gegner (bei gespiegeltem Rig: dx bereits in Blickrichtung). */
  rawPose(e: Enemy, time: number, lookDx: number, lookDy: number): Pose;
  /** Zeitkonstante der Glättung (s); Standard `SMOOTH_TAU` (0,05). */
  tau?: number;
  /** Teile, deren Bildwechsel KEINEN Stauch-Impuls bekommen. */
  noPulse?: string[];
  /** Bildwechsel dieses Teils erst nach x Sekunden (z. B. linker Arm folgt rechtem). */
  lag?: Record<string, number>;
  /** Zwischen-Pose (Variantenindex) für kurzes Überblenden beim Wechsel `prev → next` von Teil `partId`, sonst `undefined`. */
  between?(partId: string, prev: number, next: number): number | undefined;
  /** Blickrichtung (−1 links / +1 rechts), wenn der Renderer das ganze Rig spiegeln soll (Gegner-Rigs). */
  facing?(e: Enemy, playerX: number): number;
}
