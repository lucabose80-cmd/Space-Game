# Status-Blatt: Welt-Überarbeitung (Story · Port Solaris · Laden · Quartier · Cutscenes)

> Besitzer: Claude Code (Chat „Story & Maps Überarbeitung“), seit 2026-11-28.

## Entscheidungen des Inhabers (2026-11-28)
1. **Keine Portale auf der Station**: nur Türen/Schleusen/Aufzüge (Portale bleiben nur für Dungeon-Tore). Laden-Ausgang = Schleusentür passend zur Tür auf Port Solaris; Hangar bekommt einen Zugang statt 2 Portalen; Hub-Portal rechts entfällt.
2. **Laden = Intro-Look als Basis** (Holo-Vitrinen, Sternenlampe aus `cutscene_intro_3.png`); Stufe 2/3 füllen/veredeln die Vitrinen. `shop_bg_t2/t3` werden neu erzeugt.
3. **Phasen**: P1 Verankerung/Schatten + Portale→Türen · P2 Laden-Stufen · P3 Quartier-Stufen (Drohnen etc. erst ab Stufe 2 freischalten) · P4 Port Solaris entwickelt sich mit Story (Gebäude hinter Story/Dungeon-Events, animierte Upgrades, Läden je Stufe) · P5 Story-Überarbeitung inkl. Gehilfin/Mitglieder · P6 Cutscene-Anflug an Station + Intro angleichen.

## Checkliste
- [x] P1a Kontaktschatten: `drawContactShadow` (`pixelArt.ts`) misst die sichtbare Unterkante/Standbreite; angewandt auf Kapitäns-Tafel (Hub), Truhe & Pods (Dungeon). ⬜ noch offen: übrige Props/Drops/Kristall-Spire, Hangar-Schiffe prüfen, Nachtschicht-Look
- [x] P1b Portale → Airlock-Türen: `hub_bg`, `hangar_bg` (2 Portale → 1 Tür), `shop_bg`/`_t2`/`_t3` neu per art:gen; Originale in `art_source/_raw/*_portal_OLD.png`. ⬜ Hangar-Tür sitzt etwas „im Boden“ → ggf. neu in die Wand setzen; Hub-Beschriftung „Raumhafen →“ prüfen
- [x] P1c Kompass-Hologramm → bündiges Boden-Medaillon (`hub_bg`); `drawSpriteFoot` (`hubEvolution.ts`) setzt die sichtbare Unterkante exakt auf den Fußpunkt + Kontaktschatten (`spriteFootBottom`); SaleBox, gelandete Kapsel ebenfalls
- [x] P2 Laden: Vitrinen je Stufe (`vitrine_t1..3`, `renderPedestal`), Intro-Look; ⬜ Sternenlampe/Schlüssel aus Intro-Panel als Deko, `shop_bg_t2` prüfen
- [x] Truhen: futuristische Panzer-Kiste (offen/zu), Glut solange Beute drin ist; ⬜ Öffnen-Animation (Deckel springt auf)
- [x] Offset-Audit erledigt (Hub-Props, Laden, Truhen, Pods, Kapsel, Marktterrasse). Rest: Quartier & Hangar-Schiffe sind in Hintergrund/Sprites verankert (geprüft, ok). Alt: Pods/Drops/Kristall-Spire/Backroom/Markt-Terrasse/Hangar-Schiffe (nächster Schritt: weitere `drawPixelShadow` neben `drawImage` auf `drawContactShadow` umstellen)
- [x] Marktterrasse komplett neu: `public/art/market_terrace_bg.png` + Sprites `market_bar/guild/bank.png` (vorher nur Rechtecke im Nichts); Deck-Grenzen an Geländer angepasst (`DECK_BOTTOM 186`), HUD-Hinweis für `market_terrace`; Hangar-Tür neu (Statuslicht, Schild).
- [x] **P3 Quartier in Stufen** (`upgrades.quartersTier` 0..2, Track „Quartier-Ausbau“ im Shop-Ausbau-Terminal: Stufe II 420 Cr + 3 scrap_coil + 1 alien_prism, Stufe III 1100 Cr + aegis_plate + 3 reactor_shard): Stufe 0 = Notkoje (Drohnen-Dock & Jukebox abgedeckt/gesperrt, nackter Trophäen-Sockel, `backroom_bg_t1.png`), Stufe 1 = bisheriges Quartier (`backroom_bg.png`), Stufe 2 = Flaggschiff-Suite (`backroom_bg_t3.png`). Alt-Saves ohne Feld: Begleiter/Sektor 1/Tag > 3 → Stufe 1. Test `world_p3_quarters`. ⬜ Trophäen-Vitrinen/Aura-Anpassung in Stufe 3, Quartier-Cutscene (aktuell generische Upgrade-Cutscene `shop`), Bett-/Matratzen-Visual je Stufe nur im Hintergrund
- [ ] P4 … P6 (siehe oben)

