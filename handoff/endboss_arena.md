# Handoff — Endboss-Arenen (M12)
> Eigenes Status-Blatt. Plan: [`MILESTONE_12_ARCHITECTURE.md`](../MILESTONE_12_ARCHITECTURE.md).

## Claim
- **Besitzer: frei** (Stand 2026-11-28) — Pilot wartet auf Abnahme im echten Spiel (Pipeline Stufe 8). **Nächste Arena (S2–S4) erst nach Abnahme starten**, dann Claim in [`README.md`](README.md) eintragen (`PARALLEL_WORK.md` §5).

## Stand (2026-11-28)
- **✅ A.E.G.I.S. Leviathan — Umbau auf Schienen-Kran-Koloss mit echtem M11-Rig (`e0a1849`, `8305e6c`, Test `m12p8_leviathan_rework`):**
  - ✅ **Feste Nordwand-Laufschiene + M11-Rig (`src/data/rigs/boss_leviathan.json`, `src/dungeon/anim/rigs/boss_leviathan.ts`):** 12 Rig-Teile (`carriage`, `torso`/`P2`/`P3`/`Dead`, `head`/`headP2`, `armIdle`/`armRaise`/`armSlam`/`armDmg`/`armCrit` in `public/art/rigs/boss_leviathan/`). Schlitten sitzt starr auf der Nordwand-Schiene (kein vertikales Wackeln), der gesamte Koloss fährt beim `hammer`-Angriff auf der Schiene zur Spieler-X-Position (`165 px/s`), Kopf schaut dynamisch zum Spieler, Torso atmet/neigt/zuckt, beide Pose-Set-Arme teilen exakt denselben Schulter-Pivot `[0.55, 0.415]`.
  - ✅ **Wand-Geisterkern entfernt (`public/art/sprites/arena_leviathan_wall.png`):** alter statisch gemalter Kern in der Wandmitte nahtlos durch durchgehende Industriewand ersetzt.
  - ✅ **Keine dritte Hand & Krater exakt unter den Knöcheln:** Beim `hammer` schlägt der echte Rig-Arm direkt vor dem Koloss bei `(e.x + side * 66, e.y + 38)` in den Bodenkrater (Krater wird **vor** `drawRig()` gezeichnet!) + schickt eine Erdbeben-Spaltwelle nach Süden durch die gesamte Halle.
  - ✅ **Monumentale Endboss-Attacken (`bossFx.ts`, `leviathanArena.ts`):** Polierter, mehrschichtiger 68-px-**Omega-Reaktor-Strahl** direkt aus der Brust-Linse; **Titanen-Welle** (`width: 26`); **Überdruck-Sturm** (`h: 44`, `w: 200`) nur aus intakten Kühl-Schächten (nahtlos in `arena_leviathan_bg.png` integriert, mit Glühen & dezenten Ziel-Klammern statt aufgeklebter Kästchen).
  - ✅ **Endlos-Absturz-Loop in Phase II behoben:** `DungeonScene.findSafeFloorPos()` validiert `lastSafeX/Y` beim Pit-Fall-Respawn **und** direkt beim Wegbrechen der Mittelplatten.

- **✅ Optik-Bereinigung (Chat „Leviathan Optik“, 2026-11-28):** `armRaise`/`armSlam` waren am Zellraster zerschnitten (halbe Arme, harte Schnittkante, Fremdstück links) → aus `art_source/rigs/boss_leviathan_arms.png` per Komponenten-Ausschnitt neu gesetzt (Schulter-Pivot (132,108) unverändert, Raise 0,86× damit sie in den 240×260-Rahmen passt); Rest-Splitter links an `torso`, `torsoP2`, `head`, `headP2` entfernt. **Learning 20:** Posen eines Sheets, die über die Zellgrenze ragen, nie per Raster schneiden, sondern per Flood-Fill/Komponente. ⬜ Offen: Sichtprüfung im echten Spiel (`?bosslab` → ARENEN), evtl. weitere Feinheiten (Kopf-Sitz, Torso-Hals-Loch) nach Rückmeldung des Inhabers.

- **✅ Optik-Bereinigung 2 (2026-11-28):** Hals-Loch im Torso (`torso`, `P2`, `P3`, `Dead`) mit Stahl-Kragen (Plattenfugen, Kühlschlitze) gefüllt; Arme im Rig von `±14` auf `±28` nach außen (`boss_leviathan.json`), damit die Fäuste die Kern-Linse (Schwachstelle) nicht mehr verdecken; weiße Rand-Fransenpixel an allen Teilen entfernt. Rest ⬜: Sichtprüfung im echten Spiel, Kopf-Sitz in Phase III ggf. nachjustieren (`head` `offset`/`attach` in der JSON).

