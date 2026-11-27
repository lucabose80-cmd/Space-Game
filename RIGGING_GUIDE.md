# RIGGING_GUIDE.md — Cut-out-Rigs, Pose-Sets & Boss-Posen (M11)

> **Zweck:** Alles, was beim „Riggen“ der Bosse gemacht wurde und wie man es **ohne Claude Code** (z. B. in Antigravity) weiterführt: neue Sheets einbinden, Gelenke feinjustieren, Posen verdrahten, prüfen, pushen.
> Plan/Hintergrund: `MILESTONE_11_ARCHITECTURE.md` · Sprite-Aufträge: `ART_BRIEF_M11.md` · Stand/Offenes: `HANDOFF.md`.

---

> **Sieht eine Pose mit den vorhandenen Bildern nicht gut aus oder gefällt sie dem Projektinhaber nicht → neues/ersetzendes Sheet in `SPRITE_QUEUE.md` bestellen** statt Einzelbilder per Code zu drehen/strecken (`AGENTS.md` Regel 14, `SPRITE_QUEUE.md` §0). Credits sind kein Grund dagegen.

## 1. Idee in 30 Sekunden
Ein Boss besteht nicht mehr aus **einem** Bild, sondern aus **Teilen** (Rumpf, Kopf, Arme, Beine …), die der Code pro Frame zusammensetzt (`src/engine/rig.ts`). Jedes Teil hat ein **Gelenk** (Pivot) und hängt an einem Elternteil. Zwei Arten von Bewegung:
1. **Drehen/Verschieben** (prozedural): Atmen, Pendeln, Beinschritte — `rot`, `dx`, `dy`, `sx`, `sy`.
2. **Pose tauschen** (`variant`): Ein Teil hat 6 fertig gezeichnete Bilder (**Pose-Set**: Arm hängend / Ausholen / Schlag zur Kamera / Laser / Block / Stampfer; Kopf neutral / brüllend / …; Rumpf normal / geduckt / …). Der Code wählt je Boss-Zustand den Index. Alle Bilder eines Sets sind **gleich groß** und haben das Gelenk **exakt in der Bildmitte** → sie passen deckungsgleich aufeinander.

Wenn ein Rig fehlt oder ein Bild nicht lädt, wird automatisch das alte Einzelbild-Sprite verwendet (kein Absturz).

## 2. Dateien (wo liegt was)
| Datei | Inhalt |
| :--- | :--- |
| `art_source/rigs/<boss>_parts.png` | Typ P: Einzelteile (Rumpf, Platten …), 3×2, 1536×1024 |
| `art_source/rigs/<boss>_arms_L/R.png`, `_heads.png`, `_torsos.png`, (`_legs_*`, `_effects`) | Pose-Set-Sheets (Typ L/S), 3×2, **512×512 pro Zelle, Gelenk = Zellmitte** |
| `art_source/_check/*_check.png` | Prüfbilder von `npm run art:check` (nicht im Repo, `.gitignore`) |
| `scripts/art-import.py` | zerschneidet Sheets → `public/art/rigs/<rig>/*.png` (+ `import.json`) |
| `scripts/art-check.py` | Prüfbild mit Fadenkreuz in der Zellmitte, Randwarnung |
| `scripts/rig-sheet.cjs` | Kontaktbogen: Rig in vielen Boss-Zuständen → `tests/out/rig_<id>.png` |
| `src/data/rigs/<rig-id>.json` | **die Rig-Definition**: Sheet-Layout, Sets, Teile-Baum (Daten, kein Code) |
| `src/data/rigs.ts` | lädt `rigs.json`, `RIG_BY_KIND` (Gegnerart → Rig), `rigImageNames` |
| `src/engine/rig.ts` | `layoutRig`/`drawRig`/`blendPose`, Typen `RigPartDef`, `PartPose` |
| `src/dungeon/anim/bossAnims.ts` | **Animations-Engine** (`getBossPose`: Glättung, Stauch-Impuls, Zwischen-Posen; findet `anim/rigs/*.ts` automatisch) |
| `src/dungeon/anim/rigs/<rig-id>.ts` | **Posen je Boss-/Gegner-Zustand** (`export const anim: RigAnim` — `coreWardenSet`/`SHOULDER_ADJUST` in `core_warden.ts`, `krallSet` in `krall.ts`, `turretPose` in `turret.ts`); Schnittstelle `anim/rigAnim.ts`, Hilfen `anim/animCommon.ts` |
| `src/dungeon/dungeonRenderer.ts` (`tryDrawRig`) | zeichnet das Rig statt des Einzelbilds |
| `src/assets/artLoader.ts` | lädt alle Teile-Bilder (+ Flash-Silhouetten); fehlt eins → Rig = `null` |
| `src/dev/bossLab.ts` | Boss-Labor `?bosslab` (Zustände ansehen, Pause, „Phase II“, Rig an/aus) |
| `src/dungeon/anim/detached.ts` | abgelöste Teile (Phase-2-Verwandlung) |
| `tests/m11p0.cjs` … `m11p4.cjs` | Tests Import-Pipeline / Rig-Engine / Pose-Sets / abgelöste Teile / Teilen |

