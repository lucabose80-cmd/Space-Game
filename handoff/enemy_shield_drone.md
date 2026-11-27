# Handoff — Gegner „Schild-Drohne“ (`shield_drone`)
> Eigenes Status-Blatt. Code: `src/dungeon/anim/rigs/shield_drone.ts`, Daten: `src/data/rigs/shield_drone.json`, Renderer-Zweig `shield_drone` in `dungeonRenderer.ts` (nutzt `tryDrawEnemyRig`, Fallback = altes Einzelbild + `renderShieldArc`).

- **Eingebunden (komplett):** Rumpf, Visier (schaut zum Spieler, glüht in der Vorwarnung), zwei Düsen-Gondeln seitlich am Rumpf (wie im alten Sprite; Emitter-Ring bewusst nicht verwendet — wirkte wie Füße, `emitter.png` bleibt ungenutzt im Sheet, Schub je nach Tempo/Vorwarnung/Rückstoß), Schildbogen `arc` (Pose-Set `arcOn`/`arcHot`).
- **Schildbogen = Spiellogik:** sitzt auf `e.aimAngle` (Block-Bogen ±1,08 rad). Intakt = cyan · Hitze ≥ 70 % = orange · Angriff (Vorwarnung + Nachwirkung, `shieldDownTimer`) = Bogen klappt zum Rumpf ein · Überhitzt = orange/rissig, sputtert & hängt durch (Konter-Fenster). Ursache des Wegklappens wird im Anim-Zustand gemerkt (Angriff vs. Überhitzen). Das „▼“-Konter-Symbol bleibt im Renderer.
- Rig blickt in Zielrichtung (Hysterese auf `cos(aimAngle)`), Spiegelung übernimmt der Renderer; Rückstoß nach der 3er-Salve, Lehnen beim Fliegen, Schwebe-Wippen wie zuvor.
- Rein darstellend — keine Hitbox-/Schadensänderung. Test: `tests/m11p7_shield_drone.cjs`. `tests/m11p1.cjs` prüft die registrierten Rig-Kinds jetzt per „enthält“ (statt exakter Liste → paralleles Arbeiten).
- **Offen:** Abnahme im echten Kampf durch den Projektinhaber (`?bosslab` → Schild-Drohne). Optional später: Schadensstufen / Treffer-Zucken (kein Sprite nötig, nur Pose).

- **Schildbögen (P2-02b, `shield_drone_arcs.png`):** 6 flache, symmetrische Sicheln (intakt · heiß · überhitzt/rissig · flackert · Block-Blitz · klein beim Einklappen) ersetzen Zellen 5/6 von `shield_drone_rig.png` (asymmetrischer Haken wirkte vor dem Rumpf seltsam). Block-Blitz wird über den Hitze-Anstieg erkannt. Alte Zellen 5/6 + Emitter-Ring sind ungenutzt.

## Checkliste G1–G10 (Regel 17 — Nächstes = oberster ⬜)
- ✅ G1 Rig vollständig — Rumpf, Visier, 2 Düsen, Schildbogen-Pose-Set (6 Bilder, `shield_drone_arcs.png`); Kontaktbogen + Szenen-Screenshot `tests/out/shield_drone_shotIdle.png` angesehen. Emitter-Ring bewusst weggelassen (wirkte wie Füße)
- ✅ G2 Rückfall sicher — Test `m11p7_shield_drone`: `art.rigs.shield_drone = null` → altes Sprite + `renderShieldArc` ohne Fehler (Hash ≠ Rig)
- ✅ G3 Eigene Fortbewegung — Schwebe-Wippen (`sin(t·5,2+id)`), Lehnen aus `vx`, Düsenschub aus Tempo/Vorwarnung/Rückstoß
- ✅ G4 Angriff in 3 Abschnitten — Vorwarnung (Bogen klappt ein, Visier glüht, Düsen fauchen) · Salve (Rückstoß 0,22 s) · Erholung (Rumpf sackt, Visier dimmt, solange Schild offen; Bogen fährt flackernd wieder aus)
- ✅ G5 Weiche Übergänge — Engine-Glättung + eigene Raten für Bogen (`arcK`: aus 11/s, ein 3,2/s)
- ✅ G6 Treffer — Rumpf zuckt ≤ 0,12 s (`flashTimer`), in der Vorwarnung auf 30 % gedämpft; Block-Blitz des Bogens bei geblocktem Treffer (Hitze-Anstieg) (Test)
- ✅ G7 Tod — `shieldDroneDeathPose` (0,6 s: Düsen reißen ab, Rumpf kippt/sackt/blendet aus, Bogen zerspringt) + `renderShieldDroneWrecks` im Renderer (Test + `shield_drone_shotDeath.png`)
- ✅ G8 Rein optisch — nur `anim/rigs/shield_drone.ts`, Rig-JSON, Renderer-Zweig + Wrack-Liste; kein Zufall, keine Hitbox-/Schadensänderung
- ✅ G9 Test/Handoff/Screenshots — `tests/m11p7_shield_drone.cjs`, dieses Blatt, `tests/out/shield_drone_shot{Idle,Attack,Death}.png`
- ✅ G10 Boden-Effekte — Schild-Drohne schwebt, hat nur Körper-/Energie-Effekte (Bogen, Blitz, Splitter); kein Bodenkontakt → kein `_ground`-Sheet nötig (tritt in Riss-Kammern/Spirale/Omega auf, Effekte sind farbneutral cyan/orange)
- ⬜ Abnahme im echten Kampf durch den Projektinhaber (erlaubter Haltegrund) — danach ggf. Feinschliff (Bogen-Abstand `ARC_PUSH`, Düsen-Offsets in `shield_drone.json`)
