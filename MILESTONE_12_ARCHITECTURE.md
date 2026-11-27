# MILESTONE_12_ARCHITECTURE.md — Sektor-Endbosse als Arena-Bosse (*STARLIGHTER*)

> **Status: PLAN — Fragen §10 beantwortet (2026-11-27), wartet auf Startsignal für Phase A.** Noch kein Code. Nach Freigabe wird Phase A–F (§7) umgesetzt, zuerst nur für den **Piloten A.E.G.I.S. Leviathan (Sektor 1)**; die übrigen drei Endbosse folgen erst nach Abnahme des Piloten im echten Spiel.

**Entscheidungen des Projektinhabers (2026-11-27):**
1. Die Ebene-III-Bosse (letzter Boss vor dem nächsten Sektor) werden **in die Map integrierte Arena-Bosse** wie bei *Moonlighter* — keine großen Einzelmodelle oder „stärkere Duplikate“ mehr.
2. **Scrollende Großarena** (größer als ein Bildschirm, eigene Kamera).
3. **Pilot: A.E.G.I.S. Leviathan (S1).**
4. Belohnung: **einzigartiges Trophäen-Relikt + Freischaltung + Trophäe im Hub** (keine Credits — Regel 1).
5. **Erst Plan, dann Code.**

---

## 1. Problem heute
| Boss (Ebene III) | `kind` | Heute |
| :--- | :--- | :--- |
| A.E.G.I.S. Leviathan (S1) | `boss_leviathan` | Standardraum (344×176 logisch, 1 Bildschirm), 2 Deko-Säulen, prozedural gezeichneter Körper oben, 2 Arme (`levArms`) |
| Prisma-Archon (S2) | `boss_prisma_archon` | Standardraum, schwebt mittig — gleiche KI wie Omega-Archon (S5) |
| Vulkan-Titan (S3) | `boss_vulkan_titan` | Standardraum, schwebt oben, Phase 2 = Lava-Rand |
| Sternen-Archon (S4) | `boss_star_archon` | Standardraum, schwebt oben, Phase 2 = Teilen |

Alle Bossräume sind gleich groß, es gibt **keine Kamera**, und die Raumgrenzen sind als Konstanten (`ROOM_LEFT/RIGHT/TOP/BOTTOM`, `ROOM.*`) an ~380 Stellen fest verdrahtet (`dungeonGen.ts` 127, `DungeonScene.ts` 106, `enemyAi.ts` 42, `dungeonRenderer.ts` 40, `mechanicsGen.ts` 27, `defs.ts` 16 …). Ein Endboss fühlt sich dadurch wie ein normaler Boss mit mehr HP an.

## 2. Ziel — was ein Arena-Endboss ist (Fertig-Definition A1–A10)
Gilt zusätzlich zu D1–D14 (`BOSS_ANIMATION_PLAN.md` §1).

| # | Punkt | Woran man es prüft |
| :--- | :--- | :--- |
| A1 | **Großarena:** mind. 2×2 Bildschirme (688×352 logisch), Kamera folgt dem Spieler weich, klemmt an den Arena-Rändern | Arena ablaufen |
| A2 | **Boss ist Teil der Map:** Körper ist in Wand/Boden/Decke verankert oder *ist* die Arena (Leviathan = Nordwand der Reaktorhalle). Er läuft nicht wie ein normaler Gegner herum | Sichtprüfung |
| A3 | **Schwachstellen statt „auf den Körper hauen“:** Schaden nur an markierten Punkten (Kern, Arme, Ventile), die je Angriff erreichbar werden | Treffer außerhalb = Funken, kein Schaden |
| A4 | **Arena verändert sich je Phase** (min. 3 Phasen): Bodenplatten brechen weg, Lava/Strom fließt, Bereiche werden gesperrt/geöffnet. Jede Änderung telegrafiert (≥ 0,8 s) | Labor je Phase |
| A5 | **Extreme Attacken mit Arena-Bezug:** jede Phase hat min. 1 Attacke, die die Arena selbst nutzt (Arme zerschlagen Boden, Strahl fegt über die halbe Arena, Trümmer fallen von der Decke) | Labor je Zug |
| A6 | **Eigener Auftritt:** Vorraum/Torsequenz (Kamera schwenkt zum Boss, Titelbanner), eigenes Musikthema-Intro, nur beim ersten Betreten länger | Erstbegegnung |
| A7 | **Lesbarkeit:** alle Gefahrenzonen weiterhin über `bossFx`-Telegraphe; Gefahr außerhalb des Bildschirms wird am Rand angezeigt (Pfeil) | Spieler am Arena-Rand |
| A8 | **Belohnung:** Trophäen-Relikt (einzigartig), Freischaltung beim Erstsieg, Hub-Trophäe (§5) — **keine Credits** | Erstsieg + Wiederholung |
| A9 | **Fairness/Mobil:** Touch-HUD bleibt am Bildschirm (nicht in der Welt), Zielhilfe funktioniert mit Kamera, kein Gefahrenbereich ohne Ausweichweg | Mobil-Test |
| A10 | **Determinismus:** Arena ist handgebautes Datenlayout (kein Zufall) — Wochen-Prüfung, Seeds und `generateSectorFloor` bleiben bit-identisch bis auf den Bossraum-Inhalt | Seed-Test |

