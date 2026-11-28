# Startscreen & Account-Einstieg (`title_screen`)

**Besitzer:** Antigravity · Title-Screen-Chat (seit 2026-11-28)
**Ziel:** Atmosphärischer Pixel-Art-Startscreen im Stil von *STARLIGHTER*, direktes Konto erstellen/verknüpfen (Google & E-Mail + automatischer Cloud-Save-Abgleich auf dem Startscreen), sanfter Übergang in die Spielstart-Cutscene (`intro_arrival`) sowie eine neue, knackige Rückkehr-Animation beim „Weiterspielen“ einer bestehenden Welt.

## Checkliste
- [ ] **T1 · Claim & Sprite-Bestellung (`P3-55`):** `public/art/sprites/title_bg.png` als optionales Key-Art in `artLoader.ts` (`TITLE_OPTIONAL_SPRITES`) + `SPRITE_QUEUE.md` (`P3-55`) eingetragen; hochwertiger Live-Fallback über `cutsceneBgSolaris` (+ Wachstum G1/G2) & Raumschiff-Animation aktiv, solange `title_bg.png` fehlt (Antigravity-Bild-Quota erschöpft + kein lokaler `GEMINI_API_KEY` in dieser VM).
- [ ] **T2 · Live-Canvas-Backdrop (`src/scenes/TitleBackdrop.ts`):** Animierter 16:9-Pixel-Art-Hintergrund auf dem Spiel-Canvas während `titleVisible` (Sternenfeld, Sternschnuppen, Nebel-Schimmer, pulsierende Stationslichter auf Port Solaris, sanft vorbeiziehendes Expeditions-Schiff).
- [ ] **T3 · Neuer Startscreen + Cloud-Konto-Panel (`src/ui/TitleScreen.ts` + `src/style.css`):**
  - Edles, luftiges Layout, das das Artwork wirken lässt (Logo, kompakter Untertitel, Welt-Vorschau beim Weiterspielen: Kapitän, Tag, Tag/Nacht, Credits, Sektoren, NG+).
  - Direktes Cloud-Konto-Panel am Startscreen: **Google-Login**, **E-Mail-Login**, **Neues Konto erstellen** (mit Kapitänsname), **Abmelden** & **Cloud-Sync-Status**.
  - Wenn beim Login am Startscreen ein neuerer Cloud-Spielstand geladen wird, aktualisiert sich der Startscreen sofort (zeigt „Weiterspielen · Tag X · ☁ Cloud“).
  - Sicherheitsabfrage bei „Neues Spiel“, falls bereits ein lokaler/Cloud-Spielstand existiert.
  - Kompakte, einklappbare Steuerungs-Übersicht statt riesigem Textblock.
- [ ] **T4 · Saubere Übergänge & neue „Weiterspielen“-Startanimation (`src/scenes/ContinueIntroCutscene.ts`):**
  - **Neues Spiel:** Weiches Ausblenden des Startscreens → direkt und ohne Shop-Flackern in `intro_arrival`.
  - **Weiterspielen:** Weiches Ausblenden des Startscreens → neue ~3-Sekunden-Anflug-Animation auf Port Solaris (Tag/Nacht-Stimmung, Kapitänsname, Tag-Banner, aktueller Fortschritt, jederzeit per Klick/Taste überspringbar, respektiert `shortCutscenes`) → weiche Blende direkt in *Astro-Barter*.
- [ ] **T5 · Tests & visuelle Abnahme (`tests/title_screen.cjs`):** Playwright-Test + Screenshots von Startscreen (mit/ohne Save, Konto-Drawer offen), Übergang in `intro_arrival` und `ContinueIntroCutscene` + voller `npm run verify`.

## Praxis-Learnings
1. **Antigravity-Cloud-VM Bildgenerierung (2026-11-28):** `generate_image` meldete `resource_exhausted` (Quota für `gemini-3.1-flash-image` erschöpft) und `npm run art:gen -- --check-key` fand keinen Key. Lösung: `titleBg` in `TITLE_OPTIONAL_SPRITES` registrieren + `P3-55` in `SPRITE_QUEUE.md` eintragen, und bis zur Lieferung den Live-Canvas-Backdrop auf Basis von `cutscene_bg_solaris*.png` + animiertem Schiff/Sternenfeld nutzen. Sobald `public/art/sprites/title_bg.png` liegt, wird es ohne Code-Änderung automatisch bevorzugt.
2. **Bestehende Playwright-Tests:** Zahlreiche Tests (`t3`, `t4b`, `t4c`, `m10p*`, `m10cp*`) blenden den Startscreen direkt via `document.getElementById('title-overlay')?.classList.add('hidden'); g.ui.titleVisible = false;` aus. `#title-overlay`, `#btn-continue` und `#btn-new-game` müssen daher als IDs und mit genau dieser Semantik erhalten bleiben!