### 2.1 Namen je Boss (Spielname ↔ Code)
Die `kind`-Namen im Code **nicht umbenennen** (Tests, Balancing, Rigs, Seeds hängen daran). Geplante Rig-Ids stehen in Klammern.

| Boss (Spielname) | Enemy-`kind` | optionales Einzel-Sprite (`BOSS_OPTIONAL_SPRITES`) | Rig-Id (`rigs.json`) |
| :--- | :--- | :--- | :--- |
| Schrott-Sammler „Krall“ | `boss_breacher` | `boss_scrap_collector` | `krall` |
| Kern-Wächter MK-IV | `boss` | — (`boss.png`) | `core_warden` |
| A.E.G.I.S. Leviathan | `boss_leviathan` | — | (`leviathan`) |
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

## 3. `rigs.json` verstehen
```jsonc
"core_warden": {
  "kind": "boss",                       // Enemy-kind, der dieses Rig benutzt
  "sheet": {
    "file": "core_warden", "cols": 3, "rows": 2,
    "order": ["torso","head","arm","fist","plateL","plateR"],   // Typ-P-Teile, Zelle für Zelle
    "scaleRef": "torso", "torsoDisplayH": 30, "pixelRatio": 2, // Maßstab: Referenzteil wird 30 Spiel-px hoch
    "sets": [                           // Pose-Sets (M11 v2)
      { "file": "core_warden_arms_R", "mode": "limb", "ids": ["armR_1", … "armR_6"] }
    ]
  },
  "parts": [                            // der Baum, z = Zeichenreihenfolge (klein = hinten)
    { "id": "armR", "image": "armR_1", "variants": ["armR_1", … "armR_6"],
      "parent": "torso", "attach": [0.5,0.5], "offset": [10.2,-6.2],   // Gelenk am Elternteil: Bruchteil + Pixel
      "pivot": [0.5,0.5], "z": 1 }, …
```
- **Koordinaten:** Rig-Ursprung = Fußpunkt. `pivot` = Gelenk im eigenen Bild (0…1). `attach` = Anheftpunkt im **Elternbild** (0…1), `offset` = zusätzliche Spielpixel. Wurzelteil: `offset` vom Fußpunkt (Rumpf: `[0,-18]` → Kern ≈ 18 px über dem Boden).
- **`pixelRatio: 2`:** Bilder liegen in Bildschirmauflösung vor (RENDER_SCALE), `rig.ts` teilt wieder durch 2. **Maße in `offset`/`dx`/`dy` sind immer Spielpixel** (480×270-Welt).
- **Pose-Sets:** `variants` = Liste der Bildnamen, `image` = Variante 0. `PartPose.variant` wählt den Index. **Pose-Set-Teile haben `pivot [0.5,0.5]`** — das Gelenk ist die Bildmitte.
- **Scaling:** Sets benutzen den Maßstab des Rigs (aus dem Teile-Sheet). Der Krall-Maßstab ist kleiner als der des Kern-Wächters → Krall-Teile wirken kleiner; will man sie größer, `torsoDisplayH` erhöhen (verändert **alle** Teile des Rigs).

