# Architektur- & Vorgehensplan: Meilenstein 10-C — Bugs, HUD, Spielschleife, Bosse & Balancing

> **Status:** ✅ Umgesetzt (Phasen 0–10) — Umsetzungsnotizen siehe §9
> **Basis:** Stand nach M10-A (`SAVE_VERSION = 11`, Commit `5c5dab6` auf `main`)
> **Ziel-Save-Version:** bleibt `11`. Nur wenn eine Phase **zwingend** ein neues Feld braucht → `12`, Feld optional + Default in `GameState.load()` (AGENTS.md Regel 3).
> **Quelle:** Feedback-Liste des Projektinhabers (Bugs, Mobile-HUD, Tag/Nacht, Teleport, Bosse, Schilde, Balancing).

**So benutzt du dieses Dokument:**
1. Lies zuerst `AGENTS.md`, `HANDOFF.md` und §2 (Invarianten) hier.
2. Arbeite die Phasen in §6 **strikt in Reihenfolge** ab, **ein Commit pro Phase** (große Phasen sind in a/b/c geteilt).
3. Vor jedem Commit: `npm run verify` grün **und** die in der Phase genannten Screenshots selbst ansehen.
4. Alle Zahlen in diesem Dokument sind **Startwerte**. Weichst du ab (z. B. nach der TTK-Messung in Phase 8), trägst du Wert und Grund in §9 „Umsetzungsnotizen“ ein.
5. Wo „Entscheidung“ steht, ist die Standardwahl schon getroffen (§3). Nicht neu entscheiden — umsetzen.

---

## 1. Scope

| # | Bereich | Punkt | Kurzlösung | Risiko |
| :--- | :--- | :--- | :--- | :--- |
| B1 | Bug | **Slimes/Gegner hängen an Objekten** | Navigations-Raster pro Raum (8-px-Zellen) + Fluss-Feld zum Spieler + Anti-Hänger-Ausweichen | mittel |
| B2 | Bug | **Instabiles Portal spawnt in Objekten** | Deterministische Freiplatz-Suche (Spirale, **ohne Zufall**), Mechaniken weichen dem Portal aus | niedrig |
| U1 | UI | **Kampf-HUD außerhalb von Dungeons** | HP/EN/Stim/Waffe/Bot nur im Dungeon. Sonst kompakte Status-Pille (Zeit · Credits · Laden-Status) | niedrig |
| U2 | UI | **Minimap im Run überdeckt** | Im Dungeon: Aktions-Buttons **unter** die Minimap (Positionen in % der Spielfläche), Musik+SFX → ein Button | niedrig |
| U3 | UI | **Waffenschrank** | Neues Loadout-Panel mit zwei großen Slots ①/②, Tauschen-Knopf, „→①/→②“ je Waffe. Im Hinterzimmer-Waffenschrank, in der Fracht und in der Schmiede | niedrig |
| G1 | Gameplay | **Tag/Nacht-Schleife automatisch** | Laden nur **nachts** · Ende der Ladenschicht → **Tag** · Run am Tag → danach **Nacht** · Run in der Nacht (mehr Beute) → danach **Tag**, die Ladenschicht fällt aus | mittel |
| G2 | Gameplay | **Heim-Teleport entfernen** | `R`-Warp & Touch-„WARP“ weg. Rückkehr nur über Teleporter (nach Bossen, Start-Raum, 1 Notfall-Bake ab Ebene II) | mittel |
| G3 | Gameplay | **Einzigartige Bosse** | Jede Ebene (S1–S4 × F1–F3) bekommt eigenes Aussehen **und** eigenes Angriffsmuster. 7 neue Bewegungs-Sets, 7 optionale Sprites mit Fallback | **hoch** |
| G4 | Gameplay | **Gegner-Schilde mit Counterplay** | Frontal 100 % Block, aber: Schild fällt beim eigenen Angriff, überhitzt nach X Blocks, Rücken/Seite voll verwundbar | mittel |
| BA1 | Balancing | **Ökonomie & Power-Scaling** | Verkaufspreise ×0,65 (iterativ nachjustierbar) · flachere frühe Waffen-Stufen · teurere frühe Upgrades · Waffen-Stufen an Fortschritt gekoppelt · Boss-HP an Ziel-Kampfdauer kalibriert | mittel |
| BA2 | Balancing | **Bot-Freischaltung** | Deutlich höhere Hürden (Tabelle §4.10). Bereits freigeschaltete Bots bleiben | niedrig |
| BA3 | Balancing | **Riss-Schwierigkeit** | Rift-Kammer: HP/Schaden-Multiplikator nach Sektor & Ebene, mehr Wellen, Elite-Affix | niedrig |

**Nicht im Scope:** neue Sektoren, neue normale Gegnerarten, Firebase/Firestore-Regeln, Story-Inhalte.

---

## 2. Invarianten (gelten in jeder Phase)

1. **Zero-Dungeon-Credits:** `npm run check:invariants` muss grün bleiben. Kein `state.credits +=` in `DungeonScene.ts` oder `src/dungeon/`.
2. **Seed-Determinismus der Wöchentlichen Prüfung:** Neuer Code in `generateSectorFloor()` und `src/dungeon/mechanicsGen.ts` darf **keine** zusätzlichen Zufallsaufrufe der globalen Zufallsfunktion machen. Die Portal-Suche (B2) ist rein deterministisch. Test `m10p4` (Referenz-Hash `918998568`) muss grün bleiben.
3. **Alles im Spiel:** Neue Bedienung lebt an Stationen/NPCs/Modals im Spiel (Waffenschrank im Hinterzimmer, Teleporter im Dungeon).
4. **Saves:** Bestehende Spielstände dürfen nichts verlieren. Was schon freigeschaltet/gekauft ist, bleibt (Bots, Waffen-Stufen). Neue Sperren gelten nur für **künftige** Käufe/Freischaltungen.
5. **Deutsch:** Alle Texte, Toasts und Labels auf Deutsch, Header einzeilig (`white-space: nowrap`).
6. **Fehlende Sprites (AGENTS.md Regel 7):** Jeder neue Boss-Look bekommt einen optionalen Sprite-Key **plus** prozeduralen/gefärbten Fallback, Prompt im Art-Guide, Eintrag in `HANDOFF.md`. In der Abschlussmeldung ausdrücklich auf fehlende Sprites hinweisen.
7. **Prüfungs-Fairness:** Balance-Änderungen (Phasen 6–9) ändern die Prüfung mit. Deshalb: diese Phasen **gemeinsam** auf `main` bringen und danach die Par-Zeiten neu messen (Phase 10). Kein Code-Gate nötig.

---

## 3. Getroffene Entscheidungen (Standard — nur auf Wunsch des Inhabers ändern)

