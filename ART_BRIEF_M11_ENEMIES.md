# Sprite-Briefing M11 — Normale Gegner als Rigs (Teile-Sheets)

> **Für:** Antigravity / Gemini (`generate_image`) · **Von:** Claude Code · **Stand:** nach dem Versuch mit prozeduralen Code-Beinen (verworfen, passte nicht zum Pixel-Art-Stil)
> **Kurz:** Jeder normale Gegner wird wie die Bosse **in Teile zerlegt neu gezeichnet** und im Code gerigged. Keine im Code gemalten Beine/Linien mehr. Jedes Teil wird in **genau dem Stil des bestehenden Sprites** gezeichnet.
> **Abarbeiten:** Stück für Stück, immer wenn wieder Gemini-Volumen frei ist — Reihenfolge in §5. Nach jedem Sheet: `npm run art:check` → pushen → `HANDOFF.md` abhaken.
> Zusammenhang: Boss-Sheets stehen in [`ART_BRIEF_M11.md`](ART_BRIEF_M11.md), Code-Seite in [`RIGGING_GUIDE.md`](RIGGING_GUIDE.md).

---

## 1. Warum so (und nicht mit Code-Beinen)?
- Beine/Arme, die der Code als Linien zeichnet, haben **keine Pixel-Art-Schattierung, keine Outline-Logik, falsche Proportionen** → wirken wie Fremdkörper.
- Viele Gegner haben ihre Beine **bereits im Sprite** (Krabbler, Käfer, Mörser) oder **fliegen** (Scharfschütze mit Jetpack, Drohnen). Zusätzliche Beine sind dort schlicht falsch.
- Lösung: Den **vorhandenen Gegner** in seine natürlichen Teile zerlegt **neu zeichnen lassen** (gleiches Design, gleiche Farben), dann bewegt der Code die echten Pixel-Teile: Beine schreiten, Rohr rollt zurück, Flügel schlagen, Ringe drehen sich, Klingen holen aus.
- **Bis ein Sheet da ist, bleibt der Gegner exakt wie heute** (Einzel-Sprite + dezentes Atmen/Lehnen/Zucken). Nichts geht kaputt, wenn ein Sheet fehlt.

## 2. Goldene Regeln (Typ G = Gegner-Teile-Sheet)
1. **Ein Sheet pro Gegner**, Raster **3×2**, `AspectRatio: '3:2'`, ideal **1536×1024** (512×512 pro Zelle), reiner Hintergrund `#FFFFFF`.
2. **Gelenk = exakte Zellmitte** — bei **jedem** Teil liegt sein Dreh-/Ansatzpunkt genau in der Mitte der Zelle (bei Beinen die Hüfte, bei Armen die Schulter, beim Rohr der Drehbolzen, bei Flügeln die Flügelwurzel, bei Ringen der Ringmittelpunkt, beim Körper der Schwerpunkt/Kern). Die Spalte „Gelenk“ in §4 sagt es pro Zelle.
3. **Ein gemeinsamer Maßstab für alle 6 Zellen:** so gezeichnet, als wäre der **zusammengesetzte Gegner ca. 300 px hoch**. Kein Teil länger als ~230 px vom Gelenk aus (sonst stößt es an den Zellrand).
4. **Gleiches Design wie das Referenzbild** (`public/art/sprites/<datei>.png` immer über `ImagePaths` mitgeben): *„keep exactly this character design, colors, dark outline and shading, light from the upper left“*. Nicht „neu interpretieren“.
5. **Teile vollständig zeichnen** — auch die Stellen, die im Original verdeckt sind (z. B. die Oberseite eines Beins unter dem Panzer, die Rückseite des Rumpfes hinter dem Arm). Der Code schiebt Teile übereinander; Löcher würden sichtbar.
6. **Teile freistehend**, ≥ 30 px Weißrand, nichts berührt den Zellrand, **keine** Rasterlinien, **keine** Mittenmarkierung, kein Text, kein Bodenschatten, keine Effekte außerhalb des eigenen Teils.
7. **Symmetrische Insekten-/Spinnenbeine (Draufsicht):** nur die **linke** Seite zeichnen, der Code spiegelt (bei Gegnern dieser Größe sieht man den Unterschied nicht; wirkt es im Spiel doch gespiegelt, rechte Seite als Zusatz-Sheet bestellen). **Humanoide** (Arme/Beine): links und rechts **getrennt** zeichnen (wie bei den Bossen).
8. **Erst Pilot, dann Serie:** zuerst die 2 Pilot-Sheets aus §5 erzeugen, pushen, vom Projektinhaber im Spiel abnehmen lassen — erst dann weitere.

