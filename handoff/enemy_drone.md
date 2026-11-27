# Handoff — Gegner „Drohne“ (`drone`)
> Eigenes Status-Blatt. Code: `src/dungeon/anim/rigs/drone.ts`, Daten: `src/data/rigs/drone.json`, Renderer: Drohnen-Zweig in `dungeonRenderer.ts` ruft `tryDrawEnemyRig`. Test: `tests/m11p8_drone.cjs`. Kontaktbogen: `node scripts/rig-sheet.cjs drone`.

- **Eingebunden (komplett):** Rumpf, Visier (offen/kneift), 2 Düsen-Gondeln (Code spiegelt rechts) + Flammen, Lade-Linse (`drone_rig.png`, Zellen 1–6 → body/visor/nacelle/lens/flame/visorHalf).
- Verhalten: schwebt + neigt sich in Flugrichtung, Gondeln kippen mit, Flammen wachsen mit Tempo (Seiten-Dash!), Vorwarnung (0,46 s): Visier kneift, Linse glüht auf, Rumpf weicht zurück; Rückstoß je Bolzen (aus `subBurst`). Blick zum Spieler mit Totzone (Rig gespiegelt), kleiner Flieger-Schatten.
- **Sheet v2 (art:gen, SPRITE_QUEUE `P2-01b`):** v1-Gondeln mit langem Ausleger wirkten im Spiel unnatürlich → neues Sheet: kompakte Gondel mit kurzem Stummel (hinter dem Rumpf links, vor dem Rumpf rechts), senkrechte Flamme, Visier-Glas/Halb-zu (im Code auf 0,68 skaliert, passt in die Rumpföffnung). Altes Sheet nur noch in der Git-Historie.
- Fallback: altes `drone.png`. Abnahme im echten Kampf offen. Offen/optional: Zelle 4 war laut Brief „Klappe“, ist im Sheet aber eine Linse — als Lade-Linse genutzt; obere Rumpfklappe fehlt (nicht nötig).
