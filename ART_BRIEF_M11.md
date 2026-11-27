# Sprite-Briefing M11 (v2) — Posen statt nur Drehen

> **Für:** Antigravity / Gemini (`generate_image`) · **Von:** Claude Code · **Stand:** Kern-Wächter komplett, Krall Arme/Rumpf fertig (siehe `HANDOFF.md`)
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
8. **Qualität vor Menge:** bei einer neuen Serie erst **1 Sheet pro Typ** erzeugen und prüfen lassen (Qualitäts-Check), danach die übrigen. **Nicht an Credits sparen:** gefällt ein Sheet nicht oder passt es technisch nicht, wird ein Ersatz bestellt (`SPRITE_QUEUE.md` §0, `AGENTS.md` Regel 14).

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
| *(Zusatz K-A, P0-09)* `krall_torsos2.png` | S | **Phase-2-Rümpfe** (Skelettrahmen, Rückenpanzer ab, Kern offen — wie Zelle 5 von `krall_torsos.png`): geduckt · aufgerichtet (Kern hell, Magnet-Zug) · nach vorn gebeugt (Stoß) · Stampfer-Landung gestaucht · seitlich gedreht (Schrott-Wurf) · überhitzt (Funken). Furnace-Kern im Fadenkreuz. Prompt: „6 pose variants of the same exposed-frame scrap robot torso, pixel art, white background, 3×2 grid, core glowing at cell centre, same style as reference“ |
| *(Zusatz K-B, P0-10)* `krall_legs_R2.png` / `krall_legs_L2.png` | L | **Beine für Angriffe**: Ausfall gestreckt (Stoß) · Bremsen/Rückstoß · Stampfer-Landung gespreizt · Phase 2 beschädigt/humpelnd · Magnet-Stemmen (Krallen im Boden) · Ruhe-Zittern. Hüftring im Fadenkreuz, L nicht gespiegelt, Licht links-oben |
| *(Zusatz K-C, P0-06/07)* `krall_arms_R2.png` / `krall_arms_L2.png` | L | **Angriffsposen der Arme**: Stoß teleskopiert kurz · mittel · voll ausgefahren (lang gestreckt, Zange weit offen) · Zange schnappt zu · Sog-Haltung (Zange/Haken offen, Funken) · Hagel: Arm hoch, Schrottbrocken gepackt. Schulterring im Fadenkreuz, L nicht gespiegelt, Licht links-oben |
| *(Zusatz K-D, P0-08)* `krall_fx2.png` | E | Stoß-Luftwelle/Streifenkopf · Magnet-Feldring rot/blau · Magnet-Blitzbogen · Staub-/Druckring · Aufschlag-Krater mit Schrottsplittern · Rostwolke. Je Effekt zentriert im Fadenkreuz, weißer Hintergrund |
| *(Zusatz K-E, P0-11/12)* `krall_torsos3.png` + `krall_arms_R3.png` / `krall_arms_L3.png` | S / L | **Beschädigungsstufen** (Mindeststandard jedes Bosses): Rumpf Phase 1 leicht · mittel · schwer, Phase 2 leicht · schwer · **kritisch (< 15 %)**; Arme je Seite verbogen (3 Posen) und abgebrochen mit Funken (3 Posen). Kern/Schulterring im Fadenkreuz |
| *(Zusatz K-A2, P0-14)* `krall_torsos2.png` (neu) | S | **Maßstab-Korrektur Phase-2-Rümpfe:** dieselben 6 Posen (geduckt · aufgerichtet/Kern hell · vorgebeugt · Stampfer gestaucht · Wurf-Drehung · überhitzt), aber der Körper ist **so breit und hoch wie der Panzer-Rumpf** aus `krall_torsos.png` Zelle 1 (Referenz-Maßstab!). Kragen/Kern auf gleicher Höhe, Kern im Fadenkreuz. Prompt: „same 6 pose variants of the exposed-frame scrap robot torso, but drawn LARGER — body fills the same width and height as the armored torso in the reference cell 1, pixel art, white background, 3×2 grid, core at cell centre“ |
| *(Zusatz K-F, P0-15…18)* `krall_arms_R4/L4/R5/L5.png` | L | **Beschädigte Arme in allen übrigen Posen:** je Seite zwei Sheets — `R4`/`L4` = **verbogen**, `R5`/`L5` = **abgebrochener funkender Stumpf**; jeweils 6 Posen: seitlich · Block · Boden-Stampfer · Sog (Funken) · Hagel/Wurf-Halten · Teleskop voll ausgefahren. Gelenk/Schulterring im Fadenkreuz, L nicht gespiegelt (Licht links-oben). Prompt: „6 pose variants of the damaged scrap-robot arm (bent claw / broken sparking stump with cables), same style and scale as reference, white background, 3×2 grid, shoulder ring at cell centre“ |
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
| `core_warden_fx.png` *(Zusatz, `SPRITE_QUEUE.md` P3-20)* | E | Energie-Effekte: Ring (hohl) · Visier-Glitzern · Ladekugel · Blitz A · Blitz B · Funkenstern; Mitte der Zelle = Mittelpunkt, Gold-Gelb/Rosé wie die Faust-Schweife |
| `core_warden_arms_R4.png` / `core_warden_arms_L4.png` *(Zusatz, `SPRITE_QUEUE.md` P3-18/19)* | L | **Phase-1-Armschäden (HP < 65 %)**: dieselben 6 Hauptposen wie `arms_R/L` (hängend · Ausholen · Schlag · seitlich · Block · Stampfer), aber **beschädigt**: Risse, verbogene/abgesprungene Panzerplatten, Funken, angeschlagene Schulterkappe; Faust bleibt vorhanden (Phase 2 hat eigene Faust-lose Sets); Schulterring im Fadenkreuz, links/rechts getrennt gezeichnet, Licht links-oben |

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

