# Status-Blatt & Architektur-Handbuch: Cutscenes (Expeditions-Flug-Zyklus)

> **Stand:** 2026-11-28 · **Besitzer:** frei (wartet auf Abnahme im echten Spiel)  
> **Zweck:** Vollständige Übergabe für jeden Chat/KI-Wechsel (Claude Code, Antigravity, Cursor, Copilot) — inkl. Architektur, Dateien, Assets und harter Praxis-Learnings.

---

## 1. Was live ist (kompletter Expeditions-Zyklus)

1. **Raumhafen — Geparkte 3/4-Seitenansicht-Schiffe, Einsteigen & Aussteigen** ([`src/scenes/HangarScene.ts`](../src/scenes/HangarScene.ts)):
   - Alle 4 Schiffe (Docks I–IV) ruhen still auf Landestützen (`ship_*_docked.png`, keine laufenden Triebwerke/Schweben im Stand).
   - **Einsteigen & Start (`launchingSector`, `1.55 s`):** Seitentür öffnet sich + Treppe fährt aus (`ship_*_docked_open.png`) → Spieler geht an die Treppe & steigt sichtbar die Stufen hoch in die beleuchtete Kabine → Tür schließt, Cockpit blitzt auf, Dampf → Schiff hebt im echten 3/4-Schräglagen-Sprite (`ship_*_bank.png`) diagonal nach rechts-oben ab.
   - **Landung & Aussteigen (`startDisembark`, `1.55 s`):** Nach erfolgreicher Extraktion (Docks I–IV) schwebt das Schiff diagonal aufs Pad herunter → Touchdown-Dampf → Treppe fährt aus → Spieler geht sichtbar die Stufen herunter aufs Hangar-Deck → Run-Bilanz öffnet sich.
2. **2-Szenen-Sektor-Anflug** ([`src/scenes/SectorApproachCutscene.ts`](../src/scenes/SectorApproachCutscene.ts)):
   - **Szene 1 (`0.00–1.75 s`):** Freier Tiefraum-Flug (Parallax-Nebel, diagonale Warp-Sterne, Asteroiden) mit echtem 3/4-Schräglagen-Sprite (`ship_*_bank.png`).
   - **Szene 2 (`1.75–4.35 s`):** Schnitt auf das lebendig animierte 16:9 Sektor-Vista (`cutscene_bg_s1..s5` mit sektor-spezifischen Live-Overlays: Positionslichter, Reaktorriss-Blitze, Kristallsplitter, Glut, Runenringe, Singularitätsblitze) + Kino-Titelkarte (inkl. `🌙 NACHT-EXPEDITION`-Badge) → Schiff schwenkt mit Tiefen-Skalierung direkt in die Schleuse hinein.
3. **In-Map-Cutscenes direkt auf der echten Dungeon-Karte** ([`src/dungeon/dungeonCutscene.ts`](../src/dungeon/dungeonCutscene.ts)):
   - **`mode: 'land'` (`1.32 s`):** Absetzkapsel (`cutscene_drop_pod.png`) kracht von oben in den echten Startraum (Kamera-Shake + Staub-Schockwelle), Luke springt auf (`cutscene_drop_pod_open.png`), Spieler hüpft sichtbar heraus — **die geöffnete Kapsel bleibt als Y-sortiertes Prop im Startraum stehen** (`DungeonScene.landedPod`).
   - **`mode: 'extract'` (`1.05 s`):** Teleporter-Ring + Lichtstrahl ziehen den Spieler direkt an seinem Standort auf der Map nach oben heraus → Schnitt auf Weltraum-Rückflug.
   - **`mode: 'rescue'` (`1.50 s`):** Bei 0 HP fliegt **Dr. Lyras Med-Evac-Drohne** (`cutscene_med_drone.png`) auf der echten Map von oben über den verletzten, leicht schräg liegenden Spieler und hebt ihn im roten Stasis-Strahl heraus → Schnitt auf Not-Rückflug.
4. **Weltraum-Rückflug nach Port Solaris** ([`src/scenes/SectorReturnCutscene.ts`](../src/scenes/SectorReturnCutscene.ts)):
   - **Kein doppelter Abhol-Strahl mehr:** Da der Kapitän bereits in `DungeonMapCutscene` auf der echten Map hochgebeamt bzw. von der Med-Evac-Drohne geborgen wurde, zeigt Phase 1 direkt den **Abflug aus der Sektor-Schleuse** (Kapitän ist bereits an Bord).
   - **`mode: 'extract'` (`3.35 s`):** Schiff startet aus der Sektor-Schleuse im echten 3/4-Schräglagen-Flug nach rechts-oben → Warp-Blitz → sauberer Ein-Kurven-Anflug (ohne horizontales Spiegeln) direkt in die Hangarbucht von **Port Solaris** (`cutscene_bg_solaris.png`) → Hangar-Landung & Aussteigen.
   - **`mode: 'rescue'` (`3.55 s`):** Med-Evac-Drohne bricht mit Sirene, Rauch- & Funkenspur aus der Sektor-Schleuse aus (Nase exakt am Geschwindigkeitsvektor) → Notlandung in **Port Solaris** → Aufwachen in der Koje.
