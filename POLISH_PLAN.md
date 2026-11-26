# POLISH_PLAN.md — Kleine Verbesserungen ohne neue Systeme (Plan 2026-11-26)

> **Für:** Claude Sonnet (mittlere Denktiefe) oder jedes andere Werkzeug — ohne Vorwissen abarbeitbar.
> **Herkunft:** Ideenliste 1–9 aus der Sitzung vom 2026-11-26, am Code geprüft (Stand `e1b5f07`). Zeilennummern sind ungefähr → per `grep -n` suchen.
> **Aufteilung in 3 Teile = 3 Pushes**, damit jeder Teil im Notfall einzeln zurückgenommen werden kann:
> - **Teil 1** (Komfort & Gerät: Punkte 1, 2, 3, 8) — kein Kampf-/Balancing-Einfluss.
> - **Teil 2** (Kampfgefühl, rein optisch: Punkte 4, 5, 6, 7).
> - **Teil 3** (Ladezeit: Punkt 9, Dungeon-Code nachladen) — größtes Risiko, darum allein.

## 0. Regeln für alle Teile (nicht verhandelbar)
- **Ein Teil = genau ein Commit = ein Push.** Commit-Nachricht beginnt mit `polish(teil-1):` / `polish(teil-2):` / `perf(teil-3):`. Nichts aus einem anderen Teil mit hineinnehmen.
- **Vor jedem Push:** `npm run verify` (Build → Invarianten → Sprite-Check → alle Tests) muss grün sein. Screenshots in `tests/out/` kurz ansehen.
- **Kein neues Feld in `SaveData`**, `SAVE_VERSION` bleibt `11`. Neue Einstellungen nur in `src/systems/deviceSettings.ts` (localStorage, pro Gerät).
- **Keine Balancing-Werte ändern** (`src/data/balance.ts`, Schaden, HP, Zeiten in `bosses/defs.ts`, Telegraph-Dauern). Zero-Dungeon-Credits bleibt.
- **Alle Spieltexte auf Deutsch.**
- **Kein globaler Zufall** in neuen Code-Pfaden, die die Spiellogik beeinflussen (Optik im Renderer darf wie bisher `Math.random` nutzen).
- Nach jedem Teil: den Haken in diesem Dokument setzen und `HANDOFF.md` („Stand“) um eine Zeile ergänzen — im **selben** Commit.
- **Zurücknehmen im Notfall:** `git log --oneline` → Commit des Teils suchen → `git revert <sha>` → `npm run verify` → pushen. Darum: Teile **in Reihenfolge** abarbeiten und nie mehrere in einen Commit packen.

---

## Teil 1 — Komfort & Gerät (Punkte 1, 2, 3, 8) · ein Commit `polish(teil-1): …`

### [x] 1.1 Tab-/App-Wechsel: Musik pausieren, sofort speichern & synchronisieren
**Problem:** Es gibt keinen `visibilitychange`-Handler. Die Musik läuft über `window.setInterval` (`src/engine/audio.ts`, `ensureMusicLoop`) und spielt im Hintergrund-Tab gedrosselt (stotternd) weiter. Auf dem Handy wird beim App-Wechsel nicht gespeichert; ein ausstehender Cloud-Sync (1,8 s verzögert, `firebaseService.scheduleAutoSync`) kann verloren gehen.

**Umsetzen:**
1. `src/engine/audio.ts` (`class SoundEngine`): zwei öffentliche Methoden ergänzen:
   ```ts
   /** App/Tab verborgen: Musik-Takt anhalten, AudioContext schlafen legen. */
   public suspendForBackground(): void {
     if (this.musicTimer !== null) { window.clearInterval(this.musicTimer); this.musicTimer = null; }
     if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
   }
   /** Wieder sichtbar: nur fortsetzen, wenn der Ton schon einmal freigeschaltet war (ctx existiert). */
   public resumeFromBackground(): void {
     if (!this.ctx) return;
     if (this.ctx.state === 'suspended') void this.ctx.resume();
     if (!this.muted && !this.musicMuted) this.ensureMusicLoop();
   }
   ```
   (`ensureMusicLoop` ist privat — die neue Methode liegt in derselben Klasse, also ok. Prüfen, ob `toggleMusicMute`/`unlock` die Musik bei `musicMuted` ebenfalls nicht starten → Verhalten gleich halten.)
