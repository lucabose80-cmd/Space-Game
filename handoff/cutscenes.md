# Status-Blatt: Cutscenes (Pilot: Sektor-Anflug)

> **Stand:** 2026-11-27 · **Pilot umgesetzt & bereit zur Abnahme im echten Spiel**

## Was live ist
- **Sektor-Anflug-Cutscene** ([`src/scenes/SectorApproachCutscene.ts`](../src/scenes/SectorApproachCutscene.ts)): spielt beim Start aus dem Raumhafen (Docks I–IV, 5. Tor Omega & ∞ Spirale; **nicht** bei der Wöchentlichen Prüfung).
  - **Phase 1 (0.0–1.7 s):** Hyperraum-Einflug mit Parallax-Sternen, Warp-Streifen, echtem Sektor-Schiff (`ship_corvette`/`ship_crystal`/`ship_solar`/`ship_monolith`), Triebwerks-Partikeln & Synth-Schub (`sound.playApproachWhoosh()`).
  - **Phase 2 (1.25–4.1 s):** Kino-Balken (Letterbox) + Sektor-Titelkarte (inkl. `🌙 NACHT-EXPEDITION`-Badge bei Nacht-Runs).
  - **Phase 3 (3.0–4.55 s):** Absetz-/Teleport-Strahl beamt den Spieler (`heroUp`) direkt in die Andock-Schleuse / das Portal (`sound.playDropBeam()`) → nahtloser Übergang in den Dungeon.
  - **Jederzeit überspringbar** (nach 0,28 s Schutzzeit) per `Leertaste`, `Enter`, `Esc`, `E`, Mausklick, Touch oder Gamepad.
- **5 echte 16:9 Pixel-Art-Sektor-Vistas** (`960×540` RGB PNG via `art:gen`, `gemini-nano-banana-2.1`, alle visuell geprüft):
  - `public/art/sprites/cutscene_bg_s1.png` … `cutscene_bg_s5.png` (registriert in `CUTSCENE_OPTIONAL_SPRITES` in `src/assets/artLoader.ts` und abgehakt als `P3-27`–`P3-31` in `SPRITE_QUEUE.md`, inkl. prozeduralem Fallback).
- **Test:** `tests/cutscene_approach.cjs` (Start, 3 Phasen, Skip, natürlicher Ablauf in Dungeon, HUD-Sichtbarkeit).

## Offen / Nächster Schritt nach Abnahme
- Abnahme durch den Projektinhaber im echten Spiel (Hangar → Dock I–IV / 5. Tor).
- Optional danach: „Beim 2. Mal kurz halten“ (`seenCutscenes?` im Save v11) + Ausbau auf generischen Cutscene-Player für Boss-Auftritte, Spielstart-Intro & Story-Höhepunkte.