5. **Aufwachen in der Ruhekoje nach K.O. (0 HP)** ([`src/scenes/BackroomScene.ts`](../src/scenes/BackroomScene.ts)):
   - `BackroomScene.onEnter('rescue', onWakeDone)` startet auf dem unteren Bett (`92, 118`), grünes Med-Bay-Heilglühen, Spieler steigt aus der Koje auf den freien Holzboden davor (`114, 146`), Dr.-Lyra-Toast → Run-Bilanz.

---

## 2. Dateien, Assets, Audio & Tests

- **Eigene Dateien (frei von M11/M12-Konflikten):**
  - `src/scenes/SectorApproachCutscene.ts`
  - `src/scenes/SectorReturnCutscene.ts`
  - `src/dungeon/dungeonCutscene.ts`
  - `tests/cutscene_approach.cjs` (prüft 2-Szenen-Anflug, In-Map Drop-Pod + Prop, In-Map Extraktion, In-Map Med-Evac-Rettung, Rückflug Phase 1 & 2, Skip, Hangar-Disembark & Backroom-Wakeup; Screenshots in `tests/out/cutscene_*.png`).
- **Kleine Hooks in gemeinsamen Dateien:**
  - `src/main.ts`: Orchestrierung von `approachCutscene`, `mapCutscene`, `returnCutscene`, `setHudVisible()`, Routing Extraktion → Hangar-Disembark & Defeat → Backroom-Wakeup.
  - `src/scenes/HangarScene.ts`: 3/4-Seitenansicht-Schiffe (`104×104` geparkt, `94×94` Flug), perspektivische Skalierung (`1.0 ↔ 0.7`) beim Ein-/Aussteigen über die Rampe, `startDisembark()`.
  - `src/scenes/BackroomScene.ts`: `onEnter('rescue', onWakeDone)` Aufwach-Sequenz in der Koje.
  - `src/scenes/DungeonScene.ts`: nur 2 passive Felder (`hidePlayerForCutscene`, `landedPod`).
  - `src/dungeon/dungeonRenderer.ts`: `landedPod` (`46×46`) Y-sortiert in `drawables` + `if (!this.scene.hidePlayerForCutscene)`.
  - `src/engine/audio.ts`: `playApproachWhoosh()`, `playDropBeam()`, `playBoardingChime()`, `playPodLaunch()`, `playEmergencySiren()`.
  - `src/assets/artLoader.ts`: Block `CUTSCENE_OPTIONAL_SPRITES` (21 Sprites, alle vorhanden & in `SPRITE_QUEUE.md` `P3-27`–`P3-47` als `[x]`).
- **Pixel-Art-Sprites unter `public/art/sprites/`:**
  - 16:9 Vistas (`960×540` RGB): `cutscene_bg_s1.png`…`cutscene_bg_s5.png`, `cutscene_bg_solaris.png`
  - Kapsel & Drohne: `cutscene_drop_pod.png` (`64×64`), `cutscene_drop_pod_open.png` (`64×64`), `cutscene_med_drone.png` (`96×96`)
  - 3/4-Schräglagen-Flug (`96×96`): `ship_{corvette,crystal,solar,monolith}_bank.png`
  - 3/4-Seitenansicht geparkt & Rampe offen (`128×128`, Shared-BBox): `ship_{corvette,crystal,solar,monolith}_docked.png` & `*_docked_open.png`

---

## 3. Harte Praxis-Learnings & Fallen (unbedingt beachten!)

