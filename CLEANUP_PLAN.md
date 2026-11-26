# CLEANUP_PLAN.md — Aufräumen veralteter Doku & Altlasten (Audit 2026-11-26)

> **Für:** Claude Sonnet (mittlere Denktiefe) oder jedes andere Werkzeug — ohne Vorwissen abarbeitbar.
> **Herkunft:** Abgleich aller `*.md` mit dem Code (Stand Commit `7a98866`). Jeder Punkt unten wurde am Code geprüft; Zeilennummern können sich leicht verschoben haben → per Suche (`grep -n`) nachsehen.
> **Arbeitsweise:** Aufgaben in der Reihenfolge C1 → C6 abarbeiten, **ein Commit pro Block**. Haken `[x]` setzen, wenn erledigt. Am Ende `HANDOFF.md` aktualisieren und diese Datei löschen (oder als „erledigt“ markieren), sobald alles abgehakt ist.

## 0. Feste Entscheidungen (nicht neu diskutieren)
- **Boss-Name S1 E2:** überall **„Kern-Wächter MK-IV“** (Großschreibung im Namensschild: `KERN-WÄCHTER MK-IV`). „Core-Wächter“ verschwindet.
- **Enemy-`kind`-Namen im Code NICHT umbenennen** (`boss_breacher`, `boss_slag_overlord`, `boss_forge_warden`, `boss_chrono_sentinel` …) — sie hängen an Tests, Balancing, Rigs und Seeds. Stattdessen eine Zuordnungstabelle dokumentieren (C3.6).
- **Keine Spiellogik ändern.** Nur Texte, Doku, Typen, toten Code, Werkzeuge. `SAVE_VERSION` bleibt `11`.
- **Verifikation:** Reine Doku-Blöcke (C1, C2, C3): `npm run check:invariants && npm run check:sprites`. Blöcke mit Code/Skripten (C4, C5, C6): `npm run verify` (alle Tests grün) — vorher `npm install` und ggf. `npx playwright install chromium`.

---

## C1 · README & GDD — was der Spieler/Leser sieht (Doku, ein Commit)

- [x] **C1.1 Tag/Nacht vertauscht.** Seit M10-C gilt: Laden **nur nachts**, Runs am Tag (Nacht-Runs möglich, +35 % Beute, dann fällt die Ladenschicht aus) — siehe AGENTS.md §3 Regel 9.
  - `README.md` Zeile 5 („Bei Tag betreibst du … bei Nacht (oder auf Expedition) plünderst du …“) und `GAME_DESIGN_DOCUMENT.md` Zeile 4 (Kurzpitch, gleiche Formulierung) umschreiben, z. B.: „Tagsüber plünderst du prozedurale Raumschiff-Wracks, Kristall-Nebel, … — nachts öffnest du deinen Relikt- und Bergungsladen **Astro-Barter** auf **Port Solaris** und verkaufst die Beute.“
  - `GAME_DESIGN_DOCUMENT.md` §4 M2-Zeile („Tag/Nacht-Zyklus (+35 % Nacht-Loot)“) darf bleiben (historisch), aber README-Feature „Chrono-Ruhekapsel (Tag ↔ Nacht)“ → „Koje (nur nachts: Schicht überspringen)“.
- [x] **C1.2 Steuerungstabelle `README.md` (Abschnitt „Steuerung“) an `src/engine/input.ts` (`btnMap`, ca. Zeile 63–74) angleichen:**
  | Aktion | richtig |
  | :--- | :--- |
  | Jetpack-Dash | `Leertaste` / `Shift` / `DASH` / **`X`** |
  | Aktive Waffe | `Linksklick` / `J` / Waffen-Button / **`A` oder `RT`** |
  | Spezial-Fähigkeit | `Rechtsklick` / `K` / Spezial-Button / **`B`** |
  | Waffe wechseln | `C` / `WECHSELN` / **`RB`** |
  | Stimpack | `Q` / `HEIL` / **`LB`** |
  | Fracht, Truhe, Codex & Logbuch | `I` oder `Tab` / **`Select`** |
  | Menü schließen | `Esc` / **`Start`** |
  - Zeile **„Warp-Beacon (Extraktion) `R` gedrückt halten / `WARP`“ löschen** (Heim-Teleport seit M10-C entfernt). Stattdessen eine Zeile „Extraktion: Teleporter im Start-/Boss-Raum oder Notfall-Bake (ab Ebene II, einmalig) — `E`“.
  - Neue Zeile: „Schnell-Nachfüllen am Holo-Podest | `F` (im Laden)“.
  - Vorher kurz prüfen, ob die Touch-Labels (`DASH`, `WECHSELN`, `HEIL`, `AKTION`) in `src/ui/TouchControls.ts` noch so heißen; sonst anpassen.
