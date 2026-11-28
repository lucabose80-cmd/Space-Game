// M12 Phase C: Reaktorhalle des A.E.G.I.S. Leviathan (Sektor 1, Ebene III) — MILESTONE_12_ARCHITECTURE.md §6.
// 688 × 352 logisch = 43 × 22 Kacheln. Norden: Boss-Wand (Sockel `W`, 3 Reihen). Mitte: 4 kleine Bodenplatten-Blöcke `p` (brechen in Phase II zu 4 kleinen Gruben weg, Kreuz-Gang bleibt begehbar) + 4 Pfeiler `#`.
// Seiten: Kühlaggregat mit je 2 Kühlventilen `v`. Türen werden vom Grundriss des Stockwerks bestimmt (Süden üblich) — eine Nordtür
// bekommt einen Durchgang durch den Sockel (siehe `attachArenas`).
import type { ArenaDef } from './types';

export const LEVIATHAN_ARENA: ArenaDef = {
  kind: 'boss_leviathan',
  name: 'Reaktorhalle',
  size: { w: 688, h: 352 },
  // Abgestimmt auf arena_leviathan_bg.png (P1-03): Glut-Gitter = `p`, Pfeiler auf den 4 Sockeln, Kühlaggregate links/rechts
  // (`V` fest, `v` = Kühlsektion = Schwachstelle an der Vorderseite).
  // 0         1         2         3         4
  // 0123456789012345678901234567890123456789012
  tiles: [
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW', // 0
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW', // 1
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW', // 2
    '...........................................', // 3
    '.............##.............##.............', // 4
    '.............##.............##.............', // 5
    '...............ppppp...ppppp...............', // 6
    'VVVVV..........ppppp...ppppp..........VVVVV', // 7
    'VVVVV..........ppppp...ppppp..........VVVVV', // 8
    'VVVVv..........ppppp...ppppp..........vVVVV', // 9
    'VVVVV.................................VVVVV', // 10
    'VVVVV.................................VVVVV', // 11
    'VVVVv.................................vVVVV', // 12
    'VVVVV..........ppppp...ppppp..........VVVVV', // 13
    'VVVVV..........ppppp...ppppp..........VVVVV', // 14
    '...............ppppp...ppppp...............', // 15
    '.............##ppppp...ppppp##.............', // 16
    '.............##.............##.............', // 17
    '...........................................', // 18
    '...........................................', // 19
    '...........................................', // 20
    '...........................................', // 21
  ],
  bossAnchor: { x: 344, y: 4 }, // Kern-Linse bei y = 10 (vom Sockelrand aus mit der Klinge erreichbar)
  bgSprite: 'arenaLeviathanBg',
  wallSprite: 'arenaLeviathanWall',
  wallHeight: 96,
  // Boss-Körper (arena_leviathan_body.png, 300×167 logisch) ragt bis ~102 px über die Spielfläche
  viewAbove: 112,
  cameraBiasY: 40,
  // Schatzkammer links neben dem Koloss (Wand-Abschnitt ohne Körper), Bild arena_leviathan_vault.png (P1-12, 176×112)
  vault: { x: 8, y: -160, w: 176, h: 112, doorX: 80, doorW: 32, inset: { side: 14, top: 24, bottom: 12 } },
};
