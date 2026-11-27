# Testing & Verification Playbook: *STARLIGHTER*

> **Zweck:** Dieses Dokument beschreibt exakt, wie in *STARLIGHTER* nach jedem Feature, Refactoring oder Meilenstein getestet wird — inkl. Build-Checks, Design-Invarianten, Headless-Chrome-CDP-Verifikation, visueller Screenshot-Prüfung und bekannter Stolperfallen. Zukünftige Chats sollen diesen Ablauf vor jedem Push auf `main` verwenden.

---

## 1. Standard-Verifikations-Pipeline (Vor jedem Commit/Push)

1. **Alles auf einmal:**
   ```bash
   npm run verify   # build (tsc + vite) → check:invariants → check:sprites → alle Playwright-Tests
   ```
   - `npm run build`: `tsc` (strikt: `verbatimModuleSyntax`, `erasableSyntaxOnly`, `noUnusedLocals`, `noUnusedParameters`) + `vite build` inkl. Chunk-Splitting (`firebase` in `vite.config.ts`; Dungeon-Code und Firebase-SDK laden per `import()` nach).
   - `npm run check:invariants`: Zero-Dungeon-Credits (`state.credits +=` in `src/scenes/DungeonScene.ts` und ganz `src/dungeon/`) und kein `Math.random` in `mechanicsGen.ts`. Gleichwertig von Hand: `rg -n "state\.credits\s*\+=" src/scenes/DungeonScene.ts src/dungeon/` → 0 Treffer.
   - `npm run check:sprites`: listet fehlende optionale Sprites/Rigs (nur Hinweis).
   - `npm test` (`tests/run.cjs` → `tests/harness.cjs`: startet 1× Vite-Dev-Server auf Port 4197 + 1× Playwright-Chromium und führt alle Tests parallel in isolierten `BrowserContext`s aus, steuerbar via `TEST_JOBS=N`; einmalig `npx playwright install chromium`). Einzelne Tests: `npm test -- m10p3 t5`.
2. **Savegame-Kompatibilität:** Neue Felder in `SaveData` (`src/types.ts`) müssen optional (`?`) sein und in `GameState.load()` (`src/systems/gameState.ts`) mit Defaults geladen werden.
3. **Screenshots ansehen:** Tests legen PNGs in `tests/out/` ab (gitignored). **Pflicht:** jeden relevanten Screenshot visuell prüfen (Text-Umbrüche, Überlappungen, Prompt-Positionen, Sprite-Ränder, Kontrast).
4. **Push:** Erst wenn `npm run verify` grün ist und die Screenshots sauber aussehen (siehe `AGENTS.md` §3 Regel 6/8; zuletzt `HANDOFF.md` aktualisieren).

**Neue Tests** als `tests/<name>.cjs` nach dem Muster bestehender Tests schreiben (Namensschema `t\d…`, `m\d+[a-z]?p…`, sonst nimmt `tests/run.cjs` sie nicht auf) und mit `npm test -- <name>` ausführen. Test-Hooks & Stolperfallen: §3 und die Abschnitte je Meilenstein unten.

---

## 1b. Automatisierte Tests im Repo (seit M10-A)

- `tests/*.cjs` (Playwright, Vite-Dev-Server auf Port 4197) laufen über `npm test` (alle) bzw. `npm test -- m10p3 t5` (einzelne). `tests/harness.cjs` startet Vite + Chromium; Screenshots landen in `tests/out/` (gitignored). Einmalig `npx playwright install chromium`.
- `npm run check:invariants` prüft die harten Regeln aus AGENTS.md (ohne `rg`), `npm run check:sprites` listet fehlende optionale Sprites, `npm run verify` führt alles zusammen aus.


### Tests & Fallstricke für Meilenstein 10-C

| Test | Prüft |
| :--- | :--- |
| `m10cp0` | `balance.ts`, `check:sprites` über alle `*_OPTIONAL_SPRITES`-Blöcke |
| `m10cp1` | Navigation (Wand-Umgehung), freie Bahn unverändert |
| `m10cp2` | Portal nur auf freiem Platz, Seed-Treue der Prüfungs-Layouts |
| `m10cp3` | HUD je Szene/Auflösung (Minimap frei), Ton-Zyklus |
| `m10cp4` | Waffenschrank/Loadout-Panel |
| `m10cp5` | Tag/Nacht-Zustandsfolge (Laden, Koje, Tag-/Nacht-Run, Prüfung) |
| `m10cp6` / `m10cp6b` | Notfall-Bake & fehlender R-Teleport · Gegner-Schilde |
| `m10cp7` | alle Boss-Züge + Phase 2 (Simulation), Zonen-Geometrie |
| `m10cp8` | Preise, Waffenstufen, Sperren, Boss-Kampfdauer, Preis-Migration, schreibt `tests/out/ttk.json` & `economy.json` |
| `m10cp9` | Bot-Hürden, Rift-Faktoren/Wellen/Elite |
| `m10cp10` | Wochen-Prüfung: Boss-Kampfdauer, Par-Zeiten |

