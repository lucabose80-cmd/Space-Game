# BOSS_ENEMY_PIPELINE.md — Wiederholbarer Ablauf für Bosse, Gegner & Bossräume (*STARLIGHTER*)

> **Zweck:** Jeder neue oder überarbeitete Gegner, Boss oder Endboss-Raum soll **immer dieselbe Qualität** erreichen — egal welcher Chat oder welches Werkzeug (Claude Code, Antigravity) daran arbeitet. Diese Datei ist der **Ablauf**; die Messlatten stehen in den Checklisten:
> - normale Gegner: **G1–G10** (`BOSS_ANIMATION_PLAN.md` §4)
> - Bosse: **D1–D15** (`BOSS_ANIMATION_PLAN.md` §1)
> - Sektor-Endbosse (Ebene III) mit Arena: **A1–A10** (`MILESTONE_12_ARCHITECTURE.md` §2) **zusätzlich** zu D1–D15

---

## 0. Grundsatz: Sprites großzügig planen
Gute Animation scheitert fast immer an **zu wenigen Bildern**, nicht am Code. Deshalb gilt:
1. **Viele Sprites sind normal und erwünscht.** Lieber 2 Sheets mehr einplanen als eine Pose mit Code „verbiegen“ (Rotation/Skalierung eines einzelnen Bildes wirkt puppenhaft — Rückmeldung Projektinhaber zum Kern-Wächter).
2. **Fehlt ein Sprite → nie blockieren:** prozeduraler Fallback bzw. altes Sprite zeigen, **und sofort** in `SPRITE_QUEUE.md` einreihen (`AGENTS.md` §3 Regel 7). Ein Fallback ist ein *Notfall*, kein Endzustand.
3. **Nicht an Bild-Credits sparen** (Projektinhaber, 2026-11-27): Es ist genug Gemini-Guthaben da. Wenn es der Qualität dient, wird bestellt — auch mehrfach.
4. **Gefällt etwas nicht oder klappt es nicht → zurück auf neue Sheets:** jederzeit, in jeder Stufe (auch nach Stufe 8). Ersatz-Sheet (*„ersetzt `<datei>` — Grund: …“*) oder Zusatz-Sheet in `SPRITE_QUEUE.md` eintragen (§0 dort), Fallback bis zur Lieferung, danach Stufen 5–8 für die betroffenen Teile wiederholen. Ein schwaches Sheet zu behalten, nur weil es schon geliefert ist, ist **kein** gültiger Grund.
5. **Richtwerte (Mindest-Bedarf — eher mehr):**

| Art | Mindest-Sprites | typischer Umfang |
| :--- | :--- | :--- |
| Normaler Gegner | 1 Teile-Sheet `<kind>_rig.png` (6 Zellen) | + 1 Sheet Angriff/Tod/Effekte, wenn der Angriff mehr als Mündungsblitz ist |
| Boss (Ebene I/II) | Rumpf-Set + Arm-Sets L/R + Kopf-Set (≈ 4–6 Sheets) | 8–12 Sheets inkl. Beine, Effekte, Phase-2-Körper, Beschädigungsstufen (D12) |
| Sektor-Endboss + Arena | alles von „Boss“ **plus** Arena-Boden, Boss-Wand/Körper in der Map, Arena-Teile, Arena-Effekte, Trophäe (≈ +5) | 12–18 Sheets/Sprites |

## 1. Die 8 Stufen (für jedes Wesen gleich)
Jede Stufe hat ein **Tor**: erst weiter, wenn das Tor erfüllt ist. Status je Stufe im eigenen Blatt `handoff/<bereich>.md` abhaken.