## 3. Invarianten (gelten in jeder Phase)
1. **Regel 1:** kein `state.credits +=` in `DungeonScene.ts` / `src/dungeon/`. Belohnungen = Items, Flags, Freischaltungen.
2. **Save v11 bleibt kompatibel:** neue Felder nur optional (`endbossTrophies?`, `endbossFirstClears?`), Defaults in `GameState.load()`. Kein `SAVE_VERSION`-Sprung nötig, falls nur optionale Felder (sonst v12 mit Migration).
3. **Normale Räume unverändert:** Standardräume behalten die festen Grenzen; Kamera ist dort immer `(0,0)` → kein Verhaltensunterschied, alle bestehenden Tests bleiben grün.
4. **Kein globaler Zufall** in Arena-Layout und Arena-Mechaniken (eigene `mulberry32(hashString(...))`, Zyklen über `scene.mechanicsClock`).
5. **`generateSectorFloor` ruft `Math.random` gleich oft auf** wie vorher (Arena wird *nach* der Generierung an den Bossraum gehängt) → bestehende Wochen-Prüfungs-Layouts ändern sich nicht.
6. **Tag/Nacht, Teleporter-Extraktion, Boss-HP aus `balance.ts`** bleiben unberührt; Arena-Bosse bekommen eigene Werte in `balance.ts` (`ENDBOSS_*`).
7. **Rückfall:** fehlen Arena-Sprites, wird die Arena prozedural (Kacheln + Tönung) gezeichnet — nie Absturz (`check:sprites` listet sie).

## 4. Technik

### 4.1 Raumgrenzen pro Raum statt Konstanten
- `DungeonRoom.bounds?: { l, r, t, b }` (fehlt = Standard `ROOM_LEFT…`). Helfer `roomBounds(room)` in `dungeonGen.ts`, Getter `scene.bounds` in `DungeonScene`.
- **Umstellung nur dort, wo ein Arena-Raum durchläuft:** Bewegungs-Klemmen (Spieler, Gegner, Projektile), Tür-/Austrittsprüfung, `navGrid.ts`, `bossEngine.ROOM` (→ `ctx.bounds`), `bossFx`, Kamera-Kollision. `dungeonGen.ts`-Layouts der Standardräume bleiben auf den Konstanten (dort ist `bounds` immer Standard).
- Strategie: mechanisch ersetzen `ROOM_LEFT` → `b.l` in den Laufzeit-Dateien, **pro Datei ein Commit**, nach jeder Datei `npm run verify` (gemeinsame, heikle Dateien laut `PARALLEL_WORK.md` §2 — vorher mit anderen Chats abstimmen, siehe §8).

### 4.2 Kamera (`src/dungeon/camera.ts`, neu)
- `camera = { x, y, shakeX, shakeY }`, folgt dem Spieler mit Totzone (40×24) und Glättung (τ ≈ 0,12 s), klemmt an `bounds`; in Standardräumen fest `(0,0)`.
- Renderer: Welt-Ebene unter `ctx.translate(-camX, -camY)`; HUD, Touch-Steuerung, Toasts, Boss-HP-Leiste **ohne** Translation. Bildschirm-Wackeln (`triggerShake`) addiert sich auf die Kamera.
- Eingabe: Maus-/Touch-Zielen rechnet Bildschirm → Welt (`+cam`); Zielhilfe nutzt Weltkoordinaten (schon heute).
- Kamerafahrten für den Auftritt (A6): `camera.focus(x, y, sec)` überschreibt kurz das Folgen; Spieler-Eingabe währenddessen gesperrt (max. 2,5 s, beim Wiederholen 0,8 s).
- Rand-Indikator (A7): Telegraph-Zonen außerhalb des Bildschirms → Pfeil am Rand in Zonenfarbe.

