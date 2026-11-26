# AGENTS.md — AI Agent Onboarding Guide (*STARLIGHTER*)

> **Read this file first.** It gives any AI coding agent or LLM immediate context on architecture, hard design invariants, build/test conventions, and where to find deeper docs — minimizing search overhead and preventing regressions.

---

## 1. Project Snapshot (v1.4 — Milestone 10-C implemented)
- **Game:** **STARLIGHTER** — Cozy Retro-Sci-Fi Action-RPG & Space-Shop browser game inspired by *Moonlighter 1*.
- **Stack:** `TypeScript` (strict) + `Vite 8` + custom HTML5 Canvas 2D engine (`960×540` HD pixel-art buffer at `RENDER_SCALE = 2` over `480×270` logical coordinates) + Web Audio procedural synth + Firebase Auth & Cloud Firestore (`starlighter-15b1f`).
- **Deployment:** Pushing to `main` triggers automatic Vercel deployment. **Never** tell the user to open a `localhost` URL.
- **Language:** All in-game UI text, toasts, item names, and user-facing responses are in **German**.

## 2. Documentation Map (Read When Relevant)
| Document | When to Read |
| :--- | :--- |
| [GAME_DESIGN_DOCUMENT.md](GAME_DESIGN_DOCUMENT.md) | Current milestone status (M1–M10-C + Firebase + Architecture Split live), story bible, open ideas, and codebase directory map. |
| [MILESTONE_8_ARCHITECTURE.md](MILESTONE_8_ARCHITECTURE.md) | Architecture & subsystem spec for Milestone 8 (Haggling, Patron Reputation, Market Terrace, Alchemy Bar, Solaris Trade Bank & Save v9). |
| [MILESTONE_9_ARCHITECTURE.md](MILESTONE_9_ARCHITECTURE.md) | Architecture & implementation record for M9 (Captain Files, Global Market Trend, Ghost Captains, Weekly Seeded Trial, Save v10). |
| [MILESTONE_10_ARCHITECTURE.md](MILESTONE_10_ARCHITECTURE.md) | Architecture & implementation record for M10-A (branching NPC story with trust & flags, living Port Solaris incl. optional sprite pack, sector room mechanics S2–S4, boss phase-2 music, touch size, aim assist & text speed, Save v11). §11 lists deviations & open items. |
| [MILESTONE_10C_ARCHITECTURE.md](MILESTONE_10C_ARCHITECTURE.md) | Architecture & implementation record for M10-C (enemy navigation, rift-portal placement, mobile HUD, weapon locker, day/night loop, teleporter-only extraction, unique bosses, shield counterplay, economy/boss/bot/rift balancing in `src/data/balance.ts`). §9 lists measured values & deviations. |
| [MILESTONE_11_ARCHITECTURE.md](MILESTONE_11_ARCHITECTURE.md) | **Next up:** plan for M11 — living enemies & bosses: cut-out rigs (`src/engine/rig.ts`), procedural motion & legs, detachable parts, phase-2 transformations, boss splitting; sprite delivery format (parts/pose sheets) + `npm run art:import` pipeline and the full Gemini prompt catalogue. |
| [RIGGING_GUIDE.md](RIGGING_GUIDE.md) | **Rigging-Handbuch (M11):** Pose-Sets, `rigs.json`, `npm run art:import`, Posen je Boss-Zustand (`bossAnims.ts`), Schulter-Feinjustierung, Kontaktbogen/Boss-Labor-Prüfung — alles, um ohne Claude Code (z. B. in Antigravity) weiterzuarbeiten. |
| [ART_BRIEF_M11.md](ART_BRIEF_M11.md) | **Sprite briefing for Antigravity/Gemini (M11 v2):** pose sets instead of rotating single parts — limb pose sheets (joint at cell centre, left/right drawn separately), head/torso swap sets, effect sheets, per-boss order of work, `npm run art:check` workflow. Read before generating any M11 sprite. |
| [ART_BRIEF_M11_ENEMIES.md](ART_BRIEF_M11_ENEMIES.md) | **Sprite briefing for normal enemies (M11):** one 3×2 cut-out parts sheet per enemy (joint at cell centre), per-enemy cell lists, ready-to-use prompt, generation order & credit plan. Read before generating any enemy rig sheet. |
| [ART_AND_DESIGN_GUIDE.md](ART_AND_DESIGN_GUIDE.md) | Generating new pixel-art sprites/backgrounds (prompt templates, color palettes, Python flood-fill extraction script, `artLoader.ts` & UI rules). |
| [TESTING_AND_VERIFICATION.md](TESTING_AND_VERIFICATION.md) | Running `npm run build`, checking invariants, Headless Chrome CDP verification harness, visual screenshot QA, and known pitfalls. |
| [firestore.rules](firestore.rules) | Production Firestore security rules (`saves/{uid}`, `leaderboard/{uid}`, `activities`). |

