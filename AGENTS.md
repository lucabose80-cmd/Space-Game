# AGENTS.md — AI Agent Onboarding Guide (*STARLIGHTER*)

> **Read this file first.** It gives any AI coding agent or LLM immediate context on architecture, hard design invariants, build/test conventions, and where to find deeper docs — minimizing search overhead and preventing regressions.

---

## 1. Project Snapshot (v1.2 — Milestone 9 implemented)
- **Game:** **STARLIGHTER** — Cozy Retro-Sci-Fi Action-RPG & Space-Shop browser game inspired by *Moonlighter 1*.
- **Stack:** `TypeScript` (strict) + `Vite 8` + custom HTML5 Canvas 2D engine (`960×540` HD pixel-art buffer at `RENDER_SCALE = 2` over `480×270` logical coordinates) + Web Audio procedural synth + Firebase Auth & Cloud Firestore (`starlighter-15b1f`).
- **Deployment:** Pushing to `main` triggers automatic Vercel deployment. **Never** tell the user to open a `localhost` URL.
- **Language:** All in-game UI text, toasts, item names, and user-facing responses are in **German**.

## 2. Documentation Map (Read When Relevant)
| Document | When to Read |
| :--- | :--- |
| [GAME_DESIGN_DOCUMENT.md](GAME_DESIGN_DOCUMENT.md) | Current milestone status (M1–M9 + Firebase + Architecture Split live), full feature list, Phase 2 Roadmap (M10-A), and codebase directory map. |
| [MILESTONE_8_ARCHITECTURE.md](MILESTONE_8_ARCHITECTURE.md) | Architecture & subsystem spec for Milestone 8 (Haggling, Patron Reputation, Market Terrace, Alchemy Bar, Solaris Trade Bank & Save v9). |
| [MILESTONE_9_ARCHITECTURE.md](MILESTONE_9_ARCHITECTURE.md) | Architecture & implementation record for M9 (Captain Files, Global Market Trend, Ghost Captains, Weekly Seeded Trial, Save v10). |
| [MILESTONE_10_ARCHITECTURE.md](MILESTONE_10_ARCHITECTURE.md) | **Next milestone (planned):** Architecture & phased implementation plan for M10-A (branching NPC story with trust & flags, living Port Solaris incl. optional sprite pack, sector room mechanics S2–S4, boss phase-2 music, touch size, aim assist & text speed, Save v11). Follow its phases in order. |
| [ART_AND_DESIGN_GUIDE.md](ART_AND_DESIGN_GUIDE.md) | Generating new pixel-art sprites/backgrounds (prompt templates, color palettes, Python flood-fill extraction script, `artLoader.ts` & UI rules). |
| [TESTING_AND_VERIFICATION.md](TESTING_AND_VERIFICATION.md) | Running `npm run build`, checking invariants, Headless Chrome CDP verification harness, visual screenshot QA, and known pitfalls. |
| [firestore.rules](firestore.rules) | Production Firestore security rules (`saves/{uid}`, `leaderboard/{uid}`, `activities`). |

---

## 3. Non-Negotiable Rules (Do & Don't)
1. **Zero-Dungeon-Credits Rule:** **NEVER** add `state.credits +=` inside `src/scenes/DungeonScene.ts`, `src/dungeon/enemyAi.ts`, or `src/dungeon/dungeonRenderer.ts`. Credits are earned exclusively through selling relics in *Astro-Barter*, bounties, and trade.
2. **Everything In-Game:** Never build external out-of-game menus. Every feature (Cloud-Save/Scoreboard, Jukebox, Infusions, Companions, Endless Rift, Market Terrace) must live as an interactive station/terminal/NPC inside the game world.
3. **Backward-Compatible Saves:** Current `SAVE_VERSION = 10` in `src/systems/gameState.ts`. Any new field in `SaveData` (`src/types.ts`) must be optional (`?`) and safely defaulted in `GameState.load()`.
4. **Firebase Config Policy:** Public Firebase web config for `starlighter-15b1f` intentionally lives in `src/services/firebaseConfig.ts` (with `VITE_FIREBASE_*` env override support) because Vercel Free does not allow env var configuration. Security is enforced server-side via `firestore.rules` + Firebase Authorized Domains.
5. **Strict TypeScript:** `tsconfig.json` enforces `verbatimModuleSyntax`, `erasableSyntaxOnly`, `noUnusedLocals`, and `noUnusedParameters`. Always use `import type` for type-only imports.
6. **Mandatory Verification Before Every Push:**
   - Run `npm run build` (`tsc && vite build`) → 0 errors.
   - Verify Zero-Dungeon-Credits invariant.
   - Run Headless Chrome CDP logic + live screenshot check and **visually inspect** screenshots before committing and pushing to `origin main`.

---

## 4. Quick "How to Add X" Cheat Sheet
- **Add a new Relic / Material:**
  1. Generate & flood-fill extract `64×64` PNG → `public/art/sprites/item_<id>.png` (auto-loaded by `artLoader.ts`!).
  2. Add `ItemDef` to `ITEMS` in `src/data/items.ts` (and `rollLootItem` / `rollRiftLootItem` if needed).
- **Add a new Weapon Infusion or Rift Mutator:**
  1. Define in `src/data/infusions.ts` + extend `InfusionId` / `RiftMutatorId` in `src/types.ts`.
  2. Wire combat behavior in `DungeonScene.ts` (`damageEnemy` / `onEnemyKilled` / `damagePlayer`), status ticks in `src/dungeon/enemyAi.ts`, and FX in `src/dungeon/dungeonRenderer.ts`.
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
- **Add a new Leaderboard / Cloud Record Field:**
  1. Extend `CaptainRecords` & `LeaderboardEntry` in `src/types.ts`.
  2. Persist & restore in `src/systems/gameState.ts`, map in `firebaseService.buildLeaderboardEntry()` (`src/services/firebaseService.ts`), and display in `UIManager.renderGuildBoardModal()`.

---

## 5. Key Commands
```bash
npm run build      # TypeScript check + Vite production build (index, dungeon & firebase chunks)
npm run dev        # Local Vite dev server (use --host 127.0.0.1 --strictPort in Headless Chrome tests)
```