- [x] **C1.3 Bossnamen Sektor 1/3.**
  - `README.md` Zeile 10 und `GAME_DESIGN_DOCUMENT.md` §3 (Zeile „Sektor 1“): „*Schott-Brecher MK-II* → *Core-Wächter MK-IV*“ → „*Schrott-Sammler „Krall“* → *Kern-Wächter MK-IV*“.
  - `GAME_DESIGN_DOCUMENT.md` §3 Zeile „Sektor 3“: „*Gießerei-Meister*“ → „*Gießerei-Meisterin*“.
- [x] **C1.4 GDD-Dateikarte (§6) ergänzen:** `data/balance.ts` (M10-C Balancing), `data/rigs.ts` + `data/rigs.json` (M11 Rigs), `dev/bossLab.ts` (`?bosslab`), `dungeon/navGrid.ts` (Fluss-Feld-Navigation), `engine/input.ts` (Tastatur/Touch/Gamepad), `engine/audio.ts` (Web-Audio-Synth), `ui/TouchControls.ts`, `ui/LoadoutPanel.ts` (Waffenschrank). Außerdem Kopf-Zeile „Stand: Version 1.4 (nach Meilenstein 10-C …)“ um „, M11 in Arbeit“ ergänzen.
- [x] **C1.5 GDD §5 Punkt 1:** `boss_scrap_collector` (Krall) aus der Wunschliste herausnehmen bzw. als „nur Rückfall, niedrige Priorität — Krall hat ein Rig“ markieren. Gleiches in `HANDOFF.md` „Fehlende Sprites“.

## C2 · Veraltete Abschnitte in Fach-Dokumenten (Doku, ein Commit)

- [x] **C2.1 `TESTING_AND_VERIFICATION.md`**
  - §1 „Standard-Verifikations-Pipeline“ neu fassen: Schritt 1 = `npm run verify` (Build → `check:invariants` → `check:sprites` → Playwright-Tests aus `tests/*.cjs` über `tests/harness.cjs`), Schritt 2 = Screenshots in `tests/out/` ansehen, Schritt 3 = Push. Den `rg`-Befehl durch `rg -n "state\.credits\s*\+=" src/scenes/DungeonScene.ts src/dungeon/` ersetzen (prüft ganz `src/dungeon/`, wie AGENTS.md §3 Regel 1).
  - §2 „Bewährtes Headless-Chrome-CDP-Harness (Vorlage)“ (manuelles `google-chrome`, Pfad `/home/antigravity/...`) → in einen Anhang „Historisch (vor M10-A)“ verschieben **oder** löschen; Hinweis: „Neue Tests als `tests/<name>.cjs` nach dem Muster bestehender Tests schreiben, `npm test -- <name>`.“
  - Den Abschnitt „Automatisierte Tests im Repo (seit M10-A)“ nach oben (direkt unter §1) ziehen.
  - §5: „Aktueller Stand (v1.1)“ → „(v1.4)“; Links auf `HANDOFF.md`, `RIGGING_GUIDE.md` ergänzen.
- [x] **C2.2 `MILESTONE_11_ARCHITECTURE.md`** — überholte Teile klar markieren (nicht löschen, Plan-Historie bleibt):
  - Am Anfang von §2.1, §2.2, §3.2 (Punkte `legs.ts`, `transform.ts`), §3.3, §6.1, §6.2, §6.4 einen Kasten einfügen: „> **Überholt:** siehe `ART_BRIEF_M11.md` v2 (Gelenk in Zellmitte, Pose-Sets) bzw. `ART_BRIEF_M11_ENEMIES.md` (Typ G). Nicht mehr danach arbeiten.“
  - §2.1 „steht in `src/data/rigs.ts`“ → „steht in `src/data/rigs.json` (`sheet.order`)“; ebenso §3.3/§7 Phase 0/3 „`data/rigs.ts`“ → „`data/rigs.json`“.
  - §2.4 Widerspruch auflösen: Satz „(freigestellt mit Rand-Flood-Fill + 1-px-Defringe + NEAREST, wie Art-Guide §3)“ → „(freigestellt mit Rand-Flood-Fill + 1-px-Defringe, verkleinert mit Lanczos — Standard von `--resample`)“.
  - §3.3: Satz ergänzen „**Nicht umgesetzt:** Ausschnitte aus dem Einzelbild (`source.rects`). Fehlt ein Rig-Bild, zeigt der Boss sein altes Einzel-Sprite.“
  - §3.2 `transform.ts` → „nicht als eigene Datei umgesetzt; Phase-2-Verwandlung läuft über `detach` (`anim/detached.ts`) + Rumpf-Varianten“.