2. `src/services/firebaseService.ts`: öffentliche Methode ergänzen:
   ```ts
   /** Ausstehenden Auto-Sync sofort ausführen (z. B. App geht in den Hintergrund). */
   public flushAutoSync(state: GameState): void {
     if (this.syncTimer === null) return;
     window.clearTimeout(this.syncTimer);
     this.syncTimer = null;
     void this.syncAllToCloud(state);
   }
   ```
3. `src/main.ts` im Konstruktor (neben den vorhandenen `window.addEventListener('pointerdown', …)`):
   ```ts
   const onHidden = (): void => {
     sound.suspendForBackground();
     this.state.save();                 // respektiert saveLocked (Wochen-Prüfung) bereits selbst
     firebaseService.flushAutoSync(this.state);
   };
   document.addEventListener('visibilitychange', () => {
     if (document.visibilityState === 'hidden') onHidden();
     else sound.resumeFromBackground();
   });
   window.addEventListener('pagehide', onHidden);
   ```
4. **Spielschleife:** nichts ändern. `requestAnimationFrame` hält im Hintergrund ohnehin an, `dt` ist in `loop()` auf 0,05 s gekappt.

**Prüfen:** Neuer Test `tests/t7.cjs` (Namensschema muss `t\d…` sein, sonst nimmt `tests/run.cjs` ihn nicht auf; Vorlage: `tests/t6.cjs`): `sound.unlock()` aufrufen, `sound.suspendForBackground()` → privates Feld `sound['musicTimer'] === null`; `sound.resumeFromBackground()` → `!== null` (sofern nicht stumm). `firebaseService.flushAutoSync` ohne ausstehenden Timer darf nichts tun (kein Fehler). Keine Netzwerk-Aufrufe im Test.

### [x] 1.2 Bildschirmwackeln einstellbar (Barrierefreiheit)
**Ist:** `DungeonScene.triggerShake(duration, mag)`; der Renderer verschiebt in `src/dungeon/dungeonRenderer.ts` (~Z. 43, `if (this.scene.shakeTimer > 0)`) um `shakeMag`. Keine Einstellung, `prefers-reduced-motion` wird nicht beachtet.

**Umsetzen:**
1. `src/systems/deviceSettings.ts`:
   - `export type ScreenShake = 'full' | 'low' | 'off';` · `export const SCREEN_SHAKES: ScreenShake[] = ['full', 'low', 'off'];`
   - `DeviceSettings` um `screenShake: ScreenShake` erweitern.
   - Default: `'full'`, **außer** `prefersReducedMotion()` ist wahr → `'low'`. Dafür kleine Funktion `prefersReducedMotion()` (try/catch um `window.matchMedia('(prefers-reduced-motion: reduce)').matches`, `false` ohne `window`). `DEFAULT_DEVICE_SETTINGS` bleibt eine Konstante mit `'full'`; in `loadDeviceSettings()` beim **Fehlen** des Werts (`raw` hat kein `screenShake`) den Reduced-Motion-Default einsetzen.
   - `sanitizeDeviceSettings`: `screenShake` wie die anderen Felder prüfen.
   - Hilfsfunktion `export function shakeFactor(): number` → `full` 1 · `low` 0,35 · `off` 0.