---

## 3. Non-Negotiable Rules (Do & Don't)
1. **Zero-Dungeon-Credits Rule:** **NEVER** add `state.credits +=` inside `src/scenes/DungeonScene.ts` or anywhere under `src/dungeon/` (`enemyAi.ts`, `dungeonRenderer.ts`, `mechanicsGen.ts`, `roomMechanics*.ts`). Verify with `rg -n "state\.credits\s*\+=" src/scenes/DungeonScene.ts src/dungeon/` → 0 hits. Credits are earned exclusively through selling relics in *Astro-Barter*, bounties, and trade.
2. **Everything In-Game:** Never build external out-of-game menus. Every feature (Cloud-Save/Scoreboard, Jukebox, Infusions, Companions, Endless Rift, Market Terrace) must live as an interactive station/terminal/NPC inside the game world.
3. **Backward-Compatible Saves:** Current `SAVE_VERSION = 11` in `src/systems/gameState.ts`. Any new field in `SaveData` (`src/types.ts`) must be optional (`?`) and safely defaulted in `GameState.load()`.
4. **Firebase Config Policy:** Public Firebase web config for `starlighter-15b1f` intentionally lives in `src/services/firebaseConfig.ts` (with `VITE_FIREBASE_*` env override support) because Vercel Free does not allow env var configuration. Security is enforced server-side via `firestore.rules` + Firebase Authorized Domains.
5. **Strict TypeScript:** `tsconfig.json` enforces `verbatimModuleSyntax`, `erasableSyntaxOnly`, `noUnusedLocals`, and `noUnusedParameters`. Always use `import type` for type-only imports.
6. **Mandatory Verification Before Every Push:**
   - **Code-/Spiel-Änderungen (`src/`, `scripts/`, `tests/`, `public/art/sprites/`):** `npm run verify` (`build` + `check:invariants` + `check:sprites` + Playwright-Tests) → 0 Fehler, plus Screenshots in `tests/out/` **visuell prüfen**, bevor auf `origin main` gepusht wird.
   - **Reine Doku- oder Roh-Asset-Commits (`*.md`, `art_source/**`):** `npm run check:invariants` + `npm run check:sprites` + visuelle Prüfung jedes neuen PNGs per `view_file` (weißer Hintergrund, saubere Zellentrennung, keine Fransen/Texte/Linien).
7. **Fehlende Sprites melden:** Legst du einen prozeduralen Fallback / Platzhalter anstelle eines Sprites an (z. B. weil kein Bildgenerator verfügbar ist), dann **musst** du (a) den Sprite-Key in `M10_OPTIONAL_SPRITES` (bzw. dem passenden optionalen Block in `artLoader.ts`) registrieren, damit `npm run check:sprites` ihn listet, (b) den Prompt in `ART_AND_DESIGN_GUIDE.md` §7/§8 ergänzen und (c) im Abschnitt „Fehlende Sprites“ von `HANDOFF.md` eintragen. In deiner Abschlussmeldung weist du den Projektinhaber ausdrücklich darauf hin, dass neue Sprites benötigt werden.
8. **Übergabe:** Aktualisiere am Ende jeder Sitzung `HANDOFF.md`. Prüfe mit `npm run verify` (bzw. Regel 6 bei reinen Doku-/Roh-Asset-Commits), bevor du pushst (gilt für jedes Werkzeug; Claude Code liest `CLAUDE.md`, das auf diese Datei verweist; Antigravity lädt diese Datei direkt).
9. **Tag/Nacht-Schleife (M10-C):** Laden nur nachts; Run am Tag → danach Nacht; Nacht-Run → danach Tag (Ladenschicht fällt aus); Koje nur nachts. Zeitwechsel laufen **nur** über `GameState.startNight()` / `startDay()` — nie `timeOfDay` direkt setzen. Die Wochen-Prüfung ändert die Zeit nie.
10. **Balancing zentral (M10-C):** Preise, Boss-HP, Rift-Faktoren, Waffen-Sperren, Schild-Werte stehen in `src/data/balance.ts`. Nach Änderungen `npm test -- m10cp8 m10cp10` (Boss-Kampfdauer, Prüfung) laufen lassen und `tests/out/economy.json` ansehen.

---

## 4. Quick "How to Add X" Cheat Sheet
- **Add a new Relic / Material:**
  1. Generate & flood-fill extract `64×64` PNG → `public/art/sprites/item_<id>.png` (auto-loaded by `artLoader.ts`!).
  2. Add `ItemDef` to `ITEMS` in `src/data/items.ts` (and `rollLootItem` / `rollRiftLootItem` if needed).
