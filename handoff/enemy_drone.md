# Handoff — Gegner „Drohne“ (`drone`)
> Code: `src/dungeon/anim/rigs/drone.ts`, Daten: `src/data/rigs/drone.json`, Renderer: Drohnen-Zweig in `dungeonRenderer.ts` ruft `tryDrawEnemyRig` (+ Wrack-Block `renderDroneWrecks`). Test: `tests/m11p8_drone.cjs`. Kontaktbogen: `node scripts/rig-sheet.cjs drone` → `tests/out/rig_drone.png`. Sprites: `art_source/rigs/drone_rig.png` (v2, `art:gen`, Queue `P2-01b`).

- **Sheet v2:** v1-Gondeln mit langem Ausleger wirkten unnatürlich → neu: kompakte Gondel mit kurzem Stummel (links hinter, rechts vor dem Rumpf), senkrechte Flamme, Visier (Code skaliert 0,68), Lade-Linse. Zellen: body · visor · nacelle · lens · flame · visorHalf.
- **Verhalten:** schwebt + neigt sich in Flugrichtung, Flammen wachsen mit Tempo (Seiten-Dash), Vorwarnung (0,46 s): Visier kneift, Linse glüht, Rumpf weicht zurück; Rückstoß je Bolzen; Blick zum Spieler mit Totzone; blasser Flieger-Schatten.
- **Fallback:** altes `drone.png`. Abnahme im echten Kampf durch den Inhaber: offen.

## Checkliste G1–G10 (Stand: Regeln 12/17)
| | Status | Nachweis / nächster Schritt |
| :-- | :-- | :-- |
| G1 Rig vollständig | ✅ | alle 6 Zellen, Kontaktbogen `tests/out/rig_drone.png` (Gondeln am Rumpf, nichts schwebt) |
| G2 Rückfall | ✅ | `tryDrawEnemyRig` → sonst altes Sprite (Test `m11p1`) |
| G3 Schweben | ✅ | eigener Rhythmus (6,5 rad/s), Neigen aus `vx`, Flammen aus Tempo |
| G4 Angriff in 3 Abschnitten | ⬜ | Vorwarnung ✅, Ausführung (Rückstoß je Bolzen) ✅, **Erholung (eigene Pose nach dem letzten Bolzen) fehlt** → `drone.ts` |
| G5 Weiche Übergänge | ✅ | Glättung `bossAnims.ts`, Linse/Flamme über Alpha |
| G6 Treffer-Reaktion | ⬜ | **fehlt:** Zucken ≤ 0,14 s, in Angriffsposen gedämpft → `drone.ts` + Test |
| G7 Tod | ⬜ | **fehlt:** Wrack-Pose (Gondeln fliegen ab, Rumpf kippt, Blitz) + `renderDroneWrecks` im Renderer (Muster `drone_arc`) + Test |
| G8 Rein optisch | ✅ | keine Änderung an Hitbox/Schaden/Zufall |
| G9 Test & Handoff | ⬜ | `m11p8_drone` ✅, dieses Blatt ✅; Tests für G4/G6/G7 ergänzen, `npm run verify` grün, Screenshot `tests/out/drone_death.png` ansehen |
| G10 Boden-Effekte | ✅ (n/a) | Flieger ohne Boden-Effekte (nur Schatten); Drohne steht nicht in der Fremd-Auftritt-Tabelle (`BOSS_ENEMY_PIPELINE.md` §5) |
| Stufe 8 Abnahme | ⬜ | Projektinhaber: 1–2 echte Kämpfe gegen die Drohne |