- **Referenz-Hash der Prüfung (`m10p4`):** `trialHash` enthält absichtlich **keine** Portale/Rift-Kammern/Notfall-Bake/Mechanik-Felder (die Prüfung löscht oder erzeugt sie nicht). Ändert sich der Wert, haben sich die Prüfungs-Layouts geändert.
- **Offene Modals blockieren Übergänge:** Ist ein Modal offen (z. B. Schicht-Zusammenfassung), läuft das Szenen-Fade nicht weiter. In Tests `ui.closeModal()` aufrufen, bevor auf einen Szenenwechsel gewartet wird.
- **Test-Daten nie ersetzen, nur befüllen:** `Object.assign(st.pedestals[0], …)` statt `st.pedestals[0] = {…}` (sonst fehlen `x/y` → `NaN` im Renderer → Spielschleife stirbt).
- **Prüfung + Wochen-Mutator:** Ist der Mutator „gepanzert“, haben Gegner ×1,3 HP. Für Kalibrier-Messungen `dng.activeRiftMutator = null` setzen.
- **Parallele Läufe:** Nie zwei Harness-Läufe gleichzeitig starten (Port 4197) und während `npm run verify` keine Quelldateien ändern.

- **Polish Teil 1 (`t7`):** Hintergrund-Pause (`sound.suspendForBackground/resumeFromBackground`, `firebaseService.flushAutoSync`), Geräte-Einstellungen `screenShake`/`vibration` (`shakeFactor()`).
- **Polish Teil 2 (`t7b`):** Schadenszahlen-Zusammenfassung (`FloatingNum.enemyId/sum/bornAt`), `DungeonScene.heavyStop` (Phase 2/Boss-/Elite-Kill; wird von normalen `hitStop`-Zuweisungen nicht überschrieben), Kern-Wächter-Schritte.
- **Dungeon lädt nach (`t8`):** `window.__game.dungeonScene` ist erst nach `await window.__game.dungeonReady` gesetzt (Tests, die die Szene direkt brauchen, müssen das abwarten). Run-Start über `g.transitionTo('dungeon', 'hangar')` wartet selbst.
- **Firebase (`t6`):** Das SDK lädt nach dem Start per `import('./firebaseSdk')`; Tests, die Cloud-Funktionen brauchen, erst `await firebaseService['ready']`. Keine Netzwerk-Aufrufe in Tests.

### Tests & Fallstricke für Meilenstein 11 (Rigs & Boss-Animation)
- **Tests:** `m11p0` (Import-Pipeline), `m11p1` (Rig-Engine), `m11p2` (Pose-Sets, Übergangs-Glätte < 0,2 rad/Frame, Zwischen-Posen, Zuordnung Zustand→Variante), `m11p3` (abgelöste Teile), `m11p4` (Teilen: gemeinsamer HP-Pool, Sieg nur einmal). `m11lab` (Boss-Labor) läuft nicht über `npm test`.
- **Test-Enemies brauchen `hp`/`maxHp`:** `getBossPose` liest die HP-Quote (stark beschädigter Kopf < 15 %); fehlt `maxHp`, gilt 100 %.
- **Frische Enemy-Objekte = ungeglättet:** `getBossPose` glättet pro Enemy-Objekt (WeakMap). Für Zustands-Prüfungen immer ein **neues** Objekt benutzen; für Übergangs-Tests dasselbe Objekt mit steigender `time`.
- **Dev-Server nach `rigs.json`-Änderung neu starten**, sonst liefert `import('/src/…')` im Browser eine zweite Modul-Instanz (leere Rigs).
- **Sichtprüfung:** `node scripts/rig-sheet.cjs core_warden` (Kontaktbogen in `tests/out/`), im Spiel `?bosslab` (Pause, 0,25×, „Phase II“).

---

## 3. Wichtige Stolperfallen & Lösungen (Lessons Learned)

