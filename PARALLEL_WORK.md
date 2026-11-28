# PARALLEL_WORK.md — Mehrere Chats/Agenten gleichzeitig (ohne Merge-Chaos)

> Beispiel: Chat A riggt Krall, Chat B bindet die Drohne ein, Chat C arbeitet am Geschütz, Antigravity liefert Sprites. Mit den Regeln unten kollidieren sie praktisch nicht.

## 1. Eigentum je Bereich (jeder Chat nur in seinem Bereich ändern)
| Bereich | Status-Blatt | Animation | Rig-Daten | Test |
| :--- | :--- | :--- | :--- | :--- |
| Krall | `handoff/krall.md` | `src/dungeon/anim/rigs/krall.ts` (+ Angriffs-Zonen `bosses/defs.ts` Krall-Block, `bosses/bossFx.ts` `fx`) | `src/data/rigs/krall.json` | `tests/m11p5_krall.cjs` |
| Kern-Wächter | `handoff/core_warden.md` | `src/dungeon/anim/rigs/core_warden.ts` | `src/data/rigs/core_warden.json` | `tests/m11p2.cjs` |
| Geschütz | `handoff/enemy_turret.md` | `src/dungeon/anim/rigs/turret.ts` | `src/data/rigs/turret.json` | `tests/m11p7_turret.cjs` |
| Drohne / Phasen-Jäger / … | `handoff/enemy_<kind>.md` | `src/dungeon/anim/rigs/<rig-id>.ts` | `src/data/rigs/<rig-id>.json` | `tests/m11p…_<rig>.cjs` |

Rig-Animationen und Rig-Daten werden **automatisch gefunden** (`import.meta.glob`): ein neues Rig = neue Dateien, **keine** Änderung an gemeinsamen Dateien. Vorlage: `anim/rigs/turret.ts` (`export const anim: RigAnim`, Schnittstelle `anim/rigAnim.ts`).

## 2. Gemeinsame Dateien (heikel — kleine, gezielte Änderungen, vorher `git fetch`)
`anim/bossAnims.ts` (Engine) · `anim/animCommon.ts` · `anim/rigAnim.ts` · `engine/rig.ts` · `dungeonRenderer.ts` (Renderer-Zweig je Gegner) · `scripts/art-import.py` · `SPRITE_QUEUE.md` (**nur Zeilen der eigenen IDs ändern**, nichts umsortieren) · `HANDOFF.md` (nur bereichsübergreifend; Bereichs-Status gehört in `handoff/`).

## 3. Ablauf pro Sitzung
1. `git fetch origin && git merge origin/main` (oder `git pull --ff-only`), dann `handoff/<bereich>.md` und ggf. `SPRITE_QUEUE.md` lesen.
2. Arbeiten, **kleine Commits**.
3. Status in `handoff/<bereich>.md` aktualisieren (nicht in `HANDOFF.md`).
4. **`npm run ship`** statt manuellem Push: holt `origin/main`, merged (Abbruch bei Konflikt), führt `verify` aus (bei Doku-/Asset-only: Invarianten + Sprite-Check), pusht **nur bei Erfolg** nach `main` und auf den Arbeits-Branch, wiederholt bis zu 5×, falls jemand schneller war. Ab dem 2. Versuch läuft statt des vollen `verify` (> 10 min) nur eine **Schnellprüfung** (Build + Invarianten + Sprite-Check + die vom neuen Merge geänderten Tests + `t5`), denn der eigene Stand war schon voll grün und die fremden Commits haben ihren `verify` vor ihrem Push bestanden — sonst gewinnt bei vielen parallelen Chats nie jemand das Rennen. Voller Lauf bei jedem Versuch: `SHIP_FULL_VERIFY=1 npm run ship`.
5. Bei Merge-Konflikt: `git status`, Konflikt lösen (beide Seiten behalten — meist Status-Zeilen), `git add`, `git commit`, erneut `npm run ship`.

