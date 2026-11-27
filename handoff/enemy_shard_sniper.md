# Handoff — Gegner „Splitter-Scharfschütze“ (`shard_sniper`)
> Eigenes Status-Blatt. Code: `src/dungeon/anim/rigs/shard_sniper.ts`, Daten: `src/data/rigs/shard_sniper.json`, Renderer-Zweig `shard_sniper` (+ `sniperSeen`/`sniperDeaths` in `dungeonRenderer.ts`), Test `tests/m11p12_shard_sniper.cjs`.

- **Eingebunden:** Rumpf+Kopf, Jetpack, Kristall-Lanzengewehr, Vorderarm (`armR`), Hinterarm (`armL`), Beinpaar aus `shard_sniper_rig.png` (`P2-06`, `npm run art:import -- shard_sniper --force`, `torsoDisplayH 15`).
- **Animation:** Jetpack-Schweben (weiches Auf/Ab, Flugneigung aus `vx`, pendelnde Beine, pulsierende Düsen) → Vorwarnung (`telegraphTimer` 0,65 s: Arme & Lanzengewehr richten sich entlang `aimAngle` aus, ab < 0,26 s Ziel-Lock mit feinem Lade-Zittern) → Schuss-Rückstoß (fallende Flanke, 0,24 s: Gewehr & Rumpf schlagen zurück, Jetpack zündet gegen) → Erholung (0,30 s weiches Absenken) → Treffer-Zucken (Flanke `flashTimer`, ≤ 0,14 s, beim Zielen gedämpft) → Tod (Jetpack, Gewehr, Rumpf, Beine & Arm fliegen als Trümmer ab + rosa Aufblitzen, 0,85 s).
- **Rein optisch:** keine Änderung an `enemyAi.ts`/`DungeonScene.ts`, Hitbox, Schaden oder Zustandsdauern; kein Zufall.
- Fallback: altes `enemy_shard_sniper.png` (Test schaltet Rig ab und rendert).

## Prüfung G1–G10
| # | Status | Nachweis |
| :--- | :--- | :--- |
| G1 | ✅ | alle 6 Sheet-Teile eingebunden, Gelenke sitzen — `tests/out/shard_sniper_idle.png`, Test `loaded` |
| G2 | ✅ | Rig-Schalter: Test setzt `art.rigs.shard_sniper = null` → Fallback-Sprite läuft ohne Fehler (`withRig !== without`) |
| G3 | ✅ | Jetpack-Schweben + Flugneigung + Beinpendel; Test `hoverCount > 4` |
| G4 | ✅ | Vorwarnung (Zielen entlang `aimAngle`) / Schuss-Rückstoß / Erholung je eigene Pose — `tests/out/shard_sniper_aim.png`, Test je Abschnitt |
| G5 | ✅ | Weiche Blends (`wind/recoil/recover`) + Glättung `tau 0.045` |
| G6 | ✅ | Treffer-Zucken ≤ 0,14 s, beim Zielen auf 35 % gedämpft; Test `hitRot` / `afterHitRot` |
| G7 | ✅ | Tod: Jetpack/Gewehr/Rumpf/Beine/Arm fliegen ab + rosa Aufblitzen — `tests/out/shard_sniper_death.png`, Test `debris !== after` |
| G8 | ✅ | nur `anim/rigs/shard_sniper.ts`, Rig-JSON, Renderer-Zweig; kein `Math.random` |
| G9 | ✅ | Test `m11p12_shard_sniper`, dieses Blatt, `npm run verify` |
| G10 | ✅ | n/a — schwebender Jetpack-Gegner ohne Boden-Effekte |

- **Offen:** Abnahme im echten Kampf (Stufe 8).
