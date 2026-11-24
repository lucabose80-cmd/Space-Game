# STARLIGHTER

Ein **Cozy Retro-Sci-Fi Action-RPG & Space-Shop-Spiel** im Browser, inspiriert von *Moonlighter 1*.

Bei Tag betreibst du deinen Relikt- und Bergungsladen **Astro-Barter** auf der Frontier-Raumstation **Port Solaris** – bei Nacht (oder auf Expedition) plünderst du in **Sektor 1: Verlassene Korvette** prozedurale Raumschiff-Wracks nach wertvollen Alien-Relikten.

## Features (Meilenstein 1 — MVP)

- **Dual-Gameplay-Loop:**
  - **Space-Shop (*Astro-Barter*):** 4 Holo-Podeste bestücken, Preise festlegen, Laden öffnen, Kunden-KI mit 4 Preis-Reaktionen (Spottbillig / Perfekt / Zu teuer / Wucher), Kassen-Verkauf, Marktnachfrage & **Scan-Codex** (automatische Preishistorie).
  - **Expedition (*Sektor 1: Verlassene Korvette*):** Prozeduraler Dungeon (Start-, Kampf-, Schatz- und Boss-Raum), laserverriegelte Luftschleusen, zerstörbare Frachtkapseln, 3 Gegnertypen (Void-Slime, Sicherheitsdrohne, Plasma-Turret) + Boss **Core-Wächter MK-IV**.
- **HD-Pixel-Art & Dynamische Beleuchtung (`960×540`):** Detailreiche Moonlighter-inspirierte Raumgrafiken für *Astro-Barter* und *Verlassene Korvette*, hochauflösende Pixel-Sprites für Held, Alien-/Astronauten-Kunden, Gegner, Core-Wächter MK-IV, Holo-Podeste, Truhen & alle 12 Relikte sowie Licht-/Partikeleffekte.
- **Echtzeit-Kampf & Game-Feel:** 3-Treffer-Plasma-Klingen-Kombo, Puls-Blaster, Jetpack-Dash mit Unverwundbarkeits-Frames & Nachbildern, Hit-Stop, Screen-Shake, dynamische Glow-Effekte.
- **Moonlighter-Inventar:** 5 geschützte Gürtel-Slots (bleiben bei 0 HP erhalten) + 15 Fracht-Slots + 28 Lagertruhen-Slots sowie Sci-Fi-Cargo-Modifikatoren (*Zerbrechlich*, *Warp-Anker*, *Schmuggler-Bonus*).
- **Progression & Audio:** Exo-Werkbank für 5 Upgrade-Pfade, synthetisierte Retro-Sci-Fi-Soundeffekte via Web Audio API und automatisches Speichern (`localStorage`).

## Steuerung

| Aktion | Tasten |
| :--- | :--- |
| Bewegen | `W A S D` oder Pfeiltasten |
| Jetpack-Dash (Ausweichen) | `Leertaste` / `Shift` |
| Plasma-Klinge (3er-Kombo) | `Linksklick` oder `J` |
| Puls-Blaster (Fernkampf) | `Rechtsklick` oder `K` |
| Interagieren / Podest / Kasse | `E` oder `Enter` |
| Laden öffnen / schließen | `O` (im Shop) |
| Stimpack (Heilen) | `Q` |
| Fracht, Truhe & Scan-Codex | `I` oder `Tab` |
| Warp-Beacon (Rückkehr) | `R` gedrückt halten |
| Ton an / aus | `M` |

## Lokal starten

```bash
npm install
npm run dev
```

Für einen Produktions-Build:

```bash
npm run build
```
