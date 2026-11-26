# Architektur- & Vorgehensplan: Meilenstein 11 — Lebendige Gegner & Bosse (Animation + Sprite-Pipeline)

> **Status:** 🔜 Geplant — Umsetzungsvorlage für Claude Sonnet (mittlere Denktiefe) **und** Arbeitsliste für die Sprite-Erstellung in Gemini
> **Basis:** Stand nach M10-C (`SAVE_VERSION = 11`, Boss-Engine in `src/dungeon/bosses/`)
> **Save-Version:** bleibt `11` (reine Darstellung, keine neuen Spielstand-Felder)

**Ziel in einem Satz:** Gegner und Bosse sind heute starre Einzelbilder, die verschoben werden. Künftig bewegen sie sich wie Figuren: Arme holen aus, Teile fliegen weg und kommen zurück, Bosse brechen in Phase 2 auf oder teilen sich, Geschütze laufen auf kleinen Beinen.

**So benutzt du dieses Dokument:**
- **Projektinhaber (Sprites):** Lies §2 (Lieferformat) und §6 (Prompt-Katalog). Erzeuge die Bilder in Gemini, lege sie als `art_source/rigs/<id>_parts.png` bzw. `art_source/poses/<id>_poses.png` ab und führe `npm run art:import` aus — fertig. Reihenfolge-Empfehlung: §6.0.
- **Coding-Agent:** Lies `AGENTS.md`, dann §3–§5 und arbeite §7 Phase für Phase ab (ein Commit pro Phase, `npm run verify` + Screenshots ansehen).
- **Wichtig:** Jede Phase funktioniert **ohne** neue Sprites. Fehlt ein Teile-Sheet, schneidet der Code die Teile aus dem vorhandenen Einzelbild aus (§3.3). Neue Bilder ersetzen das nur — ohne Codeänderung.

---

## 1. Ist-Stand & Ziel

| Gruppe | Heute | Ziel |
| :--- | :--- | :--- |
| **Bosse** | Ein Bild pro Boss (teils vergrößerte Gegner-Sprites oder prozedural), verschoben; Gefahr kommt aus Zonen/Strahlen/Projektilen. Einzelne Zusätze (Krall-Beine, Hammer, Uhrzeiger). | **Teile-Rig** pro Boss: Rumpf, Kopf, Arme usw. einzeln animiert; Ausholen → Schlag → Nachfedern; Teile als Geschosse; **Phase-2-Verwandlung** (aufbrechen, teilen, Panzer abwerfen). |
| **Normale Gegner** | Ein Bild, teils Stauchen/Schweben. | **Pose-Sheet** (4 Posen: Ruhe A/B, Ausholen, Angriff) + prozedurale Bewegung; **Beine** für Geschütze/Mörser/Scharfschützen. |
| **Pipeline** | Gemini → Hand-Freistellen per Skript-Schnipsel → `public/art/sprites/`. | **Ein Befehl:** `npm run art:import` zerschneidet Sheets, stellt frei, erzeugt Teile + Anker-Datei. |

**Bewusst nicht:** klassische Frame-für-Frame-Animation (8–12 Bilder pro Bewegung) — zu viele Gemini-Bilder, zu inkonsistent. Stattdessen **Cut-out-Animation** (Teile + Code), wie sie viele Pixel-Art-Indies nutzen.

---

## 2. Sprite-Lieferformat (für Gemini)

### 2.1 Teile-Sheet (Bosse) — `art_source/rigs/<id>_parts.png`
- **Raster 3 × 2** (6 Zellen), Seitenverhältnis **3:2** (z. B. 1536 × 1024). Größere Bosse: zweites Sheet `<id>_parts2.png` (weitere 6 Zellen).
- **Feste Zellen-Reihenfolge** je Boss (Zeile für Zeile, links → rechts), steht im Prompt (§6) und in `src/data/rigs.ts`. Leere Zellen bleiben **rein weiß**.
- Jedes Teil **einzeln, vollständig, mit dunkler Outline**, weißer Rand rundherum, **gleiche Größenordnung** wie am fertigen Körper (Arme nicht größer zeichnen als den Rumpf).
- Gelenkseite eines Teils (z. B. Schulter des Arms) **oben** in der Zelle; der Rumpf zeigt an den Gelenkstellen eine kleine dunkle Fuge/Kugel (wird beim Zusammensetzen verdeckt).
- Perspektive: dieselbe 3/4-Draufsicht wie die bisherigen Gegner.