| # | Frage | Entscheidung |
| :--- | :--- | :--- |
| E1 | Darf man nachts in den Dungeon? | **Ja.** Ein Nacht-Run behält den Nacht-Bonus (+35 % seltene Beute), **kostet aber die Ladenschicht**: Nach der Rückkehr ist es direkt **Tag** (neuer Tag). Tagsüber kann der Laden nicht geöffnet und nicht geschlafen werden. Das Hangar-Tor weist nachts darauf hin. |
| E2 | Nacht-Loot-Bonus (+35 % Rar-Loot) | **Bleibt unverändert** (`nightBoost` wie heute). |
| E3 | Darf man den Laden ohne Kunden (leer) schließen? | Ja, Schließen beendet immer die Nacht → Tag (auch ohne Verkäufe). Bisherige Sonderregel „nur bei Aktivität“ entfällt. Die Koje bietet nachts „Schicht überspringen → Morgen“, tagsüber nichts. |
| E4 | Wie oft Notfall-Extraktion ohne Boss? | Start-Raum jeder Ebene (wie bisher, gratis) **+** ab Ebene II genau **eine** „Notfall-Bake“ in einem zufälligen Kampfraum (einmal nutzbar, nach Raum-Clear). Kein Warp per Taste mehr. |
| E5 | Boss-One-Shots | **Kein Treffer-Deckel.** Der Spieler soll sich stark fühlen. Ursache wird an der Wurzel behoben: frühe Waffenwerte und Upgrade-Tempo (E6), danach Boss-HP über die Kampfdauer kalibrieren. |
| E6 | Frühes Waffen-Scaling & Upgrade-Tempo | (a) **Flachere frühe Schadensstufen** (Stufen 1–3), Stufen 4–7 unverändert. (b) **Frühe Upgrades teurer** (Material-Mengen der Stufen 1–3 ×1,5, ab Stufe 2 mindestens ein Material aus Sektor 1 Ebene II). (c) **Fortschritts-Sperren** für Waffen-Stufen. Details §4.9. |
| E7 | Verkaufspreise | Ein zentraler Faktor `SELL_PRICE_MULT = 0.65` auf den Basiswert; Kopfgelder ×0,75. Ökonomie ist **iterativ**: alle Stellschrauben in `src/data/balance.ts`, ein Ökonomie-Bericht im Test (§4.9), Nachjustieren in späteren Sitzungen ausdrücklich erwünscht (Eintrag in `HANDOFF.md`). |
| E8 | Gegner-Schilde: durchdringende Angriffe | Durchdringen weiterhin vollständig (bewusster Konter, z. B. Speer-Lanze). |

---

## 4. Detail-Design

### 4.1 B1 — Gegner-Navigation (Slime-Pathfinding)

**Ursache heute:** `enemyAi.ts` bewegt jeden Gegner direkt auf den Spieler zu (`nx = dx/dist`). Die Kollision (`enemyAi.ts` ~Zeile 1003–1020) trennt nur X- und Y-Achse („Gleiten“). Steht ein Hindernis senkrecht zur Laufrichtung, bleibt der Gegner stehen. Slimes hüpfen zusätzlich mit `atan2(dy, dx)` direkt Richtung Spieler.

**Lösung:** neue Datei `src/dungeon/navGrid.ts`.

```ts
export class NavGrid {
  static readonly CELL = 8;                // Raum 344×176 → 43×22 Zellen
  constructor(room: DungeonRoom, inflate: number, blockMechanics: (x: number, y: number, r: number) => boolean);
  isFreeCell(cx: number, cy: number): boolean;
  /** BFS-Fluss-Feld vom Ziel aus (8 Nachbarn, keine Ecken-Abkürzung durch blockierte Zellen). */
  buildFlow(targetX: number, targetY: number): void;
  /** Normierte Richtung zur nächsten Zelle Richtung Ziel, oder null wenn unerreichbar/schon da. */
  flowDir(x: number, y: number): { x: number; y: number } | null;
}
```

- **Blockiert** ist eine Zelle, wenn ihr Mittelpunkt mit Radius `inflate` ein Hindernis (`room.obstacles`), einen Abgrund (`room.chasms`) oder eine blockierende Mechanik (Prismen; `mechanics.collides`) schneidet.
- `DungeonScene` hält `public nav: NavGrid | null`. Aufbau in `enterRoom()` (nach dem Mechanik-Reset), `inflate = 7`.
- **Fluss-Feld neu berechnen**, wenn der Spieler die Zelle wechselt **oder** spätestens alle 0,3 s (Zähler auf `mechanicsClock`-Basis, **nicht** `scene.time`).
- **Steuerung** in `enemyAi.ts`, direkt nachdem `nx/ny` berechnet sind: neue Hilfsmethode

```ts
private steer(e: Enemy, nx: number, ny: number): { x: number; y: number }
```

  - Nur für **Bodenläufer**: alle Kinds, die **nicht** in der `hovers`-Liste stehen und keine Bosse/Turrets/`spore_spitter` sind. Die `hovers`-Liste dafür in eine Modul-Konstante `HOVER_KINDS` (Set) auslagern und an beiden Stellen nutzen.
  - Sichtlinie prüfen: Strecke Gegner → Spieler alle 6 px mit `collidesRoomObstacle(x, y, e.radius*0.85)` und `collidesRoomChasm(...)` abtasten. **Frei → `nx/ny` unverändert** (Verhalten wie heute, wichtig für bestehende Angriffsmuster).
  - **Blockiert → `nav.flowDir(e.x, e.y)`** verwenden (Fallback: `nx/ny`).
  - Slime-Hüpfer: statt `Math.atan2(dy, dx)` den Winkel des gesteuerten Vektors nehmen (Jitter bleibt).
- **Anti-Hänger:** Neue optionale Enemy-Felder `stuckTimer?`, `sidestepTimer?`, `sidestepDir?` (in `dungeonTypes.ts`). Bewegt sich ein Bodenläufer, der laufen will (|v| > 20), in 0,6 s weniger als 2 px → für 0,4 s senkrecht zur Wunschrichtung ausweichen (Seite: die, auf der `collidesRoomObstacle` frei ist).
- **Performance:** 946 Zellen, BFS nur bei Zellwechsel → vernachlässigbar. Keine Allokation pro Frame (Arrays einmal pro Raum anlegen).

**Akzeptanz:** Test `m10cp1`: Raum mit Kiste zwischen Slime und Spieler → Slime erreicht den Spieler in < 6 s Simulationszeit (feste `dt = 1/60`, Spieler steht still, Spieler-Schaden per Monkeypatch aus). Gleiches für `phase_stalker`/`void_crawler` in einem Säulen-Layout. Ohne Hindernis: Bewegungsrichtung identisch zu vorher (Winkel-Abweichung < 0,01 rad).

### 4.2 B2 — Instabiles Portal nur auf freien Feldern

**Ursache heute:** `dungeonGen.ts` (~Zeile 815) setzt `host.riftPortal = { x: ROOM_CENTER_X, y: ROOM_CENTER_Y - 6, ... }` fest in die Raummitte — egal, ob dort Kisten/Säulen stehen. Danach platziert `applySectorMechanics()` Prismen usw. ohne Rücksicht auf das Portal. `exitRiftChamber()` setzt den Spieler fest auf `ROOM_CENTER_Y + 28`.

**Lösung:**
1. Neue reine Funktion in `src/dungeon/mechanicsGen.ts` (exportiert, **ohne Zufall**):
   ```ts
   export function findFreeSpotSpiral(room: DungeonRoom, startX: number, startY: number, r: number, step = 8, maxDist = 130): { x: number; y: number } | null
   ```
   Spirale um den Start in 8-px-Schritten. Frei = innerhalb `ROOM_* ± 20`, kein Schnitt mit `obstacles` (r+6), `chasms`, `pods` (falls vorhanden) und ≥ 26 px Abstand zu den Tür-Mitten (N/S/W/E).
2. In `generateSectorFloor()` die Portal-Position über `findFreeSpotSpiral(host, ROOM_CENTER_X, ROOM_CENTER_Y - 6, 16)` bestimmen. Kein Platz → anderen Kandidaten nehmen **in fester Reihenfolge** (nächster in `combatCandidates`, kein neuer Zufallswurf). Notfalls kein Portal.
3. `isFreeSpot()` in `mechanicsGen.ts`: wenn `room.riftPortal` gesetzt ist, zusätzlich ≥ 30 px Abstand zum Portal. In der Prüfung werden Portale erst **nach** der Generierung gelöscht → dort ändert sich die Mechanik-Platzierung im Portal-Raum. Darum: neue Option `generateSectorFloor(..., { mechanics, portalExclusion })`. Die Prüfung übergibt `portalExclusion: false`, normale Runs `true` (Default). So bleibt jedes Prüfungs-Layout identisch.
4. `exitRiftChamber()`: Rückkehrpunkt = `findFreeSpotSpiral(parentRoom, rp.x, rp.y + 30, 8)` (Fallback: wie heute).

