# Handoff — Endboss-Arenen (M12)
> Eigenes Status-Blatt. Plan: [`MILESTONE_12_ARCHITECTURE.md`](../MILESTONE_12_ARCHITECTURE.md).

## Stand (2026-11-27)
- **Plan geschrieben, Fragen §10 beantwortet** (Prüfung erst ab nächster Woche, Waffen-Arten-Sperre statt Infusion, Endless-Spirale bleibt Standardraum). Noch kein Code. Zuordnung Waffe ↔ Endboss (§5.1) bestätigt.
- Pilot: A.E.G.I.S. Leviathan (S1, Ebene III) — Reaktorhalle 2×2 Bildschirme, Boss = Nordwand, 3 Phasen, Schwachstellen.
- Sprites geplant: `SPRITE_QUEUE.md` P1-03 … P1-07 (Status `[~]`, erst nach Freigabe auf `[ ]` setzen).

## Achtung für parallele Chats
- Phase A (Raumgrenzen pro Raum) und B (Kamera) ändern die gemeinsamen Dateien `DungeonScene.ts`, `enemyAi.ts`, `dungeonRenderer.ts`, `bossEngine.ts`, `bossFx.ts`, `navGrid.ts`. Solange A/B laufen, steht das hier als **„A/B läuft“** — Rig-Chats dann nur kleine Renderer-Änderungen und vorher `git fetch`.

## Nächster Schritt
1. Phase A starten (Raumgrenzen pro Raum). Ablauf je Stufe: `BOSS_ENEMY_PIPELINE.md`.
2. Phase A starten.
