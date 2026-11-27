# HANDOFF — Übergabe zwischen Claude Code, Antigravity & Co.

> **Zweck:** Jedes Werkzeug (und jede neue Sitzung) soll hier in 1 Minute wissen, wo das Projekt steht. **Am Ende jeder Arbeitssitzung aktualisieren** (kurz halten, veraltete Punkte löschen).

## Stand
- Meilensteine 1–10-C sind umgesetzt, `SAVE_VERSION = 11` (Vercel deployt bei Push auf `main`). **M11 (lebendige Gegner & Bosse) läuft:** Kern-Wächter animiert, Krall vollständig eingebunden (alle P0-Sheets verdrahtet, nur Abnahme im Kampf offen), Geschütz-Rig komplett, Teilen von Quarz-Koloss/Sternen-Archon fertig. **Status je Bereich: [`handoff/README.md`](handoff/README.md).** Übersicht: `MILESTONE_11_ARCHITECTURE.md` §11, `BOSS_ANIMATION_PLAN.md` (Statustabelle §3).
- **Kristall-Krabbler-Rig (P2-05)** eingebunden (`handoff/enemy_crystal_crawler.md`); Effekt-Sheet P3-21 selbst generiert und verdrahtet (Tod-Splitter, Glühen, Funkenspur).
- Doku: `GAME_DESIGN_DOCUMENT.md` (Status), `MILESTONE_10_ARCHITECTURE.md` §11 und `MILESTONE_10C_ARCHITECTURE.md` §9 (Umsetzungsnotizen, gemessene Werte, Abweichungen).

## Arbeitsablauf & Werkzeug-Sync (Antigravity ↔ Claude Code)
```bash
git fetch origin && git pull --ff-only   # immer zuerst (Werkzeuge pushen abwechselnd auf main)
npm install
npx playwright install chromium          # einmalig, nur für die Tests
npm run verify                           # Build + Invarianten + Sprite-Check + Tests (bei Code-Änderungen)
```
- **Reine Doku-/Roh-Asset-Commits (`*.md`, `art_source/**`):** `npm run check:invariants` + `npm run check:sprites` + visuelle Prüfung per `view_file` reichen.
- **Antigravity (`AGENTS.md` §6):** erzeugt Sprites/Sheets per `generate_image` (mit `ImagePaths` als Referenz), bereinigt ggf. Rasterlinien und legt verlustfreie PNGs direkt im Repo unter `art_source/rigs/` oder `public/art/sprites/` ab → Commit & Push auf `main`.
- **Claude Code (`CLAUDE.md`):** setzt Code-Phasen, `npm run art:import` und Tests um.
- M11-Prüfwerkzeuge: `npm run art:check -- <sheet>`, `npm run art:import -- <rig> --force`, `node scripts/rig-sheet.cjs core_warden|krall` (startet Vite bei Bedarf selbst), `?bosslab` · Handbuch `RIGGING_GUIDE.md`.
- Einzelne Tests: `npm test -- m10p3 t5` · Screenshots der Tests landen in `tests/out/` (nicht committet).
- Dev-Test-Hook `window.__game` gibt es nur im Vite-Dev-Server.