## 💡 Praxis-Learnings & harte Fallen aus dem Leviathan-Pilot (für S2–S4 Endbosse & künftige Chats!)
> **Unbedingt lesen vor jeder neuen M12-Endboss-Arena oder Boss-Rig-Überarbeitung:**
1. **Keine 2D-IK-Stäbchen / Sticker-Gelenke an Wand-Bossen:** Zusammengestöpselte Einzelteil-Knochen und runde Gelenk-Kreise wirken wie drübergelegte Fremdteile. Stattdessen immer ein echtes **M11-Pose-Set-Rig** (`src/data/rigs/<boss>.json`) bauen — ganze Arm-Posen (`armIdle`, `armRaise`, `armSlam`, `armDmg`, `armCrit`), die im selben Stil-Durchgang entstehen.
2. **Gemeinsamer Schulter-Pivot für alle Arm-Posen (Pflicht!):** Jede Pose eines Pose-Sets (`armIdle`, `armRaise`, `armSlam`, …) muss im PNG **exakt denselben Schulter-Gelenkpunkt** auf derselben Pixel-Koordinate haben (z. B. `240×260`, Schulter bei `(132, 108)` → `pivot: [0.55, 0.415]`), sonst löst sich beim Posenwechsel die Schulter vom Torso oder verschiebt sich.
3. **Keine mitgezeichnete Bodenplatte im beweglichen Boss-Sprite:** Wenn der Boss atmet oder wackelt, wackelt jede mitgezeichnete Bodenkante sichtbar über der Map. Statische Verankerung (Schiene, Wand-Sockel) immer starr & getrennt zeichnen; nur bewegliche Rig-Teile animieren.
4. **Kein Geister-Boss in der Hintergrund-Wand (`arena_*_wall.png`):** Sobald sich der Boss auf einer Schiene bewegt, darf die Wand-Grafik keinen statisch gemalten Boss-Kern in der Mitte enthalten.
5. **Keine doppelte/dritte Hand bei Fern-Schlägen:** Wenn ein Wand-Boss eine 2×2-Arena abdecken soll, **entweder** auf einer Nordwand-Schiene fahren + direkt vor sich schlagen + Schockwelle/Erdbeben nach Süden senden, **oder** ein frei bewegliches Groß-Rig nutzen — nie eine zusätzliche Hand spawnen, während der echte Arm noch am Körper hängt.
6. **Krater & Bodeneffekte VOR `drawRig()` zeichnen:** Sonst liegt der Einschlagskrater über dem Unterarm statt unter den Knöcheln! Und Hitbox/Krater exakt unter den Knöcheln auf festem Boden ausrichten (nicht über einem Phase-2-Abgrund).
7. **Dynamische Abgründe (Phase-II-Plattenbruch):** `DungeonScene.findSafeFloorPos()` schützt vor Endlos-Absturz-Loops — bei jeder künftigen Arena mit wegbrechendem Boden `lastSafeX/Y` direkt im `onFire`-Callback per `findSafeFloorPos` absichern.
8. **Wand-Ziele (Kühlventile etc.) ins Hintergrund-Artwork integrieren:** Keine kleinen fremden Kästchen über ein fertiges Hintergrund-Gitter kleben — stattdessen weiches Aufglühen + dezente Ziel-Klammern + HP-Leiste direkt am Hintergrund-Element.
9. **Sprite-Extraktion (PIL):** Bei weißen Laser-/Plasma-Streifen nur von oben/unten fluten (nie von links/rechts, sonst entstehen Löcher im weißen Kern); bei Figuren mit Armen am Torso auch eingeschlossene weiße Achsel-Taschen entfernen; bei `check-sprites.mjs` erwartet `sheet.file: "<rig>"` die Datei `art_source/rigs/<rig>_parts.png`.
10. **Vercel Free Limit (100 Deploys/Tag):** `vercel.json` deployt nur `main` (`deploymentEnabled: { main: true, "*": false }`) und überspringt reine Doku-/Test-/`art_source`-Commits per `ignoreCommand`. Änderungen immer sinnvoll bündeln statt viele Mini-Pushes.
11. **Kill-Switch + Wochen-Prüfung gesondert absichern:** Neue Arena hinter `ENDBOSS_ARENA_LIVE` (`balance.ts`) bauen; Ansehen vorher über `?bosslab` → ARENEN. In der Wochen-Prüfung erst ab `TRIAL_ARENA_FROM_WEEK` (`trialHasArena`), sonst kippt eine laufende Wertungswoche. Notfall-Rückweg = Flag auf `false`.
12. **Arena erst NACH `generateSectorFloor` anhängen (`attachArenas`)** und dabei kein `Math.random` verbrauchen — sonst ändern sich alle geseedeten Layouts. Nachweis: Test zählt `Math.random`-Aufrufe mit/ohne Arena und vergleicht alle Räume außer dem Bossraum (`m12p3`).
13. **Eintritt in die Arena immer am Südrand** (`DungeonScene.enterRoom`): Der Bossraum erbt die Tür-Seite aus dem Stockwerks-Grundriss; ein Eintritt von West/Ost setzte den Spieler ins Kühlaggregat (eingeklemmt). Test mit `playerFree`-Prüfung über mehrere Seeds wiederholen (flaky = echter Fehler, nicht Test neu starten).
14. **„Standardräume unverändert“ beweisen statt behaupten:** Deterministische Szenarien (fester Zufall, mehrere Gegner/Bosse, 1500 Ticks, Kamera-Frames) auf dem alten Commit (`git worktree add … <sha>`) und dem neuen laufen lassen, Spuren/JPEG-Frames vergleichen → „bit-/pixelgleich“. Hat bei Phase A/B/C jedes Mal Rückfragen erspart.
15. **Schwachstellen-Muster (A3):** `getClosestEnemyHitPoint` liefert den nächsten Trefferpunkt (offene Schwachstellen bevorzugt, Bonus ~12 px) und merkt ihn **für denselben Frame**; `damageEnemy` filtert direkt vor dem HP-Abzug. Kein frischer Treffer (Brand, Ketten-Blitz) = Panzer. Teilschaden immer auf die Teil-HP deckeln, sonst tötet ein Treffer auf ein Ventil den Boss.
16. **Kamera:** Klemm-Bereich so wählen, dass der Arena-Rand am Bildschirmrand dort sitzt, wo im Standardraum die Wand liegt (`DungeonCamera.range`) → Standardraum = exakt (0, 0). Für hohe Bosse `RoomBoundsDef.vt` + `ArenaDef.cameraBiasY` statt die Arena zu verschieben. `focus()` sperrt Eingabe über `input.locked` (max. 2,5 s).
17. **Boss-Labor/Bot-Fallen:** `Boss ∞` hält die HP ≥ 5 % → Bot kann den Boss nie töten (für Kampftests `bossLab.bossImmortal = false`). Abgrund-Sturz passiert auch bei Unverwundbarkeit; der Sog (`pull`) zieht in den Abgrund → Bots müssen Umwege (A*) nehmen oder `z.pull = 0`; steckt ein Bot „bei 62 % HP fest“, zuerst Position/Ziel loggen statt am Boss zu zweifeln.
18. **Zustands-Sprites per Referenz-Edit:** `npm run art:gen` mit dem Basisbild als `--ref` und Prompt „gleiche Komposition/Größe/Sockel, nur den Zustand ändern“ → konsistente Varianten (überhitzt, Kern frei, erloschen). **Alle Zustände mit derselben Zuschneide-Box freistellen** (nicht je Bild `getbbox()`), sonst verrutschen sie beim Wechsel; weißen Kern nicht mit „eingeschlossenes Weiß entfernen“ löschen (nur seitliche, reinweiße Lücken).
19. **Gefahr auf dem Weg zum Test:** Vercel-Limit und Parallelarbeit (`PARALLEL_WORK.md` §5) kosten oft mehr Zeit als der Code — vor dem Bauen Claim prüfen, vor dem Deploy bündeln.
20. **Posen, die über die Zellgrenze ragen, nie per Raster schneiden** (Ursache der halben Arme): per Flood-Fill (Hintergrund `min(RGB) > 225` vom Rand aus) + Komponente ausschneiden, Maßstab von der Idle-Pose übernehmen, Schulter-Mittelpunkt auf den gemeinsamen Pivot (132,108) setzen; passt eine Pose nicht in den 240×260-Rahmen → Pose skalieren (Raise 0,86×), nicht den Rahmen ändern.
21. **Boss im Ganzen ansehen, nicht nur im Test-Screenshot:** Kamera klemmt am Arena-Rand und schneidet den Boss ab. Zum Prüfen kurz einen Hilfstest schreiben, der `camera.renderY` überschreibt (z. B. `() => camera.y - 60`) und alle 3 Phasen als Ausschnitt 3× vergrößert speichert; danach den Hilfstest wieder löschen. Immer die Phasen nebeneinander vergleichen (Kopf-Sitz, Hals, Linse frei?).
22. **Hohle Teile füllen:** Offene dunkle Hohlräume in Torso-Sprites (Hals-Loch) wirken leer; per Flood-Fill auf der Hohlraumfarbe (Toleranz ~22, auf Oberkörper begrenzt, Leck-Check < 9000 px) mit Stahlstruktur füllen. Seed-Farbe vorher prüfen (Outline ist ähnlich dunkel).
- **✅ Pilot A.E.G.I.S. Leviathan — alle Sprites & erweiterten Sektor-Endboss-Standards (A1–A15) umgesetzt; bereit zur Abnahme im echten Spiel!**
  - ✅ **Erweiterte Sektor-Endboss-Standards `A11–A15`** in [`MILESTONE_12_ARCHITECTURE.md`](../MILESTONE_12_ARCHITECTURE.md) §2 & [`BOSS_ENEMY_PIPELINE.md`](../BOSS_ENEMY_PIPELINE.md) festgeschrieben.
  - ✅ **Alle 4 Körper-Zustände (A11, P1-10 & P1-11a/b/c):** Phase I (`arena_leviathan_body.png`), Phase II überhitzt (`_p2.png`, 97,7 % Deckung), Phase III Panzer abgesprengt (`_p3.png`, 96,2 % Deckung), Besiegt/erloschen (`_dead.png`, 94,6 % Deckung) + kritische Funken-Partikel unter 15 % HP. **0 fehlende M12-Sprites!**
  - ✅ **Kran-Arme & Arena-Teile (P1-05, A13):** Kran-Hammer aktiv/steckend (`arena_leviathan_hammer.png`, `_grounded.png`), Kabelkette (`arena_leviathan_cable.png`), zerstörtes Kühlventil (`arena_leviathan_vent_broken.png`), Arm-HP-Leiste beim Feststecken & funkender Schulterstumpf bei zerstörtem Arm.
  - ✅ **Arena-Angriffs- & Umwelt-Effekte (P1-06, A12):** 3-stufig brechende Bodenplatten vor dem Einsturz (`plate_1/2/3.png`), fallende Deckentrümmer-Brocken (`debris.png`), Hochdruck-Dampfwolken (`steam.png`), rotierende/pulsierende offene Kern-Linse-Aura (`lens_flare.png`).
  - ✅ **Moonlighter-Schatzkammer & gezielte Boss-Truhe (P1-12, A8/A14):** nach dem Sieg bleibt der erloschene Koloss (`_dead.png`) in der Nordwand, dahinter öffnet sich ohne Ladeübergang die Schatzkammer mit gezielter Boss-Truhe (`leviathan_core`, `aegis_plate`, beim Erstsieg `trophy_leviathan` + Ionen-Speer-Freischaltung & Hub-Vitrine, plus 3 hochwertige Relikte, keine Credits). Test `m12p7_vault` prüft Erstsieg, Wiederholung & alle visuellen Zustände.
  - ✅ **Phase F Kampfdauer gemessen (A15, `m10cp8` → `tests/out/ttk.json`):** Leviathan-Arena (9315 HP, S1-Startwaffen Stufe 3, echte Schwachstellen-Fenster) = **187,5 s** — exakt im Zielband **150–210 s**.