- **Add a new Weapon Infusion or Rift Mutator:**
  1. Define in `src/data/infusions.ts` + extend `InfusionId` / `RiftMutatorId` in `src/types.ts`.
  2. Wire combat behavior in `DungeonScene.ts` (`damageEnemy` / `onEnemyKilled` / `damagePlayer`), status ticks in `src/dungeon/enemyAi.ts`, and FX in `src/dungeon/dungeonRenderer.ts`.
- **Add / change a Boss move set (M10-C):** bosses with their own move set live in `src/dungeon/bosses/` — `BossDef` (idle move + `moves`: windup → fire/active → recover, Phase 2 below 50 % HP) in `defs.ts`, engine in `bossEngine.ts`, telegraph zones/beams/plates in `bossFx.ts` (`scene.bossFx`), looks in `bossLooks.ts` (optional sprite in `BOSS_OPTIONAL_SPRITES` + tinted procedural fallback). Every dangerous attack needs a ≥ 0.4 s telegraph; no global random call. Test: `tests/m10cp7.cjs`.
- **Add a new Enemy or Boss:**
  1. Add sprite `public/art/sprites/<name>.png` (`96×96` or `128×128`), register in `src/assets/artLoader.ts` (including flash silhouette).
  2. Add kind to `EnemySpawn['kind']` in `src/world/dungeonGen.ts`, spawn stats in `DungeonScene.spawnEnemy()`, AI in `src/dungeon/enemyAi.ts`, and rendering in `src/dungeon/dungeonRenderer.ts`.
- **Add a new Hub Station / In-Game Modal:**
  1. Place prop + prompt in `src/scenes/HubScene.ts` (or `ShopScene.ts` / `BackroomScene.ts` / `HangarScene.ts`) with `drawPixelShadow` + `drawGlow` + Y-sorting.
  2. Wire callback in `src/main.ts` → add modal renderer in `src/ui/UIManager.ts` (keep headers single-line with `white-space: nowrap`).
- **Add a new Global Market Trend (M9):**
  1. Extend `MarketTrendId`, `MARKET_TRENDS` and `MARKET_TREND_ORDER` in `src/data/marketTrends.ts` (`multiplierFor(item)`). Changing the order/length re-rolls which trend any given day gets — it must stay identical for all players.
  2. UI is automatic (`renderTrendBannerHtml`, HUD pill, Codex pill). Never use `new Date()` directly — go through `getTodayMarketTrend(now?)`.
- **Change the Weekly Galactic Trial rules (M9):**
  1. Rotation, normalised levels (`TRIAL_COMBAT_LEVELS`), par times & scoring live in `src/systems/weeklyTrial.ts`; runtime wiring in `DungeonScene` (`isWeeklyTrial`, `startWeeklyTrial`, `finishWeeklyTrial`, `activeCompanion` getter).
  2. Trial invariants: no loot (`spawnLootDrop` guard), no credits, no inventory changes, no `sectorNCleared`/`bossDefeatedCount`/`recordSectorClear`, no NG+ scaling, no infusions/companion/alchemy buff. Seeds apply ONLY around the synchronous `generateSectorFloor()` via `withSeededRandom` (never wrap async code).
  3. Changing `dungeonGen.ts` changes the layouts of future weeks (acceptable, note it in the GDD).
- **Add / change a Story scene or flag (M10-A):**
  1. Scenes are pure data in `src/data/story/storyScenes.ts` (format: `storyTypes.ts`): ≤ 180 chars per box, ≤ 8 boxes per path, ≤ 3 answers, ≤ 2 narrator boxes per path, every answer needs a `chronicle` sentence, trust deltas −1…+2.
  2. New flag → extend `StoryFlagId` (`types.ts`) **and** `ALL_STORY_FLAGS` (`storyChapters.ts`); set it in a choice (`setFlags`) and read it via `variants`/`requires`.
  3. Run `validateStoryScenes(STORY_SCENES, { requireComplete: true })` (must return `[]`). Story chapter = max, never decreases (NG+).
  4. Rewards are comfort/visuals/discounts — **never credits**; Lyra/Vex perks must stay off in the Weekly Trial.
- **Add a new Sector Room Mechanic (M10-A):**
  1. Types on `DungeonRoom` (`world/dungeonGen.ts`), placement in `dungeon/mechanicsGen.ts` — **never use the global random call there** (own `mulberry32(hashString(...))` per room; otherwise every seeded Weekly-Trial layout changes), runtime in `dungeon/roomMechanics.ts` (cycles via `scene.mechanicsClock`, never `scene.time`), drawing in `dungeon/roomMechanicsRenderer.ts`.
  2. Check: seeded floor identical with/without mechanics (`generateSectorFloor(..., { mechanics })`), free-zone rules, `TRIAL_MECHANICS_FROM_WEEK` gate for running trial weeks.
