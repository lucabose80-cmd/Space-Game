# Art, Sprite & UI Design Guide: *STARLIGHTER*

> **Zweck:** Dieses Dokument hält exakt fest, wie alle HD-Pixel-Art-Sprites, Raum-Hintergründe und In-Game-UI-Elemente in *STARLIGHTER* generiert, freigestellt und integriert wurden — damit zukünftige Chats bei neuen Sektoren, NPCs, Relikten, Shops oder Props exakt dieselbe Qualität und visuelle Konsistenz erreichen.

---

## 1. Visuelle DNA (*Moonlighter 1* × Cozy Retro-Sci-Fi)

- **Stil-Anker:** Warme, handgepixelte **16-Bit/32-Bit Indie-RPG-Pixel-Art** im Stil von *Moonlighter 1*, übertragen auf ein gemütliches Retro-Sci-Fi-Universum:
  - **Materialien:** Gebürstetes dunkles Metall, warmes Messing/Kupfer, Holz- & Stoffakzente, leuchtende Holo-Displays, glühende Kristalle und warme bernsteinfarbene Laternen.
  - **Perspektive:** Konsistente **3/4 Top-Down-RPG-Ansicht** (wie *Moonlighter* / *Zelda: A Link to the Past* / *Hyper Light Drifter*).
  - **Outlines:** Klare, dunkle Pixel-Konturen (dunkles Marineblau/Violett/Holzkohle statt hartem Rein-Schwarz), sauberes Pixel-Shading ohne verschwommenes Airbrushing.
- **Technische Auflösung:**
  - Logisches Spielfeld: `480×270` (`VIRTUAL_WIDTH × VIRTUAL_HEIGHT`).
  - HD-Render-Buffer: `960×540` (`RENDER_SCALE = 2`), immer mit `ctx.imageSmoothingEnabled = false` und CSS `image-rendering: pixelated`.

### Farbpaletten-Referenz nach Weltbereich

| Bereich | Primär- & Akzentfarben | Atmosphäre |
| :--- | :--- | :--- |
| **Astro-Barter & Quartier** | Warmes Holz `#8b5a2b`, Messing `#fbbf24`, Holo-Cyan `#38e8d4` | Gemütlich, warm, einladend |
| **Port Solaris Promenade & Hangar** | Schiefer-Metall `#334155`, Laternen-Amber `#f59e0b`, Pastell-Nebel `#818cf8` / `#38e8d4` | Lebendiger Raumhafen |
| **Sektor 1 (Korvette)** | Dunkelstahl `#1e293b`, Biolumineszenz-Türkis `#38e8d4`, Reaktor-Orange `#fb923c` | Überwuchertes Wrack |
| **Sektor 2 (Kristall-Nebel)** | Tiefviolett `#1e1038`, Amethyst `#c084fc`, Prisma-Cyan `#22d3ee` | Funkelnde Kristallhöhlen |
| **Sektor 3 (Solar-Gießerei)** | Schmiedeeisen `#29150e`, Magma-Orange `#f97316`, Goldglut `#fde047` | Industrielle Schmelzhallen |
| **Sektor 4 (Ältesten-Monolith)** | Obsidian `#0d1522`, Astral-Cyan `#38e8d4`, Antik-Gold `#fde047` | Mystische Alien-Kathedrale |
| **Rifts & ∞ Unendliche Spirale** | Dimensions-Violett `#c084fc`, Neon-Magenta `#e879f9`, Portal-Türkis `#38e8d4` | Instabile Anomalie |

---

## 2. Bewährte Prompt-Formeln für die Bildgenerierung

> [!IMPORTANT]
> **Goldene Regeln für alle Sprite-Prompts:**
> 1. Immer explizit **`on a pure solid flat white #FFFFFF background with generous empty white margin`** angeben.
> 2. Immer **`zero text, zero labels, zero shadows on the background, dark crisp pixel outlines`** anfügen (sonst malt das Modell Boden-Schatten oder Beschriftungen, die beim Freistellen stören).
> 3. **Keine UI-Elemente oder Charaktere** in Raum-Hintergründe backen — die werden live von der Engine gerendert.

