# HANDOFF — Übergabe zwischen Claude Code, Antigravity & Co.

> **Neues/anderes KI-Werkzeug? Zuerst [`KI_WECHSEL.md`](KI_WECHSEL.md)** (werkzeugneutraler Einstieg, Notfall-Matrix).

> **Zweck:** Jedes Werkzeug (und jede neue Sitzung) soll hier in 1 Minute wissen, wo das Projekt steht. **Am Ende jeder Arbeitssitzung aktualisieren** (kurz halten, veraltete Punkte löschen).

## 🔁 Letzte Sitzungen (Weiter-Protokoll) — Pflicht nach jeder Sitzung (`AGENTS.md` Regel 20)
> Neueste Zeile oben, max. 8 behalten. Format: Datum · Werkzeug/Chat · Bereich · **Erledigt** (Nachweis) · **Offen/Blocker** · **Nächster Schritt** (Datei + Befehl) · `[~]`-Einträge · Claim frei?
> **Startsatz für einen neuen Chat:** siehe [`KI_WECHSEL.md`](KI_WECHSEL.md) §0.

| Datum | Werkzeug · Bereich | Erledigt | Offen / Blocker | Nächster Schritt | Claim frei? |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 2026-11-28 | Claude Code · Spielstand-Slots | 3 Slots am Startscreen, Cloud nur Slot 1 (Test `t10_save_slots`, verify grün) | Abnahme `ABNAHME.md` Block J | Inhaber testet J1–J10 | ja |
| 2026-11-28 | Claude Code · Abnahme-Liste | `P3-55` `title_bg.png` erzeugt; `ABNAHME.md` (alle offenen Stufe-8-Prüfungen A–G) | Abnahmen durch Inhaber; Startscreen-Code T2–T5 offen | Inhaber testet `ABNAHME.md`, meldet ✅/❌ → in `handoff/` eintragen | ja |
| 2026-11-28 | Antigravity · Startscreen & Account-Einstieg | Neuer Live-Pixel-Art-Startscreen (`TitleBackdrop.ts`, `TitleScreen.ts`), direktes Cloud-Konto-Panel (Google/E-Mail Login & Registrierung + Live-Cloud-Save-Sync am Startscreen), sanfter Übergang in `intro_arrival` & neue „Weiterspielen“-Anflug-Animation (`ContinueIntroCutscene.ts`); Test `t9_title_screen` + voller `verify` grün | Optionales Key-Art `P3-55` (`public/art/sprites/title_bg.png`) in `SPRITE_QUEUE.md` offen (Antigravity-Bild-Quota erschöpft & kein lokaler API-Key in VM); Live-Fallback aktiv | Abnahme im echten Spiel; sobald Bild-Key/Quota verfügbar: `P3-55` per `npm run art:gen` nach `public/art/sprites/title_bg.png` erzeugen (wird ohne Code-Änderung aktiv) | ja |
| 2026-11-28 | Claude Code · Doku-Prozess | Regel 20 + Weiter-Protokoll + Startsatz eingeführt | — | Bereichs-Arbeit laut Tabelle unten („Nächster Schritt“) | ja |