| Stufe | Wer | Ergebnis | Tor (muss erfüllt sein) |
| :--- | :--- | :--- | :--- |
| **1 Steckbrief** | Claude Code | Steckbrief (§2) im Status-Blatt bzw. Plan-Dokument | Inhaber hat Rolle/Fantasie/Arena-Idee abgenickt |
| **2 Zustandstabelle** | Claude Code | jeder KI-Zustand (`bossState` / Gegner-Zustand) mit Dauer + gewünschter Pose je Abschnitt *Vorwarnung → Ausführung → Erholung* | keine Zelle „?“; jede Attacke hat eine Angriffsgrafik geplant (D11) |
| **3 Sprite-Liste** | Claude Code | Zellenliste je Sheet (was in Zelle 1–6), abgeleitet aus Stufe 2 + Beschädigungsstufen + Tod + Phase 2 (+ Arena) | **in `SPRITE_QUEUE.md` eingetragen** (ID, Zielpfad, Referenz, Prompt im Brief) |
| **4 Pilot-Sheet** | Antigravity — oder der Claude-Chat selbst per `npm run art:gen` (`AGENTS.md` Regel 15) | **ein** Sheet zuerst (meist Rumpf bzw. `<kind>_rig.png`) | `npm run art:check` ok, Maßstab passt zum alten Sprite, STOP-GATE bis Sichtprüfung |
| **5 Import & Rig** | Claude Code | `src/data/rigs/<id>.json`, `npm run art:import -- <id> --force`, Kontaktbogen `node scripts/rig-sheet.cjs <id>` | Gelenke sitzen in jeder Pose, nichts schwebt (D1/D13 bzw. G1) |
| **6 Posen & Bewegung** | Claude Code | `src/dungeon/anim/rigs/<id>.ts`: Zustand → Pose, Glättung/Impuls, Laufrhythmus aus Strecke, Treffer, Tod, Phase 2 | im Boss-Labor (`?bosslab`) bei 0,25× kein „Ploppen“; Hitbox/Schaden unverändert |
| **7 Prüfung gegen Checkliste** | Claude Code | jede Zeile G1–G10 / D1–D15 / A1–A10 im Status-Blatt mit ✅ + Nachweis (Test, Screenshot, Labor-Stelle) | eigener Test `tests/m11p…_<id>.cjs` bzw. `m12p…`, `npm run verify` grün, Screenshots in `tests/out/` angesehen |
| **8 Abnahme im Spiel** | Projektinhaber | 1–2 echte Kämpfe, Rückmeldung mit konkreten Stellen | Inhaber sagt „abgenommen“ → Status-Tabelle in `BOSS_ANIMATION_PLAN.md` §3 auf ✅ |

**Fehlen in Stufe 5–7 Bilder oder überzeugen die gelieferten nicht:** nicht mit Code überbrücken, sondern zurück zu Stufe 3 (neue Queue-Zeile bzw. Ersatz-Sheet, Priorität P0 für laufende Bosse), Fallback bis dahin. **Rückmeldung des Inhabers „gefällt mir nicht“ in Stufe 8** → betroffene Sheets als Ersatz bestellen, nicht nur den Code nachjustieren.

## 2. Steckbrief-Vorlage (Stufe 1)
```md
### <Name> (`kind` / rig-id) — Sektor X, Ebene Y
- Rolle im Sektor: (Einstieg / Mitte / Endboss mit Arena)
- Fantasie in einem Satz: (z. B. „Reaktor-KI, deren Körper die Nordwand ist“)
- Bewegung: (läuft / schwebt / in Map verankert) · Körperbau: (Teile, die sich bewegen)
- Attacken je Phase: Name · Vorwarnung · Ausführung · Erholung · Arena-Bezug
- Phase 2 (und 3 bei Endboss): sichtbare Verwandlung + Arena-Änderung
- Beschädigungsstufen: was bricht/raucht bei 80/65/35/25/<15 % (D12)
- Tod: was passiert mit den Teilen
- Belohnung (nur Bosse): Items/Flags — nie Credits
- Referenzbilder: vorhandene Sprites, Palette des Sektors
```

