# ABNAHME — Was der Projektinhaber im echten Spiel prüfen muss (Stand 2026-11-28)

> **PC first, Handy second:** jede Zeile zuerst am PC prüfen; wo ein Handy-Punkt steht (J11–J13, B9) zusätzlich am Handy quer/hoch. Pro Zeile testen, Ergebnis rückmelden (✅ ok / ❌ Fehler + Beobachtung). Wir tragen es hier und im jeweiligen Status-Blatt (`handoff/…`) ein. Alle Sprites der Queue sind geliefert (0 fehlende), Tests grün — offen ist nur die Sichtprüfung.
> Hilfsmittel: `?bosslab` (Bosse/Gegner/Arenen einzeln; **je gewähltem Boss/Gegner Abschnitt „ANGRIFFE“ = jeder Angriff einzeln auslösbar + „STATI“ = HP-Stufen 100/80/65/50 (Phase II)/35/25/14 % kritisch, 💥 Treffer, ☠ Tod, ↺ Neu**; Leviathan wie gehabt über 🏟 Arena), `?cutscenelab` (alle Cutscenes ohne Spielstand-Änderung), `?arena`.

| Status | Legende |
| :-: | :-- |
| ⬜ | noch nicht geprüft |
| ✅ / ❌ | Ergebnis eintragen |

## A. Bosse (höchste Priorität — blockiert P4-Boss-Rigs)
| # | Prüfpunkt | Wie testen | Status |
| :-- | :-- | :-- | :-: |
| A1 | **Kern-Wächter** Phase 1: Posen, Übergänge, Laser-Brust, Orbit-Salve, Treffer-Reaktion, Schadensstufen (Helm/Rumpf/Arme) | echter Kampf Sektor 1 oder `?bosslab` | ⬜ |
| A2 | Kern-Wächter Phase 2: Platten fliegen weg, Faust-Salve, Kern überhitzt, Krater/Tod-Rückstand | dito, unter 50 % HP | ⬜ |
| A3 | Kern-Wächter in fremdem Biom (Riss-Kammer / ∞ Spirale): Boden-Effekte passen zum Raum | Riss-Kammer | ⬜ |
| A4 | Bewegung wirkt nicht mehr „zappelnde Puppe“ (Feedback vom Inhaber) — konkrete Stellen nennen | beim Kampf | ⬜ |
| A5 | **Krall** Phase 1 (Zange/Haken/Säge, Block, Stampfer, Duck/Aufrichten) | echter Kampf | ⬜ |
| A6 | Krall Phase 2 (Skelettrahmen, Kern) + Schaden < 25 % (geduckt) | echter Kampf | ⬜ |
| A7 | Krall in fremdem Biom | Riss-Kammer / Spirale | ⬜ |

## B. Endboss-Arena A.E.G.I.S. Leviathan (M12-Pilot — blockiert nächste Arenen S2–S4)
| # | Prüfpunkt | Wie testen | Status |
| :-- | :-- | :-- | :-: |
| B1 | Auftritt: Kamera-Fahrt, Banner, Eingabe kurz gesperrt, kein Schaden | Sektor 1 Ebene III | ⬜ |
| B2 | Phase I: Kran-Hammer (Arm steckt → angreifbar), Kabel, Strahl, Doppelschlag; Panzer „GEPANZERT“ vs. Schwachstellen | Kampf | ⬜ |
| B3 | Phase II/III: Verwandlung (Brüll-Pose, Brocken, Platten platzen), Arena ändert sich | Kampf | ⬜ |
| B4 | Plattenbruch (3 Stufen), Dampf, Deckentrümmer, Boden-Wellen | Kampf | ⬜ |
| B5 | Treffer-Reaktion (Panzer/Schwachstelle), Arm abreißen → Wrack fällt & liegt | Kampf | ⬜ |
| B6 | Schadensstufen Torso + kritisch < 15 % | Kampf / `?bosslab` PHASEN & SCHÄDEN | ⬜ |
| B7 | Belohnung: Trophäen-Relikt „Herzlinse“, Waffen-Arten-Freischaltung, Hub-Vitrine; **nie Credits** | nach Sieg + Hub | ⬜ |
| B8 | Kampfgefühl/Schwierigkeit (Balance), Boss wirkt im Raum groß genug? | Kampf | ⬜ |
| B9 | **Mobil-Test** (Touch, A9) auf echtem Gerät — **einziger A1–A15-Punkt, der nicht erledigt ist** | Handy | ⬜ |
| B10 | Wochen-Prüfung mit Arena — **erst ab Mo 30.11.2026 (W49) testbar**, vorher läuft die Prüfung ohne Arena | Wochen-Prüfung | ⬜ |

