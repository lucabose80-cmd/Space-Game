# Handoff — Gegner „Geschütz“ (`turret`)
> Eigenes Status-Blatt. Code: `src/dungeon/anim/rigs/turret.ts`, Daten: `src/data/rigs/turret.json`, Renderer `tryDrawEnemyRig` (dungeonRenderer.ts).

- **Eingebunden (komplett):** Sockel/Gehäuse/Rohr/Mündung/Kern (`turret_rig.png`) + Raupenketten, Staub, Bremsfunken (`turret_treads.png`, P0-13). Gehäuse neigt sich zum Spieler (Rig gespiegelt), Rohr fährt in der Vorwarnung aus, Rückstoß, Wippen beim Umsetzen, Kettenphase aus Strecke.
- Fallback: altes `turret_0/1`. Abnahme im echten Kampf offen.
- **Neu (Sitzung 2026-11-27, reine Code-Animation, keine neuen Sprites):** Treffer-Zucken (Flanke `flashTimer`, Richtung wechselt je Treffer), Beschädigungsstufen nach HP (>66 % ok · ≤66 % Wackeln · ≤33 % Absacken + flackernder Kern · <15 % kritisch, starkes Zittern), Leerlauf-Scan (Gehäuse schwenkt langsam), Ducken vor dem Umsetzen (`scurryTimer`-Flanke). Test `m11p7_turret` erweitert (Zucken, Absacken).
- **Offen:** visuelle Abnahme im echten Kampf; optional Sprites für echte Schadensstufen (Rauch/Funken/aufgerissenes Gehäuse) — würde in `SPRITE_QUEUE.md` (P3/P4) gehören, falls gewünscht.

