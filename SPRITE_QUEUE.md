# SPRITE_QUEUE.md — Zentrale, priorisierte Sprite-Warteschlange (*STARLIGHTER*)

> **Single Source of Truth für alle offenen Sprite- & Sheet-Aufträge** (Antigravity, Claude Code & künftige Agenten).
> **Streng nach Priorität abarbeiten (`P0` → `P4`, von oben nach unten).**
> Detail-Prompts & Maße stehen in den jeweiligen Briefs: [`BOSS_ANIMATION_PLAN.md`](BOSS_ANIMATION_PLAN.md) · [`ART_BRIEF_M11.md`](ART_BRIEF_M11.md) · [`ART_BRIEF_M11_ENEMIES.md`](ART_BRIEF_M11_ENEMIES.md) · [`ART_AND_DESIGN_GUIDE.md`](ART_AND_DESIGN_GUIDE.md).

---

## Verbindliche Regeln für ALLE Agenten & KIs

### 1. Einsortier-Pflicht (Claude Code, Feature-Agenten & Planung)
Wer im Code oder in einem Plan ein neues benötigtes Sprite, ein neues M11-Sheet oder einen prozeduralen Fallback anlegt, **muss** es im selben Commit hier in `SPRITE_QUEUE.md` eintragen:
- in der passenden Prioritätsstufe (**P0** = laufendes Boss-Rig / Blocker · **P1** = Pilot vor Serie · **P2** = M11 Gegner-Rigs · **P3** = optionale M10/M10-C-Fallbacks · **P4** = weitere Boss-Rigs),
- mit eindeutiger **ID**, Status `[ ]`, exaktem **Zielpfad**, **Typ/Format**, **Referenzbild(ern)** und **Brief-/Prompt-Abschnitt**,
- sowie dem Prompt im zugehörigen Brief (`ART_BRIEF_M11*.md` / `ART_AND_DESIGN_GUIDE.md`) und – bei optionalen Sprites – der Registrierung in `artLoader.ts` (`*_OPTIONAL_SPRITES`).

### 2. Abarbeitungs-Regeln (Antigravity / Skill `sprite-batch`)
1. **Sync zuerst:** Immer mit `git fetch origin && git pull --ff-only` starten.
2. **Dateisystem-Abgleich:** Existiert die Zieldatei eines `[ ]`-Eintrags bereits im Repo (z. B. aus einem parallelen Chat), **nicht** neu generieren — nur auf `[x]` setzen.
3. **Strikt von oben nach unten:** Immer die ersten offenen `[ ]`-Einträge aus der höchsten Prioritätsstufe (`P0` → `P4`) nehmen, **sofern der Projektinhaber nichts anderes vorgibt**.
4. **STOP-GATES sind hart:** Steht über einem Abschnitt `⛔ STOP-GATE (GESPERRT)`, **niemals** automatisch dahinter weitergenerieren! Erst weitermachen, wenn der Projektinhaber das Gate nach Prüfung im Spiel freigegeben hat (`✅ STOP-GATE (FREIGEGEBEN)`).
5. **Quota-Budget pro Lauf:** Standardmäßig **maximal 2 Sheets pro Batch** (bzw. gewünschte Stückzahl, höchstens 3 `generate_image`-Aufrufe pro Lauf) und **maximal 1 Retry** bei fehlerhaftem Bild. Tritt ein Quota-/Rate-Limit (`gemini-3.1-flash-image`) auf → **sofort sauber abbrechen**, bereits fertige & geprüfte Dateien committen und den Rest `[ ]` lassen.
6. **Qualitätspflicht vor Commit:**
   - **M11-Sheets (`art_source/rigs/*.png`):** Verlustfreies `1536×1024`-PNG (`512×512`/Zelle, reines `#FFFFFF`, keine Rasterlinien/Text/Schatten), `npm run art:check -- <datei>`, Prüfbild in `art_source/_check/` per `view_file` kontrollieren (Gelenk/Kern exakt im roten Fadenkreuz, `min_margin ≥ 30 px`, keine ⚠-Warnung; sonst per PIL ohne Skalierung zentrieren).
   - **Einzel-Sprites (`public/art/sprites/*.png`):** Flood-Fill-Freistellung + `NEAREST` auf Zielgröße (`96×96` bzw. `128×128` RGBA) nach `ART_AND_DESIGN_GUIDE.md` §3, per `view_file` prüfen (keine weißen Fransen, innere Highlights intakt).
   - Abschließend `npm run check:invariants && npm run check:sprites` laufen lassen, Status hier auf `[x]` setzen, `HANDOFF.md` kurz aktualisieren, committen (`art(m11): ...` bzw. `art(m10): ...`) und pushen (außer der Nutzer wünscht explizit „nur lokal“).

