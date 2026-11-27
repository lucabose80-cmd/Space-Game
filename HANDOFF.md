# HANDOFF — Übergabe zwischen Claude Code, Antigravity & Co.

> **Zweck:** Jedes Werkzeug (und jede neue Sitzung) soll hier in 1 Minute wissen, wo das Projekt steht. **Am Ende jeder Arbeitssitzung aktualisieren** (kurz halten, veraltete Punkte löschen).

## Stand
- Meilensteine 1–10-C sind umgesetzt, `SAVE_VERSION = 11` (Vercel deployt bei Push auf `main`). **M11 (lebendige Gegner & Bosse) läuft:** Kern-Wächter animiert, Krall vollständig eingebunden (alle P0-Sheets verdrahtet, nur Abnahme im Kampf offen), Geschütz-Rig komplett, Teilen von Quarz-Koloss/Sternen-Archon fertig. **Status je Bereich: [`handoff/README.md`](handoff/README.md).** Übersicht: `MILESTONE_11_ARCHITECTURE.md` §11, `BOSS_ANIMATION_PLAN.md` (Statustabelle §3).
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
- M11-Prüfwerkzeuge: `npm run art:check -- <sheet>`, `npm run art:import -- <rig> --force`, `node scripts/rig-sheet.cjs core_warden|krall` (Dev-Server nötig), `?bosslab` · Handbuch `RIGGING_GUIDE.md`.
- Einzelne Tests: `npm test -- m10p3 t5` · Screenshots der Tests landen in `tests/out/` (nicht committet).
- Dev-Test-Hook `window.__game` gibt es nur im Vite-Dev-Server.

## ⚠ Fehlende Sprites (Fallbacks aktiv → neue PNGs gewünscht)
> **Grundhaltung (Inhaber, 2026-11-27): Qualität vor Sparen.** Genug Gemini-Guthaben vorhanden — wenn etwas mit den vorhandenen Bildern nicht gut aussieht, nicht klappt oder nicht gefällt, wird ein neues bzw. ersetzendes Sheet bestellt (`AGENTS.md` Regel 14, `SPRITE_QUEUE.md` §0).
`npm run check:sprites` listet die aktuelle Lage. Stand: **alle 12 optionalen M10-Sprites fehlen**
(`prop_hub_*`, `prop_kael_memorial`, `prop_lyra_echo_sign`, `prop_nyx_free_lantern`, `prop_vex_*`, `npc_pilgrim`, `npc_foundry_worker`, `npc_elder_scholar`) **plus 5 Boss-Sprites (M10-C)**: `boss_scrap_collector` *(Krall hat inzwischen ein Rig → nur noch Rückfall, niedrige Priorität)*, `boss_slag_colossus`, `boss_forge_mistress`, `boss_chrono_warden`, `boss_monolith_colossus` (128×128, Prompts: Art-Guide §8).
- Prompts & Maße: `ART_AND_DESIGN_GUIDE.md` §7–§8 · Ablage: `public/art/sprites/<datei>.png` (96×96 bzw. 128×128, kein Code nötig).
- **Neu geplant (M12, wartet auf Plan-Freigabe):** `P1-03…P1-07` Leviathan-Endboss-Arena (Boden, Boss-Wand, Arm-Teile, Arena-Effekte, Hub-Trophäe) — Status `[~]`, Plan `MILESTONE_12_ARCHITECTURE.md`, Status-Blatt `handoff/endboss_arena.md`.
- **Neu in der Queue (niedrige Prio):** `P3-18/19` Kern-Wächter-Phase-1-Armschäden (`core_warden_arms_R4/L4.png`, D12-Lücke).
- Schwächster Fallback zuerst ersetzen: Vex-Bake, Zyklus-Hologramm, Obelisk, Klassentafel.
- **Zentrale Warteschlange:** Alle offenen Sprites & M11-Sheets stehen priorisiert (`P0`–`P4`) in [`SPRITE_QUEUE.md`](SPRITE_QUEUE.md). **Wer einen Fallback/Platzhalter oder ein neues M11-Sheet anlegt, sortiert es dort sofort priorisiert ein** (`AGENTS.md` §3 Regel 7) und vermerkt es hier kurz.

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
- **Claude Code:** je Bereich siehe `handoff/*.md` (Krall: Einbinden P0-08…12 · Gegner: Drohne, Phasen-Jäger · Kern-Wächter: Prüfung D11–D14).
- **Antigravity (als Nächstes, nach kurzem Quota-Reset ~35 min):** Weiter in [`SPRITE_QUEUE.md`](SPRITE_QUEUE.md) via Skill `sprite-batch`: **`P0-15`** (`krall_arms_R4.png`) + **`P0-17`** (`krall_arms_R5.png`) / **`P0-18`** (`krall_arms_L5.png`), danach **P2** ab `P2-06` (`shard_sniper_rig.png`); `P2-03` (Sporenspucker) ist eingebunden (`handoff/enemy_spore_spitter.md`). Neu: `P2-20` (optionale Sporenspucker-Effekte, niedrig).
- Ökonomie & Boss-Kampfgefühl im echten Spiel beobachten und in `src/data/balance.ts` nachjustieren (Berichte: `tests/out/economy.json`, `tests/out/ttk.json`).
- Optionale M10/M10-C-Einzel-Sprites bei Bedarf ebenfalls per Antigravity erzeugen.

## Offene Punkte
- Bildgenerierung: läuft direkt in Antigravity per `generate_image` (wochenweise Credits; Gemini-API mit Abrechnung nicht eingerichtet).
- Ideen: siehe `GAME_DESIGN_DOCUMENT.md` §5.

- **Neue Sprites (Krall, P0-14…18, `SPRITE_QUEUE.md`):** **`P0-14`** (`krall_torsos2.png` exakt im `84×100`-Panzer-Maßstab) & **`P0-16`** (`krall_arms_L4.png`) sind geliefert ✅ (bereit für Re-Import & Entfernen von `t2k`); noch offen: **`P0-15`** (`krall_arms_R4.png`), **`P0-17`** (`krall_arms_R5.png`), **`P0-18`** (`krall_arms_L5.png`).

## M12 Phase E (2026-11-27)
Waffen-Arten-Sperre (`WEAPON_TYPE_GATES`), Trophäe „A.E.G.I.S.-Herzlinse“, Hub-Vitrine umgesetzt (am bestehenden Leviathan-Sieg). **Neue Sprites benötigt:** `P1-07` (`prop_trophy_leviathan.png`, `item_trophy_leviathan.png`) — Fallbacks aktiv. Status-Blatt: `handoff/endboss_arena.md`.