## ⚠ Fehlende Sprites (Fallbacks aktiv → neue PNGs gewünscht)
> **Plan (wartet auf Freigabe): NG+- & Spiralen-Look** als gemeinsame Overlays (`BOSS_ENEMY_PIPELINE.md` §5b, Sprites `P4-01/P4-02` als `[~]` in `SPRITE_QUEUE.md` P4b, offene Fragen §5b.4) — noch nichts umsetzen/generieren.
> **Neu: `npm run art:gen`** (`scripts/gen-sheet.py`, von Antigravity; Claude-Fallback + `--sheet-out` ergänzt) — Claude-Chats erzeugen benötigte Sheets direkt über die Gemini-Bild-API (Standardmodell `gemini-nano-banana-2.1`, Key über Network Secret, Header `x-goog-api-key`; getestet 2026-11-27). Bestehende Liste → Antigravity; Claude nur für die eigene laufende Aufgabe (`AGENTS.md` Regel 15).
> **Grundhaltung (Inhaber, 2026-11-27): Qualität vor Sparen.** Genug Gemini-Guthaben vorhanden — wenn etwas mit den vorhandenen Bildern nicht gut aussieht, nicht klappt oder nicht gefällt, wird ein neues bzw. ersetzendes Sheet bestellt (`AGENTS.md` Regel 14, `SPRITE_QUEUE.md` §0).
`npm run check:sprites` listet die aktuelle Lage. Stand: **✔ Alle 17 optionalen M10-Promenaden- & M10-C-Boss-Sprites sind vorhanden** (`P3-01…P3-17` komplett ✅, alle 20 M11-Gegner-Rigs S1–S4 `P1-01…P2-19` + `P2-21` `crystal_crawler_ground.png` geliefert ✅).
- Prompts & Maße: `ART_AND_DESIGN_GUIDE.md` §7–§8 · Ablage: `public/art/sprites/<datei>.png` (96×96 bzw. 128×128, kein Code nötig).
- **Neu geplant (M12, wartet auf Plan-Freigabe):** `P1-03…P1-06` Leviathan-Endboss-Arena (Boden, Boss-Wand, Arm-Teile, Arena-Effekte) — Status `[~]`, Plan `MILESTONE_12_ARCHITECTURE.md`, Status-Blatt `handoff/endboss_arena.md` (`P1-07` Trophäen-Sprites geliefert ✅).
- **Zentrale Warteschlange:** Alle offenen Sprites & M11-Sheets stehen priorisiert (`P0`–`P4`) in [`SPRITE_QUEUE.md`](SPRITE_QUEUE.md). **Wer einen Fallback/Platzhalter oder ein neues M11-Sheet anlegt, sortiert es dort sofort priorisiert ein** (`AGENTS.md` §3 Regel 7) und vermerkt es hier kurz. Aktuell steht die Queue am **⛔ STOP-GATE (GESPERRT)** vor **P4** (weitere Boss-Rigs, wartet auf Abnahme von Kern-Wächter & Krall im Spiel).

## Arbeitsbereiche (paralleles Arbeiten in mehreren Chats)
Jeder Bereich hat ein eigenes Status-Blatt in [`handoff/`](handoff/README.md) — **dort** pflegen, nicht hier. Regeln & Ablauf (`npm run ship`): [`PARALLEL_WORK.md`](PARALLEL_WORK.md).

## M11 Pose-Sets & Gegner-Rigs — Technik (bereichsübergreifend) · Handbuch: [`RIGGING_GUIDE.md`](RIGGING_GUIDE.md)
- **Import (`npm run art:import`, `scripts/art-import.py`):** `sheet.sets` in `src/data/rigs/<rig-id>.json` (`file`, `mode: limb|swap`, `ids[]`, optional `cells` zum Teilen eines Sheets in mehrere Sets). Zellmitte = Gelenk, je Set ein gemeinsamer zentrierter Ausschnitt + Rig-Maßstab → alle Posen eines Sets gleich groß, Pivot `[0.5, 0.5]`. Neue Sheets: Datei in `art_source/rigs/` legen, Set in `rigs.json` eintragen (Varianten **hinten anhängen**), `npm run art:import -- <rig> --force`. Bilder ohne Teil: `extraImages`.
- **Engine (`src/engine/rig.ts`):** `RigPartDef.variants` (Bildnamen) + `PartPose.variant` (Index, geklemmt; `blendPose` schaltet bei t = 0,5 um).
- Tests: `m11p1` (Rig-Engine), `m11p2` (Pose-Sets/Übergänge/Zuordnung), `m11p3` (abgelöste Teile), `m11p4` (Teilen). Ansicht: `?bosslab` → Kern-Wächter / Krall (Pause + „Phase II“-Knopf zum Prüfen).
- **Abgelöste Teile (umgesetzt):** `detached.ts` (Kern-Wächter-Brustplatten, Krall-Rückenpanzer fliegen bei Phase 2 weg), Test `m11p3`.
- **Prozedurale Code-Beine: verworfen** (passten nicht zum Pixel-Art-Stil, doppelten Sprite-Beine) → wieder entfernt. Ersatz: Gegner-Rigs aus Teile-Sheets.
- **Teilen (umgesetzt, ohne neue Sprites):** Quarz-Koloss und Sternen-Archon spalten sich in Phase 2 (`DungeonScene.splitBoss`/`syncSplitPools`, Felder `Enemy.splitGroup/splitRole`): gemeinsamer HP-Pool, Sieg/Belohnung nur einmal, Hälften 85 % groß, Rollen (Quarz: A Beben · B Salve; Archon: A Sternbild/Brunnen · B Supernova, `BossDef.splitMoves`), Wiedervereinigung bei ≤ 15 % HP. Abweichung vom Plan: keine „10 s allein“-Regel (eine Hälfte kann nie allein sterben). Test `m11p4`. Kern-Wächter-Glühen sitzt am neuen Reaktorkern.
- **Rig-Daten:** jede Rig-Datei eigenständig `src/data/rigs/<rig-id>.json` (automatisch geladen, `import.meta.glob`; `art-import.py` liest den Ordner). **Animation:** `src/dungeon/anim/rigs/<rig-id>.ts` exportiert `anim: RigAnim` (`rigAnim.ts`), automatisch registriert von `bossAnims.ts` (Engine: Glättung/Impuls/Zwischenposen). Gegner-Rigs: `sheet.srcFile: <name>_rig` (Sheet `art_source/rigs/<srcFile>.png`), Renderer-Zweig `tryDrawEnemyRig`.
- Rig-Status & Aufgaben: siehe `handoff/`.

