// M12 Phase C: Reaktorhalle des A.E.G.I.S. Leviathan (Sektor 1, Ebene III) — MILESTONE_12_ARCHITECTURE.md §6.
// 688 × 352 logisch = 43 × 22 Kacheln. Norden: Boss-Wand (Sockel `W`, 3 Reihen). Mitte: Plattenfläche `p` mit 4 Pfeilern `#`.
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
    '.............##.ppppppppppp.##.............', // 5
    '................ppppppppppp................', // 6
    'VVVVV.........ppppppppppppppp.........VVVVV', // 7
    'VVVVV.........ppppppppppppppp.........VVVVV', // 8
    'VVVVv.........ppppppppppppppp.........vVVVV', // 9
    'VVVVV.........ppppppppppppppp.........VVVVV', // 10
    'VVVVV.........ppppppppppppppp.........VVVVV', // 11
    'VVVVv.........ppppppppppppppp.........vVVVV', // 12
    'VVVVV.........ppppppppppppppp.........VVVVV', // 13
    'VVVVV.........ppppppppppppppp.........VVVVV', // 14
    '................ppppppppppp................', // 15
    '.............##.ppppppppppp.##.............', // 16
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
};
