@AGENTS.md

# Claude-Code-Zusatz
- Einstieg: erst `AGENTS.md`, dann `HANDOFF.md` (aktueller Stand & nächster Schritt).
- **Pushen: `npm run ship`** (fetch → merge `origin/main` → verify → push `main`; nie bei Fehlern). Mehrere Chats parallel: `PARALLEL_WORK.md`, Status je Bereich in `handoff/`. Vor jedem Push gilt weiterhin `npm run verify` (Build → Invarianten → Sprite-Check → Tests) — `ship` ruft es auf. Nur ein Teil davon? `npm test -- m10p3` (einzelne Tests), `npm run build`.
- **Sprites als Standardwerkzeug (`AGENTS.md` Regel 14/15):** Bei jedem neuen Feature, Umbau oder jeder Verbesserung prüfen, ob eigene Sprites es schöner machen — dann direkt per `npm run art:gen` erzeugen (Key kommt über den Proxy) bzw. in `SPRITE_QUEUE.md` bestellen. Nicht an Bild-Credits sparen.
- **Dokumentieren (`AGENTS.md` Regel 19):** Jede Erkenntnis/Falle/Entscheidung sofort ins Status-Blatt (`handoff/…`, „Praxis-Learnings“) und im selben Commit pushen — damit ein Chatwechsel nahtlos weitergeht.
- Neue Fallbacks/Platzhalter-Grafiken oder neue M11-Sheets anlegen? Siehe `AGENTS.md` §3 Regel 7 („Fehlende Sprites melden & priorisiert einreihen“): immer sofort mit Priorität (`P0`–`P4`), Zielpfad, Referenzbild und Prompt-Verweis in `SPRITE_QUEUE.md` einsortieren und kurz in `HANDOFF.md` vermerken.
