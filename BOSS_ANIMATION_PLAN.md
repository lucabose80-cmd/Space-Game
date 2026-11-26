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
> **Update:** K1–K8 sind abgearbeitet (K5 verworfen, K6 als Variante). Offen: Abnahme durch den Projektinhaber (§2.4) und Sprite-Aufgaben S1–S5.

- [x] Pose-Sets Arme L/R, Köpfe, Rümpfe (je 6) importiert, Posen je Zustand (`coreWardenSet` in `src/dungeon/anim/bossAnims.ts`)
- [x] Schulter-Feinjustierung je Rumpf-Variante (`SHOULDER_ADJUST`)
- [x] Phase 2: Brustplatten fliegen weg (`detach: 'phase2'`, `src/dungeon/anim/detached.ts`), Rumpf/Kopf Phase-2-Varianten
- [x] Kern-Glühen am neuen Reaktorkern (`renderBoss…`, `bodyY + 5` bei Rig)

Zustände des Kern-Wächters (aus `src/dungeon/enemyAi.ts`, `updateBossAI`) — Grundlage aller Aufgaben:

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
- [x] **K5 · Laser: Brust öffnet sich (Plan §4.1)** — `bossAnims.ts` + `rigs.json` ✅ **verworfen** — im Kontaktbogen verdecken die geschlossenen Brustplatten den offenen Kern (`node scripts/rig-sheet.cjs core_warden`, Zustand „laser_sweep“). Echte Lösung = Sprite-Aufgabe S3
  - Während `laser_windup`/`laser_sweep` die vorhandenen Platten `plateL/plateR` (Typ-P-Bilder) **sichtbar** machen und seitlich aufklappen: `dx ∓ 3·p`, `rot ∓ 0.35·p`, dazu Rumpf-Variante `normal` → Kern bleibt sichtbar.
  - Erst im Kontaktbogen prüfen: wirkt es **doppelt** (Platten über intaktem Brustpanzer), dann verwerfen und stattdessen Sprite-Aufgabe **S3** abwarten. Teile mit `detach: 'phase2'` dürfen nach Phase 2 nicht wieder auftauchen (`getBossPose` blendet sie aus — so lassen).
- [x] **K6 · Fäuste als Pylonen in Phase 2 (Plan §4.1)** — Renderer + `bossAnims.ts` ✅ umgesetzt als Variante: in Phase 2 zeichnet `drawBossPylon` statt der Rauten das Bild `fist` (über `extraImages` in `rigs.json` geladen), Manschette zum Boss; Hitbox/Schüsse unverändert. Die Arme zeigen ihre Fäuste weiter (doppelt) — saubere Lösung mit S4
  - Heute kreisen eigene Plasma-Pylonen (`enemyAi.getBossPylonPositions`, `dungeonRenderer.drawBossPylon`). Variante **ohne** neue Sprites: In Phase 2 während `pylon_barrage` an zwei Pylon-Positionen zusätzlich das vorhandene Bild `fist.png` (Typ-P-Teil, aktuell ungenutzt) gedreht zeichnen (glühend über `drawGlow`), Arme in Pose `block`.
  - Ehrliche Einschränkung: die Arm-Posen enthalten die Faust schon → Fäuste wären doppelt. Saubere Lösung erst mit Sprite-Aufgabe **S4** (Arme ohne Faust). Ohne S4 nur umsetzen, wenn es im Labor überzeugt; sonst zurückstellen.
- [x] **K7 · Schulter-/Halskontrolle in Bewegung** — `SHOULDER_ADJUST`, `rigs.json` (`offset` von `armL/armR/head`) ✅ umgesetzt (Bewegungsfolge im Labor bei 0,25× geprüft: Gehen, Pylonen-Block, Rückkehr in `stalk`; keine schwebenden Schulterkappen, `SHOULDER_ADJUST` unverändert)
  - Bisher nur Standbilder geprüft. Im Labor bei 0,25× jeden Zustand ansehen; schwebende Schulterkappen/Hals-Lücken über `SHOULDER_ADJUST` (je Rumpf-Variante) bzw. Kopf-`offset` korrigieren. Ergebnisse als Kommentar an der Tabelle vermerken.
- [x] **K8 · Tests (D10)** — `tests/m11p2.cjs`: je Zustand Pose ≠ Ruhe-Pose; Übergang: zwei aufeinanderfolgende Frames unterscheiden sich in `rot` um < 0,2 rad; Impuls klingt in ≤ 0,1 s ab. ✅ umgesetzt (`tests/m11p2.cjs`: Übergangs-Glätte < 0,2 rad/Frame über alle Zustände, Impuls klingt ab, Pose-Effekte K2–K4, Faust-Bild, Platten im Laser)

### 2.3 Sprite-Aufgaben — für Antigravity (Gemini)
Format & Regeln wie `ART_BRIEF_M11.md` §2 (512×512-Zellen, Gelenk in Zellmitte, gleicher Maßstab wie die vorhandenen `core_warden_*`-Sheets, Referenzbilder: `public/art/sprites/boss.png` + das jeweils vorhandene Sheet). Prüfen mit `npm run art:check`.

