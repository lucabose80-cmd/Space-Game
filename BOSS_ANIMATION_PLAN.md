# BOSS_ANIMATION_PLAN.md — Was ein Boss-Rig „fertig“ macht + offene Aufgaben (M11)

> **Zweck:** Eine Arbeitsliste, die jedes Werkzeug (Claude Sonnet/Opus, Antigravity) ohne Vorwissen abarbeiten kann.
> §1 ist die **Fertig-Definition für jeden Boss** (auch künftige). §2 ist der **konkrete Plan für den Kern-Wächter** (Pilot). §3 sagt, wie man die Liste auf andere Bosse überträgt.
> Grundlagen: [`RIGGING_GUIDE.md`](RIGGING_GUIDE.md) (Technik, Dateien, Prüfwerkzeuge) · [`ART_BRIEF_M11.md`](ART_BRIEF_M11.md) (Sprite-Formate) · [`MILESTONE_11_ARCHITECTURE.md`](MILESTONE_11_ARCHITECTURE.md) (Gesamtplan).
> **Arbeitsweise:** Eine Aufgabe = ein Commit. Nach jeder Code-Aufgabe: `node scripts/rig-sheet.cjs <rig>` (Kontaktbogen) **und** im `?bosslab` in Bewegung ansehen (0,25× + Pause), `npm run verify`, Haken in §2 setzen, `HANDOFF.md` kurz aktualisieren.

---

## 1. Fertig-Definition für ein Boss-Rig (Checkliste für jeden Boss)
Ein Boss gilt erst als **„Animation fertig“**, wenn alle Punkte erfüllt **und vom Projektinhaber im echten Kampf abgenommen** sind.

| # | Punkt | Woran man es prüft |
| :--- | :--- | :--- |
| D1 | **Rig vollständig:** alle Teile als Sprites, links/rechts eigens gezeichnet, Gelenke sitzen in jeder Pose (keine Lücken, keine schwebenden Kappen) | Kontaktbogen aller Zustände, Zoom 4× |
| D2 | **Jeder Angriff hat eigene Posen** in den drei Abschnitten *Vorwarnung → Ausführung → Erholung* (nicht nur ein Bild für alles) | Zustand für Zustand im Labor bei 0,25× |
| D3 | **Weiche Übergänge:** kein harter Sprung beim Pose-Wechsel — Drehung/Verschiebung werden überblendet, Bildwechsel liegen auf einem „Impuls“ (kurzes Stauchen/Strecken), sodass das Auge den Schnitt nicht sieht | Labor 0,25×: kein sichtbares „Ploppen“ |
| D4 | **Anlauf & Nachfedern:** vor jedem Sprung/Schlag ein sichtbares Ausholen (füllt die vorhandene Vorwarnzeit, verlängert sie **nicht**), danach Nachfedern | Labor 0,25× |
| D5 | **Fortbewegung:** Gehen/Schweben hat einen eigenen Rhythmus (Wippen, Gegenschwung der Arme, Kopf schwingt leicht nach) abhängig vom Tempo | Boss laufen lassen, 1× |
| D6 | **Treffer-Reaktion:** sichtbar, aber kurz (≤ 0,15 s), stört keine Angriffs-Pose | Spieler schlägt im Labor zu |
| D7 | **Phase-2-Verwandlung:** einmaliger, lesbarer Wechsel (Teile fliegen ab / öffnen sich / Teilen), danach dauerhaft anderes Aussehen | Labor „Phase II“ |
| D8 | **Lesbarkeit vor Show:** Gefahr kommt weiter aus den Telegraph-Zonen; Animation erzeugt **keinen** neuen Schaden, keine Hitbox-Änderung, keinen globalen Zufall | Code-Review: nur `bossAnims.ts`/Renderer/`detached.ts` geändert |
| D9 | **Rückfall sicher:** fehlt ein Bild, zeigt der Boss sein altes Sprite (kein Absturz) | Labor „Rig“-Schalter aus/an |
| D10 | **Tests & Doku:** Pose-Zuordnung im Test (`tests/m11p2.cjs` erweitern), `RIGGING_GUIDE.md` §5 aktualisiert | `npm run verify` |