### 2.2 Pose-Sheet (normale Gegner) — `art_source/poses/<id>_poses.png`
- **Raster 2 × 2**, Seitenverhältnis **1:1**: ① Ruhe A · ② Ruhe B (Laufschritt/Schweben) · ③ Ausholen (Vorwarnung) · ④ Angriff.
- **Exakt gleiche Figur und Größe** in allen 4 Zellen, nur die Pose ändert sich.

### 2.3 Tipps für Gemini & Antigravity
- **Vorhandenes Sprite als Referenzbild hochladen** („keep exactly this character design, colors and outline“) — dann bleiben Teile/Posen konsistent zum Spiel.
- Mehrere Versuche, das beste Sheet nehmen; einzelne misslungene Zellen kann `art:import` überspringen (`--keep-cell 3`, behält das bisherige Teil).
- Nie Text, nie Bodenschatten, nie farbigen Hintergrund.
- **In Antigravity (`generate_image`):** `AspectRatio: '3:2'` für Teile-Sheets bzw. `'1:1'` für Pose-Sheets setzen, bestehendes Sprite über `ImagePaths` mitgeben, erzeugtes Bild aus dem Artifact-Ordner als verlustfreies PNG nach `art_source/rigs/` bzw. `art_source/poses/` übernehmen (dabei ggf. dünne Rasterlinien entfernen und Teile sauber auf `512×512`-Zellen mit `#FFFFFF`-Rand zentrieren, siehe `ART_AND_DESIGN_GUIDE.md` §9) und auf `main` pushen.

### 2.4 Import-Befehl (wird in Phase 0 gebaut)
```bash
npm run art:import            # alle neuen/geänderten Sheets in art_source/rigs & art_source/poses
npm run art:import -- krall   # nur ein Boss/Gegner
```
**Auflösung:** Das Spiel zeichnet mit `RENDER_SCALE = 2`. Teile werden deshalb in **Bildschirm-Auflösung** gespeichert (`pixelRatio: 2` in `rigs.json`, Zielhöhe = `torsoDisplayH × 2`) und von `drawRig` mit halber Größe gezeichnet — 1:1 auf dem Bildschirm, wie die alten Boss-Sprites. Verkleinert wird mit Lanczos + hartem Alpha-Rand (`--resample`), nicht mit Nearest (weiße Fransen, Rauschen).
Ergebnis: `public/art/rigs/<id>/<teil>.png` bzw. `public/art/poses/<id>_<1-4>.png` (freigestellt mit Rand-Flood-Fill + 1-px-Defringe + NEAREST, wie Art-Guide §3) und `public/art/rigs/<id>/import.json` (Teilgrößen + automatisch geschätzte Gelenkpunkte). Danach `npm run check:sprites` → zeigt, was noch fehlt.

---

## 3. Technische Architektur

### 3.1 Rig-System — `src/engine/rig.ts` (neu)
```ts
export interface RigPart {
  id: string;                 // 'torso', 'armL', …
  parent?: string;            // Anhängen an Teil (Gelenk folgt dem Elternteil)
  pivot: [number, number];    // Gelenk im Teil (0…1, relativ zur Teilgröße)
  attach: [number, number];   // Gelenkpunkt am Elternteil (0…1) bzw. am Rig-Ursprung
  z: number;                  // Zeichenreihenfolge
  mirrorOf?: string;          // z. B. armR = gespiegeltes armL
}
export interface RigDef { id: string; size: [number, number]; parts: RigPart[] }
export interface PartPose { rot?: number; dx?: number; dy?: number; sx?: number; sy?: number; alpha?: number; hidden?: boolean }
export type Pose = Record<string, PartPose>;

export function drawRig(ctx, def: RigDef, images: RigImages, x: number, y: number, pose: Pose, opts?: { flash?: boolean; tint?: string; flip?: boolean; scale?: number }): void;
export function blendPose(a: Pose, b: Pose, t: number): Pose;           // weich überblenden
export function partWorldPos(def, pose, partId, x, y): { x: number; y: number; rot: number }; // für abgelöste Teile
```
- **Keine Abhängigkeit zur Spiellogik** — reines Zeichnen; testbar mit Canvas im Browser.
- Treffer-Blitz: jedes Teil hat eine Flash-Silhouette (wie heute `makeFlashSilhouette`).

