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
- **Typ P (Teile-Sheets, vorhanden & importiert):**
  - `art_source/rigs/krall_parts.png` (S1 E1 Krall)
  - `art_source/rigs/core_warden_parts.png` (S1 E2 Kern-Wächter, bleibt u. a. für wegfliegende Brustplatten)
- **Typ L/S v2 (`ART_BRIEF_M11.md`, `1536×1024`, `512×512`/Zelle, Gelenk/Kern exakt im Fadenkreuz, alle per `npm run art:check` ohne Rand-Warnungen geprüft):**
  - **§4.2 Kern-Wächter — komplett (4/4 neue Sheets fertig):**
    - `art_source/rigs/core_warden_arms_R.png` (rechter Arm `x=0.93`, 6 Posen, `min_margin ≥ 31 px`)
    - `art_source/rigs/core_warden_arms_L.png` (linker Arm `x=0.07`, 6 Posen, `min_margin ≥ 34 px`; **S1 erledigt**: Zellen 2 & 4 eigenständig mit Licht links-oben neu schattiert und re-importiert)
    - `art_source/rigs/core_warden_heads.png` (6 Helm+Halo-Varianten, Halsgelenk im Fadenkreuz, `min_margin ≥ 32 px`)
    - `art_source/rigs/core_warden_torsos.png` (6 Rumpf-Varianten inkl. Phase-2-Kern offen & überhitzt, Reaktorkern im Fadenkreuz, `min_margin ≥ 43 px`)
    - `art_source/rigs/core_warden_torsos2.png` (**S3**: Brustklappen offen/halb offen für Laser, Sprung gestreckt, Landung gestaucht, Phase 2 Laser, Phase 2 beschädigt; Kern im Fadenkreuz, `min_margin ≥ 40 px`)
    - `art_source/rigs/core_warden_fists.png` (**S4**: Arme R/L ohne Faust mit leuchtender Manschette + Fäuste vorn/geladen/schräg-oben + Energie-Schweif; Schulter bzw. Faustmitte im Fadenkreuz, `min_margin ≥ 115 px`)
    - `art_source/rigs/core_warden_arms_R2.png` (**S2 rechts**: 6 Zwischen-/Schadens-Posen, Schulterring im Fadenkreuz, `min_margin ≥ 34 px`)
    - `art_source/rigs/core_warden_arms_L2.png` (**S2 links**: 6 Zwischen-/Schadens-Posen mit Licht links-oben, Schulterring im Fadenkreuz, `min_margin ≥ 46 px`)
  - **§4.1 Krall (1/6 fertig):**
    - `art_source/rigs/krall_arms_R.png` (rechter Greifzangen-Arm `x=0.96`, 6 Posen, Schulterring im Fadenkreuz, `min_margin ≥ 31 px`)
- **Noch offen (§4.1 Krall, 5 Sheets):**
  - `krall_arms_L.png`, `krall_legs_R.png`, `krall_legs_L.png`, `krall_torsos.png`, `krall_effects.png`

## M11 Pose-Sets — Code (umgesetzt) · Handbuch: [`RIGGING_GUIDE.md`](RIGGING_GUIDE.md)
- **Import (`npm run art:import`, `scripts/art-import.py`):** `sheet.sets` in `src/data/rigs.json` (`file`, `mode: limb|swap`, `ids[6]`). Zellmitte = Gelenk, je Set ein gemeinsamer zentrierter Ausschnitt + Rig-Maßstab → alle Posen eines Sets gleich groß, Pivot `[0.5, 0.5]`. Neue Sheets: Datei in `art_source/rigs/` legen, Set in `rigs.json` eintragen, `npm run art:import -- <rig> --force`.
- **Engine (`src/engine/rig.ts`):** `RigPartDef.variants` (Bildnamen) + `PartPose.variant` (Index, geklemmt; `blendPose` schaltet bei t = 0,5 um).
- **Kern-Wächter** (`bossAnims.ts` → `coreWardenSet`): Arme/Kopf/Rumpf je `bossState` (Ruhe, Ausholen, Schlag zur Kamera, Laser-Pose, Block, Boden-Stampfer, Phase-2-Rumpf/-Kopf, überhitzt, Treffer-Kopf); Brustplatten (`plateL/R`) sind nur während `phase2_roar` sichtbar und fliegen weg.
- **Krall:** `claw` = `krall_arms_R` (6 Posen) nach Zug-Name/`bossSub` (`krallClaw`); bleibt rechts, z = 1 (vor dem Rumpf). Maßstab des Krall-Rigs ist kleiner als beim Kern-Wächter → Zange wirkt zierlich; bei Bedarf Antigravity-Sheet größer zeichnen oder `torsoDisplayH` anpassen.
- Test: `tests/m11p2.cjs`. Ansicht: `?bosslab` → Kern-Wächter / Krall (Pause + „Phase II“-Knopf zum Prüfen).

