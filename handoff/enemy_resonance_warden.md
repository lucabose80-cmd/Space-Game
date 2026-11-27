# Handoff — Gegner „Resonanz-Wächter“ (`resonance_warden`)
> Eigenes Status-Blatt. Code: `src/dungeon/anim/rigs/resonance_warden.ts`, Daten: `src/data/rigs/resonance_warden.json`, Renderer-Zweig `resonance_warden` (+ `enemyRigDeaths` in `dungeonRenderer.ts`), Test `tests/m11p15_resonance_warden.cjs`.

- **Eingebunden:** Goldener Kernkörper (`torso`), Auge normal/geladen (`eye` / `eyeGlow` als Varianten), 2 Orbit-Kristalle (`crysL`, `crysS`), Schildplatte (`shield`) aus `resonance_warden_rig.png` (`P2-09`, `npm run art:import -- resonance_warden --force`).
- **Animation:** Majestätisches Schweben + kreisende Orbit-Kristalle, Schildplatte schützt seitlich (klappt bei Angriff / `shieldDownTimer > 0` weg) → Vorwarnung (`telegraphTimer` 0,52 s: Auge wechselt auf geladene Linse `eyeGlow`, Kristalle ziehen sich vibrierend zusammen) → 6-Wege-Schockpuls (0,22 s: Kristalle schnellen nach außen, Körper streckt sich) → Erholung (0,28 s) → Treffer-Zucken (≤ 0,14 s) → Tod (Trümmer + Gold-Blitz, 0,85 s).
- **Rein optisch:** keine Änderung an `enemyAi.ts`/`DungeonScene.ts`, kein Zufall. Fallback: `enemy_resonance_warden.png`.

## Prüfung G1–G10
| # | Status | Nachweis |
| :--- | :--- | :--- |
| G1 | ✅ | alle 6 Sheet-Teile eingebunden — `tests/out/resonance_warden_idle.png`, Test `loaded` |
| G2 | ✅ | Fallback-Sprite bei `art.rigs.resonance_warden = null` (`withRig !== without`) |
| G3 | ✅ | Schweben + kreisende Orbit-Kristalle (`orbitCount > 8`) |
| G4 | ✅ | Vorwarnung (`eyeGlow`, Schild öffnet) / Puls / Erholung — `tests/out/resonance_warden_tele.png` |
| G5 | ✅ | Weiche Blends + `tau 0.045` |
| G6 | ✅ | Treffer-Zucken ≤ 0,14 s, klingt ab |
| G7 | ✅ | Tod-Trümmer + Gold-Blitz (`debris !== after`) |
| G8 | ✅ | rein optisch, kein `Math.random` |
| G9 | ✅ | Test `m11p15_resonance_warden`, dieses Blatt, `npm run verify` |
| G10 | ✅ | n/a — schwebender Monolith ohne Boden-Effekte |

- **Offen:** Abnahme im echten Kampf (Stufe 8).