## 3. Bossraum-Vorlage (zusätzlich für Sektor-Endbosse)
Für jeden Ebene-III-Boss wird in `MILESTONE_12_ARCHITECTURE.md` ein §6-Block nach dem Muster des Leviathan angelegt:
1. **Ort & Bild:** wo im Sektor, wie der Boss in der Map verankert ist (Wand, Boden, Krater, Plattformen).
2. **Arena-Grundriss:** Größe (≥ 2×2 Bildschirme), Eingang, Deckung, Gefahrenflächen als Kachel-Raster (`src/data/arenas/<kind>.ts`) — **ohne Zufall**.
3. **Phasen-Tabelle:** HP-Spanne · Arena-Änderung · Attacken · Schwachstelle (mind. 3 Phasen).
4. **Belohnung:** Trophäen-Relikt, Waffen-Arten-Freischaltung (§5.1 dort), Hub-Trophäe.
5. **Sprite-Liste:** Arena-Boden, Boss-Wand/Körper, Arena-Teile (Typ P), Arena-Effekte (Typ E), Trophäe + Item-Icon → `SPRITE_QUEUE.md`.
6. **Werte:** HP/Kampfdauer in `balance.ts`, Messung mit `m10cp8`.

## 4. Qualitäts-Regeln, die immer gelten
- **Lesbarkeit vor Show:** Gefahr kommt aus Telegraph-Zonen (`bossFx`), Vorwarnung ≥ 0,4 s (Arena-Änderungen ≥ 0,8 s); Animation erzeugt nie neuen Schaden.
- **Kein globaler Zufall** in Layout, Mechanik und Animation (Seeds der Wochen-Prüfung).
- **Ein Wesen = eigene Dateien** (`anim/rigs/<id>.ts`, `data/rigs/<id>.json`, `handoff/<id>.md`, eigener Test) — gemeinsame Dateien nur klein ändern (`PARALLEL_WORK.md`).
- **Pilot zuerst:** neue Serie (neuer Gegner-Typ, neue Arena-Art) immer erst mit einem Exemplar bis Stufe 8, dann Serie.
- **Push nur mit `npm run ship`.**

## 4b. Durchhalten bis fertig (`AGENTS.md` Regel 17)
Jedes Status-Blatt in `handoff/` führt die Checkliste des Wesens als **Zeilenliste mit Status** (`✅ <Punkt> — Nachweis` / `⬜ <Punkt> — nächster Schritt`). Ein Chat arbeitet diese Liste von oben nach unten ab und hört erst auf, wenn **alle Zeilen ✅** sind oder ein erlaubter Haltegrund vorliegt (Abnahme durch den Inhaber, STOP-GATE, Quota, Entscheidung nötig) — der dann ausdrücklich gemeldet wird. **Abbruchsicher:** früh und oft pushen (`npm run ship` nach jedem Teilschritt; bei rotem Test/Konflikt mindestens `WIP:`-Push auf den eigenen Branch), und das Status-Blatt in **jedem** Push-Commit so aktualisieren, dass ein anderes Werkzeug (Antigravity/Gemini) bei leeren Credits ohne Rückfrage weitermachen kann — bei jedem ⬜ steht der konkrete nächste Schritt. Vor der Abschlussmeldung: Liste vollständig gegen G1–G10 / D1–D15 / A1–A10 prüfen, nichts „vergessen“.

## 5. Sektor-gebundene Effekte (Boden, Einschlag, Tod) — Biom-Varianten
Gegner und Bosse tauchen **nicht nur in ihrem Heimat-Sektor** auf. Alles, was auf dem **Boden der aktuellen Map** liegt oder aus ihr herausbricht, muss zum Boden **dieses Raums** passen — nicht zum Heimat-Sektor des Gegners.

**Wo Gegner/Bosse fremde Sektoren betreten (Stand 2026-11-27, `src/world/dungeonGen.ts`):**
| Ort | Wer kommt fremd vor | Biom des Raums |
| :--- | :--- | :--- |
| **Riss-Kammern** (Rift, Ebene I–III jedes Sektors) | Elite-Wellen aus dem *nächsten* Sektor, z. B. `crystal_crawler`/`resonance_warden` (S2) in S1, `solar_drone`/`forge_golem` (S3) in S2, `void_wraith`/`monolith_guard` (S4) in S3 | Sektor des Wirts (`riftSector`) |
| **∞ Unendliche Spirale** | gemischte Packs aus S1–S4 (`phase_stalker`, `prism_drone`, `ember_stalker`, `shard_sniper`, `forge_golem`, `void_wraith`, `resonance_warden`, `solar_drone`, `monolith_guard`, `star_lancer`, `magma_mortar`, `void_crawler`) **und** die vier Endbosse in wechselnden Biomen (z. B. Leviathan im S3-Biom, Vulkan-Titan im S1-Biom) | `floor.visualSector` (S1→S4 im Wechsel) |
| **Omega-Anomalie** (5. Tor) | `monolith_guard`, `void_wraith`, `star_lancer`, `forge_golem`, `ember_stalker`, `resonance_warden`, `phase_stalker` | S5 (Omega) |
| künftige Challenges/Prüfungen | alles, was dort gemischt wird | Biom des Raums |
Neue Mischungen (neue Pools, Challenges, Events) → diese Tabelle ergänzen.

