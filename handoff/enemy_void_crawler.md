# Handoff — Gegner „Leere-Krabbler“ (`void_crawler`)
> Eigenes Status-Blatt. Code: `src/dungeon/anim/rigs/void_crawler.ts`, Daten: `src/data/rigs/void_crawler.json`, Renderer-Zweig `void_crawler` (+ `enemyRigDeaths` in `dungeonRenderer.ts`), Test `tests/m11p14_void_crawler.cjs`.

- **Eingebunden:** Panzer mit Doppelhörnern (`torso`), Kopf mit Horn/Mandibeln (`head`), 6 Beine aus 3 Bein-Teilen im Dreifuß-Takt (`legA1/B1/C1`, `legA2/B2/C2`), elektrische Energie-Ranke (`tendril`) aus `void_crawler_rig.png` (`P2-08`, `npm run art:import -- void_crawler --force`).
- **Animation:** Dreifuß-Krabbeln aus Strecke → Vorwarnung (`telegraphTimer` 0,36 s: Ducken, Beine spreizen, Ranke bäumt sich pulsierend auf) → Leere-Dash (`chargeActive` > 0: gestreckt, Ranke peitscht zurück, biom-passende Staubspur) → Erholung (Rückfederung) → Treffer-Zucken (≤ 0,14 s) → Tod (Trümmer + Magenta-Blitz, 0,85 s).
- **Rein optisch:** keine Änderung an `enemyAi.ts`/`DungeonScene.ts`, kein Zufall. Fallback: `enemy_void_crawler.png`.

## Prüfung G1–G10
| # | Status | Nachweis |
| :--- | :--- | :--- |
| G1 | ✅ | alle 6 Sheet-Teile eingebunden — `tests/out/void_crawler_idle.png`, Test `loaded` |
| G2 | ✅ | Fallback-Sprite bei `art.rigs.void_crawler = null` (`withRig !== without`) |
| G3 | ✅ | Dreifuß-Takt aus Strecke, Stand = 1 Winkel (`legsWalk > 3`, `legsStill === 1`) |
| G4 | ✅ | Vorwarnung / Dash / Erholung je eigene Pose |
| G5 | ✅ | Weiche Blends + `tau 0.045` |
| G6 | ✅ | Treffer-Zucken ≤ 0,14 s, klingt ab |
| G7 | ✅ | Tod-Trümmer + Magenta-Blitz (`debris !== after`) |
| G8 | ✅ | rein optisch, kein `Math.random` |
| G9 | ✅ | Test `m11p14_void_crawler`, dieses Blatt, `npm run verify` |
| G10 | ✅ | Biom-passende Dash-Staubspur (`fxDustS1…S5` nach Raum-Biom, Test `s1 !== s2`) |

- **Offen:** Abnahme im echten Kampf (Stufe 8).
