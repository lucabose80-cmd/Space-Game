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
- **Antigravity (`AGENTS.md` §6):** erzeugt Sprites/Sheets per `generate_image` (mit `ImagePaths` als Referenz), bereinigt ggf. Rasterlinien und legt verlustfreie PNGs direkt im Repo unter `art_source/rigs/` oder `public/art/sprites/` ab → Commit & Push auf `main`.
- **Claude Code (`CLAUDE.md`):** setzt Code-Phasen, `npm run art:import` und Tests um.
- M11-Prüfwerkzeuge: `npm run art:check -- <sheet>`, `npm run art:import -- <rig> --force`, `node scripts/rig-sheet.cjs core_warden|krall` (Dev-Server nötig), `?bosslab` · Handbuch `RIGGING_GUIDE.md`.
- Einzelne Tests: `npm test -- m10p3 t5` · Screenshots der Tests landen in `tests/out/` (nicht committet).
- Dev-Test-Hook `window.__game` gibt es nur im Vite-Dev-Server.

## ⚠ Fehlende Sprites (Fallbacks aktiv → neue PNGs gewünscht)
`npm run check:sprites` listet die aktuelle Lage. Stand: **alle 12 optionalen M10-Sprites fehlen**
(`prop_hub_*`, `prop_kael_memorial`, `prop_lyra_echo_sign`, `prop_nyx_free_lantern`, `prop_vex_*`, `npc_pilgrim`, `npc_foundry_worker`, `npc_elder_scholar`) **plus 5 Boss-Sprites (M10-C)**: `boss_scrap_collector` *(Krall hat inzwischen ein Rig → nur noch Rückfall, niedrige Priorität)*, `boss_slag_colossus`, `boss_forge_mistress`, `boss_chrono_warden`, `boss_monolith_colossus` (128×128, Prompts: Art-Guide §8).
- Prompts & Maße: `ART_AND_DESIGN_GUIDE.md` §7–§8 · Ablage: `public/art/sprites/<datei>.png` (96×96 bzw. 128×128, kein Code nötig).
- Schwächster Fallback zuerst ersetzen: Vex-Bake, Zyklus-Hologramm, Obelisk, Klassentafel.
- **Zentrale Warteschlange:** Alle offenen Sprites & M11-Sheets stehen priorisiert (`P0`–`P4`) in [`SPRITE_QUEUE.md`](SPRITE_QUEUE.md). **Wer einen Fallback/Platzhalter oder ein neues M11-Sheet anlegt, sortiert es dort sofort priorisiert ein** (`AGENTS.md` §3 Regel 7) und vermerkt es hier kurz.

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
    - `art_source/rigs/core_warden_arms_R3.png` (**S6 rechts**: Phase-2-Angriffsposen ohne Faust mit leuchtender Manschette, Schulterring im Fadenkreuz, `min_margin ≥ 64 px`)
    - `art_source/rigs/core_warden_arms_L3.png` (**S6 links**: Phase-2-Angriffsposen ohne Faust mit Licht links-oben, Schulterring im Fadenkreuz, `min_margin ≥ 63 px`)
  - **§4.1 Krall — komplett (6/6 fertig):**
    - `art_source/rigs/krall_arms_R.png` (rechter Greifzangen-Arm `x=0.96`, 6 Posen, Schulterring im Fadenkreuz, `min_margin ≥ 31 px`)
    - `art_source/rigs/krall_arms_L.png` (linker Schrott-Haken + Mini-Kreissägen-Arm `x=0.04`, 6 Posen inkl. Schild-Block & Kamera-Stoß, Schulterring im Fadenkreuz, `min_margin ≥ 34 px`)
    - `art_source/rigs/krall_torsos.png` (6 Rumpf-Varianten inkl. Phase-2-Skelettrahmen/Kern offen & Funken/Dellen, Furnace-Kern im Fadenkreuz, `min_margin ≥ 34 px`)
    - `art_source/rigs/krall_legs_R.png` (rechtes 2-Segment-Spinnenbein, 6 Posen: Schritt vor · Schritt zurück · Standbein · angehoben · geduckt · Absprung, Hüftring im Fadenkreuz, `min_margin ≥ 69 px`)
    - `art_source/rigs/krall_legs_L.png` (linkes 2-Segment-Spinnenbein mit Licht links-oben, 6 Posen, Hüftring im Fadenkreuz, `min_margin ≥ 68 px`)
    - `art_source/rigs/krall_effects.png` (3 Schrottklumpen · Magnet aktiv mit Blitzen · Magnet inaktiv · Funken-/Rost-Splitter, zentriert im Fadenkreuz, `min_margin ≥ 108 px`)
    - `art_source/rigs/krall_arms_R2.png` (**P0-06 / K-C rechts**: Stoß teleskopiert kurz/mittel/voll · Zuschnappen · Sog mit Funken · Hagel mit Schrottbrocken, Schulterring im Fadenkreuz, `min_margin ≥ 40 px`)
    - `art_source/rigs/krall_arms_L2.png` (**P0-07 / K-C links**: gleiche 6 Angriffsposen für Schrott-Haken/Mini-Säge mit Licht links-oben, Schulterring im Fadenkreuz, `min_margin ≥ 35 px`)
    - `art_source/rigs/krall_fx2.png` (**P0-08 / K-D Effekte**: Stoß-Luftwelle · Magnet-Feldring rot/blau · Magnet-Blitzbogen · Staub-/Druckring · Aufschlag-Krater mit Schrottsplittern · Rostwolke, zentriert im Fadenkreuz, `min_margin ≥ 99 px`; Ringe Zelle 2/4 mit `holes: true` importieren)
    - `art_source/rigs/krall_torsos2.png` (**P0-09 / K-A Phase-2-Rümpfe**: 6 Skelettrahmen-Posen passend zu `krall_torsos.png` Zelle 5: geduckt · aufgerichtet/Kern hell · vorgebeugt · Stampfer gestaucht · Wurf-Drehung · überhitzt mit Funken/Dampf, Kern im Fadenkreuz, `min_margin ≥ 56 px`)
    - `art_source/rigs/krall_torsos3.png` (**P0-11 / K-E Rumpf-Beschädigungsstufen**: P1 < 80/< 65/< 25 % · P2 < 35/< 25/kritisch < 15 %, Furnace-Kern im Fadenkreuz, `min_margin ≥ 35 px`)

