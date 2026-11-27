# Handoff — Gegner „Geschütz“ (`turret`)
> Eigenes Status-Blatt. Code: `src/dungeon/anim/rigs/turret.ts`, Daten: `src/data/rigs/turret.json`, Renderer `tryDrawEnemyRig` (dungeonRenderer.ts).

- **Eingebunden (komplett):** Sockel/Gehäuse/Rohr/Mündung/Kern (`turret_rig.png`) + Raupenketten, Staub, Bremsfunken (`turret_treads.png`, P0-13). Gehäuse neigt sich zum Spieler (Rig gespiegelt), Rohr fährt in der Vorwarnung aus, Rückstoß, Wippen beim Umsetzen, Kettenphase aus Strecke.
- Fallback: altes `turret_0/1`. Abnahme im echten Kampf offen.
- **Neu (Sitzung 2026-11-27, reine Code-Animation, keine neuen Sprites):** Treffer-Zucken (Flanke `flashTimer`, Richtung wechselt je Treffer), Beschädigungsstufen nach HP (>66 % ok · ≤66 % Wackeln · ≤33 % Absacken + flackernder Kern · <15 % kritisch, starkes Zittern), Leerlauf-Scan (Gehäuse schwenkt langsam), Ducken vor dem Umsetzen (`scurryTimer`-Flanke). Test `m11p7_turret` erweitert (Zucken, Absacken).
- **Offen:** visuelle Abnahme im echten Kampf; optional Sprites für echte Schadensstufen (Rauch/Funken/aufgerissenes Gehäuse) — würde in `SPRITE_QUEUE.md` (P3/P4) gehören, falls gewünscht.

- **Fix Ketten (2026-11-27):** Ketten ragten als schräge 40×30-Platten weit unter dem Sockel hervor und überlappten ihn. Jetzt per Pose auf 62 % verkleinert und waagerecht gedreht (`TREAD_SCALE`/`TREAD_LEVEL` in `turret.ts`), Versatz ±9/+6 in `turret.json` → sitzen unter dem Sockel. Prüfung: `node scripts/rig-sheet.cjs turret` (Fall `turret` ergänzt; Dev-Server nach JSON-Änderung neu starten, sonst bleibt der Bogen leer). Sauberer wäre ein Re-Export der Ketten-Sprites in Seitenansicht (kleiner, waagerecht) — bei Bedarf in `SPRITE_QUEUE.md`.
- **Ketten neu (P0-14, Regel 14/15):** Statt Code-Drehung/Verkleinern jetzt neues Sheet `turret_treads.png` in strenger Seitenansicht (per `npm run art:gen`, Rohbild `art_source/_raw/turret_treads2_raw.png`), importiert. Pose: nur `TREAD_SCALE = 0.8`, Versatz ±11/+8 in `turret.json`. Der frühere Fix (62 % + Drehung) ist damit ersetzt. Offen: Bewegung/Bremsfunken im echten Kampf ansehen (Funken-Position evtl. nachziehen).