### Status-Legende
- `[ ]` offen (bereit für den nächsten Batch)
- `[~]` in Arbeit / wartet auf Abnahme durch Projektinhaber
- `[x]` generiert, geprüft & im Repo abgelegt
- `[!]` Problem / Retry fehlgeschlagen → manuell prüfen (Grund in Spalte „Notiz“)

---

## P0 — NEU, höchste Priorität: Krall-Angriffsgrafik (vom Projektinhaber nach Test gewünscht)

> **Grund:** Beim Test wirkten Kralls Angriffe „leer“ (Sog nur ein Schadenskreis, Schrott-Hagel nur Kreise, Stoß nur kleine Armbewegung). Code-Seite ist umgesetzt (Sog-Ringe/Schrott-Strom, fallende Schrottklumpen mit Aufschlag, Stoß-Streifen) und nutzt vorhandene Bilder (`scrap_a/b/c`, `spark`). Mit diesen Sheets kann es auf Kern-Wächter-Niveau gebracht werden. **Reihenfolge: P0-13 (Geschütz-Ketten, blockiert Gegner-Serie) → P0-06 → P0-07 → P0-08 → P0-09 → P0-10 → P0-11 → P0-12** (P0-11/12 = Beschädigungsstufen). Referenz überall: `public/art/sprites/boss_breacher.png`, `art_source/rigs/krall_parts.png`.

| ID | Status | Zieldatei | Typ & Format | Referenz (`ImagePaths`) | Brief / Prompt | Notiz |
| :--- | :---: | :--- | :--- | :--- | :--- | :--- |
| `P0-13` | [x] | `art_source/rigs/turret_treads.png` | Typ G/E · 3×2 · `1536×1024` | `public/art/sprites/turret_0.png`, `art_source/rigs/turret_rig.png` | `ART_BRIEF_M11_ENEMIES.md` (Zusatz Geschütz-Antrieb) | ✅ 4 Rollphasen linke Raupenkette + Staubwolke + Bremsfunken (`min_margin ≥ 78 px`, `art:check` ok, bereit für Claude-Import) |
| `P0-06` | [x] | `art_source/rigs/krall_arms_R2.png` | Typ L · 3×2 · `1536×1024` | `art_source/rigs/krall_arms_R.png` | `ART_BRIEF_M11.md` §4.1 (Zusatz K-C) | ✅ Rechte Greifzange Angriffsposen (`min_margin ≥ 40 px`, `art:check` ok, bereit für Claude-Import) |
| `P0-07` | [x] | `art_source/rigs/krall_arms_L2.png` | Typ L · 3×2 · `1536×1024` | `art_source/rigs/krall_arms_L.png` | `ART_BRIEF_M11.md` §4.1 (Zusatz K-C) | ✅ Linker Haken/Säge Angriffsposen (`min_margin ≥ 35 px`, `art:check` ok, Licht links-oben, bereit für Claude-Import) |
| `P0-08` | [x] | `art_source/rigs/krall_fx2.png` | Typ E · 3×2 · `1536×1024` | `art_source/rigs/krall_effects.png` | `ART_BRIEF_M11.md` §4.1 (Zusatz K-D) | ✅ Angriffs-Effekte K-D (`min_margin ≥ 99 px`, `art:check` ok; Ringe Zelle 2/4 mit `holes: true` importieren) |
| `P0-09` | [x] | `art_source/rigs/krall_torsos2.png` | Typ S · 3×2 · `1536×1024` | `art_source/rigs/krall_torsos.png` *(Zelle 5 = Phase-2-Skelettrahmen)* | `ART_BRIEF_M11.md` §4.1 (Zusatz K-A) | ✅ 6 Phase-2-Skelettrahmen-Rümpfe (`min_margin ≥ 56 px`, `art:check` ok, Kern im Fadenkreuz, bereit für Claude-Import) |
| `P0-10` | [x] | `art_source/rigs/krall_legs_R2.png` + `krall_legs_L2.png` | Typ L · 2× 3×2 | `art_source/rigs/krall_legs_R.png` / `_L.png` | `ART_BRIEF_M11.md` §4.1 (Zusatz K-B) | ✅ Angriffsbeine K-B (`R2: min_margin ≥ 38 px`, `L2: min_margin ≥ 31 px`, `art:check` ok, L nicht gespiegelt, Licht links-oben) |
| `P0-11` | [x] | `art_source/rigs/krall_torsos3.png` | Typ S · 3×2 · `1536×1024` | `art_source/rigs/krall_torsos.png`, `art_source/rigs/krall_torsos2.png` | `ART_BRIEF_M11.md` §4.1 (Zusatz K-E) | ✅ 6 Beschädigungsstufen Rumpf (P1 < 80/< 65/< 25 %, P2 < 35/< 25/kritisch < 15 %; Kern im Fadenkreuz, `min_margin ≥ 35 px`, `art:check` ok) |
| `P0-12` | [ ] | `art_source/rigs/krall_arms_R3.png` + `krall_arms_L3.png` | Typ L · 2× 3×2 | `art_source/rigs/krall_arms_R.png` / `_L.png` | `ART_BRIEF_M11.md` §4.1 (Zusatz K-E) | **Beschädigte Arme je Seite:** Zange/Haken verbogen (hängend · ausholend · Stoß) · abgebrochen mit Stumpf und Funken (hängend · ausholend · Stoß). Schulterring im Fadenkreuz, L nicht gespiegelt |