---

## 2. Kern-Wächter (`core_warden`, kind `boss`) — Pilot

### 2.1 Stand (erledigt)
> **Update:** K1–K8 abgearbeitet und **S1–S5 vollständig eingebunden** (K5 jetzt über S3 gelöst, K6 mit den echten Faust-Bildern aus S4). Offen: **S6** (Arme ohne Faust in Angriffsposen, §2.3), die **Abnahme durch den Projektinhaber im echten Kampf** (§2.4) und die Übertragung auf andere Bosse (§3).
>
> **Varianten-Karte (Indizes = Reihenfolge in `rigs.json` `variants`):**
> Arme je Seite: 0–5 Hauptposen · 6 halb ausgeholt · 7 Schlag kurz vor Treffer · 8 zurückfedernd · 9 Laser-Ladung · 10 Block-Treffer · 11 Phase 2 beschädigt · 12 ohne Faust. Köpfe: 0–5 · 6 Visier feuert · 7 Blick links · 8 Blick rechts · 9 brüllend Phase 2 · 10 stark beschädigt (< 15 % HP) · 11 Blinzeln. Rümpfe: 0–5 · 6 Brust offen · 7 halb offen · 8 Sprung gestreckt · 9 Landung gestaucht · 10 Phase 2 Laser · 11 Phase 2 beschädigt. Fäuste (nur Bilder): `fist_front`, `fist_charged`, `fist_angled`, `fist_trail`.
>
> **Phase-2-Fäuste als Angriff (umgesetzt, „Faust-Salve“):** Es gibt nur diese 4 Fäuste. In `pylon_barrage` der Phase 2 fliegen sie **einmal** los (erste Salve, Fächer ±0,16 rad, Schaden 16, Radius 6 = sichtbare Faustgröße, Tempo 120), **verfolgen den Spieler** (`Projectile.homing` 2 rad/s, solange `life` > 0,5 → ~1,4 s), fliegen dann geradeaus und lösen sich nach 1,9 s mit kleinem Funkenregen auf — der Orbit ist leer, solange Fäuste unterwegs sind, danach kehren sie in 0,5 s zurück (`fistReturnScale`). Die übrigen Salven der Phase 2 schießen nichts nach (Phase 1 unverändert: Energie-Schüsse). Phase 2: hängende Arme sind „ohne Faust“ (12). Angriffsposen haben noch Fäuste → S6.

- [x] Pose-Sets Arme L/R, Köpfe, Rümpfe (je 6) importiert, Posen je Zustand (`coreWardenSet` in `src/dungeon/anim/bossAnims.ts`)
- [x] Schulter-Feinjustierung je Rumpf-Variante (`SHOULDER_ADJUST`)
- [x] Phase 2: Brustplatten fliegen weg (`detach: 'phase2'`, `src/dungeon/anim/detached.ts`), Rumpf/Kopf Phase-2-Varianten
- [x] Kern-Glühen am neuen Reaktorkern (`renderBoss…`, `bodyY + 5` bei Rig)

Zustände des Kern-Wächters (aus `src/dungeon/enemyAi.ts`, `updateBossAI`) — Grundlage aller Aufgaben. *Die Spalte „aktuelle Pose“ zeigt den Ausgangsstand vor S2–S5; die gültige Zuordnung steht in `coreWardenSet()` (`bossAnims.ts`) und in der Varianten-Karte oben.*

| `bossState` | Dauer | Bedeutung | aktuelle Pose (Arme · Kopf · Rumpf) |
| :--- | :--- | :--- | :--- |
| `stalk` | variabel | Gehen/Schweben zum Spieler | hängend · neutral · normal |
| `charge_windup` | 0,64 s (P2 0,54) | Sturm-Vorwarnung | Ausholen · zielend · geduckt |
| `charge_dash` | bis Wand/Zeit | Raketen-Sturm | Schlag zur Kamera · zielend · vorgebeugt |
| `slam_jump` / `slam_air` | 0,4 s / ~0,5 s | Sprung, Flug | Ausholen · neutral · zurück |
| `slam_impact` | 0,42 s | Landung | Stampfer · zielend · vorgebeugt |
| `laser_windup` / `laser_sweep` | 0,76 s / 1,1 s (P2 0,65 / 1,25) | Laser | seitlich · zielend/brüllend · zurück/normal |
| `pylon_barrage` | 1,28 s (P2 1,35) | Pylonen feuern | Block · brüllend · normal |
| `phase2_roar` | 1,1 s | Verwandlung | Ausholen · brüllend · Phase-2 |
| `stunned` | 0,6 s | nach Wandaufprall | hängend · beschädigt · überhitzt |

