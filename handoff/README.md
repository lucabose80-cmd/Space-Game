# handoff/ — Status je Arbeitsbereich (paralleles Arbeiten)

Jeder Chat/Agent pflegt **nur die Datei seines Bereichs**. `HANDOFF.md` bleibt der Einstieg (Index, Ablauf, Gesamtstand) und wird nur für Bereichsübergreifendes geändert. So gibt es keine Merge-Konflikte.

| Bereich | Status-Blatt | Code (nur dieser Bereich ändert ihn) | Daten | Test |
| :--- | :--- | :--- | :--- | :--- |
| Krall | [`krall.md`](krall.md) | `anim/rigs/krall.ts`, `bosses/` (Krall-Zonen) | `data/rigs/krall.json` | `m11p5_krall` |
| Kern-Wächter | [`core_warden.md`](core_warden.md) | `anim/rigs/core_warden.ts` | `data/rigs/core_warden.json` | `m11p6_core_warden` |
| Geschütz | [`enemy_turret.md`](enemy_turret.md) | `anim/rigs/turret.ts` | `data/rigs/turret.json` | `m11p7_turret` |
| Drohne | [`enemy_drone.md`](enemy_drone.md) | `anim/rigs/drone.ts` | `data/rigs/drone.json` | `m11p8_drone` |
| Bogen-Drohne | [`enemy_drone_arc.md`](enemy_drone_arc.md) | `anim/rigs/drone_arc.ts` (+ Wrack-Block `renderDroneArcWrecks` in `dungeonRenderer.ts`) | `data/rigs/drone_arc.json` | `m11p10_drone_arc` |
| Phasen-Jäger | [`enemy_phase_stalker.md`](enemy_phase_stalker.md) | `anim/rigs/phase_stalker.ts` | `data/rigs/phase_stalker.json` | `m11p9_phase_stalker` |
| Sporenspucker | [`enemy_spore_spitter.md`](enemy_spore_spitter.md) | `anim/rigs/spore_spitter.ts` (+ Renderer-Zweig `spore_spitter`, Todes-Animation) | `data/rigs/spore_spitter.json` | `m11p9_spore_spitter` |
| Schild-Drohne | [`enemy_shield_drone.md`](enemy_shield_drone.md) | `anim/rigs/shield_drone.ts` | `data/rigs/shield_drone.json` | `m11p…_shield_drone` |
| Endboss-Arenen (M12) | [`endboss_arena.md`](endboss_arena.md) | `src/dungeon/camera.ts`, `src/data/arenas/`, `bosses/leviathanArena.ts` (+ Phase A/B in gemeinsamen Dateien, siehe Blatt) | `data/arenas/<kind>.ts` | `m12p1…m12p5` |
| Sheet-Lieferstatus aller Gegner | [`enemy_sheets.md`](enemy_sheets.md) (Antigravity) | — | — | — |
| weitere Gegner/Bosse | neue Datei `enemy_<kind>.md` / `<boss>.md` anlegen | `anim/rigs/<rig-id>.ts` | `data/rigs/<rig-id>.json` | eigene `m11p…_<rig>.cjs` |

Gemeinsame (heikle) Dateien — nur mit Absprache/kleinen Änderungen: `anim/bossAnims.ts` (Engine), `anim/animCommon.ts`, `anim/rigAnim.ts`, `engine/rig.ts`, `dungeonRenderer.ts`, `scripts/art-import.py`, `SPRITE_QUEUE.md` (nur eigene Zeilen/IDs ändern).
Ablauf & Regeln: [`PARALLEL_WORK.md`](../PARALLEL_WORK.md).