---

## P0 — Aktive Boss-Rigs abschließen (höchste Priorität — erledigt ✅)

| ID | Status | Zieldatei | Typ & Format | Referenz (`ImagePaths`) | Brief / Prompt | Notiz |
| :--- | :---: | :--- | :--- | :--- | :--- | :--- |
| `P0-01` | [x] | `art_source/rigs/core_warden_arms_R3.png` | Typ L · 3×2 · `1536×1024` | `public/art/sprites/boss.png`, `art_source/rigs/core_warden_arms_R.png`, `art_source/rigs/core_warden_fists.png` | `BOSS_ANIMATION_PLAN.md` §2.3 (S6) | ✅ geliefert (`min_margin ≥ 64 px`, bereit für Claude-Import) |
| `P0-02` | [x] | `art_source/rigs/core_warden_arms_L3.png` | Typ L · 3×2 · `1536×1024` | `public/art/sprites/boss.png`, `art_source/rigs/core_warden_arms_L.png`, `art_source/rigs/core_warden_fists.png` | `BOSS_ANIMATION_PLAN.md` §2.3 (S6) | ✅ geliefert (`min_margin ≥ 63 px`, bereit für Claude-Import) |
| `P0-03` | [x] | `art_source/rigs/krall_legs_R.png` | Typ L · 3×2 · `1536×1024` | `public/art/sprites/boss_breacher.png`, `art_source/rigs/krall_parts.png` | `ART_BRIEF_M11.md` §4.1 | ✅ geliefert (`min_margin ≥ 69 px`, bereit für Claude-Import) |
| `P0-04` | [x] | `art_source/rigs/krall_legs_L.png` | Typ L · 3×2 · `1536×1024` | `public/art/sprites/boss_breacher.png`, `art_source/rigs/krall_parts.png` | `ART_BRIEF_M11.md` §4.1 | ✅ geliefert (`min_margin ≥ 68 px`, bereit für Claude-Import) |
| `P0-05` | [x] | `art_source/rigs/krall_effects.png` | Typ E · 3×2 · `1536×1024` | `public/art/sprites/boss_breacher.png`, `art_source/rigs/krall_parts.png` | `ART_BRIEF_M11.md` §4.1 | ✅ geliefert (`min_margin ≥ 108 px`, bereit für Claude-Import) |