### A. Relikt- & Item-Icons (`2×2` Sheet, Aspect Ratio `1:1`)
```text
Crisp 16-bit/32-bit indie RPG pixel art inventory item icons arranged cleanly in a 2x2 grid
on a pure solid flat white #FFFFFF background with generous empty white margin around each of the 4 items,
Moonlighter cozy retro sci-fi style, dark crisp pixel outlines, zero text, zero labels, zero shadows on the background:
Top-left: <Beschreibung Item 1>.
Top-right: <Beschreibung Item 2>.
Bottom-left: <Beschreibung Item 3>.
Bottom-right: <Beschreibung Item 4>.
```

### B. Einzelne Props, Terminals, NPCs & Raumschiffe (Aspect Ratio `1:1`)
```text
Single centered crisp 16-bit/32-bit indie RPG pixel art sprite of <Objekt / NPC / Schiff>,
3/4 top-down Moonlighter cozy retro sci-fi game perspective, warm brass/stone/sci-fi accents,
clean dark pixel outlines, rich readable pixel shading,
isolated on a pure solid flat white #FFFFFF background with generous white padding around the object,
zero text, zero labels, zero ground drop shadow.
```

### C. Gegner- & Boss-Sheets (`2×2` oder `3×2`, Aspect Ratio `1:1` oder `3:2`)
```text
Crisp 16-bit/32-bit indie RPG pixel art enemy sprites arranged cleanly in a <2x2 / 3x2> grid
on a pure solid flat white #FFFFFF background with generous empty white margin around every sprite,
3/4 top-down Moonlighter cozy retro sci-fi action RPG style, distinct readable silhouettes,
glowing energy cores, dark crisp pixel outlines, zero text, zero labels, zero shadows on the background:
<Position-für-Position Beschreibung jedes Gegners>.
```

### D. Begehbare Raum- & Dungeon-Hintergründe (Aspect Ratio `16:9`)
```text
Crisp 16-bit/32-bit indie RPG pixel art top-down 3/4 view dungeon arena room background,
Moonlighter cozy retro sci-fi aesthetic, rectangular walkable central floor tile grid surrounded by
thick ornate architectural walls on all 4 sides with centered closed/open doorway frames at North, South, East, and West,
atmospheric glowing corner lanterns and <Sektor-spezifische Details>,
completely empty playable floor with zero characters, zero enemies, zero UI, zero text, clean pixel art rendering.
```
*Hinweis zu den Laufgrenzen:* Alle Dungeon-Hintergründe werden auf `960×540` skaliert und orientieren sich an den begehbaren Logik-Grenzen `ROOM_LEFT = 68`, `ROOM_RIGHT = 412`, `ROOM_TOP = 42`, `ROOM_BOTTOM = 228` (in `480×270`).

---

## 3. Exakte Sprite-Freistellung & Post-Processing (Python / PIL)

**Niemals** einfach global alle weißen Pixel löschen (das reißt Löcher in weiße Lichtreflexe im Inneren von Kristallen/Helmen!). Stattdessen immer **Rand-geführtes Flood-Fill + 1-px-Defringe + `NEAREST`-Skalierung** verwenden:

```python
from PIL import Image
from collections import deque

def extract_sprite(crop_img: Image.Image, target_size: int = 64, pad: int = 4) -> Image.Image:
    q = crop_img.convert('RGBA')
    qw, qh = q.size
    px = q.load()

    # 1. Edge-seeded BFS Flood-Fill: entfernt NUR den äußeren weißen Hintergrund
    visited = [[False] * qw for _ in range(qh)]
    dq = deque()
    for x in range(qw):
        dq.append((x, 0))
        dq.append((x, qh - 1))
    for y in range(qh):
        dq.append((0, y))
        dq.append((qw - 1, y))

    while dq:
        x, y = dq.popleft()
        if x < 0 or y < 0 or x >= qw or y >= qh or visited[y][x]:
            continue
        r, g, b, a = px[x, y]
        if r >= 232 and g >= 232 and b >= 232:
            visited[y][x] = True
            px[x, y] = (0, 0, 0, 0)
            dq.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))

    # 2. 1-Pixel-Defringe für helle Anti-Aliasing-Ränder neben Transparenz
    to_clear = []
    for y in range(qh):
        for x in range(qw):
            r, g, b, a = px[x, y]
            if a > 0 and r >= 210 and g >= 210 and b >= 210:
                if any(
                    0 <= nx < qw and 0 <= ny < qh and px[nx, ny][3] == 0
                    for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1))
                ):
                    to_clear.append((x, y))
    for x, y in to_clear:
        px[x, y] = (0, 0, 0, 0)

    # 3. Eng zuschneiden & knackig per NEAREST auf Zielgröße zentrieren
    bbox = q.getbbox()
    cropped = q.crop(bbox)
    cw, ch = cropped.size
    usable = target_size - pad * 2
    scale = min(usable / cw, usable / ch)
    nw, nh = max(1, round(cw * scale)), max(1, round(ch * scale))
    resized = cropped.resize((nw, nh), Image.Resampling.NEAREST)

    out = Image.new('RGBA', (target_size, target_size), (0, 0, 0, 0))
    out.paste(resized, ((target_size - nw) // 2, (target_size - nh) // 2), resized)
    return out
```

