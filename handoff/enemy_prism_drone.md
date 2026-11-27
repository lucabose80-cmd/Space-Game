# Handoff — Gegner „Prisma-Drohne“ (`prism_drone`)
> Eigenes Status-Blatt. Code: `src/dungeon/anim/rigs/prism_drone.ts`, Daten: `src/data/rigs/prism_drone.json`, Renderer-Zweig `prism_drone` (+ `enemyRigDeaths` in `dungeonRenderer.ts`), Test `tests/m11p13_prism_drone.cjs`.

- **Eingebunden:** Obere/untere Prisma-Hälfte (`top`, `bot`), Augenband (`band`), 2 Orbit-Splitter (`shardA`, `shardB`), offener Kern (`core`) aus `prism_drone_rig.png` (`P2-07`, `npm run art:import -- prism_drone --force`).
- **Animation:** Schweben + kreisende Orbit-Splitter → Vorwarnung (`telegraphTimer` 0,46 s: Hälften fahren auseinander, offener Kern blüht rotierend auf, Splitter weiten sich) → Schuss-Impuls (0,18 s: Hälften schnappen zusammen) → Erholung (0,24 s) → Treffer-Zucken (≤ 0,14 s) → Tod (alle Teile fliegen ab + Cyan-Blitz, 0,85 s).
- **Rein optisch:** keine Änderung an `enemyAi.ts`/`DungeonScene.ts`, kein Zufall. Fallback: `enemy_prism_drone.png`.

## Prüfung G1–G10
| # | Status | Nachweis |
| :--- | :--- | :--- |
| G1 | ✅ | alle 6 Sheet-Teile eingebunden — `tests/out/prism_drone_idle.png`, Test `loaded` |
| G2 | ✅ | Fallback-Sprite bei `art.rigs.prism_drone = null` (`withRig !== without`) |
| G3 | ✅ | Schweben + kreisende Orbit-Splitter (`orbitCount > 8`) |
| G4 | ✅ | Vorwarnung (Hälften öffnen + Kern) / Schuss-Impuls / Erholung — `tests/out/prism_drone_tele.png` |
| G5 | ✅ | Weiche Blends + `tau 0.04` |
| G6 | ✅ | Treffer-Zucken ≤ 0,14 s, klingt ab |
| G7 | ✅ | Tod-Trümmer + Cyan-Blitz (`debris !== after`) |
| G8 | ✅ | rein optisch, kein `Math.random` |
| G9 | ✅ | Test `m11p13_prism_drone`, dieses Blatt, `npm run verify` |
| G10 | ✅ | n/a — schwebende Drohne ohne Boden-Effekte |

- **Offen:** Abnahme im echten Kampf (Stufe 8).