2. `src/dungeon/dungeonRenderer.ts` (~Z. 43): `const k = shakeFactor();` und `if (this.scene.shakeTimer > 0 && k > 0)` → `sx/sy` mit `* k` multiplizieren. **Nicht** `triggerShake` ändern (Spielzustand bleibt gleich, Tests unverändert).
3. Hilfe-Tab in `src/ui/UIManager.ts`: bei den vorhandenen Geräte-Einstellungen (Zeilen mit `data-dev-aim` / `data-dev-text`, ~Z. 625–640) eine Zeile „Bildschirmwackeln“ mit drei Knöpfen `data-dev-shake` (Beschriftung: „Voll“ · „Schwach“ · „Aus“) nach demselben Muster (`btn(...)`) ergänzen; Klick-Handler wie bei `data-dev-text` (~Z. 1048): `saveDeviceSettings({ screenShake: … })` und Modal neu rendern (so wie es die Nachbarn tun).
4. Bestehende Tests, die `DeviceSettings` vollständig vergleichen (`grep -rn "textSpeed" tests/`), um das neue Feld ergänzen.

### [x] 1.3 Vibration auf dem Handy (abschaltbar)
**Umsetzen:**
1. `src/systems/deviceSettings.ts`: `DeviceSettings.vibration: boolean` (Default `true`), in `sanitizeDeviceSettings` nur `typeof === 'boolean'` übernehmen.
2. Neue Datei `src/systems/haptics.ts`:
   ```ts
   import { getDeviceSettings } from './deviceSettings';
   let last = 0;
   /** Kurzer Vibrations-Impuls (nur Touch-Geräte, abschaltbar, max. alle 80 ms). */
   export function haptic(ms: number | number[]): void {
     if (!getDeviceSettings().vibration) return;
     if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
     try { if (!window.matchMedia('(pointer: coarse)').matches) return; } catch { return; }
     const now = performance.now();
     if (now - last < 80) return;
     last = now;
     try { navigator.vibrate(ms); } catch { /* ignorieren */ }
   }
   ```
3. Aufrufe (nur dort, nichts sonst):
   - Spieler wird getroffen: neben **jedem** `sound.playPlayerHurt()` in `src/scenes/DungeonScene.ts` (~Z. 1336 und ~Z. 3613) → `haptic(35)`.
   - Perfekt-Parade: neben **jedem** `sound.playPerfectParry()` (~Z. 3562 und ~Z. 3765) → `haptic([15, 30, 15])`.
   - Boss-Phase 2: wird in Teil 2 (2.2) zentral eingebaut — hier **noch nicht**.
4. Hilfe-Tab: Zeile „Vibration (Handy)“ mit zwei Knöpfen `data-dev-vibe` („An“ · „Aus“), Muster wie 1.2.
5. Invariante: `haptics.ts` hat keinen Spiel-Zustand → Wochen-Prüfung/Seeds unberührt.

### [x] 1.4 Laden-Tür tagsüber klar beschriften (Punkt 8 — größtenteils schon vorhanden)
**Ist:** Toast „☀ Tagsüber ist der Laden zu …“ (`ShopScene.toggleShopOpen`, ~Z. 236) und Hinweiszeile im HUD (`UIManager.ts` ~Z. 302) gibt es schon. Nur das Tür-Prompt sagt tagsüber weiter „[E] Laden öffnen“.

**Umsetzen:** `src/scenes/ShopScene.ts` (~Z. 1387, Kommentar „8. Shop Open/Close Door“):
```ts
label: this.shopOpen ? '[E] Laden schließen' : this.state.timeOfDay === 'night' ? '[E] Laden öffnen' : '[E] Laden (öffnet nachts)',
```
Sonst nichts ändern (Touch-Knopf „ÖFFNEN“ bleibt; der Toast erklärt es beim Drücken).

### Abschluss Teil 1
- `npm run verify` grün → Screenshot des Hilfe-Tabs ansehen (Zeilen passen in eine Breite, `white-space: nowrap` bei Überschriften beachten, siehe AGENTS.md §4).
- Haken 1.1–1.4 setzen, `HANDOFF.md` ergänzen („Teil 1 Polish: Hintergrund-Pause, Wackeln/Vibration im Hilfe-Tab, Tür-Label“), committen, pushen.

---

## Teil 2 — Kampfgefühl, rein optisch (Punkte 4, 5, 6, 7) · ein Commit `polish(teil-2): …`

