# RIGGING_GUIDE.md — Cut-out-Rigs, Pose-Sets & Boss-Posen (M11)

> **Zweck:** Alles, was beim „Riggen“ der Bosse gemacht wurde und wie man es **ohne Claude Code** (z. B. in Antigravity) weiterführt: neue Sheets einbinden, Gelenke feinjustieren, Posen verdrahten, prüfen, pushen.
> Plan/Hintergrund: `MILESTONE_11_ARCHITECTURE.md` · Sprite-Aufträge: `ART_BRIEF_M11.md` · Stand/Offenes: `HANDOFF.md`.

---

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
| `art_source/_check/*_check.png` | Prüfbilder von `npm run art:check` |
| `scripts/art-import.py` | zerschneidet Sheets → `public/art/rigs/<rig>/*.png` (+ `import.json`) |
| `scripts/art-check.py` | Prüfbild mit Fadenkreuz in der Zellmitte, Randwarnung |
| `scripts/rig-sheet.cjs` | Kontaktbogen: Rig in vielen Boss-Zuständen → `tests/out/rig_<id>.png` |
| `src/data/rigs.json` | **die Rig-Definition**: Sheet-Layout, Sets, Teile-Baum (Daten, kein Code) |
| `src/data/rigs.ts` | lädt `rigs.json`, `RIG_BY_KIND` (Gegnerart → Rig), `rigImageNames` |
| `src/engine/rig.ts` | `layoutRig`/`drawRig`/`blendPose`, Typen `RigPartDef`, `PartPose` |
| `src/dungeon/anim/bossAnims.ts` | **Posen je Boss-Zustand** (`getBossPose`, `coreWardenSet`, `krallClaw`, `SHOULDER_ADJUST`) |
| `src/dungeon/dungeonRenderer.ts` (`tryDrawRig`) | zeichnet das Rig statt des Einzelbilds |
| `src/assets/artLoader.ts` | lädt alle Teile-Bilder (+ Flash-Silhouetten); fehlt eins → Rig = `null` |
| `src/dev/bossLab.ts` | Boss-Labor `?bosslab` (Zustände ansehen, Pause, „Phase II“, Rig an/aus) |
| `src/dungeon/anim/detached.ts` | abgelöste Teile (Phase-2-Verwandlung) |
| `tests/m11p1.cjs`, `m11p2.cjs`, `m11p3.cjs` | Tests Rig-Engine / Pose-Sets / abgelöste Teile |

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
6. Posen in `bossAnims.ts` verdrahten (§5), prüfen (§6), pushen (§7).

`mode`: `limb` (Arm/Bein) und `swap` (Kopf/Rumpf) unterscheiden sich im Import nicht — nur zur Dokumentation. Alt-Teile (`arm.png`, `fist.png`, …) bleiben im Sheet `order`, werden aber nicht mehr benutzt; sie schaden nicht.

## 5. Posen verdrahten (`bossAnims.ts`)
`getBossPose(rigId, enemy, time)` liefert pro Frame `{ teilId: { variant, rot, dx, dy, sx, sy, alpha, hidden } }`.
- **Kern-Wächter** — Indizes: Arme `0 hängend · 1 Ausholen · 2 Schlag zur Kamera · 3 seitlich/Laser · 4 Block · 5 Boden-Stampfer`; Köpfe `0 neutral · 1 brüllend · 2 zielend · 3 getroffen · 4 Phase 2 · 5 beschädigt`; Rümpfe `0 normal · 1 geduckt · 2 zurück · 3 vor · 4 Phase 2 offen · 5 überhitzt`. Zuordnung in `coreWardenSet()` nach `enemy.bossState` (`stalk`, `charge_windup`, `charge_dash`, `slam_air/jump/impact`, `laser_windup/sweep`, `pylon_barrage`, `phase2_roar`, `stunned`) und `bossPhase2`/`flashTimer`.
- **Brustplatten** (`plateL/R`, Typ P): `hidden`, außer während `phase2_roar` — Fortschritt `r = 1 − bossStateTimer/bossStateMax` steuert Flug (`dx`, `dy` Bogen, `rot`) und Ausblenden (`alpha`).
- **Krall** — `krallClaw()`: Zange nach `bossSub` (`idle/windup/active/recover`) und `bossStatusText` (= Zugname aus `bosses/defs.ts`: GREIFARM-STOSS, MAGNET-ZUG, SCHROTT-WURF, SCHROTT-HAGEL).
- **Neuer Boss:** Rig in `rigs.json` anlegen (`kind` = Enemy-kind), `case '<rig-id>'` in `getBossPose` ergänzen. Die **Spiellogik** (Zustände, Schaden, Telegraph) bleibt in `enemyAi.ts` bzw. `bosses/defs.ts` — `bossAnims.ts` liest sie nur.