## C. Normale Gegner (je 1–2 echte Kämpfe; Rigs, Angriff in 3 Abschnitten, Treffer, Tod)
| # | Gegner | Sektor | Status |
| :-- | :-- | :-: | :-: |
| C1 | Geschütz (Ketten neu) | 1 | ⬜ |
| C2 | Drohne | 1 | ⬜ |
| C3 | Bogen-Drohne (+ Wrack) | 1 | ⬜ |
| C4 | Phasen-Jäger (Schlagbögen Größe?) | 1 | ⬜ |
| C5 | Sporenspucker (inkl. Todes-Animation) | 1/2 | ⬜ |
| C6 | Schild-Drohne | 2 | ⬜ |
| C7 | Kristall-Krabbler (+ Boden-Effekt) | 2 | ⬜ |
| C8 | Splitter-Scharfschütze | 2 | ⬜ |
| C9 | Prisma-Drohne | 2 | ⬜ |
| C10 | Leere-Krabbler | 2/3 | ⬜ |
| C11 | Resonanz-Wächter | 2 | ⬜ |
| C12 | Sektor 3: Magma-Mörser, Schlacke-Käfer, Glut-Jäger, Schmiede-Golem, Solar-Drohne (je einzeln) | 3 | ⬜ |
| C13 | Sektor 4: Chrono-Auge, Astral-Skarabäus, Stern-Lanzer, Leere-Geist, Monolith-Wächter (je einzeln) | 4 | ⬜ |

## D. Welt-Überarbeitung (Port Solaris, Laden, Quartier)
| # | Prüfpunkt | Status |
| :-- | :-- | :-: |
| D1 | Hangar-Start/Landung mit neuer Tür unten | ⬜ |
| D2 | Quartier: Aufwachen nach K.O. in allen 3 Stufen (Notkoje/Kajüte/Suite) | ⬜ |
| D3 | Truhen-Öffnen-Animation im Dungeon | ⬜ |
| D4 | Upgrade-Zoom Med-Bay / Tech-Labor (Umbau alt→neu) | ⬜ |
| D5 | Laden Stufe 1/2/3 komplett (Vitrinen, Upgrade-Tisch, Holztür) | ⬜ |
| D6 | Hub wächst: Tech-Labor/Schwarzmarkt/Terrasse öffnen durch Ereignisse | ⬜ |
| D7 | Marktterrasse (Hintergrund, Theken) | ⬜ |
| D8 | Keine Portale auf der Station, Kollisionen/Türen ok | ⬜ |

## E. Cutscenes (`?cutscenelab` für alle)
| # | Prüfpunkt | Status |
| :-- | :-- | :-: |
| E1 | Spielstart-Intro (Neues Spiel), Panels 1–4, überspringbar, Kurz-Modus | ⬜ |
| E2 | Siegesfeier S1–S4 + Omega-Fest (Lichterketten, NPCs, Konfetti) | ⬜ |
| E3 | Mina-Einzug (nach Sektor 1 / Kael Kap. 1), Pip (K2), Ping (K3), Mitternacht (K4) | ⬜ |
| E4 | Upgrade-Cutscenes (Waffe, Laden-Ausbau, Schiff, Funken-Mini) | ⬜ |
| E5 | Port-Solaris-Außenansicht je Kapitel, Kino-Chronik im Logbuch | ⬜ |

## F. Beobachten (laufend)
| # | Prüfpunkt | Status |
| :-- | :-- | :-: |
| F1 | Ökonomie/Preise fühlen sich fair an (`tests/out/economy.json`) | ⬜ |
| F2 | Boss-Kampfdauer passt (`tests/out/ttk.json`) | ⬜ |