**Akzeptanz:** `m10cp2`: 300 ungeseedete Ebenen (S1–S4, F1–F3): Portal schneidet nie ein Hindernis/Prisma/Abgrund. 50 geseedete Prüfungs-Ebenen: Hash identisch mit `portalExclusion: false` vor/nach der Änderung. Screenshot eines Portal-Raums mit Säulen-Layout.

### 4.3 U1 — Kampf-HUD nur im Dungeon

Heute rendert `UIManager.renderHud()` (~Zeile 373 ff.) die Vitalwerte-Box (`.hud-vitals`: HP, EN, Credits, Stim, Waffen-Chip, Infusion, Bot, Event-Pille) in **jeder** Szene. Auf dem Handy verdeckt sie Shop-Texte und Türen.

**Lösung:**
- `const inCombatScene = this.currentScene === 'dungeon';`
- **Dungeon:** alles wie heute.
- **Außerhalb (shop, backroom, hub, hangar, terrace):** statt `.hud-vitals` eine **Status-Pille** `.hud-status-pill` (eine Zeile, `nowrap`): `☀ TAG 4 · 1.240 CR` bzw. im Laden `🌙 NACHT 4 · 1.240 CR · OFFEN`. Event-Pille (Markt-Event) und Merkliste (`pinTrackerHtml`) bleiben, aber:
  - Merkliste außerhalb des Dungeons **eingeklappt** (nur Kopfzeile „📌 2 Merkposten ▸“, Tipp/Klick klappt auf). Zustand in `localStorage` (`starlighter_pin_collapsed`, try/catch).
- `.hud-status-pill` CSS: max. 60 % Breite, `font-size` wie `.hud-bar-val`, Mobile (`max-width: 760px`) noch kleiner.
- `hud-center` (Orts-Pille) bleibt.

**Akzeptanz:** Screenshots Laden/Hinterzimmer/Promenade/Hangar/Terrasse in **390×844 (Hochformat)**, **844×390 (Querformat)** und 1280×720. Automatischer Check: Die Status-Pille schneidet kein Tür-/Prompt-Rechteck (Prompt-Position über `activePrompt` × Canvas-Skalierung umrechnen) — wo nicht automatisierbar, Screenshot ansehen.

### 4.4 U2 — Dungeon-HUD entzerren (Minimap frei)

Die Minimap wird auf dem Canvas gezeichnet (`dungeonRenderer.renderMinimap`): Rechteck `x = 432…476`, `y = 5…39` in logischen 480×270-Koordinaten → **rechts oben, 9,2 % breit, 12,6 % hoch**. Die HTML-Buttons (`.hud-actions`: Fracht, Musik, SFX) liegen ebenfalls rechts oben und werden mit festen Pixel-Abständen (`margin-right: 126px` bzw. `48px`) verschoben → passt je nach Bildschirm nicht.

**Lösung:**
- Im Dungeon bekommt `.hud-actions` die Klasse `dungeon-stack`: `position: absolute; right: calc(0.8% + 2px); top: calc(15% + 4px); flex-direction: column; align-items: flex-end;` (Prozent relativ zu `#hud-layer`, der deckungsgleich über der Spielfläche liegt). Die alte Klasse `dungeon-offset` samt CSS entfernen.
- Im Dungeon nur **zwei** Buttons: `[I] Fracht (n)` und **ein** Ton-Button `🔊`, der zyklisch schaltet: *Alles an → Musik aus → Alles aus → Alles an* (nutzt die bestehenden `sound`-Funktionen). Außerhalb des Dungeons bleiben Musik + SFX getrennt.
- Touch: Buttons dürfen den `#touch-deck` nicht überlappen (Deck liegt unten, also unkritisch — trotzdem prüfen).

**Akzeptanz:** `m10cp3` misst mit `getBoundingClientRect()`: Minimap-Rechteck (aus Canvas-Rect × Anteilen) ∩ jedem `.hud-actions button` = leer — für 390×844, 844×390, 1280×720, 1920×1080. Plus Screenshots ansehen.

### 4.5 U3 — Waffenschrank (Loadout)

Heute: Erst-/Zweitwaffe wird an drei Orten unterschiedlich gesetzt (Fracht-Modal `btn-equip-bag` setzt nur Hauptwaffe, Schmiede `btn-equip-forge` mit „Als Hauptwaffe / In 2. Slot“, Taste `C` tauscht). Der „Waffenschrank“ im Hinterzimmer (`WEAPON_RACK_POS`) öffnet nur das Logbuch.

**Lösung:** neue Datei `src/ui/LoadoutPanel.ts`:
```ts
export function renderLoadoutHtml(state: GameState, opts?: { compact?: boolean }): string;
export function bindLoadout(root: HTMLElement, state: GameState, onChange: () => void): void;
```
- Oben **zwei große Slots** nebeneinander: `① HAUPTWAFFE` und `② ZWEITWAFFE [C]` (Icon 32 px, Name, Stufe). Dazwischen `⇄ Tauschen` (ruft `state.swapWeapons()` bzw. die bestehende Tausch-Methode). Leerer Slot ② zeigt „— leer —“.
- Darunter Liste aller freigeschalteten Waffen. Jede Karte hat zwei Knöpfe **„→ ①“** und **„→ ②“**. Ausgerüstete Waffen sind markiert (① grün, ② cyan), der passende Knopf ist deaktiviert.
- Neu in `GameState`: `clearSecondaryWeapon()`; Knopf „② leeren“ am Slot.
- Einsatzorte:
  1. **Hinterzimmer-Waffenschrank:** Prompt wird `[E] Waffenschrank (Haupt- & Zweitwaffe)`. Öffnet neues Modal `UIManager.openLoadoutModal()` mit dem Panel und unten einem Knopf `📖 Logbuch, Anzug & Savegame` (öffnet das bisherige Logbuch-Modal) — so geht nichts verloren.
  2. **Fracht-Modal:** `weaponBarHtml` durch `renderLoadoutHtml(state, { compact: true })` ersetzen.
  3. **Schmiede:** die `equipControls` je Karte entfernen und **einmal** oben das kompakte Panel zeigen.
- Mobile: Slots nebeneinander bis 360 px Breite, sonst untereinander; Knöpfe ≥ 36 px hoch (Touch).

**Akzeptanz:** `m10cp4`: Waffe X → ②, Tauschen, ② leeren, Waffe Y → ① während Y in ② liegt (Y wandert nach ①, alte ① nach ②). `C`-Taste im Dungeon funktioniert unverändert. Screenshots Modal Desktop + 390×844.

### 4.6 G1 — Tag/Nacht-Schleife automatisch

**Neue Regel (Moonlighter umgedreht):**
| Zustand | Erlaubt | Übergang |
| :--- | :--- | :--- |
| ☀ **Tag** | Dungeon, Promenade, Schmiede, Terrasse … — **kein** Laden, **kein** Schlafen | **Rückkehr aus dem Dungeon** (Sieg, Extraktion, Niederlage, Spirale) → **Nacht** |
| 🌙 **Nacht** | Laden öffnen, Dungeon (Nacht-Run, +35 % seltene Beute), Promenade, Hinterzimmer | **Laden schließen** (Timer abgelaufen oder manuell) → **Tag** (neuer Tag: Aufträge, Nyx, Events) · **Rückkehr aus einem Nacht-Run** → **Tag** (neuer Tag, Ladenschicht fällt aus) · Koje „Schicht überspringen“ → Tag |