### 3.2 Animations-Schicht — `src/dungeon/anim/` (neu)
- `motion.ts`: **prozedurale Bewegung für alle** — Atmen/Schweben (Sinus), **Lehnen** in Laufrichtung (Winkel aus `vx`), **Ausholen** (Stauchen vor Sprung/Schlag), **Strecken** im Flug, **Nachfedern** bei Landung, **Rückstoß** bei starken Treffern. Eingabe: Enemy-Zustand (`vx/vy`, `telegraphTimer`, `bossSub`, `bossStatusText`, `flashTimer`); Ausgabe: Transform (`dx, dy, sx, sy, rot`).
- `bossAnims.ts`: pro Boss eine Funktion `pose(e, t): Pose` — liest den Zustand der Boss-Engine (`bossSub` = idle/windup/active/recover, aktueller Zug-Name) und liefert die Teile-Pose. **Die Spiellogik (Treffer, Zonen) bleibt in `bosses/defs.ts`** — Animation zeigt nur, was ohnehin passiert.
- `legs.ts`: **prozedurale Beine** (2–3 Segmente, einfache IK, Schrittzyklus abhängig von Geschwindigkeit, Füße „kleben“ kurz am Boden) für Geschütze, Mörser, Scharfschützen, Krabbler. Pixel-Look: 2-px-Linien, dunkle Outline, Gelenkpunkte.
- `detached.ts`: **abgelöste Teile** als eigene Objekte (Position, Geschwindigkeit, Rotation, Rückkehr-Ziel). Schaden machen sie über die vorhandenen Systeme (Projektil oder `bossFx`-Zone); dieses Modul zeichnet nur das Teil statt eines Kreises.
- `transform.ts`: **Phase-2-Effekte** — *Aufbrechen* (Rumpf in zwei Hälften per Clip-Rechteck, gleiten auseinander, Leuchtkern dazwischen), *Panzer abwerfen* (Teile fliegen als Splitter weg und verschwinden), *Teilen* (Boss zeichnet sich 2–3× kleiner an verschiedenen Positionen; Logik siehe §4.3).

### 3.3 Fallback ohne neue Sprites — `src/data/rigs.ts`
- Jeder Rig kann statt eines Teile-Sheets **Ausschnitte aus dem vorhandenen Einzelbild** verwenden: `source: { sprite: 'boss', rects: { armL: [x, y, w, h], … } }` (Pixel im Original-PNG). So bewegen sich Arme schon heute; an Schnittkanten können kleine Lücken entstehen — die schließt das Teile-Sheet später.
- Reihenfolge beim Laden: `public/art/rigs/<id>/` vorhanden → nutzen · sonst Ausschnitte aus dem Einzelbild · sonst bisherige Darstellung.
- Bosse **ohne** Einzelbild (Leviathan, Quarz-Koloss sind heute prozedural gezeichnet; Prisma-Weberin nutzt ein vergrößertes Gegner-Sprite): bis zum Teile-Sheet bleibt die bisherige Darstellung, ergänzt um die prozedurale Bewegung aus Phase 1.
- `npm run check:sprites` listet zusätzlich **fehlende Teile-Sheets und Pose-Sheets** (eigener Abschnitt „Animation“).

### 3.4 Einbindung
- `dungeonRenderer.ts`: Gegner/Boss mit Rig → `drawRigged(e)`; sonst wie bisher. Größe/Hitbox unverändert (Darstellung ≠ Kollision).
- Kein Einfluss auf Seeds, Prüfung, Speicherstände, Credits.

---

## 4. Design pro Boss

