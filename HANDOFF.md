# HANDOFF — Übergabe zwischen Claude Code, Antigravity & Co.

> **Zweck:** Jedes Werkzeug (und jede neue Sitzung) soll hier in 1 Minute wissen, wo das Projekt steht. **Am Ende jeder Arbeitssitzung aktualisieren** (kurz halten, veraltete Punkte löschen).

## Stand
- Meilensteine 1–10-C sind umgesetzt, `SAVE_VERSION = 11` (Vercel deployt bei Push auf `main`). **M11 (lebendige Gegner & Bosse) läuft:** Kern-Wächter komplett animiert, Krall (Arme L/R + Rumpf) eingebunden – Beine/Effekte fehlen, Teilen von Quarz-Koloss/Sternen-Archon fertig; Rest wartet auf Sprites. Übersicht: `MILESTONE_11_ARCHITECTURE.md` §11, `BOSS_ANIMATION_PLAN.md` (Statustabelle §3).
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
- M11-Prüfwerkzeuge: `npm run art:check -- <sheet>`, `npm run art:import -- <rig> --force`, `node scripts/rig-sheet.cjs core_warden|krall` (Dev-Server nötig), `?bosslab` · Handbuch `RIGGING_GUIDE.md`.
- Einzelne Tests: `npm test -- m10p3 t5` · Screenshots der Tests landen in `tests/out/` (nicht committet).
- Dev-Test-Hook `window.__game` gibt es nur im Vite-Dev-Server.

## ⚠ Fehlende Sprites (Fallbacks aktiv → neue PNGs gewünscht)
`npm run check:sprites` listet die aktuelle Lage. Stand: **alle 12 optionalen M10-Sprites fehlen**
(`prop_hub_*`, `prop_kael_memorial`, `prop_lyra_echo_sign`, `prop_nyx_free_lantern`, `prop_vex_*`, `npc_pilgrim`, `npc_foundry_worker`, `npc_elder_scholar`) **plus 5 Boss-Sprites (M10-C)**: `boss_scrap_collector` *(Krall hat inzwischen ein Rig → nur noch Rückfall, niedrige Priorität)*, `boss_slag_colossus`, `boss_forge_mistress`, `boss_chrono_warden`, `boss_monolith_colossus` (128×128, Prompts: Art-Guide §8).
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
    - `art_source/rigs/core_warden_heads2.png` (**S5**: Visier-Laser, Blick links/rechts, brüllend Phase 2, stark beschädigt < 15 % HP mit zerbrochenem Halo, Blinzeln/Visier zu; Halsgelenk im Fadenkreuz, `min_margin ≥ 36 px`)
  - **§4.1 Krall (3/6 fertig):**
    - `art_source/rigs/krall_arms_R.png` (rechter Greifzangen-Arm `x=0.96`, 6 Posen, Schulterring im Fadenkreuz, `min_margin ≥ 31 px`)
    - `art_source/rigs/krall_arms_L.png` (linker Schrott-Haken + Mini-Kreissägen-Arm `x=0.04`, 6 Posen inkl. Schild-Block & Kamera-Stoß, Schulterring im Fadenkreuz, `min_margin ≥ 34 px`)
    - `art_source/rigs/krall_torsos.png` (6 Rumpf-Varianten inkl. Phase-2-Skelettrahmen/Kern offen & Funken/Dellen, Furnace-Kern im Fadenkreuz, `min_margin ≥ 34 px`)
- **Noch offen (§4.1 Krall, 3 Sheets — pausiert wegen `gemini-3.1-flash-image`-Quota, Cooldown ~3h 32m):**
  - `krall_legs_R.png`, `krall_legs_L.png`, `krall_effects.png`