Umsetzung:
- `GameState`: zwei klar benannte Methoden statt des Umschalters:
  - `startNight(): AdvanceResult` — nur wenn `timeOfDay === 'day'`; setzt Nacht, `restoreFullVitals()`, Bank-Tick wie heute.
  - `startDay(): AdvanceResult` — nur wenn `timeOfDay === 'night'`; Logik des heutigen Nacht→Tag-Zweigs (Tag +1, Bounties, Nyx, Event, Demand-Decay).
  - `advanceTimeOfDay()` bleibt als dünner Wrapper (Kompatibilität), ruft je nach Zustand eine der beiden.
- `main.ts handleReturnFromDungeon()`: Zeit **beim Start** des Runs merken (`runStartedAtNight`, nur im Speicher, kein Save-Feld; bei Neuladen mitten im Run zählt die aktuelle Zeit). Am Ende:
  - Run startete am Tag → `state.startNight()` + Toast `🌙 Die Nacht bricht an — Zeit, den Laden zu öffnen!`
  - Run startete in der Nacht → `state.startDay()` + Toast `☀ Der Morgen graut — die Ladenschicht ist ausgefallen. Tag {n} beginnt!`
  - **Nicht** in der Wöchentlichen Prüfung (dort ändert sich nichts an der Zeit).
- `ShopScene.toggleShopOpen()`: tagsüber Öffnen ablehnen → Toast `☀ Tagsüber ist der Laden zu — erst nachts öffnen. Zeit für einen Run!`
- `ShopScene.closeShop()`: **immer** `state.startDay()` (E3) + bestehender Toast.
- `BackroomScene` Koje: tagsüber **kein** Prompt zum Schlafen (Hinweis-Prompt stattdessen: `☀ Tagsüber wird nicht geschlafen — ab in den Dungeon!`). Nachts: `[E] Schicht überspringen → Morgen (Tag n+1)`.
- Hangar/Schiff nachts: Start erlaubt, Prompt-Zusatz `🌙 Nacht-Run: +35 % seltene Beute · Ladenschicht fällt aus`. Tagsüber wie heute.
- E2: Nacht-Loot-Bonus bleibt (`nightBoost` unverändert). Bestehende Toasts, die „Nacht“ erwähnen, auf die neue Regel prüfen (`DungeonScene` ~Zeile 440–500, `BackroomScene`, `ShopScene`).
- Alte Spielstände: wer tagsüber mit vollem Laden steht, kann trotzdem in den Dungeon. Wer nachts gespeichert hat, öffnet den Laden. Nichts zu migrieren.
- Musik: `syncMusic()` nach jedem Wechsel aufrufen (wie heute).

**Akzeptanz:** `m10cp5`: Zustandsfolge Tag → Run beenden → Nacht → Laden auf/zu → Tag (Tag +1) → Run → Nacht → **Nacht-Run** → Tag (Tag +1, kein Laden dazwischen). Laden tagsüber öffnen → abgelehnt. Koje tagsüber → kein Zeitwechsel. Nacht-Run erhält `nightBoost = true`. Prüfung: Zeit unverändert. Story-Kapitel/Festival bleiben unberührt.

### 4.7 G2 — Heim-Teleport entfernen

Heute: `R` halten (Tastatur/Gamepad) bzw. Touch-Button „WARP HALTEN“ (`TouchControls.ts` ~Zeile 167) → `triggerSafeWarp('warp', true)` von **überall** (20 CR Gebühr).

**Lösung:**
- `DungeonScene`: Block „Warp-Beacon channeling (hold R)“ (~Zeile 1419–1443) entfernen, ebenso `warpChannel`-Anzeige im Renderer, `warpCost`. `input.warpHeld()` bleibt im Input-Manager, wird aber nirgends mehr genutzt → entfernen, falls `noUnusedLocals` meckert.
- Touch: Button `WARP` entfernen, Layout der `tbtn-util`-Reihe prüfen (Lücke schließen).
- HUD-Steuerleiste: `R Extraktion` → `E Teleporter nutzen`. Text in `DungeonScene` ~Zeile 498 („Beute bleibt nur bei Extraktion [R] sicher!“) → „… nur an Teleportern sicher!“.
- **Rückkehr-Wege** (alle bestehen schon, außer der Bake):
  1. Start-Raum jeder Ebene: `[E] Extraktion` (gratis) — bleibt.
  2. Nach jedem Boss: Extraktions-Teleporter links — bleibt.
  3. **Neu: Notfall-Bake** (E4) ab Ebene II: in `generateSectorFloor()` **nach** allen Zufallsaufrufen des Layouts, mit eigenem `mulberry32(hashString(floorKey + ':beacon'))` einen Kampfraum (nicht Start/Boss/Schatz/Geheim/Rift) wählen → `room.extractBeacon = { x, y, used: false }` (Position per `findFreeSpotSpiral`). Erscheint erst, wenn der Raum geräumt ist. `[E] Notfall-Bake: Extraktion (einmalig)`. Darstellung: kleine Säule mit pulsierendem Cyan-Licht (prozedural, `drawGlow`), Minimap-Symbol.
  4. Niederlage: wie heute.
- Prüfung: keine Bake (`isWeeklyTrial` → nicht erzeugen bzw. nach Generierung löschen; eigener RNG ⇒ Layout unverändert).
- Achtung: Upgrades/Bots/Texte, die den Warp erwähnen (`rg -n "Warp|warp" src/`), anpassen. Halo/Luma unverändert.

**Akzeptanz:** `m10cp6`: `R` halten 3 s → kein Rücksprung. Bake erscheint auf Ebene II/III genau einmal pro Ebene, nie auf Ebene I, nie in der Prüfung; Nutzung → `onReturnToHub` mit `reason: 'warp'`. Layout-Hash (m10p4) unverändert.

### 4.8 G3 — Einzigartige Bosse

**Ist-Stand:**
| Sektor | Ebene I | Ebene II | Ebene III (Sektor-Endboss) |
| :--- | :--- | :--- | :--- |
| S1 | `boss_breacher` — **Recolor** von `boss.png`, eigene KI | `boss` Kern-Wächter (eigene KI, `boss.png`) | `boss_leviathan` (eigen) |
| S2 | `boss_quartz_golem` (Golem-KI) | `boss_prism_weaver` (Weber-KI) | `boss_prisma_archon` (Archon-KI, eigenes Sprite) |
| S3 | `boss_slag_overlord` = **Golem-KI**, Sprite `forgeGolem` vergrößert | `boss_forge_warden` = **Weber-KI**, Sprite `emberStalker` | `boss_vulkan_titan` = **Archon-KI**, eigenes Sprite |
| S4 | `boss_chrono_sentinel` = **Weber-KI**, Sprite `chronoEye` | `boss_monolith_colossus` = **Golem-KI**, Sprite `monolithGuard` | `boss_star_archon` = **Archon-KI**, eigenes Sprite |

Einzigartig sind heute nur 5 von 12 (S1 F2/F3, S2 F1–F3). **Ziel:** jede Ebene eigenes Aussehen **und** eigenes Bewegungs-Set (mind. 3 Angriffe + Phase-2-Variante ab 50 % HP). Sektor-Endboss (F3) schaltet wie heute den nächsten Sektor frei.

