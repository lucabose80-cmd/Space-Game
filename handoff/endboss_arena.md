# Handoff — Endboss-Arenen (M12)
> Eigenes Status-Blatt. Plan: [`MILESTONE_12_ARCHITECTURE.md`](../MILESTONE_12_ARCHITECTURE.md).

## Stand (2026-11-27)
- **🔧 In Arbeit (Rückmeldung Inhaber 2026-11-27):** Boss-Modell wirkt wie Platzhalter, Wand-Boden-Übergang oben stimmt nicht → neuer großer Boss-Körper in der Nordwand (P1-10 ✅, Zustände P1-11a/b/c), Kamera darf in der Arena höher schauen, Kran-Arm-Teile (P1-05 ✅) · **neu:** Schatzkammer hinter der Wand öffnet sich nach dem Sieg ohne Ladeübergang (P1-12 ✅, Boss-Truhe = A8 ✅).
  - ✅ **P1-10** Körper erzeugt & eingebaut (`drawLeviathanBody`, Kamera `vt`/`cameraBiasY`, Wandfuß `drawWallFoot`, Linse bei Anker y = 4).
  - ✅ **Schatzkammer (P1-12)** (`src/dungeon/arenaVault.ts`, `ArenaDef.vault`): nach dem Sieg fährt in der Nordwand eine Tür auf (1,8 s Verzögerung, 1,4 s Fahrt), Raumgrenzen wachsen nach Norden, Boss-Truhe in der Mitte (`RoomChest.boss`), kein Ladeübergang; nicht in der Wochen-Prüfung.
  - ✅ **Kran-Arme & Arena-Teile (P1-05)** erzeugt (`art_source/rigs/leviathan_arena_parts.png`, `art:check` ok) & eingebunden: Kran-Hammer aktiv/steckend (`arena_leviathan_hammer.png`, `_grounded.png` 96×96), Kabelkette (`arena_leviathan_cable.png` 64×32), zerstörtes Kühlventil (`arena_leviathan_vent_broken.png` 64×64) in `dungeonRenderer.ts` / `leviathanArena.ts` (Fallback auf prozedural bleibt).
  - ✅ **Zustand Phase III (P1-11b)** erzeugt & eingebunden (`arena_leviathan_body_p3.png` `600×334`, 96,2 % Silhouetten-Deckung zu P1-10, Sichtprüfung in `m12p7_p3.png` ok). **Offen wegen Bild-Quota-Limit:** `P1-11a` (`arena_leviathan_body_p2.png`), `P1-11c` (`arena_leviathan_body_dead.png`) und `P1-06` (`leviathan_arena_fx.png`) — in `SPRITE_QUEUE.md` als `[ ]` eingereiht, saubere Fallbacks aktiv.
  - ✅ **Boss-Truhe gezielte Beute (A8):** In der Leviathan-Arena wandert die Endboss-Beute statt Boden-Drops gezielt in die Boss-Truhe der Schatzkammer (`leviathan_core`, `aegis_plate`, beim Erstsieg `trophy_leviathan` + Toast auf Ionen-Speer-Bauplan & Hub-Vitrine, plus 3× `rollLootItem(3, true, …)`, keine Credits; Standardraum/Spirale behält Boden-Drops). Test `m12p7_vault` prüft Erstsieg + Wiederholung + Screenshots.
  - ✅ **Phase F Kampfdauer gemessen (`m10cp8` → `tests/out/ttk.json`):** Leviathan-Arena (9315 HP, S1-Startwaffen Stufe 3, echte Schwachstellen-Fenster, 80 % Ausweich-Effizienz) = **187,5 s** — exakt im Zielband **150–210 s**.
