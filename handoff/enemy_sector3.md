# Handoff — Gegner Sektor 3 (`magma_mortar`, `slag_beetle`, `ember_stalker`, `forge_golem`, `solar_drone`)
> Gemeinsames Status-Blatt für alle 5 Sektor-3-Gegner-Rigs (`P2-10`–`P2-14`). Code: `src/dungeon/anim/rigs/{magma_mortar,slag_beetle,ember_stalker,forge_golem,solar_drone}.ts`, Daten: `src/data/rigs/*.json`, Renderer: `m6Def` + `enemyRigDeaths` in `src/dungeon/dungeonRenderer.ts`, Test: `tests/m11p16_sector3_rigs.cjs`.

- **Magma-Mörser (`magma_mortar`, `P2-10`):** Kessel, Mörserrohr, 4 Spinnenbeine, Kappe, glühendes Glutauge in der Mündung (wächst bei Vorwarnung `telegraphTimer > 0`), Schuss-Rückstoß, Erholung, Treffer-Zucken, Tod-Trümmer.
- **Schlacken-Käfer (`slag_beetle`, `P2-11`):** Körper mit glühendem Lava-Bauch, 6 Beine im Dreifuß-Takt, aufklappende Flügeldecken (`wingL`/`wingR`) bei Vorwarnung & Dash, biom-passende Dash-Staubspur (`G10`), Erholung, Treffer-Zucken, Tod-Trümmer.
- **Glut-Jäger (`ember_stalker`, `P2-12`):** Rumpf, Kopf, 2 Feuerklingen-Arme, 2 Beine; Sprint-Schritt, tiefes Ducken mit gekreuzten Klingen vor Blink, Doppelschlag nach Blink, Erholung, Treffer-Zucken, Tod-Trümmer.
- **Gießerei-Golem (`forge_golem`, `P2-13`):** Schwerer Golem-Gang, aufreißende Ofentür mit lodernder Glut (`furnace`) bei Vorwarnung & 8-Wege-Schockstoß, beidhändiger Schlag + Erholung, rotierender Schildbogen bleibt erhalten, Treffer-Zucken, Tod-Trümmer.
- **Solar-Drohne (`solar_drone`, `P2-14`):** Sonnenkern (normal / überladen `coreOver`), 2 gegenläufig rotierende Kardanringe (`holes: true`), 2 Solarpaneele, Sonnen-Fackel (`flare`) beim 3-Schuss-Fächer, Erholung, Treffer-Zucken, Tod-Trümmer.

## Prüfung G1–G10 (alle 5 Gegner)
| # | Status | Nachweis |
| :--- | :--- | :--- |
| G1 | ✅ | alle 5 Rigs mit je 6 Sheet-Teilen importiert (`solar_drone` Ringe mit `holes: true`), Screenshots `tests/out/s3_*_idle.png` visuell geprüft |
| G2 | ✅ | Fallback-Sprite bei `art.rigs[kind] = null` für alle 5 (`withRig !== without`) |
| G3 | ✅ | eigener Lauf-/Schwebe-Rhythmus je Gegner (`moveCount > 3`) |
| G4 | ✅ | Vorwarnung / Angriff / Erholung je eigene Pose (`idleHash !== teleHash`, Screenshots `s3_*_tele.png`) |
| G5 | ✅ | weiche Blends + Engine-Glättung (`tau 0.04–0.05`) |
| G6 | ✅ | Treffer-Zucken ≤ 0,14 s, klingt ab (`hitRot` → `afterHitRot`) |
| G7 | ✅ | Tod-Trümmer + sektortypisches Aufblitzen für alle 5 (`debris !== after`) |
| G8 | ✅ | rein optisch (keine Änderung an `enemyAi.ts`/`DungeonScene.ts`), kein `Math.random` |
| G9 | ✅ | Test `m11p16_sector3_rigs`, dieses Blatt, `npm run verify` |
| G10 | ✅ | `slag_beetle` nutzt biom-passende Dash-Staubspur (`fxDustS1…S5`); übrige 4 ohne Boden-Effekte |

- **Offen:** Abnahme im echten Kampf (Stufe 8).