**Technik:**
- Jedes neue Bewegungs-Set in eine **eigene Datei** `src/dungeon/bosses/<name>.ts` mit `export function update<Name>AI(ai: EnemyAI, e: Enemy, dt: number, ctx: BossCtx): void` (BossCtx = `{ dx, dy, nx, ny, dist }`). `enemyAi.ts` ruft nur noch auf. So bleibt `enemyAi.ts` übersichtlich (heute 2360 Zeilen).
- Zustände über die bestehenden Felder `bossState`, `bossStateTimer`, `bossStateMax`, `bossPhase2` (keine neuen Felder, wenn es sich vermeiden lässt; sonst optional in `dungeonTypes.ts`).
- Telegraphie: **jeder** gefährliche Angriff hat ≥ 0,45 s sichtbare Vorwarnung (Bodenmarkierung/Linie/Glühen), Phase 2 darf auf ≥ 0,35 s verkürzen.
- `bossStatusText` und Boss-Namen (`dungeonRenderer` ~Zeile 3398) pflegen; Sieges-Toasts (`DungeonScene` ~2918–3125) bleiben.
- Musik-Phase-2 (M10-A) funktioniert automatisch über `bossPhase2`.
- **Sprites:** neuer Block `BOSS_OPTIONAL_SPRITES` in `artLoader.ts` (wie `M10_OPTIONAL_SPRITES`, inkl. Flash-Silhouette). `scripts/check-sprites.mjs` so erweitern, dass es **alle** `*_OPTIONAL_SPRITES`-Blöcke liest. Fallback: bisheriges Sprite **plus** deutliche Unterscheidung (eigene Farbgebung per Offscreen-Tint **und** prozedurale Zusatzteile, z. B. Hörner, Kristallkranz, Ringe) — nie nur Recolor.
- Prompts (Formel B, 128×128, Datei `public/art/sprites/boss_<id>.png`) in `ART_AND_DESIGN_GUIDE.md` §8 „Boss-Prompts“.

**Neue/überarbeitete Bosse (Design-Vorgabe):**

| Slot | Name (neu) | Look | Angriffe (Phase 1) | Phase 2 (< 50 % HP) | Sprite-Key |
| :--- | :--- | :--- | :--- | :--- | :--- |
| S1 F1 | **Schrott-Sammler „Krall“** (ersetzt Breacher-Look) | Spinnenartiger Bergungsroboter mit Greifarm & Magnet | 1) Magnet-Zug: zieht Spieler 1 s an (telegraf. Ring) · 2) Schrott-Wurf: 3 Kisten-Geschosse im Fächer · 3) Greifarm-Stoß (Linie, 0,6 s Warnung) | Schrott-Hagel: 6 Bodenmarkierungen, dann Einschläge | `bossScrapCollector` |
| S1 F2 | Kern-Wächter MK-IV | bleibt (`boss.png`) | bestehende KI | bestehend | – |
| S1 F3 | A.E.G.I.S. Leviathan | bleibt | bestehend | bestehend | – |
| S2 F1 | Quarz-Koloss MK-I | bleibt | bestehende Golem-KI | bestehend | (Sprite prüfen) |
| S2 F2 | Prisma-Weberin | bleibt | bestehende Weber-KI | bestehend | (Sprite prüfen) |
| S2 F3 | ★ Prisma-Archon | bleibt | bestehende Archon-KI | bestehend | – |
| S3 F1 | **Schlacken-Koloss** | Lava-Golem, Schlacke tropft | 1) Schlacke-Pfützen (bleiben 6 s, Schaden/Sek.) · 2) Bodenwelle in Linie · 3) Rollangriff quer durch den Raum (prallt an Wänden) | Pfützen entzünden sich nacheinander (Kettenreaktion) | `bossSlagColossus` |
| S3 F2 | **Gießerei-Meisterin** | Schmiedin mit glühendem Hammer & Gussformen | 1) Gussform-Fallen: 3 Rechtecke leuchten, dann Guss · 2) Funken-Kegel (180°) · 3) springt zu Amboss-Punkten (2–3 Positionen) | ruft 2 Schmelz-Düsen (nutzt M10-Mechanik-Optik, nur für diesen Kampf) | `bossForgeMistress` |
| S3 F3 | ★ Vulkan-Titan | bleibt Sprite | **neue KI:** 1) Meteor-Regen mit Schattenmarken · 2) Lava-Ring nach außen (Lücke zum Durchlaufen) · 3) Erdspalten-Kreuz | Raum-Rand wird Lava (Arena schrumpft um 20 px) | – |
| S4 F1 | **Chrono-Wächter** | Uhrwerk-Auge mit Zeigern | 1) Zeit-Echo: Spieler-Position von vor 2 s wird zum Explosionspunkt · 2) Zeiger-Laser (rotierend, 2 Zeiger) · 3) Verlangsamungs-Feld (Spieler −40 % Tempo) | Zeiger drehen gegenläufig + schneller | `bossChronoWarden` |
| S4 F2 | **Monolith-Koloss** | Steinriese aus schwebenden Platten | 1) Platten-Schild: 4 kreisende Platten blocken Geschosse · 2) Platten-Wurf (einzeln, zielend) · 3) Erdstoß (Kreis) | Platten werden zu Säulen im Raum (Deckung für beide Seiten, zerbrechlich) | `bossMonolithColossus` |
| S4 F3 | ★ Sternen-Archon | bleibt Sprite | **neue KI:** 1) Sternbild-Linien zwischen 4–6 Punkten (Laser nach Warnung) · 2) Gravitations-Brunnen zieht an · 3) Supernova-Orbs, die nach 1,5 s in 8 Richtungen platzen | Sternbilder werden doppelt + Brunnen bewegt sich | – |

- Bestehende Golem/Weber/Archon-KIs bleiben **nur** für ihre Original-Bosse (S2).
- Neue KIs dürfen bestehende Projektil-/Schockwellen-/Decal-Systeme nutzen (`scene.shockwaves`, `scene.decals`, Projektil-Arrays) — keine neuen Render-Systeme, wo vorhandene reichen.
- HP der neuen/geänderten Bosse kommen aus Phase 8 (Kalibrierung), bis dahin die heutigen Werte.

**Akzeptanz je Boss** (`m10cp7<x>`): Boss spawnt, durchläuft jeden Angriffs-Zustand mindestens einmal in ≤ 40 s Simulation (Spieler unverwundbar per Test-Hook), Phase 2 startet bei < 50 % HP, kein `pageerror`, Screenshot pro Angriff mit sichtbarer Telegraphie ansehen. Sieg → Teleporter erscheinen wie heute, `sectorNCleared` nur bei F3.

### 4.8b G4 — Gegner-Schilde mit Counterplay (ergänzt bei der Umsetzung)

Im ursprünglichen Plan fehlte dafür ein eigener Abschnitt; Umsetzung als **Phase 6b**.
- Betroffen: `shield_drone`, `resonance_warden` (Werte in `ENEMY_SHIELDS`, `src/data/balance.ts`).
- **Frontal 100 % Block** (kein Schaden), Treffer von Seite/Rücken wirken voll, durchdringende Angriffe (Speer-Lanze) ignorieren den Schild (E8).
- **Fenster 1 — Angriff:** Beginnt der Gegner seinen Angriff (Telegraph), fällt der Schild für `attackOpenSec` (≈ 1 s, inkl. Nachwirkung).
- **Fenster 2 — Überhitzung:** Jeder geblockte Treffer erhöht `shieldHeat`. Bei `maxHeat` (Drohne 4, Wächter 5) überhitzt der Schild für `overheatSec` (≈ 2,5 s). Hitze klingt mit `1 / SHIELD_HEAT_DECAY_SEC` pro Sekunde ab.
- Darstellung (`renderShieldArc`): intakt (Grundfarbe), aufgeheizt (ab 70 % orange, dicker), unten (gestrichelt grau + ▼). Floating-Text „BLOCK“ / „ÜBERHITZT!“.
- Test: `m10cp6b` (Block, Überhitzen, Angriffsfenster, Rücken, Durchdringen, Abklingen, Wächter).

### 4.9 BA1 — Ökonomie & Power-Scaling