1. **`DungeonScene.onReturnToHub` niemals verzögern:** Unit-Tests (`t4b.cjs`, `m10cp6.cjs`) instanziieren `DungeonScene` direkt und erwarten, dass `triggerDefeat()` / `triggerWarp()` den Callback **synchron** feuern. In-Map-Cutscenes daher immer in `main.ts` **über** dem eingefrorenen `DungeonScene`-Canvas abspielen.
2. **`dng.roomFade = 0` beim Start einer In-Map-Cutscene:** `DungeonScene.startRun()` setzt `roomFade = 1`, was nur in `dng.update()` heruntergezählt wird. Da `dng.update()` während `mapCutscene` pausiert, wäre der Dungeon-Raum sonst komplett schwarz!
3. **`transitionDir = 0; transitionAlpha = 0` beim Skip:** Wenn kurz vor einem Skip noch ein Fade-In (`transitionDir === -1`) läuft, ignoriert `transitionTo()` den Aufruf (`if (this.transitionDir !== 0) return`). Beim Skip beide Werte vorher zurücksetzen.
4. **`#hud-layer` UND `#toast-layer` ausblenden:** Sonst schweben ausklingende Toasts mitten über der Kino-Titelkarte (`setHudVisible()` schaltet beide synchron).
5. **Tag/Nacht-Wechsel in `handleReturnFromDungeon()` sofort ausführen:** `tests/m10cp5.cjs` prüft `state.timeOfDay` / `day` und den Morgen-Toast kurz nach `handleReturnFromDungeon()`. Zeitwechsel & Toast müssen **vor** Start der Rückkehr-Cutscene laufen.
6. **Wöchentliche Prüfung & direktes `transitionTo('dungeon', 'hangar')` bleiben ohne Cutscene:** Hält den Speedrun-Timer exakt und hält `tests/t8.cjs` grün.
7. **Schutzzeit `SKIP_LOCK_SEC = 0.25–0.28 s`:** Verhindert, dass ein schnelles Doppel-Drücken von `[E]` im Hangar die Cutscene sofort ungewollt überspringt.
8. **Kein flaches `ctx.rotate()` für Raumschiff-Kurven:** Wirkt wie ein gedrehtes Papierbild. Stattdessen echte 3/4-Schräglagen-Sprites (`ship_*_bank.png`, für Linkskurve horizontal gespiegelt) + 2-Szenen-Schnitt nutzen.
9. **Deckungsgleiche Paar-Sprites immer mit Shared-Union-BBox extrahieren:** Bei `ship_*_docked.png` ↔ `ship_*_docked_open.png` (oder offenen Luken/Türen) immer erst die gemeinsame Bounding-Box beider Bilder bestimmen und beide identisch zuschneiden — sonst springt das Schiff beim Öffnen der Rampe.
10. **Koordinaten in `BackroomScene.ts`:** `SLEEP_POD_POS` (`86, 140`) ist der Interaktionspunkt *vor* dem Bett, nicht die Matratze. Unteres Bett = `(92, 118)`, freier Holzboden davor = `(114, 146)` (bei `y ≥ 170` landet man auf dem Waffenschrank).
11. **Playwright-Tests bei kurzen Cutscenes:** Während `page.screenshot()` läuft, tickt `requestAnimationFrame` weiter — in Tests `g.mapCutscene?.seek(...)` immer mit Optional Chaining absichern.
12. **API-Key-Regel:** Lokaler Gemini-API-Key liegt ausschließlich außerhalb des Repos unter `~/.config/starlighter/gemini_api_key` (`chmod 600`), niemals im Repo oder in Commits.
13. **Proportionen Schiff/Drop-Pod vs. Spieler (`24×28`):** Schiffe im Hangar müssen die achteckigen Pads (`~103×86` logische Pixel) ausfüllen (`104×104` geparkt, `94×94` im Flug, Treppe bei `doorX = dock.x + 10`, `footX = dock.x + 3`), und der Spieler skaliert auf der Treppe perspektivisch `1.0 ↔ 0.7`, damit der Eingang größer/stimmig zum Spieler wirkt. Drop-Pod im Dungeon = `46×46` (`podY = sy - 16`, synchron in `dungeonCutscene.ts`, `dungeonRenderer.ts` und `main.ts`), Med-Evac-Drohne in-map = `50×50`.
14. **Kontinuität zwischen In-Map- & Weltraum-Rückflug:** Niemals denselben Abhol-/Beam-Vorgang in `SectorReturnCutscene` wiederholen — nach `DungeonMapCutscene` (`extract`/`rescue`) ist der Kapitän bereits an Bord, daher zeigt Phase 1 von `SectorReturnCutscene` ausschließlich den Abflug aus der Sektor-Schleuse (ohne `renderPickupBeam` / schwebenden `heroDown`).
15. **Flugkurven & Titelkarte:** Anflugkurven (`SectorApproachCutscene` Phase 2, `SectorReturnCutscene` Phase 2) als einzelne Kurve ohne S-Wendepunkt (verhindert plötzliches horizontales Spiegeln von `ship_*_bank.png`) und oberhalb der Titelkarte (`y ≥ 200`) führen.

---

## 4. Sinnvolle nächste Schritte (erst nach Abnahme / auf Wunsch)

- **Kurz-Modus ab Run #2:** Optionales Save-Feld `seenCutscenes?: string[]` (kompatibel zu Save v11) + Schalter in den Geräte-Einstellungen, damit häufige Runs auf Wunsch kürzer/direkter laufen.
- **Spielstart-Intro & Story-Höhepunkte:** Wiederverwendbarer Panel-Cutscene-Player (3–4 Pixel-Art-Panels mit leichtem Zoom, Partikeln & Schreibmaschinen-Text) für Ankunft auf Port Solaris, Öffnen des 5. Tors & Omega-Finale — wieder abspielbar über die Chronik im Logbuch.
- **Boss-Auftritte (M12 `A6`):** Kino-Balken + `DungeonCamera.focus()` + Boss-Titelbanner bei Erstbegegnung.
