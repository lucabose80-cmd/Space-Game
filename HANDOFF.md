# HANDOFF — Übergabe zwischen Claude Code, Antigravity & Co.

> **Zweck:** Jedes Werkzeug (und jede neue Sitzung) soll hier in 1 Minute wissen, wo das Projekt steht. **Am Ende jeder Arbeitssitzung aktualisieren** (kurz halten, veraltete Punkte löschen).

## Stand
- Meilenstein 10-A ist umgesetzt, `SAVE_VERSION = 11`, alles auf `main` (Vercel deployt automatisch).
- Doku: `GAME_DESIGN_DOCUMENT.md` (Status), `MILESTONE_10_ARCHITECTURE.md` §11 (Umsetzungsnotizen & Abweichungen).

## Arbeitsablauf (in jeder Umgebung gleich)
```bash
npm install
npx playwright install chromium   # einmalig, nur für die Tests
npm run verify                    # Build + Invarianten + Sprite-Check + Tests
```
- Einzelne Tests: `npm test -- m10p3 t5` · Screenshots der Tests landen in `tests/out/` (nicht committet).
- Dev-Test-Hook `window.__game` gibt es nur im Vite-Dev-Server.

## ⚠ Fehlende Sprites (Fallbacks aktiv → neue PNGs gewünscht)
`npm run check:sprites` listet die aktuelle Lage. Stand: **alle 12 optionalen M10-Sprites fehlen**
(`prop_hub_*`, `prop_kael_memorial`, `prop_lyra_echo_sign`, `prop_nyx_free_lantern`, `prop_vex_*`, `npc_pilgrim`, `npc_foundry_worker`, `npc_elder_scholar`).
- Prompts & Maße: `ART_AND_DESIGN_GUIDE.md` §7 · Ablage: `public/art/sprites/<datei>.png` (96×96, kein Code nötig).
- Schwächster Fallback zuerst ersetzen: Vex-Bake, Zyklus-Hologramm, Obelisk, Klassentafel.
- **Wer einen Fallback/Platzhalter neu anlegt, trägt ihn hier ein** (Datei, Key, Prompt-Abschnitt im Art-Guide).

## Nächster Schritt
- **Meilenstein 10-C umsetzen:** `MILESTONE_10C_ARCHITECTURE.md` Phase für Phase (Phase 0 zuerst).

## Offene Punkte
- Bildgenerierung: Gemini-Image-API braucht ein Projekt mit Abrechnung (Free Tier = Limit 0); Antigravity-Credits sind wochenweise.
- Ideen: siehe `GAME_DESIGN_DOCUMENT.md` §5.