### [x] 2.1 Kern-Wächter: Schrittphase aus der Strecke (wie Krall)
**Ist:** In `src/dungeon/anim/bossAnims.ts` nutzt Krall `stridePhase(e, time, speed)` (Schritte aus zurückgelegter Strecke → im Stand ruhig). Der Kern-Wächter rechnet in `coreWardenSet` (~Z. 119) `const ph = time * (3 + speed / 25) + e.id;` (Uhr-basiert → „trippelt“ auch langsam).

**Umsetzen:**
- In `coreWardenSet` die Zeile durch `const ph = stridePhase(e, time, speed) * <K>;` ersetzen. `<K>` so wählen, dass bei typischem Lauftempo (~40 px/s) ungefähr dieselbe Frequenz wie vorher herauskommt: vorher `3 + 40/25 = 4,6 rad/s`; `stridePhase` liefert `speed · 0,16 = 6,4 rad/s` bei 40 px/s → `K ≈ 0,72`. Konstante oben benennen: `const CW_STRIDE_K = 0.72;`.
- `stridePhase` ist unterhalb von `coreWardenSet` definiert (Funktions-Deklaration → gehoben, also aufrufbar). `speed` ist in `coreWardenSet` schon vorhanden (prüfen: `const speed = Math.hypot(e.vx, e.vy)` o. ä.).
- **Wichtig:** `stridePhase` speichert Zustand je Enemy in einer `WeakMap`. Wird es für denselben Enemy **zweimal pro Frame** aufgerufen, zählt die Zeit doppelt nicht (zweiter Aufruf hat `dt = 0`) → unkritisch.
- Glättung (`SMOOTH_TAU` 0,05 vs. `KRALL_TAU` 0,1) **nicht** ändern — das ist Geschmackssache für die Abnahme im Kampf.
- Test: `npm test -- m11p2` (Übergangs-Glätte) muss grün bleiben. Kontaktbogen: `node scripts/rig-sheet.cjs core_warden` (Dev-Server nötig, siehe RIGGING_GUIDE §6) ansehen.
- `BOSS_ANIMATION_PLAN.md` §3 „Krall — noch offen“: den Punkt „Kern-Wächter nutzt weiter … Uhr-basierte Schrittlogik“ als erledigt markieren.

### [x] 2.2 Hit-Stop & Ruck bei großen Momenten (Punkt 5 — ergänzt Vorhandenes)
**Ist:** Hit-Stop existiert bereits (`DungeonScene.hitStop`, Auswertung ~Z. 1079: während `hitStop > 0` laufen nur Effekte mit 25 % Tempo; gesetzt bei Treffern ~0,02–0,055 s und Perfekt-Parade 0,04 s). **Fehlt** bei Boss-Phase-2-Wechsel, Boss-Sieg und Elite-Kill.

**Umsetzen (nur `src/scenes/DungeonScene.ts` + 1 optionales Laufzeitfeld):**
1. `src/dungeon/dungeonTypes.ts` → `Enemy`: `/** Laufzeit: Phase-2-Effekt (Hit-Stop/Vibration) schon gezeigt */ phase2FxShown?: boolean;`
2. In `DungeonScene.update` **nach** dem Gegner-Update (Stelle suchen, an der über `this.enemies` iteriert / die KI aufgerufen wird): einmal pro Frame
   ```ts
   for (const e of this.enemies) {
     if (e.bossPhase2 && !e.phase2FxShown && e.kind.startsWith('boss')) {
       e.phase2FxShown = true;
       this.hitStop = Math.max(this.hitStop, 0.09);
       haptic([40, 40, 60]);
     }
   }
   ```
   `bossPhase2 = true` wird an vielen Stellen in `enemyAi.ts` gesetzt — **dort nichts einbauen**, die zentrale Prüfung deckt alle ab. Beim Teilen (`splitBoss`) entstehen evtl. zwei Hälften ohne Flag → im selben Frame zweimal `Math.max` → harmlos.
