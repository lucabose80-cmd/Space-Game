# ABNAHME — Was der Projektinhaber im echten Spiel prüfen muss (Stand 2026-11-28)

> Pro Zeile testen, Ergebnis rückmelden (✅ ok / ❌ Fehler + Beobachtung). Wir tragen es hier und im jeweiligen Status-Blatt (`handoff/…`) ein. Alle Sprites der Queue sind geliefert (0 fehlende), Tests grün — offen ist nur die Sichtprüfung.
> Hilfsmittel: `?bosslab` (Bosse/Gegner/Arenen einzeln), `?cutscenelab` (alle Cutscenes ohne Spielstand-Änderung), `?arena`.

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
| B9 | **Mobil-Test** (Touch, A9) auf echtem Gerät | Handy | ⬜ |
| B10 | Wochen-Prüfung ab 2026-W49 mit Arena | Wochen-Prüfung | ⬜ |

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

## G. Noch NICHT zur Abnahme (erst bauen)
- **Startscreen & Account-Einstieg** (`handoff/title_screen.md` T2–T5): Key-Art `title_bg.png` ist jetzt da (P3-55 ✅), Code (Backdrop, Konto-Panel, Weiterspielen-Animation) fehlt noch — Claim Antigravity.
- **NG+-Aura, ∞ Spirale, Echo-Pilot** (Sprites da, Code wartet auf Startsignal; Echo-Serie nach Pilot-Abnahme).
- **P4 weitere Boss-Rigs** (STOP-GATE bis A1–A7 abgenommen) · **nächste Arena Prisma-Archon** (bis B abgenommen).

## Wie es weitergeht
- A + B ✅ → Gates öffnen: Boss-Rigs P4 + Arena Prisma-Archon starten.
- C ✅ → Stufe 8 je Gegner abhaken (G1–G10 final).
- ❌-Punkte → Rückmeldung mit Beobachtung; wir tragen sie in das jeweilige `handoff/`-Blatt ein und beheben sie.
