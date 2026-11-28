# KI_WECHSEL.md — Einstieg für JEDES KI-Werkzeug (Claude Code, Antigravity/Gemini, Codex, Cursor, Copilot, …)

> **Zweck:** Credits/Limits eines Werkzeugs sind leer → ein anderes übernimmt **ohne Rückfrage beim Inhaber**. Alles Wissen steht im Repo, nicht im Chat. Dieses Dokument ist werkzeugneutral; `AGENTS.md` ist die verbindliche Regelsammlung.

## 0. Startsätze zum Kopieren (Inhaber: einfach in einen **neuen** Chat einfügen — spart Credits)
- **Weitermachen, wo der letzte Chat aufgehört hat:**
  > Lies `AGENTS.md`, dann in `HANDOFF.md` den Block „🔁 Letzte Sitzungen“ und das dort genannte Status-Blatt in `handoff/`. Mach beim „Nächster Schritt“ der obersten Zeile weiter, ohne den Code neu zu durchsuchen. Trag am Ende dein Sitzungs-Protokoll ein (Regel 20) und pushe mit `npm run ship`.
- **Bestimmten Bereich fortsetzen:**
  > Lies `AGENTS.md` und `handoff/<bereich>.md` (Abschnitte „Praxis-Learnings“ + „Nächster Schritt“). Setze den Claim, arbeite die ⬜-Punkte ab (Regel 17), dokumentiere laufend (Regel 19/20).
- **Nur Sprites abarbeiten (Antigravity/Gemini):**
  > Lies `AGENTS.md` §6, `HANDOFF.md` und `SPRITE_QUEUE.md`; arbeite die offenen `[ ]`-Einträge von oben ab (Skill `sprite-batch`), beachte STOP-GATES, trage am Ende das Sitzungs-Protokoll ein.
- Jeder Chat endet mit einer Abschlussmeldung, deren letzter Satz bereits der **fertige Startsatz für den nächsten Chat** ist (Regel 20).

## 1. Die ersten 5 Minuten (in dieser Reihenfolge)
1. `git fetch origin && git status` → ist `origin/main` voraus: `git pull --ff-only` (Werkzeuge pushen abwechselnd auf `main`).
2. **`AGENTS.md`** lesen (Regeln, Dokumentenkarte). Dann **`HANDOFF.md`** (Gesamtstand) und **`handoff/README.md`** (Claim-Liste: wer arbeitet woran; Status-Blatt je Bereich).
3. Den Bereich der Aufgabe wählen → **Claim eintragen und pushen**, dann das Status-Blatt `handoff/<bereich>.md` lesen — besonders **„Praxis-Learnings“** und **„Nächster Schritt“**: dort steht, was der Vorgänger wusste und der nächste konkrete Schritt.
4. Frische VM/Rechner: `npm install` · `npx playwright install chromium` (nur für Tests) · Python 3 + `pip install pillow numpy` (Sprite-Skripte).
5. Arbeiten in **kleinen Commits**, früh pushen: **`npm run ship`** (merge → verify → push `main`; pusht nie bei Fehlern). Nie `git push` direkt, nie `--force`.

## 2. Begriffe je Werkzeug (gleiche Regeln, andere Namen)
| Hier steht … | bedeutet … | Alternative in anderen Werkzeugen |
| :--- | :--- | :--- |
| `Read` / `view_file` (Bild ansehen) | PNG visuell prüfen | jedes Bild-Vorschau-Werkzeug / Bild an den Chat anhängen |
| „Network Secret Google AI Studio Key“ | Gemini-Key kommt in Claude-Cloud-Sessions automatisch über den Proxy | `export GEMINI_API_KEY=…` **oder** Datei `~/.config/starlighter/gemini_api_key` (chmod 600). **Nie** Key ins Repo/Chat. |
| `generate_image` (Antigravity) | Bildgenerierung im Werkzeug | `npm run art:gen -- --ref … --prompt-file … --out art_source/_raw/<n>.png` (läuft in jedem Werkzeug mit Key) |
| Skills / Slash-Befehle (`/sprite-batch`, `Skill`) | Claude-/Antigravity-Komfort | nicht nötig: Ablauf steht in `SPRITE_QUEUE.md` §0, `AGENTS.md` §6, `RIGGING_GUIDE.md` |
| Subagenten, Tasks, Artifacts | nur Claude-Komfort | ignorieren; nichts im Projekt hängt davon ab |
| `?bosslab`, `?arena` | Prüf-URLs im Spiel | Vite-Dev-Server (`npm run dev -- --host 127.0.0.1 --strictPort`), Test-Skripte unter `tests/` |