- **⚠ Phase A–D läuft** (gemeinsame Dateien!) — umgesetzt & gepusht, Abnahme durch Projektinhaber offen.
- **🧪 Testen ohne Durchspielen:** `…/?bosslab` (Groß-/Kleinschreibung egal) → Tab „Bosse“ → Abschnitt **ARENEN** → „🏟 Leviathan“ lädt den echten Arena-Bossraum (Auftritt, Kamera, 3 Phasen; `PII`/`Boss ∞`/`Ich ∞`/Zeitlupe funktionieren). **Künftige Arena-Bosse erscheinen dort automatisch**, sobald sie in `src/data/arenas/index.ts` (`ARENAS`) stehen. Test `m12p6_lab`.
- **🟢 LIVE seit 2026-11-27** (`ENDBOSS_ARENA_LIVE = true` auf Wunsch des Inhabers; Wochen-Prüfung ab `TRIAL_ARENA_FROM_WEEK = '2026-W49'`). Abnahme im echten Kampf weiterhin offen → Rückmeldungen hier sammeln.
- **Phase D (Leviathan-Arena-Kampf) umgesetzt:**
  - `src/dungeon/bosses/leviathanArena.ts`: Auftritt (Kamera-Fahrt + Banner, 2,5 s bis zum ersten Sieg, danach 0,8 s; Eingabe gesperrt, kein Schaden) · Phase I Kran-Hammer (Arm steckt 1,6 s → angreifbar, eigene HP 15 %) / Kabel-Peitsche / Ventil-Dampf · Phase II (65 % oder beide Arme zerstört) Platten brechen (1,2 s Vorwarnung, 3 Bruchstufen → Abgrund) / Zwillings-Strahl über die Halle / Trümmerfall / Kabel-Griff; Kühlventile (4 × 4 %) → Linse 3 s offen; ohne intakte Ventile öffnet die Linse nach großen Angriffen 2,5 s (kein Weichlock) · Phase III (30 %) Panzer fällt ab, Linse dauerhaft offen, Omega-Puls (Ringe mit Lücke), Glut-Wellen N→S (jedes Band mit Lücke), Letzter Griff (Sog); < 15 % kritisch (schneller + Funken) · Sieg: Abgrund schließt sich, Kamera zur Linse, Banner, Schatzkammer.
  - Panzer (A3): Treffer außerhalb offener Schwachstellen → Funken + „GEPANZERT“, kein Schaden; Teil-Schaden gedeckelt auf Teil-HP (fließt in den Pool). Ziel-Hilfe zielt auf offene Schwachstellen.
  - Werte in `balance.ts` → `ENDBOSS_ARENA` (HP ×1,35 = 9315). Wochen-Prüfung: `TRIAL_ARENA_FROM_WEEK = '2026-W49'` + nur wenn live (`trialHasArena`).
  - Test `m12p4`; Screenshots aller Phasen angesehen; Standardraum (normaler Leviathan) vor/nach Phase D identisch.
  - **Kachelplan an gelieferte Sprites P1-03/P1-04 angepasst:** `p` = Glut-Gitter (3 Rechtecke → Abgrund), Pfeiler auf den 4 Sockeln, Kühlaggregate `V` (Spalten 0–4/38–42) mit Ventilen `v` an den Kühlsektionen (Zeilen 9/12). Kühlaggregate/Sockel werden nicht mehr als Hindernis-Grafik übermalt.
  - **A1–A15-Stand:** A1 ✅ · A2 ✅ · A3 ✅ · A4 ✅ · A5 ✅ · A6 ✅ · A7 ✅ · A8 ✅ · A9 🔶 Mobil-Test im echten Gerät offen · A10 ✅ (`m12p3`/`m12p4`) · A11 ✅ (alle 4 Körper-Sprites + kritische Funken) · A12 ✅ (`P1-06` Platten 1–3, Trümmer, Dampf, Linse) · A13 ✅ (Arm-HP-Leiste, Schulterstumpf, zertrümmertes Ventil) · A14 ✅ (`m12p7_vault`) · A15 ✅ (`m10cp8` 187,5 s + `m12p6_lab`).