## 3. Prompt-Vorlage (Formel G)
Platzhalter `<…>` aus §4 einsetzen; **Referenzbild** = Spalte „Referenz“.
```text
Crisp 16-bit/32-bit indie RPG pixel art CUT-OUT PARTS SHEET for rigging, clean 3x2 grid on a pure solid flat white #FFFFFF background,
each part fully inside its own cell with generous white margin, nothing touching cell borders.
3/4 top-down Moonlighter cozy retro sci-fi action RPG style, dark crisp pixel outlines, rich readable shading, light from the UPPER LEFT.
Keep EXACTLY the character design, colors, outline thickness and shading of the reference image: <Gegner-Beschreibung>.
Split this creature into separate parts so it can be animated. Draw every part COMPLETE, including areas that are hidden in the reference.
CRITICAL: in EVERY cell the part's pivot point (<Gelenk-Hinweis>) sits at the EXACT CENTER of the cell.
All parts at the SAME scale, as if the assembled creature were about 300 px tall.
Cells (row by row, left to right): 1) <Teil 1>, 2) <Teil 2>, 3) <Teil 3>, 4) <Teil 4>, 5) <Teil 5>, 6) <Teil 6>.
Zero text, zero labels, no grid lines, no center marks, zero ground shadows.
```
Für eine **zweite Variante** desselben Teils (z. B. Rohr eingefahren/ausgefahren) steht das in der Zellenliste ausdrücklich („same part, second state: …“).

## 4. Aufträge pro Gegner
Spalten: **Zellen 1–6** (Reihenfolge = Prompt), **Gelenk** = was in der Zellmitte liegt, **Bewegung im Code** = wofür die Teile gebraucht werden. Dateiname: `art_source/rigs/<kind>_rig.png`.

### Zusatz Geschütz-Antrieb (`turret_treads.png`, P0-13)
Das Geschütz bewegt sich im Spiel (`scurry`), das Rig hat aber nur Sockel + Gehäuse → es würde gleiten. Zusatz-Sheet: Zellen 1–4 vier Rollphasen **einer linken Raupenkette** (Glieder wandern, rechte Kette spiegelt der Code), 5 kleine Staubwolke, 6 Bremsfunken/Rost-Spritzer. Zellmitte = Kettenmitte, 3/4-Draufsicht, Breite ≈ Sockel. Prompt-Vorschlag: „4 animation frames of one left caterpillar track unit of a small mobile turret, pixel art, same style/palette as the reference turret, white background, 3×2 grid: frames 1–4 track rolling, 5 small dust puff, 6 brake sparks and rust flakes; each centred in its cell“.

