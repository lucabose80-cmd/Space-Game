# Game Design Document (GDD): *STARLIGHTER*

> **Stand:** Version 1.2 (nach Meilenstein 9 — Galaktisches Netzwerk, Save v10)  
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
  - Endlos-Modus **∞ Die Unendliche Spirale** am 5. Tor mit 4 Rift-Mutatoren (`⚡ Überladen`, `🛡 Gepanzert`, `🩸 Vampirisch`, `💨 Beschleunigt`), skalierenden Bossen alle 3 Ebenen, eigenem Ranglisten-Filter (`🌀 Tiefster Rift`) & 2 neuen Erfolgen (*Elementar-Schmied* & *Spiral-Läufer*).
- **✅ Meilenstein 8 — Händler-Gilde, Verhandeln & Port-Solaris-Marktplatz (Save v9):**
  - **2-Runden-Verhandlungssystem („Feilschen“):** Optional beim Kassieren von VIPs, Stammkunden & seltenen/epischen Relikten (+15 % bis +40 % Bonus-Profit, Geduldsleiste, kein Item-Verlust bei Abbruch) via `src/systems/haggle.ts`.
  - **Stammkunden-Ruf (4 Named NPCs):** *Admiral Vance*, *Kuratorin Zora*, *Schmuggler Rix* und *Ingenieurin Tala* mit 3 Rufstufen, eigenen Shop-Auren & Dialogen, **4 sichtbaren Shop-Deko-Objekten** ab Stufe 2 und **Großaufträgen mit permanenten Gilden-Perks** ab Stufe 3 (`src/data/guildMarket.ts`).
  - **Marktplatz-Terrasse (`MarketTerraceScene.ts`):** Begehbarer Bereich südlich der Promenade mit **Milo's Alchemie-Bar** (5 Run-Elixiere aus Sektor-Materialien), **Händler-Gilden-Schaukasten** und **Solaris-Handelsbank** (4 Handelsrouten über 2–4 Tag/Nacht-Zyklen).
  - **Shop-Komfort (QoL) & 2 neue Erfolge:** `[F]` Schnell-Nachfüllen an Holo-Podesten zum Scan-Codex-Optimalpreis, **Schicht-Bilanz-Abschlusskarte** am Schichtende & Erfolge *Meister-Feilscher* + *Gilden-Ehrengast* (gesamt 14).

- **✅ Meilenstein 9 — Galaktisches Netzwerk & Lebendige Community (Save v10):** *(Spezifikation: [MILESTONE_9_ARCHITECTURE.md](MILESTONE_9_ARCHITECTURE.md))*
  - **Klickbare Kapitäns-Akten:** Klick auf einen Eintrag der Kapitäns-Tafel öffnet das Detailprofil (Waffe + Prägung, 5 Sektor-Bestzeiten, Tage-Rekorde, Rift, Erfolge, Prüfungs-Abzeichen, Holo-Gruß).
  - **Globale Markt-Konjunktur:** Deterministischer Tages-Trend (UTC-Datum, 8 Trends, offline) wirkt auf `getEffectiveFairPrice()`; sichtbar an Tafel, HUD, Scan-Codex & Podest-Modal.
  - **Geister-Kapitäne:** Echte Spieler aus `leaderboard` besuchen den Laden als Holo-Kunden (12 % Spawn-Chance, +10 % Gilden-Trinkgeld, eigener Holo-Gruß im Konto-Tab).
  - **Wöchentliche Galaktische Prüfung:** Wochen-Seed (`YYYY-Www`) am 5. Tor — identisches Layout, normierte MK-V-Ausrüstung, kein NG+/Prägung/Drohne/Elixier, **keine Beute & keine Progression**; Wochen-Rangliste (`weeklyTrials/{weekId}/entries/{uid}`), Gold/Silber/Bronze-Abzeichen & 2 neue Erfolge (gesamt 16). Das 5. Tor ist jetzt ein 3-Wege-Modal (Omega · Spirale · Prüfung).

---

## 5. Nächste Schritte — Offene Phase-2-Roadmap (Meilenstein 10-A)

### 🔜 Meilenstein 10-A: Story-Tiefe, Sektor-Rätsel & Audio-/Mobile-Feinschliff
1. **Fortschreitende NPC-Dialogkapitel & visuelle Stations-Entwicklung** auf Port Solaris nach jedem Boss-/Omega-Sieg.
2. **Sektor-spezifische Raum-Mechaniken:** Reflektierende Kristall-Prismen (S2), periodische Schmelz-Düsen/Magnetplatten (S3), paarweise Astral-Teleporter-Pads (S4).
3. **Boss-Phase-2-Musik-Steigerung** in der Web-Audio-Engine + anpassbare Touch-Button-Größe / optionaler Mobile-Aim-Assist.

---

## 6. Codebase- & Dateikarte (für schnelle Orientierung)