3. `onEnemyKilled(e)` (~Z. 2933) am Anfang: `if (e.kind.startsWith('boss')) this.hitStop = Math.max(this.hitStop, 0.12); else if (e.elite) this.hitStop = Math.max(this.hitStop, 0.06);` (Bei geteilten Bossen wird `onEnemyKilled` nur einmal belohnt — Hit-Stop doppelt wäre ebenfalls harmlos.)
4. **Nicht ändern:** `triggerShake`-Werte, Zustandsdauern. Hit-Stop pausiert auch `mechanicsClock` & Boss-Timer gleichmäßig (früher `return` in `update`) → keine Logik-Verschiebung. `runElapsedSec` läuft weiter (Zeile davor) — für Par-Zeiten vernachlässigbar (< 0,2 s pro Run).
5. Tests: `npm test -- m10cp7 m10cp8 m10cp10 m11p4` müssen grün bleiben (Boss-Simulation, Kampfdauer, Prüfung, Teilen). Wenn `m10cp8`-Kampfdauern minimal kippen: Hit-Stop **nicht** in die Messung einrechnen lassen (die Tests rufen meist direkt `damageEnemy` ohne `update` auf → sollte unberührt sein).

### [x] 2.3 Telegraph: letzter Moment vor dem Auslösen lesbar (Punkt 6)
**Ist:** `src/dungeon/bosses/bossFx.ts` → `render()` (~Z. 181): Warn-Zonen mit `prog` (0…1) und Puls; kein besonderes Signal kurz vor dem Auslösen.

**Umsetzen (nur Zeichnen):** in der Zonen-Schleife nach dem vorhandenen Stroke:
```ts
if (warn && z.delay > 0 && z.delay <= 0.15) {
  const k = 1 - z.delay / 0.15;           // 0 → 1 in den letzten 0,15 s
  ctx.globalAlpha = 0.18 + 0.32 * k;
  ctx.fillStyle = '#ffffff';
  this.path(ctx, z);
  ctx.fill();
  ctx.globalAlpha = 0.9;
  ctx.lineWidth = 1.8;
  ctx.strokeStyle = '#ffffff';
  this.path(ctx, z);
  ctx.stroke();
  ctx.fillStyle = z.color;                 // für die nächste Zone zurücksetzen (wird oben ohnehin neu gesetzt)
  ctx.strokeStyle = z.color;
}
```
Beams (`BossBeam`) haben nur `warn: boolean` ohne Restzeit → **nicht** anfassen. Keine Timer-, Schadens- oder Hitbox-Änderung. Prüfen: `npm test -- m10cp7`; Screenshot einer Zone kurz vor dem Auslösen ansehen (z. B. im `?bosslab` mit 0,25× und Pause).

### [x] 2.4 Schadenszahlen zusammenfassen (Punkt 7)
**Ist:** `damageEnemy` (~Z. 2737) pusht pro Treffer einen `FloatingNum` (`src/dungeon/dungeonTypes.ts`, Felder `x, y, text, color, life, maxLife`), Update/Entfernen ~Z. 4403, Zeichnen `dungeonRenderer.ts` ~Z. 785. Schnelle Waffen erzeugen viele Einzelzahlen.

**Umsetzen:**
1. `FloatingNum` um optionale Felder erweitern: `enemyId?: number; sum?: number; bornAt?: number;`
2. In `damageEnemy` den normalen Schadens-Push (`text: isCrit ? \`KRIT! …\` : \`${finalAmt}\``) ersetzen durch:
   ```ts
   const merge = !isCrit ? this.floats.find((f) => f.enemyId === e.id && f.sum !== undefined && this.time - (f.bornAt ?? 0) < 0.3) : undefined;
   if (merge) {
     merge.sum = (merge.sum ?? 0) + finalAmt;
     merge.text = `${merge.sum}`;
     merge.life = merge.maxLife;            // Zahl bleibt stehen, solange weiter getroffen wird
   } else {
     this.floats.push({
       x: e.x + (Math.random() - 0.5) * 8, y: e.y - e.radius - 4,
       text: isCrit ? `KRIT! ${finalAmt}` : `${finalAmt}`,
       color: isCrit ? '#fde047' : infDef ? infDef.color : '#f8fafc',
       life: isCrit ? 0.85 : 0.65, maxLife: isCrit ? 0.85 : 0.65,
       ...(isCrit ? {} : { enemyId: e.id, sum: finalAmt, bornAt: this.time }),
     });
   }
   ```
   (`bornAt` bleibt beim Zusammenfassen gleich → nach 0,3 s beginnt eine neue Zahl; so steigt keine Zahl endlos.)
   `Math.random` für den x-Versatz ist reine Optik (war schon vorher so) — ok.