### 2.2 Code-Aufgaben (ohne neue Sprites) — für Sonnet/Opus
Reihenfolge = Priorität. Alle Änderungen rein darstellend (D8).

- [x] **K1 · Weiche Übergänge (D3)** — `bossAnims.ts` ✅ umgesetzt (Glättung `SMOOTH_TAU` 0,05 s, Stauch-Impuls 0,09 s beim Bildwechsel in `smoothPose`; zusätzlich `smoothBossBody` im Renderer: Ganzkörper-Stauchen/Neigung weich + mit Rig auf 30 % abgemildert, weil die Teile es selbst zeigen). Kreuzblende (`prevVariant`) bewusst **nicht** gebaut — Impuls reicht im Labor.
  - Pro Boss einen kleinen Animations-Zustand halten (`WeakMap<Enemy, { pose: Pose; set: {arms, head, torso}; t: number }>`), Zeit über den `time`-Parameter (kein `Date.now`).
  - Drehung/`dx`/`dy`/`sx`/`sy` jedes Teils über ~0,10 s zur Ziel-Pose überblenden (`blendPose` aus `rig.ts` mit exponentieller Annäherung: `k = 1 − exp(−dt/0,05)`).
  - Bildwechsel (`variant`) bleibt hart, bekommt aber einen **Impuls**: im Frame des Wechsels an diesem Teil `sx 1.08 / sy 0.94`, der über 0,08 s zurückfedert; beim Rumpf zusätzlich `dy +0.6`.
  - Optional (wenn das „Ploppen“ noch stört): in `rig.ts` `PartPose.prevVariant` + `mix` (0…1) einführen und in `drawRig` das alte Bild mit `alpha = 1 − mix` **unter** dem neuen zeichnen (Kreuzblende 0,06 s). Test in `tests/m11p2.cjs` ergänzen.
  - Abnahme: Labor 0,25×, alle Zustände durchklicken — keine Sprünge in Drehung/Lage.
- [x] **K2 · Anlauf & Nachfedern (D4)** — `bossAnims.ts` ✅ umgesetzt (`coreWardenSet`: Anlauf, Sprung stauchen→strecken, Landung `exp(−el/0,08)` + Arm-Nachschwingen, Rückprall/Kopf-Nachschwingen bei `stunned`)
  - Fortschritt der Vorwarnung `p = 1 − bossStateTimer / bossStateMax`.
  - `charge_windup`: Rumpf `dy = +2·p`, `sy = 1 − 0.06·p`, Arme drehen um `±0.25·p` nach hinten.
  - `slam_jump`: Stauchen in den ersten 40 % (`sy 0.9`), dann Strecken (`sy 1.08`); `slam_air`: gestreckt; `slam_impact`: 0,15 s Stauchen `sy 0.86 → 1` + Arme `rot` Nachschwingen (gedämpfte Sinuswelle, 2 Schwingungen).
  - `charge_dash` → `stunned`: Kopf `rot` Nachschwingen, Rumpf `dx` Rückprall 2 px.
  - Abnahme: Ausholen ist in der vorhandenen Vorwarnzeit sichtbar; keine Zustandsdauer geändert (`enemyAi.ts` unberührt).