Spalte „Teile“ = Zellen des Teile-Sheets (Reihenfolge für den Prompt). „Verwandlung“ = Phase 2 (< 50 % HP).

### 4.1 Tabelle

| Boss | Teile (Sheet-Reihenfolge) | Bewegung & Angriffe | Verwandlung (Phase 2) |
| :--- | :--- | :--- | :--- |
| **S1 E1 Krall** (`krall`) | 1 Rumpf · 2 Greifarm · 3 Bein vorn · 4 Bein hinten · 5 Magnet · 6 Schrottplatte | Läuft auf 4 Beinen (IK, Schrittzyklus); *Greifarm-Stoß*: Arm schießt teleskopartig vor, Rumpf lehnt nach vorn; *Magnet-Zug*: Magnet hebt sich, dreht, Rumpf stemmt sich; *Schrott-Wurf*: Platten lösen sich vom Rücken und fliegen | **Panzer abwerfen:** Rückenplatten fliegen als Schrott-Hagel weg, Krall wird schneller und zeigt Leuchtkern |
| **S1 E2 Kern-Wächter** (`core_warden`) | 1 Rumpf · 2 Kopf mit Halo · 3 Arm links · 4 Faust · 5 Brustplatte links · 6 Brustplatte rechts | Schwere Schritte mit Nachfedern; *Sturm-Angriff*: Ausholen (geduckt), Strecken im Lauf; *Sprung-Stampfer*: Stauchen → Flug (gestreckt) → Landung (Stauchen + Staub); *Laser*: Brustplatten öffnen sich, Kern strahlt | **Aufbrechen:** Brustplatten fliegen auseinander, offener Kern bleibt sichtbar; Fäuste lösen sich und kreisen als „Pylonen“ |
| **S1 E3 A.E.G.I.S. Leviathan** (`leviathan`) | 1 Rumpf-Mitte · 2 Flügelpanzer · 3 Arm-Segment · 4 Klaue · 5 Kern · 6 Panzerplatte | Arme schwenken segmentweise (2-Glied-Kette), Klauen greifen; Rumpf pumpt beim Kern-Schuss | **Panzer abwerfen:** Platten platzen ab, Kern liegt frei, Arme schlagen schneller |
| **S2 E1 Quarz-Koloss** (`quartz_golem`) | 1 Rumpf · 2 Kristall-Schulter · 3 Arm · 4 Faust · 5 Kopf · 6 Kristallsplitter | *Raketenfaust*: Faust löst sich, fliegt, kehrt zurück; *Stampfer*: Arme hoch → Schlag | **Teilen:** zerfällt in 2 kleinere Kolosse (geteilter HP-Pool), die sich bei 15 % wieder vereinen |
| **S2 E2 Prisma-Weberin** (`prism_weaver`) | 1 Körper · 2 Kopf · 3 Webarm · 4 Prisma · 5 Schleier · 6 Faden-Spule | 4 Prismen kreisen, lösen sich für das Prisma-Netz; Webarme „spinnen“ | **Spiegelbilder:** 2 Trugbilder (halbtransparent, kein Schaden), echte Weberin blinkt beim Angriff |
| **S2 E3 ★ Prisma-Archon** (`prisma_archon`) | 1 Rumpf · 2 Flügel · 3 Krone · 4 Arm · 5 Kristallkern · 6 Schulterkristall | Flügel spreizen beim Strahl, Arme heben für Nova | **Aufbrechen:** Kristallhülle zerspringt, darunter strahlende Lichtgestalt (Glow, schnellere Flügel) |
| **S3 E1 Schlacken-Koloss** (`slag_colossus`) | 1 Rumpf · 2 Kopf · 3 Arm · 4 Faust · 5 Krustenplatte · 6 Lavatropfen | *Rollangriff*: Teile ziehen sich zur Kugel zusammen, Kugel rollt (Rotation); *Bodenwelle*: Faust schlägt auf | **Kruste abwerfen:** Platten fliegen weg, glühender Kern-Körper, Tropfen fallen |
| **S3 E2 Gießerei-Meisterin** (`forge_mistress`) | 1 Körper · 2 Kopf mit Visier · 3 Hammer-Arm · 4 Hammer · 5 freier Arm · 6 Gussform | Hammer holt weit aus (Antizipation), Schlag mit Funken; *Amboss-Sprung*: hoher Bogen mit Schatten; *Gussformen* fallen von oben | **Hammerwurf:** Hammer fliegt als Bumerang, sie zieht einen zweiten aus dem Rücken |
| **S3 E3 ★ Vulkan-Titan** (`vulkan_titan`) | 1 Rumpf · 2 Kopf mit Krone · 3 Arm · 4 Magma-Faust · 5 Brustplatte · 6 Flammenkrone | *Meteor-Regen*: Arme hoch; *Erdspalten*: Fäuste in den Boden | **Aufbrechen:** Brust öffnet sich, Lavakern; Magma-Fäuste lösen sich und fliegen getrennt |
| **S4 E1 Chrono-Wächter** (`chrono_warden`) | 1 Auge · 2 äußerer Zahnring · 3 innerer Ring · 4 großer Zeiger · 5 kleiner Zeiger · 6 Zahnrad | Ringe drehen gegenläufig, Zeiger zeigen die Strahlrichtung; *Zeit-Echo*: Nachbilder | **Ringe lösen sich** und kreisen als Sägeblätter um die Arena |
| **S4 E2 Monolith-Koloss** (`monolith_colossus`) | 1 Kern · 2 Steinplatte groß · 3 Steinplatte klein · 4 Kopfplatte · 5 Rune · 6 Splitter | Körper besteht aus schwebenden Platten; *Platten-Wirbel/-Wurf* nutzt **seine eigenen Platten** (Körper wird sichtbar kleiner) | Platten werden zu Säulen; Kern liegt frei und pulsiert |
| **S4 E3 ★ Sternen-Archon** (`star_archon`) | 1 Rumpf · 2 Flügel · 3 Heiligenschein · 4 Arm · 5 Stern-Orb · 6 Mantel | Flügel schlagen beim Schweben; Arme zeichnen das Sternbild | **Teilen:** spaltet sich in zwei Sternhälften (je ein Flügel), die getrennt angreifen |
| **Omega-Archon** (`omega_archon`) | wie Sternen-Archon + 2. Sheet: 4 Element-Kerne | — | Element-Kerne lösen sich und kreisen |