## M11 Pose-Sets — Code (umgesetzt) · Handbuch: [`RIGGING_GUIDE.md`](RIGGING_GUIDE.md)
- **Import (`npm run art:import`, `scripts/art-import.py`):** `sheet.sets` in `src/data/rigs.json` (`file`, `mode: limb|swap`, `ids[]`, optional `cells` zum Teilen eines Sheets in mehrere Sets). Zellmitte = Gelenk, je Set ein gemeinsamer zentrierter Ausschnitt + Rig-Maßstab → alle Posen eines Sets gleich groß, Pivot `[0.5, 0.5]`. Neue Sheets: Datei in `art_source/rigs/` legen, Set in `rigs.json` eintragen (Varianten **hinten anhängen**), `npm run art:import -- <rig> --force`. Bilder ohne Teil: `extraImages`.
- **Engine (`src/engine/rig.ts`):** `RigPartDef.variants` (Bildnamen) + `PartPose.variant` (Index, geklemmt; `blendPose` schaltet bei t = 0,5 um).
- **Kern-Wächter** (`bossAnims.ts` → `coreWardenSet`): Arme (13 Varianten je Seite), Köpfe (12), Rümpfe (12) je `bossState`; Glättung + Stauch-Impuls + Zwischen-Posen; Anlauf/Nachfedern/Gehen/Treffer; Laser-Brust offen; Blick/Blinzeln; Phase 2: Platten fliegen weg (`detached.ts`), Fäuste kreisen und werden als „Faust-Salve“ abgefeuert (verfolgen den Spieler, lösen sich auf, wachsen nach), hängende Arme ohne Faust. Varianten-Karte: `BOSS_ANIMATION_PLAN.md` §2.1. **Offen:** S6 (Arme ohne Faust in Angriffsposen) und Abnahme im echten Kampf.
- **Krall (eingebunden):** Teile `clawR` (`krall_arms_R`) + `clawL` (`krall_arms_L`), je 6 Posen (0 hängend · 1 ausholen · 2 Stoß · 3 seitlich · 4 Block · 5 Stampfer), Rumpf-Set `torso_1…6` (normal · geduckt · aufgerichtet · gebeugt · Phase-2-Skelettrahmen · beschädigt, Pivot = Kern). `krallSet()` in `bossAnims.ts` wählt nach Zugname/`bossSub`/Phase (Tabelle: `BOSS_ANIMATION_PLAN.md` §3), mit Anlauf, Nachfedern, Gehen, Treffer. Maßstab: `torsoDisplayH` 30 → 36 (neuer Rumpf ist kleiner gezeichnet; Zangen wirken größer). Kinder des Rumpfs hängen mit `attach [0.5,0.5]` + `offset` relativ zum Kern. Links/Rechts der Arme per Alpha-Maske geprüft (nicht vertauscht). Panzer fällt in Phase 2 ab. **Feinschliff gegen „Puppen-Zappeln“:** Schrittphase aus zurückgelegter Strecke (stehend = Beine ruhig), Renderer wippt nur beim Laufen und nutzt `smoothBossBody`, trägere Glättung (`KRALL_TAU` 0,1 s), linker Arm folgt dem rechten mit 0,07 s Verzögerung (`VARIANT_LAG`), Zwischen-Posen der Zangen (`CLAW_BETWEEN`). **Offen:** `krall_legs_R/L.png`, `krall_effects.png`; Abnahme im echten Kampf.
- Tests: `m11p1` (Rig-Engine), `m11p2` (Pose-Sets/Übergänge/Zuordnung), `m11p3` (abgelöste Teile), `m11p4` (Teilen). Ansicht: `?bosslab` → Kern-Wächter / Krall (Pause + „Phase II“-Knopf zum Prüfen).

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
- **Aufräumen (zuerst, ohne Sprites):** [`CLEANUP_PLAN.md`](CLEANUP_PLAN.md) — Audit vom 2026-11-26: veraltete Doku (Tag/Nacht vertauscht, Steuerung, Bossnamen, M11-Altkonzepte), Repo-Hygiene, toter Code. Blöcke C1–C5 der Reihe nach, je ein Commit; C6 nur nach Rücksprache.
- **Boss-Animation (Stand):** Kern-Wächter komplett eingebunden — `BOSS_ANIMATION_PLAN.md` K1–K8 **und** S1–S5 (Zwischen-Posen, Laser-Rumpf, Faust-Pylonen, Blick/Blinzeln, beschädigte Phase-2-Posen). Phase 2: Fäuste kreisen **und werden in der Orbit-Salve abgefeuert**, hängende Arme ohne Faust. Es fehlt die **Abnahme im echten Kampf** (§2.4) und **S6** (Angriffsposen ohne Faust, siehe unten).
- **Antigravity (als Nächstes):** **S6** aus `BOSS_ANIMATION_PLAN.md` §2.3 (`core_warden_arms_R3.png` / `core_warden_arms_L3.png`: Arme ohne Faust in Ausholen/Schlag/Seite/Block/Stampfer für Phase 2); danach (nach Quota-Reset) letzte 3 Krall-Sheets (`krall_legs_R.png`, `krall_legs_L.png`, `krall_effects.png`) und Gegner-Rig-Piloten (`turret_rig`, `phase_stalker_rig`).
- **Claude Code (ohne neue Sprites):** (1) *erledigt:* Krall-Arme/Rumpf eingebunden + Anti-Zappel-Feinschliff (`4c1eb4d`); Projektinhaber meldet: Attacken/Bewegung wirkten noch ungelenk („zappelnde Puppe“) → nach seinen Kampf-Eindrücken gezielt abstimmen (Liste: `BOSS_ANIMATION_PLAN.md` §3 „Krall — noch offen“); bleibt: Abnahme im echten Kampf, `legs`/`effects` einbinden sobald vorhanden; (2) Boss-Rigs der übrigen Bosse brauchen Sprites (`ART_BRIEF_M11.md` §4.3); (3) nach der Abnahme des Kern-Wächters die Übergangs-/Impuls-Logik für weitere Bosse nutzen (`BOSS_ANIMATION_PLAN.md` §3); (4) Gegner-Rig-Import (`parts`-Modus) sobald die Pilot-Sheets da sind.
- Ökonomie & Boss-Kampfgefühl im echten Spiel beobachten und in `src/data/balance.ts` nachjustieren (Berichte: `tests/out/economy.json`, `tests/out/ttk.json`).
- Optionale M10/M10-C-Einzel-Sprites bei Bedarf ebenfalls per Antigravity erzeugen.

## Offene Punkte
- Bildgenerierung: läuft direkt in Antigravity per `generate_image` (wochenweise Credits; Gemini-API mit Abrechnung nicht eingerichtet).
- Ideen: siehe `GAME_DESIGN_DOCUMENT.md` §5.
