# Sprite-Briefing M11 (v2) — Posen statt nur Drehen

> **Für:** Antigravity / Gemini (`generate_image`) · **Von:** Claude Code · **Stand:** nach den Pilot-Sheets Krall & Kern-Wächter
> **Kurz:** Die ersten Teile-Sheets (`*_parts.png`) reichen für Ruhe/Gehen, aber nicht für Angriffe. Hände, Arme und Köpfe brauchen **echte Posen aus dem richtigen Blickwinkel**, **links und rechts getrennt gezeichnet** (nicht gespiegelt). Mehr Sprites sind ausdrücklich erwünscht.

**So benutzt du dieses Dokument:**
1. §1 + §2 einmal lesen (Warum, goldene Regeln).
2. Aufträge **in der Reihenfolge von §4** abarbeiten (zuerst Krall & Kern-Wächter, §4.1/§4.2).
3. Jedes Sheet mit `npm run art:check -- <datei>` prüfen (§6), dann ablegen und pushen.
4. Code (Claude Code) baut danach die Anbindung — du musst nichts importieren (`npm run art:import` kommt mit den neuen Sheet-Typen).

---

## 1. Warum v2? (Was bei den Piloten schiefging)

| Beobachtung im Spiel | Ursache | Lösung |
| :--- | :--- | :--- |
| Fäuste des Kern-Wächters wirken **verkrampft**, hängen schief am Arm | Faust wurde **seitlich** (Manschette links) und nur in **einer** Pose gezeichnet; der Code kann sie nur drehen, nicht „neu malen“ | **Komplette Arme inkl. Hand** pro Pose zeichnen (Typ L, §3.2) |
| Krall hat **nur einen Arm** | Es gab nur **ein** Arm-Teil; Gegenstück war gespiegelt/fehlte | **Linker und rechter Arm als eigene Sheets** (links ≠ rechts, z. B. Zange und Haken) |
| Alte Modelle wirken **runder** | Teile wurden eckiger/größer zusammengesetzt; Schulter/Kappen fehlen als Rundung | Arme enthalten ihre **Schulterkappe**, Rumpf-Varianten (Typ S) haben eigene Schultern |
| Angriffe sehen nach „Drehen“ aus | Aus **einem** Bild lässt sich nur rotieren, nicht verkürzen (Schlag zur Kamera) | **Pose-Sets**: hängen, ausholen, Schlag zur Kamera, seitlich, blocken … |

**Grundidee:** Der Code **tauscht** pro Moment das passende Bild (wie Frames) und dreht/verschiebt nur noch fein. Dafür müssen alle Posen eines Gliedes **dasselbe Gelenk an derselben Stelle** haben → Regel „Gelenk in Zellmitte“.

---

## 2. Goldene Regeln (gelten für ALLE Sheets)

1. **Gelenk = exakte Zellmitte (Typ L/S).** Der runde Schulter-/Halsring (das Drehgelenk) liegt in **jeder** Zelle genau in der Mitte der 512×512-Zelle. Nur so passen alle Posen deckungsgleich aufeinander.
2. **Gleicher Maßstab überall.** Referenz: der Rumpf des Bosses ist ca. **330 px** hoch (wie in den Pilot-Sheets). Ein kompletter Arm vom Gelenk bis zur Fingerspitze ist **höchstens ~240 px** lang, damit er in die Zelle passt (Zellmitte ± 256 px).
3. **Aufrecht und richtig orientiert.** Hände/Köpfe **nicht seitlich** zeichnen. In jeder Pose so, wie sie am zusammengesetzten Boss aussähe — Blickwinkel: dieselbe **3/4-Draufsicht** wie die bestehenden Boss-Sprites.
4. **Links und rechts getrennt zeichnen.** Rechter Arm = eigenes Bild (nicht gespiegeltes Linksbild). **Licht kommt immer von links oben**, auch beim rechten Arm. Asymmetrische Details (Zange vs. Haken) sind erwünscht.
5. **Gleiches Design wie das Referenzbild.** Das bestehende Sprite (`public/art/sprites/…`) und das Pilot-Sheet (`art_source/rigs/…_parts.png`) als Referenz mitgeben: *„keep exactly this character design, colors, outline and scale“*.
6. **Sauberes Sheet:** reiner Hintergrund `#FFFFFF`, ≥ 30 px Weißrand, nichts berührt den Zellrand, **keine** Rasterlinien, **keine** Mittenmarkierung, kein Text, kein Bodenschatten.
7. **Raster 3×2** (6 Zellen) bei `AspectRatio: '3:2'` (ideal 1536×1024), außer anders angegeben. Zellen-Reihenfolge ist fest (Zeile für Zeile, links → rechts).
8. **Qualität vor Menge:** erst **1 Sheet pro Typ** erzeugen und prüfen lassen (Credits sparen), danach die übrigen.