### 4.2 Bewegungsregeln (gelten für alle)
- **Antizipation:** Jeder Angriff beginnt mit sichtbarem Ausholen in der Vorwarnzeit (`windup`), die bereits existiert — die Animation füllt diese Zeit, sie verlängert sie nicht.
- **Lesbarkeit vor Show:** Teile, die Schaden machen, leuchten in der Gefahrenfarbe der Zone; reine Deko-Teile nicht.
- **Kein neuer Schaden durch Animation:** Hitboxen kommen weiterhin aus `bosses/defs.ts`/`bossFx`. Fliegt ein Teil, existiert dazu ein Projektil bzw. eine Zone mit derselben Bahn.
- **Leistung:** max. 12 Teile pro Rig, Bilder gecacht, keine Allokation pro Frame.

### 4.3 Teilen (Quarz-Koloss, Sternen-Archon) — Logik
- Beim Teilen entstehen 2 `Enemy`-Objekte mit Flag `splitOf: <id>` (optional, nur Laufzeit) und **gemeinsamem HP-Pool** (Schaden an einer Hälfte zieht vom Pool ab; Anzeige: eine Boss-Leiste).
- Jede Hälfte nutzt einen Teil der Züge (z. B. links Nahkampf, rechts Fernkampf). Wiedervereinigung bei 15 % HP oder wenn eine Hälfte 10 s allein steht.
- Test: Schaden an beiden Hälften = Schaden am Pool; Sieg nur einmal; Belohnungen nur einmal.

---

## 5. Design für normale Gegner