## M11 Pose-Sets — Code (umgesetzt) · Handbuch: [`RIGGING_GUIDE.md`](RIGGING_GUIDE.md)
- **Import (`npm run art:import`, `scripts/art-import.py`):** `sheet.sets` in `src/data/rigs.json` (`file`, `mode: limb|swap`, `ids[]`, optional `cells` zum Teilen eines Sheets in mehrere Sets). Zellmitte = Gelenk, je Set ein gemeinsamer zentrierter Ausschnitt + Rig-Maßstab → alle Posen eines Sets gleich groß, Pivot `[0.5, 0.5]`. Neue Sheets: Datei in `art_source/rigs/` legen, Set in `rigs.json` eintragen (Varianten **hinten anhängen**), `npm run art:import -- <rig> --force`. Bilder ohne Teil: `extraImages`.
- **Engine (`src/engine/rig.ts`):** `RigPartDef.variants` (Bildnamen) + `PartPose.variant` (Index, geklemmt; `blendPose` schaltet bei t = 0,5 um).
- **Kern-Wächter** (`bossAnims.ts` → `coreWardenSet`): Arme (13 Varianten je Seite), Köpfe (12), Rümpfe (12) je `bossState`; Glättung + Stauch-Impuls + Zwischen-Posen; Anlauf/Nachfedern/Gehen/Treffer; Laser-Brust offen; Blick/Blinzeln; Phase 2: Platten fliegen weg (`detached.ts`), Fäuste kreisen und werden als „Faust-Salve“ abgefeuert (verfolgen den Spieler, lösen sich auf, wachsen nach), hängende Arme ohne Faust. Varianten-Karte: `BOSS_ANIMATION_PLAN.md` §2.1. **S6 eingebunden:** `armR_13…18`/`armL_13…18` (Phase 2 ohne Faust, Karte `NOFIST_OF` in `bossAnims.ts`) → Kern-Wächter komplett; fehlt nur die Abnahme im echten Kampf.
- **Krall (eingebunden):** Teile `clawR` (`krall_arms_R`) + `clawL` (`krall_arms_L`), je 6 Posen (0 hängend · 1 ausholen · 2 Stoß · 3 seitlich · 4 Block · 5 Stampfer), Rumpf-Set `torso_1…6` (normal · geduckt · aufgerichtet · gebeugt · Phase-2-Skelettrahmen · beschädigt, Pivot = Kern). `krallSet()` in `bossAnims.ts` wählt nach Zugname/`bossSub`/Phase (Tabelle: `BOSS_ANIMATION_PLAN.md` §3), mit Anlauf, Nachfedern, Gehen, Treffer. Maßstab: `torsoDisplayH` 30 → 36 (neuer Rumpf ist kleiner gezeichnet; Zangen wirken größer). Kinder des Rumpfs hängen mit `attach [0.5,0.5]` + `offset` relativ zum Kern. Links/Rechts der Arme per Alpha-Maske geprüft (nicht vertauscht). Panzer fällt in Phase 2 ab. **Feinschliff gegen „Puppen-Zappeln“:** Schrittphase aus zurückgelegter Strecke (stehend = Beine ruhig), Renderer wippt nur beim Laufen und nutzt `smoothBossBody`, trägere Glättung (`KRALL_TAU` 0,1 s), linker Arm folgt dem rechten mit 0,07 s Verzögerung (`VARIANT_LAG`), Zwischen-Posen der Zangen (`CLAW_BETWEEN`). **Beine/Effekte eingebunden:** 4 Beine nutzen `legR_1…6`/`legL_1…6` (`legPose()`: Schritt vor/zurück/anheben/Standbein/geduckt, Ducken bei Windup), Magnet wechselt `magnet_off`/`magnet_on` (nur beim Sog), Schrott-Wurf-Geschosse zeigen `scrap_a/b/c` (`Projectile.sprite='scrap'`); `spark` liegt als Extra-Bild bereit (noch ungenutzt). Import-Option `holes: true` je Set entfernt eingeschlossenes Weiß (Magnet-Öffnung). Fehlt nur Abnahme im echten Kampf. **Kern-Wächter Beschädigungsstufen (ohne neue Sprites, vorhandene Bilder verdrahtet):** P1 < 80 % Helm rissig · < 65 % Rumpf dampft · P2 < 35 % Arme zerfetzt · < 25 % Rumpf beschädigt · < 15 % Helm zerstört (Test `m11p2`). **Angriffs-Abstimmung:** Beinposen je Zug/Phase in `krallSet().leg`; **Angriffs-FX (Nachtest-Feedback):** `BossZone.fx` (`pull`/`blast`/`drop`/`dash`, `bossFx.ts renderFx`), Stoß-Arme schießen in Stoßrichtung, Platte hängt als Rückenschutz am Rumpf, P2-Hüften nach innen (Tabelle `BOSS_ANIMATION_PLAN.md` §3). **Neue Sprites gewünscht (PRIORITÄT P0, ganz oben):** Arme-Angriffsposen `krall_arms_R2/L2`, `krall_fx2`, Beschädigungsstufen `krall_torsos3` + `krall_arms_R3/L3` (P0-11/12), `krall_torsos2.png` (Phase-2-Rümpfe, wichtigste), `krall_legs_R2/L2.png` → `SPRITE_QUEUE.md` P0-06…P0-12.
- Tests: `m11p1` (Rig-Engine), `m11p2` (Pose-Sets/Übergänge/Zuordnung), `m11p3` (abgelöste Teile), `m11p4` (Teilen). Ansicht: `?bosslab` → Kern-Wächter / Krall (Pause + „Phase II“-Knopf zum Prüfen).