## 4. Regeln, die Konflikte vermeiden
- **Nie** direkt `git push` ohne vorheriges Merge + Tests; **nie** `verify || git push` oder `;`-Ketten (ein roter Test darf nicht pushen) — dafür gibt es `npm run ship`.
- Eigene Tests je Rig anlegen (`m11p…_<rig>.cjs`, wird vom Runner automatisch gefunden) statt `m11p2.cjs` zu erweitern.
- Sprite-Wünsche (ausdrücklich erwünscht, auch Ersatz für Sheets, die nicht gefallen — `AGENTS.md` Regel 14): neue Zeile in `SPRITE_QUEUE.md` mit **neuer, fortlaufender ID** in der passenden Priorität (kein Umnummerieren).
- `npm run art:import -- <rig> --force` ändert nur `public/art/rigs/<rig>/` — nie ohne Rig-ID für alle Rigs gleichzeitig laufen lassen.
- Test-/Screenshot-Hilfsdateien nicht committen (`tests/out/`, `tests/zz_*.cjs`).

## 5. Claim-Regel & Kollisions-Protokoll (nur ein Besitzer pro Bereich)
> Anlass (2026-11-28): Claude Code und Antigravity haben denselben Bereich (Leviathan-Arena: Körper-Sprites, Kran-Arme, Schatzkammer) **gleichzeitig** gebaut — mit gleichen Dateinamen. Ergebnis: Merge-Konflikte in 6 Dateien und eine komplette Doppelarbeit, die verworfen werden musste. Das kostet mehr als jedes Warten.
1. **Vor dem Start (30 Sekunden):** `git fetch` → `git log origin/main --since="12 hours ago" --oneline -- <Pfade des Bereichs> handoff/<bereich>.md` und die **Claim-Liste** in [`handoff/README.md`](handoff/README.md) + offene `[~]`-Zeilen in `SPRITE_QUEUE.md` lesen. Hat jemand den Bereich oder dieselben Dateien → **nicht anfangen**, sondern Absprache (Inhaber fragen) oder anderen Bereich nehmen.
2. **Claim eintragen** (Zeile in der Claim-Liste: Besitzer, seit wann, Umfang *und was bewusst nicht*) und **sofort pushen** (`npm run ship`), noch vor der ersten Code-Zeile. Beim Beenden Zeile auf „frei“ setzen (Teil des letzten Push-Commits).
3. **Dateinamen sind Besitz:** Neue Sprites/Dateien nur anlegen, wenn die ID in `SPRITE_QUEUE.md` auf `[~]` *„in Arbeit: <Besitzer>“* steht. Gleicher Dateiname von zwei Seiten = Konflikt, den Git nicht lösen kann (Binärdateien!).
4. **Früh und klein pushen** (alle ~30–45 min, `AGENTS.md` Regel 17) — je länger ein Stand lokal liegt, desto wahrscheinlicher, dass jemand parallel dasselbe baut. Vor jedem größeren Schritt erneut `git fetch`.
5. **Kollision trotzdem passiert?** Nicht blind mergen und auch nicht eine Seite stillschweigend überschreiben: (a) `git merge --abort`, (b) die eigene, nicht gepushte Arbeit in einen Sicherungs-Branch legen (`git branch backup/<name> HEAD`), (c) **beide Ergebnisse im Spiel ansehen** (Screenshot/`?bosslab`) und die bessere/vollständigere behalten — meist die bereits gepushte —, (d) Brauchbares aus dem Backup gezielt nachziehen, (e) dem Projektinhaber in einem Satz melden, was verworfen wurde und warum.
6. **Lernen weitergeben:** Was in der Arbeit schiefging oder gut klappte, gehört als nummerierter Punkt in den Abschnitt „Praxis-Learnings“ des Status-Blatts (Beispiel: `handoff/endboss_arena.md`) — kurz, konkret, mit Datei/Funktion. Wer einen Bereich übernimmt, liest ihn zuerst.