| Gegner | Heute | Neu (Code) | Sprite-Bedarf |
| :--- | :--- | :--- | :--- |
| `turret` (bewegliches Geschütz) | Bild rutscht | **4 Spinnenbeine** (IK, Trippelschritt beim „Huschen“, Füße stemmen sich beim Feuern), Rückstoß | optional Pose-Sheet (ohne Beine) |
| `magma_mortar` | Bild | **6 kurze Krabbenbeine**, Rohr kippt vor dem Schuss nach hinten | Pose-Sheet |
| `shard_sniper` | Bild | **2 Stelzenbeine** (langsamer Gang), Lauf-Rückstoß | Pose-Sheet |
| `spore_spitter` | Bild + Stauchen | Eingraben/Auftauchen (Clip von unten), Pulsieren | Pose-Sheet |
| `slime`, `slime_magma` | Stauchen | + Wackel-Overshoot, Tropfen | — |
| `crystal_crawler`, `void_crawler`, `slag_beetle`, `astral_scarab` | Bild | **prozedurale Beinchen** (6), Körper-Wippen | Pose-Sheet (Körper ohne Beine) |
| `drone`, `drone_arc`, `prism_drone`, `solar_drone`, `chrono_eye`, `shield_drone` | Schweben | Neigung in Flugrichtung, Rotor/Flimmern, Ausholen = Zurückziehen | Pose-Sheet |
| `phase_stalker`, `ember_stalker`, `void_wraith`, `star_lancer` | Bild | Lehnen, Sprint-Strecken, Nachbilder beim Dash | Pose-Sheet |
| `forge_golem`, `monolith_guard`, `resonance_warden` | Bild | schwere Schritte, Schild-Arm hebt sich beim Block (passt zu M10-C-Schilden) | Pose-Sheet |

**Ohne Pose-Sheet:** nur prozedurale Bewegung + Beine (sieht schon deutlich lebendiger aus). **Mit Pose-Sheet:** Ruhe A/B wechseln im Gangtakt, ③ in der Vorwarnung, ④ beim Angriff.

---

## 6. Prompt-Katalog für Gemini

### 6.0 Empfohlene Reihenfolge
1. **Krall** und **Kern-Wächter** (Sektor 1, sieht jeder) → 2. `turret`, `magma_mortar`, `shard_sniper` (Pose-Sheets) → 3. Schlacken-Koloss, Gießerei-Meisterin, Chrono-Wächter, Monolith-Koloss → 4. Quarz-Koloss, Prisma-Weberin → 5. restliche Pose-Sheets → 6. Archons/Leviathan (haben schon gute Einzelbilder; Teile-Sheets sind Kür).

### 6.1 Formel E — Teile-Sheet (Bosse)
```text
Crisp 16-bit/32-bit indie RPG pixel art CHARACTER PARTS SHEET for cut-out animation, arranged in a clean 3x2 grid
on a pure solid flat white #FFFFFF background, every part fully separated with generous white margin, nothing touching cell borders,
3/4 top-down Moonlighter cozy retro sci-fi action RPG style, dark crisp pixel outlines, rich readable shading,
all parts drawn at the same scale as they appear on the assembled body, joint/attachment side of each limb at the TOP of its cell,
zero text, zero labels, zero ground shadows.
Character: <Beschreibung des Bosses>.
Cells (row by row, left to right): 1) <Teil>, 2) <Teil>, 3) <Teil>, 4) <Teil>, 5) <Teil>, 6) <Teil>.
```
*(Tipp: das bisherige Sprite als Referenzbild anhängen und „keep this exact design“ ergänzen.)*

### 6.2 Formel F — Pose-Sheet (Gegner)
```text
Crisp 16-bit/32-bit indie RPG pixel art enemy POSE SHEET, the SAME character drawn 4 times in a clean 2x2 grid
on a pure solid flat white #FFFFFF background with generous white margin, identical size, colors and design in every cell,
3/4 top-down Moonlighter cozy retro sci-fi style, dark crisp pixel outlines, zero text, zero shadows.
Character: <Beschreibung>.
Cells: 1) idle, 2) idle alternate / walking step, 3) wind-up before attacking (anticipation), 4) attacking.
```

### 6.3 Boss-Einträge (Beschreibung · Zellen)

