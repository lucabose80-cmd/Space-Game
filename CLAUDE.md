@AGENTS.md

# Claude-Code-Zusatz
- **PC first, Handy second (Inhaber-Vorgabe, `AGENTS.md` Regel 21):** Alles zuerst für PC (Maus+Tastatur) entwerfen, aber am Handy quer **und** hoch voll nutzbar halten — eigene Media-Queries, nie das PC-Layout verbiegen; UI vor dem Push in Viewports `915×412`, `844×390`, `390×844` ansehen.
- Einstieg: erst `AGENTS.md`, dann `HANDOFF.md` (aktueller Stand & nächster Schritt).
- **Pushen: `npm run ship`** (fetch → merge `origin/main` → verify → push `main`; nie bei Fehlern). Mehrere Chats parallel: `PARALLEL_WORK.md`, Status je Bereich in `handoff/`. Vor jedem Push gilt weiterhin `npm run verify` (Build → Invarianten → Sprite-Check → Tests) — `ship` ruft es auf. Nur ein Teil davon? `npm test -- m10p3` (einzelne Tests), `npm run build`.
- **Sprites als Standardwerkzeug (`AGENTS.md` Regel 14/15):** Bei jedem neuen Feature, Umbau oder jeder Verbesserung prüfen, ob eigene Sprites es schöner machen — dann direkt per `npm run art:gen` erzeugen (Key kommt über den Proxy) bzw. in `SPRITE_QUEUE.md` bestellen. Nicht an Bild-Credits sparen.
- **Sitzungs-Abschluss (`AGENTS.md` Regel 20, Pflicht):** vor dem Ende jeder Sitzung Zeile in `HANDOFF.md` → „🔁 Letzte Sitzungen“ + Status-Blatt aktualisieren, pushen, und als letzten Satz der Abschlussmeldung den Startsatz für den nächsten Chat nennen (Vorlagen: `KI_WECHSEL.md` §0).
- **Dokumentieren (`AGENTS.md` Regel 19):** Jede Erkenntnis/Falle/Entscheidung sofort ins Status-Blatt (`handoff/…`, „Praxis-Learnings“) und im selben Commit pushen — damit ein Chatwechsel nahtlos weitergeht.
- Neue Fallbacks/Platzhalter-Grafiken oder neue M11-Sheets anlegen? Siehe `AGENTS.md` §3 Regel 7 („Fehlende Sprites melden & priorisiert einreihen“): immer sofort mit Priorität (`P0`–`P4`), Zielpfad, Referenzbild und Prompt-Verweis in `SPRITE_QUEUE.md` einsortieren und kurz in `HANDOFF.md` vermerken.

# Subagents: dauerhaft erlaubt (Auftrag des Projektinhabers)
Der Inhaber hat die Subagents aus `.claude/agents/` **ausdrücklich und dauerhaft freigegeben** — setze sie ohne Nachfrage ein, wenn die Bedingung zutrifft:
- **`verify-runner`**: vor jedem `npm run ship`/Push und bei jeder Prüfung mit langer Ausgabe (`verify`, Teiltests) — statt die Ausgabe selbst zu lesen. Mehrere Prüfer dürfen parallel laufen.
- **`sprite-qa`**: nach jedem `art:gen`/`art:import` und vor dem Commit neuer/geänderter PNGs.
- **`rig-tester`**: bei Rig-/Boss-/Gegner-Arbeit nach einem Teilschritt (m11-Tests + Checklisten-Abgleich).
- **`doc-keeper`**: für Regel 19 (Learnings, Checkliste ✅/⬜, nächste Schritte ins `handoff/`-Blatt) — gib ihm die Fakten vor, er formuliert nur ein.
- **`Explore`**: bei Fragen „wo/wie wird X überall verwendet“ über mehrere Dateien.
Nicht einsetzen bei kleinen zusammenhängenden Änderungen, bei Schreibzugriffen auf dieselben Dateien parallel, bei `art:gen` und bei Architektur-/Balancing-Entscheidungen. Code ändern und pushen macht nur der Hauptchat.
