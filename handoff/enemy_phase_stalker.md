# Handoff — Gegner „Phasen-Jäger“ (`phase_stalker`)
> Eigenes Status-Blatt. Code: `src/dungeon/anim/rigs/phase_stalker.ts`, Daten: `src/data/rigs/phase_stalker.json`, Renderer-Zweig `phase_stalker` in `dungeonRenderer.ts` (nutzt `tryDrawEnemyRig`), Test `tests/m11p8_phase_stalker.cjs`.

- **Eingebunden:** Rumpf/Kopf/2 Klingenarme/2 Beine aus `phase_stalker_rig.png` (`npm run art:import -- phase_stalker --force`, Maßstab `torsoDisplayH 15`).
- **Animation:** durchgehende Kampfhaltung (Klingen angewinkelt, leicht vorgebeugt) → Ausholen (duckt sich, Klingen zurück, flackert) → Sturz (vorgebeugt, Klingen nach vorn) → langsames Ausklingen; alle Übergänge über weich nachgeführte Blends (`ready/wind/atk`), kein Pose-Sprung. Blick zum Spieler.
- **Neu (P1-08 Effekte, P1-09 Arm-Posen):** vorderer Arm = Pose-Set `armR_0…5` (hängend · ausholen · Schlag vorn · Schlag diagonal · Block/Treffer · Rückzug), Effekte `fxSlashL/S` (Schlagbögen im Sturz), `fxRift` (Phasen-Riss am Ende der Vorwarnung + kurz nach der Ankunft), `fxArrive` (Funkenring nach dem Sprung), `fxShards` (Tod). `fxGhost` (Nachbild) ist importiert, noch ungenutzt.
- **G6 Treffer:** Zucken ≤ 0,14 s (Rumpf/Kopf, Arm-Block-Pose), in Angriffsposen auf 30 % gedämpft. **G7 Tod:** `stalkerDeathPose` (0,6 s: Kopf/Arme fliegen ab, Beine knicken, Rumpf kippt, Riss + Splitter); Renderer `renderStalkerWrecks` (zuletzt gesehene Position, wie Bogen-Drohne).
- Der linke (hintere) Arm bleibt ein gedrehtes Einzelbild (liegt hinter dem Rumpf, kaum sichtbar). Fallback: altes `enemy_phase_stalker.png`. Abnahme im echten Kampf offen.

## Prüfung G1–G9
G1 ✅ Kontaktbogen · G2 ✅ unverändert (`tryDrawEnemyRig` → Sprite) · G3 ✅ Beine aus Strecke · G4 ✅ Ausholen/Sturz/Rückfeder je eigene Pose · G5 ✅ Blends `ready/wind/atk` · G6 ✅ · G7 ✅ · G8 ✅ nur `anim/rigs/phase_stalker.ts`, Rig-JSON, Renderer-Zweig + Wrack-Liste · G9 ✅ `m11p8_phase_stalker`, dieses Blatt, `npm run ship`.
