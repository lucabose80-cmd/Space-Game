// M12 Phase C: Datenformat der Endboss-Arenen (handgebaut, kein Zufall — A10).
import type { EnemyKind } from '../../world/dungeonGen';

/**
 * Kachelzeichen (16 × 16 logische px):
 * - `.` Boden · `p` Bodenplatte (begehbar; bricht in Phase II weg → Phase D)
 * - `W` Boss-Wand-Sockel (fest, Körper des Bosses) · `#` Deckungs-Pfeiler (fest) · `V` Kühlaggregat (fest)
 * - `v` Kühlventil (fest; Schwachstelle ab Phase II)
 */
export type ArenaTile = '.' | 'p' | 'W' | '#' | 'V' | 'v';

export interface ArenaDef {
  kind: EnemyKind;
  /** Anzeigename der Halle */
  name: string;
  /** Spielfläche in logischen px (= Kacheln × 16) */
  size: { w: number; h: number };
  /** Kachelplan: `size.h / 16` Zeilen à `size.w / 16` Zeichen */
  tiles: string[];
  /** Ankerpunkt des Boss-Körpers relativ zur linken oberen Ecke der Spielfläche */
  bossAnchor: { x: number; y: number };
  /** optionale Sprites (Schlüssel in `M12_OPTIONAL_SPRITES`) — fehlen sie, zeichnet `arenaFloor.ts` prozedural */
  bgSprite?: string;
  wallSprite?: string;
  /** Höhe der Boss-Wand über der Spielfläche + Sockel (logische px), passend zum Wand-Sprite */
  wallHeight: number;
  /** Kamera darf so weit über die Spielfläche schauen (logische px, Standard 46 = wie Standardraum) */
  viewAbove?: number;
  /** Kamera hält den Spieler um so viel tiefer im Bild (Boss sichtbar) */
  cameraBiasY?: number;
}

export const ARENA_TILE = 16;
