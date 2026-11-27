# Handoff — Gegner „Phasen-Jäger“ (`phase_stalker`)
> Eigenes Status-Blatt. Code: `src/dungeon/anim/rigs/phase_stalker.ts`, Daten: `src/data/rigs/phase_stalker.json`, Renderer-Zweig `phase_stalker` in `dungeonRenderer.ts` (nutzt `tryDrawEnemyRig`), Test `tests/m11p8_phase_stalker.cjs`.

- **Eingebunden:** Rumpf/Kopf/2 Klingenarme/2 Beine aus `phase_stalker_rig.png` (`npm run art:import -- phase_stalker --force`, Maßstab `torsoDisplayH 15`).
- **Animation:** durchgehende Kampfhaltung (Klingen angewinkelt, leicht vorgebeugt) → Ausholen (duckt sich, Klingen zurück, flackert) → Sturz (vorgebeugt, Klingen nach vorn) → langsames Ausklingen; alle Übergänge über weich nachgeführte Blends (`ready/wind/atk`), kein Pose-Sprung. Blick zum Spieler.
- **Neu (P1-08 Effekte, P1-09 Arm-Posen):** vorderer Arm = Pose-Set `armR_0…5` (hängend · ausholen · Schlag vorn · Schlag diagonal · Block/Treffer · Rückzug), Effekte `fxSlashL/S` (Schlagbögen im Sturz), `fxRift` (Phasen-Riss am Ende der Vorwarnung + kurz nach der Ankunft), `fxArrive` (Funkenring nach dem Sprung), `fxShards` (Tod). `fxGhost` (Nachbild) bleibt 0,35 s am Absprungpunkt des Phasen-Sprungs.
- **G6 Treffer:** Zucken ≤ 0,14 s (Rumpf/Kopf, Arm-Block-Pose), in Angriffsposen auf 30 % gedämpft. **G7 Tod:** `stalkerDeathPose` (0,6 s: Kopf/Arme fliegen ab, Beine knicken, Rumpf kippt, Riss + Splitter); Renderer `renderStalkerWrecks` (zuletzt gesehene Position, wie Bogen-Drohne).
- Der linke (hintere) Arm bleibt ein gedrehtes Einzelbild (liegt hinter dem Rumpf, kaum sichtbar). Fallback: altes `enemy_phase_stalker.png`. Abnahme im echten Kampf offen.

## Checkliste G1–G10 (Regel 17 — Stand: siehe Git-Log; Nächstes = oberster ⬜)
- ✅ G1 Rig vollständig — 6 Teile + Arm-Pose-Set + Effekte, Kontaktbogen/Zoom geprüft
- ✅ G2 Rückfall sicher — Test `m11p8` setzt `art.rigs.phase_stalker = null` → Fallback-Sprite wird ohne Fehler gezeichnet (Hash ≠ Rig)
- ✅ G3 Eigene Fortbewegung — Beine/Arme aus Strecke, Test `legsWalk > 3 / legsStill === 1`
- ✅ G4 Angriff in 3 Abschnitten — Ausholen (Arm 1, Riss) / Sturz (Arm 2–3, Schlagbögen, Ankunftsring) / Rückfeder (Arm 5)
- ✅ G5 Weiche Übergänge — Blends `ready/wind/atk`, kein Pose-Sprung (Pose-Bogen)
- ✅ G6 Treffer — Zucken ≤ 0,14 s, Block-Pose, in Angriffsposen gedämpft (Test)
- ✅ G7 Tod — `stalkerDeathPose` + `renderStalkerWrecks` (Test)
- ✅ G8 Rein optisch — nur `anim/rigs/phase_stalker.ts`, Rig-JSON, Renderer-Zweig + Wrack-Liste; kein `Math.random`
- ✅ G9 Test/Handoff/Screenshot — `m11p8`, dieses Blatt, Szenen-Screenshots `tests/out/phase_stalker_shot{Idle,Tele,Jump,Death}.png` angesehen
- ✅ G10 Boden-Effekte — Jäger tritt in Spirale/Omega auf (§5), hat aber **keine Boden-Effekte**: Schlagbogen, Phasen-Riss, Ankunfts-Funkenring, Nachbild, Splitter und Tod sind Körper-/Energie-Effekte (Pink/Magenta, leuchtend, kein Kontakt mit Bodenmaterial) → ein Sheet (`phase_stalker_fx`) gilt in jedem Biom, kein `_ground`-Sheet nötig. Nachbild `fxGhost` jetzt am Absprungpunkt eingebaut (normales Mischen, lesbar auf jedem Boden). Falls der Inhaber den Funkenring doch als Boden-Effekt will → `phase_stalker_ground.png` (S1–S5) in `SPRITE_QUEUE.md` bestellen
- ⬜ Abnahme im echten Kampf durch den Projektinhaber (erlaubter Haltegrund, Regel 17b). **Nächste Schritte nach Feedback:** zu große/kleine Schlagbögen → Skalierung `slashL/slashS` (`sx/sy`) in `src/dungeon/anim/rigs/phase_stalker.ts`; Pose/Arm unpassend → Ersatz-Sheet in `SPRITE_QUEUE.md` bestellen (Ersatz für `P1-09` `phase_stalker_arms_R.png`, Prompt in `ART_BRIEF_M11_ENEMIES.md` „Zusatz Phasen-Jäger“), dann `npm run art:import -- phase_stalker --force`; Funkenring als Boden-Effekt gewünscht → `phase_stalker_ground.png` (S1–S5, `BOSS_ENEMY_PIPELINE.md` §5) bestellen. Optional: hinterer (linker) Arm als Pose-Set (`phase_stalker_arms_L.png`) statt gedrehtem Einzelbild. Prüfen: `npm test -- m11p8_phase_stalker`, Szenen-Screenshots `tests/out/phase_stalker_shot*.png`.
- Offene Queue-Einträge dieses Bereichs: keine (`P1-08`/`P1-09` ✅).