**Zentrale Datei** `src/data/balance.ts` (neu) — alle Stellschrauben an einem Ort:
```ts
export const SELL_PRICE_MULT = 0.65;      // E7
export const BOUNTY_REWARD_MULT = 0.75;
export const EARLY_TIER_DAMAGE_STEPS = [1.0, 1.2, 1.4, 1.6]; // E6a: Faktor auf Stufe 0 für Stufen 0–3
export const EARLY_UPGRADE_MATERIAL_MULT = 1.5;               // E6b: Stufen 1–3
export const WEAPON_TIER_GATES: Record<number, TierGate> = { /* s.u. */ };
export const BOSS_HP: Record<BossKind, number> = { /* Phase 8 */ };
export const RIFT_SCALING = { /* §4.11 */ };
```

1. **Verkaufspreise:** Alle Stellen, die `item.baseValue` als Geldwert benutzen, über eine Funktion `getBaseValue(item)` (= `Math.round(baseValue * SELL_PRICE_MULT)`) leiten. Fundorte: `rg -n "baseValue" src/` — mindestens `systems/economy.ts`, `systems/haggle.ts`, Markt-Terrasse/`guildMarket.ts`, Nyx-Ankauf, Bank. Codex-Preise bestehender Saves: Bekannte Preise (`codex`) sind gelernte Werte → beim Laden einmalig ×0,65 skalieren, **nur** wenn eine Markierung fehlt (`codex._priceScaleV2`). Braucht das ein neues Save-Feld → optional, Default `false`, Save v12.
2. **Kopfgelder:** Belohnung ×`BOUNTY_REWARD_MULT` bei der Erzeugung neuer Aufträge.
3. **Flachere frühe Schadensstufen (E6a):** In `getPlayerCombatStats()` (`upgrades.ts` ~Zeile 1056 ff.) für **jede** Waffe die Stufen 1–3 neu = `round(Stufe0 × EARLY_TIER_DAMAGE_STEPS[i])`, Stufen 0 und 4–7 bleiben. Beispiel Klinge: heute `20, 28, 38, 52, 70 …` → neu `20, 24, 28, 32, 70 …`. Der Sprung auf Stufe 4 ist gewollt: Stufe 4 gibt es erst nach Sektor 1 (Sperre unten) und fühlt sich wie eine Belohnung an. Blaster-Cooldowns und Reichweiten bleiben. Die Tabellen dafür nicht kopieren, sondern im Code aus den bestehenden Arrays ableiten (Hilfsfunktion `flattenEarly(arr)`).
4. **Frühe Upgrades teurer (E6b):** Material-Mengen der Waffen-Stufen 1–3 ×`EARLY_UPGRADE_MATERIAL_MULT` (aufrunden). Ab Stufe 2 muss mindestens **ein** Material aus Sektor 1 Ebene II stammen (ein passendes vorhandenes Item aus `items.ts` wählen, das erst ab Ebene II droppt; Auswahl in §9 notieren). Credit-Kosten unverändert (Geld ist nicht knapp).
5. **Waffen-Stufen-Sperren (E6c):** Stufe = Index in den Schadenstabellen.
   | Ziel-Stufe | Bedingung |
   | :--- | :--- |
   | 1–2 | keine |
   | 3 | Sektor 1 Ebene II erreicht (`deepestFloor ≥ 2`) |
   | 4 | Sektor 1 abgeschlossen |
   | 5 | Sektor 2 Ebene II erreicht |
   | 6 | Sektor 2 abgeschlossen |
   | 7 | Sektor 3 abgeschlossen |
   - Prüfung in `canAffordUpgrade`/`purchaseUpgrade` (nur Waffen-Tracks), Anzeige in der Schmiede: `🔒 Benötigt: Sektor 1 abgeschlossen`. Bereits gekaufte Stufen bleiben.
6. **Boss-HP kalibrieren** (Phase 8, **nach** 3–5): Playwright-Test `m10cp8` importiert im Browser `getPlayerCombatStats()` und berechnet je Waffe die DPS = `Schaden / Angriffs-Cooldown` (Tabellen **nicht** duplizieren). **Erwartete Ausrüstung** je Boss = höchste Stufe, die laut Sperre an dem Punkt kaufbar ist, Durchschnitt über die 3 besten Waffen. Ziel-Kampfdauer (reine Schadenszeit, ohne Ausweichen):
   | Boss | Ziel-TTK | 
   | :--- | :--- |
   | Ebene I | 20–30 s |
   | Ebene II | 30–45 s |
   | Ebene III (Endboss) | 45–65 s |
   Zusatz-Check normale Gegner: mit erwarteter Ausrüstung braucht ein Standard-Gegner der jeweiligen Ebene **2–4 Treffer** (Spieler soll sich stark fühlen, aber nicht alles mit einem Schlag umhauen).
   HP so setzen, dass die erwartete TTK in der Mitte des Bandes liegt; Werte in `BOSS_HP` eintragen und `spawnEnemy()` liest sie (bestehende Multiplikatoren für Ebene/NG+/bossCount bleiben). **Startwerte**, falls die Messung scheitert: S1 F1 380 · F2 560 · F3 950; S2–S4 jeweils heutiger Wert ×1,3.
7. **Ökonomie-Bericht (E7):** `m10cp8` schreibt zusätzlich `tests/out/economy.json`: Verkaufspreis von 10 Referenz-Items (je Seltenheit), Kosten der Waffen-Stufen 1–4 (Credits + Materialien), Kopfgeld-Spanne. Der Bericht **schlägt nicht fehl** — er ist die Grundlage für spätere Nachjustierungen. In `HANDOFF.md` unter „Offene Punkte“: „Ökonomie regelmäßig anhand `tests/out/economy.json` und Spielgefühl nachjustieren (`src/data/balance.ts`).“

**Akzeptanz:** `m10cp8` gibt eine TTK-Tabelle aus (auch in `tests/out/ttk.json`) und schlägt fehl, wenn ein Boss außerhalb seines Bandes liegt oder ein Standard-Gegner außerhalb 2–4 Treffern. Bestehende Saves: bereits gekaufte Stufen behalten ihre Stufe (der Schaden folgt der neuen Tabelle). Verkaufspreis eines Referenz-Items sinkt um 35 % (±1 CR Rundung).

### 4.10 BA2 — Bot-Freischaltung

`src/data/companions.ts` → `evaluateCompanionUnlock()`:
| Bot | Heute | Neu |
| :--- | :--- | :--- |
| Sammel-Bot „Puck“ | 15 Verkäufe **oder** Shop Stufe II | **60 Verkäufe und** Shop Stufe II |
| Kampf-Bot „Spark“ | Breacher besiegt + 30 Gegner | **Kern-Wächter (S1 F2) besiegt + 200 Gegner** |
| Heil-Bot „Luma“ | Kern-Wächter besiegt | **Sektor 1 abgeschlossen + 4 Boss-Siege gesamt** |
| Aegis-Bot „Halo“ | Sektor 1 abgeschlossen | **Sektor 2 abgeschlossen** |

- Fortschrittstexte/`ratio` entsprechend (beide Bedingungen je 50 %).
- Schon freigeschaltete Bots bleiben (`unlockedCompanions` wird nie zurückgesetzt).
- Drohnen-Konsole im Hinterzimmer zeigt die neuen Texte automatisch — prüfen.

**Akzeptanz:** Unit-Test (in `m10cp9`) mit gestellten Snapshots für jede Grenze (knapp drunter/genau drauf).

### 4.11 BA3 — Instabile Risse

Heute: Rift-Kammer = 2 Elite-Wellen, HP ×1,16 (×1,25 bei „armored“), zufälliger Mutator.