- [x] **C2.3 `BOSS_ANIMATION_PLAN.md`**
  - §2.1 Update-Kasten: „Offen: nur noch die Abnahme …“ → „Offen: **S6** (Arme ohne Faust in Angriffsposen) und die Abnahme im echten Kampf (§2.4).“
  - §2.3 letzte Zeile „Reihenfolge für Credits: … *(alle Sprite-Aufgaben für Kern-Wächter erledigt!)*“ → „Offen: **S6**. Erledigt: S1 → S3 → S4 → S2 → S5.“
  - K5 und K6: die eingerückten Unterpunkte (beschreiben verworfene Wege) entweder löschen oder mit „*(verworfener Ansatz, nur Historie)*“ einleiten.
- [x] **C2.4 `ART_BRIEF_M11.md`**
  - §7 „Was Claude Code danach baut (zur Info)“ → Überschrift „§7 Bereits umgesetzt“ und Inhalt auf 2 Zeilen kürzen (Import-Modi `limb`/`swap`, `PartPose.variant` — siehe `RIGGING_GUIDE.md`).
  - §6 Punkt 1: „Pose-Sheets 2×2: `-- --cols 2 --rows 2`“ streichen (2×2 ist überholt).
  - §5: „Prüfbilder (nicht committen nötig)“ → „Prüfbilder (**nicht committen**, stehen in `.gitignore`)“ — passt nach C4.1.
  - Kopf „Stand: nach den Pilot-Sheets“ → „Stand: Kern-Wächter komplett, Krall Arme/Rumpf fertig (siehe `HANDOFF.md`)“.
- [x] **C2.5 `art_source/poses/README.md`** ersetzen durch: „Überholt — 2×2-Pose-Sheets werden nicht mehr verwendet. Normale Gegner: `art_source/rigs/<kind>_rig.png` (3×2, Typ G), siehe `ART_BRIEF_M11_ENEMIES.md`.“ `art_source/rigs/README.md` ebenso aktualisieren: Typ P `<id>_parts.png`, Typ L/S `<id>_arms_L/R.png`, `_heads`, `_torsos`, `_legs_L/R`, `_effects` (`ART_BRIEF_M11.md`), Typ G `<kind>_rig.png` (`ART_BRIEF_M11_ENEMIES.md`).
- [x] **C2.6 Kleinkram**
  - `MILESTONE_9_ARCHITECTURE.md` Kopf: „Umgesetzt auf Branch `claude/architektur-vorgehensplan-lgme5i`“ → „Umgesetzt & live auf `main`“.
  - `RIGGING_GUIDE.md` §2 Tabelle letzte Zeile: Tests `m11p0` (Import), `m11p1`, `m11p2`, `m11p3`, `m11p4` (Teilen) nennen.
  - `AGENTS.md` §2 Zeile `firestore.rules`: `weeklyTrials/{weekId}/entries/{uid}` ergänzen.
  - `HANDOFF.md`: „Cooldown ~3h 32m“ entfernen (veraltete Momentaufnahme) → „pausiert wegen Gemini-Quota“.

## C3 · Namen vereinheitlichen (Spieltexte + Doku, ein Commit, `npm run verify`)

- [x] **C3.1** „Core-Wächter“ → „Kern-Wächter“ in allen Spieltexten (kein Test hängt daran, geprüft):
  - `src/scenes/DungeonScene.ts` (~Z. 602 Toast „EBENEN-BOSS II“, ~Z. 3018 Sieges-Toast)
  - `src/dungeon/enemyAi.ts` (~Z. 1872 Phase-II-Toast)
  - `src/dungeon/dungeonRenderer.ts` (~Z. 3588 Namensschild `'CORE-WÄCHTER MK-IV'` → `'KERN-WÄCHTER MK-IV'`; Kommentar ~Z. 585)
  - `src/data/items.ts` (~Z. 239 Item-Beschreibung „Core-Wächters MK-IV“ → „Kern-Wächters MK-IV“)
  - `src/assets/sprites.ts` (~Z. 811 Kommentar)
  - Kontrolle: `grep -rn "Core-Wächter\|CORE-WÄCHTER" src *.md` → 0 Treffer (außer in diesem Plan).