## 4. Neues Pose-Set-Sheet einbinden (Schritt für Schritt)
1. Sheet nach `art_source/rigs/<name>.png` legen (1536×1024, 3×2, **Gelenk/Kern in der Zellmitte**, weißer Hintergrund `#FFFFFF`, ≥ 30 px Rand).
2. `npm run art:check -- art_source/rigs/<name>.png` → Prüfbild ansehen: **Gelenk im roten Fadenkreuz?** Nichts am Zellrand (⚠)? Sonst Pose per PIL verschieben (nicht skalieren) und neu speichern.
3. In `rigs.json` unter `sheet.sets` eintragen: `{ "file": "<name>", "mode": "limb"|"swap", "ids": ["x_1",…,"x_6"] }`.
4. Beim Teil `image: "x_1"`, `variants: [...]`, `pivot: [0.5,0.5]` setzen (oder neues Teil anlegen, mit `parent`/`attach`/`offset`/`z`).
5. `npm run art:import -- <rig-id> --force` → `public/art/rigs/<rig-id>/x_1…x_6.png`. Alle Bilder eines Sets müssen gleich groß sein (Test `m11p2`).
6. Posen in `anim/rigs/<rig-id>.ts` verdrahten (§5), prüfen (§6), pushen (§7).

`mode`: `limb` (Arm/Bein) und `swap` (Kopf/Rumpf) unterscheiden sich im Import nicht — nur zur Dokumentation. Alt-Teile (`arm.png`, `fist.png`, …) bleiben im Sheet `order`, werden aber nicht mehr benutzt; sie schaden nicht.

## 5. Posen verdrahten (`anim/rigs/<rig-id>.ts`)
`getBossPose(rigId, enemy, time)` liefert pro Frame `{ teilId: { variant, rot, dx, dy, sx, sy, alpha, hidden } }`.
- **Kern-Wächter** — vollständige Varianten-Karte (Arme je Seite 0–12, Köpfe 0–11, Rümpfe 0–11, Fäuste als Bilder) und alle Zustands→Pose-Zuordnungen: `BOSS_ANIMATION_PLAN.md` §2.1 und `coreWardenSet()` in `bossAnims.ts`. Der Index entspricht der Reihenfolge in `variants` (`rigs.json`); neue Varianten **hinten anhängen**, nie einfügen.
- **Brustplatten** (`plateL/R`, Typ P): immer `hidden`; erst beim Phase-2-Wechsel löst `detached.ts` sie ab und lässt sie wegfliegen (siehe unten). Die Laser-Brust öffnet sich über die Rumpf-Varianten 6/7/10 (kein Platten-Aufklappen — verdeckte den Kern).
- **Krall** — `krallSet()`: Arme `clawR`/`clawL` und Rumpf-Variante nach `bossSub` (`idle/windup/active/recover`) und `bossStatusText` (= Zugname aus `bosses/defs.ts`: GREIFARM-STOSS, MAGNET-ZUG, SCHROTT-WURF, SCHROTT-HAGEL), Phase 2 = Skelett-Rumpf (Haltung dort über `fx`), < 25 % HP beschädigt; Anlauf/Nachfedern/Gehen/Treffer im `fx`-Block. Tabelle: `BOSS_ANIMATION_PLAN.md` §3. Gegen mechanisches Zappeln: Schrittphase aus Strecke (`stridePhase`), `KRALL_TAU`, `VARIANT_LAG` (Arm L folgt R), `CLAW_BETWEEN` (Zwischen-Posen). Vorsicht: die Boss-Engine setzt `bossStateMax` nur für die Vorwarnung — Erholungsdauer je Zug in `KRALL_RECOVER` pflegen.
  - **Krall — Varianten-Tabelle (Stand P0-14…20, alles eingebunden):** *Rumpf* `torso` 0–5 Panzer-Posen/Phase-2-Rahmen alt/beschädigt alt · 6–11 Phase-2-Rahmen je Haltung (`KT2`: geduckt · aufgerichtet · gebeugt · Stampfer · Wurf-Drehung · überhitzt) · 12–17 Beschädigungsstufen (`KT3`: P1 <80/<65/<25 %, P2 <35/<25/<15 %). *Arme* `clawR/L` 0–5 Original · 6–11 Angriffsposen (Teleskop kurz/mittel/voll · Zuschnappen · Sog · Halten) · 12–17 beschädigt hängend/ausholend/Stoß (verbogen · Stumpf) · 18–23 verbogen in seitlich/Block/Stampfer/Sog/Halten/Teleskop voll · 24–29 Stumpf in denselben Posen. Auswahl `damagedArm()` (Zange R verbogen <65 %/Stumpf <35 %, Haken L <50 %/<20 %); Übergang intakt↔beschädigt über `dmgBetween()` (ausholende Pose, D3). *Beine* 0–5 Original · 6–11 `KLEG2` (Ausfall · Bremsen · Landung · humpelnd · Magnet-Stemmen · Ruhe-Zittern). *Effekte* `fx_wave/arc/field/rust` (Körper) und Boden-Effekte je Biom `gc_1…5` (Krater) / `gd_1…5` (Druckring) mit Biom-Wahl in `bossFx.ts` (`groundBiome`: Riss-Kammer `riftSector` → Spirale `floor.visualSector` → `currentSector`), Rückfall `fx_crater`/`fx_dust`. Fehlt ein Varianten-Bild, zeigt das Teil sein Basisbild (`layoutRig`, D9). Tests: `m11p5_krall`.