Neu (`RIFT_SCALING` in `balance.ts`, angewendet in `spawnEnemy()` und `damagePlayer()` für `currentRoom.isRiftChamber`):
- **HP-Faktor** = `1.6 + 0.25·(Ebene−1) + 0.35·(Sektor−1)` → S1F1 1,6 · S1F3 2,1 · S4F3 3,15
- **Schadens-Faktor** (auf Schaden **am Spieler**) = `1.3 + 0.1·(Ebene−1) + 0.15·(Sektor−1)`
- **Wellen:** Ebene I: 2 · Ebene II: 3 · Ebene III: 3 + jede Welle mit einem **Elite** (×2 HP, goldener Rand, immer Mutator)
- **Belohnung** bleibt (garantierte Katalysatoren) + Ebene III: +1 zusätzlicher Katalysator. Kein Credit-Drop (Invariante!).
- Betreten-Prompt zeigt Gefahr: `[E] 🌀 Instabilen Rift betreten · Gefahr ★★☆` (Sterne aus Ebene/Sektor).
- Endlose Spirale (`isEndlessRift`) **nicht** ändern — eigene Skalierung existiert.

**Akzeptanz:** `m10cp9`: Faktoren für alle 12 Kombinationen, Wellenanzahl, Elite pro Welle auf Ebene III, Prüfung hat weiterhin keine Risse.

---

## 5. Betroffene Dateien (Überblick)

| Datei | Phasen |
| :--- | :--- |
| `src/dungeon/navGrid.ts` (neu) | 1 |
| `src/dungeon/enemyAi.ts` | 1, 7 |
| `src/dungeon/mechanicsGen.ts` | 2, 6 |
| `src/world/dungeonGen.ts` | 2, 6, 9 |
| `src/scenes/DungeonScene.ts` | 1, 2, 6, 7, 8, 9 |
| `src/dungeon/dungeonRenderer.ts` | 3, 6, 7 |
| `src/dungeon/bosses/*.ts` (neu) | 7 |
| `src/ui/UIManager.ts`, `src/style.css` | 3, 4 |
| `src/ui/LoadoutPanel.ts` (neu) | 4 |
| `src/ui/TouchControls.ts` | 6 |
| `src/systems/gameState.ts` | 4, 5, 8 |
| `src/scenes/ShopScene.ts`, `BackroomScene.ts`, `HangarScene.ts`, `src/main.ts` | 4, 5 |
| `src/data/balance.ts` (neu), `upgrades.ts`, `companions.ts`, `items.ts`-Nutzer | 8, 9 |
| `src/assets/artLoader.ts`, `scripts/check-sprites.mjs` | 0, 7 |
| `src/systems/weeklyTrial.ts` | 10 |

---

## 6. Vorgehensplan (Phasen in Reihenfolge)

Jede Phase: Code → neuer Test `tests/m10cp<N>.cjs` → `npm run verify` → Screenshots ansehen → Commit `feat(m10c): Phase N – …`.

### Phase 0 — Fundament
- `tests/run.cjs`: Dateinamen-Filter auf `/^(t\d|m\d+[a-z]?p)/` erweitern (damit `m10cp*` mitläuft).
- `scripts/check-sprites.mjs`: alle `export const <NAME>_OPTIONAL_SPRITES = { … } as const`-Blöcke lesen (Regex über alle Treffer).
- `src/data/balance.ts` mit den Konstanten aus §4.9/§4.11 anlegen (ohne Treffer-Deckel) (noch ungenutzt → keine `noUnusedLocals`-Fehler, da `export`).
- Test `m10cp0`: `balance.ts` importierbar, check-sprites findet weiterhin 12 M10-Sprites.

### Phase 1 — B1 Navigation
§4.1. Screenshot: Slime umläuft Kiste (3 Frames als Bildfolge).

### Phase 2 — B2 Portal-Platz
§4.2. Achtung Invariante 2 — `m10p4` muss grün bleiben.

### Phase 3 — U1 + U2 HUD
§4.3 + §4.4. Screenshots aller Szenen in drei Auflösungen ansehen.

### Phase 4 — U3 Waffenschrank
§4.5.

### Phase 5 — G1 Tag/Nacht
§4.6. Danach alle bestehenden Tests laufen lassen (Story-Festival, Laden-Tests hängen an der Zeit).

### Phase 6 — G2 Teleport
§4.7. Danach Touch-Screenshots Hoch-/Querformat.

### Phase 6b — G4 Gegner-Schilde
§4.8b. Screenshot: Schild intakt / aufgeheizt / unten.

### Phase 7 — G3 Bosse (Teil-Commits)
- **7a** Boss-Gerüst: `src/dungeon/bosses/`, `BossCtx`, `BOSS_OPTIONAL_SPRITES`, Tint-Fallback-Helfer, Art-Guide §8. Bestehende Bosse unverändert.
- **7b** S1 F1 „Krall“.
- **7c** S3 F1 Schlacken-Koloss + S3 F2 Gießerei-Meisterin.
- **7d** S3 F3 Vulkan-Titan (neue KI).
- **7e** S4 F1 Chrono-Wächter + S4 F2 Monolith-Koloss.
- **7f** S4 F3 Sternen-Archon (neue KI).
- Nach jedem Teil: Boss-Screenshots ansehen, `HANDOFF.md` „Fehlende Sprites“ ergänzen.

### Phase 8 — BA1 Ökonomie & Scaling
§4.9 inkl. TTK-Messung. Ergebnis-Tabelle in §9 eintragen.

### Phase 9 — BA2 Bots + BA3 Risse
§4.10 + §4.11.

### Phase 10 — Abschluss
- Prüfungs-Par-Zeiten (`TRIAL_PAR_TIMES`): mit dem TTK-Verhältnis alt/neu skalieren, Wert dokumentieren.
- Doku: `GAME_DESIGN_DOCUMENT.md` (Status M10-C, neue Tag/Nacht-Regel, Boss-Tabelle), `AGENTS.md` (Abschnitt „How to add a Boss“ auf `src/dungeon/bosses/` + `BOSS_OPTIONAL_SPRITES` umstellen; Tag/Nacht-Regel), `ART_AND_DESIGN_GUIDE.md` §8, `TESTING_AND_VERIFICATION.md` (neue Tests/Hooks), `HANDOFF.md`, dieses Dokument Status ✅ + §9.
- Abschlussmeldung an den Inhaber: Abweichungen, TTK-Tabelle, **fehlende Sprites** (Liste aus `npm run check:sprites`).

---

## 7. Gesamt-Verifikation vor dem finalen Push
- `npm run verify` grün (Build, Invarianten, Sprite-Check, **alle** Tests inkl. M9/M10-A).
- Manuell per Screenshot: Laden nachts offen, Nacht-Run-Hinweis am Schiff, Koje tagsüber ohne Schlafen, Dungeon-HUD mit freier Minimap (Hoch/Quer), Waffenschrank-Modal, jeder neue Boss mit Telegraphie, Portal-Raum, Notfall-Bake, Rift-Kammer Ebene III mit Elite.
- `rg -n "Math\.random" src/dungeon/mechanicsGen.ts src/dungeon/navGrid.ts` → 0 Treffer.

---

## 8. Bekannte Fallstricke
| Fallstrick | Vermeidung |
| :--- | :--- |
| Portal-Suche oder Bake verbraucht Zufall im Generator → alle Prüfungs-Layouts ändern sich | Spirale ist deterministisch, Bake nutzt eigenen `mulberry32`. `m10p4` laufen lassen. |
| Navigation ändert Verhalten von Fernkämpfern/Bossen | `steer()` nur für Bodenläufer und nur bei blockierter Sichtlinie. |
| Fluss-Feld auf `scene.time` getaktet → driftet nach Pausen | `mechanicsClock` benutzen (wird in `enterRoom` zurückgesetzt). |
| HUD-Prozentwerte stimmen nicht, wenn `#hud-layer` Padding hat | Positionen auf ein inneres absolut positioniertes Element ohne Padding beziehen oder Padding herausrechnen; mit `getBoundingClientRect` testen. |
| Tag/Nacht: Story-Festival/Kapitel-Toasts erwarten alte Reihenfolge | Bestehende M10-Tests laufen lassen; Festival hängt am Betreten der Promenade, nicht an der Zeit. |
| Laden-Tests (t-Serie) öffnen den Laden tagsüber | Im Test vorher `state.timeOfDay = 'night'` setzen — **nicht** die Regel aufweichen. |
| Flachere frühe Stufen machen Sektor 1 Ebene III zäh | TTK-Test deckt den Leviathan inkl. Arme ab; Boss-HP an das neue Band anpassen, nicht die Tabellen. |
| Nacht-Run: Zeit beim Run-Start vergessen → falscher Übergang | `runStartedAtNight` beim Start in `main.ts` setzen, im Test beide Wege prüfen. |
| Codex-Preise doppelt skaliert | Markierung `_priceScaleV2` prüfen, Test lädt einen alten Save zweimal. |
| Neue Boss-KI wird in der Prüfung mit NG+ skaliert | Prüfung setzt NG+ auf 0 (bestehend) — nichts tun, nur testen. |

