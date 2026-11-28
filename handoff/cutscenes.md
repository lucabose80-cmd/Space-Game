# Status-Blatt: Cutscenes (Teil A + Teil B komplett live)

> **Stand:** 2026-11-28 · **Kompletter runder Expeditions-Zyklus (Hangar → All → Map-Landung → Map-Abholung/Drohnen-Rettung → Port Solaris)**

## Was live ist
1. **Auffälliges 4-Phasen-Einsteigen im Raumhafen** ([`src/scenes/HangarScene.ts`](../src/scenes/HangarScene.ts)):
   - Geparkte Schiffe ruhen still auf dem Pad (ohne Schweben/Triebwerksflammen).
   - Startsequenz: **Einstiegsrampe fährt aus** → **Spieler läuft & hüpft sichtbar im Bogen in die Luke** → **Cockpit blitzt auf & Dock-Halteklammern lösen sich mit Dampf** → **Triebwerke zünden & Abheben**.
2. **2-Szenen-Weltraumflug mit echten 3/4-Schräglagen-Sprites** ([`src/scenes/SectorApproachCutscene.ts`](../src/scenes/SectorApproachCutscene.ts)):
   - **Szene 1 (0.00–1.75 s):** Freier Tiefraum-Flug mit Parallax-Nebeln, diagonalen Warp-Sternen & Asteroiden; Schiff fliegt mit echtem **3/4-Schräglagen-Sprite** (`ship_*_bank.png`, kein flaches gedrehtes Bild!).
   - **Szene 2 (1.75–4.35 s):** Schnitt auf das lebendig animierte Sektor-Vista (`cutscene_bg_s1..s5`); Schiff kommt groß aus der Flanke (gespiegeltes Schräglagen-Sprite) und fliegt mit echter Tiefen-Skalierung direkt in die leuchtende Schleuse hinein.
3. **In-Map-Cutscenes direkt auf der echten Dungeon-Map** ([`src/dungeon/dungeonCutscene.ts`](../src/dungeon/dungeonCutscene.ts)):
   - **Drop-Pod-Landung & Aussteigen (`mode: 'land'`):** Absetzkapsel kracht von oben in den Startraum (Kamera-Shake + Staubring), Luke springt auf (`cutscene_drop_pod_open.png`), Spieler hüpft sichtbar heraus — die geöffnete Kapsel bleibt als Y-sortiertes Prop im Startraum stehen!
   - **Sichtbare Teleporter-Extraktion (`mode: 'extract'`):** Teleporter-Ring + Lichtstrahl ziehen den Spieler direkt an seinem Standort auf der Map nach oben raus → Schnitt auf den Weltraum-Rückflug nach **Port Solaris** (`SectorReturnCutscene.ts`, ebenfalls mit echten Schräglagen-Sprites).
   - **Med-Evac-Drohnen-Bergung bei 0 HP (`mode: 'rescue'`):** Dr. Lyras Med-Evac-Drohne (`cutscene_med_drone.png`) fliegt auf der echten Map von oben über den gefallenen Spieler und hebt ihn im roten Stasis-Strahl heraus → Schnitt auf den Not-Rückflug nach **Port Solaris**.
4. **Neue Pixel-Art-Sprites (alle visuell geprüft & in `SPRITE_QUEUE.md` `[x]`):**
   - `cutscene_drop_pod_open.png`, `ship_corvette_bank.png`, `ship_crystal_bank.png`, `ship_solar_bank.png`, `ship_monolith_bank.png` (`P3-35`–`P3-39`).
5. **Tests:** `tests/cutscene_approach.cjs` + `m10cp5`, `m10cp6`, `t4b`, `t4c`, `t8` grün.

## Offen / Nächster Schritt
- Abnahme durch den Projektinhaber im echten Spiel.
- Optional später: Kurz-Modus ab dem 2. Run (`seenCutscenes?` im Save v11) + Spielstart-Intro / Story-Cutscenes.