- **Phase C (Arena-Daten) umgesetzt — Arena ist im Live-Spiel noch AUS** (`ENDBOSS_ARENA_LIVE = false` in `balance.ts`, wird mit Phase D eingeschaltet). **Ansehen: Spiel-URL mit `?arena`** → Sektor 1, Ebene III, Bossraum = Reaktorhalle.
  - `src/data/arenas/` (`types.ts` ArenaDef, `leviathan.ts` Kachelplan 43×22, `index.ts`: `ARENAS`, `arenaEnabled()`, `arenaObstacles()`, `applyArena()`, `attachArenas()`); `DungeonRoom.arenaKind?`.
  - Anhängen in `DungeonScene.startFloor` nach `generateSectorFloor` (kein Math.random; nie in der Wochen-Prüfung, nie in der Endlos-Spirale). Nordtür → 3-Kachel-Durchgang im Boss-Sockel.
  - Belohnungs-/Extraktions-Pads, Loot-Drops, Geschütz-Startpunkte, Heilstation in `DungeonScene` + Renderer jetzt über `scene.bounds` (Standardraum identisch — Vorher/Nachher-Vergleich inkl. Boss-Sieg & Drops).
  - `arenaFloor.ts` zeichnet den Kachelplan (Glut-Platten `p`, Boss-Wand-Fallback über `W`); Sprites `arena_leviathan_bg/wall` (P1-03/04) werden automatisch genutzt, sobald vorhanden (`M12_OPTIONAL_SPRITES`). Wand-Sockel wird nicht als Schott-Balken gezeichnet.
  - Test `m12p3` + Screenshots `tests/out/m12p3_arena_north/south.png` (angesehen).
