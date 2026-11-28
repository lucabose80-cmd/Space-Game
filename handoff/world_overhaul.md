# Status-Blatt: Welt-Überarbeitung (Story · Port Solaris · Laden · Quartier · Cutscenes)

> Besitzer: Claude Code (Chat „Story & Maps Überarbeitung“), seit 2026-11-28.

## Entscheidungen des Inhabers (2026-11-28)
1. **Keine Portale auf der Station**: nur Türen/Schleusen/Aufzüge (Portale bleiben nur für Dungeon-Tore). Laden-Ausgang = Schleusentür passend zur Tür auf Port Solaris; Hangar bekommt einen Zugang statt 2 Portalen; Hub-Portal rechts entfällt.
2. **Laden = Intro-Look als Basis** (Holo-Vitrinen, Sternenlampe aus `cutscene_intro_3.png`); Stufe 2/3 füllen/veredeln die Vitrinen. `shop_bg_t2/t3` werden neu erzeugt.
3. **Phasen**: P1 Verankerung/Schatten + Portale→Türen · P2 Laden-Stufen · P3 Quartier-Stufen (Drohnen etc. erst ab Stufe 2 freischalten) · P4 Port Solaris entwickelt sich mit Story (Gebäude hinter Story/Dungeon-Events, animierte Upgrades, Läden je Stufe) · P5 Story-Überarbeitung inkl. Gehilfin/Mitglieder · P6 Cutscene-Anflug an Station + Intro angleichen.

## Checkliste
- [x] P1a Kontaktschatten: `drawContactShadow` (`pixelArt.ts`) misst die sichtbare Unterkante/Standbreite; angewandt auf Kapitäns-Tafel (Hub), Truhe & Pods (Dungeon). ⬜ noch offen: übrige Props/Drops/Kristall-Spire, Hangar-Schiffe prüfen, Nachtschicht-Look
- [x] P1b Portale → Airlock-Türen: `hub_bg`, `hangar_bg` (2 Portale → 1 Tür), `shop_bg`/`_t2`/`_t3` neu per art:gen; Originale in `art_source/_raw/*_portal_OLD.png`. ⬜ Hangar-Tür sitzt etwas „im Boden“ → ggf. neu in die Wand setzen; Hub-Beschriftung „Raumhafen →“ prüfen
- [ ] P2 … P6 (siehe oben)

## Praxis-Learnings
1. Portale sind **in die Hintergrund-PNGs eingebacken** (`hub_bg`, `hangar_bg`, `shop_bg*`) → Entfernen = Hintergrund neu erzeugen/übermalen (`npm run art:gen`), nicht nur Code.
2. Bild-Edit-Rezept: `art:gen --ref <bg.png> --aspect 16:9 --size 2K` mit Prompt „keep everything pixel-identical, ONE change only …“ → Layout bleibt erhalten, Ausgabe 2752×1536 → mit PIL LANCZOS auf 960×540 (Kollisionen/Prompts bleiben passend). 4 Hintergründe parallel in ~1 Min.
3. Screenshot-Skript für Szenen: `__game.transitionTo('hub'|'backroom'|'hangar'|'shop','hub')` + 1,8 s warten; Dungeon: `dng.startRun(1)`, `dng.enterRoom(key,null)` (rooms ist eine Map).
4. Push nur auf den Session-Branch (`git push origin HEAD`), nicht `npm run ship` (würde main pushen).