- [x] **S1 · `core_warden_arms_L.png` Zellen 2 & 4 neu zeichnen** ✅ erledigt (eigenständig mit Licht von links-oben neu schattiert, Gelenk im Fadenkreuz, `art:check` + `art:import -- core_warden --force` + `npm run verify` + Kontaktbogen `rig_core_warden.png` geprüft).
- [x] **S2 · Zwischen-Posen Arme (Typ L)** ✅ `art_source/rigs/core_warden_arms_R2.png` und `art_source/rigs/core_warden_arms_L2.png` erzeugt & per `art:check` geprüft (Licht links-oben, Schulterring im Fadenkreuz, `min_margin ≥ 34 px` / `≥ 46 px`: 1 halb ausgeholt · 2 Schlag kurz vor Treffer · 3 zurückfedernd · 4 Laser-Ladung · 5 Block-Treffer · 6 Phase-2 beschädigt).
  Code danach: Sets in `rigs.json` an die Varianten anhängen (`armR_7…12`), Zuordnung in `coreWardenSet` (Zwischen-Posen für ~0,08 s zwischen den Hauptposen → ersetzt die Kreuzblende).
- [x] **S3 · Rumpf „Brust offen – Laser“ (Typ S)** ✅ `art_source/rigs/core_warden_torsos2.png` erzeugt & per `art:check` geprüft (Kern im Fadenkreuz, `min_margin ≥ 40 px`, 6 Varianten: Brustklappen offen · halb offen · Sprung gestreckt · Landung gestaucht · Phase 2 Laser · Phase 2 beschädigt).
- [x] **S4 · Arme ohne Faust + Faust einzeln (Typ L/E)** ✅ `art_source/rigs/core_warden_fists.png` erzeugt & per `art:check` geprüft (Arme R/L ohne Faust mit leuchtender Manschette = Schulter im Fadenkreuz; Fäuste vorn/geladen/schräg-oben + Energie-Schweif = Mitte im Fadenkreuz, `min_margin ≥ 115 px`).
- [ ] **S5 · Köpfe Zusatz (Typ S)** `core_warden_heads2.png`, 3×2: 1 Visier feuert (Laser aus dem Visier) · 2 zur Seite blickend links · 3 zur Seite blickend rechts · 4 brüllend Phase 2 · 5 stark beschädigt (Halo zerbrochen, für < 15 % HP) · 6 Blinzeln/Visier zu. Halsgelenk in Zellmitte.

**Reihenfolge für Credits:** S1 (billig, sichtbarster Fehler) → S3 (Laser) → S4 (Fäuste) → S2 → S5.

### 2.4 Abnahme Kern-Wächter
Alle Punkte D1–D10 erfüllt, K1–K8 abgehakt, S1 erledigt (S2–S5 optional, aber vermerkt), Projektinhaber hat einen vollständigen Kampf (Phase 1 + 2) im echten Spiel gesehen und freigegeben → hier „✅ abgenommen am …“ eintragen.

---

## 3. Andere Bosse (Vorlage)
Für jeden weiteren Boss einen Abschnitt nach diesem Muster anlegen:
1. **Zustandstabelle** (`bossState`/`bossSub` + Zugnamen aus `src/dungeon/bosses/defs.ts` bzw. `enemyAi.ts`, Dauer, gewünschte Pose).
2. **Code-Aufgaben K1–K8** übernehmen (Übergänge, Anlauf, Fortbewegung, Treffer, Spezial-Verwandlung, Feinjustierung, Tests). Gemeinsamen Code (Übergangs-/Impuls-Logik) **einmal** in `bossAnims.ts` als Hilfsfunktion bauen und für alle Bosse nutzen.
3. **Sprite-Aufgaben** aus `ART_BRIEF_M11.md` §4 + Zwischen-Posen wie S2.
4. Besonderheiten aus `MILESTONE_11_ARCHITECTURE.md` §4.1 (z. B. Teilen beim Quarz-Koloss/Sternen-Archon — Logik fertig, Aussehen der Hälften erst mit Rig).

**Aktueller Stand je Boss**
| Boss | Rig | Pose-Sets | Phase 2 | Teilen | Nächster Schritt |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Kern-Wächter | ✅ | ✅ (4/4) | ✅ Platten fliegen | — | §2 K1–K8, S1 |
| Krall | ✅ (alt) | 1/6 (`krall_arms_R`) | ✅ Panzer fällt ab | — | restliche 5 Sheets (`HANDOFF.md`), dann §3 |
| Quarz-Koloss | – | – | – | ✅ Logik | Teile-Sheets (`ART_BRIEF_M11.md` §4.3) |
| Sternen-Archon | – | – | – | ✅ Logik | Teile-Sheets |
| übrige Bosse | – | – | – | – | Teile-Sheets |
| normale Gegner | – | – | – | – | `ART_BRIEF_M11_ENEMIES.md` (Pilot: Geschütz, Phasen-Jäger) |