### Sektor 1
| Gegner (`kind`) · Referenz | Zellen 1–6 | Gelenk (Zellmitte) | Bewegung im Code |
| :--- | :--- | :--- | :--- |
| **Geschütz** (`turret`) · `turret_0.png` + `turret_1.png` | 1 Sockel/Bodenplatte · 2 Geschützgehäuse (achteckig, ohne Rohr) · 3 Rohr **eingefahren** · 4 Rohr **ausgefahren** (Stand von `turret_1`) · 5 Mündungsring glühend · 6 Lade-Kern (orange Glut, rund) | 1 Mitte Sockel · 2 Drehbolzen des Gehäuses · 3/4 Rohransatz am Gehäuse · 5/6 Mitte | Gehäuse dreht zum Spieler, Rohr fährt beim Laden aus, Rückstoß beim Schuss, Kern pulsiert |
| **Drohne** (`drone`) · `drone.png` | 1 Kugel-Rumpf ohne Düsen · 2 Visier/Auge (lila Glas) · 3 Düsen-Gondel links (die rechte spiegelt der Code) · 4 obere Klappe/Kappe · 5 Düsenflamme · 6 Visier halb geschlossen (blinzeln/zielen) | 1 Kugelmitte · 2 Visiermitte · 3 Gondel-Ansatz · 4 Scharnier · 5 Flammenansatz | Gondeln kippen in Flugrichtung, Klappe öffnet beim Schuss, Visier zielt/blinzelt |
| **Bogen-Drohne** (`drone_arc`) · `enemy_drone_arc.png` | 1 Kugel-Rumpf (gold) · 2 Visier · 3 Tesla-Spule links (rechte gespiegelt) · 4 Düsen-Gondel links · 5 Lichtbogen-Funke (klein) · 6 Lichtbogen-Funke groß | 1 Mitte · 3 Spulenfuß · 4 Ansatz · 5/6 Mitte | Spulen laden sichtbar auf, Funken springen zwischen den Spulen |
| **Schild-Drohne** (`shield_drone`) · `enemy_shield_drone.png` | 1 Rumpf · 2 Visier · 3 Düsen-Gondel · 4 Schild-Emitter (Ring unten, ohne Energie) · 5 Schildbogen aktiv (cyan) · 6 Schildbogen überhitzt (orange, rissig) | 1 Mitte · 3 Ansatz · 4 Emitter-Mitte · 5/6 Bogenmitte | Schild dreht zum Spieler, überhitzt sichtbar (passt zu M10-C-Schilden) |
| **Sporenspucker** (`spore_spitter`) · `enemy_spore_spitter.png` | 1 Körper ohne Sporenkapseln · 2 Auge · 3 Sporenkapsel geschlossen · 4 Sporenkapsel offen (leuchtend) · 5 Spore (Geschoss) · 6 Körper halb eingegraben (nur obere Hälfte) | 1 Körpermitte unten · 2 Augenmitte · 3/4 Stielansatz · 5 Mitte · 6 Körpermitte | Kapseln öffnen sich nacheinander, Körper gräbt sich ein/auf |
| **Phasen-Jäger** (`phase_stalker`) · `enemy_phase_stalker.png` | 1 Rumpf mit Hüfte (ohne Arme/Beine/Kopf) · 2 Kopf mit rotem Visier · 3 rechter Arm inkl. Energieklinge (hängend) · 4 linker Arm inkl. Energieklinge (hängend) · 5 rechtes Bein · 6 linkes Bein | 1 Brustmitte · 2 Hals · 3/4 Schulter · 5/6 Hüfte | Gehen (Beine), Klingen holen aus und schlagen, Phasen-Sprung streckt den Körper |
| **Schleim** / **Magma-Schleim** (`slime`, `slime_magma`) | *keine Teile nötig* — Stauchen/Wabbeln im Code passt zum Stil. Optional später: Körper · Auge · 2 Tropfen | — | — |

