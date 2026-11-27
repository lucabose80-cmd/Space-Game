# Handoff — Gegner Sektor 4 (`chrono_eye`, `astral_scarab`, `star_lancer`, `void_wraith`, `monolith_guard`)
> Gemeinsames Status-Blatt für alle 5 Sektor-4-Gegner-Rigs (`P2-15`–`P2-19`). Code: `src/dungeon/anim/rigs/{chrono_eye,astral_scarab,star_lancer,void_wraith,monolith_guard}.ts`, Daten: `src/data/rigs/*.json`, Renderer: `m6Def` + `enemyRigDeaths` in `src/dungeon/dungeonRenderer.ts`, Test: `tests/m11p17_sector4_rigs.cjs`.

- **Chrono-Auge (`chrono_eye`, `P2-15`):** Schwebender Cyan-Augapfel (normal / weit aufgerissen `eyeWide`), 2 gegenläufig rotierende goldene Astrolabium-Ringe (`holes: true`), rotierender Uhrzeiger (`hand`), Vorwarnungs-Aufladung, Schuss-Rückstoß, Erholung, Treffer-Zucken, Tod-Trümmer.
- **Astral-Skarabäus (`astral_scarab`, `P2-16`):** Körper + Kopf, 4 goldene Beine im Krabbel-Takt, kristalline Cyan-Flügel (`wingFold`/`wingOpen`) beim Zielen & Dash, biom-passende Dash-Staubspur (`G10`), Erholung, Treffer-Zucken, Tod-Trümmer.
- **Sternen-Lanzer (`star_lancer`, `P2-17`):** Goldener Rumpf, Helm, Beinpaar, 2 Arme, Sternenspeer; Schritt-Rhythmus, Speer-Ausholen bei Vorwarnung, Ausfallstoß, Erholung, Treffer-Zucken, Tod-Trümmer.
- **Leere-Gespenst (`void_wraith`, `P2-18`):** Kapuzen-Oberkörper, flatternder Roben-Saum, glühende Augen (`eyes`), 2 Klauen-Arme mit Spektralsichel; Schwebe-Bewegung, tiefes Zusammenziehen vor Blink, Doppelschlag nach Blink, Erholung, Treffer-Zucken, Tod-Trümmer.
- **Monolith-Wächter (`monolith_guard`, `P2-19`):** Schwerer Tempel-Wächter (Rumpf, Helm, 2 Beine, Runen-Turmschild, Streitkolben-Arm); wuchtiger Gang, Schild-Stoß & Kolben-Ausholen bei Vorwarnung, 8-Wege-Schockstoß + Erholung, rotierender Schildbogen bleibt erhalten, Treffer-Zucken, Tod-Trümmer.

## Prüfung G1–G10 (alle 5 Gegner)
| # | Status | Nachweis |
| :--- | :--- | :--- |
| G1 | ✅ | alle 5 Rigs mit je 6 Sheet-Teilen importiert (`chrono_eye` Ringe & Zeiger mit `holes: true`), Screenshots `tests/out/s4_*_idle.png` visuell geprüft |
| G2 | ✅ | Fallback-Sprite bei `art.rigs[kind] = null` für alle 5 (`withRig !== without`) |
| G3 | ✅ | eigener Lauf-/Schwebe-Rhythmus je Gegner (`moveCount > 3`) |
| G4 | ✅ | Vorwarnung / Angriff / Erholung je eigene Pose (`idleHash !== teleHash`, Screenshots `s4_*_tele.png`) |
| G5 | ✅ | weiche Blends + Engine-Glättung (`tau 0.04–0.05`) |
| G6 | ✅ | Treffer-Zucken ≤ 0,14 s, klingt ab (`hitRot` → `afterHitRot`) |
| G7 | ✅ | Tod-Trümmer + sektortypisches Aufblitzen für alle 5 (`debris !== after`) |
| G8 | ✅ | rein optisch (keine Änderung an `enemyAi.ts`/`DungeonScene.ts`), kein `Math.random` |
| G9 | ✅ | Test `m11p17_sector4_rigs`, dieses Blatt, `npm run verify` |
| G10 | ✅ | `astral_scarab` nutzt biom-passende Dash-Staubspur (`fxDustS1…S5`); übrige 4 ohne Boden-Effekte |

- **Offen:** Abnahme im echten Kampf (Stufe 8).