---

## 9. Umsetzungsnotizen

**Gemessene Boss-Kampfdauer** (reine Schadenszeit bei erwarteter Ausrüstung, `tests/m10cp8.cjs` → `tests/out/ttk.json`):

| Boss | Basis-HP | Stufe | Zeit |
| :--- | ---: | :---: | ---: |
| S1 E1 Krall (`boss_breacher`) | 2700 | 2 | 24,9 s |
| S1 E2 Kern-Wächter (`boss`) | 4700 | 3 | 37,1 s |
| S1 E3 Leviathan | 6900 | 3 | 54,5 s |
| S2 E1 Quarz-Koloss | 7100 | 4 | 25,0 s |
| S2 E2 Prisma-Weberin | 10650 | 4 | 37,4 s |
| S2 E3 ★ Prisma-Archon | 21600 | 5 | 54,9 s |
| S3 E1 Schlacken-Koloss | 13400 | 6 | 24,9 s |
| S3 E2 Gießerei-Meisterin | 20100 | 6 | 37,4 s |
| S3 E3 ★ Vulkan-Titan | 29500 | 6 | 54,9 s |
| S4 E1 Chrono-Wächter | 18300 | 7 | 25,0 s |
| S4 E2 Monolith-Koloss | 27500 | 7 | 37,5 s |
| S4 E3 ★ Sternen-Archon | 40300 | 7 | 55,0 s |
| Omega-Archon | 47600 | 7 | 64,9 s |

Methode: DPS = Schaden ÷ `WEAPON_AVG_COOLDOWN` (Blaster: Cooldown aus den Stats), Mittel über **alle sechs** Waffen auf der Stufe, die die Fortschritts-Sperren zulassen. Das echte Gefecht dauert wegen Ausweichen ca. 1,6–2× länger. Alte Boss-HP waren 255–2950 (≈ ×10 niedriger); daher der „fast One-Hit“-Eindruck.

**Waffen-Schaden Stufe 0–4** (Klinge): `20 · 24 · 28 · 32 · 70` (vorher `20 · 28 · 38 · 52 · 70`). Der Sprung auf Stufe 4 ist gewollt (Belohnung nach Sektor 1). Standard-Gegner: bei erwarteter Ausrüstung 1–4 Treffer (S1: 2–4, ab S2 meist 2).

**Ökonomie (Startwerte, bewusst iterativ):** `SELL_PRICE_MULT = 0.65`, Kopfgelder ×0,75 (Ø ≈ 473 Cr, 75–1310). Nyx-Preise unverändert (Geldsenke). Frühe Upgrades: Material ×1,5 (aufgerundet), Stufe 2 zusätzlich 1× `reactor_shard` (Ebene-II-Drop). Fortschritts-Sperren laut §4.9. Altspielstände: gelernte Codex-/Podest-Preise einmalig ×0,65 (`priceScaleV2`, optionales Feld, `SAVE_VERSION` bleibt 11).

**Wochen-Prüfung:** Boss-HP werden auf die normierte Stufe-4-Ausrüstung skaliert (`trialBossHpFactor`, neu — nicht im ursprünglichen Plan), damit die Kampfdauer dem Normalspiel entspricht (Summe je Sektor ≈ 117–125 s). Par-Zeiten **+180 s**: Gold 600/660/720/780, Silber 840/900/960/1020. Ein gepanzerter Wochen-Mutator gibt weiterhin ×1,3 HP. Referenz-Layout-Hash: siehe `m10p4` (`trialHash`).

**Abweichungen vom Plan:**
- **G4 Schilde** hatte im Plan keine eigene Phase → als Phase 6b nachgetragen (§4.8b).
- Phase 1 und 2 in einem Commit (gemeinsame Eingriffe in `DungeonScene`).
- `m10p4`: Referenz ist jetzt `trialHash` (ohne Portale, Rift-Kammern, Notfall-Bake, Mechanik-Felder), bestimmt am Stand **vor** M10-C. Der alte Gesamt-Hash ändert sich legitim, weil Portale nun auf freien Plätzen liegen.
- Navigation nur für Nahkampf-Bodenläufer (`slime`, `slime_magma`, `crystal_crawler`, `void_crawler`, `slag_beetle`, `astral_scarab`, `forge_golem`, `ember_stalker`, `phase_stalker`, `star_lancer`) — Schützen bleiben stehen. `runStartedAtNight` war unnötig, weil sich die Zeit während eines Runs nicht ändert.
- Portal-Ausschluss auch für Teleporter-Pads und Prismen (nicht nur Düsen/Platten).
- Notfall-Bake: drei Durchgänge (großzügig → knapp → Magnetplatten/Spawns dürfen überlappt werden), damit sie auch in sehr dichten Räumen existiert; Position über eigenen PRNG, nicht in der Prüfung.
- **Bosse behalten ihre `kind`-Namen** (Fortschritt/Achievements hängen daran): `boss_breacher` ist jetzt Krall, der alte Breacher-KI-Code ist entfernt. Eigene Zug-Engine in `src/dungeon/bosses/`. Monolith-Säulen sind (noch) nicht zerbrechlich.
- Boss-Optik: 5 optionale Sprites (`BOSS_OPTIONAL_SPRITES`), **alle fehlen** → eingefärbte Fallbacks mit eigenen Merkmalen (Beine/Magnet, Lavarisse, Hammer, Uhr-Ring, Platten); Vulkan-Titan (Lavakrone) und Sternen-Archon (Sternbild-Ring) behalten ihre Sprites + prozedurale Merkmale.
- Touch-Deck: oben HEIL · INTER · SEKUNDÄR, unten DASH + große Angriffstaste (WARP-Taste entfällt).
- Bot-Hürden wie geplant; `breacherDefeated` wird nicht mehr ausgewertet.
- Rift: dritte Welle und Elite-Mutatoren deterministisch (Gegner-ID), Gefahr-Sterne aus dem HP-Faktor (<2,0 = ★, <2,6 = ★★, sonst ★★★).
- Test `m10cp8` lässt 1–5 Treffer für Standard-Gegner zu (statt 2–4), weil Gegner späterer Sektoren mit erwarteter Ausrüstung in 1–2 Treffern fallen (Spieler-Stärke ist gewollt).

---

## 10. Verknüpfte Dokumente
- [AGENTS.md](AGENTS.md) · [HANDOFF.md](HANDOFF.md) · [MILESTONE_10_ARCHITECTURE.md](MILESTONE_10_ARCHITECTURE.md) (Mechaniken, Seed-Regeln) · [MILESTONE_9_ARCHITECTURE.md](MILESTONE_9_ARCHITECTURE.md) (Prüfung) · [ART_AND_DESIGN_GUIDE.md](ART_AND_DESIGN_GUIDE.md) · [TESTING_AND_VERIFICATION.md](TESTING_AND_VERIFICATION.md)
