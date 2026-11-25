# Game Design Document (GDD): *STARLIGHTER*

> **Stand:** Version 1.1 (`main` — nach Meilenstein 7, Architektur-Split & Firebase Cloud-Save)  
> **Kurzpitch:** Ein **Cozy Retro-Sci-Fi Action-RPG & Shop-Management-Spiel** im Browser, inspiriert von *Moonlighter 1*. Bei Tag führst du deinen eigenen Bergungs- und Relikt-Shop (*Astro-Barter*) auf der Frontier-Raumstation *Port Solaris* — bei Nacht (oder auf Expedition) plünderst du prozedurale Raumschiff-Wracks, Kristall-Nebel, Solar-Gießereien, Ältesten-Monolithen und instabile Dimensions-Rifts nach wertvoller Technologie.

---

## 1. Visuelle Vision, Kernregeln & Architektur-Prinzipien

- **Stil:** Warme, lebendige 16-Bit/32-Bit-HD-Pixel-Art (`960×540` Canvas-Buffer bei 2× über `480×270` Logik-Koordinaten, `image-rendering: pixelated`) im Stil von *Moonlighter* — gebürstetes Metall, warme Holzakzente, Holo-Anzeigen, Sternennebel und dynamischer Licht-/Glow-Layer.
- **Unverrückbare Gameplay-Regeln (Design-Invariants):**
  1. **Zero-Dungeon-Credits-Regel:** Spieler erhalten **niemals** direkt Credits aus Dungeons/Gegnern (`state.credits +=` ist in `DungeonScene.ts`, `enemyAi.ts` und `dungeonRenderer.ts` strikt verboten). Reichtum entsteht ausschließlich durch **Relikt-Verkäufe in *Astro-Barter***, Bounties und Handel.
  2. **Alles In-Game integriert:** Keine externen Menüs — Cloud-Save, Rangliste, Musik-Jukebox, Begleiter-Dock, Schmiede, Prägungen und Sektor-Wahl sind als begehbare Stationen/Terminals direkt in der Spielwelt verankert.
  3. **Extraktions-Risiko:** 20 Cargo-Slots im Rucksack (Verlust bei 0 HP, außer durch *Warp-Anker* gerettet), sichere Lagertruhen im Shop/Quartier (28 / 36 / 48 Slots) und richtungsabhängige Cargo-Synergien (`→`, `↑`, `▲`, `←`).
  4. **Saubere Plattform-Unterstützung:** Maus+Tastatur, Touch-Controls (Portrait & Landscape) und nativer HTML5-Gamepad-Support (`InputManager.pollGamepad()`).

---

## 2. Core Gameplay Loop

```mermaid
flowchart LR
    A["Raumhafen Port Solaris (Docks I–IV & 5. Tor)"] --> B["Prozeduraler Sektor / Rift / ∞ Spirale"]
    B --> C{"Risiko-Entscheidung"}
    C -- "Tiefer vordringen" --> D["Neue Gegner-Varianten, Rift-Risse & Bosse"]
    D --> C
    C -- "Warp-Beacon / Extraktion" --> E["Sichere Rückkehr zu Port Solaris"]
    C -- "Besiegt (0 HP)" --> F["Not-Teleport: Fracht verloren (außer Warp-Anker)"]
    F --> E
    E --> G["Astro-Barter öffnen: Relikte auf Holo-Podesten verkaufen"]
    G --> H["Kunden-Reaktionen, Scan-Codex, VIPs & Diebe"]
    H --> I["Upgrades (MK-VIII), 🔥 Prägungen, Begleiter & Shop-Ausbau"]
    I --> A
```

---

## 3. Welt, Sektoren & Modi (Alle Live)

