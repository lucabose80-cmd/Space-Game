# Handoff — Gegner „Kristall-Krabbler“ (`crystal_crawler`)
> Eigenes Status-Blatt. Code: `src/dungeon/anim/rigs/crystal_crawler.ts`, Daten: `src/data/rigs/crystal_crawler.json`, Renderer-Zweig `crystal_crawler` (+ `collectCrawlerDebris`, eine Zeile in der Drawables-Liste) in `dungeonRenderer.ts`, Test `tests/m11p11_crystal_crawler.cjs`, Prüfbogen `node scripts/rig-sheet.cjs crystal_crawler` (Fall ergänzt).

- **Eingebunden:** Panzer, Kopf, Rücken-Kristall, 3 Beine als Beinpaar-Duplikate (nahe Seite z 2 / ferne Seite z 0, ungespiegelt, leicht versetzt) aus `crystal_crawler_rig.png` (`npm run art:import -- crystal_crawler --force`, `torsoDisplayH 17`). Zellreihenfolge: Panzer · Kopf · Bein A (vorn) · Bein B · Bein C (hinten) · Kristall.
- **Animation:** Krabbeln im **Dreifuß-Takt** (A1/C1/B2 gegen B1/A2/C2, Schrittphase aus Strecke, Fuß hebt, im Stand nur Atmen) → Vorwarnung (`telegraphTimer` 0,38 s: duckt sich, Beine spreizen, Kristall wächst + pulsiert, Zittern, leuchtender Panzer `fxGlow` pulsiert über dem Rig) → Vorschnellen (`chargeActive`: Funkenspur `fxDust` hinter dem Tier; Körper gestreckt nach vorn, Beine angelegt und huschend) → Erholung (0,35 s Rückfederung) → Treffer-Zucken (Flanke `flashTimer`, 0,14 s, Richtung wechselt, in Angriffsposen gedämpft) → Tod (Kristall-Splitter ×4, Panzerbruch, Kopf, Beine splittern ab, 0,95 s). Alle Übergänge über weich nachgeführte Blends; Blick zum Spieler (Rig gespiegelt).
- **Rein optisch:** keine Änderung an `enemyAi.ts`/`DungeonScene.ts`, Hitbox, Schaden oder Zustandsdauern; kein Zufall. Tod-Erkennung im Renderer: zuletzt gesehene Position + `enemiesDefeated` gestiegen.
- Fallback: altes `enemy_crystal_crawler.png` (Test schaltet das Rig ab und rendert).

## Prüfung G1–G10
| # | Status | Nachweis |
| :--- | :--- | :--- |
| G1 | ✅ | alle 6 Sheet-Teile eingebunden, Gelenke sitzen — `tests/out/crystal_crawler_poses.png` (6×-Zoom), Test `loaded` |
| G2 | ✅ | Rig-Schalter: Test setzt `art.rigs.crystal_crawler = null` → Fallback-Sprite wird ohne Fehler gezeichnet (Hash ≠ Rig) |
| G3 | ✅ | Beine aus Strecke im Dreifuß-Takt, Stand = 1 Beinwinkel; Test `legsWalk > 3`, `legsStill === 1`, `opposite` |
| G4 | ✅ | Vorwarnung (Ducken + Kristall glüht) / Vorschnellen (gestreckt) / Erholung (Rückfederung) je eigene Pose; füllt vorhandene 0,38 s — Test je Abschnitt |
| G5 | ✅ | Blends `wind/atk/recover` + Glättung `tau 0.045` der Engine, kein Pose-Sprung (Pose-Bogen) |
| G6 | ✅ | Treffer-Zucken ≤ 0,14 s, bei Angriffsposen auf 30 % gedämpft; Test „Zucken, danach wieder ruhig“ |
| G7 | ✅ | Tod: Kristalle/Kopf/Beine fliegen ab + Aufblitzen + Boden-Rückstand (`fxRemnant`) — `tests/out/crystal_crawler_death.png`, Test „Splitter sichtbar, später weg“ |
| G8 | ✅ | nur `anim/rigs/crystal_crawler.ts`, Rig-JSON, Renderer-Zweig (+ eine Drawables-Zeile), Prüfbogen-Fall; kein `Math.random` |
| G9 | ✅ | Test `m11p11_crystal_crawler`, dieses Blatt, `npm run verify` |
| G10 | ✅ | Biom-Boden-Effekte `P2-21` (`crystal_crawler_ground.png` → `fxDustS1…S5`, `fxRemnant`) importiert & nach Raum-Biom (`riftSector` → `visualSector` → `currentSector`) gewählt; Test `groundLoaded` & `chargeS1 !== chargeS2` |

- **Effekt-Sheets:** `P3-21` (`crystal_crawler_fx.png`) + `P2-21` (`crystal_crawler_ground.png`) importiert und verdrahtet.
- **Offen:** Abnahme im echten Kampf (Stufe 8).