- **Sprites P1-03 & P1-04 geliefert ✅** (`arena_leviathan_bg.png` `1376×704` + `arena_leviathan_wall.png` `1376×192`, `m12p3` grün + Screenshots geprüft); **STOP-GATE vor `P1-05`/`P1-06`** wartet auf Sichtprüfung im Spiel (`?arena`).
- **Phase B (Kamera) umgesetzt:**
  - `src/dungeon/camera.ts` (`DungeonCamera`): Standardraum immer (0, 0); Arena: Totzone 40×24, Glättung τ 0,12 s, Klemme so, dass der Arena-Rand wie die Standard-Wand sitzt (`DungeonCamera.range`), kleiner Raum mittig, Rasterung auf HD-Pixel, `snap()` beim Raumwechsel, `focus(x, y, sec)` (max. 2,5 s, sperrt Spieler-Eingabe über `input.locked`), `toWorld/toScreen`.
  - `DungeonScene`: `scene.camera`, `update()` → `updateFrame()` + Kamera-Update; Maus-Zielen Bildschirm → Welt.
  - Renderer: Welt unter `translate(-cam)`, Tönungen über den Kamera-Ausschnitt, HUD/Minimap/Boss-Leiste/Prompt (Welt → Bildschirm) ohne Translation; Türen, Boss-Laser-Raycast und Sporen an `scene.bounds`.
  - `src/dungeon/arenaFloor.ts`: prozeduraler Arena-Boden (Offscreen-Canvas, einmal je Raum) als Rückfall bis `arena_leviathan_bg.png` (P1-03, wird in Phase C geladen).
  - `src/dungeon/edgeIndicators.ts` (A7): Rand-Pfeil in Zonenfarbe für `bossFx`-Zonen außerhalb des Bildes (nur in Arenen).
  - Nachweis: `m12p2` + Screenshots `tests/out/m12p2_std.png` / `m12p2_arena.png` (angesehen). Einmalig: 36 gerenderte Frames (6 Szenarien, u. a. Leviathan, Kern-Wächter, Prisma-Archon, Krall) im Standardraum vor/nach Phase B **pixelgleich**.
  - Touch-HUD ist HTML (`UIManager`) und bleibt ohnehin am Bildschirm.
- **Phase A (Raumgrenzen pro Raum) umgesetzt:**
  - `DungeonRoom.bounds?` + `roomBounds()` / `DEFAULT_ROOM_BOUNDS` / `hasCustomBounds()` (`dungeonGen.ts`), Getter `scene.bounds`, `scene.rayLimit()`.
  - Umgestellt: Spieler-Klemme, Türen & Eintrittspunkte, Projektile, Drops, Rail-Strahl (`DungeonScene.ts`); alle Klemmen/Boss-Positionen in `enemyAi.ts`; `NavGrid` (Raster je Raum); `BossCtx.room` + `bossRoom()` + `clampToRoom(…, room)` (`bossEngine.ts`, `defs.ts`); Sog in `bossFx.ts`; Magnetplatten (`roomMechanics.ts`).
  - **Bewusst noch auf den Konstanten** (Phase B/C): `dungeonRenderer.ts` (Türen, Laser-Raycast, Partikel), Belohnungs-Pads/Loot-Positionen/Geschütz-Startpunkte in `DungeonScene.ts`, Layouts in `dungeonGen.ts`/`mechanicsGen.ts`.
  - Nachweis: `m12p1` (Standard = Konstanten, Nav 43×22, Ablauf mit expliziten Standard-Grenzen identisch; Arena 688×352: Spieler/Gegner/Projektile/Drops/Türen/Eintritt/Boss bleiben drin). Zusätzlich einmalig: 9 Gegner-/Boss-Szenarien (u. a. Leviathan, Vulkan-Titan P2, Sternen-Archon-Teilen, Kern-Wächter, Krall) vor/nach Phase A **bit-identisch**.