### Sektor 2
| Gegner · Referenz | Zellen 1–6 | Gelenk | Bewegung im Code |
| :--- | :--- | :--- | :--- |
| **Kristall-Krabbler** (`crystal_crawler`) · `enemy_crystal_crawler.png` | 1 Panzer-Körper **ohne Beine** (Kristalle drauf) · 2 Kopf mit Mandibeln · 3 Vorderbein links · 4 Mittelbein links · 5 Hinterbein links · 6 einzelner Kristall-Stachel (abbrechbar) | 1 Körpermitte · 2 Halsansatz · 3–5 Hüfte (am Körper) · 6 Stachelfuß | 6 Beine schreiten (Code spiegelt rechts), Hüpfer beim Ansturm, Kristalle splittern bei Treffern |
| **Prisma-Drohne** (`prism_drone`) · `enemy_prism_drone.png` | 1 obere Prisma-Hälfte · 2 untere Prisma-Hälfte · 3 Augen-/Kernband · 4 kleiner Orbit-Splitter A · 5 Orbit-Splitter B · 6 Kern offen (hell) | 1 Unterkante Mitte · 2 Oberkante Mitte · 3–6 Mitte | Prisma klappt beim Schuss auf (Kern sichtbar), Splitter kreisen |
| **Splitter-Scharfschütze** (`shard_sniper`) · `enemy_shard_sniper.png` | 1 Rumpf mit Kopf (ohne Arme und ohne Beine) · 2 Jetpack mit Düse · 3 Gewehr (Kristall-Lanzengewehr) · 4 vorderer Arm (hält Gewehr) · 5 hinterer Arm · 6 Beine **hängend, als ein Stück** (fliegende Pose) | 1 Brustmitte · 2 Rückenansatz · 3 Griff · 4/5 Schulter · 6 Hüfte | schwebt (Beine pendeln leicht), Gewehr zielt auf den Spieler, Rückstoß, Jetpack-Flamme flackert |
| **Leere-Krabbler** (`void_crawler`) · `enemy_void_crawler.png` | 1 Körper ohne Beine · 2 Kopf mit Fühlern · 3 Vorderbein links · 4 Mittelbein links · 5 Hinterbein links · 6 Energie-Ranke (Schwanz/Tentakel) | 1 Mitte · 2 Hals · 3–5 Hüfte · 6 Ansatz | wie Kristall-Krabbler, Ranken peitschen |
| **Resonanz-Wächter** (`resonance_warden`) · `enemy_resonance_warden.png` | 1 goldener Kernkörper ohne Kristalle · 2 Auge/Linse · 3 Kristall groß (Orbit) · 4 Kristall klein (Orbit) · 5 Schildplatte links (rechte gespiegelt) · 6 Linse offen/geladen | 1 Mitte · 2 Mitte · 3/4 Kristallmitte · 5 Ansatz am Körper · 6 Mitte | Kristalle kreisen, Schildplatten klappen zum Block zusammen, Linse lädt |

### Sektor 3
| Gegner · Referenz | Zellen 1–6 | Gelenk | Bewegung im Code |
| :--- | :--- | :--- | :--- |
| **Schlacken-Käfer** (`slag_beetle`) · `enemy_slag_beetle.png` | 1 Unterkörper + Kopf **ohne** Panzerflügel und Beine (Lava-Bauch sichtbar) · 2 Panzer-Flügeldecke links · 3 Panzer-Flügeldecke rechts · 4 Vorderbein links · 5 Mittelbein links · 6 Hinterbein links | 1 Mitte · 2/3 Flügelwurzel (vorn innen) · 4–6 Hüfte | Beine schreiten, Flügeldecken öffnen sich beim Angriff (Lava glüht) |
| **Solar-Drohne** (`solar_drone`) · `enemy_solar_drone.png` | 1 Sonnenkern (Kugel) · 2 äußerer Ring · 3 innerer Ring/Kardan · 4 Solarpaneel links (rechtes gespiegelt) · 5 Kern überladen (weiß-gelb) · 6 Sonnen-Fackel (Strahl-Ansatz) | 1–3 Mitte · 4 Paneel-Ansatz · 5 Mitte · 6 Ansatz | Ringe drehen sich gegenläufig, Paneele schwenken, Kern lädt auf |
| **Magma-Mörser** (`magma_mortar`) · `enemy_magma_mortar.png` | 1 Rumpf mit Glutauge **ohne Beine und Rohr** · 2 Mörserrohr (oben) · 3 Vorderbein links · 4 Hinterbein links · 5 Kuppel-Kappe · 6 Glutauge offen/geladen | 1 Mitte · 2 Rohrfuß · 3/4 Hüfte · 5 Scharnier · 6 Mitte | Beine schreiten, Rohr kippt vor dem Schuss nach hinten, Rückstoß |
| **Glut-Jäger** (`ember_stalker`) · `enemy_ember_stalker.png` | 1 Rumpf mit Hüfte · 2 Kopf · 3 rechter Arm inkl. Feuerklinge · 4 linker Arm inkl. Feuerklinge · 5 rechtes Bein · 6 linkes Bein | 1 Brust · 2 Hals · 3/4 Schulter · 5/6 Hüfte | Gehen, Sprint (vorgebeugt), Klingen-Schlag |
| **Gießerei-Golem** (`forge_golem`) · `enemy_forge_golem.png` | 1 Rumpf mit Ofen (Tür geschlossen) · 2 Kopf · 3 rechter Arm mit Faust · 4 linker Arm mit Faust · 5 Bein (rechts; links spiegelt der Code) · 6 Ofentür offen (Glut) | 1 Brust · 2 Hals · 3/4 Schulter · 5 Hüfte · 6 Türscharnier | schwere Schritte, Arm hebt sich zum Schild-Block, Ofen öffnet beim Angriff |