- [x] **K3 · Fortbewegung (D5)** — `bossAnims.ts` ✅ umgesetzt — Abweichung: Armschwung **gegenläufig** (`armL += s`, `armR += s`: ein Arm schwingt nach außen, der andere nach innen) statt beide gleichzeitig nach außen; Ruhe-Pendeln beim Gehen auf 40 % gedämpft
  - Tempo `v = hypot(vx, vy)`, Takt `ph = time · (3 + v/25)`.
  - Rumpf-Wippen `dy = −|sin ph| · min(1.5, v/40)`, Arme gegenläufig `armL rot += sin(ph)·0.12·w`, `armR rot −= sin(ph)·0.12·w` (nur im Ruhe-Set `hang`), Kopf hängt nach (`rot = −sin(ph − 0.4)·0.05·w`), leichtes Lehnen in Laufrichtung über den Rumpf (`rot = clamp(vx·0.0015, ±0.08)`).
  - Achtung: der Renderer neigt den ganzen Boss bereits (`tilt`) — Werte klein halten, im Labor prüfen.
- [x] **K4 · Treffer-Reaktion (D6)** — `bossAnims.ts` ✅ umgesetzt (voll im Ruhe-/Gehzustand, im Pylonen-Block nur Rumpfzittern, in Sturm/Sprung/Laser unverändert)
  - Bei `flashTimer > 0`: zusätzlich Rumpf `dx` ±1 px Zittern (deterministisch: `sin(time·90)`), Arme `rot` +0,08 nach außen, 0,12 s. Nicht während `charge_dash`/`slam_*`/`laser_sweep` (dort nur der Kopf-Ruck, wie jetzt).
- [x] **K5 · Laser: Brust öffnet sich** ✅ gelöst über S3: `laser_windup` zeigt den Rumpf halb offen → offen, `laser_sweep` offen (Phase 2: eigener Laser-Rumpf). Die ursprünglich geplanten Typ-P-Platten wurden verworfen (verdeckten den Kern).
  - *(verworfener Ansatz, nur Historie)* Während `laser_windup`/`laser_sweep` die vorhandenen Platten `plateL/plateR` (Typ-P-Bilder) **sichtbar** machen und seitlich aufklappen: `dx ∓ 3·p`, `rot ∓ 0.35·p`, dazu Rumpf-Variante `normal` → Kern bleibt sichtbar.
  - *(verworfener Ansatz, nur Historie)* Erst im Kontaktbogen prüfen: wirkt es **doppelt** (Platten über intaktem Brustpanzer), dann verwerfen und stattdessen Sprite-Aufgabe **S3** abwarten. Teile mit `detach: 'phase2'` dürfen nach Phase 2 nicht wieder auftauchen (`getBossPose` blendet sie aus — so lassen).
- [x] **K6 · Fäuste als Pylonen in Phase 2** ✅ umgesetzt: in Phase 2 zeichnet `drawBossPylon` statt der Rauten `fist_angled` (Umlauf) bzw. `fist_charged` + `fist_trail` (während `pylon_barrage`); die Arme zeigen in `pylon_barrage` die Variante 12 „ohne Faust“. Hitbox/Schüsse unverändert.
  - *(verworfener Ansatz, nur Historie)* Heute kreisen eigene Plasma-Pylonen (`enemyAi.getBossPylonPositions`, `dungeonRenderer.drawBossPylon`). Variante **ohne** neue Sprites: In Phase 2 während `pylon_barrage` an zwei Pylon-Positionen zusätzlich das vorhandene Bild `fist.png` (Typ-P-Teil, aktuell ungenutzt) gedreht zeichnen (glühend über `drawGlow`), Arme in Pose `block`.
  - *(verworfener Ansatz, nur Historie)* Ehrliche Einschränkung: die Arm-Posen enthalten die Faust schon → Fäuste wären doppelt. Saubere Lösung erst mit Sprite-Aufgabe **S4** (Arme ohne Faust). Ohne S4 nur umsetzen, wenn es im Labor überzeugt; sonst zurückstellen.