## G. Startscreen & Account (neu, live seit heute — `handoff/title_screen.md` T1–T5 ✅, Test `t9_title_screen`)
| # | Prüfpunkt | Status |
| :-- | :-- | :-: |
| G1 | Startscreen mit neuem Key-Art `title_bg.png` (Schiff, Sterne, Stationslichter) — wirkt gut, Logo lesbar? | ⬜ |
| G2 | Konto: Google-Login, E-Mail-Login, Neues Konto (Kapitänsname), Abmelden, Cloud-Sync-Status — **nur mit echtem Firebase-Login testbar** | ⬜ |
| G3 | Neueren Cloud-Stand laden → Startscreen zeigt „Weiterspielen · Tag X · ☁ Cloud“ | ⬜ |
| G4 | „Neues Spiel“ mit bestehendem Save → Sicherheitsabfrage | ⬜ |
| G5 | Neues Spiel → weicher Übergang direkt in `intro_arrival` (kein Laden-Flackern) | ⬜ |
| G6 | Weiterspielen → ~3-s-Anflug (Tag/Nacht, Kapitän, Tag-Banner), per Klick/Taste überspringbar, Kurz-Modus | ⬜ |

## J. Spielstand-Slots als Sternbild + Cloud für alle Slots (Test `t10_save_slots`)
> Vorher: ein Spielstand. Jetzt: **3 Slots als anklickbare Planeten im Startscreen-Hintergrund** (Gold = Slot 1, Türkis = Slot 2, Violett = Slot 3; leer = blasser Stern „Unentdeckt“). **Alle 3 Slots liegen in der Cloud** (`saves/{uid}`: Slot 1 = `saveJson` wie bisher, Slot 2/3 = `slot2Json`/`slot3Json` im selben Dokument — **keine Firestore-Regeländerung nötig**). Bestenliste & Wochen-Prüfung zählen nur Slot 1. Wechsel nur am Startscreen, speichert dabei nichts (ausstehender Upload des alten Slots wird vorher abgeschickt).
| # | Prüfpunkt | Status |
| :-- | :-- | :-: |
| J1 | 3 Pixel-Art-Planeten (Gold mit Ring · Türkis-Kristall · Violett-Gasriese; leer = Stern in Orbit-Kreis) im Hintergrund (rechts unten) mit Beschriftung (Kapitän, Tag, NG+, Sektoren); aktiver Slot mit Ring; leerer Slot als Stern; Hover vergrößert | ⬜ |
| J1b | Linkes Menü (Stufe 2): die 3 Menüpunkte tragen schwebende Station-Objekte — türkise Andock-Bake (Weiterspielen), goldenes Sternentor (Neues Spiel), Entsorgungskapsel mit rotem Licht (Slot leeren). Ohne Kasten: Logo schwebt über der Grafik, Menüpunkte und Spielstand-Karte sind Pixel-Art-Platten (Messing/Kupfer, Weiterspielen mit türkisem Leuchten, Karte mit Cyan-Eckwinkeln), LED-Kopfzeile, Hinweis zu den Planeten — passt zur Station? Lesbar auf Handy? | ⬜ |
| J2 | Bestehender Spielstand liegt unverändert in Slot 1 (nach Update nichts verloren) | ⬜ |
| J3 | Leeren Slot anklicken → „Expedition starten“ → eigene Welt; andere Slots danach unverändert | ⬜ |
| J4 | Wechsel zwischen Slots, „Weiterspielen“ lädt jeweils den richtigen Stand (Credits/Tag/Inventar) | ⬜ |
| J5 | „Neues Spiel“ fragt nach, wirkt nur auf den aktiven Slot; mit Konto Warnung „Cloud-Stand von Slot N wird überschrieben“ | ⬜ |
| J6 | „🗑 Slot leeren“ nur bei Slot 2/3 (Bestätigung); mit Konto wird auch die Cloud-Kopie gelöscht. Slot 1 hat den Knopf bewusst nicht → dort „Neues Spiel“ | ⬜ |
| J7 | **Cloud:** Mit Konto in Slot 2 spielen → auf anderem Gerät/Browser anmelden → Slot 2 erscheint als Planet (still aus der Cloud aufgefüllt, wenn lokal leer) | ⬜ |
| J8 | **Cloud:** Planet wählen holt/gleicht den Cloud-Stand dieses Slots ab; „Cloud-Stand laden“/„Jetzt sichern“ wirken auf den aktiven Slot | ⬜ |
| J9 | Im Spiel: Einstellungen → „Spielstand zurücksetzen“ wirkt nur auf den aktiven Slot | ⬜ |
| J10 | Komplett von vorn **mit Konto**: pro Slot „Neues Spiel“ (setzt dessen Cloud-Kopie zurück) | ⬜ |
| J11 | Handy **hochkant**: Planeten als Reihe unter dem Menü, nichts überlappt | ⬜ |
| J12 | Handy **quer** (z. B. 915×412): kompaktes Menü (nur Logo, Karte, Buttons), alles ohne Scrollen sichtbar, Planeten innerhalb der Bildfläche, Slots anklickbar | ⬜ |
| J13 | PC (≥ 1280×720) sieht aus wie zuvor (Terminal-Kopf, Tagline, Hinweiszeile) | ⬜ |
> Grenzen (bewusst): Konflikte zwischen zwei Geräten löst derselbe Fortschritts-Vergleich wie bisher (weiter fortgeschritten gewinnt). Slot leeren auf Gerät A, während Gerät B noch eine lokale Kopie hat → B kann ihn beim Auswählen wieder hochladen (kein Lösch-Marker). Planeten sind echte Pixel-Art-Sprites (`title_planet_1/2/3/empty.png`, P3-56…59); Fallback bei fehlendem Bild = CSS-Kugel.

