# Handoff — Gegner „Sporenspucker“ (`spore_spitter`)
> Eigenes Status-Blatt. Code: `src/dungeon/anim/rigs/spore_spitter.ts`, Daten: `src/data/rigs/spore_spitter.json` (Sheet `art_source/rigs/spore_spitter_rig.png`, P2-03), Renderer-Zweig `spore_spitter` + `drawSpitterGhost` in `dungeonRenderer.ts` (nutzt `tryDrawEnemyRig`, Fallback = altes `enemy_spore_spitter.png`).

- **Rig:** Körper (Pose-Set `sp_body`/`sp_burrowed`), Auge, zwei Sporenkapseln (Pose-Set `pod_shut`/`pod_open`, rechts gespiegelt), Spore. Import: `npm run art:import -- spore_spitter --force` (die Einzelteile `body/burrowed/podShut/podOpen` aus der Teile-Ablage bleiben ungenutzt, Pose-Sets liefern das gemeinsame Gelenk).
- **Animation (rein optisch):** Leerlauf = Atmen + Kapselwiegen · Vorwarnung (0,5 s) = Aufblähen, linke Kapsel öffnet bei 30 %, rechte bei 60 %, Spore wächst · Ausführung = Ausstoß mit Rückstoß/Stauchen, Spore fliegt zum Spieler · Erholung (0,3 s) = Körper federt zurück, Kapseln schließen · Umsetzen (`scurryTimer`) = kurzes Wegducken, Körper gräbt sich ein (halb eingegrabenes Bild), taucht danach weich wieder auf · Treffer = Zucken (Flanke `flashTimer`, ≤ 0,15 s, Richtung wechselt) · Blick/Spiegelung zum Spieler mit Totzone.
- **Tod:** Der Gegner wird beim Töten sofort aus der Liste entfernt. Darum erkennt `updateSpitterGhosts` (aufgerufen in der Zeichenliste des Renderers) Spucker, die mit `hp ≤ 0` verschwinden, und zeichnet 0,5 s lang eine Todes-Pose (Körper sackt, Kapseln/Auge/Spore platzen weg). Keine Änderung an `DungeonScene`.
- **Test:** `tests/m11p9_spore_spitter.cjs` · Kontaktbogen: `node scripts/rig-sheet.cjs spore_spitter` (Dev-Server nach JSON-Änderung neu starten).
- **Offen:** Abnahme im echten Kampf; optionale Effekt-Sprites `P2-20` in `SPRITE_QUEUE.md` (Erdkrümel, Sporen-Puff, Schleim-Spritzer) — bis dahin Code-Glühen/Partikel.

## G1–G9 (BOSS_ANIMATION_PLAN.md §4)
| # | Status | Nachweis |
| :--- | :---: | :--- |
| G1 Rig vollständig | ✅ | Alle 6 Zellen verwendet (Körper, Auge, 2 Kapseln zu/offen, Spore, eingegraben); Kontaktbogen `tests/out/rig_spore_spitter.png` — Kapseln sitzen auf dem Körper, nichts schwebt; Test prüft `getHDArt().rigs.spore_spitter` |
| G2 Rückfall | ✅ | `tryDrawEnemyRig` liefert `false` ohne Rig-Bilder → bisheriger Zweig (altes Sprite, Puls, Leuchten) unverändert; Todes-Ghost zeichnet dann nichts |
| G3 Eigene Fortbewegung | ✅ | Atmen/Wiegen im Stand (Test: Skalierung schwankt >3 %); beim Umsetzen eingegraben, Staub-Partikel aus enemyAi bleiben |
| G4 Angriff in 3 Abschnitten | ✅ | Vorwarnung (Aufblähen, Kapseln nacheinander, Spore wächst) füllt die 0,5 s; Ausstoß mit Rückstoß; Erholung 0,3 s — Test `m11p9` Kapsel-Reihenfolge, Aufblähen, Kick/Erholung |
| G5 Weiche Übergänge | ✅ | Engine-Glättung (`tau` 0,04) + Eingraben/Auftauchen als Rampe (Test: kein Wechsel im ersten Bild, Rückkehr nach Umsetzen) |
| G6 Treffer-Reaktion | ✅ | Zucken ≤ 0,15 s, Flanke von `flashTimer`; Test: Kapsel bleibt in der Vorwarnung offen |
| G7 Tod | ✅ | 0,5 s Todes-Pose über Ghost (Test: Ghost nur bei `hp ≤ 0`, Kapseln fliegen weg, Körper sackt, endet) |
| G8 Rein optisch | ✅ | Geändert nur: `anim/rigs/spore_spitter.ts`, Rig-JSON, Renderer (Zweig `spore_spitter`, `drawSpitterGhost`, 1 Aufruf in der Zeichenliste), `scripts/rig-sheet.cjs` (Fall). Keine Änderung an Hitbox, Schaden, Timern, Zufall |
| G9 Test & Handoff | ✅ | `m11p9_spore_spitter`, dieses Blatt, `handoff/README.md`; `npm run verify` siehe Push |
