# handoff/ — Status je Arbeitsbereich (paralleles Arbeiten)

Jeder Chat/Agent pflegt **nur die Datei seines Bereichs**. `HANDOFF.md` bleibt der Einstieg (Index, Ablauf, Gesamtstand) und wird nur für Bereichsübergreifendes geändert. So gibt es keine Merge-Konflikte.

## 🔒 Wer arbeitet gerade woran? (Claim-Liste — **vor dem Start lesen, beim Start eintragen, am Ende austragen**)
> Regel: **pro Bereich nur ein Besitzer gleichzeitig** (`PARALLEL_WORK.md` §5, `AGENTS.md` Regel 18). Zeile eintragen = `git commit` + `npm run ship` **bevor** die eigentliche Arbeit beginnt, damit andere Chats/Werkzeuge es sehen. Steht ein Bereich auf „frei“, darf ihn jeder nehmen.

| Bereich | Besitzer (Werkzeug · Chat) | seit | Umfang (was ist in Arbeit — **was bewusst nicht**) |
| :--- | :--- | :--- | :--- |
| Endboss-Arenen M12 (Leviathan-Pilot, künftig S2–S4) | frei — Pilot wartet auf Abnahme im echten Spiel | 2026-11-28 | nächste Arena erst nach Abnahme (Pipeline Stufe 8) |
| Cutscenes-Ausbau 2 (Schiffsverkehr · Laden öffnen/schließen · Begleiter-Rettung) | frei — komplett live, wartet auf Abnahme | 2026-11-28 | Details: [`cutscenes.md`](cutscenes.md) §5 |
| Cutscenes (Intro, Feiern, Gehilfin Mina, Upgrades, Flug-Zyklus) | frei — komplett live inkl. aller 7 Sprites `P3-48`–`P3-54` & `?cutscenelab`, wartet auf Abnahme | 2026-11-28 | Details & Praxis-Learnings in [`cutscenes.md`](cutscenes.md) |
| Welt-Überarbeitung (Port Solaris, Laden, Quartier, Crew, Cutscene-Angleichung) | frei — P1–P6 komplett live, Rest siehe „Offen“ | 2026-11-28 | Details & Rezepte: [`world_overhaul.md`](world_overhaul.md) |
| Startscreen & Account-Einstieg | frei — komplett live (Key-Art, 3 Cloud-Slots als Planeten, Menü mit Platten/Objekten, Handy quer), wartet auf Abnahme | 2026-11-28 | Details & Praxis-Learnings: [`title_screen.md`](title_screen.md) (#3 durch #4 überholt) |
| Gegner-Rigs / Boss-Rigs (M11) | je Gegner: siehe Tabelle unten, Status-Blatt | — | pro Gegner/Boss ein Besitzer |
| Sprite-Queue (`SPRITE_QUEUE.md`) | Antigravity (offene `[ ]`) · Claude-Chats nur `[~]` für ihre laufende Aufgabe | — | `[~]` = in Arbeit, **nicht** doppelt erzeugen |

| Bereich | Status-Blatt | Code (nur dieser Bereich ändert ihn) | Daten | Test |
| :--- | :--- | :--- | :--- | :--- |
| Krall | [`krall.md`](krall.md) | `anim/rigs/krall.ts`, `bosses/` (Krall-Zonen) | `data/rigs/krall.json` | `m11p5_krall` |
| Kern-Wächter | [`core_warden.md`](core_warden.md) | `anim/rigs/core_warden.ts` | `data/rigs/core_warden.json` | `m11p6_core_warden` |
| Geschütz | [`enemy_turret.md`](enemy_turret.md) | `anim/rigs/turret.ts` | `data/rigs/turret.json` | `m11p7_turret` |
| Drohne | [`enemy_drone.md`](enemy_drone.md) | `anim/rigs/drone.ts` | `data/rigs/drone.json` | `m11p8_drone` |
| Bogen-Drohne | [`enemy_drone_arc.md`](enemy_drone_arc.md) | `anim/rigs/drone_arc.ts` (+ Wrack-Block `renderDroneArcWrecks` in `dungeonRenderer.ts`) | `data/rigs/drone_arc.json` | `m11p10_drone_arc` |
| Phasen-Jäger | [`enemy_phase_stalker.md`](enemy_phase_stalker.md) | `anim/rigs/phase_stalker.ts` | `data/rigs/phase_stalker.json` | `m11p9_phase_stalker` |
| Kristall-Krabbler | [`enemy_crystal_crawler.md`](enemy_crystal_crawler.md) | `anim/rigs/crystal_crawler.ts` | `data/rigs/crystal_crawler.json` | `m11p11_crystal_crawler` |
| Splitter-Scharfschütze | [`enemy_shard_sniper.md`](enemy_shard_sniper.md) | `anim/rigs/shard_sniper.ts` | `data/rigs/shard_sniper.json` | `m11p12_shard_sniper` |
| Prisma-Drohne | [`enemy_prism_drone.md`](enemy_prism_drone.md) | `anim/rigs/prism_drone.ts` | `data/rigs/prism_drone.json` | `m11p13_prism_drone` |
| Leere-Krabbler | [`enemy_void_crawler.md`](enemy_void_crawler.md) | `anim/rigs/void_crawler.ts` | `data/rigs/void_crawler.json` | `m11p14_void_crawler` |
| Resonanz-Wächter | [`enemy_resonance_warden.md`](enemy_resonance_warden.md) | `anim/rigs/resonance_warden.ts` | `data/rigs/resonance_warden.json` | `m11p15_resonance_warden` |
| Sektor-3-Gegner (5×) | [`enemy_sector3.md`](enemy_sector3.md) | `anim/rigs/{magma_mortar,slag_beetle,ember_stalker,forge_golem,solar_drone}.ts` | `data/rigs/*.json` | `m11p16_sector3_rigs` |
| Sektor-4-Gegner (5×) | [`enemy_sector4.md`](enemy_sector4.md) | `anim/rigs/{chrono_eye,astral_scarab,star_lancer,void_wraith,monolith_guard}.ts` | `data/rigs/*.json` | `m11p17_sector4_rigs` |
| Sporenspucker | [`enemy_spore_spitter.md`](enemy_spore_spitter.md) | `anim/rigs/spore_spitter.ts` (+ Renderer-Zweig `spore_spitter`, Todes-Animation) | `data/rigs/spore_spitter.json` | `m11p9_spore_spitter` |
| Schild-Drohne | [`enemy_shield_drone.md`](enemy_shield_drone.md) | `anim/rigs/shield_drone.ts` | `data/rigs/shield_drone.json` | `m11p…_shield_drone` |
| Endboss-Arenen (M12) | [`endboss_arena.md`](endboss_arena.md) | `src/dungeon/camera.ts`, `src/data/arenas/`, `bosses/leviathanArena.ts` (+ Phase A/B in gemeinsamen Dateien, siehe Blatt) | `data/arenas/<kind>.ts` | `m12p1…m12p5` |
| Sheet-Lieferstatus aller Gegner | [`enemy_sheets.md`](enemy_sheets.md) (Antigravity) | — | — | — |
| weitere Gegner/Bosse | neue Datei `enemy_<kind>.md` / `<boss>.md` anlegen | `anim/rigs/<rig-id>.ts` | `data/rigs/<rig-id>.json` | eigene `m11p…_<rig>.cjs` |

Gemeinsame (heikle) Dateien — nur mit Absprache/kleinen Änderungen: `anim/bossAnims.ts` (Engine), `anim/animCommon.ts`, `anim/rigAnim.ts`, `engine/rig.ts`, `dungeonRenderer.ts`, `scripts/art-import.py`, `SPRITE_QUEUE.md` (nur eigene Zeilen/IDs ändern).
Ablauf & Regeln: [`PARALLEL_WORK.md`](../PARALLEL_WORK.md).