- [x] **C3.2** Zuordnungstabelle in `RIGGING_GUIDE.md` (neuer Abschnitt §2.1 „Namen je Boss“) **und** kurzer Verweis in `AGENTS.md` §4 („Add a new Enemy or Boss“):
  | Boss (Spielname) | Enemy-`kind` | optionales Einzel-Sprite (`BOSS_OPTIONAL_SPRITES`) | Rig-Id (`rigs.json`) |
  | :--- | :--- | :--- | :--- |
  | Schrott-Sammler „Krall“ | `boss_breacher` | `boss_scrap_collector` | `krall` |
  | Kern-Wächter MK-IV | `boss` | — (`boss.png`) | `core_warden` |
  | A.E.G.I.S. Leviathan | `boss_leviathan` | — | (`leviathan`, geplant) |
  | Quarz-Koloss | `boss_quartz_golem` | — | (`quartz_golem`) |
  | Prisma-Weberin | `boss_prism_weaver` | — | (`prism_weaver`) |
  | ★ Prisma-Archon | `boss_prisma_archon` | — | (`prisma_archon`) |
  | Schlacken-Koloss | `boss_slag_overlord` | `boss_slag_colossus` | (`slag_colossus`) |
  | Gießerei-Meisterin | `boss_forge_warden` | `boss_forge_mistress` | (`forge_mistress`) |
  | ★ Vulkan-Titan | `boss_vulkan_titan` | — | (`vulkan_titan`) |
  | Chrono-Wächter | `boss_chrono_sentinel` | `boss_chrono_warden` | (`chrono_warden`) |
  | Monolith-Koloss | `boss_monolith_colossus` | `boss_monolith_colossus` | (`monolith_colossus`) |
  | ★ Der Sternen-Archon | `boss_star_archon` | — | (`star_archon`) |
  | 🌌 Omega-Sternen-Archon | `boss_omega_archon` | — | (`omega_archon`) |
  Vorher mit `src/dungeon/dungeonRenderer.ts` (`baseNameMap`) und `src/assets/artLoader.ts` (`BOSS_OPTIONAL_SPRITES`) gegenprüfen.

## C4 · Repo-Hygiene & Prüf-Werkzeuge (ein Commit, `npm run verify`)

- [x] **C4.1 Generierte Dateien aus dem Repo nehmen.** In `.gitignore` ergänzen:
  ```
  # Python-Cache & Prüfbilder (npm run art:check)
  __pycache__/
  *.pyc
  art_source/_check/
  ```
  Danach `git rm -r --cached scripts/__pycache__ art_source/_check` (Dateien lokal behalten). `RIGGING_GUIDE.md` §2 Zeile `art_source/_check/*_check.png` um „(nicht im Repo)“ ergänzen.
- [x] **C4.2 `scripts/check-sprites.mjs` erweitern:**
  - Zusätzlich zu `<file>_parts.png` jedes Sheet aus `rig.sheet.sets[].file` prüfen: fehlt `art_source/rigs/<file>.png` → Hinweis „Pose-Set-Sheet fehlt“. (Achtung: die Sets in `rigs.json` enthalten nur **vorhandene** Sheets; geplante wie `krall_legs_R` stehen dort noch nicht. Deshalb zusätzlich eine kleine Liste `PLANNED_SHEETS` oben im Skript: `krall_legs_R`, `krall_legs_L`, `krall_effects`, `core_warden_arms_R3`, `core_warden_arms_L3` — mit Verweis auf `ART_BRIEF_M11.md` §4.1 bzw. `BOSS_ANIMATION_PLAN.md` §2.3 S6.)
  - „Veraltet“-Erkennung: `public/art/rigs/<id>/import.json` enthält `sheets` (Hashes). Wenn sich der SHA eines Quell-Sheets geändert hat → „Sheet geändert, neu importieren: `npm run art:import -- <id> --force`“. Hash-Format vorher in `scripts/art-import.py` nachsehen (`hashlib`), identisch berechnen (`node:crypto`).
  - Hinweiszeile am Ende: „→ Prompts: ART_AND_DESIGN_GUIDE.md §7 (Promenade) · §8 (Boss-Sprites)“ statt nur „§7“.
  - Exit-Code bleibt 0 (nur Hinweis), `--strict` wie bisher.
  - Test `tests/m10cp0.cjs` prüft `check:sprites` — nach der Änderung laufen lassen und ggf. erwartete Ausgabe anpassen.

## C5 · Toter Code & doppelte Typen (ein Commit, `npm run verify`)