3. Obergrenze gegen Spitzen: nach dem Push `if (this.floats.length > 48) this.floats.splice(0, this.floats.length - 48);`
4. Alle **anderen** `floats.push` (Texte wie „BLOCK“, „MAGNET-RÜCKRUF!“) unverändert lassen.
5. Tests: `grep -rn "floats" tests/` — falls ein Test die Anzahl der Zahlen pro Treffer prüft, anpassen (erwartet: Treffer am selben Gegner innerhalb 0,3 s = eine Zahl mit Summe).

### Abschluss Teil 2
- `npm run verify` grün, Kontaktbogen Kern-Wächter + ein Kampf-Screenshot angesehen.
- Haken 2.1–2.4 setzen, `HANDOFF.md` ergänzen, committen, pushen. **Projektinhaber bitten, einen Kampf (Krall/Kern-Wächter) im echten Spiel zu prüfen.**

---

## Teil 3 — Dungeon-Code nach dem Start laden (Punkt 9) · ein Commit `perf(teil-3): …`

**Ziel:** `dist/index.html` lädt den `dungeon`-Chunk (~372 kB) heute per `<link rel="modulepreload">` sofort mit, weil `src/main.ts` `DungeonScene` statisch importiert. Nach Teil 3 lädt er **im Hintergrund nach dem ersten Frame** und ist fertig, bevor der Spieler einen Run startet. Gleiches Muster wie das Firebase-SDK (`src/services/firebaseSdk.ts`).

**Vorher prüfen (Stand Audit):** Statische Wert-Importe aus `src/dungeon/**`, `src/scenes/DungeonScene.ts`, `src/world/dungeonGen.ts` außerhalb dieser Ordner gibt es nur in `src/main.ts` (`DungeonScene`) und `src/dev/bossLab.ts` (`ROOM_CENTER_X/Y`). Typ-Importe (`import type`) sind unkritisch. Befehl: `grep -rn "from '.*\(DungeonScene\|dungeon/\|world/dungeonGen\)" src --include=*.ts | grep -v "import type" | grep -v "^src/dungeon/\|^src/scenes/DungeonScene.ts\|^src/world/"` → darf danach **nur** noch dynamische `import(...)` zeigen.

### [x] 3.1 `main.ts` umbauen
1. `import { DungeonScene } from './scenes/DungeonScene';` → `import type { DungeonScene } from './scenes/DungeonScene';`; `import { BossLab } from './dev/bossLab';` → `import type { BossLab } from './dev/bossLab';`.
2. Feld `private dungeonScene: DungeonScene;` → `private dungeonScene: DungeonScene | null = null;` und **öffentlich** `public dungeonReady: Promise<DungeonScene>;` (Tests brauchen es).
3. Den heutigen `new DungeonScene(this.state, { … })`-Block in eine Methode verschieben:
   ```ts
   private loadDungeon(): Promise<DungeonScene> {
     return import('./scenes/DungeonScene').then(({ DungeonScene }) => {
       const d = new DungeonScene(this.state, { /* exakt die bisherigen Callbacks */ });
       this.dungeonScene = d;
       return d;
     });
   }
   ```
   In den Callbacks statt `this.dungeonScene.currentSector` die lokale Variable `d` benutzen.
   Im Konstruktor: `this.dungeonReady = this.loadDungeon();` (sofort anstoßen — der Download läuft parallel zum Titelbild; das genügt, ein späteres „idle“ bringt kaum mehr).
