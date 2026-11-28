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

## J. Spielstand-Slots & Neu anfangen (neu — Test `t10_save_slots`)
> **Gab es vorher nicht:** nur einen Spielstand; „Neues Spiel“ (Startscreen) und „Spielstand zurücksetzen“ (Einstellungen im Spiel) überschrieben ihn — **inklusive Cloud**. Jetzt: 3 Slots.
> Regeln: **Slot 1** = Hauptspielstand (bestehende Saves bleiben dort, wird mit der Cloud synchronisiert). **Slot 2/3** = rein lokal (pro Gerät/Browser), nie in der Cloud/Bestenliste. Wechsel nur am Startscreen, speichert beim Wechseln nichts.
| # | Prüfpunkt | Status |
| :-- | :-- | :-: |
| J1 | Startscreen zeigt 3 Slot-Karten (Kapitän, Tag, NG+, Sektoren; „Leer“ bei freien Slots); aktiver Slot hervorgehoben | ⬜ |
| J2 | Bestehender Spielstand liegt unverändert in Slot 1 (nach Update nichts verloren) | ⬜ |
| J3 | Slot 2 wählen → „Expedition starten“ → eigene Welt von vorn; Slot 1 danach unverändert | ⬜ |
| J4 | Zwischen den Slots wechseln, „Weiterspielen“ lädt jeweils den richtigen Stand (Credits/Tag/Inventar) | ⬜ |
| J5 | „Neues Spiel“ in einem Slot fragt nach; wirkt nur auf diesen Slot. Slot 1 + Konto: Warnung „Cloud wird überschrieben“ | ⬜ |
| J6 | „🗑 Slot leeren“ (nur Slot 2/3) mit Bestätigung; Slot 1 hat den Button bewusst nicht (sonst holt die Cloud ihn zurück) | ⬜ |
| J7 | Mit Konto: Slot 2/3 aktiv → „Cloud laden/sichern“ gesperrt + Hinweis; Slot 1 aktiv → wie bisher | ⬜ |
| J8 | Mit Konto: Slot 1 wählen holt/gleicht den Cloud-Stand ab (wie beim Login) | ⬜ |
| J9 | Im Spiel: Einstellungen → „Spielstand zurücksetzen“ wirkt nur auf den aktiven Slot | ⬜ |
| J10 | Komplett von vorn anfangen **mit Konto**: Slot 1 → „Neues Spiel“ (setzt auch Cloud zurück) | ⬜ |

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