| Stolperfalle | Ursache | Lösung |
| :--- | :--- | :--- |
| **Dungeon-Screenshot ist komplett schwarz** | `DungeonScene.enterRoom()` setzt `this.roomFade = 0.22` (Voll-Fade auf Frame 0). | Vor `dng.render(ctx, inp)` immer `dng.roomFade = 0` setzen! |
| **Sprites wirken verwaschen oder halb groß** | Canvas hat `960×540` Buffer über `480×270` Logik-Koordinaten (`RENDER_SCALE = 2`). | Vor manuellem `scene.render(ctx)` immer `ctx.setTransform(2, 0, 0, 2, 0, 0)` und `ctx.imageSmoothingEnabled = false` setzen. |
| **Falscher Export-Name für Art-Assets** | Manche Skripte raten `getArt()`. | Die echten Exporte in `src/assets/artLoader.ts` heißen **`preloadHDArt()`** und **`getHDArt()`**. |
| **`art.<prop>` ist `null` direkt nach `Page.navigate`** | `Runtime.evaluate` lief noch auf `about:blank` oder bevor `preloadHDArt()` fertig war. | Nach `Page.navigate` kurz warten (`sleep(600)`), `window.location.origin` + `document.styleSheets.length > 0` prüfen und `await preloadHDArt()` explizit abwarten. |
| **Vite-HMR / Firebase-Netzwerk-Meldungen im VM-Offline-Test** | In der isolierten Test-VM gibt es ggf. keinen direkten Zugriff auf `firestore.googleapis.com` oder `favicon.ico`. | Beim Auswerten von `cdp.errors` nur `favicon`, `firestore` und `googleapis` filtern; alle JS-Exceptions (`Runtime.exceptionThrown`) immer hart fehlschlagen lassen. |
| **Modal-Header-Buttons brechen unschön um** | Pixel-Font (`Silkscreen`) ist breit bei langen Titeln + 3 Tabs + `ESC ✕`. | `white-space: nowrap` auf Titel, Tabs und Close-Button + `max-width: 670px–680px` am `.modal-window`. |
| **Unklare `UIManager` / `DungeonScene` Mock-Callbacks** | `UIManager` erwartet `UIHooks`, `DungeonScene` erwartet `DungeonCallbacks`. | Immer `{ onStartNewGame: () => {}, onContinueGame: () => {}, onToggleShopOpen: () => {}, onSwapWeapon: () => {}, onModalStateChange: () => {}, onMuteToggle: () => {}, onMusicToggle: () => {} }` bzw. `{ onReturnToHub: () => {}, onOpenDungeonChest: () => {}, onToast: () => {}, onHudDirty: () => {} }` übergeben. |
| **Prüfungs-Uploads scheitern (M9)** | Die Regeln für `weeklyTrials/{weekId}/entries/{uid}` sind nicht in der Firebase-Konsole veröffentlicht (Vercel deployt `firestore.rules` NICHT). | Regeln aus `firestore.rules` in Firebase → Firestore → Regeln einfügen & veröffentlichen. Bis dahin bleibt `weeklyTrial.uploaded = false` und der Upload wird bei jedem Sync erneut versucht. |
| **Test-Mocks mit `Proxy` schlucken Zuweisungen (M9)** | Ein `new Proxy({}, { get: () => () => {} })` überschreibt per `get`-Trap auch zuvor gesetzte Callbacks. | Für Callbacks, die du prüfen willst, ein normales Objekt mit expliziten Funktionen verwenden. |
| **Geseedeter Zufall bleibt aktiv (M9)** | `withSeededRandom` patcht `Math.random` global. | Nur um **synchrone** Generatoren verwenden; `try/finally` stellt das Original wieder her. Test: `Math.random` vor/nach dem Aufruf vergleichen (auch nach geworfener Exception). |
| **Spielinstanz im Test (M10)** | `StarlighterGame` ist modulprivat. | Im Vite-Dev-Server existiert `window.__game` (nur `import.meta.env.DEV`, im Produktions-Build entfernt). Private Felder sind zur Laufzeit erreichbar (`g.hubScene.callbacks.onOpenForge()`, `g.syncMusic()`). |
| **Test schaltet die echte Spielschleife in eine nie gestartete Szene (M10)** | `g.activeScene = 'dungeon'` ohne `startRun()` → `currentRoom` undefined → `pageerror`. | Eigene Szenen-Instanzen (`new DungeonScene(...)`) bauen oder den Loop mit `cancelAnimationFrame` anhalten; `touch.setState('dungeon', …)` braucht keine Dungeon-Szene. |
| **Statistik-Tests flackern (M10)** | Ungeseedete Stichproben (z. B. 200 Ebenen) schwanken ±3 %. | Pro Stichprobe `withSeededRandom('dist:…', …)` nutzen → deterministisch. |
| **Exakte Zeit-/Phasen-Grenzen (M10)** | `(2.0 % 3.6)` ist wegen Float-Rundung manchmal `1.9999…`. | Grenzen mit Abstand testen (`2.01`, `2.81`), nie exakt auf der Kante. |
| **Dialog-Tasten rutschen in die Welt (M10)** | `window`-Listener des InputManagers bekommt `E`/`Enter` zusätzlich. | `StoryDialogController` registriert `keydown` im **Capture** auf `document` und stoppt die Propagation (nur für Enter/E/Space/→/1–3). Test: Spy auf `window` darf während des Dialogs 0 Treffer sehen. |
| **Touch-Deck bei großer Skalierung (M10)** | Joystick + Buttons passen im Hochformat nicht nebeneinander. | `TouchControls.updateStacked()` setzt `.touch-stacked`; im Querformat ist die Skalierung auf 115 % gekappt (`effectiveTouchScale`). |