## Stand (2026-11-28)
- Meilensteine 1–10-C sind umgesetzt, `SAVE_VERSION = 11` (Vercel deployt über `vercel.json` **nur** `main` und überspringt reine Doku-/Test-/`art_source`-Commits per `ignoreCommand` → schont das 100-Deploys/Tag-Limit im Free Tier).
- **M11 (lebendige Gegner & Bosse):** **Alle normalen Gegner in allen 4 Sektoren sind zu 100 % geriggt (G1–G10, Tests `m11p7`–`m11p17`, 59/59 Playwright-Tests grün, 0 fehlende Sprites)**; Kern-Wächter & Krall animiert (warten auf Abnahme im echten Kampf); Teilen von Quarz-Koloss/Sternen-Archon fertig. **Status je Bereich: [`handoff/README.md`](handoff/README.md).**
- **M12 (Sektor-Endboss-Arenen, Pilot A.E.G.I.S. Leviathan):** Auf **Schienen-Kran-Koloss mit echtem M11-Rig** (`boss_leviathan.json` / `boss_leviathan.ts`) auf fester Nordwand-Laufschiene umgestellt (`m12p8_leviathan_rework`, inkl. Phase-II-Absturz-Respawn-Fix `findSafeFloorPos` und nahtloser Nordwand ohne Geisterkern). **Wichtige Praxis-Learnings & harte Fallen für alle künftigen Endboss-Arenen stehen in [`handoff/endboss_arena.md`](handoff/endboss_arena.md) — vor neuen M12-Arenen unbedingt lesen!**
- **Cutscenes (Flug-Zyklus + Story, Feiern, Gehilfin Mina & Upgrades):** Komplett live — Expeditions-Flug-Zyklus (`cutscene_approach`, 21 Sprites `P3-27`–`P3-47`) **plus neu:** 4-Panel-Spielstart-Intro (`StoryPanelCutscene.ts`), Live-Siegesfeiern auf Port Solaris nach Sektor-Endbossen (inkl. A.E.G.I.S. Leviathan, S2–S4 & Omega-Fest, `HubCutsceneOverlay.ts`), Kaels neue Schmiede-Gehilfin **Mina** (dauerhaft an der 2. Werkbank + Einzugs-Cutscene), knackige Upgrade-Cutscenes (`UpgradeCutsceneOverlay.ts`), **🎬 Kino-Chronik** im Logbuch, Schalter „Kurze Cutscenes“ & **🎬 Cutscene-Teststudio (`?cutscenelab`, `src/dev/cutsceneLab.ts`)** (Test `cutscene_story`, alle 7 neuen Sprites `P3-48`–`P3-54` geliefert ✅). **Architektur & Praxis-Learnings: [`handoff/cutscenes.md`](handoff/cutscenes.md).**
- **Welt-Überarbeitung (Port Solaris · Laden · Quartier · Crew · Cutscenes, 2026-11-28):** Alle Phasen P1–P6 live: keine Portale auf der Station (Türen), Laden & Quartier in 3 Stufen mit eigenen Räumen, Hub-Gebäude öffnen durch Ereignisse + Läden ändern sich je Upgrade-Stufe, Upgrade-Animationen live (Zoom/Raum-Wisch), Marktterrasse neu, Begleiter Mina/Pip/Ping/Mitternacht mit Einzugs-Cutscenes, Intro-Trailer & Außenansicht angeglichen. **Übersicht, Rezepte (Kamera-Falle für Props!) und offene Punkte: [`handoff/world_overhaul.md`](handoff/world_overhaul.md).**
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
- Prüfwerkzeuge: `npm run art:check -- <sheet>`, `npm run art:import -- <rig> --force`, `node scripts/rig-sheet.cjs core_warden|krall` (startet Vite bei Bedarf selbst), `?bosslab` (Bosse/Arenen), `?cutscenelab` (alle Cutscenes & Promenaden-Vorschau, `saveLocked`) · Handbuch `RIGGING_GUIDE.md` & `handoff/cutscenes.md`.
- Einzelne Tests: `npm test -- m10p3 t5` · Screenshots der Tests landen in `tests/out/` (nicht committet).
- Dev-Test-Hook `window.__game` gibt es nur im Vite-Dev-Server.

