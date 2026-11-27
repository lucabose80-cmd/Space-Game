// M12 Phase C: Reaktorhalle des A.E.G.I.S. Leviathan (Sektor 1, Ebene III) — MILESTONE_12_ARCHITECTURE.md §6.
// 688 × 352 logisch = 43 × 22 Kacheln. Norden: Boss-Wand (Sockel `W`, 3 Reihen). Mitte: Plattenfläche `p` mit 4 Pfeilern `#`.
// Seiten: je 2 Kühlventile `v`. Türen werden vom Grundriss des Stockwerks bestimmt (Süden üblich) — eine Nordtür
// bekommt einen Durchgang durch den Sockel (siehe `attachArenas`).
import type { ArenaDef } from './types';

export const LEVIATHAN_ARENA: ArenaDef = {
  kind: 'boss_leviathan',
  name: 'Reaktorhalle',
  size: { w: 688, h: 352 },
  // 0         1         2         3         4
  // 0123456789012345678901234567890123456789012
  tiles: [
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW', // 0
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW', // 1
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW', // 2
    '...........................................', // 3
    '...........................................', // 4
    '...........................................', // 5
    '...........................................', // 6
    'v.........##.....................##.......v', // 7
    '..........##.....................##........', // 8
    '.............ppppppppppppppppp.............', // 9
    '.............ppppppppppppppppp.............', // 10
    '.............ppppppppppppppppp.............', // 11
    '.............ppppppppppppppppp.............', // 12
    '..........##.ppppppppppppppppp...##........', // 13
    'v.........##.....................##.......v', // 14
    '...........................................', // 15
    '...........................................', // 16
    '...........................................', // 17
    '...........................................', // 18
    '...........................................', // 19
    '...........................................', // 20
    '...........................................', // 21
  ],
  bossAnchor: { x: 344, y: 30 },
  bgSprite: 'arenaLeviathanBg',
  wallSprite: 'arenaLeviathanWall',
  wallHeight: 96,
};