### Glättung, Impuls, Zusatzbewegung (`bossAnims.ts`)
`getBossPose` liefert **geglättete** Posen: `rawBossPose` berechnet das Ziel, `smoothPose` nähert Drehung/Lage/Skalierung exponentiell an (`SMOOTH_TAU`), `variant`-Wechsel bleiben hart, bekommen aber einen kurzen Stauch-Impuls (`PULSE_TIME`). Zustand je Boss in einer `WeakMap` (nur `time`, kein `Date.now`). Zustandsabhängige Zusatzbewegung (Anlauf, Nachfedern, Gehen, Treffer) steht im `fx`-Block von `coreWardenSet`. `smoothBossBody` (Renderer) führt das Ganzkörper-Stauchen/Neigen weich nach. Bilder ohne eigenes Teil (z. B. kreisende Fäuste) über `extraImages` in `rigs.json` laden.

### Schulter-Feinjustierung
Der Rumpf neigt sich je Pose; die Arme hängen aber an einem festen Punkt (`offset` im Teil `armL/armR`). Ausgleich: `SHOULDER_ADJUST[rumpfVariante] = [L dx, L dy, R dx, R dy]` (Spielpixel) in `bossAnims.ts`. Aktuell: geduckt `[0.5,0.5,-3,1]`, zurückgelehnt `[0,1,-3,0.5]`, übrige `0`. **Vorgehen:** Kontaktbogen rendern (§6), schauen, ob die Schulterkappe am Rumpf klebt oder schwebt → Wert ändern, neu rendern. Grundposition der Schultern: `offset` der Teile `armL`/`armR` in `rigs.json` (aus Rumpf-Variante 1 gemessen: ±10 px seitlich, −6,2 px über dem Kern); Kopf: `offset [0,-9.5]` (Halsgelenk im Kragen).

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
Automatisch: `npm test -- m11p1 m11p2 m11p3` und vor jedem Push `npm run verify`.

**Typische Stolpersteine**
- *Rig erscheint nicht* → ein Bild fehlt/Tippfehler im Namen (`rigImageNames` muss alle laden) → Konsole/`public/art/rigs/<rig>/` prüfen.
- *Pose „springt“ in der Größe* → Set-Bilder nicht gleich groß → neu importieren (`--force`).
- *Gelenk wandert zwischen Posen* → in der Quell-Zelle liegt das Gelenk nicht in der Mitte → Sheet korrigieren (§4 Schritt 2).
- *Dev-Server zeigt altes Rig nach JSON-Änderung* → Vite neu starten.

## 7. Abschluss (Pflicht, siehe `AGENTS.md` §3 Regel 6/8)
`npm run verify` grün → Screenshots/Kontaktbogen angesehen → `HANDOFF.md` aktualisieren → committen & pushen (Commit-Präfix `art(m11):` für Sheets, `feat(m11):` für Code).

## 8. Offene Arbeit
**Konkrete Aufgabenliste & Fertig-Definition:** [`BOSS_ANIMATION_PLAN.md`](BOSS_ANIMATION_PLAN.md).
Siehe `HANDOFF.md` („Nächster Schritt“): restliche Krall-Sheets (`krall_arms_L`, `krall_legs_R/L`, `krall_torsos`, `krall_effects`) einbinden (linker Arm als neues Teil `clawL`, Beine/Rumpf als Sets), danach die übrigen Bosse (`ART_BRIEF_M11.md` §4.3) und die Teil-Abwurf-/Splitting-Mechaniken (`MILESTONE_11_ARCHITECTURE.md`).
