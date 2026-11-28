# Status-Blatt: Cutscenes (Expeditions-Flug-Zyklus komplett)

> **Stand:** 2026-11-28 · **Kompletter Flug-Zyklus umgesetzt & bereit zur Abnahme im echten Spiel**

## Was live ist
1. **Geparkte Schiffe & 3-Phasen-Start im Raumhafen** ([`src/scenes/HangarScene.ts`](../src/scenes/HangarScene.ts)):
   - Angedockte Schiffe ruhen still auf dem Pad (kein Schweben, keine laufenden Triebwerksflammen/-funken im Leerlauf).
   - Beim Start an Dock I–IV: **Einsteigen** (Spieler läuft in die Luke + `sound.playBoardingChime()`), **Triebwerks-Zündung** (Flammen an, Zündungs-Dampfring, leichtes Vibrieren & sanftes Abheben), **Abheben** aus dem Hangar.
2. **Sektor-Anflug-Cutscene** ([`src/scenes/SectorApproachCutscene.ts`](../src/scenes/SectorApproachCutscene.ts)):
   - **Dynamischer Kurvenflug:** S-Kurve (kubische Bézier) mit Tangenten-Neigung, Banking-Roll, Flügelspitzen-RCS-Steuerdüsen & gekrümmten Zwillings-Triebwerksspuren.
   - **Lebendiger, bewegter Sektor-Hintergrund:** sanfter Kamera-Drift + Zoom + sektor-spezifische Live-Animationen (S1 blinkende Positionslichter, flackernder Cyan-Riss-Lichtbogen, Trümmer, Schleusenlichter; S2 Kristall-Glitzern & kreisende Splitter; S3 aufsteigende Glut & Sonnen-Korona; S4 kreisende goldene Runen-Lichter; S5 Singularitäts-Blitze).
   - **Absetzkapsel (Drop-Pod):** feuert `cutscene_drop_pod.png` mit Leitringen, Bremsdüsen & Landeblitz direkt in die Schleuse (`sound.playPodLaunch()`).
3. **Extraktions- & Notfall-Bergungs-Cutscene** ([`src/scenes/SectorReturnCutscene.ts`](../src/scenes/SectorReturnCutscene.ts)):
   - **Extraktion (sichere Rückkehr):** gold-türkiser Abholstrahl mit Beute-Schimmer → Kurvenflug & Einflug in die **Port-Solaris-Raumstation** (`cutscene_bg_solaris.png`) → Hangar + Run-Bilanz.
   - **Notfall-Bergung (0 HP / Besiegt):** roter Alarm-Glitch (`sound.playEmergencySiren()`), **Dr. Lyras Med-Evac-Drohne** (`cutscene_med_drone.png`) zieht den verletzten Kapitän hoch → Notlandung in Port Solaris → Hangar + Run-Bilanz.
   - Alle Cutscenes sind jederzeit überspringbar (nach 0,28 s) und blenden `#hud-layer` + `#toast-layer` sauber aus. Wöchentliche Prüfung bleibt ohne Cutscene.
4. **Pixel-Art-Assets (alle visuell geprüft & in `SPRITE_QUEUE.md` `[x]`):**
   - `cutscene_bg_s1.png`…`cutscene_bg_s5.png` (`960×540` RGB), `cutscene_bg_solaris.png` (`960×540` RGB), `cutscene_drop_pod.png` (`64×64` RGBA), `cutscene_med_drone.png` (`96×96` RGBA).
5. **Tests:** `tests/cutscene_approach.cjs` (Kurvenflug, Drop-Pod, Skip, Extraktion, Notfall-Bergung) + `m10cp5`, `t4c`, `t8` grün.

## Offen / Nächster Schritt nach Abnahme
- Abnahme durch den Projektinhaber im echten Spiel.
- Optional später: Kurz-Modus ab dem 2. Flug (`seenCutscenes?` im Save v11) + Spielstart-Intro / Story-Cutscenes.