### 3.1 Test-Hooks für Meilenstein 9

- `galacticNetwork.setGhostPoolForTest([...])` / `(null)` — Geister-Pool ohne Netzwerk erzwingen; `ShopScene.spawnCustomer(true)` erzwingt den Geister-Wurf.
- `setMarketTrendOverrideForTest('crystal_boom' | null)` — Trend erzwingen; alternativ `getTodayMarketTrend(new Date(...))` mit festem Datum.
- `getIsoWeekId(new Date(...))`, `getCurrentWeeklyTrial(new Date(...))` — deterministische Wochen-Tests (`2026-01-01` → `2026-W01`, `2027-01-01` → `2026-W53`).
- Seed-Vergleich: zwei Aufrufe `withSeededRandom('x', () => generateSectorFloor(2, 1))` müssen identische `JSON.stringify([...floor.rooms.entries()])` liefern; ohne Seed müssen sie sich unterscheiden.
- Prüfungs-Invarianten testen: nach `startWeeklyTrial(info)` + Boss-`onEnemyKilled` + `triggerDefeat()`/`triggerSafeWarp()` müssen `credits`, `inventory`, `bossDefeatedCount`, `sectorNCleared` unverändert sein.


### 3.2 Test-Hooks für Meilenstein 10-A

- `storyEngine` ist rein: `getPendingScene`, `applyChoice`, `recomputeDerivedFlags`, `validateStoryScenes(STORY_SCENES, { requireComplete: true })` direkt mit gestellten `StoryProgress`-Objekten (`createEmptyStory()`).
- `state.story` direkt setzbar (`chapter`, `trust`, `flags`, `seenScenes`) → Hub-Screenshots je Kapitel/Flag-Variante.
- `ui.openStoryScene(scene, opts)` gibt den `StoryDialogController` zurück (`advance()`, `choose(i)`, `skipLater()`, `getState()`); `ui.activeStory` ist erreichbar.
- `hub.getEvolution()` → `spritesEnabled = false` erzwingt Fallbacks, `getActiveElementIds()`, `getColliders()`, `debugFirework()`, `getSparkCount()`; `hub.triggerChatter(true)`, `hub.getStrollerKinds()`. Fake-Sprites: `getHDArt()[key] = canvas`.
- `applySectorMechanics(rooms, sector, floorIndex)` und `isFreeSpot(...)` exportiert; `generateSectorFloor(sector, floor, undefined, { mechanics })`.
- `scene.mechanics` (`RoomMechanicsSystem`): `handleProjectile`, `onMeleeHit`, `applyToEnemy`, `update`, `getJetState`, `isPlateActive`, `getPadCharge`; `scene.mechanicsClock` direkt setzbar (Phase erzwingen).
- Audio: `sound['tickMusic']()` mit Fake-`ctx` (`{ state: 'running' }`) und Spies auf `playMusicVoice`/`playMusicNoise`; `sound.getMusicIntensity()`.
- `saveDeviceSettings()`/`getDeviceSettings()`/`resetDeviceSettingsCacheForTest()`; Zielhilfe-Referenzwinkel vor Änderungen an `getAimAngle` aufzeichnen und danach vergleichen.
- Invarianten-Suche erweitert: `rg -n "state\.credits\s*\+=" src/scenes/DungeonScene.ts src/dungeon/` und `rg -n "Math\.random" src/dungeon/mechanicsGen.ts` → jeweils 0 Treffer.