- **⚠ Phase A–D läuft** (gemeinsame Dateien!) — umgesetzt & gepusht, Abnahme durch Projektinhaber offen.
- **🧪 Testen ohne Durchspielen:** `…/?bosslab` (Groß-/Kleinschreibung egal) → Tab „Bosse“ → Abschnitt **ARENEN** → „🏟 Leviathan“ lädt den echten Arena-Bossraum (Auftritt, Kamera, 3 Phasen; `PII`/`Boss ∞`/`Ich ∞`/Zeitlupe funktionieren). **Künftige Arena-Bosse erscheinen dort automatisch**, sobald sie in `src/data/arenas/index.ts` (`ARENAS`) stehen. Test `m12p6_lab`.
- **🟢 LIVE seit 2026-11-27** (`ENDBOSS_ARENA_LIVE = true` auf Wunsch des Inhabers; Wochen-Prüfung ab `TRIAL_ARENA_FROM_WEEK = '2026-W49'`). Abnahme im echten Kampf weiterhin offen → Rückmeldungen hier sammeln.
- **Phase D (Leviathan-Arena-Kampf) umgesetzt:**
  - `src/dungeon/bosses/leviathanArena.ts`: Auftritt (Kamera-Fahrt + Banner, 2,5 s bis zum ersten Sieg, danach 0,8 s; Eingabe gesperrt, kein Schaden) · Phase I Kran-Hammer (Arm steckt 1,6 s → angreifbar, eigene HP 15 %) / Kabel-Peitsche / Ventil-Dampf · Phase II (65 % oder beide Arme zerstört) Platten brechen (1,2 s Vorwarnung → Abgrund) / Zwillings-Strahl über die Halle / Trümmerfall / Kabel-Griff; Kühlventile (4 × 4 %) → Linse 3 s offen; ohne intakte Ventile öffnet die Linse nach großen Angriffen 2,5 s (kein Weichlock) · Phase III (30 %) Panzer fällt ab, Linse dauerhaft offen, Omega-Puls (Ringe mit Lücke), Glut-Wellen N→S (jedes Band mit Lücke), Letzter Griff (Sog); < 15 % kritisch (schneller) · Sieg: Abgrund schließt sich, Kamera zur Linse, Banner.
  - Panzer (A3): Treffer außerhalb offener Schwachstellen → Funken + „GEPANZERT“, kein Schaden; Teil-Schaden gedeckelt auf Teil-HP (fließt in den Pool). Ziel-Hilfe zielt auf offene Schwachstellen.
  - Werte in `balance.ts` → `ENDBOSS_ARENA` (HP ×1,35 = 9315). Wochen-Prüfung: `TRIAL_ARENA_FROM_WEEK = '2026-W50'` + nur wenn live (`trialHasArena`).
  - Test `m12p4`; Screenshots aller Phasen angesehen; Standardraum (normaler Leviathan) vor/nach Phase D identisch.
  - **Kachelplan an gelieferte Sprites P1-03/P1-04 angepasst:** `p` = Glut-Gitter (3 Rechtecke → Abgrund), Pfeiler auf den 4 Sockeln, Kühlaggregate `V` (Spalten 0–4/38–42) mit Ventilen `v` an den Kühlsektionen (Zeilen 9/12). Kühlaggregate/Sockel werden nicht mehr als Hindernis-Grafik übermalt.
  - **A1–A10-Stand:** A1 ✅ · A2 ✅ (Körper in der Nordwand verankert, P1-10 + P1-11b aktiv) · A3 ✅ · A4 ✅ (Platten brechen; Phase-III-Glut als Wellen statt dauerhafter Fläche) · A5 ✅ · A6 ✅ (eigenes Musik-Intro fehlt noch → Boss-Brüllen) · A7 ✅ (bossFx-Zonen; Trümmer `debrisDrops` ohne Rand-Pfeil) · A8 ✅ (Schatzkammer + gezielte Boss-Truhe mit Trophäen-Relikt beim Erstsieg, Ionen-Speer-Freischaltung, Hub-Vitrine, keine Credits) · A9 🔶 Mobil-Test im echten Gerät offen · A10 ✅ (`m12p3`/`m12p4`).
