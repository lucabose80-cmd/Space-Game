# HANDOFF — Übergabe zwischen Claude Code, Antigravity & Co.

> **Zweck:** Jedes Werkzeug (und jede neue Sitzung) soll hier in 1 Minute wissen, wo das Projekt steht. **Am Ende jeder Arbeitssitzung aktualisieren** (kurz halten, veraltete Punkte löschen).

## Stand
- Meilensteine 1–10-C sind umgesetzt, `SAVE_VERSION = 11` (Vercel deployt bei Push auf `main`). Letzter Stand: M10-C (Bugs, HUD, Tag/Nacht, Bosse, Balancing).
- Doku: `GAME_DESIGN_DOCUMENT.md` (Status), `MILESTONE_10_ARCHITECTURE.md` §11 und `MILESTONE_10C_ARCHITECTURE.md` §9 (Umsetzungsnotizen, gemessene Werte, Abweichungen).

## Arbeitsablauf & Werkzeug-Sync (Antigravity ↔ Claude Code)
```bash
git fetch origin && git pull --ff-only   # immer zuerst (Werkzeuge pushen abwechselnd auf main)
npm install
npx playwright install chromium          # einmalig, nur für die Tests
npm run verify                           # Build + Invarianten + Sprite-Check + Tests (bei Code-Änderungen)
```
- **Reine Doku-/Roh-Asset-Commits (`*.md`, `art_source/**`):** `npm run check:invariants` + `npm run check:sprites` + visuelle Prüfung per `view_file` reichen.
- **Antigravity (`AGENTS.md` §6):** erzeugt Sprites/Sheets per `generate_image` (mit `ImagePaths` als Referenz), bereinigt ggf. Rasterlinien und legt verlustfreie PNGs direkt im Repo unter `art_source/rigs/`, `art_source/poses/` oder `public/art/sprites/` ab → Commit & Push auf `main`.
- **Claude Code (`CLAUDE.md`):** setzt Code-Phasen, `npm run art:import` und Tests um.
- Einzelne Tests: `npm test -- m10p3 t5` · Screenshots der Tests landen in `tests/out/` (nicht committet).
- Dev-Test-Hook `window.__game` gibt es nur im Vite-Dev-Server.

## ⚠ Fehlende Sprites (Fallbacks aktiv → neue PNGs gewünscht)
`npm run check:sprites` listet die aktuelle Lage. Stand: **alle 12 optionalen M10-Sprites fehlen**
(`prop_hub_*`, `prop_kael_memorial`, `prop_lyra_echo_sign`, `prop_nyx_free_lantern`, `prop_vex_*`, `npc_pilgrim`, `npc_foundry_worker`, `npc_elder_scholar`) **plus 5 Boss-Sprites (M10-C)**: `boss_scrap_collector`, `boss_slag_colossus`, `boss_forge_mistress`, `boss_chrono_warden`, `boss_monolith_colossus` (128×128, Prompts: Art-Guide §8).
- Prompts & Maße: `ART_AND_DESIGN_GUIDE.md` §7–§8 · Ablage: `public/art/sprites/<datei>.png` (96×96 bzw. 128×128, kein Code nötig).
- Schwächster Fallback zuerst ersetzen: Vex-Bake, Zyklus-Hologramm, Obelisk, Klassentafel.
- **Wer einen Fallback/Platzhalter neu anlegt, trägt ihn hier ein** (Datei, Key, Prompt-Abschnitt im Art-Guide).

## M11 Art-Sheets (`art_source/`)
- **Vorhanden (Pilot-Sheets zur Qualitätsprüfung bereit, `1536×1024`, reines `#FFFFFF`, 512×512/Zelle, keine Rasterlinien):**
  - `art_source/rigs/krall_parts.png` (S1 E1 Krall: Rumpf, Greifarm, Bein vorn, Bein hinten, Magnet, Schrottplatte)
  - `art_source/rigs/core_warden_parts.png` (S1 E2 Kern-Wächter, Referenz `boss.png`: Rumpf, Kopf+Halo, linker Arm, Faust, Brustplatte links, Brustplatte rechts)
- **Noch offen (erst nach Qualitäts-Freigabe der Pilot-Sheets erzeugen, um Credits zu sparen):** restliche Boss-Teile-Sheets (`MILESTONE_11_ARCHITECTURE.md` §6.3) und Gegner-Pose-Sheets (§6.4).

## Nächster Schritt
- **Sprites v2 (Antigravity):** Neues Briefing **`ART_BRIEF_M11.md`** — Krall & Kern-Wächter bekommen Arm-Posen (L+R getrennt), Kopf-/Rumpf-Tauschsets, Effekte (§4.1/§4.2). Prüfen mit `npm run art:check -- <datei>` (§6). Danach Code: Import-Modi `limb`/`swap` + Pose-Wechsel (`PartPose.variant`), dann Phase 3.
- **Qualitätsprüfung der 2 Pilot-Sheets** (`krall_parts.png`, `core_warden_parts.png`) durch den Projektinhaber → nach Freigabe erzeugt Antigravity die nächsten Sheets nach Reihenfolge §6.0 (`turret`, `magma_mortar`, `shard_sniper` usw.).
- **Meilenstein 11 Code (Claude Code):** `MILESTONE_11_ARCHITECTURE.md` Phasen 0–8 (Phase 0 baut `npm run art:import` und importiert direkt die vorhandenen `art_source/rigs/*.png`).
- Ökonomie & Boss-Kampfgefühl im echten Spiel beobachten und in `src/data/balance.ts` nachjustieren (Berichte: `tests/out/economy.json`, `tests/out/ttk.json`).
- Optionale M10/M10-C-Einzel-Sprites bei Bedarf ebenfalls per Antigravity erzeugen.

## Offene Punkte
- Bildgenerierung: läuft direkt in Antigravity per `generate_image` (wochenweise Credits; Gemini-API mit Abrechnung nicht eingerichtet).
- Ideen: siehe `GAME_DESIGN_DOCUMENT.md` §5.