**Einteilung der Effekte:**
- **Körper-Effekte** (Funken, Sporen, Laser, Mündungsblitz, Kristallsplitter *des Gegners*, Rauch aus dem Körper): Farbe = Gegner → **ein** Sheet, gilt überall.
- **Boden-Effekte** (Risse, Krater, Einschlagloch, Staub-/Dreckwolke, Brand-/Schmelzfleck, Trümmer aus dem Boden, Bodenwelle, Todes-Rückstand am Boden): Farbe/Material = **Boden des Raums** → **Biom-Varianten S1–S5**.

**Sheet-Format Biom-Variante (Typ E, 3×2, `1536×1024`):** `art_source/rigs/<id>_ground.png` (bei mehreren Boden-Effekten `<id>_ground2.png` …) — Zelle 1–5 = **derselbe** Boden-Effekt im Material von S1 Verlassene Korvette (Rost-Metallplatten, Moos) · S2 Kristall-Nebel (violett-cyan Kristallboden) · S3 Solar-Gießerei (Lava-Gestein, Glut) · S4 Ältesten-Monolith (Obsidian, Sternenstaub) · S5 Omega-Anomalie; Zelle 6 = biom-neutraler Todes-Rückstand des Gegners (optional). Referenz: Effekt-Sheet des Gegners + Bodenkacheln/Hintergrund der fünf Sektoren.

**Im Boss-Labor (`?bosslab`):** Zeile **Biom** (Auto · S1 · S2 · S3 · S4 · Ω) lädt die Arena im gewählten Biom — für Bosse **und** einzelne Gegner, Auswahl bleibt erhalten. So prüfst du G10/D15 (z. B. Vulkan-Titan in S1, Kristall-Krabbler in S4/Ω). Das Labor ist handytauglich: Tabs *Bosse / Gegner / Mehr*, Pause/Phase II/Neu/Schließen immer sichtbar, eingeklappt auf dem Handy.

**Im Code:** Biom des aktuellen Raums = Riss-Kammer → `currentRoom.riftSector`, Spirale → `floor.visualSector`, sonst `currentSector` (S5 = Omega). Die Boden-Zelle wird nach diesem Biom gewählt; fehlt die Variante → Heimat-Variante + Tönung (Fallback, Sheet in `SPRITE_QUEUE.md` bestellen). Rein optisch, kein Zufall.

**Pflicht in Stufe 3 (Sprite-Liste):** für jeden Gegner/Boss prüfen, ob er in der Tabelle oben vorkommt **und** Boden-Effekte hat (Aufschlag, Stampfer, Sturz, Tod am Boden, Spuren) → `<id>_ground.png` mit einplanen. Checklisten-Punkt **G10** (Gegner) bzw. **D15** (Bosse) in `BOSS_ANIMATION_PLAN.md`.

## 5b. New Game+ & ∞ Spirale — eigener Look & Echo-Varianten (PLAN, Entscheidungen 2026-11-27, noch nicht umgesetzt)
> **Status: Plan mit beantworteten Fragen (§5b.4).** Umsetzung erst auf Startsignal des Projektinhabers; Sprites stehen in `SPRITE_QUEUE.md` P4b als `[~]` bis dahin.