| Bereich / Sektor | Thema & Zugang | Ebenen & Endboss | Status |
| :--- | :--- | :--- | :--- |
| **Astro-Barter & Kapitäns-Quartier** | Dein Laden (Stufe I–III, 4→6→8 Podeste, Sale-Box, Handels-Droide) + privates Hinterzimmer (Ruhekapsel, Truhen, Jukebox, Drohnen-Dock, Anzug-Stile, Trophäen) | Shop-Management, VIP-Events, Diebe fangen, Bounties | ✅ **Live** |
| **Port Solaris Promenade** | Zentraler Hub: *Kael's Exo-Schmiede* (MK-VIII & 🔥 Prägungen), *Dr. Lyra's Med-Bay*, *Vex' Tech-Labor*, *Nyx' Schwarzmarkt* & **★ Galaktische Kapitäns-Tafel** (Firebase Scoreboard & Cloud-Save) | NPC-Upgrades, Cloud-Sync, Ranglisten | ✅ **Live** |
| **Port Solaris Raumhafen** | 4 angedockte Schiffe (Docks I–IV) + zentrales **5. Tiefenraum-Tor** mit 4 leuchtenden Sektor-Siegeln | Sektor-Wahl & 5.-Tor-Auswahl | ✅ **Live** |
| **Sektor 1: Verlassene Korvette** | Dock I · Überwucherte Metalldecks → Reaktor-Glut | 3 Ebenen: *Schott-Brecher MK-II* → *Core-Wächter MK-IV* → **A.E.G.I.S. LEVIATHAN** | ✅ **Live** |
| **Sektor 2: Kristall-Nebel** | Dock II · Violett-Cyan Kristallkavernen | 3 Ebenen: *Quarz-Koloss* → *Prisma-Weberin* → **★ PRISMA-ARCHON** | ✅ **Live** |
| **Sektor 3: Solar-Gießerei** | Dock III · Lava-Schluchten & Schmelzöfen | 3 Ebenen: *Schlacken-Koloss* → *Gießerei-Meister* → **★ VULKAN-TITAN** | ✅ **Live** |
| **Sektor 4: Ältesten-Monolith** | Dock IV · Obsidian-Astral-Kammern | 3 Ebenen: *Chrono-Wächter* → *Monolith-Koloss* → **★ DER STERNEN-ARCHON** | ✅ **Live** |
| **5. Tor: Omega-Anomalie** | Zentrales 5. Tor (ab 4/4 Schlüsseln) | Elite-Prüfung → **★ OMEGA STERNEN-ARCHON** → Story-Finale & **New Game+** | ✅ **Live** |
| **5. Tor: ∞ Unendliche Spirale** | Zentrales 5. Tor (ab Omega-Sieg) | Endlos-Ebenen (`E1 → ∞`), wechselnde Sektor-Echos, 4 Rift-Mutatoren, Bosse alle 3 Ebenen, Singularitäts-Relikte | ✅ **Live** |
| **🌀 Instabile Rift-Risse** | Zufällige Portale in gesäuberten Kampfräumen (S1–S4) | 2-Wellen-Elite-Anomalie → garantierter **Rift-Katalysator**, Anomalie-Relikt & Schatztruhe | ✅ **Live** |

---

## 4. Aktueller Projekt- & Meilenstein-Status

### ✅ Abgeschlossene Meilensteine (Phase 1 + Start Phase 2)