### Standard-Zielgrößen (`public/art/`)
- **Items & Relikte:** `public/art/sprites/item_<id>.png` → **`64×64` RGBA** (`pad = 4`).
- **Props, NPCs, normale Gegner & Raumschiffe:** `public/art/sprites/<name>.png` → **`96×96` RGBA** (`pad = 4`).
- **Bosse:** `public/art/sprites/boss_<name>.png` → **`128×128` RGBA** (`pad = 6`).
- **Raum- & Hub-Hintergründe:** `public/art/<name>_bg.png` → **`960×540` PNG** (exakte `16:9` HD-Buffer-Größe).

---

## 4. Integration in die Engine (Damit alles „wie aus einem Guss“ wirkt)

1. **Preloader (`src/assets/artLoader.ts`):**
   - Items werden automatisch über `ITEMS.map((item) => loadImage('/art/sprites/item_' + item.id + '.png'))` geladen — neue Einträge in `src/data/items.ts` mit passender PNG-Datei unter `public/art/sprites/item_<id>.png` funktionieren sofort!
   - Props, NPCs, Gegner & Hintergründe werden in `HDArtAssets`, im `Promise.all([...])` und über `imgToCanvas(...)` registriert; Gegner bekommen zusätzlich `makeFlashSilhouette(canvas, '#ffffff')` für den weißen Treffer-Blitz.
2. **Erdung & Licht in Szenen (`HubScene`, `ShopScene`, `DungeonRenderer`):**
   - Unter jedem Sprite einen weichen Pixel-Schatten zeichnen: `drawPixelShadow(ctx, x, y + offset, rx, ry, 0.5)`.
   - Leuchtende Terminals, Portale, Laternen und Kerne mit additivem Glow betonen: `drawGlow(ctx, x, y, radius, color, alpha)`.
   - **Y-Sorting:** Alle Charaktere, NPCs und begehbaren Props nach ihrer Fuß-Y-Koordinate sortieren, damit der Held realistisch vor und hinter Objekten vorbeiläuft.
3. **In-Game-UI & Modals (`src/ui/UIManager.ts` & `src/style.css`):**
   - Überschriften, Badges & Buttons: `font-family: var(--font-pixel)` (`Silkscreen`), Fließtext klar lesbar in Sans-Serif (`11px–12px`).
   - Farb-Codierung der Rahmen: Standard `--border-steel`, aktiv/Highlight `#38e8d4` (Cyan), Gold/Trophäen/Omega `#fde047`, Rift/Anomalie `#c084fc`/`#e879f9`, Warnung/Solar `#fb923c`.
   - Modal-Header immer mit `white-space: nowrap` und genügend `max-width` (`600px–680px`), damit Tabs und `ESC ✕` nie zweizeilig umbrechen.

---

## 5. Pflicht-Checkliste vor jedem neuen Asset-Commit

- [ ] Extrahiertes PNG direkt visuell geprüft (`view_file`): **keine weißen Fransen**, keine abgeschnittenen Kanten, weiße Glanzlichter im Inneren erhalten.
- [ ] In der echten Spielszene per Headless-Chrome-Screenshot geprüft: **Proportionalität** passt zu Held/NPCs/Laternen, kein Überlappen von Schildern oder `[E]`-Prompts.
- [ ] Passender Schatten (`drawPixelShadow`) und subtiler Lichtschein (`drawGlow`) aktiv.
- [ ] Keine externen Menüs — neue Features sitzen als begehbares Terminal/NPC/Dock in der Spielwelt.

---

## 6b. Hinweis zu optionalen Sprites (Meilenstein 10-A)