Vor jedem Löschen mit `grep -rn "<Name>" src tests scripts` bestätigen, dass es nur die Definition gibt (Stand Audit: ja).
- [ ] **C5.1** Löschen: `generateSector1Dungeon` (`src/world/dungeonGen.ts`, Dateiende), `getReactionMeta` (`src/systems/economy.ts` ~Z. 148), `hasBossLook` (`src/dungeon/bosses/bossLooks.ts` ~Z. 47), `NO_MOTION` (`src/dungeon/anim/motion.ts`), `Vec2` (`src/types.ts`, falls wirklich unbenutzt).
- [ ] **C5.2** `src/assets/sprites.ts`: Felder `itemDataUrls` und `tiles` aus `SpriteAtlas` und `getAtlas()` entfernen (werden nirgends gelesen; `itemDataUrls` ruft beim Start für jedes Item `toDataURL()` auf = unnötige Ladezeit). Danach `createTiles()` löschen, falls nur dort benutzt (`noUnusedLocals` meldet es).
- [ ] **C5.3** Gemeinsamer Typ für Gegnerarten: Die 36-teilige Union steht doppelt in `EnemySpawn.kind` (`src/world/dungeonGen.ts` ~Z. 99) und `Enemy.kind` (`src/dungeon/dungeonTypes.ts` ~Z. 92), Inhalt identisch (geprüft). Vorgehen: in `src/world/dungeonGen.ts` `export type EnemyKind = | 'slime' | …` definieren, `EnemySpawn.kind: EnemyKind`; in `dungeonTypes.ts` `import type { EnemyKind } from '../world/dungeonGen'` und `Enemy.kind: EnemyKind`. (Auf Import-Zyklen achten: `dungeonTypes.ts` importiert evtl. schon aus `dungeonGen` — dann ist das ok, da `import type`.) AGENTS.md §4 „Add a new Enemy or Boss“ Punkt 2 entsprechend: „kind zu `EnemyKind` in `src/world/dungeonGen.ts` hinzufügen“.
- [ ] **C5.4** `src/engine/input.ts` Kommentar über `btnMap`: „LT(6)=Warp“ entfernen, Belegung = tatsächliche Liste (A/RT Angriff, B Spezial/Schild, X Dash, Y Interagieren, LB Heilen, RB Wechseln, Select Fracht, Start ESC).
- [ ] **C5.5** `src/data/rigs.ts` Interface `RigJson.sheet` um die tatsächlich vorhandenen Felder ergänzen (nur Typen, keine Logik): `cols?: number; rows?: number; scaleRef?: string; torsoDisplayH?: number; sets?: { file: string; mode: 'limb' | 'swap'; ids: string[]; cells?: number[] }[]`. Felder vorher in `src/data/rigs.json` und `scripts/art-import.py` abgleichen.

## C6 · Optional / später (nur nach Rücksprache mit dem Projektinhaber)

- [ ] **C6.1** `scripts/art-import.py`: Pose-Sheet-Pfad `import_poses` + Scan von `art_source/poses/` entfernen (Spiel lädt `public/art/poses/` nirgends). Erst sinnvoll, wenn der Import-Modus `parts` für Typ G (Gegner-Rigs) gebaut wird — dann gleich dort ersetzen.
- [ ] **C6.2** `vite.single.config.ts` (Einzeldatei-Build nach `dist-single/`): nirgends dokumentiert, kein npm-Skript, nutzt noch `rollupOptions` statt Vite-8-`rolldownOptions`. Projektinhaber fragen: löschen (inkl. `dist-single` in `.gitignore`) **oder** als `npm run build:single` dokumentieren und auf `rolldownOptions` umstellen.
- [ ] **C6.3** Firebase (~574 kB) lädt beim Start mit (Build-Warnung „chunks larger than 500 kB“). Später: `firebaseService` per `import()` nachladen. Größerer Umbau (5 Importstellen: `main.ts`, `gameState.ts`, `ShopScene.ts`, `UIManager.ts`, `NetworkModals.ts` — `formatDurationSec`/`formatRelativeTime` vorher in ein eigenes kleines Modul ohne Firebase auslagern). Nicht mit Sonnet-mittel nebenbei machen.
- [ ] **C6.4** `package.json` `"version": "0.0.0"` → `"1.4.0"` (kosmetisch, passt zu README/AGENTS).

---

## Abschluss
1. Alle Haken gesetzt → `npm run verify` grün, Screenshots in `tests/out/` kurz ansehen (Namensschild „KERN-WÄCHTER MK-IV“).
2. `HANDOFF.md`: Abschnitt „Stand“ um „Doku-Aufräumen (`CLEANUP_PLAN.md`) erledigt“ ergänzen, Verweis auf diese Datei entfernen, Datei löschen.