- **✅ Meilenstein 1 — Kern-Prototyp & HD-Look:** 60-FPS-Canvas-Engine (`960×540`), Web-Audio-Synth, Mobile-Touch, *Astro-Barter* mit Holo-Podesten, 4 Kunden-Preisreaktionen, Scan-Codex, Port Solaris Promenade, erste 3 Waffenklassen.
- **✅ Meilenstein 2 — Shop-Tiefe, Tag/Nacht & Skill-Kampf:** 3 Shop-Ausbaustufen, Sale-Box, offener Tresenzugang, Weltraum-Diebe, Bounties, Tag/Nacht-Zyklus (+35 % Nacht-Loot), Cargo-Synergien & Hex-Aegis-Schild mit Perfekt-Parade.
- **✅ Meilenstein 3 — Vollständiger Sektor 1, Hinterzimmer & Tech-Labor:** `BackroomScene`, 3 Ebenen + 3 Bosse (inkl. *A.E.G.I.S. Leviathan*), 4. Waffe (*Ionen-Speer*), MK-V Upgrades & *Vex' Tech-Labor* (3 passive Module).
- **✅ Meilenstein 4 — Atmosphäre, 2 neue Waffen, Begleiter & Raumhafen:** Retro-Synth-Jukebox, *Kinetik-Fäuste* & *Phasen-Diskus*, 4 Begleiter-Drohnen (*Puck*, *Spark*, *Luma*, *Halo*), *Nyx' Schwarzmarkt*, Handels-Droide, VIP-Tagesevents, `HangarScene` mit 4 Docks & 5. Tor, Material-Merkliste (`📌`), ebenenspezifische Gegner-Varianten, interaktive 8-Slot-Truhen, Schluchten & geheime Fallgruben-Schatzkammern.
- **✅ Meilenstein 5 — Sektor 2 (*Kristall-Nebel*) & MK-VI:** Dock II (*Kristall-Kreuzer*), 5 neue Gegner, 3 Bosse (inkl. *Prisma-Archon*), 8 Sektor-2-Relikte & MK-VI Kristall-Meister-Ausrüstung.
- **✅ Meilenstein 6 — Sektoren 3 & 4, 5. Omega-Tor, Endgame & QoL:** *Solar-Gießerei* (MK-VII), *Ältesten-Monolith* (MK-VIII), *Omega-Anomalie* + Story-Finale + New Game+, 5 Anzug-Farbschemata & Auren, Logbuch-Erfolge, Savegame-JSON-Export/Import & Gamepad-Support.
- **✅ Firebase Cloud-Save & Galaktische Kapitäns-Tafel:** Direkt auf der Port-Solaris-Promenade (`prop_scoreboard.png`) mit Google- & E-Mail/Passwort-Login, automatischem Handy↔PC Cloud-Sync (Save v8, `starlighter-15b1f`, abgesichert via `firestore.rules`), Live-Expeditionstimer (`⏱ mm:ss`), Tag/Nacht-Rekordtracking, Live-Aktivitäts-Feed & Rangliste.
- **✅ Meilenstein 10-B (vorgezogen) — Architektur-Split & Code-Splitting:** Aufspaltung von `DungeonScene.ts` in `src/dungeon/dungeonTypes.ts`, `src/dungeon/enemyAi.ts` und `src/dungeon/dungeonRenderer.ts` + Vite-Chunk-Splitting (`index`, `dungeon`, `firebase`) in `vite.config.ts`.
- **✅ Meilenstein 7 — Rift-Endgame, Elementar-Prägungen & ∞ Unendliche Spirale:**
  - 4 aktive Waffen-Prägungen bei Kael (`🔥 Solar-Brand`, `❄️ Kryo-Stasis`, `⚡ Ionen-Kette`, `🟣 Leeren-Siphon`) für alle 6 Waffenklassen.
  - 4 neue HD-Rift-Relikte (*Rift-Katalysator*, *Phasen-Geode*, *Äther-Prismakern*, *Singularitäts-Relikt*).
  - Instabile `🌀 RIFT-RISS`-Portale in regulären Sektoren (2 Elite-Wellen + garantierter Katalysator).
  - Endlos-Modus **∞ Die Unendliche Spirale** am 5. Tor mit 4 Rift-Mutatoren (`⚡ Überladen`, `🛡 Gepanzert`, `🩸 Vampirisch`, `💨 Beschleunigt`), skalierenden Bossen alle 3 Ebenen, eigenem Ranglisten-Filter (`🌀 Tiefster Rift`) & 2 neuen Erfolgen (*Elementar-Schmied* & *Spiral-Läufer*, gesamt 12).