4. **Alle** Stellen `this.dungeonScene.` (`grep -n "this.dungeonScene" src/main.ts`, ca. 25) absichern:
   - Lesende Abfragen in `syncMusic()` (`isInBossFight`, `currentSector`, `isBossPhase2Active`), `handleSwapWeapon`, HUD-Werte: `this.dungeonScene?.… ?? <bisheriger Standard>` bzw. `if (!this.dungeonScene) return;` — nur dort, wo `activeScene === 'dungeon'` ohnehin nicht möglich ist, solange nicht geladen.
   - **Run-Start** (die Stelle mit `startWeeklyTrial` / `startEndlessRift` / `startRun`, ~Z. 520, läuft im Übergangs-Fade als `pendingTransition`): vorher laden:
     ```ts
     void this.dungeonReady.then((d) => { /* bisheriger Inhalt, mit d statt this.dungeonScene */ });
     ```
     Achtung Reihenfolge: `this.activeScene = 'dungeon'` erst **innerhalb** des `then` setzen, sonst ruft `loop()` `update/render` auf einer `null`-Szene. Ist der Chunk schon da (Normalfall), läuft das `then` im nächsten Microtask → kein sichtbarer Unterschied.
   - `loop()`: der `else`-Zweig (Dungeon-Update ~Z. 674 und -Render ~Z. 694) → `if (this.dungeonScene) …`. Solange er fehlt, nichts zeichnen (Fade-Overlay bleibt).
5. **Boss-Labor** (`startBossLab`, `?bosslab`): asynchron machen — `void Promise.all([this.dungeonReady, import('./dev/bossLab')]).then(([d, { BossLab }]) => { this.bossLab = new BossLab(d, this.state, { … }); … })`. Auch hier `activeScene = 'dungeon'` erst im `then`.

### [x] 3.2 Tests & Prüfung
1. Tests, die `window.__game.dungeonScene` direkt benutzen (`tests/m10p6.cjs`, `tests/m11lab.cjs` — `grep -ln "dungeonScene" tests/`): vorher `await g.dungeonReady` (bzw. `await window.__game.dungeonReady`) einfügen. Tests, die `import('/src/scenes/DungeonScene.ts')` selbst bauen, sind unberührt.
2. Neuer Test `tests/t8.cjs`: nach dem Laden `await window.__game.dungeonReady` → Instanz vorhanden; `g.activeScene` ist nicht `'dungeon'`, solange kein Run gestartet ist.
3. `npm run build` → in `dist/index.html` darf **kein** `modulepreload` mehr auf `assets/dungeon-…js` zeigen (`grep modulepreload dist/index.html`). Der Chunk selbst muss weiter existieren (`ls dist/assets/dungeon-*`).
4. `npm run verify` grün. Zusätzlich `npm run build:single` (Einzeldatei-Build) muss weiter durchlaufen (dynamische Importe werden dort eingebettet).
5. `?bosslab` im Dev-Server einmal öffnen (`npm test -- m11lab` geht nicht über `npm test`; direkt `node tests/harness.cjs tests/m11lab.cjs`).

### Abschluss Teil 3
- Haken 3.1–3.2, `HANDOFF.md` ergänzen („Dungeon-Code lädt nach dem Start nach; `__game.dungeonReady` in Tests“), `TESTING_AND_VERIFICATION.md` Abschnitt 1b um denselben Hinweis ergänzen, committen, pushen.
- **Projektinhaber bitten:** nach dem Vercel-Deploy auf dem Handy einen Run starten (Dock → Sektor 1) und das Boss-Labor einmal öffnen.
- Ist alles abgehakt und abgenommen: `POLISH_PLAN.md` löschen und den Verweis in `HANDOFF.md`/`AGENTS.md` entfernen.

> **Umsetzungsnotiz Teil 3:** Zusätzlich musste die Chunk-Gruppe `dungeon` aus `vite.config.ts` entfernt werden (sie zog geteilten Code in den Dungeon-Chunk, sodass der Index ihn weiter vorlud). Jetzt trennt Vite natürlich: `index` ~510 kB (inkl. geteilter Daten), `DungeonScene` ~248 kB und `dungeonGen` ~17 kB nur nachgeladen. Der Run-Start wartet im Notfall auf `dungeonReady` (`transitionTo`). Test `t8`.
