# Startscreen & Account-Einstieg (`title_screen`)

**Besitzer:** frei — Umsetzung live, wartet auf Abnahme im echten Spiel (und optionales Key-Art `P3-55`)
**Ziel:** Atmosphärischer Pixel-Art-Startscreen im Stil von *STARLIGHTER*, direktes Konto erstellen/verknüpfen (Google & E-Mail + automatischer Cloud-Save-Abgleich auf dem Startscreen), sanfter Übergang in die Spielstart-Cutscene (`intro_arrival`) sowie eine neue, knackige Rückkehr-Animation beim „Weiterspielen“ einer bestehenden Welt.

## Checkliste
- [x] **T1 · Claim & Sprite-Bestellung (`P3-55`):** `public/art/sprites/title_bg.png` als optionales Key-Art in `artLoader.ts` (`CUTSCENE_OPTIONAL_SPRITES.titleBg`) + `SPRITE_QUEUE.md` (`P3-55`) eingetragen; hochwertiger Live-Fallback über `cutsceneBgSolaris*` (+ Wachstum G1/G2) & animiertes Expeditions-Schiff aktiv, solange `title_bg.png` fehlt.
- [x] **T2 · Live-Canvas-Backdrop (`src/scenes/TitleBackdrop.ts`):** Animierter 16:9-Pixel-Art-Hintergrund auf dem Spiel-Canvas während `titleVisible` (Sternenfeld, Sternschnuppen, pulsierende Stationslichter auf Port Solaris, sanft vorbeiziehendes Expeditions-Schiff passend zum Fortschritt).
- [x] **T3 · Neuer Startscreen + Cloud-Konto-Panel (`src/ui/TitleScreen.ts` + `src/style.css`):**
  - Transparentes, luftiges Layout über dem Live-Artwork (Logo, kompakter Untertitel, Welt-Vorschau beim Weiterspielen: Kapitän, Tag, Tag/Nacht, Credits, 4+1 Sektor-Juwelen, NG+).
  - Direktes Cloud-Konto-Panel am Startscreen: **Google-Login**, **E-Mail-Login**, **Neues Konto erstellen** (mit Kapitänsname), **Cloud-Stand laden/sichern**, **Abmelden** & **Cloud-Sync-Status**.
  - `firebaseService.onAuthChange` in `src/main.ts` aktualisiert den Startscreen live (`ui.refreshTitle()`) und lädt Cloud-Spielstände auch dann, wenn noch kein lokaler Spielstand existiert (`!this.state.hasSave() || isCloudSaveAhead(...)`).
  - Inline-Sicherheitsabfrage bei „Neues Spiel“, falls bereits ein Spielstand existiert; Kapitänsname bleibt beim Neustart erhalten.
  - Einklappbare Steuerungs-Übersicht (`⌨ Steuerung`) + Ton-Schalter (`🔊/🔇`) in der Fußzeile.
- [x] **T4 · Saubere Übergänge & neue „Weiterspielen“-Startanimation (`src/scenes/ContinueIntroCutscene.ts`):**
  - **Neues Spiel:** Weiches Ausblenden des Startscreens (`.title-exiting`, 300 ms) → sanfte Aufblende in `intro_arrival` ohne Shop-Flackern.
  - **Weiterspielen:** Weiches Ausblenden des Startscreens → neue ~3-Sekunden-Anflug-Animation auf Port Solaris (Tag/Nacht-Stimmung, Kapitänsname, Tag-Banner, Fortschritt, jederzeit per Klick/Taste überspringbar, respektiert `shortCutscenes`) → weiche Blende direkt in *Astro-Barter*.
- [x] **T5 · Tests & visuelle Abnahme (`tests/t9_title_screen.cjs`):** Playwright-Test + visuelle Prüfung aller 4 Screenshots (`title_fresh.png`, `title_account_drawer.png`, `title_with_save.png`, `title_continue_cutscene.png`) + voller `npm run verify`.

## Praxis-Learnings
1. **Antigravity-Cloud-VM Bildgenerierung (2026-11-28):** `generate_image` meldete `resource_exhausted` (Quota für `gemini-3.1-flash-image` erschöpft) und `npm run art:gen -- --check-key` fand keinen Key. Lösung: `titleBg` in `CUTSCENE_OPTIONAL_SPRITES` registrieren + `P3-55` in `SPRITE_QUEUE.md` eintragen, und bis zur Lieferung den Live-Canvas-Backdrop auf Basis von `cutscene_bg_solaris*.png` + animiertem Schiff/Sternenfeld nutzen. Sobald `public/art/sprites/title_bg.png` liegt, wird es ohne Code-Änderung automatisch bevorzugt.
2. **Bestehende Playwright-Tests:** Zahlreiche Tests (`t3`, `t4b`, `t4c`, `m10p*`, `m10cp*`) blenden den Startscreen direkt via `document.getElementById('title-overlay')?.classList.add('hidden'); g.ui.titleVisible = false;` aus. `#title-overlay`, `#btn-continue` und `#btn-new-game` bleiben als IDs erhalten; neue Tests müssen für automatische Erkennung durch `tests/run.cjs` mit `t<N>` beginnen (`t9_title_screen.cjs`).
3. **Backdrop-Zoom & Schiffs-Ausrichtung:** Beim Verschieben von `cutscene_bg_solaris` nach rechts (`panX = 24`) braucht der Zoom mind. `1.16`, sonst entsteht links eine sichtbare Kante. Die Schiffs-Sprites zeigen standardmäßig nach oben (`-90°`), daher braucht Anflug nach oben-rechts positive Rotation (`+0.54` bis `+0.72 rad`).
4. **Cloud-Login auf frischem Gerät:** `firebaseService.onAuthChange` lud früher nur bei `isCloudSaveAhead(...)`; mit `!this.state.hasSave() || isCloudSaveAhead(...)` wird auch ein Tag-1-Cloud-Spielstand beim Login am Startscreen zuverlässig auf ein neues Gerät heruntergeladen.
