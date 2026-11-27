@AGENTS.md

# Claude-Code-Zusatz
- Einstieg: erst `AGENTS.md`, dann `HANDOFF.md` (aktueller Stand & nächster Schritt).
- **Pushen: `npm run ship`** (fetch → merge `origin/main` → verify → push `main`; nie bei Fehlern). Mehrere Chats parallel: `PARALLEL_WORK.md`, Status je Bereich in `handoff/`. Vor jedem Push gilt weiterhin `npm run verify` (Build → Invarianten → Sprite-Check → Tests) — `ship` ruft es auf. Nur ein Teil davon? `npm test -- m10p3` (einzelne Tests), `npm run build`.
- Neue Fallbacks/Platzhalter-Grafiken oder neue M11-Sheets anlegen? Siehe `AGENTS.md` §3 Regel 7 („Fehlende Sprites melden & priorisiert einreihen“): immer sofort mit Priorität (`P0`–`P4`), Zielpfad, Referenzbild und Prompt-Verweis in `SPRITE_QUEUE.md` einsortieren und kurz in `HANDOFF.md` vermerken.
