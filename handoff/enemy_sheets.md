# Handoff — Gegner-Rig-Sheets (Lieferstatus, Typ G · `art_source/rigs/<kind>_rig.png`)
> Antigravity hakt hier ab, wenn ein Sheet geliefert & per `art:check` geprüft ist (Details/IDs: `SPRITE_QUEUE.md`, Briefing: `ART_BRIEF_M11_ENEMIES.md`). **Einbinden** (Code) steht je Gegner in `handoff/enemy_<kind>.md`.

- [x] **Pilot:** `turret_rig` (`min_margin ≥ 45 px`, `art:check` ok) + `turret_treads` (`min_margin ≥ 78 px`, `art:check` ok) · `phase_stalker_rig` (`min_margin ≥ 53 px`, `art:check` ok) → **P2-Gate vom Projektinhaber freigegeben**
- [x] S1 (komplett ✅): `drone_rig` (`min_margin ≥ 71 px`, `art:check` ok) · `shield_drone_rig` (`min_margin ≥ 80 px`, `art:check` ok; Emitter-Ring Zelle 4 `holes: true`) · `spore_spitter_rig` (`min_margin ≥ 85 px`, `art:check` ok) · `drone_arc_rig` (`min_margin ≥ 72 px`, `art:check` ok)
- [ ] S2: `crystal_crawler_rig` · `shard_sniper_rig` · `prism_drone_rig` · `void_crawler_rig` · `resonance_warden_rig`
- [ ] S3: `magma_mortar_rig` · `slag_beetle_rig` · `ember_stalker_rig` · `forge_golem_rig` · `solar_drone_rig`
- [ ] S4: `chrono_eye_rig` · `astral_scarab_rig` · `star_lancer_rig` · `void_wraith_rig` · `monolith_guard_rig`
- Hinweis zum Import: Sheets von Gegner-Rigs haben `sheet.srcFile: <kind>_rig`; Ringe/hohle Teile mit Innen-Weiß → im Set `holes: true` setzen (`turret_rig.png` Zelle 5 Mündungsring, `shield_drone_rig.png` Zelle 4 Emitter-Ring).