- **Abgelöste Teile (umgesetzt):** `detached.ts` (Kern-Wächter-Brustplatten, Krall-Rückenpanzer fliegen bei Phase 2 weg), Test `m11p3`.
- **Prozedurale Code-Beine: verworfen** (passten nicht zum Pixel-Art-Stil, doppelten Sprite-Beine) → wieder entfernt. Ersatz: Gegner-Rigs aus Teile-Sheets.

- **Teilen (umgesetzt, ohne neue Sprites):** Quarz-Koloss und Sternen-Archon spalten sich in Phase 2 (`DungeonScene.splitBoss`/`syncSplitPools`, Felder `Enemy.splitGroup/splitRole`): gemeinsamer HP-Pool, Sieg/Belohnung nur einmal, Hälften 85 % groß, Rollen (Quarz: A Beben · B Salve; Archon: A Sternbild/Brunnen · B Supernova, `BossDef.splitMoves`), Wiedervereinigung bei ≤ 15 % HP. Abweichung vom Plan: keine „10 s allein“-Regel (eine Hälfte kann nie allein sterben). Test `m11p4`. Kern-Wächter-Glühen sitzt am neuen Reaktorkern.

## M11 Gegner-Rigs (`ART_BRIEF_M11_ENEMIES.md`, Typ G, je `art_source/rigs/<kind>_rig.png`)
Nach und nach erzeugen, sobald Gemini-Volumen frei ist (Reihenfolge §5 im Brief). Abhaken, wenn per `art:check` geprüft und gepusht:
- [x] **Pilot:** `turret_rig` (`min_margin ≥ 45 px`, `art:check` ok) + `turret_treads` (`min_margin ≥ 78 px`, `art:check` ok) · `phase_stalker_rig` (`min_margin ≥ 53 px`, `art:check` ok) → **P2-Gate vom Projektinhaber freigegeben**
- [x] S1 (erledigt): `drone_rig` (`min_margin ≥ 71 px`, `art:check` ok)
- [ ] S1 (offen): `shield_drone_rig` · `spore_spitter_rig` · `drone_arc_rig`
- [ ] S2: `crystal_crawler_rig` · `shard_sniper_rig` · `prism_drone_rig` · `void_crawler_rig` · `resonance_warden_rig`
- [ ] S3: `magma_mortar_rig` · `slag_beetle_rig` · `ember_stalker_rig` · `forge_golem_rig` · `solar_drone_rig`
- [ ] S4: `chrono_eye_rig` · `astral_scarab_rig` · `star_lancer_rig` · `void_wraith_rig` · `monolith_guard_rig`
- Code-Seite (Claude Code, bereit!): Import-Modus `parts`, Rigs in `rigs.json`, `anim/enemyAnims.ts`. *(Hinweis: `turret_rig.png` Zelle 5 ist ein hohler sechseckiger Mündungsring mit `#FFFFFF`-Innenloch — beim `parts`-Import ggf. Innen-Weiß entfernen wie bei Ringen üblich.)*