- **Add a Promenade element (M10-A):** add a case in `scenes/hubEvolution.ts` — sprite via `M10_OPTIONAL_SPRITES` in `artLoader.ts` **plus** a procedural fallback; never replace `hub_bg.png` (collisions/prompts hang on it).
- **Add a new Leaderboard / Cloud Record Field:**
  1. Extend `CaptainRecords` & `LeaderboardEntry` in `src/types.ts`.
  2. Persist & restore in `src/systems/gameState.ts`, map in `firebaseService.buildLeaderboardEntry()` (`src/services/firebaseService.ts`), and display in `UIManager.renderGuildBoardModal()`.

---

## 5. Key Commands
```bash
npm run build      # TypeScript check + Vite production build (index, dungeon & firebase chunks)
npm run verify     # Build + Invarianten + Sprite-Check + alle Headless-Tests (vor jedem Push)
npm test -- m10p3  # einzelne Tests (tests/*.cjs, Playwright)
npm run check:sprites  # listet fehlende optionale Sprites (Fallbacks aktiv)
npm run dev        # Local Vite dev server (use --host 127.0.0.1 --strictPort in Headless Chrome tests)
```

---

## 6. Zusammenarbeit Antigravity ↔ Claude Code (Antigravity-Zusatz)
> Entsprechung zu `CLAUDE.md` für Antigravity-Sitzungen (diese Datei wird automatisch geladen).

1. **Sitzungsstart (immer zuerst):** `git fetch origin && git status` (und `git pull --ff-only`, falls `origin/main` voraus ist), dann [`HANDOFF.md`](HANDOFF.md) lesen. Claude Code und Antigravity pushen abwechselnd auf `main`; eine wiederaufgenommene VM kann auf einem älteren Commit stehen.
2. **Typische Aufgabenteilung:**
   - **Antigravity (`generate_image` + PIL + Repo-Commit):** Pixel-Art-Sprites, M11-Teile-Sheets (`art_source/rigs/<id>_parts.png`) und Pose-Sheets (`art_source/poses/<id>_poses.png`) sowie reguläre Code-/Doku-Aufgaben nach Bedarf.
   - **Claude Code:** Architektur-Pläne, Code-Phasen, Tests, `npm run art:import` & `npm run verify`.
3. **Pflicht-Workflow für generierte Bilder (`generate_image`):**
   - `generate_image` speichert zunächst nur im internen Artifact-Ordner (oft als `.jpg`) — **niemals** dort liegen lassen!
   - Bestehendes Sprite als Referenz über `ImagePaths` übergeben (z. B. `public/art/sprites/boss.png` für den Kern-Wächter); Seitenverhältnis setzen (`AspectRatio: '3:2'` für 3×2-Teile-Sheets, `'1:1'` für 2×2-Pose-Sheets und Einzel-Sprites).
   - **Sicht- & Rasterprüfung vor Ablage:** Per `view_file` und Python/PIL prüfen, dass alle Teile sauber in ihrer Zelle liegen, keine Rasterlinien/Texte/Schatten/Überlappungen vorhanden sind und einheitlicher Maßstab gilt. Bei 3×2-Teile-Sheets ggf. per PIL sauber ohne Skalierungsverlust in ein reines `#FFFFFF`-Raster `1536×1024` (`512×512` pro Zelle) als verlustfreies `.png` nach `art_source/rigs/<id>_parts.png` packen; fertige Einzel-Sprites nach `ART_AND_DESIGN_GUIDE.md` §3 freistellen und nach `public/art/sprites/<name>.png` legen.
   - **Credits sparen:** Bei neuen Serien (wie M11) immer erst 1–2 Pilot-Sheets erzeugen, pushen und vom Projektinhaber abnehmen lassen, bevor der Rest generiert wird.
4. **VM-Besonderheiten (Antigravity):** `python3` mit `Pillow` und `/usr/bin/google-chrome` sind vorinstalliert. In einer frischen VM fehlt ggf. `node_modules` → für `npm run build` / `npm run verify` zuerst `npm install` (und falls Playwright-Chromium fehlt: `npx playwright install chromium`).
5. **Übergabe & Push:** Nach Abschluss `HANDOFF.md` aktualisieren, auf `main` committen und nach `origin main` pushen, damit Claude Code den aktuellen Stand direkt per `git pull` sieht.