---

## 5. Nächste Schritte — Offene Phase-2-Roadmap (Meilensteine 8–10)

### 🔜 Meilenstein 9 (Empfohlener nächster Schritt): Galaktisches Netzwerk & Lebendige Community
Nutzt die bereits aktive Firebase-Anbindung (`starlighter-15b1f`), um das Online-Erlebnis noch lebendiger direkt im Spiel zu machen:
1. **Geister-Kapitäne als Kunden in deinem Shop:** Angemeldete Spieler aus Firestore (`leaderboard`) besuchen regelmäßig mit ihrem Kapitäns-Namen und ihrem Anzug-Farbschema deinen *Astro-Barter*-Laden, zahlen +10 % Gilden-Trinkgeld und hinterlassen kleine Grüße.
2. **Wöchentliche „Galaktische Prüfung“ (Seeded Challenge Run):** Deterministischer Wochen-Seed (`YYYY-Www`) am 5. Tor mit identischem Layout und normierter Ausrüstung für faire Vergleiche zwischen Neulingen und NG+-Veteranen + eigene Wochen-Rangliste & Gilden-Abzeichen.
3. **Klickbare Kapitäns-Akten:** Klick auf einen Eintrag in der Kapitäns-Tafel zeigt Detailprofil (Lieblingswaffe + Prägung, alle 5 Sektor-Bestzeiten, schnellste Tage, tiefster Rift, Erfolge).
4. **Globale Markt-Konjunktur:** Deterministischer weltweiter Tages-Wirtschaftstrend (z. B. *„Kristall-Boom: S2-Relikte +25 %“*), sichtbar an der Kapitäns-Tafel und im Scan-Codex.

### 🔜 Meilenstein 8: Händler-Gilde, Verhandeln & Port-Solaris-Marktplatz
Vertieft die gemütliche *Moonlighter*-Shop-Hälfte auch fürs Late-Game:
1. **Verhandlungs-System („Feilschen“):** Optionales 2-Runden-Gegenangebot bei VIP- und Boss-/Anomalie-Relikt-Verkäufen (+15 % bis +40 % Profit bei gutem Gespür).
2. **Stammkunden-Ruf (3–4 Named NPCs):** Wiederkehrende Charaktere (*Admiral Vance*, *Kuratorin Zora*, *Schmuggler Rix*, *Ingenieurin Tala*) mit eigenen Dialogen, 3 Rufstufen, exklusiver Shop-Deko & Großaufträgen.
3. **Port-Solaris-Erweiterung („Marktplatz-Terrasse“):** Separater begehbarer Bereich neben der Promenade mit **Milo's Alchemie-Bar** (Run-Buffs aus überschüssigen Sektor-Materialien) und **Solaris-Handelsbank** (Handelsrouten-Investments über 2–4 Tag/Nacht-Zyklen).
4. **Shop-Komfort (QoL):** `[F]` Schnell-Nachfüllen an Podesten zum Scan-Codex-Optimalpreis + Tagesbilanz-Abschlusskarte am Schichtende.

### 🔜 Meilenstein 10-A: Story-Tiefe, Sektor-Rätsel & Audio-/Mobile-Feinschliff
1. **Fortschreitende NPC-Dialogkapitel & visuelle Stations-Entwicklung** auf Port Solaris nach jedem Boss-/Omega-Sieg.
2. **Sektor-spezifische Raum-Mechaniken:** Reflektierende Kristall-Prismen (S2), periodische Schmelz-Düsen/Magnetplatten (S3), paarweise Astral-Teleporter-Pads (S4).
3. **Boss-Phase-2-Musik-Steigerung** in der Web-Audio-Engine + anpassbare Touch-Button-Größe / optionaler Mobile-Aim-Assist.

---

## 6. Codebase- & Dateikarte (für schnelle Orientierung)