## ⚠ Fehlende Sprites (Fallbacks aktiv → neue PNGs gewünscht)
> **Plan (Entscheidungen 2026-11-27, wartet auf Startsignal): NG+-Aura (dezent), eigenes Spiralen-Biom mit eigenem Hintergrund, Echo-Varianten mit neuen Attacken** (`BOSS_ENEMY_PIPELINE.md` §5b, Sprites `P4-01…P4-06` in `SPRITE_QUEUE.md` (Abschnitt „NG+ & Spirale“, P4-01…06)) — **Sprites freigegeben (2026-11-27)**, Code-Umsetzung erst auf Startsignal. Wochen-Prüfung: **eine feste, nicht wechselnde Herausforderung mit allem** (Rotation kommt später, `TRIAL_ROTATION_ENABLED`, §5b.4).
> **Neu: `npm run art:gen`** (`scripts/gen-sheet.py`, von Antigravity; Claude-Fallback + `--sheet-out` ergänzt) — Claude-Chats erzeugen benötigte Sheets direkt über die Gemini-Bild-API (Standardmodell `gemini-nano-banana-2.1`, Key über Network Secret, Header `x-goog-api-key`; getestet 2026-11-27). Bestehende Liste → Antigravity; Claude nur für die eigene laufende Aufgabe (`AGENTS.md` Regel 15).
> **Grundhaltung (Inhaber, 2026-11-27): Qualität vor Sparen.** Genug Gemini-Guthaben vorhanden — wenn etwas mit den vorhandenen Bildern nicht gut aussieht, nicht klappt oder nicht gefällt, wird ein neues bzw. ersetzendes Sheet bestellt (`AGENTS.md` Regel 14, `SPRITE_QUEUE.md` §0).
`npm run check:sprites` listet die aktuelle Lage. Stand: **✔ Alle 17 optionalen M10-Promenaden- & M10-C-Boss-Sprites sind vorhanden** (`P3-01…P3-17` komplett ✅, alle 20 M11-Gegner-Rigs S1–S4 `P1-01…P2-19` + `P2-21` `crystal_crawler_ground.png` geliefert ✅).
- Prompts & Maße: `ART_AND_DESIGN_GUIDE.md` §7–§8 · Ablage: `public/art/sprites/<datei>.png` (96×96 bzw. 128×128, kein Code nötig).
- **M12 Arena-Sprites (`P1-03`–`P1-07`):** `P1-03` (`arena_leviathan_bg.png`), `P1-04` (`arena_leviathan_wall.png`) und `P1-07` (Trophäen-Sprites) geliefert ✅ (`handoff/endboss_arena.md`). `P1-05`/`P1-06`/`P1-10`…`P1-12` ebenfalls geliefert ✅ (alle M12-Leviathan-Sprites vorhanden); offen ist nur die **Abnahme im echten Spiel** (`?bosslab` → ARENEN).
- **NG+ & ∞ Spirale + Echo-Pilot (`P4-01`–`P4-06`):** alle 6 freigegebenen Sheets geliefert ✅ (`ngplus_aura.png`, `spiral_ground.png`, `public/art/dungeon_bg_spiral.png`, `spiral_props.png`, `drone_echo_fx.png`, `phase_stalker_echo_fx.png`). **Echo-Pilot STOP-GATE:** weitere Echo-Varianten erst nach Pilot-Abnahme; Code-Umsetzung auf Startsignal.
- **Zentrale Warteschlange:** Alle offenen Sprites & M11-Sheets stehen priorisiert (`P0`–`P4`) in [`SPRITE_QUEUE.md`](SPRITE_QUEUE.md). **Wer einen Fallback/Platzhalter oder ein neues M11-Sheet anlegt, sortiert es dort sofort priorisiert ein** (`AGENTS.md` §3 Regel 7) und vermerkt es hier kurz. Aktuell sind alle ungesperrten Einträge erledigt; offen stehen die drei **⛔ STOP-GATES** (`P1-05`/`P1-06` nach `?arena`-Prüfung, Echo-Serie nach Pilot-Abnahme, **P4** weitere Boss-Rigs nach Kern-Wächter-/Krall-Abnahme).

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
- **Antigravity:** Alle aktuell freigegebenen `[ ]`-Einträge sind geliefert ✅ (`P0`–`P3` komplett, M12 `P1-03`…`P1-12`, NG+ & Spirale `P4-01…P4-06`). Wartet auf Freigabe der **STOP-GATES**: Echo-Serie nach Pilot-Abnahme oder P4-Boss-Rigs bzw. neue Zusatz-/Ersatz-Sheets.
- Ökonomie & Boss-Kampfgefühl im echten Spiel beobachten und in `src/data/balance.ts` nachjustieren (Berichte: `tests/out/economy.json`, `tests/out/ttk.json`).

## Offene Punkte
- Bildgenerierung: Dual-Backend in Antigravity (`generate_image` + direkter Gemini-API-Fallback via `scripts/gen-sheet.py`, Modell `gemini-nano-banana-2.1`, Key lokal außerhalb des Repos).
- Ideen: siehe `GAME_DESIGN_DOCUMENT.md` §5.

## M12 Phase E (2026-11-27)
Waffen-Arten-Sperre (`WEAPON_TYPE_GATES`), Trophäe „A.E.G.I.S.-Herzlinse“, Hub-Vitrine umgesetzt (am bestehenden Leviathan-Sieg). Sprites `P1-07` (`prop_trophy_leviathan.png`, `item_trophy_leviathan.png`). Status-Blatt: `handoff/endboss_arena.md`.
