# STARLIGHTER

Ein **Cozy Retro-Sci-Fi Action-RPG & Space-Shop-Spiel** im Browser, inspiriert von *Moonlighter 1*.

Bei Tag betreibst du deinen Relikt- und Bergungsladen **Astro-Barter** auf der Frontier-Raumstation **Port Solaris** – bei Nacht (oder auf Expedition) plünderst du in **Sektor 1: Verlassene Korvette** prozedurale Raumschiff-Wracks nach wertvollen Alien-Relikten.

## Features

- **Dreiteiliger Moonlighter-Gameplay-Loop:**
  - **Space-Shop (*Astro-Barter*):** 4 Holo-Podeste bestücken, Preise festlegen, Laden öffnen, Kunden-KI mit 4 Preis-Reaktionen (Spottbillig / Perfekt / Zu teuer / Wucher), Kassen-Verkauf, **Shop-Ausbau-Terminal** (schwebende Holo-Laternen, VIP-Deko & Kassen-Scanner) & **Scan-Codex**.
  - **Stations-Promenade (*Port Solaris*):** Begehbare Frontier-Hub-Promenade mit **Kael's Exo-Schmiede** (neue Waffen schmieden & aufwerten), **Dr. Lyra's Med-Bay & Bio-Labor** (Med-Stimpacks & Nano-Vitalserum für Raum-Heilung & Energie-Regen), flanierenden Bewohnern und dem Sektor-1-Warp-Gate.
  - **Expedition (*Sektor 1: Verlassene Korvette*):** Prozeduraler Dungeon (Start-, Kampf-, Schatz- und Boss-Raum), laserverriegelte Luftschleusen, zerstörbare Frachtkapseln, dynamische Gegnertypen (springender Void-Slime, strafende Sicherheitsdrohne, mobiler Scurry-Turret) + 2-Phasen-Boss **Core-Wächter MK-IV** (3D-Orbit-Pylone, Raketen-Ramme, Schwerkraft-Sturz & schwenkender Kern-Laser).
- **Moonlighter-Waffensystem & Schmiede:**
  - Start mit **1 ausgerüsteter Waffe** (*Plasma-Klinge* mit 3er-Kombo + Kinetik-Schild-Parade).
  - Bei **Schmied Kael** neue Waffen schmieden: **Puls-Blaster** (inkl. durchschlagendem Rail-Laser) & **Grav-Hammer** (inkl. 360°-Gravitations-Schockwelle) — bis zu 2 Waffen ausrüsten & im Kampf mit `C` wechseln.
  - Handanimierte 2.5D-Energiesicheln, 3-Frame-Klingen-Nachbilder, sichtbare Kampfbereitschafts-Haltung, X-Slash-Treffereffekte, Hit-Stop & Screen-Shake.
- **Echtes Extraktions-Risiko:**
  - 20-Slot Expeditions-Rucksack + 28-Slot sichere Shop-Lagertruhe + Cargo-Modifikatoren (*Zerbrechlich*, *Warp-Anker*, *Schmuggler-Bonus*).
  - Im Wrack mitgeführte Beute ist **erst nach Extraktion sicher** (Start-Warp, Warp-Beacon `R` oder Boss-Sieg) — bei 0 HP geht die Rucksack-Beute verloren!
- **HD-Pixel-Art (`960×540`) & Mobile-Steuerung:** Hochauflösende Pixel-Art-Hintergründe & Sprites, responsiver virtueller Analog-Stick + kontextsensitive Touch-Buttons (Hoch- & Querformat), Web Audio Synth & automatisches Speichern (`localStorage`).

## Steuerung

| Aktion | Tasten / Touch |
| :--- | :--- |
| Bewegen | `W A S D` / Pfeiltasten / Virtueller Stick |
| Jetpack-Dash (Ausweichen) | `Leertaste` / `Shift` / `DASH` |
| Aktive Waffe (Angriff) | `Linksklick` / `J` / Waffen-Button |
| Spezial (Schild / Laser / Schock) | `Rechtsklick` / `K` / Spezial-Button |
| Waffe wechseln (2. Slot) | `C` / `WECHSELN` |
| Interagieren / Shops / Kasse | `E` / `Enter` / `AKTION` |
| Laden öffnen / schließen | `O` (im Shop) |
| Stimpack (Heilen) | `Q` / `HEIL` |
| Fracht, Truhe & Scan-Codex | `I` oder `Tab` |
| Warp-Beacon (Extraktion) | `R` gedrückt halten / `WARP` |
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
