# Handoff — Endboss-Arenen (M12)
> Eigenes Status-Blatt. Plan: [`MILESTONE_12_ARCHITECTURE.md`](../MILESTONE_12_ARCHITECTURE.md).

## Stand (2026-11-27)
- **⚠ Phase A/B läuft** (gemeinsame Dateien!) — beide umgesetzt & gepusht, Abnahme durch Projektinhaber offen.
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
2. Phase C (Arena-Daten `src/data/arenas/leviathan.ts`, Anhängen nach `generateSectorFloor`, Arena-Sprite P1-03 mit Fallback `arenaFloor.ts`; Belohnungs-Pads/Loot-Positionen auf `scene.bounds` umstellen). Kamera-Fahrten (`camera.focus`) für den Auftritt kommen mit Phase D.