- **Plan geschrieben, Fragen §10 beantwortet** (Prüfung erst ab nächster Woche, Waffen-Arten-Sperre statt Infusion, Endless-Spirale bleibt Standardraum). Noch kein Code. Zuordnung Waffe ↔ Endboss (§5.1) bestätigt.
- Pilot: A.E.G.I.S. Leviathan (S1, Ebene III) — Reaktorhalle 2×2 Bildschirme, Boss = Nordwand, 3 Phasen, Schwachstellen.
- Sprites geplant: `SPRITE_QUEUE.md` P1-03 … P1-07 (Status `[~]`, erst nach Freigabe auf `[ ]` setzen).

## Phase E erledigt (2026-11-27)
- Waffen-Arten-Sperre, Herzlinse (`trophy_leviathan`), Hub-Vitrine — angehängt an `sector1Cleared`; Test `m12p5`. Details: `MILESTONE_12_ARCHITECTURE.md` §11. `P1-07` (`prop_trophy_leviathan.png` 96×96 + `item_trophy_leviathan.png` 64×64) geliefert ✅.
- Später (mit Arena, Phase D): Belohnung an das Arena-Sieg-Ereignis hängen, Vitrinen-Interaktion (Codex/Siegzeit).

## Achtung für parallele Chats
- Phase A (Raumgrenzen pro Raum) und B (Kamera) ändern die gemeinsamen Dateien `DungeonScene.ts`, `enemyAi.ts`, `dungeonRenderer.ts`, `bossEngine.ts`, `bossFx.ts`, `navGrid.ts`. Solange A/B laufen, steht das hier als **„A/B läuft“** — Rig-Chats dann nur kleine Renderer-Änderungen und vorher `git fetch`.


### Leviathan-Rig-Politur (Arme schwebten, Schlaf-/Tod-Zustand)
- **Ursache „Arme schweben weit weg“:** Die Torso-PNGs (`torso`, `torsoP2`) lagen im 200×200-Rahmen bis zu 26 px rechts der Mitte (P3/Dead mittig) und `attach` der Arme war 0.06/0.94 + `offset ±28` → linker Arm 40+ px neben dem Körper, Torso-Varianten sprangen beim Phasenwechsel. Fix: `scripts/leviathan-center-torso.py` (Torso-Varianten auf Mitte 100 schieben), Arme `attach [0.1|0.9, 0.4]`, `pivot [0.42, 0.41]` (= Schulter-Kugel im Arm-Bild), `offset 0`; Kopf `pivot.x 0.67` (Kopf-Inhalt liegt rechts im 110er-Rahmen). **Lehre:** Pivot/Attach immer aus der echten Inhalts-Bbox (nicht aus Bildmitte) rechnen; `python3` + Pillow/numpy genügt (`getbbox`/Alpha).
- **Tod/Schlaf ohne Sprite:** Tote Arme nutzten `armDmg` (glühende Lava-Risse), Kopf blieb cyan-leuchtend. Neu per `art:gen`: `armDead.png` (Variante 5 beider Arme) + `headDead.png` (Kopf-Variante 2), Rohbilder `art_source/rigs/boss_leviathan_armDead.png`/`_headDead.png`, Nachbearbeitung (Flood-Fill, Maßstab auf `armIdle`/`head`-Bbox) mit `scripts/leviathan-dead-parts.py <roh.png> armDead|headDead`. Verwendet in `anim/rigs/boss_leviathan.ts` (dead) und `drawLeviathanBodyStatic`.
- **Prüfen:** `node scripts/rig-sheet.cjs boss_leviathan` (Fälle ruhe/hebt/schlag/steckt/beam/P2/P3/tot) → `tests/out/rig_boss_leviathan.png`. Frische VM: erst `npm install`.
- Offen: kleine weiße Rauch-Pixel am Rand von `armDead.png` (Rauch war fast weiß im Rohbild) — kosmetisch, ggf. Nachbestellen/Nachzeichnen.