### 4.3 Arena-Daten (`src/data/arenas/<kind>.ts`, neu)
```ts
export interface ArenaDef {
  kind: EnemyKind;                 // boss_leviathan
  size: { w: number; h: number };  // logisch, z. B. 688 × 352
  entry: { x: number; y: number }; // Spieler-Startpunkt (Süden)
  bossAnchor: { x: number; y: number }; // fester Ankerpunkt des Körpers
  tiles: string[];                 // Kachel-Raster (16 px): '.' Boden, '#' Wand, '~' Abgrund, 'v' Ventil …
  phases: ArenaPhase[];            // Änderungen je Phase (Platten brechen, Lava an …)
  weakPoints: WeakPointDef[];      // Treffer-Kreise relativ zum Anker / an Teilen
  bg?: string;                     // optionales Hintergrund-Sprite (Fallback prozedural)
}
```
- Laden in `generateSectorFloor` *nach* der Raum-Generierung: Bossraum auf Ebene 3 bekommt `bounds`, Hindernisse/Abgründe aus `tiles`, und den Endboss-Spawn am `bossAnchor`.
- Arena-Mechaniken (brechende Platten, Strom-Gitter, Trümmerfall) laufen über das bestehende Mechanik-System (`roomMechanics.ts`) mit neuen Typen `arena_collapse`, `arena_hazard`.
- Endless-Spirale und Omega-Archon (S5) behalten vorerst den Standardraum (eigenes Folgeticket).

### 4.4 Schwachstellen (A3)
- `Enemy.weakPoints?: { id, x, y, r, open: boolean, hpShare?: number }[]` — Treffer prüft zuerst Schwachstellen; trifft ein Schuss den Körper ohne offene Schwachstelle: Funken + Hinweis „GEPANZERT“ ohne Schaden (Darstellung angelehnt an den Schild-Konter aus M10-C).
- Teile mit eigener HP (Leviathan-Arme): Zerstörung schwächt den Boss (Teil fällt ab → `detached.ts`, M11), HP fließen in den Gesamtpool.

## 5. Belohnungen (A8, keine Credits)
| Belohnung | Umsetzung | Wann |
| :--- | :--- | :--- |
| **Trophäen-Relikt** | Neues `ItemDef` je Endboss, Seltenheit `epic`, `maxStack: 1`, hoher `baseValue`; im Laden verkaufbar (Credits entstehen erst dort). Leviathan: **„A.E.G.I.S.-Herzlinse“** (`trophy_leviathan`). Bestehender Drop `leviathan_core` bleibt. | jeder Sieg (1×) |
| **Freischaltung = Waffen-Art** | Waffen-Arten sind in der Schmiede **komplett gesperrt**, bis der passende Sektor-Endboss besiegt ist (Entscheidung Inhaber; keine Infusion). Neue Tabelle `WEAPON_TYPE_GATES` in `balance.ts` (neben `WEAPON_TIER_GATES`), geprüft in `GameState.canCraftWeapon()` + Schmiede-UI zeigt „🔒 Bauplan: besiege A.E.G.I.S. Leviathan“. Siehe §5.1 | Erstsieg |
| **Hub-Trophäe** | Neuer Fall in `hubEvolution.ts`: Leviathan-Linse als leuchtende Vitrine auf der Promenade (Sprite optional + prozeduraler Fallback, `M10_OPTIONAL_SPRITES`). Interaktion = Codex-Eintrag mit Siegzeit | nach Erstsieg, dauerhaft |
| Extra-Loot | Boss-Truhe mit 3 Relikten aus `rollLootItem(3, …)` + `aegis_plate` (statt Einzel-Drops) | jeder Sieg |