- **Neuer Boss:** Rig in `rigs.json` anlegen (`kind` = Enemy-kind), neue Datei `src/dungeon/anim/rigs/<rig-id>.ts` mit `export const anim: RigAnim = { rawPose, tau?, noPulse?, lag?, between?, facing? }` anlegen (wird automatisch registriert; Vorlage `rigs/turret.ts`). Kein Eingriff in gemeinsame Dateien nötig. Die **Spiellogik** (Zustände, Schaden, Telegraph) bleibt in `enemyAi.ts` bzw. `bosses/defs.ts` — `bossAnims.ts` liest sie nur.

### Glättung, Impuls, Zusatzbewegung (Engine `bossAnims.ts`; je Rig über `tau`/`noPulse`/`lag`/`between` in `anim`)
`getBossPose` liefert **geglättete** Posen: `rawBossPose` berechnet das Ziel, `smoothPose` nähert Drehung/Lage/Skalierung exponentiell an (`SMOOTH_TAU`), `variant`-Wechsel bleiben hart, bekommen aber einen kurzen Stauch-Impuls (`PULSE_TIME`). Zustand je Boss in einer `WeakMap` (nur `time`, kein `Date.now`). Zustandsabhängige Zusatzbewegung (Anlauf, Nachfedern, Gehen, Treffer) steht im `fx`-Block von `coreWardenSet`. `smoothBossBody` (Renderer) führt das Ganzkörper-Stauchen/Neigen weich nach. Bilder ohne eigenes Teil (z. B. kreisende Fäuste) über `extraImages` in `rigs.json` laden. Mehrere Sets aus **einem** Sheet (unterschiedlich große Teile) per `"cells": [..]` im Set-Eintrag trennen (z. B. `core_warden_fists`: Zellen 0–1 Arme ohne Faust, 2–5 Fäuste). Zwischen-Posen/Blinzeln/Blick: `ARM_BETWEEN`, `NO_PULSE`, `coreWardenSet(…, lookDx)` — `getBossPose` nimmt optional die Spieler-Blickrichtung (`playerX − e.x`).

### Mehrere Sets pro Teil, `cells`, `extraImages`
Ein Teil darf Varianten aus **mehreren Sheets** mischen (`variants` = Liste von Bildnamen; jedes Set hat nach dem Import seine eigene Größe, das Gelenk liegt immer in der Bildmitte → passt trotzdem). Unterschiedlich große Teile eines Sheets mit `"cells": [..]` in getrennte Sets teilen (z. B. `core_warden_fists`: Zellen 0–1 → `armR_nf`/`armL_nf`, 2–5 → Fäuste). **Zellen-Reihenfolge prüfen:** Antigravity hatte bei den Armen ohne Faust links/rechts vertauscht — Abgleich per Alpha-Maske mit `armR_1`/`armL_1` (IoU) im Import-Ergebnis. Bilder ohne eigenes Teil (Fäuste, Schweif) über `extraImages` laden.

