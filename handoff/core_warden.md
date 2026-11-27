# Handoff — Kern-Wächter (`core_warden`)
> Eigenes Status-Blatt: nur **dieser Chat/Agent** ändert diese Datei, wenn er am Kern-Wächter arbeitet. Code: `src/dungeon/anim/rigs/core_warden.ts`, Daten: `src/data/rigs/core_warden.json`. Standard: `BOSS_ANIMATION_PLAN.md` §1 (D1–D14).

## Stand
- **Kern-Wächter** (`bossAnims.ts` → `coreWardenSet`): Arme (13 Varianten je Seite), Köpfe (12), Rümpfe (12) je `bossState`; Glättung + Stauch-Impuls + Zwischen-Posen; Anlauf/Nachfedern/Gehen/Treffer; Laser-Brust offen; Blick/Blinzeln; Phase 2: Platten fliegen weg (`detached.ts`), Fäuste kreisen und werden als „Faust-Salve“ abgefeuert (verfolgen den Spieler, lösen sich auf, wachsen nach), hängende Arme ohne Faust. Varianten-Karte: `BOSS_ANIMATION_PLAN.md` §2.1. **S6 eingebunden:** `armR_13…18`/`armL_13…18` (Phase 2 ohne Faust, Karte `NOFIST_OF` in `bossAnims.ts`) → Kern-Wächter komplett; fehlt nur die Abnahme im echten Kampf.
- **Beschädigungsstufen (ohne neue Sprites):** P1 < 80 % Helm rissig · < 65 % Rumpf dampft · P2 < 35 % Arme zerfetzt · < 25 % Rumpf beschädigt · < 15 % Helm zerstört (Test `m11p2`).
- Offen: Prüfung gegen D11–D14 (Angriffsgrafik je Attacke), Abnahme im echten Kampf (§2.4 im Plan).

## Art-Sheets (`art_source/rigs/`)
  - **§4.2 Kern-Wächter — komplett (4/4 neue Sheets fertig):**
    - `art_source/rigs/core_warden_arms_R.png` (rechter Arm `x=0.93`, 6 Posen, `min_margin ≥ 31 px`)
    - `art_source/rigs/core_warden_arms_L.png` (linker Arm `x=0.07`, 6 Posen, `min_margin ≥ 34 px`; **S1 erledigt**: Zellen 2 & 4 eigenständig mit Licht links-oben neu schattiert und re-importiert)
    - `art_source/rigs/core_warden_heads.png` (6 Helm+Halo-Varianten, Halsgelenk im Fadenkreuz, `min_margin ≥ 32 px`)
    - `art_source/rigs/core_warden_torsos.png` (6 Rumpf-Varianten inkl. Phase-2-Kern offen & überhitzt, Reaktorkern im Fadenkreuz, `min_margin ≥ 43 px`)
    - `art_source/rigs/core_warden_torsos2.png` (**S3**: Brustklappen offen/halb offen für Laser, Sprung gestreckt, Landung gestaucht, Phase 2 Laser, Phase 2 beschädigt; Kern im Fadenkreuz, `min_margin ≥ 40 px`)
    - `art_source/rigs/core_warden_fists.png` (**S4**: Arme R/L ohne Faust mit leuchtender Manschette + Fäuste vorn/geladen/schräg-oben + Energie-Schweif; Schulter bzw. Faustmitte im Fadenkreuz, `min_margin ≥ 115 px`)
    - `art_source/rigs/core_warden_arms_R2.png` (**S2 rechts**: 6 Zwischen-/Schadens-Posen, Schulterring im Fadenkreuz, `min_margin ≥ 34 px`)
    - `art_source/rigs/core_warden_arms_L2.png` (**S2 links**: 6 Zwischen-/Schadens-Posen mit Licht links-oben, Schulterring im Fadenkreuz, `min_margin ≥ 46 px`)
    - `art_source/rigs/core_warden_heads2.png` (**S5**: Visier-Laser, Blick links/rechts, brüllend Phase 2, stark beschädigt < 15 % HP mit zerbrochenem Halo, Blinzeln/Visier zu; Halsgelenk im Fadenkreuz, `min_margin ≥ 36 px`)
    - `art_source/rigs/core_warden_arms_R3.png` (**S6 rechts**: Phase-2-Angriffsposen ohne Faust mit leuchtender Manschette, Schulterring im Fadenkreuz, `min_margin ≥ 64 px`)
    - `art_source/rigs/core_warden_arms_L3.png` (**S6 links**: Phase-2-Angriffsposen ohne Faust mit Licht links-oben, Schulterring im Fadenkreuz, `min_margin ≥ 63 px`)