| Datei | Beschreibung | Zellen 1–6 |
| :--- | :--- | :--- |
| `krall_parts.png` | spider-like salvage robot boss made of rusty scrap plates and pipes, glowing orange furnace core | torso with core (no legs, no arm) · long telescopic grabber claw arm · front leg (two joints) · back leg (two joints) · red-blue horseshoe magnet · loose curved scrap armor plate |
| `core_warden_parts.png` | heavy golden-steel guardian robot with a glowing reactor core in its chest and a halo ring above its head (reference: current boss.png) | torso without arms and without chest plates, exposed glowing core · head with floating golden halo · left arm (shoulder to wrist) · big armored fist · left chest armor plate · right chest armor plate |
| `leviathan_parts.png` | colossal armored battle machine A.E.G.I.S., bronze and steel, glowing omega core | central hull · wing armor bulkhead · arm segment · claw · reactor core · loose armor plate |
| `quartz_golem_parts.png` | golem made of pale quartz rock with amethyst crystal growths | torso · crystal shoulder · arm · fist · head · crystal shard |
| `prism_weaver_parts.png` | graceful floating crystal weaver with long thread-like arms and a veil of light | body · head · weaving arm · floating prism · light veil · thread spool |
| `prisma_archon_parts.png` | majestic crystal archon with prism wings and crown (reference: boss_prisma_archon.png) | torso · wing · crown · arm · crystal core · shoulder crystal |
| `slag_colossus_parts.png` | massive lava golem of cooled black slag with glowing orange cracks | torso · head · arm · fist · crust plate · molten drop |
| `forge_mistress_parts.png` | tall armored foundry mistress with welding visor and scorched apron | body without arms · head with visor · hammer arm (shoulder to hand) · giant glowing forge hammer · free arm · casting mold |
| `vulkan_titan_parts.png` | volcanic titan with flame crown (reference: boss_vulkan_titan.png) | torso · head with crown · arm · magma fist · chest plate · flame crown |
| `chrono_warden_parts.png` | floating clockwork eye guardian, brass and cyan | eye (iris = clock face) · outer gear ring · inner ring · long clock hand · short clock hand · small gear |
| `monolith_colossus_parts.png` | stone giant made of floating dark monolith slabs with golden runes | glowing core · large slab · small slab · head slab · golden rune · stone shard |
| `star_archon_parts.png` | celestial archon with star wings and halo (reference: boss_star_archon.png) | torso · wing · halo · arm · star orb · cloak |

### 6.4 Gegner-Einträge (Pose-Sheets)

| Datei | Beschreibung (für „Character:“) |
| :--- | :--- |
| `turret_poses.png` | small mobile gun turret dome with a single barrel, NO legs (legs are added in code) |
| `magma_mortar_poses.png` | squat magma mortar crab-shell with a short wide barrel, NO legs |
| `shard_sniper_poses.png` | crystal sniper with a long rifle barrel, NO legs |
| `spore_spitter_poses.png` | bioluminescent spore plant that spits glowing globs |
| `crystal_crawler_poses.png` · `void_crawler_poses.png` · `slag_beetle_poses.png` · `astral_scarab_poses.png` | beetle/crawler bodies seen from 3/4 top-down, NO legs |
| `drone_poses.png` · `drone_arc_poses.png` · `prism_drone_poses.png` · `solar_drone_poses.png` · `chrono_eye_poses.png` · `shield_drone_poses.png` | hovering drones (reference: the current sprites) |
| `phase_stalker_poses.png` · `ember_stalker_poses.png` · `void_wraith_poses.png` · `star_lancer_poses.png` | agile hunters (reference: the current sprites) |
| `forge_golem_poses.png` · `monolith_guard_poses.png` · `resonance_warden_poses.png` | heavy guardians, cell 3 = raising shield arm |

*(Wo „reference“ steht: das aktuelle Sprite aus `public/art/sprites/` als Referenzbild an Gemini geben.)*

---

## 7. Vorgehensplan (Phasen)

Jede Phase: Code → Test → `npm run verify` → Screenshots/Bildfolgen ansehen → Commit.