### Sektor 4
| Gegner · Referenz | Zellen 1–6 | Gelenk | Bewegung im Code |
| :--- | :--- | :--- | :--- |
| **Astral-Skarabäus** (`astral_scarab`) · `enemy_astral_scarab.png` | 1 Körper ohne Flügel · 2 Kopf mit Hörnern · 3 Flügel links ausgebreitet · 4 Flügel links angelegt · 5 Beinpaar vorn (links) · 6 Beinpaar hinten (links) | 1 Mitte · 2 Hals · 3/4 Flügelwurzel · 5/6 Hüfte | Flügel schlagen (Wechsel ausgebreitet/angelegt + Drehung), Code spiegelt rechte Seite |
| **Chrono-Auge** (`chrono_eye`) · `enemy_chrono_eye.png` | 1 Augapfel ohne Ringe · 2 Iris/Pupille · 3 äußerer Ring · 4 mittlerer Ring · 5 innerer Ring · 6 Uhrzeiger | 1–5 Mitte · 6 Zeigerachse | Ringe drehen sich unabhängig, Pupille folgt dem Spieler, Zeiger tickt |
| **Sternen-Lanzer** (`star_lancer`) · `enemy_star_lancer.png` | 1 Rumpf mit Lendenschurz · 2 Helm/Kopf · 3 rechter Arm (Faust geschlossen, hält Speer) · 4 linker Arm · 5 Beinpaar (beide Beine, Schrittstellung) · 6 Sternenspeer allein | 1 Brust · 2 Hals · 3/4 Schulter · 5 Hüfte · 6 Griffpunkt | Speer holt aus und stößt, Schritt-Wippen |
| **Leere-Phantom** (`void_wraith`) · `enemy_void_wraith.png` | 1 Kapuze mit Gesicht (Leere) · 2 Robe oben · 3 Robensaum (unten, flatternd) · 4 Krallenhand links (cyan) · 5 Krallenhand rechts · 6 Augen-Glühen | 1 Halsansatz · 2 Mitte · 3 Saum-Oberkante · 4/5 Handgelenk · 6 Mitte | Saum flattert, Hände holen aus, Kapuze neigt sich |
| **Monolith-Wächter** (`monolith_guard`) · `enemy_monolith_guard.png` | 1 Rumpf · 2 Helm · 3 Arm mit Morgenstern (links im Bild) · 4 Turmschild mit Arm (rechts im Bild) · 5 rechtes Bein · 6 linkes Bein | 1 Brust · 2 Hals · 3 Schulter · 4 Schildgriff · 5/6 Hüfte | Schild hebt sich zum Block, Morgenstern holt aus, schwere Schritte |