### 5.1 Waffen-Arten-Sperre (Zuordnung vom Inhaber bestätigt, 2026-11-27)
| Waffen-Art | frei ab | Begründung |
| :--- | :--- | :--- |
| `blade` Klinge | Start (wie heute) | Startwaffe |
| `blaster`, `fists` | Start (in der Schmiede herstellbar) | genug Auswahl für Sektor 1 (Nah + Fern) |
| `spear` Ionen-Speer | **A.E.G.I.S. Leviathan** besiegt (S1) | passt zur Story (Speer = Leviathan-Technik) |
| `discus` | **Prisma-Archon** besiegt (S2) | Prisma-/Licht-Thema |
| `hammer` | **Vulkan-Titan** besiegt (S3) | Schmiede-/Lava-Thema |
| *(S4 Sternen-Archon)* | — | noch keine 7. Waffen-Art → bis dahin Hub-Trophäe + Relikt; später neue Waffe |

Regeln: **schon hergestellte Waffen bleiben** (alte Saves, kein Entzug); `sectorNCleared` aus alten Saves zählt als besiegt; NG+ behält alle Freischaltungen; Wochen-Prüfung normiert Waffen ohnehin (keine Auswirkung). Nach Änderung `npm test -- m10cp8 m10cp10` (Kampfdauer bei eingeschränkter Waffenwahl prüfen).

Wochen-Prüfung: weiterhin **kein** Loot, keine Freischaltung, keine Trophäe (`handleTrialBossKilled` bleibt maßgeblich).

## 6. Pilot-Design — A.E.G.I.S. Leviathan in der Reaktorhalle (Sektor 1, Ebene III)
**Bild:** Die Verlassene Korvette endet in der **Reaktorhalle**. A.E.G.I.S. ist die Verteidigungs-KI des Schiffs — ihr Körper ist ein riesiger Reaktorkopf, der die gesamte **Nordwand** (≈ 2 Bildschirme breit) einnimmt. Aus der Wand greifen **zwei Kranarme** und ein **Kabelstrang** in die Halle; der Boden ist ein Raster aus Bodenplatten über einem Glut-Schacht.

**Arena:** 688 × 352 logisch (2×2 Bildschirme). Süden: Eingang mit Tor (schließt beim Kampfstart). Mitte: offene Plattenfläche mit 4 Deckungs-Pfeilern. Seiten: 2 Kühlventile (`v`) je Seite. Norden: Boss-Wand mit Kern-Linse (Schwachstelle, nur in bestimmten Phasen offen).

| Phase | HP | Arena | Attacken (je mit Telegraph & Angriffsgrafik, D11) | Schwachstelle |
| :--- | :--- | :--- | :--- | :--- |
| **I — Wache** | 100–65 % | ganze Halle begehbar | **Kran-Hammer:** Arm schlägt in markierte Platte, bleibt 1,6 s stecken → **Arm angreifbar**. **Kabel-Peitsche:** Kabel fegt quer über die halbe Halle (Linie, Springen/Ausweichen hinter Pfeiler). **Ventil-Dampf:** Seitenventile stoßen Dampf aus (Reihen-Zonen) | Arme (eigene HP, je 15 %) |
| **II — Überlast** | 65–30 % | **Platten brechen** in der Mitte weg (Abgrund in Glut-Schacht, telegrafiert 1,2 s) → Halle wird zu Ringweg + Inseln | **Zwillings-Strahl** (vorhanden) fegt jetzt über die ganze Hallenbreite, Deckung hinter Pfeilern. **Trümmerfall:** Deckenteile fallen (Kreiszonen, gezielt + zufällig aus Seed). Ein zerstörter Arm wird durch Kabel ersetzt, das nach dem Spieler greift | **Kühlventile** (4×): zerstört → Kern überhitzt, Linse öffnet sich 3 s |
| **III — Kern frei** | < 30 % | Boss zieht sich zurück, **Kamera zoomt heraus/Halle bebt**, Wand-Panzer fällt ab (`detached.ts`), Glut steigt in Wellen von Norden nach Süden (Zonen-Bänder) | **Omega-Puls:** Ringwelle aus dem Kern mit Lücke. **Letzter Griff:** Kabelstränge ziehen am Spieler (Sog, vorhandenes `pull`). Kritisch < 15 %: Linse flackert dauerhaft offen, schnellere Züge | **Kern-Linse** dauerhaft offen |

**Sieg:** Kern erlischt, Kamera schwenkt zur Linse, Glut sinkt, Boss-Truhe + Trophäen-Relikt erscheinen in der Hallenmitte, Teleporter öffnet im Süden. Story-Flag/Kapitel I wie heute (`sector1Cleared`).

**Werte (Startpunkt, in `balance.ts`):** HP = heutiger Leviathan × 1,35 (größere Arena, Ausweichwege länger), Ziel-Kampfdauer 150–210 s bei Waffenstufe Sektor 1 (Messung mit `m10cp8` erweitern).