### Phase 0 — Pipeline
- `scripts/art-import.py` (Python + Pillow; Aufruf über `npm run art:import`): Raster erkennen (3×2 / 2×2), Zellen schneiden, Rand-Flood-Fill, Defringe, eng zuschneiden, auf Zielgröße mit NEAREST skalieren (Rig: Rumpfhöhe = bisherige Anzeigehöhe), `import.json` mit Teilgrößen + geschätzten Gelenkpunkten (oberste Mitte des Teils). Option `--keep-cell N`.
- `check-sprites.mjs`: Abschnitt „Animation“ (fehlende Sheets laut `src/data/rigs.ts`).
- Test: Beispiel-Sheet (in `tests/fixtures/` künstlich erzeugt) → richtige Anzahl Teile, transparenter Hintergrund, keine weißen Fransen.

### Phase 1 — Rig-Engine & prozedurale Bewegung
- `engine/rig.ts`, `dungeon/anim/motion.ts`, Einbindung in `dungeonRenderer` hinter einer Weiche (Rig vorhanden → Rig, sonst alt).
- Prozedurale Bewegung für **alle** Gegner (Lehnen, Atmen, Ausholen, Nachfedern, Rückstoß).
- Test: `drawRig` mit Test-Rig (Pixelprüfung: Arm bei 90° an erwarteter Stelle), Bildfolge-Screenshot.

### Phase 2 — Beine
- `dungeon/anim/legs.ts`; Geschütz, Mörser, Scharfschütze, Krabbler/Käfer.
- Test: Füße bleiben während der Stützphase ortsfest (±1 px), Beine skalieren mit Tempo; Screenshot-Folge.

### Phase 3 — Bosse Sektor 1 (Krall, Kern-Wächter, Leviathan)
- Rigs in `data/rigs.ts` (inkl. Fallback-Ausschnitte aus den Einzelbildern), Posen in `anim/bossAnims.ts`, abgelöste Teile (`detached.ts`), Verwandlung (`transform.ts`).
- Test: je Zug eine Pose ≠ Ruhe-Pose; Phase-2-Verwandlung startet genau einmal; Screenshots pro Zug.

### Phase 4 — Bosse Sektor 2 (inkl. **Teilen** des Quarz-Koloss, §4.3)
### Phase 5 — Bosse Sektor 3
### Phase 6 — Bosse Sektor 4 + Omega (inkl. Teilen des Sternen-Archons)
### Phase 7 — Pose-Sheets normaler Gegner (Takt-Wechsel, Ausholen/Angriff-Pose)
### Phase 8 — Abschluss
- Doku: GDD, AGENTS („How to add a rig“), Art-Guide (Formel E/F + Import), TESTING, HANDOFF, dieses Dokument ✅ + Umsetzungsnotizen.
- Abschlussmeldung: welche Sheets noch fehlen (`npm run check:sprites`).

---

## 8. Invarianten
- Animation ändert **keine** Hitboxen, Schadenswerte, Seeds, Speicherstände oder Credits (`npm run check:invariants`).
- Jede Phase ohne neue Sprites lauffähig (Fallback §3.3); neue Sheets ersetzen ohne Codeänderung.
- Wochen-Prüfung unverändert (reine Optik).
- Mobile: Bildrate auf Mittelklasse-Handy ≥ 50 fps mit 8 Gegnern + Boss (Messung im Headless-Test über `performance.now()`-Budget je Frame).

## 9. Offene Entscheidungen (Standard gesetzt)
| # | Frage | Standard |
| :--- | :--- | :--- |
| A1 | Teilen: gemeinsamer HP-Pool oder getrennte HP? | gemeinsamer Pool (eine Boss-Leiste, fair & lesbar) |
| A2 | Pose-Sheets Pflicht für alle Gegner? | nein — Beine/Bewegung zuerst, Pose-Sheets nach und nach |
| A3 | Hero/NPCs auch animieren? | nicht in M11 (eigenes Thema) |

## 10. Verknüpfte Dokumente
[AGENTS.md](AGENTS.md) · [HANDOFF.md](HANDOFF.md) · [ART_AND_DESIGN_GUIDE.md](ART_AND_DESIGN_GUIDE.md) · [MILESTONE_10C_ARCHITECTURE.md](MILESTONE_10C_ARCHITECTURE.md) (Boss-Engine)