## K. Boss-Labor: Angriffe & Stati einzeln durchtesten (neu — Test `t11_lab_attacks`)
> `…/?bosslab` → Tab **Bosse** bzw. **Gegner** → Boss/Gegner wählen → ganz oben **„<NAME> · ANGRIFFE“** (jeder Zug einzeln, `⏭ Nächster` = der Reihe nach) und **„<NAME> · STATI“**. Pro Zeile prüfen: Vorwarnung (≥ 0,4 s sichtbar), Angriffsgrafik, Pose, Erholung; bei Stati: Beschädigungsstufen, Phase-II-Verwandlung, kritisch < 15 %, Treffer-Reaktion, Tod-Animation. Zusätzlich mit Biom-Knöpfen S1–S4/Ω (Boden-Effekte in fremden Sektoren). Ergebnis je Zeile ✅/❌ + Beobachtung.
| Boss (Angriffe im Labor) | Angriffe | Stati (Stufen · P2 · kritisch · Tod) | Status |
| :-- | :-- | :-: | :-: |
| Krall | Magnet-Zug · Schrott-Wurf · Greifarm-Stoß · … | ⬜ | ⬜ |
| Kern-Wächter | Orbit-Salve · Sturm/Anlauf · Sprung-Angriff · Reaktor-Laser | ⬜ | ⬜ |
| Leviathan | in 🏟 Arena (Hammer, Welle, Doppelschlag, Dampf, Strahl, Trümmer, Griff …) | ⬜ | ⬜ |
| Quarz-Koloss (+ Teilen bei Phase II) | Kristall-Beben · Quarz-Salve | ⬜ | ⬜ |
| Prisma-Weberin | Phasen-Sprung · Laser-Gitter | ⬜ | ⬜ |
| Prisma-Archon | Zwillings-Strahl · Kristall-Lanzen · Prisma-Nova | ⬜ | ⬜ |
| Schlacken-Koloss | je Zug einzeln | ⬜ | ⬜ |
| Gießerei-Meisterin | je Zug einzeln | ⬜ | ⬜ |
| Vulkan-Titan | je Zug einzeln | ⬜ | ⬜ |
| Chrono-Wächter | je Zug einzeln | ⬜ | ⬜ |
| Monolith-Koloss | je Zug einzeln | ⬜ | ⬜ |
| Sternen-Archon (+ Teilen) | je Zug einzeln | ⬜ | ⬜ |
| Omega-Archon | Zwillings-Strahl · Kristall-Lanzen · Prisma-Nova | ⬜ | ⬜ |
| Alle 21 normalen Gegner (Tab Gegner) | „⚔ Angriff jetzt“ (löst den nächsten Angriff sofort aus) + Stufen 100/66/33/10 %, 💥 Treffer, ☠ Tod | ⬜ | ⬜ |
> Hinweis: Gegner-Angriff „jetzt“ setzt nur den KI-Timer auf 0 — der Gegner greift an, sobald er in Reichweite ist (steht nahe der Spielfigur). Beschädigungsstufen gibt es nur bei Bossen (Regel 11), Gegner haben Treffer-Zucken + Tod.