**Ausgangslage (Stand heute):** NG+ ändert nur **Werte** (`ngPlusLevel`), nicht das **Aussehen**. Die ∞ Spirale wechselt nur die vier Sektor-Biome (S1→S4, `visualSector`) und mischt Gegner/Bosse — ohne eigenen Look. Beides soll sich sichtbar nach „Endgame“ anfühlen.

**Leitidee:** Was für alle Wesen gleich gilt (Aura, Boden-Effekte, Hintergrund), wird **einmal gemeinsam** gezeichnet; nur die **Echo-Varianten mit neuen Attacken** (§5b.3) brauchen eigene Sprites pro Wesen.

### 5b.1 NG+-Look — dezente Aura (entschieden)
- **Nur Aura, kein Namens-Zusatz.** Stufen nach `ngPlusLevel`: NG+1–2 = schwache, kühle weiß-cyan Aura („Echo“, langsam pulsierend) · NG+3–5 = etwas kräftiger + wenige Funken · NG+6+ = kräftig + Funkenkranz. Immer **dezent** (kein Verdecken des Gegners/Telegraphs). Bewusst **nicht** golden (Gold = Elite-Rand, M10-C).
- **Umsetzung:** gemeinsames Effekt-Sheet `art_source/rigs/ngplus_aura.png` (`P4-01`), skaliert nach Gegnergröße, plus leichte Tönung per Code. Rein optisch. Bosse bekommen dieselbe Aura (größer).

### 5b.2 Spiralen-Biom — eigenes Biom mit eigenem Hintergrund (entschieden)
- Die ∞ Spirale bekommt ein **eigenes sechstes Biom „Spirale“** (Singularität · Echo-Dimension, dunkles Violett-Weiß mit Leere-Rissen und schwebenden Splittern) mit **eigenem Raum-Hintergrund** `public/art/dungeon_bg_spiral.png` (`960×540`, wie `dungeon_bg_s2–s4`), eigenen Bodenkacheln/Hindernissen und eigener Musik/Tönung (später). Die Spirale zeigt **nicht mehr** S1–S4 im Wechsel, sondern ihr eigenes Biom (die Sektor-Echos als Gegner-Pools bleiben).
- **Boden-Effekte** (Regel 16): Gegner in der Spirale nutzen ein **gemeinsames** Spiralen-Boden-Effekt-Sheet `art_source/rigs/spiral_ground.png` (`P4-02`) — kein zusätzliches `_ground`-Sheet pro Gegner nötig. Das Biom „Spirale“ ist **Biom 6** der Auswahl (`riftSector` → `floor.visualSector` → `currentSector`; Spirale = eigener Wert `spiral`).
- **Endbosse in der Spirale:** vorerst Standardraum im Spiralen-Biom (M12 §10.3); Arena-Variante erst nach den Arena-Bossen (M12 Phase D+).
- **Neue Sprites (alle optional mit Fallback = Tönung von S4):** Hintergrund (`P4-03`), Hindernisse/Deko-Set (`P4-04`), Spiralen-Boden-Effekte (`P4-02`).

### 5b.3 Echo-Varianten mit neuen Attacken (entschieden — als eigener Meilenstein, Pilot zuerst)
- **Echo-Elite** = Variante eines vorhandenen Gegners mit **einem zusätzlichen Zug**, in NG+ (ab Stufe 1) und in der Spirale. Aussehen: Rig des Originals + Echo-Aura (§5b.1) + Echo-Tönung; der **neue Zug** bekommt eigene Posen und eine eigene Angriffsgrafik (Effekt-Sheet pro Variante, `<kind>_echo_fx.png`).
- **Pilot (2 Stück, nach Abnahme Serie):** je ein Fernkämpfer und ein Nahkämpfer aus Sektor 1, damit das Format trägt (Vorschlag: Drohne — „Echo-Salve“ (Nachbild feuert versetzt), Phasen-Jäger — „Echo-Sprung“ (Doppelgänger-Spur)). **STOP-GATE:** erst nach Abnahme im Spiel weitere Varianten.
- **Regeln:** neue Züge ≥ 0,4 s telegrafiert, deterministisch (kein globaler Zufall), Werte in `src/data/balance.ts` (separate, normierte Prüfungs-Werte für die feste Wochen-Herausforderung), Auftreten über deterministische Tabelle (nicht in jedem Raum), eigener Test, Checkliste G1–G10 gilt zusätzlich für den neuen Zug. **Enthalten in der festen Wochen-Herausforderung** (siehe 5b.4).
- Eintrag im Steckbrief (§2) je Variante; Sprites in `SPRITE_QUEUE.md` P4b (`P4-05` ff., erst nach Pilot-Freigabe).