## 7. Vorgehensplan (Phasen)
| Phase | Inhalt | Dateien (Schwerpunkt) | Test |
| :--- | :--- | :--- | :--- |
| **A — Grenzen** | `DungeonRoom.bounds`, `scene.bounds`, Laufzeit-Klemmen umstellen (Standard bleibt identisch) | `dungeonGen.ts`, `DungeonScene.ts`, `enemyAi.ts`, `navGrid.ts`, `bossEngine.ts`, `bossFx.ts` | alle bestehenden Tests grün; neuer `m12p1` (Raum mit großen `bounds`: Spieler/Gegner bleiben drin) |
| **B — Kamera** | `camera.ts`, Renderer-Translation, Eingabe-Umrechnung, Rand-Pfeile, `focus()` | `camera.ts` (neu), `dungeonRenderer.ts`, `DungeonScene.ts`, `UIManager.ts` (nur falls HUD betroffen) | `m12p2` (Kamera klemmt, Standardraum = 0,0, Screenshot) |
| **C — Arena-Daten** | `ArenaDef`, Leviathan-Halle, Anhängen nach `generateSectorFloor`, prozeduraler Arena-Fallback | `src/data/arenas/leviathan.ts` (neu), `dungeonGen.ts`, `mechanicsGen.ts` | `m12p3` (Seed-Layout identisch außer Bossraum, Arena begehbar/erreichbar) |
| **D — Leviathan-Kampf** | 3 Phasen, Schwachstellen, Arena-Mechaniken, neue Attacken, Auftritt | `enemyAi.updateLeviathanAI` → eigenes `src/dungeon/bosses/leviathanArena.ts`, `bossFx.ts`, `roomMechanics*.ts` | `m12p4` (Phasenwechsel, Schwachstellen-Logik, Telegraph ≥ 0,4/0,8 s) |
| **E — Belohnungen** | Trophäen-Relikt, Waffen-Arten-Sperre (§5.1), Hub-Vitrine, optionale Save-Felder | `items.ts`, `balance.ts`, `upgrades.ts`, `UIManager.ts` (Schmiede), `types.ts`, `gameState.ts`, `hubEvolution.ts`, `artLoader.ts` | `m12p5` (Erstsieg vs. Wiederholung, Prüfung ohne Belohnung, Save alt lädt) |
| **F — Balance & Abnahme** | Kampfdauer messen, Mobil-Check, Boss-Labor-Eintrag „Arena“, Doku | `balance.ts`, `bossLab.ts`, Doku | `m10cp8`/`m10cp10` + Abnahme durch Projektinhaber |

Danach (eigene Tickets, erst nach Pilot-Abnahme): **Prisma-Archon** (Spiegel-Kathedrale, Lichtstrahlen über Spiegel umgelenkt), **Vulkan-Titan** (Kraterkessel, Lava-Fluss steigt, Titan ragt aus dem Krater), **Sternen-Archon** (Sternwarte, Plattformen driften, Teilen nutzt die zwei Arena-Hälften). Je Boss wird hier ein eigener §6-Block ergänzt.

## 8. Risiken & Parallel-Arbeit
- **Phase A/B berühren die heiklen gemeinsamen Dateien** (`dungeonRenderer.ts`, `DungeonScene.ts`, `enemyAi.ts`, `bossFx.ts`). Andere Chats (Gegner-Rigs) arbeiten dort ebenfalls im Renderer-Zweig. → Phase A/B in **kleinen Commits** und zeitnah per `npm run ship`; in `handoff/endboss_arena.md` vermerken, solange A/B laufen.
- Rig-Renderer zeichnen in Weltkoordinaten → funktionieren mit Kamera ohne Änderung (nur Translation davor).
- `bossFx`-Zonen mit Raumgrenzen (`ROOM.L + 6 … ROOM.R - 6`, z. B. Vulkan-Rand, Laser-Reihen) müssen `ctx.bounds` nutzen — sonst ist die Gefahr in der Großarena nur im linken oberen Viertel.
- Prüfung (Wochen-Trial) Ebene 3 enthält den Leviathan → Arena gilt auch dort; Par-Zeiten in `weeklyTrial.ts` ggf. anpassen (Mechanik-Gate wie `TRIAL_MECHANICS_FROM_WEEK`: `TRIAL_ARENA_FROM_WEEK`, damit laufende Wochen nicht kippen).
- Leistung: Großarena = 4× Bodenfläche → Boden-Kacheln einmal in Offscreen-Canvas vorzeichnen.