### Leviathan-Politur Runde 2 (Zuckeln, Einschlag-Versatz, Laser-Ursprung, Phase II)
- **Messwerte (Rig, Ursprung = `e.x/e.y`, `scripts/lev-measure.cjs`):** Linsenmitte `(0, +19)` (alt `LENS_DY=6` → Strahl/Puls/Linsen-Treffer 13 px zu hoch), Faust beim Schlag `(±37, +48)` (alt: Einschlag bei `±66, +38` = 29 px neben der gezeichneten Faust), Schulter `(±40, −7)`. Konstanten `LENS_DY`, `SLAM_DX/DY`, `BODY_SHOULDER_*` in `leviathanArena.ts`. **Lehre:** Nach jedem Austausch des Körper-Sprites (Vollpose → Rig) alle Effekt-Ursprünge neu am gerenderten Rig messen, nicht aus dem alten Sprite übernehmen.
- **Zuckeln:** Schienenfahrt ruckte (fester Schritt, Ziel = Spielerposition ohne Totzone) → jetzt weiche Beschleunigung (`L.railV`, 340 px/s², Abbremsen vor dem Ziel, Totzone 3 px); Vibrationen reduziert; `tau` 0,055 → 0,085.
- **Laser sichtbar:** Beim Omega-Strahl reißen beide Arme hoch (Variante `armRaise`, `dx ±22`), die Linse liegt frei, Strahl startet exakt dort. **Schockwelle (`whip`)** hat neuen Arm-Zustand `'whip'`: Faust fährt hoch und schlägt auf den Boden, die Welle startet exakt an der Faust (alt: Startpunkt an einem Phantom-Arm weit seitlich).
- **Phase II/III ramponiert:** Arme nutzen ab Phase II `armDmg`, Phase III `armCrit`; ständiger Funken-/Glut-/Rauchregen am Körper (`updateLeviathanArena`, deterministisch über `scene.time`).
- **Dampf-Vorwarnung:** Düse pulsiert + Pfeile laufen die Bahn entlang (vorher kaum sichtbar, `subtleWarn`).
- **Diagnose-Skripte:** `node scripts/lev-shots.cjs <phase> <zug>:<sek> …` (Arena-Screenshots je Zug/Phase → `tests/out/lev_p*_*.png`; nutzt `startMoveForTest`), `node scripts/lev-measure.cjs` (Rig-Maße).
- Offen: Der Koloss wirkt im 688×352-Raum eher klein (~110 logische px breit) — falls gewünscht größere Rig-Skalierung bzw. neues, größeres Sheet bestellen (Regel 14); Glut-Welle (`glow`) kommt weiterhin von beiden Seitenwänden (Vorwarnung unverändert).


### Runde 3: Doppelschlag + 4 kleine Gruben
- **Neuer Zug `quake` („DOPPELSCHLAG!“)** in allen Phasen (Ende der Zugfolge; fehlt ein Arm → Rückfall `hammer`): beide Arme heben und schlagen gleichzeitig (Arm-Zustand `'whip'`), von beiden Fäusten laufen 7 Schockwellen-Ringe (`ring`/`pulse`, je 30 px breit, Abstand 50 px, 0,26 s Takt) über die gesamte Halle; je Ring Lücke Richtung Spieler (±0,28 rad wechselnd, `gapHalf 0.5`).
- **Phase-II-Abgrund:** statt einer riesigen Fläche brechen **4 kleine Blöcke** (5×4 Kacheln) weg, Kreuz-Gang (3 Kacheln breit) bleibt — nur `src/data/arenas/leviathan.ts` (`p`-Kacheln). Hintergrund-Bild zeigt weiter das Glutgitter darunter.

- **Doppelschlag-Optik (Inhaber-Feedback):** Wellen liefen über Wand/Boss. Neu: `BossZone.sy` (Boden-Perspektive 0,6, Treffer & Optik als Ellipse) + `BossZone.clip` (Zeichnung nur auf dem Boden: `rb.t + 3·ARENA_TILE` = Wand-Sockel-Unterkante, die `W`-Kachelreihen liegen INNERHALB `rb`!), eigene Boden-Welle (dunkler Körper + glühende Kante statt Leuchtringe), Wand bröckelt an den Kontaktpunkten (`crumbleAtWalls`: Staub/Brocken an Seitenwänden & Süd, nicht darüber hinaus).


### Runde 4: Effekte am Körper & Ellbogen
- **Ursache „Laser gehört nicht zum Körper“:** (1) Boss-Rig wird NACH den `bossFx`-Effekten gezeichnet → alles am Rig (Düse an der Linse) wurde vom Körper überdeckt → Düse wird jetzt in `drawLeviathanArena` (über dem Körper) gezeichnet, Linsen-Glühball beim Strahl klein; (2) Strahl/Welle waren Strichlinien bzw. winzige 128×32-Streifen. Neu: Sheet `art_source/rigs/leviathan_fx2.png` → `public/art/sprites/arena_leviathan_fx_{beam_head,beam_body,beam_impact,shockwave,cracks,crackline}.png` (Extraktion `scripts/leviathan-fx-extract.py`; **Falle:** Gemini schreibt trotz „no text“ Beschriftungen unter die Zellen → feste Zuschnitt-Rechtecke; Boden-Welle bekommt Vignette gegen eckige Plattenkante).
- **Boden-Risse:** Radial-Risse (`FxCracks`, auf den Boden beschnitten) unter dem Faust-Krater; Schockwellen-/Erdbeben-Linie (`fx 'whip'`) = Riss-Spur (`FxCrackLine` gekachelt) + rollende Staub-Welle (`FxShock`), kein Lila mehr.
- **Ellbogen:** Rig-Posen sprangen hart (Ruhe↔Hochriss↔Schlag) → Ellbogen klappte um. Neue Zwischenposen `armWind`/`armStrike` (Varianten 6/7, Ellbogen außen) und Folge in `anim/rigs/boss_leviathan.ts` (`WIND`/`STRIKE`, Zustandswechsel-Gedächtnis `armState/armSince/armWasUp`). Skript `scripts/leviathan-arm-mid.py` (Ausrichtung am Schulter-Socket (101,107), Skala 0,14 — `armStrike` reicht sonst über den 260er Rahmen).
- Offen: Boss-Skalierung (siehe oben), ggf. weitere Zwischenposen für Hochriss↔Beam; Kratzer-/Brocken-Sprites für Wand-Bröckeln (derzeit Partikel).