## Praxis-Learnings
1. Portale sind **in die Hintergrund-PNGs eingebacken** (`hub_bg`, `hangar_bg`, `shop_bg*`) → Entfernen = Hintergrund neu erzeugen/übermalen (`npm run art:gen`), nicht nur Code.
2. Bild-Edit-Rezept: `art:gen --ref <bg.png> --aspect 16:9 --size 2K` mit Prompt „keep everything pixel-identical, ONE change only …“ → Layout bleibt erhalten, Ausgabe 2752×1536 → mit PIL LANCZOS auf 960×540 (Kollisionen/Prompts bleiben passend). 4 Hintergründe parallel in ~1 Min.
3. Screenshot-Skript für Szenen: `__game.transitionTo('hub'|'backroom'|'hangar'|'shop','hub')` + 1,8 s warten; Dungeon: `dng.startRun(1)`, `dng.enterRoom(key,null)` (rooms ist eine Map).
4. Push nur auf den Session-Branch (`git push origin HEAD`), nicht `npm run ship` (würde main pushen).
5. Weiß → Alpha: `scripts/white-to-alpha.py <in> <out> <W> <H>` (Flood-Fill vom Rand, BBox, unten mittig). Paar-Sprites (zu/offen) mit gemeinsamem Maßstab zuschneiden (Truhe: Skala aus der geschlossenen Version).
6. Sprites mit Leerrand unten schweben optisch: immer `drawContactShadow`/`spriteFootBottom` statt fixer Schatten-Offsets.
7. **Hauptursache für „schwebende“ Props = falsche Kamera:** Gemini liefert Props standardmäßig isometrisch (Rautenboden). Der Raum (und alle Stationen/Trailer) sind **frontal mit leichter Draufsicht** → Prompt IMMER mit „FRONT view with a slight top-down tilt, flat HORIZONTAL bottom edge, NOT isometric/diamond“ + Referenzbilder aus dem Raum (Kisten/Vitrine aus `cutscene_intro_3.png` / `shop_bg.png`). Erste Vitrinen/Truhen (isometrisch) wurden deshalb verworfen (Rohdateien `vitrine_v*`, `chest_new_*`).
8. **Koordinaten der Szenen sind logisch 480×270 (Anzeige 2×):** Sprite-Zielgrößen in logischen px wählen (Spieler 24×28; Vitrine 32×42, Truhe 34×34), nicht in Screenshot-px.
9. Bodenverankerung = (a) frontale Kamera, (b) Sprite-Unterkante exakt auf Fußpunkt, (c) `drawContactShadow` (3 Lagen, breiter als die Standfläche, Alpha ~0.7), (d) Leuchten am Boden als flache Ellipse `drawFloorGlow` statt Kugel-`drawGlow`.
10. Vitrine: Ware schwebt IM Glaswürfel; Glas-Overlay (obere 56 % des Sprites, Alpha 0.28) wird über die Ware gelegt.
11. Hintergrund-Rezept für neue Szenen: Szene als 16:9-Bild mit Rahmen wie `hub_bg` erzeugen (Prompt: Layout in %-Angaben, „deck EMPTY where counters go“), Theken/Props separat als frontale Sprites auf Weiß (`scripts/white-to-alpha.py`-Logik), im Code zweigeteilt zeichnen (oberer Teil → NPC → unterer Teil), damit der NPC hinter der Theke steht. `gen-sheet.py` kennt kein Seitenverhältnis 2:1 (→ 3:2 nehmen).
12. Ausbaustufen eines Raums = je Stufe ein eigenes 16:9-Hintergrundbild aus dem Original per art:gen („keep layout pixel-identical, convert to <Variante>“) — Interaktionspunkte bleiben gültig. Gesperrtes Feature = sichtbar abgedeckt (Plane/LOCKED-Licht) + Prompt „🔒 … Stufe II“, nie unsichtbar.