## 9. Benötigte Sprites (→ `SPRITE_QUEUE.md` P1-03 … P1-07, Status `[~]` bis Plan-Freigabe)
Alle optional mit prozeduralem Fallback (Regel 7). Stil: wie `hub_bg.png`/Dungeon-Kacheln, Palette Sektor 1 (Rost, Moos, Reaktor-Glut `#fb923c`/`#fbbf24`, Kühlblau `#38e8d4`).

| ID | Zielpfad | Format | Inhalt | Prompt (Kurz) |
| :--- | :--- | :--- | :--- | :--- |
| P1-03 | `public/art/sprites/arena_leviathan_bg.png` | 1376×704 (2× von 688×352) | Boden der Reaktorhalle: Plattenraster über Glut-Schacht, 4 Pfeiler-Sockel, Ventile an den Seiten, Tor im Süden; **ohne** Boss | „Top-down pixel art, derelict starship reactor hall floor, rusty metal grid plates over glowing orange reactor pit, mossy edges, four pillar bases, side coolant vents, southern blast door, no characters, cozy retro sci-fi, Moonlighter style“ |
| P1-04 | `public/art/sprites/arena_leviathan_wall.png` | 1376×192 | Nordwand = Leviathan-Körper: Reaktorkopf mit Kern-Linse in der Mitte, Panzerplatten, Kabelbündel, Kran-Schulter links/rechts | „… colossal AI reactor face built into the north wall, central glowing lens core, armored plates, cable bundles, crane shoulder mounts left and right …“ |
| P1-05 | `art_source/rigs/leviathan_arena_parts.png` | Typ P · 3×2 · 1536×1024 | Kranarm-Oberarm · Kranarm-Unterarm · Hammer-Klaue · Kabel-Segment · Kühlventil (intakt) · Kühlventil (zerstört) | Formel P (`ART_BRIEF_M11.md` §2), Referenz P1-04 |
| P1-06 | `art_source/rigs/leviathan_arena_fx.png` | Typ E · 3×2 · 1536×1024 | Bodenplatte bricht (3 Stufen) · Deckentrümmer · Dampfstoß · Kern-Linse offen | Formel E, Referenz P1-03 |
| P1-07 | `public/art/sprites/prop_trophy_leviathan.png` + `item_trophy_leviathan.png` | 96×96 + 64×64 | Hub-Vitrine mit leuchtender Herzlinse · Item-Icon der Linse | wie `ART_AND_DESIGN_GUIDE.md` §7 (Promenade) bzw. §3 (Items) |

## 10. Entscheidungen zu den offenen Fragen (Inhaber, 2026-11-27)
1. **Wochen-Prüfung:** die laufende Woche bleibt unverändert — Arena erst ab der **nächsten Woche nach dem Release** (`TRIAL_ARENA_FROM_WEEK` = erste Woche nach Deploy von Phase D).
2. **Freischaltung:** keine Infusion „Omega-Überlast“ — stattdessen **Waffen-Arten bis zum Sektor-Abschluss sperren** (§5.1).
3. **Endless-Spirale:** Endbosse bleiben dort im Standardraum (Folgeticket nach dem Piloten).

## 11. Umsetzungsnotizen
*(wird während der Umsetzung gefüllt: Abweichungen, gemessene Werte)*

## 12. Verknüpfte Dokumente
[AGENTS.md](AGENTS.md) · [BOSS_ENEMY_PIPELINE.md](BOSS_ENEMY_PIPELINE.md) (Ablauf & Qualität) · [BOSS_ANIMATION_PLAN.md](BOSS_ANIMATION_PLAN.md) (D1–D14) · [MILESTONE_10C_ARCHITECTURE.md](MILESTONE_10C_ARCHITECTURE.md) (Boss-Engine, Balance) · [MILESTONE_10_ARCHITECTURE.md](MILESTONE_10_ARCHITECTURE.md) (Mechaniken, Seeds) · [MILESTONE_11_ARCHITECTURE.md](MILESTONE_11_ARCHITECTURE.md) (Rigs, abgelöste Teile) · [PARALLEL_WORK.md](PARALLEL_WORK.md) · [SPRITE_QUEUE.md](SPRITE_QUEUE.md)