---

## 3. Sheet-Typen

### 3.1 Typ P — Teile-Sheet (wie bisher)
Einzelteile eines Bosses (Rumpf, Platten, Magnet …). Bleibt für Dinge, die nur **fliegen/abfallen** (Platten, Schrott, Kristalle). Format wie in `MILESTONE_11_ARCHITECTURE.md` §2.1.

### 3.2 Typ L — Gliedmaßen-Posen (Arm/Bein **komplett**, ein Sheet pro Seite)
- Dateiname: `art_source/rigs/<boss>_arms_L.png` und `…_arms_R.png` (Beine: `<boss>_legs_L.png`, `…_legs_R.png`).
- 6 Posen **desselben** Gliedes, Gelenk (Schulter/Hüfte) in **jeder** Zelle in der Mitte (Regel 1).
- Das Glied ist **komplett** (Schulterkappe → Oberarm → Unterarm → Hand/Werkzeug), die Hand sitzt **richtig herum** am Unterarm.

**Standard-Posen für Arme (Reihenfolge):**
1. **Hängend entspannt** (Ruhe/Gehen)
2. **Ausholen** (Ellbogen angewinkelt, Hand/Faust hoch hinter/über Schulterhöhe)
3. **Schlag zur Kamera** (Faust/Werkzeug vorgestreckt **auf den Betrachter zu**, stark verkürzt, Hand groß im Vordergrund)
4. **Seitlich ausgestreckt** (waagerecht nach außen, z. B. für Laser/Strahl)
5. **Block** (Arm angewinkelt vor die Brust)
6. **Boden-Stampfer** (Hand/Faust nach unten auf den Boden gedrückt, offene Hand oder Werkzeug aufgesetzt)

**Standard-Posen für Beine (Spinnen-/Laufwesen):**
1. **Schritt vor** (Fuß vorn aufgesetzt) · 2. **Schritt zurück** · 3. **Standbein** (gestreckt, trägt Last) · 4. **Angehoben** (Fuß in der Luft) · 5. **Geduckt** (tief, Knie weit gebeugt) · 6. **Absprung** (gestreckt nach unten drückend)

### 3.3 Typ S — Tausch-Sets (Kopf, Rumpf)
- Dateiname: `<boss>_heads.png`, `<boss>_torsos.png` (Raster 3×2).
- **Kopf:** Halsgelenk (Unterseite des Kopfes) in der **Zellmitte**. **Rumpf:** der **Reaktor-/Kernpunkt** (Zentrum der Brust) in der Zellmitte; Standfläche zeigt nach unten.
- **Kopf-Posen:** 1 neutral · 2 brüllend/Maul bzw. Visier offen · 3 nach unten geneigt (zielend) · 4 zurückgeworfen (getroffen) · 5 Phase 2 (glühend/wütend) · 6 beschädigt/flackernd (Halo/Krone gestört).
- **Rumpf-Posen:** 1 normal · 2 geduckt (Anlauf) · 3 nach hinten gelehnt (Ausholen) · 4 nach vorn gebeugt (Schlag) · 5 **Phase 2 aufgebrochen** (Panzer ab, Kern offen) · 6 beschädigt/überhitzt.

### 3.4 Typ E — Effekt-/Geschoss-Sheets (optional)
Kleine Dinge, die der Boss wirft oder erzeugt (Schrottklumpen, Funken, Splitter, Kristalle). 3×2, jedes Teil **in der Zellmitte**, ca. 64–160 px groß.

---

## 4. Aufträge (in dieser Reihenfolge)

> **Alle Prompts bauen auf dieser Vorlage auf** (Formel L für Typ L, Formel S für Typ S). Das bestehende Sprite und das Pilot-Sheet immer als Referenzbild mitgeben.

**Formel L (Gliedmaßen):**
```text
Crisp 16-bit/32-bit indie RPG pixel art LIMB POSE SHEET for cut-out animation, clean 3x2 grid on a pure solid flat white #FFFFFF background,
every pose fully inside its own cell with generous white margin, nothing touching cell borders.
3/4 top-down Moonlighter cozy retro sci-fi action RPG style, dark crisp pixel outlines, rich readable shading, light from the UPPER LEFT in every cell.
Character: <Boss-Beschreibung>. This sheet shows its <LEFT/RIGHT> <ARM/LEG>, drawn COMPLETE from shoulder/hip to hand/foot,
with the hand or tool drawn in the correct orientation for each pose (NOT sideways).
CRITICAL: in EVERY cell the round shoulder/hip joint (pivot ring) sits at the EXACT CENTER of the cell. Same scale in every cell:
a fully extended limb is about 230 px long at this scale (the character's torso would be about 330 px tall).
Poses (row by row, left to right): 1) <Pose>, 2) <Pose>, 3) <Pose>, 4) <Pose>, 5) <Pose>, 6) <Pose>.
Zero text, zero labels, no grid lines, no center marks, zero ground shadows.
```
**Formel S (Köpfe/Rümpfe):** wie oben, aber „HEAD/TORSO VARIANT SHEET“, „the neck joint (bottom of the head) / the reactor core (center of the chest) sits at the EXACT CENTER of every cell“, gleicher Maßstab, danach die 6 Posen.