## Nächster Schritt
- **Polish (Teile 1–3) abgenommen & erledigt:** Hintergrund-Pause, Wackeln/Vibration im Hilfe-Tab, Tür-Label · Kern-Wächter-Schritte, Hit-Stop (`heavyStop`), Telegraph-Blitz, Schadenszahlen-Merge · Dungeon-Code lädt nach (`__game.dungeonReady`, Chunk-Gruppe `dungeon` entfernt). Tests `t7`, `t7b`, `t8`.
- **Aufräumen erledigt** (Audit 2026-11-26, Blöcke C1–C6): Doku auf aktuellem Stand, „Kern-Wächter“ einheitlich, Repo-Hygiene, toter Code entfernt, gemeinsamer `EnemyKind`, `check:sprites` prüft Sheets/Imports, Pose-Sheet-Import (`art_source/poses`) entfernt, `npm run build:single` dokumentiert, Version 1.4.0. **Firebase-SDK lädt nach dem Start nach** (`src/services/firebaseSdk.ts` per `import()`, Service-API unverändert; Test `t6`) — Abweichung vom Plan: nicht der ganze Service, nur das SDK.
- **Claude Code:** je Bereich siehe `handoff/*.md` (Einbinden der gelieferten S2–S4 Gegner-Rigs + `crystal_crawler_ground.png`; M12-Arena-Plan-Freigabe).
- **Antigravity:** Alle offenen `[ ]`-Einträge vor dem **P4-STOP-GATE** sind erledigt (`P0`–`P3` komplett ✅). Wartet auf Freigabe für M12 `P1-03…06` (`[~]`) oder P4-Boss-Rigs bzw. neue Zusatz-/Ersatz-Sheets.
- Ökonomie & Boss-Kampfgefühl im echten Spiel beobachten und in `src/data/balance.ts` nachjustieren (Berichte: `tests/out/economy.json`, `tests/out/ttk.json`).

## Offene Punkte
- Bildgenerierung: Dual-Backend in Antigravity (`generate_image` + direkter Gemini-API-Fallback via `scripts/gen-sheet.py`, Modell `gemini-nano-banana-2.1`, Key lokal außerhalb des Repos).
- Ideen: siehe `GAME_DESIGN_DOCUMENT.md` §5.

## M12 Phase E (2026-11-27)
Waffen-Arten-Sperre (`WEAPON_TYPE_GATES`), Trophäe „A.E.G.I.S.-Herzlinse“, Hub-Vitrine umgesetzt (am bestehenden Leviathan-Sieg). **Neue Sprites benötigt:** `P1-07` (`prop_trophy_leviathan.png`, `item_trophy_leviathan.png`) — Fallbacks aktiv. Status-Blatt: `handoff/endboss_arena.md`.