Die 12 Promenaden-Sprites aus §7 sind **optional**: `artLoader.ts` lädt sie über `M10_OPTIONAL_SPRITES` separat; fehlt eine Datei, bleibt der Art-Key `null` und `scenes/hubEvolution.ts` (bzw. `HubScene.getStrollerSprite`) zeichnet einen prozeduralen Fallback. Eine neue PNG ersetzt den Fallback sofort — kein Code nötig.

## 7. M10-Prompts: Promenaden-Sprites (Formel B)

Alle Dateien: `public/art/sprites/<datei>.png`, **96×96 RGBA**, Prompt-Formel **B** (§2), Freistellung & `NEAREST`-Skalierung nach §3, **Palette „Port Solaris Promenade“** (Schiefer-Metall `#334155`, Laternen-Amber `#f59e0b`, Pastell-Nebel `#818cf8`/`#38e8d4`). Rohdateien optional als `art_source/m10/<datei>_raw.png` ablegen. Anzeigegröße in der Engine in Klammern.

| Datei (`art`-Key) | Motiv für `<Objekt>` in Formel B |
| :--- | :--- |
| `prop_hub_crystal_lantern` (`propHubCrystalLantern`, 22×30) | a slim brass street lantern post holding a glowing violet amethyst crystal instead of a flame, soft magenta inner glow |
| `prop_hub_elder_obelisk` (`propHubElderObelisk`, 34×44) | a tall slender dark obsidian alien obelisk with glowing cyan glyph lines and a floating golden holo-ring around its middle |
| `prop_hub_star_banner` (`propHubStarBanner`, 24×32) | a hanging festival cloth banner in deep navy with a large golden eight-pointed star emblem and small tassels |
| `prop_hub_cycle_holo` (`propHubCycleHolo`, 26×26) | a small floating cyan hologram display panel on a slim metal stand, empty screen with scanlines, no text |
| `prop_kael_memorial` (`propKaelMemorial`, 26×26) | a small memorial anvil on a stone base with a carved star-above-hammer emblem and an eternal orange flame in a brass bowl |
| `prop_lyra_echo_sign` (`propLyraEchoSign`, 22×22) | a hanging clinic sign with a glowing cyan medical cross combined with a soft sound-wave symbol, brass frame, no text |
| `prop_nyx_free_lantern` (`propNyxFreeLantern`, 20×26) | a warm amber paper-and-brass lantern hanging from a hook, with a small open-hand emblem, cozy light |
| `prop_vex_beacon` (`propVexBeacon`, 30×40) | a compact research antenna beacon with a satellite dish, blinking lights and a glowing violet energy coil on top |
| `prop_vex_classboard` (`propVexClassboard`, 26×24) | a small holographic teaching board on tripod legs showing simple glowing cyan schematics, no text |
| `npc_pilgrim` (`npcPilgrim`, 24×28) | a hooded crystal pilgrim traveler in violet robes carrying a small glowing amethyst shard, friendly pose, full body |
| `npc_foundry_worker` (`npcFoundryWorker`, 24×28) | a stocky foundry worker in an orange heat-resistant suit with soot marks, goggles on forehead, carrying a wrench, full body |
| `npc_elder_scholar` (`npcElderScholar`, 24×28) | an elderly scholar in teal and gold robes holding a floating holo-tablet, kind face, full body |

**Vor dem Einbau prüfen:** gleiche 3/4-Perspektive wie die NPCs, dunkle Pixel-Outline, Proportion zu Kael (26×29 px im Spiel), keine weißen Fransen. Danach Hub-Screenshots je Kapitel (`story.chapter` 0–6) ansehen.

---

## 8. M10-C-Prompts: Boss-Sprites (Formel B, 128×128)

Datei: `public/art/sprites/<datei>.png`, **128×128 RGBA**, Prompt-Formel **B** (§2) mit **Palette passend zum Sektor**, Freistellung/`NEAREST` nach §3. Die Trefferfarbe (`…Flash`) erzeugt `artLoader.ts` automatisch. Bis ein PNG existiert, zeichnet `dungeon/bosses/bossLooks.ts` einen eingefärbten Fallback mit Erkennungsmerkmalen — eine abgelegte Datei ersetzt ihn ohne Codeänderung. Anzeigegröße in der Engine: Krall 54×52, übrige 72×64.

