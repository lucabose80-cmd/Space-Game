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

## 6. Verknüpfte Dokumente

- [GAME_DESIGN_DOCUMENT.md](GAME_DESIGN_DOCUMENT.md) — Gesamtübersicht, Stand v1.1 & Phase-2-Roadmap.
- [TESTING_AND_VERIFICATION.md](TESTING_AND_VERIFICATION.md) — Build-, Invarianten- & Headless-Chrome-Verifikations-Playbook.
