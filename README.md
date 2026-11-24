# STARLIGHTER

Ein **Cozy Retro-Sci-Fi Action-RPG & Space-Shop-Spiel** im Browser, inspiriert von *Moonlighter 1*.

Bei Tag betreibst du deinen Relikt- und Bergungsladen **Astro-Barter** auf der Frontier-Raumstation **Port Solaris** – bei Nacht (oder auf Expedition) plünderst du in **Sektor 1: Verlassene Korvette** prozedurale Raumschiff-Wracks nach wertvollen Alien-Relikten.

## Features

- **Vierteiliger Moonlighter-Gameplay-Loop:**
  - **Space-Shop (*Astro-Barter*):** Stufenweise **Shop-Vergrößerung (Stufe I → II → III)** mit **4 → 6 → 8 Holo-Podesten**, automatischer **Sonderangebots-Kiste (Sale-Box)** ab Stufe II, Kunden-KI mit 4 Preis-Reaktionen, Kassen-Abkassieren hinter dem Tresen, **Weltraum-Dieben** (per Dash schnappen für +35 Cr Kopfgeld!), **Auftrags-Pinnwand (Sonderaufträge / Bounties)** & **Scan-Codex**.
  - **Privates Hinterzimmer (*Kapitäns-Quartier & Lager*):** Eigener Raumzugang oben links im Shop mit **Chrono-Ruhekapsel (Tag ↔ Nacht)**, mitwachsenden **Lagertruhen (1 → 2 → 3 Truhen für 28 → 36 → 48 Slots)**, **Waffen-Ständer** und **Sektor-1-Trophäen-Sockel**!
  - **Echter Tag-/Nacht-Rhythmus:** Warmes Tageslicht beim Handeln vs. kosmische Nachtbeleuchtung auf **Port Solaris** & **Astro-Barter** — **Nacht-Expeditionen** erhöhen die Fundchance auf seltene & epische Relikte in Sektor 1 um **+35 %**!
  - **Stations-Promenade (*Port Solaris*):** Begehbare Frontier-Hub-Promenade mit **Kael's Exo-Schmiede** (4 Waffenklassen & Anzug bis Meister-Stufe **MK-V**), **Dr. Lyra's Med-Bay & Bio-Labor** (Med-Stimpacks & Nano-Vitalserum), **Vex' Tech-Labor** (3 passive Kampf-/Tempo-/Glücks-Module & Sektor-Fortschrittskarte) und dem Sektor-1-Warp-Gate (inkl. **Sektor-2-Schlüssel** nach Leviathan-Sieg!).
  - **Vollständiger Sektor 1 (*Verlassene Korvette* — 3 Ebenen & 3 Bosse):** Jeder Run startet klassisch auf **Ebene I** und bietet nach jedem Ebenen-Boss die Wahl zwischen **Gratis-Extraktion** oder dem **Tiefen-Aufzug**!
    - **Ebene I (*Frachtdeck*):** Void-Slime, Drohne, Scurry-Turret → Ebenen-Boss I: **Schott-Brecher MK-II**.
    - **Ebene II (*Überwuchertes Maschinen-Deck*):** Dampf-/Plasma-Ventile, **Schild-Drohne** (frontaler Kinetik-Schild) & **Sporen-Spucker** (platzende Sporen-Salven) → Ebenen-Boss II: **Core-Wächter MK-IV**.
    - **Ebene III (*Reaktor-Kern*):** Notfall-Medstation im Startraum → gigantischer Sektor-1-Endboss **A.E.G.I.S. LEVIATHAN** (top-verankerter Titan mit 2 artikulierten Riesen-Fäusten, Zwillings-Strahl, Trümmer-Hagel & Phase-2-Omega-Überlastung!).
- **Skill-basiertes Moonlighter-Waffensystem & Schmiede (4 Klassen bis MK-V):**
  - Start mit **1 ausgerüsteter Waffe** (*Plasma-Klinge* mit 3er-Kombo + **Hex-Aegis Kinetik-Schild**: verbraucht beim Halten aktiv Energie und überhitzt bei 0 EN, während präzise **Perfekt-Paraden** Projektile golden reflektieren & +16 EN schenken!).
  - Bei **Schmied Kael** 3 weitere Waffen schmieden: **Ionen-Speer** (schneller 3er-Stoß + durchbohrender **Lanzen-Vorstoß** mit i-Frames), **Puls-Blaster** (inkl. durchschlagendem Rail-Laser) & **Grav-Hammer** (inkl. 360°-Gravitations-Schockwelle) — bis zu 2 Waffen ausrüsten & im Kampf mit `C` wechseln.
  - Handanimierte 2.5D-Energiesicheln & Lanzen-Stöße, 3-Frame-Klingen-Nachbilder, sichtbare Kampfbereitschafts-Haltung, X-Slash-Treffereffekte, Hit-Stop & Screen-Shake.
- **Taktischer Cargo-Rucksack & Extraktions-Risiko:**
  - 20-Slot Expeditions-Rucksack + 28/36/48-Slot sichere Lagertruhen im Hinterzimmer mit richtungsabhängigen Cargo-Synergien & Flüchen: **Warp-Anker (→)**, **Klon-Matrix (↑)**, **Resonanz (←)**, **Phasen-Fluch (▲)**, *Zerbrechlich* & *Schmuggler-Bonus*.
  - Im Wrack mitgeführte Beute ist **erst nach Extraktion sicher** (Start-Warp, Warp-Beacon `R` oder Boss-Portal) — bei 0 HP geht die ungeschützte Rucksack-Beute verloren!
- **HD-Pixel-Art (`960×540`) & Mobile-Steuerung:** Hochauflösende Pixel-Art-Hintergründe (inkl. 3 Shop-Ausbaustufen & Kapitäns-Quartier) & Sprites, responsiver virtueller Analog-Stick + kontextsensitive Touch-Buttons (Hoch- & Querformat), Web Audio Synth & automatisches Speichern (`localStorage`).

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