### Runde 5: Audit gegen D1–D15 / A1–A15 (Leviathan) — Checkliste mit Nachweis
| # | Stand | Nachweis / Nachlieferung |
| :--- | :---: | :--- |
| D1 Rig vollständig, Gelenke sitzen | ✅ | Arme an Schultern (Runde 1), Zwischenposen `armWind/armStrike`, Torso-Varianten auf Mitte 100; `node scripts/rig-sheet.cjs boss_leviathan` |
| D2 Eigene Posen je Angriff (3 Abschnitte) | ✅ **nachgeliefert** | Hammer/Welle/Doppelschlag/Strahl vorher; neu `debris`, `pulse`, `grab`, `steam`, `glow` (`anim/rigs/boss_leviathan.ts`, `st.moveSince`); Test `m12p9` |
| D3 Weiche Übergänge | ✅ | `tau 0,085`, Zwischenposen statt hartem Umklappen, weiche Schienenfahrt (`L.railV`) |
| D4 Anlauf & Nachfedern | ✅ | Anlauf-Pose vor Hammer/Welle/Glut, `WIND` beim Zurückfahren |
| D5 Fortbewegung | ✅ | Schienenfahrt mit Nachschwingen (`moveLag`), Atmen je Phase |
| D6 Treffer-Reaktion | ✅ | `st.hit` (≤ 0,14 s) |
| D7 Phase-2-Verwandlung | ✅ **nachgeliefert** | Brüll-Pose (Arme auf, Kopf zurück, Beben), Panzerplatten platzen ab + Glut (`startPhase2`), dann dauerhaft `torsoP2` |
| D8 Nur Optik | ✅ | keine Hitbox-/Schadensänderung in Posen/Renderer (Zug `quake` ist Gameplay, bewusst & getestet) |
| D9 Rückfall | ✅ | Vollposen-Sprite wenn Rig fehlt (`drawLeviathanBody`) |
| D10 Tests & Doku | ✅ | `tests/m12p9_leviathan_polish.cjs`, `m12p8`, `m12p4` |
| D11 Angriffsgrafik 3 Abschnitte | ✅ | Düse/Kachel-Strahl/Einschlag, Riss-Spur + Staubwelle, Radial-Risse, Dampf-Pfeile, Boden-Wellen mit Wandbröckeln; `pulse` bleibt Energie-Ring (Muzzle + Linien) |
| D12 Beschädigungsstufen (≥ 4 + kritisch) | ✅ **nachgeliefert** | Torso `P1 → <88 % → <76 % → P2 → <52 % → <40 % → P3` + kritisch < 15 % (Partikel/Flackern), Rauch/Funken-Rate steigt je Stufe; Arme je Arm-HP (`armDmg/armCrit`) |
| D13 Körper hängt zusammen | ✅ | Kontaktbogen Phase 1/2/3 |
| D14 Unterkörper reagiert | 🔶 bewusst | Schlitten bleibt **starr** auf der Schiene (Inhaber: kein Wackeln); Reaktion über Torso-Neigung/-Senkung je Zug + Schienenfahrt. Bei Wunsch: Schlitten-Mikro-Ruck pro Einschlag |
| D15 Biom-Boden-Effekte | n/a | Leviathan tritt nur in der eigenen Reaktorhalle (S1) auf, nicht in fremden Bioms (Pipeline §5) |
| A13 Wrack | ✅ **nachgeliefert** | zerstörter Arm bleibt als funkender Schulterstumpf (`armStump`, Variante 8) statt zu verschwinden |
| A9 Mobil | 🔶 | echtes Gerät offen |
| Abnahme im echten Spiel (Stufe 8) | ⬜ | Inhaber |
- **Ruhe-Pose (Inhaber-Beobachtung „Fäuste gegeneinander gedrückt“):** Fäuste lagen vor der Brust zusammen → Arme hängen jetzt gespreizt neben dem Körper (`IDLE_SPREAD 0,5 rad`, `dx ±6`), Linse bleibt frei.

## Nächster Schritt
1. **Abnahme Pilot A.E.G.I.S. Leviathan im echten Spiel** (Stufe 8 — live in Sektor 1 Ebene III oder `?bosslab` → ARENEN → 🏟 Leviathan): Kampfgefühl, alle 4 Körper-Phasen, Plattenbruch/Dampf/Trümmer, Schatzkammer & Mobil-Check (A9). Notfall-Rückweg: `ENDBOSS_ARENA_LIVE = false` in `balance.ts`.
2. Phase A/B-Marker entfernen, sobald der Projektinhaber die Standardräume abgenommen hat.
3. Nach Pilot-Abnahme: nächste Sektor-Endboss-Arena (**Prisma-Archon**, S2 Spiegel-Kathedrale) nach Checkliste **A1–A15** starten.