---

## 4. Qualitätssicherung für neue HD-Pixel-Art-Sprites

Wenn neue Items, Props, Gegner oder Schiffe per Bildgenerierung erstellt werden:
1. Auf reinem weißen Hintergrund (`#FFFFFF`) mit großzügigem Rand generieren.
2. Per Python/PIL **Flood-Fill ab allen 4 Rändern** transparent freistellen (nicht globales Weiß-Ersetzen, damit weiße Glanzpunkte *innerhalb* des Sprites erhalten bleiben!).
3. 1-Pixel-Rand-Defringe für helle Anti-Aliasing-Pixel neben transparenten Pixeln durchführen.
4. Mit `Image.Resampling.NEAREST` sauber auf Zielgröße skalieren (`64×64` für Items, `96×96` für Props/NPCs/Gegner).
5. **Vor dem Einbau** das extrahierte PNG direkt ansehen (keine weißen Fransen, sauber zentriert, dunkle Pixel-Outlines intakt).

---

## 5. Verknüpfte Dokumente

- [GAME_DESIGN_DOCUMENT.md](GAME_DESIGN_DOCUMENT.md) — Aktueller Stand (v1.4), Design-Invariants, Codebase-Karte & offene Ideen.
- [HANDOFF.md](HANDOFF.md) — aktueller Arbeitsstand · [RIGGING_GUIDE.md](RIGGING_GUIDE.md) — M11-Prüfwerkzeuge.
- [firestore.rules](firestore.rules) — Sicherheitsregeln für Firebase Cloud-Save, Rangliste & Aktivitäts-Feed.

---

## 6. Historisch: manuelles Headless-Chrome-CDP-Harness (vor M10-A)

> **Überholt.** Seit M10-A laufen alle Prüfungen über `tests/harness.cjs` (Playwright). Das folgende Muster (eigenes Skript mit `/usr/bin/google-chrome` und CDP) wird nur noch gebraucht, wenn man Playwright bewusst umgehen will; die Pfade sind Beispiele.

Temporäre Testskripte werden im Scratch-Ordner (nicht im Repo) ausgeführt. Wichtigste Bausteine:

```js
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

// 1. Vite & Headless Chrome auf festen lokalen Ports starten (immer 127.0.0.1!)
const vite = spawn('npx', ['vite', '--port', '4197', '--host', '127.0.0.1', '--strictPort'], {
  cwd: '<Projektordner>',
  stdio: 'pipe',
});
const chrome = spawn('/usr/bin/google-chrome', [
  '--headless=new', '--disable-gpu', '--no-sandbox',
  '--remote-debugging-port=9247', '--window-size=1280,720', 'about:blank',
], { stdio: 'pipe' });

// 2. Per WebSocket mit CDP verbinden (Page.enable, Runtime.enable, Log.enable)
//    Emulation.setDeviceMetricsOverride: { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false }
//    Für Mobile-Tests: { width: 390, height: 844, deviceScaleFactor: 2, mobile: true }

// 3. Nach Page.navigate auf Origin + CSS + HD-Art warten:
await cdp.evalJs(`(async () => {
  for (let i = 0; i < 60; i++) {
    if (window.location.origin === 'http://127.0.0.1:4197' && document.styleSheets.length > 0) break;
    await new Promise(r => setTimeout(r, 80));
  }
  const { preloadHDArt } = await import('/src/assets/artLoader.ts');
  await preloadHDArt();
})()`);

// 4. Laufende requestAnimationFrame-Loops pausieren & Titelbild ausblenden,
//    damit gestagte Szenen für Screenshots deterministisch stehen bleiben:
await cdp.evalJs(`(() => {
  const highest = window.requestAnimationFrame(() => {});
  for (let i = 1; i <= highest + 20; i++) window.cancelAnimationFrame(i);
  document.getElementById('title-overlay')?.classList.add('hidden');
})()`);

// 5. Szene deterministisch auf #game-canvas rendern (RENDER_SCALE = 2!):
await cdp.evalJs(`(async () => {
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  ctx.setTransform(2, 0, 0, 2, 0, 0);
  ctx.imageSmoothingEnabled = false;
  // scene.render(ctx) bzw. dng.render(ctx, inp)
})()`);

// 6. Teardown: Erst WebSocket schließen, 100 ms warten, dann Chrome & Vite beenden!
```

---