*(Die genauen Zellenlisten legen wir erst fest, wenn Krall und Kern-Wächter im Spiel gut aussehen — damit die Serie auf einem abgenommenen Vorbild aufbaut. Zusätzliche Sheets je Boss sind erwünscht, siehe `BOSS_ENEMY_PIPELINE.md` §0.)*

### 4.4 Normale Gegner
**Ersetzt durch [`ART_BRIEF_M11_ENEMIES.md`](ART_BRIEF_M11_ENEMIES.md):** normale Gegner werden wie Bosse als **Teile-Sheets (Typ G)** gerigged — mit Zellenliste, Gelenken und Prompt pro Gegner. Prozedurale Code-Beine wurden verworfen (passen nicht zum Pixel-Art-Stil); die frühere 2×2-Pose-Sheet-Idee ist damit ebenfalls überholt.

---

## 5. Dateien & Ablage

| Was | Pfad |
| :--- | :--- |
| Roh-Sheets (verlustfreie PNG, 512×512 pro Zelle) | `art_source/rigs/<boss>_arms_L.png`, `…_arms_R.png`, `…_legs_L.png`, `…_legs_R.png`, `…_heads.png`, `…_torsos.png`, `…_effects.png`, `…_parts.png` |
| Prüfbilder (**nicht committen**, stehen in `.gitignore`) | `art_source/_check/…_check.png` (erzeugt `npm run art:check`) |
| Fertige, importierte Teile | `public/art/rigs/<boss>/…` (macht der Code, später `npm run art:import`) |

Commit-Nachricht: `art(m11): <boss> <sheet>` · danach `HANDOFF.md` („M11 Art-Sheets“) aktualisieren.

---

## 6. Prüf-Workflow vor jedem Commit
1. `npm run art:check -- art_source/rigs/<datei>.png` (Typ L/S: Standard 3×2).
2. Prüfbild öffnen (`view_file`): **Das Gelenk (runder Ring) liegt im roten Fadenkreuz** jeder Zelle? Nichts berührt den magentafarbenen Zellrand? (⚠-Warnung im Terminal.)
3. Liegt das Gelenk daneben → die Pose per PIL so verschieben, dass es **zentriert** ist (Teil als Ganzes verschieben, nicht skalieren), und neu speichern.
4. Gleiche Größe in allen Zellen? Hand/Kopf richtig herum? Links/Rechts wirklich unterschiedlich gezeichnet?
5. Erst dann committen und pushen.

---

## 7. Bereits umgesetzt (Code-Seite)
Import-Modi `limb`/`swap` (`npm run art:import`) und `PartPose.variant` sind fertig — Details und Einbinden neuer Sheets: [`RIGGING_GUIDE.md`](RIGGING_GUIDE.md) §3–§5.
