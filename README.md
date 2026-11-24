# STARLIGHTER

Ein **Cozy Retro-Sci-Fi Action-RPG & Space-Shop-Spiel** im Browser, inspiriert von *Moonlighter 1*.

Bei Tag betreibst du deinen Relikt- und Bergungsladen **Astro-Barter** auf der Frontier-Raumstation **Port Solaris** – bei Nacht (oder auf Expedition) plünderst du in **Sektor 1: Verlassene Korvette** prozedurale Raumschiff-Wracks nach wertvollen Alien-Relikten.

## Features

- **Vierteiliger Moonlighter-Gameplay-Loop:**
  - **Lebendiger Space-Shop (*Astro-Barter*):** Stufenweise **Shop-Vergrößerung (Stufe I → II → III)** mit **4 → 6 → 8 Holo-Podesten**, automatischer **Sonderangebots-Kiste (Sale-Box)** ab Stufe II, **Handels-Droide (MK-I Auto-Kasse & MK-II Dieb-Stasis)** hinter dem Tresen, **goldenen VIP-Sammlern (+40 % Relikt-Bonus)**, **Tages-Events** (*Solaris Handelsmesse*, *VIP-Sammler-Besuch*, *Schmuggler-Ansturm*), **Weltraum-Dieben**, **Auftrags-Pinnwand** & **Scan-Codex**.
  - **Privates Hinterzimmer (*Kapitäns-Quartier & Lager*):** Eigener Raumzugang oben links im Shop mit **Chrono-Ruhekapsel (Tag ↔ Nacht)**, **Drohnen-Dockstation (4 freischaltbare Begleiter-Bots)**, **Sternen-Jukebox (Retro-Synth Soundtrack)**, mitwachsenden **Lagertruhen (28 → 36 → 48 Slots)**, **Waffen-Ständer** und **Sektor-1-Trophäen-Sockel**.
  - **Atmosphärische Retro-Synth-Musik:** Prozeduraler Web-Audio-Soundtrack mit 5 eigenen Zonen- & Boss-Themes (`Tag-Shop`, `Nacht-Quartier`, `Port Solaris`, `Sektor 1`, `Boss-Alarm`), separatem Musik-Schalter (`M`) und Jukebox-Wahl im Hinterzimmer.
  - **Stations-Promenade (*Port Solaris*):** Begehbare Frontier-Promenade mit **Kael's Exo-Schmiede** (6 Waffenklassen & Anzug bis **MK-V**), **Dr. Lyra's Med-Bay**, **Nyx' Schwarzmarkt** (täglich rotierende seltene Crafting-Teile), **Vex' Tech-Labor** (3 passive Module) und dem Sektor-1-Warp-Gate.
  - **Vollständiger Sektor 1 (*Verlassene Korvette* — 3 Ebenen & 3 Bosse):** Ebene I (**Schott-Brecher MK-II**) → Ebene II (**Core-Wächter MK-IV**) → Ebene III (**A.E.G.I.S. LEVIATHAN**).
- **6 Moonlighter-Waffenklassen bis MK-V (bei Schmied Kael):**
  - **Plasma-Klinge** (+ Hex-Aegis Kinetik-Schild & Perfekt-Parade), **Ionen-Speer** (+ Lanzen-Vorstoß), **Kinetik-Fäuste** (blitzschnelle 4er-Kombo + Kometen-Sprung mit Schildbruch), **Phasen-Diskus** (abprallender Bumerang-Diskus + Magnet-Rückruf / Klingen-Orbit), **Puls-Blaster** (+ Durchschuss-Laser) & **Grav-Hammer** (+ 360°-Schockwelle).
- **4 Freischaltbare Begleiter-Bots (*Familiars* — am Drohnen-Dock):**
  - **Sammel-Bot „Puck“** (15 Verkäufe oder Shop Stufe II → 2,6× Loot-Magnet & +8–15 Cr Bonus), **Kampf-Bot „Spark“** (Breacher + 30 Gegner → Auto-Plasma-Schütze), **Heil-Bot „Luma“** (Core-Wächter → +10 HP alle 2 Kampfräume & +15 % EN-Regen), **Aegis-Bot „Halo“** (Leviathan besiegt → absorbiert alle 12 Sek. 1 Treffer komplett!).
- **Taktischer Cargo-Rucksack & Extraktions-Risiko:**
  - 20-Slot Expeditions-Rucksack + 28/36/48-Slot sichere Lagertruhen im Hinterzimmer mit Cargo-Synergien (**Warp-Anker**, **Klon-Matrix**, **Resonanz**, **Phasen-Fluch**).
- **HD-Pixel-Art (`960×540`) & Mobile-Steuerung:** Hochauflösende Pixel-Art-Hintergründe & Sprites, responsiver virtueller Analog-Stick + kontextsensitive Touch-Buttons, Web Audio Synth & automatisches Speichern (`localStorage`).

## Steuerung

| Aktion | Tasten / Touch |
| :--- | :--- |
| Bewegen | `W A S D` / Pfeiltasten / Virtueller Stick |
| Jetpack-Dash (Ausweichen) | `Leertaste` / `Shift` / `DASH` |
| Aktive Waffe (Angriff) | `Linksklick` / `J` / Waffen-Button |
| Spezial (Schild / Komet / Rückruf / Lanze / Laser / Schock) | `Rechtsklick` / `K` / Spezial-Button |
| Waffe wechseln (2. Slot) | `C` / `WECHSELN` |
| Interagieren / Shops / Kasse | `E` / `Enter` / `AKTION` |
| Laden öffnen / schließen | `O` (im Shop) |
| Stimpack (Heilen) | `Q` / `HEIL` |
| Fracht, Truhe & Scan-Codex | `I` oder `Tab` |
| Warp-Beacon (Extraktion) | `R` gedrückt halten / `WARP` |
| Musik an / aus | `M` |

## Lokal starten

```bash
npm install
npm run dev
```

Für einen Produktions-Build:

```bash
npm run build
```