### Zwischen-Posen, Blick, Blinzeln
`ARM_BETWEEN` (hängend↔ausholen↔Schlag, 0,08 s), `NO_PULSE` (Kopf-Wechsel ohne Stauch-Impuls), Blick links/rechts über den optionalen Parameter `lookDx` von `getBossPose` (Renderer übergibt `playerX − e.x`), Blinzeln deterministisch aus `time + e.id`.

### Optik mit Spielbezug (Kern-Wächter Phase 2 „Faust-Salve“)
In `pylon_barrage` der Phase 2 (`enemyAi.updateBossAI`) fliegen die 4 Orbit-Fäuste **einmal** als `Projectile` mit `sprite: 'fist'`, `homing: 2.0`, `homingUntilLife: 0.5` (Lenkung in `DungeonScene.updateProjectiles`), Schaden 16, Radius 6, `life` 1,9 s; danach Funkenregen. Der Renderer (`drawBossPylon`, `fistReturnScale`) leert den Orbit, solange Fäuste fliegen, und lässt sie in 0,5 s nachwachsen. Phase 1 schießt unverändert Energie-Schüsse. Balance-Werte stehen direkt in der KI-Zeile (nicht in `balance.ts`).

### Teilen (Quarz-Koloss, Sternen-Archon) — Logik ohne Sprites
`DungeonScene.splitBoss(e)` (Aufruf aus `updateQuartzGolemAI` bzw. `BossDef.onPhase2` des Archons) klont den Boss in zwei Hälften (`Enemy.splitGroup`/`splitRole`), `syncSplitPools()` gleicht HP an, schiebt die Hälften auseinander und vereint sie bei ≤ 15 % HP; `onEnemyKilled` belohnt nur einmal. Rollen: Quarz A Beben / B Salve; Archon `BossDef.splitMoves` (A Sternbild+Brunnen, B Supernova). Renderer zeichnet Hälften mit 85 % (`withSplitScale`). Test `m11p4`.

### Schulter-Feinjustierung
Der Rumpf neigt sich je Pose; die Arme hängen aber an einem festen Punkt (`offset` im Teil `armL/armR`). Ausgleich: `SHOULDER_ADJUST[rumpfVariante] = [L dx, L dy, R dx, R dy]` (Spielpixel) in `bossAnims.ts`. Aktuell: geduckt `[0.5,0.5,-3,1]`, zurückgelehnt `[0,1,-3,0.5]`, übrige (inkl. der neuen Rümpfe 6–11) `0` — bei Auffälligkeiten im Labor dort nachziehen. **Vorgehen:** Kontaktbogen rendern (§6), schauen, ob die Schulterkappe am Rumpf klebt oder schwebt → Wert ändern, neu rendern. Grundposition der Schultern: `offset` der Teile `armL`/`armR` in `rigs.json` (aus Rumpf-Variante 1 gemessen: ±10 px seitlich, −6,2 px über dem Kern); Kopf: `offset [0,-9.5]` (Halsgelenk im Kragen).

### Normale Gegner
Prozedurale Code-Beine wurden **verworfen** (passten nicht zum Pixel-Art-Stil, doppelten vorhandene Beine). Normale Gegner bekommen stattdessen eigene Rigs aus **Teile-Sheets (Typ G)** — Aufträge, Zellen und Gelenke: [`ART_BRIEF_M11_ENEMIES.md`](ART_BRIEF_M11_ENEMIES.md). Bis dahin: Einzel-Sprite + dezentes Atmen/Lehnen/Zucken (`anim/motion.ts`).

