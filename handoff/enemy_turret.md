# Handoff — Gegner „Geschütz“ (`turret`)
> Eigenes Status-Blatt. Code: `src/dungeon/anim/rigs/turret.ts`, Daten: `src/data/rigs/turret.json`, Renderer `tryDrawEnemyRig` (dungeonRenderer.ts).

- **Eingebunden (komplett):** Sockel/Gehäuse/Rohr/Mündung/Kern (`turret_rig.png`) + Raupenketten, Staub, Bremsfunken (`turret_treads.png`, P0-13). Gehäuse neigt sich zum Spieler (Rig gespiegelt), Rohr fährt in der Vorwarnung aus, Rückstoß, Wippen beim Umsetzen, Kettenphase aus Strecke.
- Fallback: altes `turret_0/1`. Abnahme im echten Kampf offen.