- [x] **K7 · Schulter-/Halskontrolle in Bewegung** — `SHOULDER_ADJUST`, `rigs.json` (`offset` von `armL/armR/head`) ✅ umgesetzt (Bewegungsfolge im Labor bei 0,25× geprüft: Gehen, Pylonen-Block, Rückkehr in `stalk`; keine schwebenden Schulterkappen, `SHOULDER_ADJUST` unverändert)
  - Bisher nur Standbilder geprüft. Im Labor bei 0,25× jeden Zustand ansehen; schwebende Schulterkappen/Hals-Lücken über `SHOULDER_ADJUST` (je Rumpf-Variante) bzw. Kopf-`offset` korrigieren. Ergebnisse als Kommentar an der Tabelle vermerken.
- [x] **K8 · Tests (D10)** — `tests/m11p2.cjs`: je Zustand Pose ≠ Ruhe-Pose; Übergang: zwei aufeinanderfolgende Frames unterscheiden sich in `rot` um < 0,2 rad; Impuls klingt in ≤ 0,1 s ab. ✅ umgesetzt (`tests/m11p2.cjs`: Übergangs-Glätte < 0,2 rad/Frame über alle Zustände, Impuls klingt ab, Pose-Effekte K2–K4, Faust-Bild, Platten im Laser)

### 2.3 Sprite-Aufgaben — für Antigravity (Gemini)
Format & Regeln wie `ART_BRIEF_M11.md` §2 (512×512-Zellen, Gelenk in Zellmitte, gleicher Maßstab wie die vorhandenen `core_warden_*`-Sheets, Referenzbilder: `public/art/sprites/boss.png` + das jeweils vorhandene Sheet). Prüfen mit `npm run art:check`.

- [x] **S1 · `core_warden_arms_L.png` Zellen 2 & 4 neu zeichnen** ✅ erledigt (eigenständig mit Licht von links-oben neu schattiert, Gelenk im Fadenkreuz, `art:check` + `art:import -- core_warden --force` + `npm run verify` + Kontaktbogen `rig_core_warden.png` geprüft).
- [x] **S2 · Zwischen-Posen Arme (Typ L)** ✅ `art_source/rigs/core_warden_arms_R2.png` und `art_source/rigs/core_warden_arms_L2.png` erzeugt & per `art:check` geprüft (Licht links-oben, Schulterring im Fadenkreuz, `min_margin ≥ 34 px` / `≥ 46 px`: 1 halb ausgeholt · 2 Schlag kurz vor Treffer · 3 zurückfedernd · 4 Laser-Ladung · 5 Block-Treffer · 6 Phase-2 beschädigt).
  ✅ eingebunden: `armR_7…12`/`armL_7…12`; Zwischen-Posen 0,08 s beim Wechsel hängend→ausholen (6), ausholen→Schlag (7), Schlag→hängend (8) (`ARM_BETWEEN` in `smoothPose`); Laser-Ladung beim `laser_windup`, Block-Treffer im Pylonen-Block, beschädigt als Phase-2-Ruhe.
- [x] **S3 · Rumpf „Brust offen – Laser“ (Typ S)** ✅ `art_source/rigs/core_warden_torsos2.png` erzeugt & per `art:check` geprüft (Kern im Fadenkreuz, `min_margin ≥ 40 px`, 6 Varianten: Brustklappen offen · halb offen · Sprung gestreckt · Landung gestaucht · Phase 2 Laser · Phase 2 beschädigt).
- [x] **S4 · Arme ohne Faust + Faust einzeln (Typ L/E)** ✅ `art_source/rigs/core_warden_fists.png` erzeugt & per `art:check` geprüft (Arme R/L ohne Faust mit leuchtender Manschette = Schulter im Fadenkreuz; Fäuste vorn/geladen/schräg-oben + Energie-Schweif = Mitte im Fadenkreuz, `min_margin ≥ 115 px`).
- [ ] **S6 · Arme OHNE Faust in den Angriffsposen (Typ L, Phase 2)** — `core_warden_arms_R3.png` und `core_warden_arms_L3.png`, 3×2 (wie `arms_R`/`arms_L`, aber ohne Faust, leuchtende Manschette am Handgelenk wie in `core_warden_fists.png` Zelle 1/2): 1 Ausholen · 2 Schlag zur Kamera (offener Energie-Stumpf statt Faust) · 3 seitlich/Laser · 4 Block · 5 Boden-Stampfer · 6 halb ausgeholt. **Warum:** In Phase 2 kreisen die Fäuste und werden abgefeuert; nur *hängend* gibt es schon eine Variante ohne Faust (`armX_nf`). In Ausholen/Schlag/Stampfer/Laser zeigen die Arme noch Fäuste — dort sind sie doppelt. Code danach: Sets als `armR_13…18`/`armL_13…18` anhängen, in `coreWardenSet` bei `p2` die Faust-losen Varianten wählen (Index-Offset +13 bzw. Karte `NOFIST_OF`).
- [x] **S5 · Köpfe Zusatz (Typ S)** ✅ `art_source/rigs/core_warden_heads2.png` erzeugt & per `art:check` geprüft (Halsgelenk im Fadenkreuz, `min_margin ≥ 36 px`: 1 Visier feuert Laser · 2 Blick links · 3 Blick rechts · 4 brüllend Phase 2 · 5 stark beschädigt < 15 % HP mit zerbrochenem Halo · 6 Blinzeln/Visier zu).