---

## P1 — M11 Gegner-Rigs: Pilot (2 Sheets — geliefert ✅, wartet auf Abnahme)

| ID | Status | Zieldatei | Typ & Format | Referenz (`ImagePaths`) | Brief / Prompt | Notiz |
| :--- | :---: | :--- | :--- | :--- | :--- | :--- |
| `P1-01` | [x] | `art_source/rigs/turret_rig.png` | Typ G · 3×2 · `1536×1024` | `public/art/sprites/turret_0.png`, `public/art/sprites/turret_1.png` | `ART_BRIEF_M11_ENEMIES.md` §3 & §4 (S1) | ✅ Pilot mechanisch (`min_margin ≥ 45 px`, `art:check` ok, bereit für Claude-Import) |
| `P1-02` | [x] | `art_source/rigs/phase_stalker_rig.png` | Typ G · 3×2 · `1536×1024` | `public/art/sprites/enemy_phase_stalker.png` | `ART_BRIEF_M11_ENEMIES.md` §3 & §4 (S1) | ✅ Pilot humanoid (`min_margin ≥ 53 px`, `art:check` ok, bereit für Claude-Import) |

> **✅ STOP-GATE (FREIGEGEBEN):** Vom Projektinhaber am 2026-11-26 freigegeben — P2-Serie läuft (Parallel-Einbindung der Pilot-Sheets durch Claude Code).

---

## P2 — M11 Gegner-Rigs: Serie (Sektor 1 → 4)

### P2a — Rest Sektor 1 (am häufigsten gesehen)

| ID | Status | Zieldatei | Typ & Format | Referenz (`ImagePaths`) | Brief / Prompt | Notiz |
| :--- | :---: | :--- | :--- | :--- | :--- | :--- |
| `P2-01` | [x] | `art_source/rigs/drone_rig.png` | Typ G · 3×2 · `1536×1024` | `public/art/sprites/drone.png` | `ART_BRIEF_M11_ENEMIES.md` §4 (S1) | ✅ Drohne (`min_margin ≥ 71 px`, `art:check` ok, bereit für Claude-Import) |
| `P2-02` | [ ] | `art_source/rigs/shield_drone_rig.png` | Typ G · 3×2 · `1536×1024` | `public/art/sprites/enemy_shield_drone.png` | `ART_BRIEF_M11_ENEMIES.md` §4 (S1) | Schild-Drohne |
| `P2-03` | [ ] | `art_source/rigs/spore_spitter_rig.png` | Typ G · 3×2 · `1536×1024` | `public/art/sprites/enemy_spore_spitter.png` | `ART_BRIEF_M11_ENEMIES.md` §4 (S1) | Sporenspucker |
| `P2-04` | [ ] | `art_source/rigs/drone_arc_rig.png` | Typ G · 3×2 · `1536×1024` | `public/art/sprites/enemy_drone_arc.png` | `ART_BRIEF_M11_ENEMIES.md` §4 (S1) | Bogen-Drohne |

### P2b — Sektor 2