## 3. Was geht ohne welche Fähigkeit? (Notfall-Matrix)
| Dir fehlt … | Weiter machen so |
| :--- | :--- |
| **Bildgenerierung / Gemini-Credits** | Code, Tests, Doku normal weiterführen. Benötigte Sprites **nicht** durch Code-Tricks ersetzen: Fallback aktiv lassen, Zeile in `SPRITE_QUEUE.md` (Priorität, Zielpfad, Referenz, Prompt) + Vermerk im Status-Blatt (`AGENTS.md` Regel 7/14). Bilder generiert später jedes Werkzeug mit Key. |
| **Bildvorschau** | Kein Sprite committen, das du nicht gesehen hast. Stattdessen Code/Doku-Arbeit, Sprites als `[ ]`-Bestellung hinterlassen. |
| **Browser/Playwright** | `npm run build` + `npm run check:invariants` + `npm run check:sprites` laufen immer; Tests vom nächsten Werkzeug laufen lassen. Im Status-Blatt „Tests nicht gelaufen“ vermerken. `npm run ship` pusht nur bei grünem `verify` — bei Fehlschlag Stand per `git push origin HEAD` auf den eigenen Branch sichern (Commit `WIP: …`) und Blocker notieren. |
| **Push-Rechte auf `main`** | Eigenen Branch pushen, im Status-Blatt „nicht gemergt“ vermerken, Inhaber informieren. |
| **Lange Sitzung / Limit-Warnung** | Sofort: committen, `npm run ship` (oder WIP-Push), Status-Blatt auf „nächster Schritt“ bringen, Claim freigeben. Erst dann weiterarbeiten. |

## 3b. Besonderheiten einzelner Werkzeuge
**GitHub Copilot (Coding-Agent / Chat in VS Code):**
- Liest `.github/copilot-instructions.md` (Wegweiser) und `AGENTS.md`. Der Cloud-Agent arbeitet auf einem eigenen Branch und öffnet Pull Requests — er hat **kein** Recht auf `main`: `SHIP_BRANCH_ONLY=1 npm run ship` (pusht nur den Branch, der Inhaber mergt den PR). Umgebung (Node, Playwright, Python+Pillow) richtet `.github/workflows/copilot-setup-steps.yml` ein.
- Hat in der Regel **keinen Gemini-Key** und kann Bilder nicht ansehen → Sprite-Arbeit nur als Bestellung (Abschnitt 3). Key ggf. als Copilot-Environment-Secret `GEMINI_API_KEY` hinterlegen (Repo → Settings → Environments → copilot).
- Vercel baut Pull-Request-Branches **nicht** (nur `main`, `vercel.json`) — Ansehen daher über `?bosslab`/Tests oder nach dem Merge.

**Replit (Agent / Workspace):**
- Liest `replit.md` (Wegweiser) → `KI_WECHSEL.md`. **Nicht** auf Replit deployen: Deployment läuft ausschließlich über `main` → Vercel; Replit dient nur zum Arbeiten. Dev-Server: `npm run dev -- --host 0.0.0.0` (Port 5173).
- Secrets: `GEMINI_API_KEY` im Replit-Secrets-Tab (nicht im Repo). Git-Push braucht dort GitHub-Verbindung/Token; sonst Branch-only (siehe oben).
- Playwright-Chromium braucht in Replit evtl. System-Pakete (`npx playwright install --with-deps chromium`); klappt das nicht: Tests auslassen, `build` + `check:*` laufen immer, im Status-Blatt „Tests nicht gelaufen“ vermerken.
- Kleiner Arbeitsspeicher/Disk: `npm test` mit weniger Workern (`npm test -- <einzelner Test>`), `dist/` nicht committen.

## 4. Übergabe-Pflichten (Kurzfassung von `AGENTS.md` Regel 8/17/18/19)
- Status-Blatt `handoff/<bereich>.md` in **jedem** Push-Commit aktuell: Checkliste ✅/⬜, bei jedem ⬜ **Datei + Funktion + Befehl** des nächsten Schritts, laufende `[~]`-Zeilen, bekannte Fehler.
- **Alles Gelernte sofort** als nummerierten Punkt unter „Praxis-Learnings“ (Fehlerursache, Falle, funktionierender Befehl, Maße/Entscheidung, bewusst Weggelassenes). Nützliche Skripte nach `scripts/`, nicht in einen Temp-Ordner.
- Beim Beenden: Claim in `handoff/README.md` auf „frei“.
- Nie zwei Werkzeuge im selben Bereich (Claim-Liste!). Kollision → `PARALLEL_WORK.md` §5.

## 5. Harte Projektregeln, die jedes Werkzeug kennen muss (Volltext: `AGENTS.md` §3)
Nie `state.credits +=` im Dungeon-Code · alles In-Game · Save abwärtskompatibel (optionale Felder) · strikte TS (`import type`) · UI-Texte **deutsch** · Zeit nur über `startNight()/startDay()` · Balancing nur in `src/data/balance.ts` · vor Push `npm run verify` (via `ship`) · Ergebnisse (Screenshots in `tests/out/`) **ansehen**, nicht nur „grün“ melden · nie `localhost` als Link an den Inhaber.

## 6. Selbsttest für ein neues Werkzeug (2 Minuten)
`npm run build && npm run check:invariants && npm run check:sprites` → alles ok? · `npm run art:gen -- --check-key` (0 Kosten) → Key ok? · `npm test -- t5` → grün? Wenn ja, ist die Umgebung einsatzbereit; sonst Abschnitt 3.