## Gegner-Rigs (M11 Phase 7) — Stand
- **Geschütz (`turret`) eingebunden:** `rigs.json` → `turret` (`sheet.srcFile: turret_rig`, Teile base/housing/barrel/muzzle/core), `src/dungeon/anim/enemyAnims.ts` (`turretPose`: Neigung zum Spieler, Rohr fährt in Vorwarnung aus, Mündung/Kern glühen, Rückstoß, Wippen beim Umsetzen), Renderer `tryDrawEnemyRig` (Blick zum Spieler = Rig gespiegelt). Fallback: altes `turret_0/1`.
- **Bereit zum Einbinden (P0-13 ✅ geliefert):** Raupenketten `art_source/rigs/turret_treads.png` (4 Rollphasen links + Staubwolke + Bremsfunken, `min_margin ≥ 78 px`) — jetzt als Teile `treadL/R` einbauen (Rollphase aus Strecke, Staub/Bremsfunken).
- **Noch ohne Code:** `phase_stalker_rig.png`, `drone_rig.png` liegen vor, werden als Nächstes eingebunden (gleiches Muster).

## Nächster Schritt
- **Polish (Teile 1–3) abgenommen & erledigt:** Hintergrund-Pause, Wackeln/Vibration im Hilfe-Tab, Tür-Label · Kern-Wächter-Schritte, Hit-Stop (`heavyStop`), Telegraph-Blitz, Schadenszahlen-Merge · Dungeon-Code lädt nach (`__game.dungeonReady`, Chunk-Gruppe `dungeon` entfernt). Tests `t7`, `t7b`, `t8`.
- **Aufräumen erledigt** (Audit 2026-11-26, Blöcke C1–C6): Doku auf aktuellem Stand, „Kern-Wächter“ einheitlich, Repo-Hygiene, toter Code entfernt, gemeinsamer `EnemyKind`, `check:sprites` prüft Sheets/Imports, Pose-Sheet-Import (`art_source/poses`) entfernt, `npm run build:single` dokumentiert, Version 1.4.0. **Firebase-SDK lädt nach dem Start nach** (`src/services/firebaseSdk.ts` per `import()`, Service-API unverändert; Test `t6`) — Abweichung vom Plan: nicht der ganze Service, nur das SDK.
- **Claude Code (sofort startklar!):**
  1. ~~S6 Kern-Wächter~~ ✅ eingebunden (Abnahme im echten Kampf durch Projektinhaber offen).
  2. ~~Krall K-C (P0-06/07)~~ ✅ eingebunden: `clawR/L` Varianten 6–11 (`KARM.telS/telM/telL/snap/sog/hold`). **Neu bereit (P0-08/09/11):** `krall_fx2.png` (Ringe mit `holes: true`), `krall_torsos2.png` (6 Phase-2-Rümpfe) & `krall_torsos3.png` (6 Beschädigungsstufen) in `rigs.json` importieren und in `bossAnims.ts`/`bossFx.ts` einbinden.
  3. **Gegner-Rigs (S1):** `turret_rig.png` ✅ eingebunden + **`turret_treads.png` (P0-13)** neu bereit zum Einbinden; `phase_stalker_rig.png` und `drone_rig.png` ebenfalls bereit.
- **Antigravity (als Nächstes):** Weiter in [`SPRITE_QUEUE.md`](SPRITE_QUEUE.md) via Skill `sprite-batch`: **`P0-10`** (`krall_legs_R2.png` + `krall_legs_L2.png`), danach **`P0-12`** (`krall_arms_R3.png` + `krall_arms_L3.png`), dann ab `P2-02` (`shield_drone_rig.png`).
- Ökonomie & Boss-Kampfgefühl im echten Spiel beobachten und in `src/data/balance.ts` nachjustieren (Berichte: `tests/out/economy.json`, `tests/out/ttk.json`).
- Optionale M10/M10-C-Einzel-Sprites bei Bedarf ebenfalls per Antigravity erzeugen.

## Offene Punkte
- Bildgenerierung: läuft direkt in Antigravity per `generate_image` (wochenweise Credits; Gemini-API mit Abrechnung nicht eingerichtet).
- Ideen: siehe `GAME_DESIGN_DOCUMENT.md` §5.