```text
src/
├── main.ts                     # Haupt-Game-Loop, Szenenwechsel, Firebase Auto-Sync-Hook
├── types.ts                    # Zentrale Typen (SaveData v10, CaptainRecords, InfusionId, RiftMutatorId …)
├── assets/
│   ├── artLoader.ts            # HD-Pixel-Art Preloader (public/art/**)
│   └── pixelArt.ts / sprites.ts
├── data/
│   ├── items.ts                # 46 Relikte (S1–S4 + 4 Rift-Relikte) & Loot-Tables
│   ├── upgrades.ts             # 6 Waffenklassen bis MK-VIII, Suit, Med-Bay, Shop, Tech-Labor
│   ├── infusions.ts            # 4 Elementar-Prägungen & 4 Rift-Mutatoren
│   ├── marketTrends.ts         # M9: 8 globale Tages-Markttrends (UTC-deterministisch)
│   ├── ghostGreetings.ts       # M9: Holo-Gruß-Presets & sanitizeGreeting()
│   ├── guildMarket.ts          # 4 Stammkunden, Shop-Deko, Großaufträge, 5 Elixiere & 4 Bank-Routen
│   └── companions.ts           # 4 Begleiter-Drohnen, 5 Anzug-Stile, 14 Erfolge, Events, Jukebox
├── dungeon/
│   ├── dungeonTypes.ts         # Enemy, BossState, Projectile, LightningArcFx, SiphonOrbFx …
│   ├── enemyAi.ts              # DungeonEnemyAi (inkl. Burn-DoT, Kryo-Slow, Hasted & alle Bosse)
│   └── dungeonRenderer.ts      # DungeonRenderer (S1–S4, Rift-Risse, Blitze, Orbs, Minimap, Timer)
├── scenes/
│   ├── DungeonScene.ts         # Kampf, Waffen-Combos, Prägungen, Rift-Kammern, ∞ Spirale
│   ├── ShopScene.ts            # Astro-Barter Verkauf, Feilschen, Stammkunden, Deko, [F] Refill
│   ├── BackroomScene.ts        # Kapitäns-Quartier (Schlaf, Truhen, Jukebox, Drohnen, Stile)
│   ├── HubScene.ts             # Port Solaris Promenade (Kael, Lyra, Vex, Nyx, Kapitäns-Tafel)
│   ├── MarketTerraceScene.ts   # Marktplatz-Terrasse (Milo's Alchemie-Bar, Gilde, Handelsbank)
│   └── HangarScene.ts          # Raumhafen (Docks I–IV & 5. Tiefenraum-Tor)
├── services/
│   ├── firebaseConfig.ts       # Öffentliche Web-App-Config (starlighter-15b1f)
│   ├── firebaseService.ts      # Auth (Google + E-Mail), Cloud-Save, Leaderboard, Activity Feed & Prüfungs-Einträge
│   └── galacticNetwork.ts      # M9: Geister-Kapitäne-Pool & Wochen-Rangliste (Cache)
├── systems/
│   ├── gameState.ts            # Zentraler State, Save/Load v10, Rekorde, Prägungen, Bank, Ruf & Prüfung
│   ├── economy.ts              # Scan-Codex, Preisreaktionen, Optimalpreis & Nachfrage-Decay
│   ├── haggle.ts               # 2-Runden-Feilschen State Machine
│   ├── seededRng.ts            # M9: FNV-1a/Mulberry32, withSeededRandom, ISO-Wochen-/UTC-Tages-IDs
│   ├── weeklyTrial.ts          # M9: Prüfungs-Rotation, normierte Stufen, Score, Abzeichen
│   └── inventory.ts            # Cargo, Truhe & richtungsabhängige Synergien
├── ui/
│   ├── UIManager.ts            # HUD & In-Game-Modals (Inventar, Schmiede/Prägungen, Tafel …)
│   ├── MarketModals.ts         # M8-Modals (Feilschen, Schichtbilanz, Stammkunden, Alchemie, Bank)
│   └── NetworkModals.ts        # M9: Kapitäns-Akte, Konjunktur-Banner, Prüfungs-Karte/-Ergebnis/-Rangliste
└── world/
    └── dungeonGen.ts           # Prozedurale Sektor-Ebenen, Schluchten, Geheimkammern, Rifts & ∞ Spirale
```

- **Build & Deploy:** `npm run build` (`tsc && vite build`), Push auf `main` triggert automatisches Vercel-Deployment.
- **Meilenstein-9-Architektur:** [MILESTONE_9_ARCHITECTURE.md](MILESTONE_9_ARCHITECTURE.md) (Akten, Konjunktur, Geister-Kapitäne, Wöchentliche Prüfung & Save v10).
- **Meilenstein-8-Architektur:** [MILESTONE_8_ARCHITECTURE.md](MILESTONE_8_ARCHITECTURE.md) (Detail-Spezifikation zu Feilschen, Stammkunden-Ruf, Marktplatz-Terrasse, Alchemie-Bar, Handelsbank & Save v9).
- **Art-, Sprite- & UI-Design-Guide:** [ART_AND_DESIGN_GUIDE.md](ART_AND_DESIGN_GUIDE.md) (Prompt-Formeln, Flood-Fill-Freistellung, Farbpaletten & UI-Regeln für gleichbleibende HD-Pixel-Art-Qualität).
- **Test- & Verifikations-Workflow:** [TESTING_AND_VERIFICATION.md](TESTING_AND_VERIFICATION.md) (Build-Checks, Design-Invarianten, Headless-Chrome-CDP-Harness, Screenshot-QA & bekannte Stolperfallen).
- **Firestore-Regeln:** [firestore.rules](firestore.rules) (Owner-only `saves/{uid}`, Public-Read/Owner-Write `leaderboard/{uid}`, Public-Read/Auth-Create `activities`, Public-Read/Owner-Write `weeklyTrials/{weekId}/entries/{uid}`).
