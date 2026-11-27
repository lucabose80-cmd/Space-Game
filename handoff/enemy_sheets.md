# Handoff — Gegner-Rig-Sheets (Lieferstatus, Typ G · `art_source/rigs/<kind>_rig.png`)
> Antigravity hakt hier ab, wenn ein Sheet geliefert & per `art:check` geprüft ist (Details/IDs: `SPRITE_QUEUE.md`, Briefing: `ART_BRIEF_M11_ENEMIES.md`). **Einbinden** (Code) steht je Gegner in `handoff/enemy_<kind>.md`.

- [x] **Pilot:** `turret_rig` (`min_margin ≥ 45 px`, `art:check` ok) + `turret_treads` (`min_margin ≥ 78 px`, `art:check` ok) · `phase_stalker_rig` (`min_margin ≥ 53 px`, `art:check` ok) → **P2-Gate vom Projektinhaber freigegeben**
- [x] S1 (komplett ✅): `drone_rig` (`min_margin ≥ 71 px`, `art:check` ok) · `shield_drone_rig` (`min_margin ≥ 80 px`, `art:check` ok; Emitter-Ring Zelle 4 `holes: true`) · `spore_spitter_rig` (`min_margin ≥ 85 px`, `art:check` ok) · `drone_arc_rig` (`min_margin ≥ 72 px`, `art:check` ok)
- [x] S2 (komplett ✅): `crystal_crawler_rig` (`min_margin ≥ 96 px`, `art:check` ok) · `shard_sniper_rig` (`min_margin ≥ 40 px`, `art:check` ok) · `prism_drone_rig` (`min_margin ≥ 66 px`, `art:check` ok) · `void_crawler_rig` (`min_margin ≥ 48 px`, `art:check` ok) · `resonance_warden_rig` (`min_margin ≥ 51 px`, `art:check` ok)
- [x] S3 (erledigt): `magma_mortar_rig` (`min_margin ≥ 48 px`, `art:check` ok) · `slag_beetle_rig` (`min_margin ≥ 48 px`, `art:check` ok) · `ember_stalker_rig` (`min_margin ≥ 45 px`, `art:check` ok) · `forge_golem_rig` (`min_margin ≥ 48 px`, `art:check` ok)
- [ ] S3 (offen): `solar_drone_rig`
- [ ] S4: `chrono_eye_rig` · `astral_scarab_rig` · `star_lancer_rig` · `void_wraith_rig` · `monolith_guard_rig`
- Hinweis zum Import: Sheets von Gegner-Rigs haben `sheet.srcFile: <kind>_rig`; Ringe/hohle Teile mit Innen-Weiß → im Set `holes: true` setzen (`turret_rig.png` Zelle 5 Mündungsring, `shield_drone_rig.png` Zelle 4 Emitter-Ring).