- **Phase C (Arena-Daten) umgesetzt — Arena ist im Live-Spiel noch AUS** (`ENDBOSS_ARENA_LIVE = false` in `balance.ts`, wird mit Phase D eingeschaltet). **Ansehen: Spiel-URL mit `?arena`** → Sektor 1, Ebene III, Bossraum = Reaktorhalle.
  - `src/data/arenas/` (`types.ts` ArenaDef, `leviathan.ts` Kachelplan 43×22, `index.ts`: `ARENAS`, `arenaEnabled()`, `arenaObstacles()`, `applyArena()`, `attachArenas()`); `DungeonRoom.arenaKind?`.
  - Anhängen in `DungeonScene.startFloor` nach `generateSectorFloor` (kein Math.random; nie in der Wochen-Prüfung, nie in der Endlos-Spirale). Nordtür → 3-Kachel-Durchgang im Boss-Sockel.
  - Belohnungs-/Extraktions-Pads, Loot-Drops, Geschütz-Startpunkte, Heilstation in `DungeonScene` + Renderer jetzt über `scene.bounds` (Standardraum identisch — Vorher/Nachher-Vergleich inkl. Boss-Sieg & Drops).
  - `arenaFloor.ts` zeichnet den Kachelplan (Glut-Platten `p`, Boss-Wand-Fallback über `W`); Sprites `arena_leviathan_bg/wall` (P1-03/04) werden automatisch genutzt, sobald vorhanden (`M12_OPTIONAL_SPRITES`). Wand-Sockel wird nicht als Schott-Balken gezeichnet.
  - Test `m12p3` + Screenshots `tests/out/m12p3_arena_north/south.png` (angesehen).
- **Sprites P1-03 & P1-04 geliefert ✅** (`arena_leviathan_bg.png` `1376×704` + `arena_leviathan_wall.png` `1376×192`, `m12p3` grün + Screenshots geprüft); **STOP-GATE vor `P1-05`/`P1-06`** wartet auf Sichtprüfung im Spiel (`?arena`).
- **Phase B (Kamera) umgesetzt:**
  - `src/dungeon/camera.ts` (`DungeonCamera`): Standardraum immer (0, 0); Arena: Totzone 40×24, Glättung τ 0,12 s, Klemme so, dass der Arena-Rand wie die Standard-Wand sitzt (`DungeonCamera.range`), kleiner Raum mittig, Rasterung auf HD-Pixel, `snap()` beim Raumwechsel, `focus(x, y, sec)` (max. 2,5 s, sperrt Spieler-Eingabe über `input.locked`), `toWorld/toScreen`.
  - `DungeonScene`: `scene.camera`, `update()` → `updateFrame()` + Kamera-Update; Maus-Zielen Bildschirm → Welt.
  - Renderer: Welt unter `translate(-cam)`, Tönungen über den Kamera-Ausschnitt, HUD/Minimap/Boss-Leiste/Prompt (Welt → Bildschirm) ohne Translation; Türen, Boss-Laser-Raycast und Sporen an `scene.bounds`.
  - `src/dungeon/arenaFloor.ts`: prozeduraler Arena-Boden (Offscreen-Canvas, einmal je Raum) als Rückfall bis `arena_leviathan_bg.png` (P1-03, wird in Phase C geladen).
  - `src/dungeon/edgeIndicators.ts` (A7): Rand-Pfeil in Zonenfarbe für `bossFx`-Zonen außerhalb des Bildes (nur in Arenen).
  - Nachweis: `m12p2` + Screenshots `tests/out/m12p2_std.png` / `m12p2_arena.png` (angesehen). Einmalig: 36 gerenderte Frames (6 Szenarien, u. a. Leviathan, Kern-Wächter, Prisma-Archon, Krall) im Standardraum vor/nach Phase B **pixelgleich**.
  - Touch-HUD ist HTML (`UIManager`) und bleibt ohnehin am Bildschirm.
