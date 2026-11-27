# Handoff — Gegner „Bogen-Drohne“ (`drone_arc`)
> Code: `src/dungeon/anim/rigs/drone_arc.ts`, Daten: `src/data/rigs/drone_arc.json`, Renderer: `drone_arc`-Zweig (`tryDrawEnemyRig`) + Wrack-Block `renderDroneArcWrecks` in `dungeonRenderer.ts`. Test: `tests/m11p10_drone_arc.cjs`. Kontaktbogen: `node scripts/rig-sheet.cjs drone_arc` → `tests/out/rig_drone_arc.png`.

- **Eingebunden:** `drone_arc_rig.png` (P2-04) → Rumpf, Visier, Spule L/R (Code spiegelt), Gondel L/R, Funke klein/groß (`npm run art:import -- drone_arc --force`, `torsoDisplayH 25`).
- **Verhalten:** schwebt mit Wippen, neigt sich in Flugrichtung (Gondeln kippen mit), Blick zum Spieler mit Totzone. Vorwarnung (0,48 s): Spulen neigen sich zueinander und zittern, kleine Funken knistern immer dichter, großer Bogen wächst kurz vor der Entladung, Rumpf weicht zurück. Entladung (Übergang Vorwarnung → Ende): großer Blitz + Rückstoß, Spulen schnellen zurück. Erholung: Blitz klingt ab. Treffer: Zucken (0,14 s). Tod: Wrack-Animation (0,5 s) — Spulen/Gondeln fliegen ab, Rumpf kippt, Blitz, Ausblenden.
- **Fallback:** altes `enemy_drone_arc.png` (`art.droneArc`), Rig-Bild fehlt → unverändert.

## Prüfung G1–G9
| | Status | Nachweis |
| :-- | :-- | :-- |
| G1 Rig vollständig | ✅ | alle 6 Zellen verwendet; Kontaktbogen `tests/out/rig_drone_arc.png` (Spulenfüße am Rumpf, Gondel-Ansätze am Rumpf, kein schwebendes Teil) |
| G2 Rückfall | ✅ | Zweig: `tryDrawEnemyRig` → sonst altes Sprite; Rig-Laden liefert `null` bei fehlendem Bild (`artLoader`) |
| G3 Schweben | ✅ | eigener Rhythmus (7,2 rad/s, Rumpf/Gondeln phasenversetzt), Neigen aus `vx`; Kontaktbogen „flug →/←“ |
| G4 Angriff 3 Abschnitte | ✅ | Vorwarnung (Spulen/Funken/Bogen, füllt die 0,48 s), Entladung (Blitz+Rückstoß 0,3 s), Erholung (Abklingen); Test prüft alle drei |
| G5 Weiche Übergänge | ✅ | Glättung der Engine (`bossAnims.ts`), Funken/Blitz über Alpha statt harter Wechsel; Entladung kantengesteuert, kein Zustandssprung |
| G6 Treffer | ✅ | Zucken ≤ 0,14 s (Test `hitDx`), stört keine Angriffspose (nur Rumpf-dx/Visier) |
| G7 Tod | ✅ | `renderDroneArcWrecks`: Teile fliegen ab + Blitz + Ausblenden (Test `arcDeathPose`). Nur Darstellung; Verbesserung per optionalem Sheet `SPRITE_QUEUE.md` P3-20 |
| G8 Rein optisch | ✅ | keine Änderung an `enemyAi`/`DungeonScene`/Hitbox/Schaden/Zufall; Renderer: nur `drone_arc`-Zweig, Schatten-Zeile, ein Wrack-Aufruf |
| G9 Test & Handoff | ✅ | `m11p10_drone_arc`, dieses Blatt, README-Zeile; `npm run verify` siehe Push |

- **Fehlende Sprites:** nur optional — `SPRITE_QUEUE.md` **P3-20** (Visier halb zu, Überlast-Spule, Wrack-Splitter). Abnahme im echten Kampf offen.