### 4.1 Auftrag A — **Krall** (Schrott-Sammler, Referenz: `public/art/sprites/boss_breacher.png` + `krall_parts.png`)
Krall bekommt **zwei verschiedene Arme** (Persönlichkeit!): **rechts die Greifzange, links einen Schrott-Haken mit kleiner Kreissäge**.

| Datei | Typ | Inhalt (Zellen 1–6) |
| :--- | :--- | :--- |
| `krall_arms_R.png` | L | **rechter Arm = lange Greifzange** (Teleskop-Arm, mehrere Gelenke): hängend · ausholend (zurückgezogen) · **Stoß zur Kamera** (Zange weit geöffnet, verkürzt) · seitlich ausgestreckt · Block (Zange vor dem Körper geschlossen) · Boden-Stampfer (Zange in den Boden gerammt) |
| `krall_arms_L.png` | L | **linker Arm = Schrott-Haken mit Mini-Säge** (anderer Look als die Zange): gleiche 6 Posen |
| `krall_legs_R.png` | L | **rechte Beine** (vorderes Bein, 1–3 · hinteres Bein, 4–6) — alternativ 6 Posen eines Beins, wenn das Raster sonst zu voll wird: Schritt vor · Schritt zurück · Standbein · angehoben · geduckt · Absprung |
| `krall_legs_L.png` | L | **linke Beine**, gleiche Posen, nicht gespiegelt |
| `krall_torsos.png` | S | Rumpf mit Furnace-Kern: normal · geduckt · aufgerichtet (Kern leuchtet hell, für Magnet-Zug) · nach vorn gebeugt (Stoß) · **Phase 2: Rückenpanzer abgeworfen, Rahmen und Kern offen** · beschädigt (Funken, Dellen) |
| `krall_effects.png` | E | 1 Schrottklumpen A · 2 Schrottklumpen B · 3 Schrottklumpen C (Wurfgeschosse) · 4 Magnet **aktiv** (Funkenbögen) · 5 Magnet inaktiv · 6 Funken-/Rost-Splitter |

### 4.2 Auftrag B — **Kern-Wächter** (Referenz: `public/art/sprites/boss.png` + `core_warden_parts.png`)
Wichtig: **runde, große Schulterkappen** (das alte Modell wirkte runder) und Fäuste **richtig herum** (Faust hängt **nach unten**, Handgelenk-Manschette oben am Unterarm).

| Datei | Typ | Inhalt (Zellen 1–6) |
| :--- | :--- | :--- |
| `core_warden_arms_L.png` | L | **linker Arm komplett inkl. runder Schulterkappe und Faust**: hängend · **Faust hoch (Ausholen)** · **Schlag zur Kamera** (Faust groß, verkürzt) · seitlich ausgestreckt (Laser-Pose, Handfläche nach vorn) · Block (Arm vor der Brust, Faust geballt) · Boden-Stampfer (offene flache Hand nach unten gedrückt) |
| `core_warden_arms_R.png` | L | **rechter Arm**, gleiche Posen, nicht gespiegelt gezeichnet |
| `core_warden_heads.png` | S | Helm mit Halo: neutral · Visier offen/brüllend · nach unten (zielend) · zurückgeworfen · Phase 2 (Augen rot glühend, Halo größer) · beschädigt (Halo flackernd, Riss) |
| `core_warden_torsos.png` | S | Rumpf mit Reaktor: normal · geduckt (Sturm-Anlauf) · nach hinten gelehnt · nach vorn gebeugt · **Phase 2: Brustpanzer weg, Reaktorkern offen und glühend** · überhitzt (Kern weiß-gelb, Dampfrisse) |
| `core_warden_parts.png` (vorhanden) | P | bleibt für die **wegfliegenden Brustplatten** (Phase 2) |

### 4.3 Danach: die übrigen Bosse (Kurzfassung)
Für jeden Boss: **Arme L+R (Typ L)**, **Kopf/Rumpf (Typ S)**, ggf. Beine, Effekte. Individuelle Besonderheiten:

| Boss | Besonderheit für die Sets |
| :--- | :--- |
| Leviathan | Arme als **Segment-Ketten** (je 2 Posen-Sheets: Oberarm, Klaue); Kern-Varianten (geschlossen/offen) |
| Quarz-Koloss | Fäuste als **Raketenfaust** (ausgestreckt, mit Antriebsflamme) in den Arm-Posen; Rumpf **gespalten** (für „Teilen“) |
| Prisma-Weberin | Webarme sehr lang und dünn; Prismen einzeln (Typ E) in 3 Leuchtstufen |
| Prisma-Archon | Flügel als Typ L (Flügel L/R: gefaltet · gespreizt · schlagen auf/ab · Strahl-Pose · Phase 2 zerbrochen) |
| Schlacken-Koloss | **Kugel-Pose** (eingerollt) als Rumpf-Variante für den Rollangriff; Arme: hängend · Faust auf den Boden |
| Gießerei-Meisterin | Arm mit **Hammer** komplett (Ausholen weit zurück · Schlag zur Kamera · Hammerwurf) + zweiter Hammer für Phase 2 |
| Vulkan-Titan | Magma-Fäuste (Arme L/R), Brust offen (Phase 2) |
| Chrono-Wächter | **Zeiger** als Typ L (großer/kleiner Zeiger in 6 Stellungen) und Zahnringe (Typ E) |
| Monolith-Koloss | Platten-Körper: 6 Platten-Anordnungen (Typ S: zusammen · weit auseinander · als Säulen) |
| Sternen-/Omega-Archon | Flügel (Typ L), Arme beim „Sternbild zeichnen“, Körper **in zwei Hälften** (für Teilen) |

*(Die genauen Zellenlisten legen wir erst fest, wenn Krall und Kern-Wächter im Spiel gut aussehen — spart Credits.)*

### 4.4 Normale Gegner
**Ersetzt durch [`ART_BRIEF_M11_ENEMIES.md`](ART_BRIEF_M11_ENEMIES.md):** normale Gegner werden wie Bosse als **Teile-Sheets (Typ G)** gerigged — mit Zellenliste, Gelenken und Prompt pro Gegner. Prozedurale Code-Beine wurden verworfen (passen nicht zum Pixel-Art-Stil); die frühere 2×2-Pose-Sheet-Idee ist damit ebenfalls überholt.

---

## 5. Dateien & Ablage

| Was | Pfad |
| :--- | :--- |
| Roh-Sheets (verlustfreie PNG, 512×512 pro Zelle) | `art_source/rigs/<boss>_arms_L.png`, `…_arms_R.png`, `…_legs_L.png`, `…_legs_R.png`, `…_heads.png`, `…_torsos.png`, `…_effects.png`, `…_parts.png` |
| Prüfbilder (nicht committen nötig) | `art_source/_check/…_check.png` (erzeugt `npm run art:check`) |
| Fertige, importierte Teile | `public/art/rigs/<boss>/…` (macht der Code, später `npm run art:import`) |

Commit-Nachricht: `art(m11): <boss> <sheet>` · danach `HANDOFF.md` („M11 Art-Sheets“) aktualisieren.

---

## 6. Prüf-Workflow vor jedem Commit
1. `npm run art:check -- art_source/rigs/<datei>.png` (Typ L/S: Standard 3×2; Pose-Sheets 2×2: `-- --cols 2 --rows 2`).
2. Prüfbild öffnen (`view_file`): **Das Gelenk (runder Ring) liegt im roten Fadenkreuz** jeder Zelle? Nichts berührt den magentafarbenen Zellrand? (⚠-Warnung im Terminal.)
3. Liegt das Gelenk daneben → die Pose per PIL so verschieben, dass es **zentriert** ist (Teil als Ganzes verschieben, nicht skalieren), und neu speichern.
4. Gleiche Größe in allen Zellen? Hand/Kopf richtig herum? Links/Rechts wirklich unterschiedlich gezeichnet?
5. Erst dann committen und pushen.

---

## 7. Was Claude Code danach baut (zur Info)
- Neue Import-Modi in `npm run art:import`: **`limb`/`swap`** (kein Zuschneiden auf das Teil, sondern Zellmitte = Gelenk; gemeinsamer Maßstab).
- Engine: `PartPose.variant` (welche Pose/Bildvariante gerade gezeigt wird) + Überblendung; Boss-Zugfolgen wählen Posen (Ausholen → Schlag zur Kamera → Rückschwung).
- Danach: Phase 3 des Plans (Angriffe der Sektor-1-Bosse) mit den neuen Sheets.
