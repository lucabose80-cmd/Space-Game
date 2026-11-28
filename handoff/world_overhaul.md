# Status-Blatt: Welt-Überarbeitung (Story · Port Solaris · Laden · Quartier · Cutscenes)

> Besitzer: Claude Code (Chat „Story & Maps Überarbeitung“), seit 2026-11-28.

## Entscheidungen des Inhabers (2026-11-28)
1. **Keine Portale auf der Station**: nur Türen/Schleusen/Aufzüge (Portale bleiben nur für Dungeon-Tore). Laden-Ausgang = Schleusentür passend zur Tür auf Port Solaris; Hangar bekommt einen Zugang statt 2 Portalen; Hub-Portal rechts entfällt.
2. **Laden = Intro-Look als Basis** (Holo-Vitrinen, Sternenlampe aus `cutscene_intro_3.png`); Stufe 2/3 füllen/veredeln die Vitrinen. `shop_bg_t2/t3` werden neu erzeugt.
3. **Phasen**: P1 Verankerung/Schatten + Portale→Türen · P2 Laden-Stufen · P3 Quartier-Stufen (Drohnen etc. erst ab Stufe 2 freischalten) · P4 Port Solaris entwickelt sich mit Story (Gebäude hinter Story/Dungeon-Events, animierte Upgrades, Läden je Stufe) · P5 Story-Überarbeitung inkl. Gehilfin/Mitglieder · P6 Cutscene-Anflug an Station + Intro angleichen.

## Checkliste
- [ ] P1a Props verankern (Scoreboard, Truhen, Kristall/Trophäen, Hangar-Pad): Schatten an echter Sprite-Unterkante
- [ ] P1b Portale → Türen/Schleusen (Hub, Hangar, Laden)
- [ ] P2 … P6 (siehe oben)

## Praxis-Learnings
1. Portale sind **in die Hintergrund-PNGs eingebacken** (`hub_bg`, `hangar_bg`, `shop_bg*`) → Entfernen = Hintergrund neu erzeugen/übermalen (`npm run art:gen`), nicht nur Code.