### Abgelöste Teile / Phase-2-Verwandlung (`src/dungeon/anim/detached.ts`)
Teil in `rigs.json` mit `"detach": "phase2"` markieren. Beim ersten Frame mit `bossPhase2` (einmalig, `Enemy.rigDetached`) löst `tryDrawRig` es ab: Bogenflug, ein Aufprall, ~1,7 s ausblenden (`scene.detached`, Update in `DungeonScene`). Danach liefert `getBossPose` das Teil als `hidden`. Aktuell: Kern-Wächter-Brustplatten (`plateL/R`), Krall-Rückenpanzer (`plate`). Rein visuell, kein Schaden.

## 6. Prüfen (ohne Claude)
```bash
npm install && npx playwright install chromium     # einmalig
npm run dev -- --host 127.0.0.1 --port 5199 --strictPort   # Terminal 1
node scripts/rig-sheet.cjs core_warden 5199          # Terminal 2 → tests/out/rig_core_warden.png (auch: krall)
```
Bild mit `view_file` ansehen: sitzen die Gelenke, stimmt die Pose zum Zustand, fliegen die Platten? Danach im echten Spiel: `…/?bosslab` → Boss wählen, **⏸ Pause**, „Phase II“, „Rig“ an/aus (Boss-Labor ändert den Spielstand nicht).
Automatisch: `npm test -- m11p1 m11p2 m11p3 m11p4` (Rig-Engine · Pose-Sets/Übergänge · abgelöste Teile · Teilen) und vor jedem Push `npm run verify`. `tests/m11lab.cjs` (Boss-Labor) wird von `npm test` nicht automatisch erfasst. Der Kontaktbogen `scripts/rig-sheet.cjs` hat Fälle für Kern-Wächter (25 Zustände) und Krall; neue Zustände dort in `CASES` ergänzen.

**Typische Stolpersteine**
- *Rig erscheint nicht* → ein Bild fehlt/Tippfehler im Namen (`rigImageNames` muss alle laden) → Konsole/`public/art/rigs/<rig>/` prüfen.
- *Pose „springt“ in der Größe* → Set-Bilder nicht gleich groß → neu importieren (`--force`).
- *Gelenk wandert zwischen Posen* → in der Quell-Zelle liegt das Gelenk nicht in der Mitte → Sheet korrigieren (§4 Schritt 2).
- *Dev-Server zeigt altes Rig nach JSON-Änderung* → Vite neu starten. Das gilt auch für `scripts/rig-sheet.cjs`: nach HMR-Reload (Änderung an `rigs.json`/`bossAnims.ts`) liefert der Kontaktbogen u. U. **leere Zellen** (zweite Modulinstanz ohne Bilder) — Dev-Server neu starten, dann erneut rendern.
- *Torso-Wechsel verschiebt Beine/Arme* → bei einem Rumpf-Set (Pivot = Kern, `[0.5,0.5]`) hängen Kinder mit `attach [0.5,0.5]` + `offset` in Spielpixeln **relativ zum Kern**, nicht mehr als Bruchteil des Rumpfbilds (Krall).

## 7. Abschluss (Pflicht, siehe `AGENTS.md` §3 Regel 6/8)
`npm run verify` grün → Screenshots/Kontaktbogen angesehen → `HANDOFF.md` aktualisieren → committen & pushen (Commit-Präfix `art(m11):` für Sheets, `feat(m11):` für Code).

## 8. Offene Arbeit
**Konkrete Aufgabenliste & Fertig-Definition:** [`BOSS_ANIMATION_PLAN.md`](BOSS_ANIMATION_PLAN.md). Stand: Kern-Wächter K1–K8 + S1–S5 eingebunden, offen S6 (Arme ohne Faust in Angriffsposen) und Abnahme im echten Kampf. Krall: Arme L/R + Rumpf-Set (6) eingebunden, Zuordnung nach Zug/Phase fertig; offen `krall_legs_R/L.png` + `krall_effects.png` (Antigravity) und Abnahme.
Weiter laut `HANDOFF.md` („Nächster Schritt“): übrige Bosse (`ART_BRIEF_M11.md` §4.3) und Gegner-Rigs (`ART_BRIEF_M11_ENEMIES.md`).