| ID | Status | Zieldatei | Typ & Format | Referenz (`ImagePaths`) | Brief / Prompt | Notiz |
| :--- | :---: | :--- | :--- | :--- | :--- | :--- |
| `P2-05` | [ ] | `art_source/rigs/crystal_crawler_rig.png` | Typ G · 3×2 · `1536×1024` | `public/art/sprites/enemy_crystal_crawler.png` | `ART_BRIEF_M11_ENEMIES.md` §4 (S2) | Kristall-Krabbler |
| `P2-06` | [ ] | `art_source/rigs/shard_sniper_rig.png` | Typ G · 3×2 · `1536×1024` | `public/art/sprites/enemy_shard_sniper.png` | `ART_BRIEF_M11_ENEMIES.md` §4 (S2) | Splitter-Scharfschütze |
| `P2-07` | [ ] | `art_source/rigs/prism_drone_rig.png` | Typ G · 3×2 · `1536×1024` | `public/art/sprites/enemy_prism_drone.png` | `ART_BRIEF_M11_ENEMIES.md` §4 (S2) | Prisma-Drohne |
| `P2-08` | [ ] | `art_source/rigs/void_crawler_rig.png` | Typ G · 3×2 · `1536×1024` | `public/art/sprites/enemy_void_crawler.png` | `ART_BRIEF_M11_ENEMIES.md` §4 (S2) | Leere-Krabbler |
| `P2-09` | [ ] | `art_source/rigs/resonance_warden_rig.png` | Typ G · 3×2 · `1536×1024` | `public/art/sprites/enemy_resonance_warden.png` | `ART_BRIEF_M11_ENEMIES.md` §4 (S2) | Resonanz-Wächter |

### P2c — Sektor 3

| ID | Status | Zieldatei | Typ & Format | Referenz (`ImagePaths`) | Brief / Prompt | Notiz |
| :--- | :---: | :--- | :--- | :--- | :--- | :--- |
| `P2-10` | [ ] | `art_source/rigs/magma_mortar_rig.png` | Typ G · 3×2 · `1536×1024` | `public/art/sprites/enemy_magma_mortar.png` | `ART_BRIEF_M11_ENEMIES.md` §4 (S3) | Magma-Mörser |
| `P2-11` | [ ] | `art_source/rigs/slag_beetle_rig.png` | Typ G · 3×2 · `1536×1024` | `public/art/sprites/enemy_slag_beetle.png` | `ART_BRIEF_M11_ENEMIES.md` §4 (S3) | Schlacken-Käfer |
| `P2-12` | [ ] | `art_source/rigs/ember_stalker_rig.png` | Typ G · 3×2 · `1536×1024` | `public/art/sprites/enemy_ember_stalker.png` | `ART_BRIEF_M11_ENEMIES.md` §4 (S3) | Glut-Jäger |
| `P2-13` | [ ] | `art_source/rigs/forge_golem_rig.png` | Typ G · 3×2 · `1536×1024` | `public/art/sprites/enemy_forge_golem.png` | `ART_BRIEF_M11_ENEMIES.md` §4 (S3) | Gießerei-Golem |
| `P2-14` | [ ] | `art_source/rigs/solar_drone_rig.png` | Typ G · 3×2 · `1536×1024` | `public/art/sprites/enemy_solar_drone.png` | `ART_BRIEF_M11_ENEMIES.md` §4 (S3) | Solar-Drohne |

### P2d — Sektor 4

| ID | Status | Zieldatei | Typ & Format | Referenz (`ImagePaths`) | Brief / Prompt | Notiz |
| :--- | :---: | :--- | :--- | :--- | :--- | :--- |
| `P2-15` | [ ] | `art_source/rigs/chrono_eye_rig.png` | Typ G · 3×2 · `1536×1024` | `public/art/sprites/enemy_chrono_eye.png` | `ART_BRIEF_M11_ENEMIES.md` §4 (S4) | Chrono-Auge |
| `P2-16` | [ ] | `art_source/rigs/astral_scarab_rig.png` | Typ G · 3×2 · `1536×1024` | `public/art/sprites/enemy_astral_scarab.png` | `ART_BRIEF_M11_ENEMIES.md` §4 (S4) | Astral-Skarabäus |
| `P2-17` | [ ] | `art_source/rigs/star_lancer_rig.png` | Typ G · 3×2 · `1536×1024` | `public/art/sprites/enemy_star_lancer.png` | `ART_BRIEF_M11_ENEMIES.md` §4 (S4) | Sternen-Lanzer |
| `P2-18` | [ ] | `art_source/rigs/void_wraith_rig.png` | Typ G · 3×2 · `1536×1024` | `public/art/sprites/enemy_void_wraith.png` | `ART_BRIEF_M11_ENEMIES.md` §4 (S4) | Leere-Phantom |
| `P2-19` | [ ] | `art_source/rigs/monolith_guard_rig.png` | Typ G · 3×2 · `1536×1024` | `public/art/sprites/enemy_monolith_guard.png` | `ART_BRIEF_M11_ENEMIES.md` §4 (S4) | Monolith-Wächter |