- **Abgelöste Teile (umgesetzt):** `detached.ts` (Kern-Wächter-Brustplatten, Krall-Rückenpanzer fliegen bei Phase 2 weg), Test `m11p3`.
- **Prozedurale Code-Beine: verworfen** (passten nicht zum Pixel-Art-Stil, doppelten Sprite-Beine) → wieder entfernt. Ersatz: Gegner-Rigs aus Teile-Sheets.

- **Teilen (umgesetzt, ohne neue Sprites):** Quarz-Koloss und Sternen-Archon spalten sich in Phase 2 (`DungeonScene.splitBoss`/`syncSplitPools`, Felder `Enemy.splitGroup/splitRole`): gemeinsamer HP-Pool, Sieg/Belohnung nur einmal, Hälften 85 % groß, Rollen (Quarz: A Beben · B Salve; Archon: A Sternbild/Brunnen · B Supernova, `BossDef.splitMoves`), Wiedervereinigung bei ≤ 15 % HP. Abweichung vom Plan: keine „10 s allein“-Regel (eine Hälfte kann nie allein sterben). Test `m11p4`. Kern-Wächter-Glühen sitzt am neuen Reaktorkern.

## M11 Gegner-Rigs (`ART_BRIEF_M11_ENEMIES.md`, Typ G, je `art_source/rigs/<kind>_rig.png`)
Nach und nach erzeugen, sobald Gemini-Volumen frei ist (Reihenfolge §5 im Brief). Abhaken, wenn per `art:check` geprüft und gepusht:
- [ ] **Pilot:** `turret_rig` · `phase_stalker_rig` → danach Abnahme im Spiel durch den Projektinhaber
- [ ] S1: `drone_rig` · `shield_drone_rig` · `spore_spitter_rig` · `drone_arc_rig`
- [ ] S2: `crystal_crawler_rig` · `shard_sniper_rig` · `prism_drone_rig` · `void_crawler_rig` · `resonance_warden_rig`
- [ ] S3: `magma_mortar_rig` · `slag_beetle_rig` · `ember_stalker_rig` · `forge_golem_rig` · `solar_drone_rig`
- [ ] S4: `chrono_eye_rig` · `astral_scarab_rig` · `star_lancer_rig` · `void_wraith_rig` · `monolith_guard_rig`
- Code-Seite (Claude Code, sobald der Pilot da ist): Import-Modus `parts`, Rigs in `rigs.json`, `anim/enemyAnims.ts`.

## Nächster Schritt
- **Boss-Animation (Stand):** `BOSS_ANIMATION_PLAN.md` §2.2 K1–K8 + S1 umgesetzt — Kern-Wächter wartet auf **Abnahme im echten Kampf** (§2.4). Offen: S3 → S4 → S2 → S5 (Antigravity), danach Übertragung auf die anderen Bosse (§3).
- **Antigravity (Quota-Reset):** restliche 5 Krall-Sheets: `krall_arms_L.png` (Schrott-Haken + Mini-Säge), `krall_legs_R.png`, `krall_legs_L.png`, `krall_torsos.png`, `krall_effects.png` → `npm run art:check` → pushen. Danach Claude Code: Sets in `rigs.json` eintragen (linker Arm = neues Teil `clawL`, Beine/Rumpf-Sets) und Posen in `bossAnims.ts` verdrahten.
- **Claude Code (ohne neue Sprites):** Teilen von Quarz-Koloss/Sternen-Archon (`MILESTONE_11_ARCHITECTURE.md` §4.3), prozedurale Bewegung der übrigen Bosse, Krall-Verdrahtung vorbereiten, Kern-Glühen des Kern-Wächters an die neue Kernposition anpassen (Schulter-Offsets sind justiert: `SHOULDER_ADJUST`), danach Plan-Phase 3 (Angriffe der Sektor-1-Bosse mit Teil-Abwurf/Splitting, `MILESTONE_11_ARCHITECTURE.md`).
- Ökonomie & Boss-Kampfgefühl im echten Spiel beobachten und in `src/data/balance.ts` nachjustieren (Berichte: `tests/out/economy.json`, `tests/out/ttk.json`).
- Optionale M10/M10-C-Einzel-Sprites bei Bedarf ebenfalls per Antigravity erzeugen.

## Offene Punkte
- Bildgenerierung: läuft direkt in Antigravity per `generate_image` (wochenweise Credits; Gemini-API mit Abrechnung nicht eingerichtet).
- Ideen: siehe `GAME_DESIGN_DOCUMENT.md` §5.
