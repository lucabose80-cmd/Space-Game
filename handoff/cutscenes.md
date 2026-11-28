# Status-Blatt: Cutscenes (Teil A + Teil B komplett live)

> **Stand:** 2026-11-28 · **Kompletter runder Expeditions-Zyklus (Hangar → All → Map-Landung → Map-Abholung/Drohnen-Rettung → Port Solaris)**

## Was live ist
1. **Neue 3/4-Seitenansicht-Schiffe, Rampe ein-/aussteigen & Abflug im Raumhafen** ([`src/scenes/HangarScene.ts`](../src/scenes/HangarScene.ts)):
   - Alle 4 angedockten Schiffe stehen jetzt als echte **3/4-Seitenansicht auf Landestützen** (`ship_*_docked.png`, Triebwerke aus) auf den Hangar-Pads.
   - **Einsteigen & Start:** Seitentür öffnet sich + **echte Treppe fährt aus** (`ship_*_docked_open.png`, deckungsgleich per Shared-BBox) → Spieler steigt sichtbar die Stufen hoch in die beleuchtete Kabine → Tür schließt, Cockpit blitzt auf, Dampf → Schiff hebt im echten 3/4-Schräglagen-Sprite (`ship_*_bank.png`) diagonal nach rechts-oben ab.
   - **Landung & Aussteigen (`startDisembark`):** Nach erfolgreicher Extraktion schwebt das Schiff zurück aufs Dock-Pad, Treppe fährt aus (`ship_*_docked_open.png`) und dein Charakter geht sichtbar die Stufen herunter aufs Hangar-Deck → Run-Bilanz.
2. **Aufwachen in der Koje nach K.O. (0 HP)** ([`src/scenes/BackroomScene.ts`](../src/scenes/BackroomScene.ts)):
   - Nach Med-Evac-Drohnen-Bergung & Notlandung wachst du direkt in deiner **Ruhekoje** im Kapitäns-Quartier auf (grünes Heil-Leuchten, Spieler steigt aus der Koje auf den Boden, Dr.-Lyra-Toast → Run-Bilanz).
3. **2-Szenen-Weltraumflug & In-Map-Cutscenes** ([`SectorApproachCutscene.ts`](../src/scenes/SectorApproachCutscene.ts), [`SectorReturnCutscene.ts`](../src/scenes/SectorReturnCutscene.ts), [`dungeonCutscene.ts`](../src/dungeon/dungeonCutscene.ts)):
   - Tiefraum-Flug + Einflug in die Sektor-Schleuse (mit `ship_*_bank.png`), Drop-Pod-Landung & Aussteigen im Dungeon-Startraum (`cutscene_drop_pod_open.png` bleibt stehen), sichtbares Teleporter-Hochbeamen & Med-Evac-Drohnen-Bergung auf der echten Map.
4. **Pixel-Art-Sprites (alle visuell geprüft & in `SPRITE_QUEUE.md` `[x]`, `P3-27`–`P3-47`).**
5. **Tests:** `tests/cutscene_approach.cjs` + `m10cp5`, `t4c` grün.

## Offen / Nächster Schritt
- Abnahme durch den Projektinhaber im echten Spiel.
- Optional später: Kurz-Modus ab dem 2. Run (`seenCutscenes?` im Save v11) + Spielstart-Intro / Story-Cutscenes.