**Reihenfolge für Credits:** Offen: **S6** (nur Phase-2-Fäuste). Erledigt: S1 → S3 → S4 → S2 → S5.

### 2.4 Abnahme Kern-Wächter
Alle Punkte D1–D10 erfüllt, K1–K8 abgehakt, S1–S5 erledigt (S2–S5 eingebunden), Projektinhaber hat einen vollständigen Kampf (Phase 1 + 2) im echten Spiel gesehen und freigegeben → hier „✅ abgenommen am …“ eintragen.

---

## 3. Andere Bosse (Vorlage)
Für jeden weiteren Boss einen Abschnitt nach diesem Muster anlegen:
1. **Zustandstabelle** (`bossState`/`bossSub` + Zugnamen aus `src/dungeon/bosses/defs.ts` bzw. `enemyAi.ts`, Dauer, gewünschte Pose).
2. **Code-Aufgaben K1–K8** übernehmen (Übergänge, Anlauf, Fortbewegung, Treffer, Spezial-Verwandlung, Feinjustierung, Tests). Gemeinsamen Code (Übergangs-/Impuls-Logik) **einmal** in `bossAnims.ts` als Hilfsfunktion bauen und für alle Bosse nutzen.
3. **Sprite-Aufgaben** aus `ART_BRIEF_M11.md` §4 + Zwischen-Posen wie S2.
4. Besonderheiten aus `MILESTONE_11_ARCHITECTURE.md` §4.1 (z. B. Teilen beim Quarz-Koloss/Sternen-Archon — Logik fertig, Aussehen der Hälften erst mit Rig).

**Krall — Zuordnung (`krallSet()` in `bossAnims.ts`, Zugnamen aus `bosses/defs.ts`)**
Arme `clawR` (Greifzange) / `clawL` (Schrott-Haken + Säge), Indizes je Seite: 0 hängend · 1 ausholend · 2 Stoß zur Kamera · 3 seitlich · 4 Block · 5 Boden-Stampfer. Rumpf: 0 normal · 1 geduckt · 2 aufgerichtet (Kern hell) · 3 nach vorn gebeugt · 4 Phase 2 (Skelettrahmen) · 5 beschädigt (< 25 % HP).

| Zug / Abschnitt | Arme R · L | Rumpf | Zusatz (`fx`) |
| :--- | :--- | :--- | :--- |
| Ruhe / Gehen | 0 · 0 | 0 | Armschwung gegenläufig, Lehnen, Beine/Magnet wie bisher |
| GREIFARM-STOSS Vorwarnung | 1 · 1 | 1 geduckt | Rumpf `dy +1.5p`, Arme zurück |
| GREIFARM-STOSS Ausführung (Erholung 0–0,55 s) | 2 · 3 | 3 gebeugt | Rückprall, Zange federt nach; danach hängend |
| MAGNET-ZUG Vorwarnung | 1 · 1 | 2 aufgerichtet | Rumpf/Magnet heben sich |
| MAGNET-ZUG Sog (bis 1,1 s nach Zündung) | 3 · 3 | 2 | Zittern, Magnet wackelt |
| SCHROTT-WURF Vorwarnung / Wurf | 1 · 1 / 3 · 0 | 1 / 3 | Wurfarm federt nach |
| SCHROTT-HAGEL Vorwarnung / Stampfer (P2) | 1 · 1 / 5 · 5 | 4 (Skelett) | Haltung über `dy`/`sy`/`rot` (in Phase 2 gibt es nur den Rahmen) |
| Phase 2 / < 25 % HP | wie oben | 4 / 5 | — |
| Treffer (`flashTimer`) | Arme federn nach außen | Zittern `dx` | nicht in Angriffsposen |

