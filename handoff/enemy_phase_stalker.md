# Handoff — Gegner „Phasen-Jäger“ (`phase_stalker`)
> Eigenes Status-Blatt. Code: `src/dungeon/anim/rigs/phase_stalker.ts`, Daten: `src/data/rigs/phase_stalker.json`, Renderer-Zweig `phase_stalker` in `dungeonRenderer.ts` (nutzt `tryDrawEnemyRig`), Test `tests/m11p8_phase_stalker.cjs`.

- **Eingebunden:** Rumpf/Kopf/2 Klingenarme/2 Beine aus `phase_stalker_rig.png` (`npm run art:import -- phase_stalker --force`, Maßstab `torsoDisplayH 15`).
- **Animation:** Pirschen = Beine schreiten (Phase aus Strecke), Arme schwingen gegenläufig; Phasen-Vorwarnung (`telegraphTimer`) = duckt sich, Klingen nach hinten, Körper flackert; Sturz (`chargeActive`) = vorgebeugt, Klingen schlagen nach vorn, Rückfeder-Nachschwung. Blick zum Spieler (Rig gespiegelt).
- Fallback: altes `enemy_phase_stalker.png`. Abnahme im echten Kampf offen.
- **Optional später (Typ L):** Arm-Pose-Set `phase_stalker_arms_R.png` (hängend · ausholen · Schlag · …) — nur nach Abnahme; dann in `SPRITE_QUEUE.md` einreihen.