## H. Noch NICHT zur Abnahme (erst bauen / gesperrt)
- **NG+-Aura, ∞ Spirale, Echo-Pilot:** Sprites da, Code wartet auf Startsignal; Echo-Serie nach Pilot-Abnahme.
- **P4 weitere Boss-Rigs** (STOP-GATE bis A1–A7 ✅) · **nächste Arena Prisma-Archon** (bis B ✅).

## I. Bekannte offene Kleinpunkte (blockieren die Abnahme NICHT — nur dein Urteil nötig, ob sie stören)
| # | Punkt | Quelle |
| :-- | :-- | :-- |
| I1 | Leviathan wirkt im Raum evtl. klein (~110 px) → ggf. größeres Rig bestellen | endboss_arena.md Z.106 |
| I2 | Leviathan-Schlitten bleibt starr (Inhaber-Entscheidung „kein Wackeln“) — bei Wunsch Mikro-Ruck | endboss_arena D14 |
| I3 | Leviathan `armDead`: kleine weiße Rauch-Pixel am Rand (kosmetisch) | endboss_arena.md Z.96 |
| I4 | Krall: Arme sehr dünn; Posen-Timings (Stoß 0,55 s, Magnet-Sog 1,1 s) nicht am Spielgefühl abgestimmt | BOSS_ANIMATION_PLAN Z.139 |
| I5 | Kern-Wächter: falls noch „zappelig“ → Glättung träger (`KRALL_TAU`-Muster) | BOSS_ANIMATION_PLAN Z.141 |
| I6 | Phasen-Jäger: Schlagbogen-Größe (`slashL/slashS` sx/sy) | enemy_phase_stalker Z.21 |
| I7 | Bogen-Drohne: 3 Extra-Zellen (Überlast-Spule/Stummel/Trümmer) liegen ungenutzt bereit | enemy_drone_arc Z.21 |
| I8 | Geschütz & Schild-Drohne: Schadensstufen optional (nur Bosse müssen sie haben) | enemy_turret / enemy_shield_drone |
| I9 | Welt: Kristall-Spire/Dungeon-Drops mit festem Schatten; Quartier ohne eigene Cutscene | world_overhaul Z.25 |
| I10 | Ohne eigenen Automatik-Test: Upgrade-Zoom/Raum-Wisch, Hangar-Ausgang unten, Truhen-Animation → nur Sichtprüfung deckt das ab | world_overhaul Z.27 |

## Doku-Unstimmigkeiten (Stand 2026-11-28 geprüft — Spiel ist fertig, nur Text veraltet)
- `BOSS_ANIMATION_PLAN.md` Z.138–143 „Krall noch offen: legs/effects einbinden“ → ist erledigt (`krall.json`/`krall.ts` nutzen `legs_R/L`, `R2/L2`; `krall.md` D1–D15 ✅).
- `BOSS_ANIMATION_PLAN.md` Z.106/109 „S6 liegt bereit“ vs. Statustabelle „S6 eingebunden ✅“ → eingebunden.
- `core_warden.md` Z.41 „Phase-1-Armschäden offen“ vs. D12 ✅ (Arme 19–24) → erledigt.
- `endboss_arena.md` Z.82 „P1-03…07 Status `[~]`“ → alle `[x]`.
- `handoff/enemy_shield_drone.md`: Testname noch Platzhalter `m11p…_shield_drone`.
- `handoff/README.md`: Claim-Zeilen Cutscenes/Welt/Startscreen/Endboss stehen auf „frei“, Inhalt stimmt.

## Was für eine Abnahme technisch nötig ist
- Spiel auf Vercel (`main`) deployed; Hard-Reload. Spielstand: Sektor 1 Ebene III erreichbar (Leviathan), für Kern-Wächter/Krall ggf. `?bosslab`.
- Für Cutscenes: `?cutscenelab` (kein Spielstand-Risiko). Für Konto-Tests (G2/G3): echter Login, Cloud-Save kann überschrieben werden → Testkonto empfohlen.
- Mobil-Test B9: Touch-Gerät, Hochformat/Querformat, Zielhilfe.

## Wie es weitergeht
- A + B ✅ → Gates öffnen: Boss-Rigs P4 + Arena Prisma-Archon starten.
- C ✅ → Stufe 8 je Gegner abhaken (G1–G10 final).
- ❌-Punkte → Rückmeldung mit Beobachtung; wir tragen sie in das jeweilige `handoff/`-Blatt ein und beheben sie.