```text
src/
├── main.ts                     # Haupt-Game-Loop, Szenenwechsel, Firebase Auto-Sync-Hook
├── types.ts                    # Zentrale Typen (SaveData v8, CaptainRecords, InfusionId, RiftMutatorId …)
├── assets/
│   ├── artLoader.ts            # HD-Pixel-Art Preloader (public/art/**)
│   └── pixelArt.ts / sprites.ts
├── data/
│   ├── items.ts                # 46 Relikte (S1–S4 + 4 Rift-Relikte) & Loot-Tables
│   ├── upgrades.ts             # 6 Waffenklassen bis MK-VIII, Suit, Med-Bay, Shop, Tech-Labor
│   ├── infusions.ts            # 4 Elementar-Prägungen & 4 Rift-Mutatoren
│   └── companions.ts           # 4 Begleiter-Drohnen, 5 Anzug-Stile, 12 Erfolge, Events, Jukebox
├── dungeon/
│   ├── dungeonTypes.ts         # Enemy, BossState, Projectile, LightningArcFx, SiphonOrbFx …
│   ├── enemyAi.ts              # DungeonEnemyAi (inkl. Burn-DoT, Kryo-Slow, Hasted & alle Bosse)
│   └── dungeonRenderer.ts      # DungeonRenderer (S1–S4, Rift-Risse, Blitze, Orbs, Minimap, Timer)
├── scenes/
│   ├── DungeonScene.ts         # Kampf, Waffen-Combos, Prägungen, Rift-Kammern, ∞ Spirale
│   ├── ShopScene.ts            # Astro-Barter Verkauf, Kunden-KI, Diebe, Handels-Droide
│   ├── BackroomScene.ts        # Kapitäns-Quartier (Schlaf, Truhen, Jukebox, Drohnen, Stile)
│   ├── HubScene.ts             # Port Solaris Promenade (Kael, Lyra, Vex, Nyx, Kapitäns-Tafel)
│   └── HangarScene.ts          # Raumhafen (Docks I–IV & 5. Tiefenraum-Tor)
├── services/
│   ├── firebaseConfig.ts       # Öffentliche Web-App-Config (starlighter-15b1f)
│   └── firebaseService.ts      # Auth (Google + E-Mail), Cloud-Save, Leaderboard & Activity Feed
├── systems/
│   ├── gameState.ts            # Zentraler State, Save/Load v8, Rekorde, Prägungen, Auto-Sync
│   ├── economy.ts              # Scan-Codex, Preisreaktionen & Nachfrage-Decay
│   └── inventory.ts            # Cargo, Truhe & richtungsabhängige Synergien
├── ui/
│   └── UIManager.ts            # HUD & alle In-Game-Modals (Inventar, Schmiede/Prägungen, Tafel …)
└── world/
    └── dungeonGen.ts           # Prozedurale Sektor-Ebenen, Schluchten, Geheimkammern, Rifts & ∞ Spirale
```

- **Build & Deploy:** `npm run build` (`tsc && vite build`), Push auf `main` triggert automatisches Vercel-Deployment.
- **Art-, Sprite- & UI-Design-Guide:** [ART_AND_DESIGN_GUIDE.md](ART_AND_DESIGN_GUIDE.md) (Prompt-Formeln, Flood-Fill-Freistellung, Farbpaletten & UI-Regeln für gleichbleibende HD-Pixel-Art-Qualität).
- **Test- & Verifikations-Workflow:** [TESTING_AND_VERIFICATION.md](TESTING_AND_VERIFICATION.md) (Build-Checks, Design-Invarianten, Headless-Chrome-CDP-Harness, Screenshot-QA & bekannte Stolperfallen).
- **Firestore-Regeln:** [firestore.rules](firestore.rules) (Owner-only `saves/{uid}`, Public-Read/Owner-Write `leaderboard/{uid}`, Public-Read/Auth-Create `activities`).
