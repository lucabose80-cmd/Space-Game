# Handoff — Gegner „Schild-Drohne“ (`shield_drone`)
> Eigenes Status-Blatt. Code: `src/dungeon/anim/rigs/shield_drone.ts`, Daten: `src/data/rigs/shield_drone.json`, Renderer-Zweig `shield_drone` in `dungeonRenderer.ts` (nutzt `tryDrawEnemyRig`, Fallback = altes Einzelbild + `renderShieldArc`).

- **Eingebunden (komplett):** Rumpf, Visier (schaut zum Spieler, glüht in der Vorwarnung), zwei Düsen-Gondeln seitlich am Rumpf (wie im alten Sprite; Emitter-Ring bewusst nicht verwendet — wirkte wie Füße, `emitter.png` bleibt ungenutzt im Sheet, Schub je nach Tempo/Vorwarnung/Rückstoß), Schildbogen `arc` (Pose-Set `arcOn`/`arcHot`).
- **Schildbogen = Spiellogik:** sitzt auf `e.aimAngle` (Block-Bogen ±1,08 rad). Intakt = cyan · Hitze ≥ 70 % = orange · Angriff (Vorwarnung + Nachwirkung, `shieldDownTimer`) = Bogen klappt zum Rumpf ein · Überhitzt = orange/rissig, sputtert & hängt durch (Konter-Fenster). Ursache des Wegklappens wird im Anim-Zustand gemerkt (Angriff vs. Überhitzen). Das „▼“-Konter-Symbol bleibt im Renderer.
- Rig blickt in Zielrichtung (Hysterese auf `cos(aimAngle)`), Spiegelung übernimmt der Renderer; Rückstoß nach der 3er-Salve, Lehnen beim Fliegen, Schwebe-Wippen wie zuvor.
- Rein darstellend — keine Hitbox-/Schadensänderung. Test: `tests/m11p7_shield_drone.cjs`. `tests/m11p1.cjs` prüft die registrierten Rig-Kinds jetzt per „enthält“ (statt exakter Liste → paralleles Arbeiten).
- **Offen:** Abnahme im echten Kampf durch den Projektinhaber (`?bosslab` → Schild-Drohne). Optional später: Schadensstufen / Treffer-Zucken (kein Sprite nötig, nur Pose).