---

## P3 — Optionale M10 & M10-C Einzel-Sprites (Fallbacks ersetzen)

> **Credit-Spar-Hinweis:** Bis zu 6 zusammengehörige M10-Promenade-Props (oder 4 M10-C-Boss-Sprites) können als **ein** `3×2`-Sheet auf `#FFFFFF` erzeugt und per PIL sauber in einzelne `96×96`- bzw. `128×128`-RGBA-PNGs extrahiert werden (1 Slot statt 6 Slots). Eine abgelegte PNG ersetzt den prozeduralen Fallback sofort ohne Codeänderung.

### P3a — Schwächste Promenaden-Fallbacks zuerst (M10-A)

| ID | Status | Zieldatei | Typ & Format | Referenz (`ImagePaths`) | Brief / Prompt | Notiz |
| :--- | :---: | :--- | :--- | :--- | :--- | :--- |
| `P3-01` | [ ] | `public/art/sprites/prop_vex_beacon.png` | Formel B · `96×96` RGBA | `public/art/hub_bg.png` *(Stil/Palette)* | `ART_AND_DESIGN_GUIDE.md` §7 | Vex-Bake (schwächster Fallback) |
| `P3-02` | [ ] | `public/art/sprites/prop_hub_cycle_holo.png` | Formel B · `96×96` RGBA | `public/art/hub_bg.png` | `ART_AND_DESIGN_GUIDE.md` §7 | Zyklus-Hologramm |
| `P3-03` | [ ] | `public/art/sprites/prop_hub_elder_obelisk.png` | Formel B · `96×96` RGBA | `public/art/hub_bg.png` | `ART_AND_DESIGN_GUIDE.md` §7 | Ältesten-Obelisk |
| `P3-04` | [ ] | `public/art/sprites/prop_vex_classboard.png` | Formel B · `96×96` RGBA | `public/art/hub_bg.png` | `ART_AND_DESIGN_GUIDE.md` §7 | Vex-Klassentafel |

### P3b — Übrige Promenaden-Props & NPCs (M10-A)

| ID | Status | Zieldatei | Typ & Format | Referenz (`ImagePaths`) | Brief / Prompt | Notiz |
| :--- | :---: | :--- | :--- | :--- | :--- | :--- |
| `P3-05` | [ ] | `public/art/sprites/prop_hub_crystal_lantern.png` | Formel B · `96×96` RGBA | `public/art/hub_bg.png` | `ART_AND_DESIGN_GUIDE.md` §7 | Kristall-Laterne |
| `P3-06` | [ ] | `public/art/sprites/prop_hub_star_banner.png` | Formel B · `96×96` RGBA | `public/art/hub_bg.png` | `ART_AND_DESIGN_GUIDE.md` §7 | Sternen-Banner |
| `P3-07` | [ ] | `public/art/sprites/prop_kael_memorial.png` | Formel B · `96×96` RGBA | `public/art/hub_bg.png` | `ART_AND_DESIGN_GUIDE.md` §7 | Kael-Gedenkamboss |
| `P3-08` | [ ] | `public/art/sprites/prop_lyra_echo_sign.png` | Formel B · `96×96` RGBA | `public/art/hub_bg.png` | `ART_AND_DESIGN_GUIDE.md` §7 | Lyra-Klinikschild |
| `P3-09` | [ ] | `public/art/sprites/prop_nyx_free_lantern.png` | Formel B · `96×96` RGBA | `public/art/hub_bg.png` | `ART_AND_DESIGN_GUIDE.md` §7 | Nyx-Laterne |
| `P3-10` | [ ] | `public/art/sprites/npc_pilgrim.png` | Formel B · `96×96` RGBA | `public/art/sprites/npc_lyra.png` *(Proportion)* | `ART_AND_DESIGN_GUIDE.md` §7 | Pilger-NPC |
| `P3-11` | [ ] | `public/art/sprites/npc_foundry_worker.png` | Formel B · `96×96` RGBA | `public/art/sprites/npc_kael.png` *(Proportion)* | `ART_AND_DESIGN_GUIDE.md` §7 | Gießerei-Arbeiter-NPC |
| `P3-12` | [ ] | `public/art/sprites/npc_elder_scholar.png` | Formel B · `96×96` RGBA | `public/art/sprites/npc_vex.png` *(Proportion)* | `ART_AND_DESIGN_GUIDE.md` §7 | Ältesten-Gelehrter-NPC |

