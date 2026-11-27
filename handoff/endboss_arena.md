# Handoff — Endboss-Arenen (M12)
> Eigenes Status-Blatt. Plan: [`MILESTONE_12_ARCHITECTURE.md`](../MILESTONE_12_ARCHITECTURE.md).

## Stand (2026-11-27)
- **⚠ Phase A–D läuft** (gemeinsame Dateien!) — umgesetzt & gepusht, Abnahme durch Projektinhaber offen.
- **Phase D (Leviathan-Arena-Kampf) umgesetzt — weiterhin nur mit `?arena`** (`ENDBOSS_ARENA_LIVE = false`, Einschalten nach Abnahme im Spiel):
  - `src/dungeon/bosses/leviathanArena.ts`: Auftritt (Kamera-Fahrt + Banner, 2,5 s bis zum ersten Sieg, danach 0,8 s; Eingabe gesperrt, kein Schaden) · Phase I Kran-Hammer (Arm steckt 1,6 s → angreifbar, eigene HP 15 %) / Kabel-Peitsche / Ventil-Dampf · Phase II (65 % oder beide Arme zerstört) Platten brechen (1,2 s Vorwarnung → Abgrund) / Zwillings-Strahl über die Halle / Trümmerfall / Kabel-Griff; Kühlventile (4 × 4 %) → Linse 3 s offen; ohne intakte Ventile öffnet die Linse nach großen Angriffen 2,5 s (kein Weichlock) · Phase III (30 %) Panzer fällt ab, Linse dauerhaft offen, Omega-Puls (Ringe mit Lücke), Glut-Wellen N→S (jedes Band mit Lücke), Letzter Griff (Sog); < 15 % kritisch (schneller) · Sieg: Abgrund schließt sich, Kamera zur Linse, Banner.
  - Panzer (A3): Treffer außerhalb offener Schwachstellen → Funken + „GEPANZERT“, kein Schaden; Teil-Schaden gedeckelt auf Teil-HP (fließt in den Pool). Ziel-Hilfe zielt auf offene Schwachstellen.
  - Werte in `balance.ts` → `ENDBOSS_ARENA` (HP ×1,35 = 9315). Wochen-Prüfung: `TRIAL_ARENA_FROM_WEEK = '2026-W50'` + nur wenn live (`trialHasArena`).
  - Test `m12p4`; Screenshots aller Phasen angesehen; Standardraum (normaler Leviathan) vor/nach Phase D identisch.
  - **A1–A10-Stand:** A1 ✅ · A2 ✅ (Körper in der Nordwand verankert, Wand-Fallback) · A3 ✅ · A4 ✅ (Platten brechen; Phase-III-Glut als Wellen statt dauerhafter Fläche) · A5 ✅ · A6 ✅ (eigenes Musik-Intro fehlt noch → Boss-Brüllen) · A7 ✅ (bossFx-Zonen; Trümmer `debrisDrops` ohne Rand-Pfeil) · A8 ⏳ Belohnung hängt an `sector1Cleared` (Phase E), Boss-Truhe statt Einzel-Drops offen · A9 🔶 Mobil-Test im echten Gerät offen · A10 ✅ (`m12p3`/`m12p4`).
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
1. Phase A/B abnehmen (Projektinhaber: Standardräume spielen/sehen sich unverändert) → Marker „Phase A/B läuft“ entfernen.
2. **Abnahme Phase D im Spiel** (URL `?arena`, Sektor 1 Ebene III): Kampfgefühl, Lesbarkeit, Mobil (A9). Danach `ENDBOSS_ARENA_LIVE = true` und `TRIAL_ARENA_FROM_WEEK` auf die Woche nach dem Deploy setzen.
3. Phase F: Kampfdauer messen (`m10cp8` um Arena erweitern, Ziel 150–210 s), Boss-Labor-Eintrag „Arena“, Boss-Truhe (A8).