Die Engine setzt `bossStateMax` nur in der Vorwarnung; die Erholungsdauer je Zug steht deshalb in `KRALL_RECOVER` (muss zu `defs.ts` passen). **Krall — Feinschliff „weniger Puppe“ (umgesetzt, Commit `4c1eb4d`):** Schrittphase aus Strecke (`stridePhase`, Beine stehen im Stand), Renderer wippt nur beim Laufen (`renderBreacherBoss`, halbe Amplitude) und nutzt `smoothBossBody`, `KRALL_TAU` 0,1 s, `VARIANT_LAG` (Arm L folgt R nach 0,07 s), `CLAW_BETWEEN` (Zwischen-Posen Anlauf/Ausschwingen).
**Krall — noch offen / bekannt unbefriedigend:**
- Beine drehen nur um ein Gelenk (Schrittposen erst mit `krall_legs_R/L.png`); Effekte (Schrott, Magnet-Funken, Splitter) sind Platzhalter bis `krall_effects.png`.
- Arme sehr dünn gezeichnet (Zeichnungsfrage); Posen-Zeitpunkte (Stoß-Ausschwingen 0,55 s, Magnet-Sog 1,1 s) noch nicht gegen das Spielgefühl abgestimmt; Zwischen-Posen nur als Näherung.
- Kern-Wächter: Schritte laufen jetzt wie bei Krall aus der zurückgelegten Strecke (`stridePhase`, `CW_STRIDE_K`, Polish Teil 2). Die alte Glättung (`SMOOTH_TAU` 0,05 s) blieb bewusst — ggf. träger stellen (`KRALL_TAU`-Muster), falls er sich im Kampf noch „zappelig“ anfühlt.
- Abnahme im echten Kampf fehlt (Rückmeldung des Projektinhabers: Bewegung wirkte „wie eine zappelnde Puppe“ → Feinabstimmung nach 1–2 Kämpfen mit konkreten Stellen).
Offen für Krall: Beine/Effekte-Sheets, Maßstab bleibt `torsoDisplayH: 36` (alle Krall-Teile).

**Aktueller Stand je Boss**
| Boss | Rig | Pose-Sets | Phase 2 | Teilen | Nächster Schritt |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Kern-Wächter | ✅ | ✅ (S1–S5 eingebunden, K1–K8) | ✅ Platten fliegen, Faust-Salve | — | **S6** (Arme ohne Faust in Angriffsposen) + Abnahme im echten Kampf §2.4 |
| Krall | ✅ Rumpf-Set (6), `clawR`/`clawL` (je 6 Posen), Phase-2-Skelettrahmen, `krallSet()` | ✅ Arme L/R + Rümpfe eingebunden; Beine (`legs_R/L`) + Effekte (`effects`) fehlen | ✅ Panzer fällt ab, Skelett-Rumpf | — | letzte 3 Sheets (`krall_legs_R/L`, `krall_effects`) (Antigravity); Abnahme im echten Kampf |
| Quarz-Koloss | – | – | – | ✅ Logik (Hälften gleich aussehend, 85 %) | Teile-Sheets (`ART_BRIEF_M11.md` §4.3) |
| Sternen-Archon | – | – | – | ✅ Logik | Teile-Sheets |
| übrige Bosse | – | – | – | – | Teile-Sheets |
| normale Gegner | – | – | – | – | `ART_BRIEF_M11_ENEMIES.md` (Pilot: Geschütz, Phasen-Jäger) |