### P3c — Fehlende M10-C Boss-Sprites (Fallback-Ersatz)

| ID | Status | Zieldatei | Typ & Format | Referenz (`ImagePaths`) | Brief / Prompt | Notiz |
| :--- | :---: | :--- | :--- | :--- | :--- | :--- |
| `P3-13` | [ ] | `public/art/sprites/boss_slag_colossus.png` | Formel B · `128×128` RGBA | `public/art/sprites/boss_vulkan_titan.png` *(Sektor-3-Stil)* | `ART_AND_DESIGN_GUIDE.md` §8 | S3 E1 Schlacken-Koloss |
| `P3-14` | [ ] | `public/art/sprites/boss_forge_mistress.png` | Formel B · `128×128` RGBA | `public/art/sprites/boss_vulkan_titan.png` *(Sektor-3-Stil)* | `ART_AND_DESIGN_GUIDE.md` §8 | S3 E2 Gießerei-Meisterin |
| `P3-15` | [ ] | `public/art/sprites/boss_chrono_warden.png` | Formel B · `128×128` RGBA | `public/art/sprites/boss_star_archon.png` *(Sektor-4-Stil)* | `ART_AND_DESIGN_GUIDE.md` §8 | S4 E1 Chrono-Wächter |
| `P3-16` | [ ] | `public/art/sprites/boss_monolith_colossus.png` | Formel B · `128×128` RGBA | `public/art/sprites/boss_star_archon.png` *(Sektor-4-Stil)* | `ART_AND_DESIGN_GUIDE.md` §8 | S4 E2 Monolith-Koloss |
| `P3-17` | [ ] | `public/art/sprites/boss_scrap_collector.png` | Formel B · `128×128` RGBA | `public/art/sprites/boss_breacher.png` | `ART_AND_DESIGN_GUIDE.md` §8 | Sehr niedrige Prio: Krall nutzt bereits sein M11-Rig |

---

## P4 — Weitere Boss-Rig-Sets (`ART_BRIEF_M11.md` §4.3)

> **⛔ STOP-GATE (GESPERRT):** Zellenlisten pro Boss werden erst festgelegt (jede muss den **Mindeststandard D11–D14** abdecken: Angriffsgrafik, Beschädigungsstufen, Beine/Unterkörper je Angriff), wenn **Kern-Wächter** und **Krall** im echten Spiel abgenommen sind (spart Credits). Danach trägt Claude Code die konkreten Sheets je Boss hier als `P4-01 …` ein:
> Quarz-Koloss · Sternen-Archon · Leviathan · Prisma-Weberin · Prisma-Archon · Schlacken-Koloss · Gießerei-Meisterin · Vulkan-Titan · Chrono-Wächter · Monolith-Koloss.

---

## Archiv — Bereits erledigte M11-Sheets (nicht neu generieren)
- **Kern-Wächter (12/12 komplett):** `core_warden_parts.png`, `core_warden_arms_R.png`, `core_warden_arms_L.png`, `core_warden_heads.png`, `core_warden_torsos.png`, `core_warden_torsos2.png`, `core_warden_fists.png`, `core_warden_arms_R2.png`, `core_warden_arms_L2.png`, `core_warden_heads2.png`, `core_warden_arms_R3.png` *(S6)*, `core_warden_arms_L3.png` *(S6)*
- **Krall (7/7 komplett):** `krall_parts.png`, `krall_arms_R.png`, `krall_arms_L.png`, `krall_torsos.png`, `krall_legs_R.png`, `krall_legs_L.png`, `krall_effects.png`
