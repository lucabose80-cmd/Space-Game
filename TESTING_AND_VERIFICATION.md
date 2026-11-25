# Testing & Verification Playbook: *STARLIGHTER*

> **Zweck:** Dieses Dokument beschreibt exakt, wie in *STARLIGHTER* nach jedem Feature, Refactoring oder Meilenstein getestet wird — inkl. Build-Checks, Design-Invarianten, Headless-Chrome-CDP-Verifikation, visueller Screenshot-Prüfung und bekannter Stolperfallen. Zukünftige Chats sollen diesen Ablauf vor jedem Push auf `main` verwenden.

---

## 1. Standard-Verifikations-Pipeline (Vor jedem Commit/Push)

Jede Änderung durchläuft immer diese **5 Schritte**:

1. **TypeScript & Production Build:**
   ```bash
   npm run build
   ```
   Prüft `tsc` (strikte Regeln: `verbatimModuleSyntax`, `erasableSyntaxOnly`, `noUnusedLocals`, `noUnusedParameters`) sowie den `vite build` inkl. Chunk-Splitting (`index`, `dungeon`, `firebase` in `vite.config.ts`).

2. **Statische Design-Invarianten prüfen:**
   - **Zero-Dungeon-Credits-Regel:** Es darf **kein** direktes `state.credits +=` in Dungeon-Code geben:
     ```bash
     rg -n "state\.credits\s*\+=" src/scenes/DungeonScene.ts src/dungeon/enemyAi.ts src/dungeon/dungeonRenderer.ts
     ```
     *(Muss 0 Treffer liefern — Credits kommen ausschließlich aus Shop-Verkäufen, Bounties & Handel.)*
   - **Savegame-Kompatibilität:** Neue Felder in `SaveData` (`src/types.ts`) müssen optional (`?`) sein und in `GameState.load()` (`src/systems/gameState.ts`) rückwärtskompatibel mit Defaults geladen werden.

3. **Automatisierte Logik- & Runtime-Verifikation in Headless Chrome (CDP):**
   - Startet `npx vite --port <PORT> --host 127.0.0.1 --strictPort` und `/usr/bin/google-chrome --headless=new --disable-gpu --no-sandbox --remote-debugging-port=<CDP_PORT> --window-size=1280,720 about:blank`.
   - Importiert die echten TypeScript-Module direkt im Browser via `await import('/src/...')` (Vite serviert sie live) und testet:
     - Alle neuen HD-Sprites geladen (`art.<key>.width > 0` bzw. `art.items[id].width > 0`).
     - Prozedurale Generatoren (`generateSectorFloor`, `generateEndlessRiftFloor`, Geheimkammern, Rift-Risse).
     - Spielmechaniken (`GameState`-Methoden, Kampf-Effekte, `damageEnemy`, `onEnemyKilled`, `firebaseService.buildLeaderboardEntry`, `isCloudSaveAhead`).
     - Save/Load-Roundtrip (`exportSaveJson()` → neue `GameState`-Instanz → `importSaveJson()`).
   - Sammelt alle `Runtime.exceptionThrown` und `Log.entryAdded (level === 'error')` Events — der Test bricht mit Fehler ab, sobald ein echter App-Fehler auftritt.

4. **Live-Screenshots rendern & visuell prüfen:**
   - Stellt 2–4 gezielte In-Game-Zustände (z. B. Hub-Promenade, Dungeon-Kampf mit FX, neue Modals) auf dem echten `#game-canvas` (`960×540`) + DOM-HUD/Modal-Layer nach und speichert PNG-Screenshots (`Page.captureScreenshot`).
   - **Pflicht:** Jeden erzeugten Screenshot anschließend visuell ansehen (Text-Umbrüche, Überlappungen, Prompt-Positionen, Sprite-Ränder, Kontrast, Lesbarkeit prüfen) und entdeckte Layout-Fehler sofort nachbessern.

5. **Commit & Push auf `main`:**
   - Erst wenn `npm run build` grün ist, alle Logik-Assertions bestanden sind, `0` Runtime-Fehler auftreten und alle Screenshots sauber aussehen, wird committet und auf `origin main` gepusht (Vercel deployt automatisch).

---

## 2. Bewährtes Headless-Chrome-CDP-Harness (Vorlage)

Temporäre Testskripte werden im Scratch-Ordner (nicht im Repo) ausgeführt. Wichtigste Bausteine:

```js
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

// 1. Vite & Headless Chrome auf festen lokalen Ports starten (immer 127.0.0.1!)
const vite = spawn('npx', ['vite', '--port', '4197', '--host', '127.0.0.1', '--strictPort'], {
  cwd: '/home/antigravity/lucabose80-cmd/Space-Game',
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

### 3.1 Test-Hooks für Meilenstein 9

- `galacticNetwork.setGhostPoolForTest([...])` / `(null)` — Geister-Pool ohne Netzwerk erzwingen; `ShopScene.spawnCustomer(true)` erzwingt den Geister-Wurf.
- `setMarketTrendOverrideForTest('crystal_boom' | null)` — Trend erzwingen; alternativ `getTodayMarketTrend(new Date(...))` mit festem Datum.
- `getIsoWeekId(new Date(...))`, `getCurrentWeeklyTrial(new Date(...))` — deterministische Wochen-Tests (`2026-01-01` → `2026-W01`, `2027-01-01` → `2026-W53`).
- Seed-Vergleich: zwei Aufrufe `withSeededRandom('x', () => generateSectorFloor(2, 1))` müssen identische `JSON.stringify([...floor.rooms.entries()])` liefern; ohne Seed müssen sie sich unterscheiden.
- Prüfungs-Invarianten testen: nach `startWeeklyTrial(info)` + Boss-`onEnemyKilled` + `triggerDefeat()`/`triggerSafeWarp()` müssen `credits`, `inventory`, `bossDefeatedCount`, `sectorNCleared` unverändert sein.

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

- [GAME_DESIGN_DOCUMENT.md](GAME_DESIGN_DOCUMENT.md) — Aktueller Stand (v1.1), Design-Invariants, Codebase-Karte & offene Phase-2-Roadmap.
- [firestore.rules](firestore.rules) — Sicherheitsregeln für Firebase Cloud-Save, Rangliste & Aktivitäts-Feed.