| Datei (`art`-Key) | Boss | Motiv für `<Objekt>` in Formel B |
| :--- | :--- | :--- |
| `boss_scrap_collector` (`bossScrapCollector`) | S1 Ebene I · Schrott-Sammler „Krall“ | a hulking spider-like salvage robot made of scrap plates and rusty pipes with four jointed legs, one big red-and-blue horseshoe magnet on its back and a glowing orange furnace core, menacing but cozy-cartoony |
| `boss_slag_colossus` (`bossSlagColossus`) | S3 Ebene I · Schlacken-Koloss | a massive lava golem made of cooled black slag rock with glowing orange cracks, dripping molten slag from its fists and shoulders |
| `boss_forge_mistress` (`bossForgeMistress`) | S3 Ebene II · Gießerei-Meisterin | a tall armored foundry mistress in a scorched leather apron and welding visor holding a gigantic glowing forge hammer, casting molds hanging from her belt |
| `boss_chrono_warden` (`bossChronoWarden`) | S4 Ebene I · Chrono-Wächter | a floating clockwork eye guardian with a brass clock face as its iris, rotating gear rings and two long glowing clock hands, cyan and gold light |
| `boss_monolith_colossus` (`bossMonolithColossus`) | S4 Ebene II · Monolith-Koloss | a stone giant built from floating dark monolith slabs with glowing golden runes, hovering plates around its torso, ancient and heavy |

Vulkan-Titan und Sternen-Archon behalten ihre bestehenden Sprites (`boss_vulkan_titan.png`, `boss_star_archon.png`); ihre neuen Erkennungsmerkmale (Lavakrone, Sternbild-Ring) sind prozedural.

---

## 9. M11 Teile- & Pose-Sheets (Antigravity `generate_image`-Workflow)

Für Meilenstein 11 (`MILESTONE_11_ARCHITECTURE.md` §2 & §6) erzeugt Antigravity Roh-Sheets direkt per `generate_image` und legt sie als verlustfreie PNGs im Repo ab:

- **Boss-Teile-Sheets (`3×2`):** `AspectRatio: '3:2'`, Ziel `art_source/rigs/<id>_parts.png` (ideal `1536×1024`, d. h. `512×512` pro Zelle).
- **Gegner-Rig-Sheets (Typ G, `3×2`):** `AspectRatio: '3:2'`, Ziel `art_source/rigs/<kind>_rig.png` (ideal `1536×1024`, d. h. `512×512` pro Zelle) — siehe `ART_BRIEF_M11_ENEMIES.md`. (Die frühere 2×2-Pose-Sheet-Variante ist entfallen.)
- **Referenzbild nutzen:** Wo in `MILESTONE_11_ARCHITECTURE.md` §6 ein vorhandenes Sprite genannt ist, den absoluten Pfad (z. B. `public/art/sprites/boss.png`) über `ImagePaths` mitgeben.
- **Nachprüfung vor Commit (wichtig für `npm run art:import`):**
  1. `generate_image` schreibt zunächst ins Artifact-Verzeichnis (oft `.jpg`) und zeichnet trotz Prompt gelegentlich dünne graue Trennlinien oder lässt lange Gliedmaßen minimal über die Zellengrenze (`h/2`) hinausragen.
  2. Per Python/PIL die Bounding-Boxen der 6 bzw. 4 Teile prüfen, jedes Teil ohne Skalierungsverlust auf reinem `#FFFFFF` in seine eigene Zelle zentrieren (z. B. `512×512` mit ≥ 30 px Weißrand ringsum) und als `.png` ins Repo speichern.
  3. Finales PNG per `view_file` prüfen (Reihenfolge, Proportionen, keine Linien/Texte/Schatten), dann committen & pushen.

---

## 10. Verknüpfte Dokumente

- [GAME_DESIGN_DOCUMENT.md](GAME_DESIGN_DOCUMENT.md) — Gesamtübersicht, aktueller Meilenstein-Stand & Roadmap.
- [MILESTONE_11_ARCHITECTURE.md](MILESTONE_11_ARCHITECTURE.md) — Meilenstein 11: Rig-Architektur, Lieferformat & vollständiger Prompt-Katalog.
- [TESTING_AND_VERIFICATION.md](TESTING_AND_VERIFICATION.md) — Build-, Invarianten- & Verifikations-Playbook.