- **Phase A (Raumgrenzen pro Raum) umgesetzt:**
  - `DungeonRoom.bounds?` + `roomBounds()` / `DEFAULT_ROOM_BOUNDS` / `hasCustomBounds()` (`dungeonGen.ts`), Getter `scene.bounds`, `scene.rayLimit()`.
  - Umgestellt: Spieler-Klemme, Türen & Eintrittspunkte, Projektile, Drops, Rail-Strahl (`DungeonScene.ts`); alle Klemmen/Boss-Positionen in `enemyAi.ts`; `NavGrid` (Raster je Raum); `BossCtx.room` + `bossRoom()` + `clampToRoom(…, room)` (`bossEngine.ts`, `defs.ts`); Sog in `bossFx.ts`; Magnetplatten (`roomMechanics.ts`).
  - **Bewusst noch auf den Konstanten** (Phase B/C): `dungeonRenderer.ts` (Türen, Laser-Raycast, Partikel), Belohnungs-Pads/Loot-Positionen/Geschütz-Startpunkte in `DungeonScene.ts`, Layouts in `dungeonGen.ts`/`mechanicsGen.ts`.
  - Nachweis: `m12p1` (Standard = Konstanten, Nav 43×22, Ablauf mit expliziten Standard-Grenzen identisch; Arena 688×352: Spieler/Gegner/Projektile/Drops/Türen/Eintritt/Boss bleiben drin). Zusätzlich einmalig: 9 Gegner-/Boss-Szenarien (u. a. Leviathan, Vulkan-Titan P2, Sternen-Archon-Teilen, Kern-Wächter, Krall) vor/nach Phase A **bit-identisch**.
- **Plan geschrieben, Fragen §10 beantwortet** (Prüfung erst ab nächster Woche, Waffen-Arten-Sperre statt Infusion, Endless-Spirale bleibt Standardraum). Noch kein Code. Zuordnung Waffe ↔ Endboss (§5.1) bestätigt.
- Pilot: A.E.G.I.S. Leviathan (S1, Ebene III) — Reaktorhalle 2×2 Bildschirme, Boss = Nordwand, 3 Phasen, Schwachstellen.
- Sprites geplant: `SPRITE_QUEUE.md` P1-03 … P1-07 (Status `[~]`, erst nach Freigabe auf `[ ]` setzen).

## Phase E erledigt (2026-11-27)
- Waffen-Arten-Sperre, Herzlinse (`trophy_leviathan`), Hub-Vitrine — angehängt an `sector1Cleared`; Test `m12p5`. Details: `MILESTONE_12_ARCHITECTURE.md` §11. `P1-07` (`prop_trophy_leviathan.png` 96×96 + `item_trophy_leviathan.png` 64×64) geliefert ✅.
- Später (mit Arena, Phase D): Belohnung an das Arena-Sieg-Ereignis hängen, Vitrinen-Interaktion (Codex/Siegzeit).

## Achtung für parallele Chats
- Phase A (Raumgrenzen pro Raum) und B (Kamera) ändern die gemeinsamen Dateien `DungeonScene.ts`, `enemyAi.ts`, `dungeonRenderer.ts`, `bossEngine.ts`, `bossFx.ts`, `navGrid.ts`. Solange A/B laufen, steht das hier als **„A/B läuft“** — Rig-Chats dann nur kleine Renderer-Änderungen und vorher `git fetch`.

## Nächster Schritt
1. **Restliche 3 Arena-Sprites erzeugen** (sobald Bild-Quota oder `npm run art:gen` wieder frei): `P1-11a` (`arena_leviathan_body_p2.png`), `P1-11c` (`arena_leviathan_body_dead.png`) und `P1-06` (`art_source/rigs/leviathan_arena_fx.png` + Einbindung in `leviathanArena.ts`).
2. **Abnahme im echten Spiel** (live, Sektor 1 Ebene III oder `?bosslab` → ARENEN → 🏟 Leviathan): Kampfgefühl, Lesbarkeit, Schatzkammer & Mobil (A9). Notfall-Rückweg: `ENDBOSS_ARENA_LIVE = false` in `balance.ts`.
3. Phase A/B-Marker entfernen, sobald der Projektinhaber die Standardräume abgenommen hat.