### 5b.4 Entscheidungen (Projektinhaber, 2026-11-27)
1. NG+-Marker: **dezente Aura**, kein Namens-Zusatz. ✅
2. Spiralen-Look: **eigenes Spiralen-Biom mit eigenem Hintergrund.** ✅
3. **Echo-Varianten mit neuen Attacken** (Gameplay-Neuerung) — ja. ✅
4. **Wochen-Prüfung (Klarstellung des Inhabers):** Es gibt **eine feste Wochen-Herausforderung, die nicht wechselt und alles beinhaltet** — Arena-Boss, Spiralen-Biom/Look, NG+-Aura, Echo-Varianten mit neuen Attacken, Sektor-Mechaniken. Das **Rotieren** (wechselnder Sektor/Mutator je Kalenderwoche, `getCurrentWeeklyTrial` in `weeklyTrial.ts`) wird **später** wieder eingeschaltet, wenn der Inhaber alles testen kann. ✅
   - **Umsetzung (nach Startsignal):** `getCurrentWeeklyTrial` bekommt einen Schalter `TRIAL_ROTATION_ENABLED` (Standard `false` in dieser Phase) und eine feste `FIXED_TRIAL`-Definition (Layout-Seed, Mutator, Inhalte). Solange `false`, liefert jede Woche dieselbe Herausforderung; die Wochen-ID bleibt für die Bestenliste (Rekorde je Woche) erhalten. Alles Neue hängt an einem Gate wie `TRIAL_ARENA_FROM_WEEK`, damit die **laufende Woche nicht kippt**.
   - **Normierung bleibt:** feste Ausrüstungsstufen (`TRIAL_COMBAT_LEVELS`), kein Loot/Credits, keine Waffen-Sperren-Auswirkung — die Echo-Varianten/Arena-Werte werden dafür **mit eigenen Prüfungs-Werten** in `balance.ts` kalibriert (Messung `m10cp10`).
   - **Später:** Rotation wieder an → die Inhalte werden zu einem Pool (z. B. Sektor-/Boss-/Biom-Auswahl je Woche); Vorbereitung: Inhalte als Daten (`TrialContentDef`), nicht fest im Code verdrahtet.
   - Im Plan §5b.3 gilt damit **nicht mehr** „nicht in der Wochen-Prüfung“: Echo-Varianten sind **in** der festen Herausforderung enthalten.

### 5b.5 Im Boss-Labor & in der Checkliste
- Labor (`?bosslab`): Biom-Zeile bekommt **„Spirale“**, dazu Schalter **NG+ 0–6**; Echo-Varianten als eigene Einträge in der Gegnerliste. Alles optisch bzw. nur im Labor.
- **G11/D16 (ab Umsetzung):** *„NG+-Aura/Spiralen-Optik sitzt sauber (Größe, Mittelpunkt), verdeckt kein Telegraph, im Labor mit NG+/Spirale geprüft.“* Bis zur Umsetzung nicht Pflicht.

## 6. Verknüpfte Dokumente
[AGENTS.md](AGENTS.md) §3 Regeln 7, 11–13 · [BOSS_ANIMATION_PLAN.md](BOSS_ANIMATION_PLAN.md) · [MILESTONE_12_ARCHITECTURE.md](MILESTONE_12_ARCHITECTURE.md) · [RIGGING_GUIDE.md](RIGGING_GUIDE.md) · [ART_BRIEF_M11.md](ART_BRIEF_M11.md) · [ART_BRIEF_M11_ENEMIES.md](ART_BRIEF_M11_ENEMIES.md) · [SPRITE_QUEUE.md](SPRITE_QUEUE.md) · [PARALLEL_WORK.md](PARALLEL_WORK.md)