**Optional später (Typ L, wie bei Bossen):** Für Humanoide (`phase_stalker`, `ember_stalker`, `star_lancer`, `monolith_guard`) ein zweites Sheet `<kind>_arms_R.png` mit 6 Arm-Posen (hängend · ausholen · Schlag zur Kamera · seitlich · Block · Stoß). Erst wenn die Teile-Sheets im Spiel gut aussehen.

## 5. Reihenfolge (Qualität vor Sparen — `SPRITE_QUEUE.md` §0)
| Schritt | Sheets | Warum |
| :--- | :--- | :--- |
| **Pilot** | `turret_rig.png`, `phase_stalker_rig.png` | ein mechanischer + ein humanoider Gegner aus Sektor 1 — zeigt, ob das Format für beide Typen trägt. **Danach Abnahme im Spiel.** |
| 2 | `drone_rig.png`, `shield_drone_rig.png`, `spore_spitter_rig.png`, `drone_arc_rig.png` | Rest Sektor 1 (am häufigsten gesehen) |
| 3 | `crystal_crawler_rig.png`, `shard_sniper_rig.png`, `prism_drone_rig.png`, `void_crawler_rig.png`, `resonance_warden_rig.png` | Sektor 2 |
| 4 | `magma_mortar_rig.png`, `slag_beetle_rig.png`, `ember_stalker_rig.png`, `forge_golem_rig.png`, `solar_drone_rig.png` | Sektor 3 |
| 5 | `chrono_eye_rig.png`, `astral_scarab_rig.png`, `star_lancer_rig.png`, `void_wraith_rig.png`, `monolith_guard_rig.png` | Sektor 4 |
| 6 | optionale Arm-Posen (Typ L) für Humanoide | Feinschliff |

Pro Sitzung lieber **wenige Sheets sauber** als viele schief. **Zusatz- oder Ersatz-Sheets sind jederzeit erlaubt** (z. B. Arm-Posen, Angriffs-/Tod-Effekte, ein neues Sheet, wenn eines nicht gefällt) — Credits sind kein Grund dagegen (`AGENTS.md` Regel 14). Die Boss-Sheets aus `ART_BRIEF_M11.md` (restliche Krall-Sheets) haben Vorrang, wenn beides offen ist.

## 6. Prüfen & Ablegen (Antigravity)
1. Bild erzeugen (Referenz über `ImagePaths`, `AspectRatio: '3:2'`), als verlustfreies PNG nach `art_source/rigs/<kind>_rig.png` (1536×1024; bei abweichender Größe per PIL ohne Skalierungsverlust auf ein `#FFFFFF`-Raster mit 512×512-Zellen packen).
2. `npm run art:check -- art_source/rigs/<kind>_rig.png` → Prüfbild in `art_source/_check/` ansehen: **Gelenk im roten Fadenkreuz?** Nichts am Zellrand? Sonst Teil per PIL verschieben (nicht skalieren).
3. Gleicher Maßstab in allen Zellen? Teile vollständig (keine abgeschnittenen Stellen)? Stil identisch zum Referenzbild?
4. Commit `art(m11): <kind> rig` → push → in `HANDOFF.md` unter „M11 Gegner-Rigs“ abhaken.

## 7. Was Claude Code danach baut (zur Info)
- Import-Modus `parts` in `npm run art:import` (jede Zelle ein Teil, Gelenk = Zellmitte, gemeinsamer Maßstab = Anzeigegröße des heutigen Sprites) und je Gegner ein Rig in `src/data/rigs/<rig-id>.json`.
- `src/dungeon/anim/enemyAnims.ts`: Posen je Gegner-Zustand (gehen, zielen, ausholen, Schuss, Treffer), gezeichnet über dieselbe Rig-Weiche wie bei Bossen — fehlt das Sheet, bleibt das alte Sprite.
- Spiellogik und Hitboxen bleiben unverändert (rein darstellend).
